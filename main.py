import json
import js
from pyodide.ffi import to_js

async def on_fetch(request, env, ctx):
    headers = js.Headers.new()
    headers.set("Access-Control-Allow-Origin", "*")
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")

    if request.method == "OPTIONS":
        return js.Response.new("", status=200, headers=headers)

    if request.method == "POST":
        try:
            body_text = await request.text()
            body = json.loads(body_text)
            
            user_email = body.get("email", "")
            user_message = body.get("message", "")
            # لوو ایبل سے آنے والے ایکٹو ایجنٹ کا نام پکڑنا
            agent_name = body.get("agent", "Asha").lower()

            api_key = getattr(env, "VERTEX_API_KEY", None)
            if not api_key:
                return js.Response.new(json.dumps({"reply": "خرابی: کلاؤڈ فلئیر ورکر کی سیٹنگز میں VERTEX_API_KEY نہیں ملی۔"}), status=200, headers=headers)

            api_key = str(api_key).strip()
            project = 'tars-ai-chat-ann-assistant'
            location = 'us-central1'
            
            # کامیاب ماڈلز لاک کر دیے گئے ہیں
            target_model = 'gemini-2.5-pro' if user_email == "alirazasabi007@gmail.com" else 'gemini-2.5-flash'

            # 🎤 آوازوں، زبانوں اور جینڈر (Gender) کا فائنل روٹنگ سسٹم
            if "raza" in agent_name:
                voice_name = "ur-PK-Standard-B" # اردو مردانہ آواز
                lang_code = "ur-PK"
                system_instruction = "You are Raza, a helpful and smart male AI assistant. Respond naturally in Urdu script."
            elif "sara" in agent_name:
                voice_name = "en-US-Standard-C" # انگلش زنانہ آواز
                lang_code = "en-US"
                system_instruction = "You are Sara, a professional female AI assistant. Respond eloquently in English."
            elif "david" in agent_name:
                voice_name = "en-US-Standard-D" # انگلش مردانہ آواز
                lang_code = "en-US"
                system_instruction = "You are David, a competent male AI assistant. Respond professionally in English."
            else:
                voice_name = "ur-PK-Standard-A" # عائشہ (اردو زنانہ آواز)
                lang_code = "ur-PK"
                system_instruction = "You are Asha, a warm and friendly female AI assistant. Respond beautifully in Urdu script."

            url = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/{target_model}:generateContent?key={api_key}"
            
            payload = {
                "contents": [{
                    "role": "user",
                    "parts": [{ "text": f"{system_instruction}\n\nUser Message: {user_message}" }]
                }]
            }

            options = {
                "method": "POST",
                "headers": { "Content-Type": "application/json; charset=utf-8" },
                "body": json.dumps(payload)
            }
            js_options = to_js(options, dict_converter=js.Object.fromEntries)

            gcp_response = await js.fetch(url, js_options)
            if not gcp_response.ok:
                err_text = await gcp_response.text()
                return js.Response.new(json.dumps({"reply": f"گوگل کلاؤڈ کنکشن بلاک ایرر ({gcp_response.status}): {err_text}"}), status=200, headers=headers)

            res_text = await gcp_response.text()
            res_data = json.loads(res_text)
            raw_text = res_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")

            # 🔊 گوگل کلاؤڈ ٹیکسٹ ٹو اسپیچ (TTS) وائس پروٹیکشن لاجک
            audio_base64 = ""
            try:
                tts_url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"
                tts_payload = {
                    "input": { "text": raw_text },
                    "voice": { "languageCode": lang_code, "name": voice_name },
                    "audioConfig": { "audioEncoding": "MP3" }
                }
                
                js_tts_options = to_js({
                    "method": "POST",
                    "headers": { "Content-Type": "application/json" },
                    "body": json.dumps(tts_payload)
                }, dict_converter=js.Object.fromEntries)

                tts_res = await js.fetch(tts_url, js_tts_options)
                if tts_res.ok:
                    tts_data = json.loads(await tts_res.text())
                    audio_base64 = tts_data.get("audioContent", "")
                else:
                    # اگر گوگل کلاؤڈ آواز دینے سے انکار کرے تو ٹیکسٹ میں ایرر کوڈ دکھائیں
                    tts_err_status = tts_res.status
                    raw_text += f"\n\n⚠️ (گوگل کلاؤڈ آواز کا مسئلہ: {tts_err_status}۔ برائے مہربانی چیک کریں کہ گوگل کلاؤڈ کنسول میں Text-to-Speech API آن ہے یا نہیں)"
            except Exception as tts_err:
                raw_text += f"\n\n⚠️ (آواز کا اندرونی کریش: {str(tts_err)})"

            return js.Response.new(json.dumps({
                "reply": raw_text,
                "audioContent": audio_base64,
                "active_model": target_model,
                "agent_active": agent_name
            }), status=200, headers=headers)

        except Exception as main_err:
            return js.Response.new(json.dumps({"reply": f"سرور کے اندرونی سسٹم میں خرابی: {str(main_err)}"}), status=200, headers=headers)

    return js.Response.new("TARS AI Active Core Engine", status=200, headers=headers)
                
