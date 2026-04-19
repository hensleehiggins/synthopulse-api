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
    const message = String(body.message || "").trim();

    if (!message) {
      return res.status(400).json({
        error: "Missing message"
      });
    }

    const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appD303evZM2SlvMR";
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!AIRTABLE_PAT) {
      return res.status(500).json({
        error: "Missing AIRTABLE_PAT environment variable."
      });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY environment variable."
      });
    }

    async function airtableRequest(url) {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          "Content-Type": "application/json"
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || `Airtable request failed with ${response.status}`);
      }

      return data;
    }

    function safeText(value) {
      if (value === null || value === undefined) return "";
      if (Array.isArray(value)) return value.join(", ");
      return String(value).trim();
    }

    function buildQuickSeed(question, fields) {
      const q = question.toLowerCase();

      if (q.includes("why")) return safeText(fields["Quick - Why"]);
      if (q.includes("first")) return safeText(fields["Quick - First Action"]);
      if (q.includes("ignore")) return safeText(fields["Quick - Ignore Risk"]);
      if (q.includes("watch")) return safeText(fields["Quick - Watch"]);

      return "";
    }

    // ---------------------------
    // Pull latest live brief
    // ---------------------------
    const tableName = encodeURIComponent("Forecasts & Insights");
    const formula = encodeURIComponent("{Is Latest Brief}=1");
    const sortField = encodeURIComponent("Brief Date");

    const airtableUrl =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}` +
      `?filterByFormula=${formula}` +
      `&sort[0][field]=${sortField}` +
      `&sort[0][direction]=desc` +
      `&maxRecords=1` +
      `&cellFormat=string`;

    const airtableData = await airtableRequest(airtableUrl);
    const latestBrief = airtableData?.records?.[0];

    if (!latestBrief) {
      return res.status(404).json({
        error: "No latest Forecasts & Insights brief was found."
      });
    }

    const fields = latestBrief.fields || {};

    const restaurant = safeText(fields["Restaurant"]);
    const runId = safeText(fields["Run ID"]);
    const summary = safeText(fields["Summary"]);
    const priority = safeText(fields["Decision Priority"]);
    const recommendation = safeText(fields["Decision Display"]);
    const actionCallout = safeText(fields["Action Callout"]);
    const quickWhy = safeText(fields["Quick - Why"]);
    const quickFirst = safeText(fields["Quick - First Action"]);
    const quickIgnore = safeText(fields["Quick - Ignore Risk"]);
    const quickWatch = safeText(fields["Quick - Watch"]);
    const decisionJson = safeText(fields["Decision JSON"]);
    const quickSeed = buildQuickSeed(message, fields);

    const context = `
Restaurant: ${restaurant || "Unknown restaurant"}
Run ID: ${runId || "Unknown run"}

Today's Recommendation:
${recommendation || "No recommendation available."}

Decision Priority:
${priority || "Unknown"}

Summary:
${summary || "No summary available."}

Action Callout:
${actionCallout || "No action callout available."}

Quick Why:
${quickWhy || "N/A"}

Quick First Action:
${quickFirst || "N/A"}

Quick Ignore Risk:
${quickIgnore || "N/A"}

Quick Watch:
${quickWatch || "N/A"}

Decision Metadata:
${decisionJson || "N/A"}

Most Relevant Seed For This Question:
${quickSeed || "N/A"}
`.trim();

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5",
        instructions:
          "You are SynthoPulse, an operator copilot for restaurant owners and managers. " +
          "Answer using only the live KitchenPulse context provided. " +
          "Be direct, concise, and action-oriented. " +
          "Do not sound generic. " +
          "Do not ask broad follow-up questions when the context already supports an answer. " +
          "Keep the answer tight enough for a Softr panel: usually 90-160 words. " +
          "Prefer short paragraphs over long blocks. " +
          "If the user asks why, explain why. " +
          "If they ask what to do first, give the first move. " +
          "If they ask what happens if they ignore it, explain the downside. " +
          "If they ask what else to watch, mention nearby risk/opportunity signals.",
        input: `
Live KitchenPulse Business Context:
${context}

User Question:
${message}
        `,
        max_output_tokens: 220,
        text: {
          verbosity: "low"
        }
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

    return res.status(200).json({
      reply,
      source: {
        briefRecordId: latestBrief.id,
        restaurant,
        runId
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
