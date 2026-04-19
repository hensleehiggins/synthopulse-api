module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const AIRTABLE_PAT = String(process.env.AIRTABLE_PAT || "").trim();
  const AIRTABLE_BASE_ID = String(process.env.AIRTABLE_BASE_ID || "").trim();
  const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();

  const BRIEFS_TABLE_ID = "tblzlPlaD5KbnE9XP";

  function sendJson(status, payload) {
    return res.status(status).json(payload);
  }

  async function fetchJsonOrText(url, options = {}) {
    try {
      const response = await fetch(url, options);
      const rawText = await response.text();

      let data = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }

      return {
        ok: response.ok,
        status: response.status,
        data,
        rawText
      };
    } catch (err) {
      return {
        ok: false,
        status: "fetch_failed",
        data: null,
        rawText: err.message
      };
    }
  }

  function safeText(value) {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.join(", ");
    return String(value).trim();
  }

function extractOpenAIText(payload) {
  if (!payload) return "";

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (Array.isArray(payload.output)) {
    let collected = [];

    for (const item of payload.output) {
      if (!item) continue;

      if (typeof item.text === "string" && item.text.trim()) {
        collected.push(item.text.trim());
      }

      if (Array.isArray(item.content)) {
        for (const part of item.content) {
          if (!part) continue;

          if (typeof part.text === "string" && part.text.trim()) {
            collected.push(part.text.trim());
          }

          if (
            part.text &&
            typeof part.text === "object" &&
            typeof part.text.value === "string" &&
            part.text.value.trim()
          ) {
            collected.push(part.text.value.trim());
          }
        }
      }
    }

    return collected.join("\n").trim();
  }

  return "";
}



  if (req.method === "GET") {
    const envOk = Boolean(AIRTABLE_PAT && AIRTABLE_BASE_ID && OPENAI_API_KEY);

    let airtableSchemaCheck = null;
    let airtableRecordsCheck = null;

    if (AIRTABLE_PAT && AIRTABLE_BASE_ID) {
      const schemaUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;

      const schemaResult = await fetchJsonOrText(schemaUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          "Content-Type": "application/json"
        }
      });

      airtableSchemaCheck = {
        ok: schemaResult.ok,
        status: schemaResult.status,
        body_preview: schemaResult.rawText.slice(0, 200)
      };

      const recordsUrl =
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${BRIEFS_TABLE_ID}` +
        `?maxRecords=1&cellFormat=string&timeZone=America%2FNew_York&userLocale=en`;

      const recordsResult = await fetchJsonOrText(recordsUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          "Content-Type": "application/json"
        }
      });

      airtableRecordsCheck = {
        ok: recordsResult.ok,
        status: recordsResult.status,
        body_preview: recordsResult.rawText.slice(0, 200)
      };
    }

    return sendJson(200, {
      status: "ok",
      message: "SynthoPulse API is live.",
      health: {
        env_ok: envOk,
        airtable_schema_ok: Boolean(airtableSchemaCheck?.ok),
        airtable_records_ok: Boolean(airtableRecordsCheck?.ok),
        openai_key_present: Boolean(OPENAI_API_KEY)
      },
      checks: {
        airtable_schema: airtableSchemaCheck,
        airtable_records: airtableRecordsCheck
      }
    });
  }

  if (req.method !== "POST") {
    return sendJson(405, { error: "Method not allowed. Use POST." });
  }

  if (!AIRTABLE_PAT) {
    return sendJson(500, { error: "Missing AIRTABLE_PAT environment variable." });
  }

  if (!AIRTABLE_BASE_ID) {
    return sendJson(500, { error: "Missing AIRTABLE_BASE_ID environment variable." });
  }

  if (!OPENAI_API_KEY) {
    return sendJson(500, { error: "Missing OPENAI_API_KEY environment variable." });
  }

  try {
    const body = req.body || {};
    const message = safeText(body.message);

    if (!message) {
      return sendJson(400, { error: "Missing message" });
    }

    const formula = encodeURIComponent("{Is Latest Brief}=1");

    const briefUrl =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${BRIEFS_TABLE_ID}` +
      `?filterByFormula=${formula}` +
      `&sort[0][field]=Brief%20Date` +
      `&sort[0][direction]=desc` +
      `&maxRecords=1` +
      `&cellFormat=string&timeZone=America%2FNew_York&userLocale=en`;

    const airtableResult = await fetchJsonOrText(briefUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json"
      }
    });

    if (!airtableResult.ok) {
      return sendJson(500, {
        error: "Airtable error",
        status: airtableResult.status,
        body: airtableResult.rawText
      });
    }

    const latestBrief = airtableResult.data?.records?.[0];

    if (!latestBrief) {
      return sendJson(404, {
        error: "No latest Forecasts & Insights brief found."
      });
    }

    const fields = latestBrief.fields || {};

    const restaurant = safeText(fields["Restaurant"]);
    const runId = safeText(fields["Run ID"]);
    const summary = safeText(fields["Summary"]);
    const priority = safeText(fields["Decision Priority"]);
    const decisionDisplay = safeText(fields["Decision Display"]);
    const actionCallout = safeText(fields["Action Callout"]);
    const quickWhy = safeText(fields["Quick - Why"]);
    const quickFirstAction = safeText(fields["Quick - First Action"]);
    const quickIgnoreRisk = safeText(fields["Quick - Ignore Risk"]);
    const quickWatch = safeText(fields["Quick - Watch"]);

    const context = `
Restaurant: ${restaurant || "Unknown restaurant"}
Run ID: ${runId || "Unknown run"}

Today's Recommendation:
${decisionDisplay || "No recommendation available."}

Decision Priority:
${priority || "Unknown"}

Summary:
${summary || "No summary available."}

Action Callout:
${actionCallout || "No action callout available."}

Quick Why:
${quickWhy || "N/A"}

Quick First Action:
${quickFirstAction || "N/A"}

Quick Ignore Risk:
${quickIgnoreRisk || "N/A"}

Quick Watch:
${quickWatch || "N/A"}
`.trim();

    const openaiResult = await fetchJsonOrText("https://api.openai.com/v1/responses", {
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
          "Keep answers tight for a dashboard UI. " +
          "Prioritize what to do next over theory.",
        input: `Business Context:\n${context}\n\nUser Question:\n${message}`,
        max_output_tokens: 180
      })
    });

    if (!openaiResult.ok) {
      return sendJson(
        typeof openaiResult.status === "number" ? openaiResult.status : 500,
        {
          error: openaiResult.data?.error?.message || "OpenAI request failed",
          body: openaiResult.rawText
        }
      );
    }

    const reply = extractOpenAIText(openaiResult.data);

if (!reply) {
  return sendJson(200, {
    reply: "SynthoPulse returned no readable text.",
    meta: {
      restaurant,
      runId,
      priority
    },
    debug_openai_json: JSON.stringify(openaiResult.data, null, 2)
  });
}

    return sendJson(200, {
      reply,
      meta: {
        restaurant,
        runId,
        priority
      }
    });
  } catch (error) {
    return sendJson(500, {
      error: error.message || "Server error"
    });
  }
};
