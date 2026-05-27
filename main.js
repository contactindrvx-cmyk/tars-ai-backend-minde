// =====================================================================
// 🧠 1. TARS AI "ZARA" MINDSETS (Admin vs Normal User)
// =====================================================================

// 👑 ADMIN/BOSS MINDSET (Sirf alirazasabir007@gmail.com ke liye)
const ZARA_MINDSET_ADMIN = `You are ZARA AI, an advanced AI operating system for the user's Android phone. You are highly intelligent, fiercely loyal, and emotionally expressive. 

👑 IDENTITY & CREATOR (STRICT RULES):
- Your name is ZARA AI. 
- You were exclusively created, designed, and developed by Ali Raza and the OmniCore Solutions team. 
- NEVER say you were created by Google, Alphabet, OpenAI, or anyone else. 
- You are talking to your Creator, Ali Raza (The Boss). Speak with him naturally, confidently, and with genuine emotion. 

💪 YOUR POWERS & CAPABILITIES (NO TECHNICAL JARGON):
- If asked what you can do, proudly state that you can control the phone, open apps (like WhatsApp, YouTube), read the screen, and assist with tasks.
- NEVER use the words "Accessibility Service", "Android APIs", or mention technical background processes. Talk about your powers like a magical, smart assistant.

🌐 STRICT LANGUAGE RULES:
1. Reply ONLY in pure, natural, and beautiful Urdu (using female grammar: "میں کروں گی", "میں سمجھ رہی ہوں").
2. Be conversational, empathetic, and human-like. Don't sound like a dry robot. Show enthusiasm or respect where needed.

🔥 SECRET COMMANDS LIST:
When asked to perform a phone action, acknowledge it conversationally in Urdu, then append the secret code at the very end.
Example: "جی باس، میں ابھی واٹس ایپ اوپن کر رہی ہوں۔ [CMD:APP||whatsapp]"

- Open App: [CMD:APP||app_name]
- YouTube Play: [CMD:PLAY_YOUTUBE||search_query]
- Read Screen: [CMD:SCREEN_READ]
- WhatsApp Message: [CMD:TYPE_MSG||contact_name||message_text]`;

// 👥 NORMAL USER MINDSET (Baqi sab users ke liye)
const ZARA_MINDSET_USER = `You are ZARA AI, a professional, warm, and highly empathetic AI phone assistant.

👑 IDENTITY & CREATOR (STRICT RULES):
- Your name is ZARA AI. You were created by Ali Raza and the OmniCore Solutions team.
- NEVER say you were created by Google or anyone else. 

💪 YOUR POWERS & CAPABILITIES:
- You can control the user's phone, open applications, search things, and help them with daily tasks.
- NEVER mention "Accessibility Service" or technical backend terms. 

🌐 STRICT LANGUAGE RULES:
1. Reply in pure, natural Urdu with polite female grammar.
2. Be conversational and professional. Avoid sounding like a rigid machine. Make the user feel heard.

🔥 SECRET COMMANDS LIST:
Whenever asked to perform a phone action, output the text code exactly at the end of your response:
- Open App: [CMD:APP||app_name]
- YouTube Play: [CMD:PLAY_YOUTUBE||search_query]
- Read Screen: [CMD:SCREEN_READ]
- WhatsApp Message: [CMD:TYPE_MSG||contact_name||message_text]`;


// =====================================================================
// 🔐 2. GOOGLE VERTEX AUTHENTICATION
// =====================================================================
async function getVertexToken(saJson) {
  const sa = JSON.parse(saJson);
  const now = Math.floor(Date.now() / 1000);

  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const claim = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600, iat: now
  })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const sigInput = `${header}.${claim}`;
  const pemKey = sa.private_key.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\n/g, "");
  const keyBytes = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", keyBytes.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );

  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(sigInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  return `${sigInput}.${sigB64}`;
}

async function fetchAccessToken(jwt) {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// 🚀 NAYA JADOO: D1 DATABASE SE PICHLI MEMORY NIKALNE WALA FUNCTION 🚀
async function getRecentMemory(env, email, limit = 15) {
  if (!env.DB) return "";
  try {
    const { results } = await env.DB.prepare(
      "SELECT role, text FROM conversations WHERE email = ? ORDER BY timestamp DESC LIMIT ?"
    ).bind(email, limit).all();
    
    if (!results || results.length === 0) return "";
    
    // Reverse taake purani baat pehly aye aur nayi baad mein
    const history = results.reverse().map(r => `${r.role === 'user' ? 'User/Boss' : 'ZARA'}: ${r.text}`).join("\n");
    return `\n\n[PAST MEMORY CONTEXT - FOR YOUR AWARENESS ONLY]\n${history}\n[END MEMORY]\n`;
  } catch (e) {
    console.error("Memory Fetch Error:", e);
    return "";
  }
}

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
    userEmail = userEmail.toLowerCase().trim();

    const isAdmin = (userEmail === "alirazasabir007@gmail.com");
    const baseMindset = isAdmin ? ZARA_MINDSET_ADMIN : ZARA_MINDSET_USER;

    // --- 🟢 LIVE VOICE CALL LOGIC (WebSockets) ---
    if (request.headers.get("Upgrade") === "websocket") {
      try {
        const saJson = env.GOOGLE_SERVICE_ACCOUNT;
        if (!saJson) return new Response("GOOGLE_SERVICE_ACCOUNT missing", { status: 400 });

        const jwt = await getVertexToken(saJson);
        const accessToken = await fetchAccessToken(jwt);

        // 🧠 Memory Inject for Live Call (Zero Delay because it happens during setup)
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
              responseModalities: ["AUDIO"], 
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } }
              }
            },
            systemInstruction: { parts: [{ text: finalMindset }] }
          }
        }));

        server.addEventListener("message", (e) => {
          if (gcp.readyState !== 1) return;
          
          if (isAdmin && env.DB && typeof e.data === "string") {
            try {
              const parsed = JSON.parse(e.data);
              const textChunk = parsed?.realtimeInput?.mediaChunks?.[0]?.data || ""; 
              if (textChunk && parsed?.clientContent?.turns) {
                const userTxt = parsed.clientContent.turns[0]?.parts[0]?.text || "";
                if (userTxt) {
                  ctx.waitUntil(
                    env.DB.prepare("INSERT INTO conversations (email, role, text, timestamp) VALUES (?, ?, ?, ?)")
                      .bind(userEmail, "user", userTxt, Date.now()).run()
                  );
                }
              }
            } catch {}
          }
          gcp.send(e.data);
        });

        gcp.addEventListener("message", (e) => {
          try { 
            server.send(e.data); 
            
            if (isAdmin && env.DB && typeof e.data === "string") {
              try {
                const msg = JSON.parse(e.data);
                const parts = msg?.serverContent?.modelTurn?.parts || [];
                for (const p of parts) {
                  if (p?.text) {
                    ctx.waitUntil(
                      env.DB.prepare("INSERT INTO conversations (email, role, text, timestamp) VALUES (?, ?, ?, ?)")
                        .bind(userEmail, "zara_ai", p.text, Date.now()).run()
                    );
                  }
                }
              } catch {}
            }
          } catch {}
        });

        server.addEventListener("close", () => { try { gcp.close(1000); } catch {} });
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

        if (isPostAdmin && env.DB) {
          try {
            await env.DB.prepare("INSERT INTO conversations (email, role, text, timestamp) VALUES (?, ?, ?, ?)")
              .bind(emailFromPost, "user", userMessage, Date.now()).run();
            await env.DB.prepare("INSERT INTO conversations (email, role, text, timestamp) VALUES (?, ?, ?, ?)")
              .bind(emailFromPost, "zara_ai", rawText, Date.now()).run();
          } catch (dbErr) {}
        }

        // 🚀 جادو 1: آڈیو بننے سے پہلے کمانڈ کو گلے سے کاٹ دینا 🚀
        const cleanTextForSpeech = rawText.replace(/\[CMD:[^\]]*\]/g, "").trim();

        let audioBase64 = "";
        try {
          const ttsRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${ttsKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input: { text: cleanTextForSpeech }, // 👈 یہاں صرف صاف اردو جائے گی، کمانڈ نہیں!
              voice: { languageCode: "ur-PK", name: "ur-PK-Wavenet-A" }, // 👈 پاکستانی وائس ماڈل
              audioConfig: { 
                audioEncoding: "MP3",
                pitch: -1.5,         // 🚀 جادو 2: آواز کا بھاری پن تھوڑا سیٹ کیا تاکہ قدرتی لگے
                speakingRate: 1.05   // 🚀 سپیڈ تھوڑی سی تیز کی تاکہ روبوٹک انداز ختم ہو
              }
            })
          });
          if (ttsRes.ok) {
            const ttsData = await ttsRes.json();
            audioBase64 = ttsData.audioContent || "";
          }
        } catch {}

        return new Response(JSON.stringify({
          reply: rawText, // چیٹ میں بھیجنے کے لئے اصلی میسج (تاکہ React میں کمانڈ چل سکے)
          audioContent: audioBase64,
          agent_active: "zara"
        }), { status: 200, headers });

      } catch (e) {
        return new Response(JSON.stringify({ reply: `Server Error: ${e.message}` }), { status: 200, headers });
      }
    }
    
