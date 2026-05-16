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
            body_text = await request.text()
            body = json.loads(body_text)
            
            user_email = body.get("email", "")
            user_message = body.get("message", "")
            agent_name = body.get("agent", "Asha").lower()

            api_key = getattr(env, "VERTEX_API_KEY", None)
            if not api_key:
                return Response.new(json.dumps({"reply": "خرابی: کلاؤڈ فلئیر ورکر کی سیٹنگز میں VERTEX_API_KEY نہیں ملی۔"}), status=200, headers=headers)

            # 🛠️ سب سے اہم فکس: اے پی آئی کی کے آس پاس سے پوشیدہ فالتو اسپیس اور نیو لائنز کا مکمل خاتمہ
            api_key = str(api_key).strip()

            project = 'tars-ai-chat-ann-assistant'
            location = 'us-central1'
            
            # 📋 آپ کی لسٹ کے مطابق گوگل کلاؤڈ کے تمام چھوٹے بڑے ماڈلز کا گرینڈ ٹیسٹنگ لوپ
            models_to_test = [
                'gemini-2.5-pro',
                'gemini-2.5-pro-001',
                'gemini-3.1-pro',
                'gemini-3.1-pro-001',
                'gemini-2.5-flash',
                'gemini-2.5-flash-001',
                'gemini-3-flash',
                'gemini-3-flash-001',
                'gemini-3.1-flash-lite',
                'gemini-2-flash',
                'gemini-2-flash-lite',
                'gemini-2.5-flash-lite',
                'gemini-1.5-pro',
                'gemini-1.5-pro-001',
                'gemini-1.5-flash',
                'gemini-1.5-flash-001'
            ]

            base_instruction = "You are Asha, a warm and friendly AI assistant. Respond beautifully in Urdu script."

            if "raza" in agent_name:
                voice_name = "ur-PK-Standard-B"
                lang_code = "ur-PK"
                system_instruction = "You are Raza, a helpful male AI assistant. Respond naturally in Urdu script."
            elif "sara" in agent_name:
                voice_name = "en-US-Standard-C"
                lang_code = "en-US"
                system_instruction = "You are Sara, a professional female AI assistant. Respond eloquently in English."
            elif "david" in agent_name:
                voice_name = "en-US-Standard-D"
                lang_code = "en-US"
                system_instruction = "You are David, a competent male AI assistant. Respond professionally in English."
            else:
                voice_name = "ur-PK-Standard-A"
                lang_code = "ur-PK"
                system_instruction = base_instruction

            ai_reply = ""
            successful_model = ""
            error_logs = []

            # 🔄 تمام ماڈلز کو باری باری ہٹ مارنے کا خودکار چکر
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
                        res_text = await gcp_response.text()
                        res_data = json.loads(res_text)
                        raw_text = res_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        if raw_text:
                            successful_model = model
                            ai_reply = f"میں ماڈل {model} استعمال کر رہی ہوں۔ " + raw_text
                            break
                    else:
                        gcp_status = gcp_response.status
                        error_logs.append(f"{model} ({gcp_status})")
                except Exception as e:
                    error_logs.append(f"{model} error ({str(e)})")

            # 🚨 اگر خدانخواستہ اب بھی تمام ماڈلز فیل ہوں تو اصل وجوہات سامنے آئیں گی
            if not successful_model:
                detailed_errors = " | ".join(error_logs)
                return Response.new(json.dumps({
                    "reply": f"گوگل کلاؤڈ کے تمام ماڈلز ناکام ہو گئے۔ تفصیلات: {detailed_errors}"
                }), status=200, headers=headers)

            # 🔊 کامیاب ہونے والے ماڈل کے لیے آواز کی تیاری
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

    return Response.new("TARS AI Grand Multi-Model Core Active", status=200, headers=headers)
                    
