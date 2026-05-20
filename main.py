import json
import js

async def on_fetch(request, env, ctx):
    headers = js.Headers.new()
    headers.set("Access-Control-Allow-Origin", "*")
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")

    if request.method == "OPTIONS":
        return js.Response.new("", status=200, headers=headers)

    # 🌐 1. WebSocket Live Call
    if request.headers.get("Upgrade") == "websocket":
        try:
            vertex_key = getattr(env, "VERTEX_API_KEY", None)
            if not vertex_key:
                return js.Response.new("VERTEX_API_KEY missing", status=400)

            vertex_key = str(vertex_key).strip()
            gemini_url = f"https://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={vertex_key}"

            pair = js.WebSocketPair.new()
            client_ws = pair.js_0
            server_ws = pair.js_1
            server_ws.accept()

            fetch_init = js.Object.new()
            fetch_headers = js.Headers.new()
            fetch_headers.set("Upgrade", "websocket")
            fetch_init.headers = fetch_headers

            gcp_res = await js.fetch(gemini_url, fetch_init)
            gcp_ws = gcp_res.webSocket
            gcp_ws.accept()

            def forward_to_gcp(event):
                try:
                    gcp_ws.send(event.data)
                except:
                    pass

            def forward_to_client(event):
                try:
                    server_ws.send(event.data)
                except:
                    pass

            server_ws.addEventListener("message", forward_to_gcp)
            gcp_ws.addEventListener("message", forward_to_client)

            resp_init = js.Object.new()
            resp_init.status = 101
            resp_init.webSocket = client_ws
            return js.Response.new("", resp_init)

        except Exception as e:
            return js.Response.new(f"WebSocket Failed: {str(e)}", status=500)

    # 💬 2. POST Text/Audio Chat
    if request.method == "POST":
        try:
            body_text = await request.text()
            body = json.loads(body_text)

            user_message = body.get("message", "")
            agent_name = body.get("agent", "asha").lower()

            vertex_key = getattr(env, "VERTEX_API_KEY", None)
            tts_key = getattr(env, "TTS_API_KEY", None)

            if not vertex_key or not tts_key:
                return js.Response.new(
                    json.dumps({"reply": "API keys missing in Worker settings"}),
                    status=200, headers=headers
                )

            vertex_key = str(vertex_key).strip()
            tts_key = str(tts_key).strip()

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
                system_instruction = "You are Asha, a warm female AI assistant. Respond in Urdu script."

            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={vertex_key}"

            payload = json.dumps({
                "contents": [{
                    "role": "user",
                    "parts": [{"text": f"{system_instruction}\n\nUser: {user_message}"}]
                }]
            })

            req_init = js.Object.new()
            req_init.method = "POST"
            req_headers = js.Headers.new()
            req_headers.set("Content-Type", "application/json")
            req_init.headers = req_headers
            req_init.body = payload

            gcp_res = await js.fetch(gemini_url, req_init)
            if not gcp_res.ok:
                err = await gcp_res.text()
                return js.Response.new(
                    json.dumps({"reply": f"Gemini Error {gcp_res.status}: {err}"}),
                    status=200, headers=headers
                )

            res_data = json.loads(await gcp_res.text())
            raw_text = res_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")

            audio_base64 = ""
            try:
                tts_url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={tts_key}"
                tts_payload = json.dumps({
                    "input": {"text": raw_text},
                    "voice": {"languageCode": lang_code, "name": voice_name},
                    "audioConfig": {"audioEncoding": "MP3"}
                })

                tts_init = js.Object.new()
                tts_init.method = "POST"
                tts_headers = js.Headers.new()
                tts_headers.set("Content-Type", "application/json")
                tts_init.headers = tts_headers
                tts_init.body = tts_payload

                tts_res = await js.fetch(tts_url, tts_init)
                if tts_res.ok:
                    tts_data = json.loads(await tts_res.text())
                    audio_base64 = tts_data.get("audioContent", "")
            except:
                pass

            return js.Response.new(
                json.dumps({
                    "reply": raw_text,
                    "audioContent": audio_base64,
                    "agent_active": agent_name
                }),
                status=200, headers=headers
            )

        except Exception as e:
            return js.Response.new(
                json.dumps({"reply": f"Server Error: {str(e)}"}),
                status=200, headers=headers
            )

    return js.Response.new("TARS AI Active Core Engine Running", status=200, headers=headers)
