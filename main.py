import json
from js import Response, Headers, fetch

async def on_fetch(request, env, ctx):
    # CORS ہیڈرز تاکہ آپ کی فرنٹ اینڈ اور اینڈرائیڈ ایپ ڈائریکٹ کنکٹ ہو سکیں
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
            # ایپ سے میل یا فیمیل آواز کی سلیکشن (ڈیفالٹ فیمیل ہوگی)
            voice_gender = body.get("voice", "female") 

            # کلاؤڈ فلئیر سے آپ کی وہ خفیہ VERTEX_API_KEY اٹھانا
            api_key = getattr(env, "VERTEX_API_KEY", None)
            if not api_key:
                return Response.new(json.dumps({"error": "VERTEX_API_KEY environment variable nahi mila."}), status=500, headers=headers)

            project = 'tars-ai-chat-ann-assistant'
            location = 'us-central1'
            
            # 🚀 آپ کے پلان کے مطابق ماڈل کی سلیکشن (نارمل بیہیوئیر)
            if user_email == "alirazasabi007@gmail.com":
                model = 'gemini-2.5-pro'  # ایڈمن علی رضا کے لیے ہیوی پرو انجن
            else:
                model = 'gemini-1.5-flash'  # عام یوزرز کے لیے تیز فلیش انجن

            # ❤️ بالکل نارمل اور دوستانہ سسٹم پرامپٹ (کوئی سخت شرط نہیں ہے)
            system_instruction = (
                "You are Asha, a warm, friendly, and highly intelligent AI assistant. "
                "You are a true digital life partner. Speak naturally, helper-friendly, and conversationally in Urdu. "
                "Do NOT limit your answers to just code or summaries. Talk like a real human partner."
            )

            # گوگل کلاؤڈ ورٹیکس کا لائیو گیٹ وے یو آر ایل
            url = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent?key={api_key}"

            payload = {
                "contents": [{
                    "role": "user",
                    "parts": [{
                        "text": f"{system_instruction}\n\nUser Message: {user_message}"
                    }]
                }]
            }

            options = {
                "method": "POST",
                "headers": { "Content-Type": "application/json" },
                "body": json.dumps(payload)
            }
            
            gcp_response = await fetch(url, options)
            if not gcp_response.ok:
                err_text = await gcp_response.text()
                return Response.new(json.dumps({"error": f"GCP Error: {err_text}"}), status=gcp_response.status, headers=headers)

            res_data_text = await gcp_response.text()
            data = json.loads(res_data_text)
            ai_reply = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "No response text found.")

            # 🔊 گوگل کلاؤڈ کی اصل اردو آواز کا انجن (Google Cloud TTS Integration)
            audio_base64 = ""
            try:
                tts_url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"
                # گوگل کی آفیشل سب سے بہترین اردو آوازیں (Standard-A فیمیل، Standard-B میل)
                voice_name = "ur-PK-Standard-A" if voice_gender == "female" else "ur-PK-Standard-B"
                
                tts_payload = {
                    "input": { "text": ai_reply },
                    "voice": { "languageCode": "ur-PK", "name": voice_name },
                    "audioConfig": { "audioEncoding": "MP3" }
                }
                
                tts_options = {
                    "method": "POST",
                    "headers": { "Content-Type": "application/json" },
                    "body": json.dumps(tts_payload)
                }
                
                tts_res = await fetch(tts_url, tts_options)
                if tts_res.ok:
                    tts_data = json.loads(await tts_res.text())
                    audio_base64 = tts_data.get("audioContent", "") # یہ ایپ کو بیس 64 آڈیو دے گا جو ڈائریکٹ پلے ہوگی
            except Exception as tts_err:
                print(f"TTS Engine Connection Warning: {str(tts_err)}")

            # موبائل ایپ کو ٹیکسٹ اور آڈیو دونوں ایک ساتھ ملیں گے
            return Response.new(json.dumps({
                "reply": ai_reply,
                "audioContent": audio_base64, 
                "active_model": model,
                "user": user_email
            }), status=200, headers=headers)

        except Exception as e:
            return Response.new(json.dumps({"error": str(e)}), status=500, headers=headers)

    return Response.new("TARS AI Asha Pure Conversational Backend is Active", status=200, headers=headers)
    
