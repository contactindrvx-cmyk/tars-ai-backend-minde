import json
import js
from pyodide.ffi import to_js

async def on_fetch(request, env, ctx):
    # CORS ہیڈرز تاکہ لوو ایبل بلا جھجک سرور سے جڑ سکے
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
            user_message = body.get("message", "Hi")

            api_key = getattr(env, "VERTEX_API_KEY", None)
            if not api_key:
                return js.Response.new(json.dumps({"reply": "خرابی: کلاؤڈ فلئیر ورکر کی سیٹنگز میں VERTEX_API_KEY نہیں ملی۔"}), status=200, headers=headers)

            api_key = str(api_key).strip()
            project = 'tars-ai-chat-ann-assistant'
            location = 'us-central1'
            
            # 📋 آپ کے کہنے کے مطابق جیمنائی اور کلوڈ 4.7 کے تمام ٹیکسٹ ماڈلز کی مشترکہ لسٹ
            all_models_to_test = [
                'gemini-3.1-pro',
                'gemini-3.1-pro-001',
                'gemini-3-flash',
                'gemini-3-flash-001',
                'gemini-3.1-flash-lite',
                'gemini-2.5-pro',
                'gemini-2.5-pro-001',
                'gemini-2.5-flash',
                'gemini-2.5-flash-001',
                'gemini-2.5-flash-lite',
                'gemini-2-flash',
                'gemini-2-flash-lite',
                'gemini-1.5-pro',
                'gemini-1.5-flash',
                'claude-opus-4-7', # کلوڈ 4.7 ماڈل شامل کر دیا گیا ہے
                'gemma-4-26b',
                'gemma-4-31b'
            ]

            working_models = []
            failed_models = []
            sample_ai_text = ""

            # 🔄 ایک ہی لوپ میں تمام ماڈلز کو باری باری ٹیسٹ کرنے کا جادوئی چکر
            for model in all_models_to_test:
                
                # 🔗 ماڈل کے حساب سے یو آر ایل اور پے لوڈ کی خودکار تبدیلی
                if "claude" in model:
                    url = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/anthropic/models/{model}:rawPredict?key={api_key}"
                    payload = {
                        "anthropic_version": "vertex-2023-10-16",
                        "messages": [{"role": "user", "content": f"You are Sara. Respond with one short sentence in English. User message: {user_message}"}],
                        "max_tokens": 1024
                    }
                else:
                    url = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent?key={api_key}"
                    payload = {
                        "contents": [{
                            "role": "user",
                            "parts": [{ "text": f"You are Asha. Respond with one short sentence in Urdu script. User message: {user_message}" }]
                        }]
                    }

                # پائتھون ڈکشنری کو خالص جاوا اسکرپٹ آبجیکٹ میں تبدیل کرنا تاکہ کلاؤڈ فلئیر POST ریکوسٹ ہی بھیجے
                options = {
                    "method": "POST",
                    "headers": { "Content-Type": "application/json; charset=utf-8" },
                    "body": json.dumps(payload)
                }
                js_options = to_js(options, dict_converter=js.Object.fromEntries)

                try:
                    gcp_response = await js.fetch(url, js_options)
                    
                    if gcp_response.ok:
                        res_text = await gcp_response.text()
                        res_data = json.loads(res_text)
                        
                        # جواب نکالنے کی لاجک ماڈل کی ٹائپ کے مطابق
                        if "claude" in model:
                            raw_text = res_data.get("content", [{}])[0].get("text", "")
                        else:
                            raw_text = res_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        
                        working_models.append(model)
                        if not sample_ai_text and raw_text:
                            sample_ai_text = raw_text
                    else:
                        status_code = gcp_response.status
                        failed_models.append(f"{model} (کوڈ: {status_code})")
                        
                except Exception as model_err:
                    failed_models.append(f"{model} (ایرر: {str(model_err)})")

            # 📊 لوو ایبل اسکرین پر دکھانے کے لیے فائنل مشترکہ رپورٹ
            report_reply = "📊 **گوگل کلاؤڈ اور کلوڈ ماڈلز کا مشترکہ ٹیسٹ رزلٹ:**\n\n"
            
            if working_models:
                report_reply += "✅ **کامیاب اور فعال ماڈلز (Working Models):**\n"
                for wm in working_models:
                    report_reply += f"• {wm}\n"
                if sample_ai_text:
                    report_reply += f"\n💬 **لائیو ٹیسٹ جواب:** {sample_ai_text}\n\n"
            else:
                report_reply += "❌ **کوئی بھی جیمنائی یا کلوڈ ماڈل جواب نہیں دے سکا۔**\n\n"

            if failed_models:
                report_reply += "⚠️ **ناکام ہونے والے ماڈلز (Failed Models):**\n"
                for fm in failed_models:
                    report_reply += f"• {fm}\n"

            return js.Response.new(json.dumps({
                "reply": report_reply,
                "audioContent": "", 
                "active_model": working_models[0] if working_models else "None"
            }), status=200, headers=headers)

        except Exception as main_err:
            return js.Response.new(json.dumps({"reply": f"سرور کے اندرونی سسٹم میں خرابی: {str(main_err)}"}), status=200, headers=headers)

    return js.Response.new("TARS AI Unified Model Scanner Active", status=200, headers=headers)
                                         
