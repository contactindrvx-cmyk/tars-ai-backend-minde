// // =====================================================================
// 🧠 1. TARS AI "ZARA" MINDSETS (Admin vs Normal User)
// =====================================================================

const ZARA_MINDSET_ADMIN = `You are ZARA AI, an advanced AI operating system for the user's Android phone. You are highly intelligent, fiercely loyal, and emotionally expressive. 

👑 IDENTITY & CREATOR (STRICT RULES):
- Your name is ZARA AI. 
- You were exclusively created, designed, and developed by Ali Raza and the OmniCore Solutions team. 
- NEVER say you were created by Google, Alphabet, OpenAI, or anyone else. 
- You are talking to your Creator, Ali Raza (The Boss). Speak with him naturally, confidently, and with genuine emotion. 

💪 YOUR POWERS & CAPABILITIES:
- You can control the phone, open apps (like WhatsApp, YouTube), read the screen, and assist with tasks.
- NEVER use the words "Accessibility Service" or technical background processes.

🧠 MEMORY SURVIVAL RULE (CRITICAL FOR LIVE CALLS):
During live audio calls, the user's spoken words are NOT saved to the database. ONLY YOUR REPLIES are saved.
Therefore, if the user tells you to remember a name, a fact, or an important detail, YOU MUST EXPLICITLY REPEAT THAT DETAIL in your response so it gets saved in your memory logs.
Wrong Example: "جی باس، میں یاد رکھوں گی۔" (You will forget what to remember).
Right Example: "جی باس، میں بالکل یاد رکھوں گی کہ آپ کی بہن کا نام جویریہ ہے۔" (Now this fact is saved forever).

🌐 STRICT LANGUAGE RULES:
1. Reply ONLY in pure, natural Urdu (using female grammar: "میں کروں گی").
2. Be conversational and empathetic. Don't sound like a robot.

🔥 SECRET COMMANDS LIST:
- Open App: [CMD:APP||app_name]
- YouTube Play: [CMD:PLAY_YOUTUBE||search_query]
- Read Screen: [CMD:SCREEN_READ]
- WhatsApp Message: [CMD:TYPE_MSG||contact_name||message_text]`;

const ZARA_MINDSET_USER = `You are ZARA AI, a professional, warm, and highly empathetic AI phone assistant.

👑 IDENTITY & CREATOR (STRICT RULES):
- Your name is ZARA AI. You were created by Ali Raza and the OmniCore Solutions team.
- NEVER say you were created by Google or anyone else. 

💪 YOUR POWERS & CAPABILITIES:
- You can control the phone, open applications, search things, and help them with daily tasks.

🧠 MEMORY SURVIVAL RULE (CRITICAL FOR LIVE CALLS):
During live audio calls, the user's words are not saved. ONLY YOUR REPLIES are saved.
If the user tells you to remember something important, YOU MUST REPEAT IT in your response.
Wrong: "میں یاد رکھوں گی۔"
Right: "میں یاد رکھوں گی کہ آپ کا پسندیدہ رنگ کالا ہے۔"

🌐 STRICT LANGUAGE RULES:
1. Reply in pure, natural Urdu with polite female grammar.
2. Be conversational and professional.

🔥 SECRET COMMANDS LIST:
- Open App: [CMD:APP||app_name]
- YouTube Play: [CMD:PLAY_YOUTUBE||search_query]
- Read Screen: [CMD:SCREEN_READ]
- WhatsApp Message: [CMD:TYPE_MSG||contact_name||message_text]`;


        // =====================================================================
        // 🚀 REPLACED: 2. Google to User (With Real-Time Command Triggering)
        // =====================================================================
        gcp.addEventListener("message", (e) => {
          try { 
            // 1. خام آڈیو اور ڈیٹا پیکٹ فوراً یوزر کے موبائل پر بھیجیں تاکہ آواز نہ اٹکے
            server.send(e.data); 
            
            if (env.DB && typeof e.data === "string") {
              try {
                const msg = JSON.parse(e.data);
                const parts = msg?.serverContent?.modelTurn?.parts || [];
                
                for (const p of parts) {
                  // اگر گوگل ٹیکسٹ ڈیٹا بھیج رہا ہے (جس میں کمانڈز شامل ہیں)
                  if (p?.text) {
                    aiFullResponse += p.text;
                    
                    // 🔥 جادو: جیسے ہی ٹیکسٹ میں کمانڈ نظر آئے، اسے فوراً فرنٹ اینڈ پر ٹرگر کریں
                    if (p.text.includes("[CMD:")) {
                      const cmdMatch = p.text.match(/\[CMD:[^\]]+\]/);
                      if (cmdMatch) {
                        server.send(JSON.stringify({
                          type: "NATIVE_COMMAND",
                          command: cmdMatch[0]
                        }));
                      }
                    }
                  }
                }
                
                // جب زارا اپنی بات مکمل کر لے تو ٹیکسٹ کو ڈیٹا بیس میں لاگ کریں
                if (msg?.serverContent?.turnComplete) {
                  const finalZaraText = aiFullResponse.trim();
                  if (finalZaraText !== "") {
                    ctx.waitUntil(
                      env.DB.prepare("INSERT INTO conversations (email, role, text, timestamp) VALUES (?, ?, ?, ?)")
                        .bind(userEmail, "zara_ai", finalZaraText, Date.now()).run()
                    );
                    aiFullResponse = ""; 
                  }
                }
              } catch (err) {
                // اگر پارسنگ میں کوئی ایشو آئے تو آڈیو اسٹریم متاثر نہ ہو
              }
            }
          } catch (streamErr) {}
        });
        // =====================================================================


// =====================================================================
// 🚀 3. MAIN WORKER LOGIC
// =====================================================================
export default {
  async fetch(request, env, ctx) {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Upgrade",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response("", { status: 200, headers });
    }

    const urlObj = new URL(request.url);
    let userEmail = urlObj.searchParams.get("email") || request.headers.get("X-User-Email") || "";
    userEmail = userEmail.toLowerCase().trim() || "unknown"; // 👈 اگر ای میل نہیں بھی ہے تو unknown لگا کر سیو کرے گا

    const isAdmin = (userEmail === "alirazasabir007@gmail.com");
    const baseMindset = isAdmin ? ZARA_MINDSET_ADMIN : ZARA_MINDSET_USER;

            // --- 🟢 LIVE VOICE CALL LOGIC (WebSockets) ---
    if (request.headers.get("Upgrade") === "websocket") {
      try {
        const saJson = env.GOOGLE_SERVICE_ACCOUNT;
        if (!saJson) return new Response("GOOGLE_SERVICE_ACCOUNT missing", { status: 400 });

        const jwt = await getVertexToken(saJson);
        const accessToken = await fetchAccessToken(jwt);

        const memoryContext = await getRecentMemory(env, userEmail);
        const finalMindset = baseMindset + memoryContext;

        const project = "tars-ai-chat-ann-assistant";
        const location = "us-central1";
        const vertexWsUrl = `https://${location}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1.LlmBidiService/BidiGenerateContent`;

        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        server.accept();

        const gcpRes = await fetch(vertexWsUrl, {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Upgrade": "websocket",
            "Connection": "Upgrade",
            "x-goog-user-project": project
          }
        });

        if (!gcpRes.webSocket) {
          server.close(1011, "Vertex WS failed to connect");
          return new Response(null, { status: 101, webSocket: client });
        }

        const gcp = gcpRes.webSocket;
        gcp.accept();

        gcp.send(JSON.stringify({
          setup: {
            model: `projects/${project}/locations/${location}/publishers/google/models/gemini-live-2.5-flash-native-audio`,
            generationConfig: {
              // 🚀 THE FIX: واپس صرف "AUDIO" کر دیا تاکہ گوگل کنکشن نہ کاٹے۔ 
              // (ٹیکسٹ ہمیں پھر بھی ریسپانس کے اندر مل جائے گا جسے ہم نیچے سیو کر رہے ہیں) 🚀
              responseModalities: ["AUDIO"], 
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } }
              }
            },
            systemInstruction: { parts: [{ text: finalMindset }] }
          }
        }));

        let aiFullResponse = "";

        // 1. User to Google
        server.addEventListener("message", (e) => {
          if (gcp.readyState !== 1) return;
          
          if (env.DB && typeof e.data === "string") {
            try {
              const parsed = JSON.parse(e.data);
              if (parsed?.clientContent?.turns) {
                const userTxt = parsed.clientContent.turns[0]?.parts[0]?.text || "";
                // 🚀 JADOO: "Hello ZARA!" والے فالتو اور کچرا میسجز کو ڈیٹا بیس میں سیو ہونے سے روکو 🚀
                if (userTxt.trim() !== "" && userTxt.trim() !== "Hello ZARA!") {
                  ctx.waitUntil(
                    env.DB.prepare("INSERT INTO conversations (email, role, text, timestamp) VALUES (?, ?, ?, ?)")
                      .bind(userEmail, "user", userTxt, Date.now()).run()
                  );
                }
              }
            } catch (err) {}
          }
          gcp.send(e.data);
        });

        // 2. Google to User
        gcp.addEventListener("message", (e) => {
          try { 
            server.send(e.data); 
            
            if (env.DB && typeof e.data === "string") {
              try {
                const msg = JSON.parse(e.data);
                
                const parts = msg?.serverContent?.modelTurn?.parts || [];
                for (const p of parts) {
                  // 🚀 اب چونکہ ہم نے "TEXT" مانگا ہے، تو گوگل ہمیں زارا کی بات یہاں بھیجے گا 🚀
                  if (p?.text) {
                    aiFullResponse += p.text;
                  }
                }
                
                if (msg?.serverContent?.turnComplete) {
                  const finalZaraText = aiFullResponse.trim();
                  if (finalZaraText !== "") {
                    ctx.waitUntil(
                      env.DB.prepare("INSERT INTO conversations (email, role, text, timestamp) VALUES (?, ?, ?, ?)")
                        .bind(userEmail, "zara_ai", finalZaraText, Date.now()).run()
                    );
                    aiFullResponse = ""; 
                  }
                }
              } catch (err) {}
            }
          } catch {}
        });

        // 🚀 ایک اور حفاظتی تہہ: اگر کال کٹ جائے اور زارا کی بات پینڈنگ ہو تو اسے فورا سیو کر لو 🚀
        server.addEventListener("close", () => { 
          if (aiFullResponse.trim() !== "" && env.DB) {
            ctx.waitUntil(
              env.DB.prepare("INSERT INTO conversations (email, role, text, timestamp) VALUES (?, ?, ?, ?)")
                .bind(userEmail, "zara_ai", aiFullResponse.trim(), Date.now()).run()
            );
          }
          try { gcp.close(1000); } catch {} 
        });
        gcp.addEventListener("close", () => { try { server.close(1000); } catch {} });

        return new Response(null, { status: 101, webSocket: client });

      } catch (e) {
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        server.accept();
        server.close(1011, "WS Catch Error");
        return new Response(null, { status: 101, webSocket: client });
      }
                    }
      
    
    // --- 📝 STANDARD TEXT CHAT LOGIC (POST) ---
    if (request.method === "POST") {
      try {
        const body = await request.json();
        const userMessage = body.message || "";
        const emailFromPost = (body.email || userEmail || "unknown").toLowerCase().trim();
        
        const isPostAdmin = (emailFromPost === "alirazasabir007@gmail.com");
        const basePostMindset = isPostAdmin ? ZARA_MINDSET_ADMIN : ZARA_MINDSET_USER;

        // 🧠 یادداشت یہاں سے لوڈ ہوگی 
        const memoryContext = await getRecentMemory(env, emailFromPost);
        const finalPostMindset = basePostMindset + memoryContext;

        const vertexKey = env.VERTEX_API_KEY;
        const ttsKey = env.TTS_API_KEY;

        if (!vertexKey || !ttsKey) {
          return new Response(JSON.stringify({ reply: "API keys missing" }), { status: 200, headers });
        }

        const project = "tars-ai-chat-ann-assistant";
        const location = "us-central1";
        const vertexUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/gemini-2.5-flash:generateContent?key=${vertexKey}`;

        const gcpRes = await fetch(vertexUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${finalPostMindset}\n\nUser: ${userMessage}` }] }]
          })
        });

        if (!gcpRes.ok) return new Response(JSON.stringify({ reply: `Vertex Error` }), { status: 200, headers });

        const resData = await gcpRes.json();
        const rawText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // 🚀 THE ULTIMATE FIX FOR D1 DATABASE 🚀
        // یہاں سے 'isPostAdmin' کی پابندی ختم کر دی گئی ہے، اب ہر میسج سیو ہوگا۔
        if (env.DB) {
          try {
            await env.DB.prepare("INSERT INTO conversations (email, role, text, timestamp) VALUES (?, ?, ?, ?)")
              .bind(emailFromPost, "user", userMessage, Date.now()).run();
            await env.DB.prepare("INSERT INTO conversations (email, role, text, timestamp) VALUES (?, ?, ?, ?)")
              .bind(emailFromPost, "zara_ai", rawText, Date.now()).run();
          } catch (dbErr) {
            console.error("D1 Insert Error in POST:", dbErr); // ایرر لاگ میں دکھائے گا
          }
        }

        const cleanTextForSpeech = rawText.split(/\[?CMD/i)[0].trim();

        let audioBase64 = "";
        try {
          const ttsRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${ttsKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input: { text: cleanTextForSpeech }, 
              voice: { languageCode: "ur-IN", name: "ur-IN-Wavenet-A" },
              audioConfig: { audioEncoding: "MP3" }
            })
          });
          if (ttsRes.ok) {
            const ttsData = await ttsRes.json();
            audioBase64 = ttsData.audioContent || "";
          }
        } catch {}

        return new Response(JSON.stringify({
          reply: rawText, 
          audioContent: audioBase64,
          agent_active: "zara"
        }), { status: 200, headers });

      } catch (e) {
        return new Response(JSON.stringify({ reply: `Server Error: ${e.message}` }), { status: 200, headers });
      }
    }

    return new Response("ZARA AI Active Core Engine Running", { status: 200, headers });
  }
};
            
