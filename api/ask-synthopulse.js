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

  const BRIEFS_TABLE_ID = "tblz1PlaD5KbnE9XP";

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

  function extractOpenAIText(payload) {
    if (!payload) return "";

    if (typeof payload.output_text === "string" && payload.output_text.trim()) {
      return payload.output_text.trim();
    }

    if (!Array.isArray(payload.output)) {
      return "";
    }

    const collected = [];

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

  if (req.method === "GET") {
    const recordsUrl =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${BRIEFS_TABLE_ID}` +
      `?maxRecords=1&cellFormat=string&timeZone=America/New_York&userLocale=en`;

    const airtableCheck = await fetchJsonOrText(recordsUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json"
      }
    });

    return sendJson(200, {
      status: "ok",
      message: "SynthoPulse API is live.",
      health: {
        env_ok: Boolean(AIRTABLE_PAT && AIRTABLE_BASE_ID && OPENAI_API_KEY),
        airtable_records_ok: airtableCheck.ok,
        openai_key_present: Boolean(OPENAI_API_KEY)
      },
      debug: {
        airtable_status: airtableCheck.status,
        airtable_preview: airtableCheck.rawText.slice(0, 200)
      }
    });
  }

  if (req.method !== "POST") {
    return sendJson(405, { error: "Method not allowed. Use POST." });
  }

  try {
    const body = req.body || {};
    const message = String(body.message || "").trim();

    if (!message) {
      return sendJson(400, { error: "Missing message" });
    }

    const recordsUrl =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${BRIEFS_TABLE_ID}` +
      `?maxRecords=3&cellFormat=string&timeZone=America/New_York&userLocale=en`;

    const airtableResult = await fetchJsonOrText(recordsUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json"
      }
    });

    let context = "No data available.";

    if (airtableResult.data?.records?.length) {
      context = airtableResult.data.records
        .map((r) => JSON.stringify(r.fields))
        .join("\n");
    }

    const openaiResult = await fetchJsonOrText(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-5",
          reasoning: { effort: "low" },
          instructions:
            "You are SynthoPulse, an operator copilot for restaurant owners and managers. " +
            "Use only the provided KitchenPulse business context. " +
            "Be direct and action-oriented. " +
            "Prioritize what to do next. " +
            "Keep the answer short and practical.",
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text:
                    `Business Context:\n${context}\n\n` +
                    `User Question:\n${message}`
                }
              ]
            }
          ],
          max_output_tokens: 600
        })
      }
    );

    if (!openaiResult.ok) {
      return sendJson(500, {
        error: "OpenAI request failed",
        details: openaiResult.rawText
      });
    }

    const reply = extractOpenAIText(openaiResult.data);

    if (!reply) {
      return sendJson(500, {
        error: "No readable response from OpenAI",
        debug: openaiResult.data
      });
    }

    return sendJson(200, {
      reply,
      meta: {
        airtable_records: airtableResult.data?.records?.length || 0
      }
    });
  } catch (err) {
    return sendJson(500, {
      error: "Server error",
      details: err.message
    });
  }
};
