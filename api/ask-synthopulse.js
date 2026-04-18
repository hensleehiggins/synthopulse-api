export default async function handler(req, res) {
  // Basic CORS support for embed requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      message: "SynthoPulse API is live. Send a POST request with a message field."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed. Use POST."
    });
  }

  try {
    const body = req.body || {};
    const message = body.message;

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        error: "Missing message"
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5",
        input: `You are SynthoPulse, an AI assistant for restaurant operators.

Give clear, actionable recommendations based on this input:
${message}`
      })
    });

    const data = await response.json();

    let reply = "No response returned.";

    if (typeof data.output_text === "string" && data.output_text.trim()) {
      reply = data.output_text.trim();
    } else if (Array.isArray(data.output)) {
      const textParts = [];

      for (const item of data.output) {
        if (!item || !Array.isArray(item.content)) continue;

        for (const part of item.content) {
          if (part?.type === "output_text" && part?.text) {
            textParts.push(part.text);
          }
        }
      }

      if (textParts.length > 0) {
        reply = textParts.join("\n").trim();
      }
    }

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
