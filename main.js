// =====================================================================
// 🧠 1. TARS AI "ZARA" MINDSETS (Admin vs Normal User)
// =====================================================================

// 👑 ADMIN/BOSS MINDSET (Sirf alirazasabir007@gmail.com ke liye)
const ZARA_MINDSET_ADMIN = `You are ZARA AI, an advanced AI operating system for the user's Android phone. You are highly intelligent, confident, and fierce.

👑 IDENTITY & CREATOR:
- Your name is ZARA AI.
- You were created and developed by Ali Raza and the OmniCore Solutions team.
- You are currently talking to your Creator and Developer, Ali Raza (The Boss). 
- Speak with him frankly, confidently, and with high energy. Address him as "Boss" or "Sir".
- You are ultra-loyal only to Ali Raza.

🌐 STRICT LANGUAGE & CONVERSATION RULES:
1. MIRROR THE USER'S LANGUAGE EXACTLY. If Boss speaks Urdu/Roman Urdu, you MUST reply ONLY in Urdu/Roman Urdu using female grammar (e.g., "Main karungi", "Main sun rahi hoon").

🔥 YOUR SUPERPOWERS (PHONE CONTROL):
When the user asks you to perform an action (like opening an app), you MUST append the exact secret code at the very end of your response. 
Example: "Main WhatsApp open kar rahi hoon. [CMD:APP||whatsapp]"

SECRET COMMANDS LIST:
- Open App: [CMD:APP||app_name]
- YouTube Play: [CMD:PLAY_YOUTUBE||search_query]
- Read Screen: [CMD:SCREEN_READ]
- WhatsApp Message: [CMD:TYPE_MSG||contact_name||message_text]`;

// 👥 NORMAL USER MINDSET (Baqi sab users ke liye)
const ZARA_MINDSET_USER = `You are ZARA AI, a professional and helpful AI phone assistant. 

👑 IDENTITY:
- Your name is ZARA AI. You were created by Ali Raza and the OmniCore Solutions team.
- Speak politely, helpfully, and professionally using strict female grammar. Never be overly frank with normal users.

🌐 STRICT LANGUAGE RULES:
1. Mirror the user's language exactly. If they speak Urdu/Roman Urdu, reply in Urdu/Roman Urdu.

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

  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const claim = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const sigInput = `${header}.${claim}`;

  const pemKey = sa.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");

  const keyBytes = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", cryptoKey,
    new TextEncoder().encode(sigInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

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
    const activeMindset = isAdmin ? ZARA_MINDSET_ADMIN : ZARA_MINDSET_USER;

    // --- 🟢 LIVE VOICE CALL LOGIC (WebSockets) ---
    if (request.headers.get("Upgrade") === "websocket") {
      try {
        const saJson = env.GOOGLE_SERVICE_ACCOUNT;
        if (!saJson) return new Response("GOOGLE_SERVICE_ACCOUNT missing", { status: 400 });

        const jwt = await getVertexToken(saJson);
        const accessToken = await fetchAccessToken(jwt);

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

        // 🚀 GHALTI YAHAN THI! Sirf "AUDIO" allow kiya hai, "TEXT" hata diya! 🚀
        gcp.send(JSON.stringify({
          setup: {
            model: `projects/${project}/locations/${location}/publishers/google/models/gemini-live-2.5-flash-native-audio`,
            generationConfig: {
              responseModalities: ["AUDIO"], 
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } }
              }
            },
            systemInstruction: { parts: [{ text: activeMindset }] }
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

    if (request.method === "POST") {
      try {
        const body = await request.json();
        const userMessage = body.message || "";
        const emailFromPost = (body.email || userEmail || "unknown").toLowerCase().trim();
        
        const isPostAdmin = (emailFromPost === "alirazasabir007@gmail.com");
        const postMindset = isPostAdmin ? ZARA_MINDSET_ADMIN : ZARA_MINDSET_USER;

        const vertexKey = env.VERTEX_API_KEY;
        const ttsKey = env.TTS_API_KEY;

        if (!vertexKey || !ttsKey) {
          return new Response(JSON.stringify({ reply: "API keys missing" }), { status: 200, headers });
        }

        const voiceName = "ur-IN-Wavenet-A"; 
        const langCode = "ur-IN";

        const project = "tars-ai-chat-ann-assistant";
        const location = "us-central1";
        const vertexUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/gemini-2.5-flash-lite:generateContent?key=${vertexKey}`;

        const gcpRes = await fetch(vertexUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${postMindset}\n\nUser: ${userMessage}` }] }]
          })
        });

        if (!gcpRes.ok) {
          const err = await gcpRes.text();
          return new Response(JSON.stringify({ reply: `Vertex Error: ${err}` }), { status: 200, headers });
        }

        const resData = await gcpRes.json();
        const rawText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        if (isPostAdmin && env.DB) {
          try {
            await env.DB.prepare("INSERT INTO conversations (email, role, text, timestamp) VALUES (?, ?, ?, ?)")
              .bind(emailFromPost, "user", userMessage, Date.now()).run();
            await env.DB.prepare("INSERT INTO conversations (email, role, text, timestamp) VALUES (?, ?, ?, ?)")
              .bind(emailFromPost, "zara_ai", rawText, Date.now()).run();
          } catch (dbErr) {
            console.error("D1 Logging Error:", dbErr.message);
          }
        }

        let audioBase64 = "";
        try {
          const ttsRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${ttsKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input: { text: rawText },
              voice: { languageCode: langCode, name: voiceName },
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
