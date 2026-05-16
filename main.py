import json
from js import Response, Headers, WebSocketPair

async def on_fetch(request, env, ctx):
    # CORS ہیڈرز تاکہ موبائل ایپ اور فرنٹ اینڈ بغیر کسی رکاوٹ کے جڑ سکیں
    headers = Headers.new()
    headers.set("Access-Control-Allow-Origin", "*")
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")

    if request.method == "OPTIONS":
        return Response.new("", status=200, headers=headers)

    # 📞 لائیو وائس کال انجن (Gemini Live WebSocket)
    # جب موبائل سے لائیو کال کنکٹ ہوگی تو یہ حصہ چلے گا
    upgrade_header = request.headers.get("Upgrade")
    if upgrade_header == "websocket":
        pair = WebSocketPair.new()
        client = pair["0"]
        server = pair["1"]
        
        # لائیو کال کے بیک اینڈ ہینڈلر کو رن کریں
        ctx.waitUntil(handle_live_call(server, env, request))
        return Response.new(None, status=101, web_socket=client)

    # 💬 عام ٹیکسٹ میسج انجن (POST Request)
    if request.method == "POST":
        try:
            body = await request.json()
            user_email = body.get("email", "")
            user_message = body.get("message", "")
            
            # 🚀 ڈوئل انجن راؤٹنگ (Admin vs Regular User)
            if user_email == "alirazasabi007@gmail.com":
                # ایڈمن کے لیے عائشہ کا تھنکنگ ماڈل آن ہو جائے گا
                target_model = "gemini-2.0-flash-thinking-exp"
                engine_name = "Gemini Thinking Mode (Admin Special)"
            else:
                # عام یوزرز کے لیے نارمل فلیش ماڈل چلے گا
                target_model = "gemini-1.5-flash"
                engine_name = "Gemini 3.1 Flash"

            # عائشہ کا جواب تیار کرنے کی لاجک
            gemini_reply = f"Hello Ali Raza! Asha here in full {engine_name}. How can I assist you with master control today?" if user_email == "alirazasabi007@gmail.com" else f"Hi, I am Asha. Response generated via {engine_name}."

            response_payload = {
                "reply": gemini_reply,
                "model_used": target_model,
                "engine": engine_name,
                "user": user_email
            }
            
            return Response.new(json.dumps(response_payload), status=200, headers=headers)

        except Exception as e:
            return Response.new(json.dumps({"error": str(e)}), status=500, headers=headers)

    return Response.new("TARS AI Backend Brain is Active and Running", status=200, headers=headers)

async def handle_live_call(websocket, env, request):
    """یہ فنکشن لائیو کال کے دوران آڈیو کے ٹکڑوں کو سنبھالے گا"""
    # یہاں ہم فیوچر میں جیمنائی لائیو کٹ (Websocket API) کو جوڑیں گے
    pass
  
