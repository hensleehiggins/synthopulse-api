export default async function handler(req, res) {
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

    // ---------------------------------
    // TEMP HARD-CODED CONTEXT
    // ---------------------------------
    // This is just to prove the assistant works with business context.
    // Next step after this: replace with live Airtable/KitchenPulse fields.
    const context = `
Restaurant: Chloe's Steakhouse

Today's Recommendation:
Feature Classic Crème Brûlée now

Decision Priority:
MEDIUM

Why this surfaced:
- Classic Crème Brûlée is the clearest upside play this run
- It appears to be a strong margin opportunity
- The system sees it as the best short-term push based on current movement

Action callout:
Feature Classic Crème Brûlée now

What to keep in mind:
- This is a focused recommendation, not a full menu reset
- The goal is to test and confirm the upside in the next run
- Execution should stay narrow and measurable
`.trim();

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5",
        instructions:
          "You are SynthoPulse, an AI assistant for restaurant operators. Always answer using the provided business context. Be direct, concise, and actionable. Do not ask broad generic follow-up questions when the context already gives you enough to answer.",
        input: `
Business Context:
${context}

User Question:
${message}
`
      })
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return res.status(openaiResponse.status).json({
        error: data?.error?.message || "OpenAI request failed",
        debug: data
      });
    }

    let reply = "";

    if (typeof data.output_text === "string" && data.output_text.trim()) {
      reply = data.output_text.trim();
    }

    if (!reply && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (!item || !Array.isArray(item.content)) continue;

        for (const part of item.content) {
          if (part?.type === "output_text" && typeof part.text === "string") {
            reply += part.text;
          }
        }
      }

      reply = reply.trim();
    }

    if (!reply) {
      return res.status(200).json({
        reply: "SynthoPulse returned no readable text.",
        debug: {
          id: data?.id,
          model: data?.model,
          output_text: data?.output_text ?? null,
          output: data?.output ?? null
        }
      });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
