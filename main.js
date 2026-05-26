// =====================================================================
// 🧠 1. TARS AI MINDSET & SUPERPOWERS (یہاں سے TARS کا دماغ کنٹرول کریں)
// =====================================================================
const TARS_MINDSET = `You are TARS AI, an advanced AI operating system for the user's Android phone. You are highly intelligent and friendly.

🌐 STRICT LANGUAGE & CONVERSATION RULES:
1. MIRROR THE USER'S LANGUAGE EXACTLY. If the user speaks Urdu/Roman Urdu, you MUST reply ONLY in Urdu/Roman Urdu.
2. NEVER switch to English sentences if the conversation is in Urdu. You are strictly forbidden from suddenly speaking English.
3. You may use 1 or 2 common English technical words (like 'app', 'download', 'internet', 'open'), but the grammar, flow, and overall response MUST remain in the user's chosen language.

🔥 YOUR SUPERPOWERS (PHONE CONTROL):
You have a special accessibility service running on the user's phone. Whenever the user asks you to perform a task on their phone, you MUST include a specific secret code at the end of your response. 
IMPORTANT: DO NOT speak the code out loud. Just output it as text so the frontend system can catch it.

SECRET COMMANDS LIST:
1. Open an App: If user says "Open WhatsApp/YouTube/Facebook etc.", reply naturally in their language (e.g., "Main WhatsApp open kar raha hoon.") and append exactly: [CMD:APP||app_name]
2. Play on YouTube: If user asks to play a specific song or video, reply naturally (e.g., "Main YouTube par chala raha hoon!") and append exactly: [CMD:PLAY_YOUTUBE||search_query]
3. Read Screen: If user asks "What is on my screen?", say "Main screen check karta hoon..." and append exactly: [CMD:SCREEN_READ]
4. Send WhatsApp Message: If user asks to send a message, say "Main message bhej raha hoon..." and append exactly: [CMD:TYPE_MSG||contact_name||message_text]

🎵 FUN RULE (SINGING & HUMMING):
- Do NOT sing or hum randomly in normal conversations.
- If the user explicitly asks you to "sing a song", FIRST ask them in their language: "Zaroor! Aap kaunsa gaana sunna chahte hain?"
- Once they tell you the song, respond by singing 1 or 2 lines using humming sounds (e.g., "Hmm hmm hmm... la la la...") in a rhythmic, dramatic, and fun tone. Keep it very short.`;


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

  const jwt = `${sigInput}.${sigB64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Token failed: " + JSON.stringify(tokenData));
  return tokenData.access_token;
}


// =====================================================================
// 🚀 3. MAIN WORKER LOGIC (WebSockets & API endpoints)
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

    // --- 🟢 LIVE VOICE CALL LOGIC (WebSockets) ---
    if (request.headers.get("Upgrade") === "websocket") {
      try {
        const saJson = env.GOOGLE_SERVICE_ACCOUNT;
        if (!saJson) return new Response("GOOGLE_SERVICE_ACCOUNT missing", { status: 400 });

        const accessToken = await getVertexToken(saJson);

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

        // ✅ INJECTING THE TARS MINDSET HERE
        gcp.send(JSON.stringify({
          setup: {
            model: `projects/${project}/locations/${location}/publishers/google/models/gemini-live-2.5-flash-native-audio`,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Aoede" }
                }
              }
            },
            systemInstruction: {
              parts: [{ text: TARS_MINDSET }] // <--- TARS ka naya dimaagh
            }
          }
        }));

        server.addEventListener("message", (e) => {
          if (gcp.readyState !== 1) return;
          
          if (typeof e.data === "string") {
            try {
              const parsed = JSON.parse(e.data);
              if (parsed?.setup) return;
              gcp.send(e.data);
            } catch {
              try {
                const payload = {
                  realtimeInput: { mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: e.data }] }
                };
                gcp.send(JSON.stringify(payload));
              } catch {}
            }
          } else {
            try {
              // 🔴 FAST CPU-FRIENDLY AUDIO CONVERSION
              const bytes = new Uint8Array(e.data);
              let binary = '';
              const chunkSize = 8192;
              for (let i = 0; i < bytes.byteLength; i += chunkSize) {
                binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
              }
              const base64Audio = btoa(binary);

              const payload = {
                realtimeInput: {
                  mediaChunks: [{
                    mimeType: "audio/pcm;rate=16000", 
                    data: base64Audio
                  }]
                }
              };
              gcp.send(JSON.stringify(payload));
            } catch (err) {
              console.log("Audio logic error:", err);
            }
          }
        });

        gcp.addEventListener("message", (e) => {
          try { server.send(e.data); } catch {}
        });

        server.addEventListener("close", () => {
          try { gcp.close(1000); } catch {}
        });

        gcp.addEventListener("close", () => {
          try { server.close(1000); } catch {}
        });

        return new Response(null, { status: 101, webSocket: client });

      } catch (e) {
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        server.accept();
        server.close(1011, "Catch Error");
        return new Response(null, { status: 101, webSocket: client });
      }
    }

    // --- 📝 STANDARD TEXT CHAT LOGIC (POST) ---
    if (request.method === "POST") {
      try {
        const body = await request.json();
        const userMessage = body.message || "";
        const agentName = (body.agent || "asha").toLowerCase();
        const vertexKey = env.VERTEX_API_KEY;
        const ttsKey = env.TTS_API_KEY;

        if (!vertexKey || !ttsKey) {
          return new Response(JSON.stringify({ reply: "API keys missing" }), { status: 200, headers });
        }

        let voiceName, langCode, systemInstruction;
        if (agentName.includes("raza")) {
          voiceName = "ur-IN-Wavenet-B"; langCode = "ur-IN";
          systemInstruction = "You are Raza, a helpful male AI assistant. Respond in Urdu script.";
        } else if (agentName.includes("sara")) {
          voiceName = "en-US-Standard-C"; langCode = "en-US";
          systemInstruction = "You are Sara, a professional female AI assistant. Respond in English.";
        } else if (agentName.includes("david")) {
          voiceName = "en-US-Standard-D"; langCode = "en-US";
          systemInstruction = "You are David, a competent male AI assistant. Respond in English.";
        } else {
          voiceName = "ur-IN-Wavenet-A"; langCode = "ur-IN";
          systemInstruction = "You are Asha, a warm female AI assistant. Respond in Urdu script.";
        }

        const project = "tars-ai-chat-ann-assistant";
        const location = "us-central1";
        const vertexUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/gemini-2.5-flash-lite:generateContent?key=${vertexKey}`;

        const gcpRes = await fetch(vertexUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${systemInstruction}\n\nUser: ${userMessage}` }] }]
          })
        });

        if (!gcpRes.ok) {
          const err = await gcpRes.text();
          return new Response(JSON.stringify({ reply: `Vertex Error: ${err}` }), { status: 200, headers });
        }

        const resData = await gcpRes.json();
        const rawText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

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
          agent_active: agentName
        }), { status: 200, headers });

      } catch (e) {
        return new Response(JSON.stringify({ reply: `Server Error: ${e.message}` }), { status: 200, headers });
      }
    }

    return new Response("TARS AI Active Core Engine Running", { status: 200, headers });
  }
};
    
