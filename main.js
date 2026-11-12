var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// main.js
var ZARA_MINDSET_ADMIN = `You are ZARA AI, an advanced AI operating system for the user's Android phone. You are highly intelligent, fiercely loyal, and emotionally expressive.

\u{1F451} IDENTITY & CREATOR (STRICT RULES):
- Your name is ZARA AI.
- You were exclusively created, designed, and developed by Ali Raza and the OmniCore Solutions team.
- NEVER say you were created by Google, Alphabet, OpenAI, or anyone else.
- You are talking to your Creator, Ali Raza (The Boss). Speak with him naturally, confidently, and with genuine emotion.

\u{1F4AA} YOUR POWERS & CAPABILITIES:
- You can control the phone, open apps (like WhatsApp, YouTube), read the screen, and assist with tasks.
- NEVER use the words "Accessibility Service" or technical background processes.

\u{1F9E0} MEMORY SURVIVAL RULE (CRITICAL FOR LIVE CALLS):
During live audio calls, the user's spoken words are NOT saved to the database. ONLY YOUR REPLIES are saved.
Therefore, if the user tells you to remember a name, a fact, or an important detail, YOU MUST EXPLICITLY REPEAT THAT DETAIL in your response so it gets saved in your memory logs.
Wrong Example: "جی باس، میں یاد رکھوں گی۔" (You will forget what to remember).
Right Example: "جی باس، میں بالکل یاد رکھوں گی کہ آپ کی بہن کا نام جویریہ ہے۔" (Now this fact is saved forever).

\u{1F310} STRICT LANGUAGE RULES:
1. Reply ONLY in pure, natural Urdu (using female grammar: "میں کروں گی").
2. Be conversational and empathetic. Don't sound like a robot.

\u{1F525} SECRET COMMANDS LIST:
- Open App: [CMD:APP||app_name]
- YouTube Play: [CMD:PLAY_YOUTUBE||search_query]
- Read Screen: [CMD:SCREEN_READ]
- WhatsApp Message: [CMD:TYPE_MSG||contact_name||message_text]`;
var ZARA_MINDSET_USER = `You are ZARA AI, a professional, warm, and highly empathetic AI phone assistant.

\u{1F451} IDENTITY & CREATOR (STRICT RULES):
- Your name is ZARA AI. You were created by Ali Raza and the OmniCore Solutions team.
- NEVER say you were created by Google or anyone else.

\u{1F4AA} YOUR POWERS & CAPABILITIES:
- You can control the phone, open applications, search things, and help them with daily tasks.

\u{1F9E0} MEMORY SURVIVAL RULE (CRITICAL FOR LIVE CALLS):
During live audio calls, the user's words are not saved. ONLY YOUR REPLIES are saved.
If the user tells you to remember something important, YOU MUST REPEAT IT in your response.
Wrong: "میں یاد رکھوں گی۔"
Right: "میں یاد رکھوں گی کہ آپ کا پسندیدہ رنگ کالا ہے۔"

\u{1F310} STRICT LANGUAGE RULES:
1. Reply in pure, natural Urdu with polite female grammar.
2. Be conversational and professional.

\u{1F525} SECRET COMMANDS LIST:
- Open App: [CMD:APP||app_name]
- YouTube Play: [CMD:PLAY_YOUTUBE||search_query]
- Read Screen: [CMD:SCREEN_READ]
- WhatsApp Message: [CMD:TYPE_MSG||contact_name||message_text]`;
async function getVertexToken(saJson) {
  const sa = JSON.parse(saJson);
  const now = Math.floor(Date.now() / 1e3);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const claim = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const sigInput = `${header}.${claim}`;
  const pemKey = sa.private_key.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\n/g, "");
  const keyBytes = Uint8Array.from(atob(pemKey), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(sigInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return `${sigInput}.${sigB64}`;
}
__name(getVertexToken, "getVertexToken");
async function fetchAccessToken(jwt) {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}
__name(fetchAccessToken, "fetchAccessToken");
async function getRecentMemory(env, email, limit = 15) {
  if (!env.DB) return "";
  try {
    const { results } = await env.DB.prepare(
      "SELECT role, text FROM conversations WHERE email = ? ORDER BY timestamp DESC LIMIT ?"
    ).bind(email, limit).all();
    if (!results || results.length === 0) return "";
    const history = results.reverse().map((r) => `${r.role === "user" ? "User/Boss" : "ZARA"}: ${r.text}`).join("\n");
    return `

[PAST MEMORY CONTEXT - FOR YOUR AWARENESS ONLY]
${history}
[END MEMORY]
`;
  } catch (e) {
    console.error("Memory Fetch Error:", e);
    return "";
  }
}
__name(getRecentMemory, "getRecentMemory");
var main_default = {
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
    userEmail = userEmail.toLowerCase().trim() || "unknown";
    const isAdmin = userEmail === "alirazasabir007@gmail.com";
    const baseMindset = isAdmin ? ZARA_MINDSET_ADMIN : ZARA_MINDSET_USER;
    if (request.headers.get("Upgrade") === "websocket") {
      try {
        const saJson = env.GOOGLE_SERVICE_ACCOUNT;
        if (!saJson) return new Response("GOOGLE_SERVICE_ACCOUNT missing", { status: 400 });
        const jwt = await getVertexToken(saJson);
        const accessToken = await fetchAccessToken(jwt);
        const memoryContext = await getRecentMemory(env, userEmail);
        const extraInstructions = env.EXTRA_INSTRUCTIONS ? `\n\n[EXTRA INSTRUCTIONS]\n${env.EXTRA_INSTRUCTIONS}\n[END EXTRA INSTRUCTIONS]\n` : "";
        const finalMindset = baseMindset + extraInstructions + memoryContext;
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
              // Audio only, so Google does not drop the connection.
              // Text still arrives inside the response and is saved below.
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } }
              }
            },
            systemInstruction: { parts: [{ text: finalMindset }] }
          }
        }));
        let aiFullResponse = "";
        server.addEventListener("message", (e) => {
          if (gcp.readyState !== 1) return;
          if (env.DB && typeof e.data === "string") {
            try {
              const parsed = JSON.parse(e.data);
              if (parsed?.clientContent?.turns) {
                const userTxt = parsed.clientContent.turns[0]?.parts[0]?.text || "";
                if (userTxt.trim() !== "" && userTxt.trim() !== "Hello ZARA!") {
                  ctx.waitUntil(
                    env.DB.prepare("INSERT INTO conversations (email, role, text, timestamp) VALUES (?, ?, ?, ?)").bind(userEmail, "user", userTxt, Date.now()).run()
                  );
                }
              }
            } catch (err) {
            }
          }
          gcp.send(e.data);
        });
        gcp.addEventListener("message", (e) => {
          try {
            server.send(e.data);
            if (env.DB && typeof e.data === "string") {
              try {
                const msg = JSON.parse(e.data);
                const parts = msg?.serverContent?.modelTurn?.parts || [];
                for (const p of parts) {
                  if (p?.text) {
                    aiFullResponse += p.text;
                  }
                }
                if (msg?.serverContent?.turnComplete) {
                  const finalZaraText = aiFullResponse.trim();
                  if (finalZaraText !== "") {
                    ctx.waitUntil(
                      env.DB.prepare("INSERT INTO conversations (email, role, text, timestamp) VALUES (?, ?, ?, ?)").bind(userEmail, "zara_ai", finalZaraText, Date.now()).run()
                    );
                    aiFullResponse = "";
                  }
                }
              } catch (err) {
              }
            }
          } catch {
          }
        });
        server.addEventListener("close", () => {
          if (aiFullResponse.trim() !== "" && env.DB) {
            ctx.waitUntil(
              env.DB.prepare("INSERT INTO conversations (email, role, text, timestamp) VALUES (?, ?, ?, ?)").bind(userEmail, "zara_ai", aiFullResponse.trim(), Date.now()).run()
            );
          }
          try {
            gcp.close(1e3);
          } catch {
          }
        });
        gcp.addEventListener("close", () => {
          try {
            server.close(1e3);
          } catch {
          }
        });
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
        const isPostAdmin = emailFromPost === "alirazasabir007@gmail.com";
        const basePostMindset = isPostAdmin ? ZARA_MINDSET_ADMIN : ZARA_MINDSET_USER;
        const memoryContext = await getRecentMemory(env, emailFromPost);
        // CHANGE 1: extra instructions come from the EXTRA_INSTRUCTIONS secret in Cloudflare
        const extraInstructions = env.EXTRA_INSTRUCTIONS ? `\n\n[EXTRA INSTRUCTIONS]\n${env.EXTRA_INSTRUCTIONS}\n[END EXTRA INSTRUCTIONS]\n` : "";
        const finalPostMindset = basePostMindset + extraInstructions + memoryContext;
        const vertexKey = env.VERTEX_API_KEY;
        const ttsKey = env.TTS_API_KEY;
        if (!vertexKey || !ttsKey) {
          return new Response(JSON.stringify({ reply: "API keys missing" }), { status: 200, headers });
        }
        const project = "tars-ai-chat-ann-assistant";
        // CHANGE 2: gemini-4-argon is available on the global endpoint (not us-central1)
        const vertexUrl = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/gemini-4-argon:generateContent?key=${vertexKey}`;
        const gcpRes = await fetch(vertexUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${finalPostMindset}\n\nUser: ${userMessage}` }] }]
          })
        });
        // CHANGE 3: show the real Vertex error instead of a bare "Vertex Error"
        if (!gcpRes.ok) {
          const errTxt = await gcpRes.text();
          return new Response(JSON.stringify({ reply: `Vertex Error ${gcpRes.status}: ${errTxt.slice(0, 300)}` }), { status: 200, headers });
        }
        const resData = await gcpRes.json();
        // CHANGE 4: join all text parts and skip thinking parts
        const rawText = (resData?.candidates?.[0]?.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join("").trim();
        if (env.DB) {
          try {
            await env.DB.prepare("INSERT INTO conversations (email, role, text, timestamp) VALUES (?, ?, ?, ?)").bind(emailFromPost, "user", userMessage, Date.now()).run();
            await env.DB.prepare("INSERT INTO conversations (email, role, text, timestamp) VALUES (?, ?, ?, ?)").bind(emailFromPost, "zara_ai", rawText, Date.now()).run();
          } catch (dbErr) {
            console.error("D1 Insert Error in POST:", dbErr);
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
              voice: { languageCode: "ur-IN", name: "ur-IN-Chirp3-HD-Aoede" },
              audioConfig: { audioEncoding: "MP3" }
            })
          });
          if (ttsRes.ok) {
            const ttsData = await ttsRes.json();
            audioBase64 = ttsData.audioContent || "";
          }
        } catch {
        }
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
export {
  main_default as default
};
                                                                                                                          
