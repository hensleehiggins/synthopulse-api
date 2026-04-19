module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

if (req.method === "GET") {
  const AIRTABLE_PAT = String(process.env.AIRTABLE_PAT || "").trim();
  const AIRTABLE_BASE_ID = String(process.env.AIRTABLE_BASE_ID || "").trim();
  const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();

  let airtableAuthCheck = null;

  try {
    const testResponse = await fetch(`https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json"
      }
    });

    const testText = await testResponse.text();

    airtableAuthCheck = {
      status: testResponse.status,
      ok: testResponse.ok,
      body_preview: testText.slice(0, 300)
    };
  } catch (err) {
    airtableAuthCheck = {
      status: "request_failed",
      ok: false,
      body_preview: err.message
    };
  }

  return res.status(200).json({
    status: "ok",
    message: "SynthoPulse API is live. Send a POST request with a message field.",
    debug: {
      airtable_pat_prefix: AIRTABLE_PAT ? AIRTABLE_PAT.slice(0, 4) : null,
      airtable_pat_length: AIRTABLE_PAT ? AIRTABLE_PAT.length : 0,
      airtable_base_id: AIRTABLE_BASE_ID || null,
      openai_key_prefix: OPENAI_API_KEY ? OPENAI_API_KEY.slice(0, 3) : null,
      openai_key_length: OPENAI_API_KEY ? OPENAI_API_KEY.length : 0,
      airtable_auth_check: airtableAuthCheck
    }
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

const AIRTABLE_PAT = String(process.env.AIRTABLE_PAT || "").trim();
const AIRTABLE_BASE_ID = String(process.env.AIRTABLE_BASE_ID || "").trim();
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();

    if (!AIRTABLE_PAT) {
      return res.status(500).json({
        error: "Missing AIRTABLE_PAT environment variable."
      });
    }

    if (!AIRTABLE_BASE_ID) {
      return res.status(500).json({
        error: "Missing AIRTABLE_BASE_ID environment variable."
      });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY environment variable."
      });
    }

    function safeText(value) {
      if (value === null || value === undefined) return "";
      if (Array.isArray(value)) return value.join(", ");
      return String(value).trim();
    }

    async function airtableRequest(url) {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          "Content-Type": "application/json"
        }
      });

      const rawText = await response.text();

      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { rawText };
      }

      if (!response.ok) {
        throw new Error(`Airtable ${response.status}: ${rawText}`);
      }

      return data;
    }

    const tableId = "tblzlPlaD5KbnE9XP";
    const formula = encodeURIComponent("{Is Latest Brief}=1");

    const airtableUrl =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}` +
      `?filterByFormula=${formula}` +
      `&sort[0][field]=Brief%20Date` +
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
          "Use only the provided KitchenPulse business context. " +
          "Be direct, concise, and action-oriented. " +
          "Do not sound generic. " +
          "Keep answers tight and useful for a Softr UI. " +
          "Prefer short paragraphs and practical recommendations.",
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

    const openaiRawText = await openaiResponse.text();

    let openaiData;
    try {
      openaiData = JSON.parse(openaiRawText);
    } catch {
      return res.status(500).json({
        error: "OpenAI returned non-JSON output.",
        debug: openaiRawText
      });
    }

    if (!openaiResponse.ok) {
      return res.status(openaiResponse.status).json({
        error: openaiData?.error?.message || "OpenAI request failed",
        debug: openaiData
      });
    }

    let reply = "";

    if (typeof openaiData.output_text === "string" && openaiData.output_text.trim()) {
      reply = openaiData.output_text.trim();
    }

    if (!reply && Array.isArray(openaiData.output)) {
      for (const item of openaiData.output) {
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
        debug: openaiData
      });
    }

    return res.status(200).json({
      reply,
      meta: {
        restaurant,
        runId,
        priority
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
};
