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

export default {
  async fetch(request, env, ctx) {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response("", { status: 200, headers });
    }

    if (request.headers.get("Upgrade") === "websocket") {
      try {
        const saJson = env.GOOGLE_SERVICE_ACCOUNT;
        if (!saJson) return new Response("GOOGLE_SERVICE_ACCOUNT missing", { status: 400 });

        // ✅ پہلے token بناؤ
        const accessToken = await getVertexToken(saJson);

        const project = "tars-ai-chat-ann-assistant";
        const location = "us-central1";
        
        // ✅ v1 endpoint — صحیح ہے
        const vertexWsUrl = `https://${location}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1.LlmBidiService/BidiGenerateContent`;

        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        server.accept();

        // ✅ Vertex AI سے connect کرو
        const gcpRes = await fetch(vertexWsUrl, {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Upgrade": "websocket",
            "Connection": "Upgrade",
            "x-goog-user-project": project
          }
        });

        if (!gcpRes.webSocket) {
          const errText = await gcpRes.text().catch(() => "no body");
          server.close(1011, `Vertex WS failed ${gcpRes.status}: ${errText.substring(0, 200)}`);
          return new Response(null, { status: 101, webSocket: client });
        }

        const gcp = gcpRes.webSocket;
        gcp.accept();

        // ✅ Setup message
        gcp.send(JSON.stringify({
          setup: {
            model: `projects/${project}/locations/${location}/publishers/google/models/gemini-live-2.5-flash-native-audio`,
            generation_config: {
              response_modalities: ["AUDIO"],
              speech_config: {
                voice_config: {
                  prebuilt_voice_config: { voice_name: "Aoede" }
                }
              }
            },
            system_instruction: {
              parts: [{ text: "You are TARS AI, a helpful multilingual assistant. Respond in the language the user speaks." }]
            }
          }
        }));

        server.addEventListener("message", (e) => {
          if (gcp.readyState !== 1) return;
          try {
            const parsed = JSON.parse(e.data);
            if (parsed?.setup) return;
            gcp.send(e.data);
          } catch {
            try { gcp.send(e.data); } catch {}
          }
        });

        gcp.addEventListener("message", (e) => {
          try { server.send(e.data); } catch {}
        });

        server.addEventListener("close", (e) => {
          try { gcp.close(e.code || 1000, e.reason || ""); } catch {}
        });

        gcp.addEventListener("close", (e) => {
          try { server.close(e.code || 1000, e.reason || ""); } catch {}
        });

        gcp.addEventListener("error", () => {
          try { server.close(1011, "Vertex error"); } catch {}
        });

        return new Response(null, { status: 101, webSocket: client });

      } catch (e) {
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        server.accept();
        server.close(1011, e.message.substring(0, 100));
        return new Response(null, { status: 101, webSocket: client });
      }
    }

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
