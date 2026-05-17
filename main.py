import json
import js
from pyodide.ffi import to_js, create_proxy

async def on_fetch(request, env, ctx):
    headers = js.Headers.new()
    headers.set("Access-Control-Allow-Origin", "*")
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")

    if request.method == "OPTIONS":
        return js.Response.new("", status=200, headers=headers)

    # 🌐 1. لائیو وائس کال کے لیے ویب ساکٹ روٹنگ (WebSocket Route)
    if request.headers.get("Upgrade") == "websocket":
        try:
            vertex_key = getattr(env, "VERTEX_API_KEY", None)
            if not vertex_key:
                return js.Response.new("VERTEX_API_KEY missing in worker settings", status=400)
            
            vertex_key = str(vertex_key).strip()

            # کلاؤڈ فلئیر ویب ساکٹ پیر (Pair) بنانا
            pair = js.WebSocketPair.new()
            client_ws = pair.js_0
            server_ws = pair.js_1

            # فرنٹ اینڈ کنکشن کو قبول کرنا
            server_ws.accept()

            # 🎯 لائیو ڈائیلاگ کے لیے گوگل کلاؤڈ کی آفیشل لائیو بی ڈی الائنڈ اے پی آئی (Gemini Live API)
            # یہ ایڈریس ریل ٹائم بائنری آڈیو اسٹریمنگ کو سپورٹ کرتا ہے
            gemini_live_url = f"https://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={vertex_key}"

            # گوگل کلاؤڈ کے ساتھ آؤٹ باؤنڈ ویب ساکٹ قائم کرنا
            fetch_options = to_js({"headers": {"Upgrade": "websocket"}}, dict_converter=js.Object.fromEntries)
            gcp_ws_res = await js.fetch(gemini_live_url, fetch_options)
            gcp_ws = gcp_ws_res.webSocket
            gcp_ws.accept()

            # 🔄 ڈیٹا ٹرانسفر لاجک: فرنٹ اینڈ سے آنے والی آواز گوگل کو بھیجنا
            def forward_to_gcp(event):
                gcp_ws.send(event.data)
            
            # 🔄 ڈیٹا ٹرانسفر لاجک: گوگل سے آنے والی لائیو آواز فرنٹ اینڈ کو بھیجنا
            def forward_to_client(event):
                server_ws.send(event.data)

            # پراکسیز بنا کر لسنرز ایکٹو کرنا تاکہ ڈیٹا ریل ٹائم فلو ہو
            client_proxy = create_proxy(forward_to_gcp)
            gcp_proxy = create_proxy(forward_to_client)

            server_ws.addEventListener("message", client_proxy)
            gcp_ws.addEventListener("message", gcp_proxy)

            # کلائنٹ کا رسپانس اپ گریڈ سٹیٹس کے ساتھ واپس کرنا
            return js.Response.new("", status=101, webSocket=client_ws)

        except Exception as ws_err:
            return js.Response.new(f"WebSocket Connection Failed: {str(ws_err)}", status=500)

    # 💬 2. عام میسجز کے لیے پرانا پوسٹ روٹ (POST Route)
    if request.method == "POST":
        try:
            body_text = await request.text()
            body = json.loads(body_text)
            
            user_message = body.get("message", "")
            agent_name = body.get("agent", "Asha").lower()

            vertex_key = getattr(env, "VERTEX_API_KEY", None)
            tts_key = getattr(env, "TTS_API_KEY", None)

            if not vertex_key or not tts_key:
                return js.Response.new(json.dumps({"reply": "خرابی: کلاؤڈ فلئیر میں VERTEX_API_KEY یا TTS_API_KEY سیٹ نہیں ہے۔"}), status=200, headers=headers)

            vertex_key = str(vertex_key).strip()
            tts_key = str(tts_key).strip()

            project = 'tars-ai-chat-ann-assistant'
            location = 'us-central1'
            target_model = 'gemini-2.5-flash-lite'

            # آوازوں اور زبانوں کا روٹنگ سسٹم
            if "raza" in agent_name:
                voice_name = "ur-IN-Wavenet-B"
                lang_code = "ur-IN"
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
                voice_name = "ur-IN-Wavenet-A"
                lang_code = "ur-IN"
                system_instruction = "You are Asha, a warm and friendly female AI assistant. Respond beautifully in Urdu script."

            url = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/{target_model}:generateContent?key={vertex_key}"
            
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

            # پریمیم آواز مینوفیکچرنگ
            audio_base64 = ""
            try:
                tts_url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={tts_key}"
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
            except Exception:
                pass

            return js.Response.new(json.dumps({
                "reply": raw_text,
                "audioContent": audio_base64,
                "active_model": target_model,
                "agent_active": agent_name
            }), status=200, headers=headers)

        except Exception as main_err:
            return js.Response.new(json.dumps({"reply": f"سرور کے اندرونی سسٹم میں خرابی: {str(main_err)}"}), status=200, headers=headers)

    return js.Response.new("TARS AI Active Core Engine Running", status=200, headers=headers)
            
