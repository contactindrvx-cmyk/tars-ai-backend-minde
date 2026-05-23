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

    // ✅ WebSocket Live Call
    if (request.headers.get("Upgrade") === "websocket") {
      try {
        const geminiKey = env.GEMINI_LIVE_KEY;
        if (!geminiKey) return new Response("GEMINI_LIVE_KEY missing", { status: 400 });

        const geminiLiveUrl = `https://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${geminiKey}`;

        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        server.accept();

        let gcp = null;
        let gcpReady = false;
        const pendingQueue = [];

        try {
          const gcpRes = await fetch(geminiLiveUrl, {
            headers: {
              "Upgrade": "websocket",
              "Connection": "Upgrade",
            }
          });

          if (!gcpRes.webSocket) {
            server.close(1011, "Gemini WS failed");
            return new Response("Gemini WebSocket failed", { status: 500 });
          }

          gcp = gcpRes.webSocket;
          gcp.accept();

          // ✅ Worker خود setup message بھیجتا ہے — model force کرتا ہے
          const setupMsg = JSON.stringify({
            setup: {
              model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
              generation_config: {
                response_modalities: ["AUDIO"],
                speech_config: {
                  voice_config: {
                    prebuilt_voice_config: {
                      voice_name: "Aoede"
                    }
                  }
                }
              },
              system_instruction: {
                parts: [{
                  text: "You are TARS AI, a helpful multilingual assistant. Respond naturally in the language the user speaks. Be warm, concise, and helpful."
                }]
              }
            }
          });

          gcp.send(setupMsg);
          gcpReady = true;

          // pending messages بھیجو
          for (const msg of pendingQueue) {
            try { gcp.send(msg); } catch {}
          }

          // client سے آنے والا سب Gemini کو forward کرو
          server.addEventListener("message", (e) => {
            if (!gcp || gcp.readyState !== 1) return;
            try {
              // setup message کو ignore کرو — Worker پہلے بھیج چکا ہے
              const parsed = JSON.parse(e.data);
              if (parsed?.setup) return;
              gcp.send(e.data);
            } catch {
              try { gcp.send(e.data); } catch {}
            }
          });

          // Gemini سے آنے والا سب client کو forward کرو
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
            try { server.close(1011, "Gemini error"); } catch {}
          });

        } catch (e) {
          try { server.close(1011, e.message); } catch {}
          return new Response(`WS setup failed: ${e.message}`, { status: 500 });
        }

        return new Response(null, { status: 101, webSocket: client });

      } catch (e) {
        return new Response(`WebSocket Failed: ${e.message}`, { status: 500 });
      }
    }

    // ✅ POST Text Chat - Vertex AI
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
