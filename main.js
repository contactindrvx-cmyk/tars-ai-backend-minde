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

    // WebSocket Live Call
    if (request.headers.get("Upgrade") === "websocket") {
      try {
        const vertexKey = env.VERTEX_API_KEY;
        if (!vertexKey) return new Response("VERTEX_API_KEY missing", { status: 400 });

        const project = "tars-ai-chat-ann-assistant";
        const location = "us-central1";
        const model = "gemini-2.0-flash-live-001";

        const geminiLiveUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${vertexKey}`;

        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        server.accept();

        const gcpRes = await fetch(geminiLiveUrl, {
          headers: { "Upgrade": "websocket" }
        });

        if (!gcpRes.webSocket) {
          server.close(1011, "Upstream WS failed");
          return new Response("Upstream WebSocket failed", { status: 500 });
        }

        const gcp = gcpRes.webSocket;
        gcp.accept();

        server.addEventListener("message", (e) => {
          try { gcp.send(e.data); } catch {}
        });
        gcp.addEventListener("message", (e) => {
          try { server.send(e.data); } catch {}
        });
        server.addEventListener("close", (e) => {
          try { gcp.close(e.code, e.reason); } catch {}
        });
        gcp.addEventListener("close", (e) => {
          try { server.close(e.code, e.reason); } catch {}
        });
        gcp.addEventListener("error", () => {
          try { server.close(1011, "Upstream error"); } catch {}
        });

        return new Response(null, { status: 101, webSocket: client });

      } catch (e) {
        return new Response(`WebSocket Failed: ${e.message}`, { status: 500 });
      }
    }

    // POST Text Chat
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
            contents: [{
              role: "user",
              parts: [{ text: `${systemInstruction}\n\nUser: ${userMessage}` }]
            }]
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
