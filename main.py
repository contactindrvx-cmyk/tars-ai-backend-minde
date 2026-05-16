import json
from js import Response, Headers, fetch

async def on_fetch(request, env, ctx):
    headers = Headers.new()
    headers.set("Access-Control-Allow-Origin", "*")
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")

    if request.method == "OPTIONS":
        return Response.new("", status=200, headers=headers)

    if request.method == "POST":
        try:
            body = await request.json()
            user_email = body.get("email", "")
            user_message = body.get("message", "")
            agent_name = body.get("agent", "Asha").lower()

            api_key = getattr(env, "VERTEX_API_KEY", None)
            if not api_key:
                return Response.new(json.dumps({"reply": "خرابی: کلاؤڈ فلئیر ورکر کی سیٹنگز میں VERTEX_API_KEY نہیں ملی۔"}), status=200, headers=headers)

            project = 'tars-ai-chat-ann-assistant'
            location = 'us-central1'
            
            # 📋 آپ کی لسٹ کے مطابق ماڈلز کی ترجیحی ترتیب (Testing Loop)
            if user_email == "alirazasabi007@gmail.com":
                models_to_test = ['gemini-3.1-pro', 'gemini-2.5-pro', 'gemini-3-flash', 'gemini-2.5-flash']
                base_instruction = "You are Asha, operating in Admin Thinking Mode. Respond beautifully in Urdu script."
            else:
                models_to_test = ['gemini-3.1-flash-lite', 'gemini-3-flash', 'gemini-2.5-flash', 'gemini-2-flash']
                base_instruction = "You are Asha, a helpful AI assistant. Respond naturally in Urdu script."

            # 🎤 آوازوں کی سیٹنگ
            if "raza" in agent_name:
                voice_name = "ur-PK-Standard-B"
                lang_code = "ur-PK"
                system_instruction = f"{base_instruction} Your name is Raza (Male)."
            else:
                voice_name = "ur-PK-Standard-A"
                lang_code = "ur-PK"
                system_instruction = f"{base_instruction} Your name is Asha (Female)."

            ai_reply = ""
            successful_model = ""
            error_logs = []

            # 🔄 ماڈلز کو ایک ایک کر کے ٹیسٹ کرنے کا خودکار لوپ
            for model in models_to_test:
                url = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent?key={api_key}"
                
                payload = {
                    "contents": [{
                        "role": "user",
                        "parts": [{ "text": f"{system_instruction}\n\nUser Message: {user_message}" }]
                    }]
                }

                try:
                    gcp_response = await fetch(url, {
                        "method": "POST",
                        "headers": { "Content-Type": "application/json" },
                        "body": json.dumps(payload)
                    })

                    if gcp_response.ok:
                        res_data = json.loads(await gcp_response.text())
                        raw_text = res_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        if raw_text:
                            successful_model = model
                            # ماڈل کا نام جواب کے ساتھ جوڑنا تاکہ وہ بول کر بھی بتائے
                            ai_reply = f"میں ماڈل {model} استعمال کر رہی ہوں۔ " + raw_text
                            break
                    else:
                        err_reason = await gcp_response.text()
                        error_logs.append(f"{model} ریجیکٹ ہوا ({gcp_response.status})")
                except Exception as e:
                    error_logs.append(f"{model} کریش ہوا ({str(e)})")

            # 🚨 اگر سارے ماڈلز فیل ہو جائیں تو اصل ٹیکنیکل وجہ بتائیں
            if not successful_model:
                detailed_errors = " | ".join(error_logs)
                return Response.new(json.dumps({
                    "reply": f"گوگل کلاؤڈ کے تمام ماڈلز ناکام ہو گئے۔ تفصیلات: {detailed_errors}"
                }), status=200, headers=headers)

            # 🔊 کامیاب ہونے والے ماڈل کی آواز تیار کرنا (Google TTS)
            audio_base64 = ""
            try:
                tts_url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"
                tts_payload = {
                    "input": { "text": ai_reply },
                    "voice": { "languageCode": lang_code, "name": voice_name },
                    "audioConfig": { "audioEncoding": "MP3" }
                }
                tts_res = await fetch(tts_url, {
                    "method": "POST",
                    "headers": { "Content-Type": "application/json" },
                    "body": json.dumps(tts_payload)
                })
                if tts_res.ok:
                    tts_data = json.loads(await tts_res.text())
                    audio_base64 = tts_data.get("audioContent", "")
            except Exception as tts_err:
                pass

            return Response.new(json.dumps({
                "reply": ai_reply,
                "audioContent": audio_base64,
                "active_model": successful_model,
                "agent_active": agent_name
            }), status=200, headers=headers)

        except Exception as main_err:
            return Response.new(json.dumps({"reply": f"سرور کے اندرونی سسٹم میں خرابی: {str(main_err)}"}), status=200, headers=headers)

    return Response.new("TARS AI Multi-Model Testing Core Active", status=200, headers=headers)
            
