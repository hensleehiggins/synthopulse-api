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

    if (!Array.isArray(payload.output)) return "";

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

  function normalizeQuestion(message) {
    const q = safeText(message).toLowerCase();

    if (q === "why this?" || q === "why this") {
      return "Explain why today's recommendation surfaced, what signals likely drove it, and what it means operationally.";
    }

    if (q === "what should i do first?" || q === "what should i do first") {
      return "What should the operator do first based on today's recommendation? Give the first concrete actions only.";
    }

    if (q === "what happens if i ignore this?" || q === "what happens if i ignore this") {
      return "What happens if the operator ignores today's recommendation? Explain downside risk plainly.";
    }

    if (q === "what else should i watch today?" || q === "what else should i watch today") {
      return "Besides today's recommendation, what else should the operator watch today?";
    }

    return safeText(message);
  }

  if (req.method === "GET") {
    const metaUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;

    const recordsUrl =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(BRIEFS_TABLE_ID)}` +
      `?maxRecords=1&cellFormat=string&timeZone=America/New_York&userLocale=en`;

    const metaCheck = await fetchJsonOrText(metaUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json"
      }
    });

    const recordsCheck = await fetchJsonOrText(recordsUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json"
      }
    });

    return sendJson(200, {
      status: "ok",
      message: "SynthoPulse API is live.",
      debug: {
        airtable_pat_prefix: AIRTABLE_PAT ? AIRTABLE_PAT.slice(0, 8) : null,
        airtable_base_id: AIRTABLE_BASE_ID,
        briefs_table_target: BRIEFS_TABLE_ID,
        meta_status: metaCheck.status,
        meta_preview: metaCheck.rawText.slice(0, 500),
        records_status: recordsCheck.status,
        records_preview: recordsCheck.rawText.slice(0, 500)
      }
    });
  }

  if (req.method !== "POST") {
    return sendJson(405, { error: "Method not allowed. Use POST." });
  }

  try {
    const body = req.body || {};
    const rawMessage = safeText(body.message);

    if (!rawMessage) {
      return sendJson(400, { error: "Missing message" });
    }

    const userQuestion = normalizeQuestion(rawMessage);

    const briefUrl =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${BRIEFS_TABLE_ID}` +
      `?maxRecords=1&cellFormat=string&timeZone=America/New_York&userLocale=en`;

    const airtableResult = await fetchJsonOrText(briefUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json"
      }
    });

    if (!airtableResult.ok) {
      return sendJson(200, {
        reply: `Airtable request failed\n\n${airtableResult.rawText}`,
        meta: {
          airtable_status: airtableResult.status
        }
      });
    }

    const latestRecord = airtableResult.data?.records?.[0];
    const fields = latestRecord?.fields || {};

    const restaurant =
      safeText(fields["Restaurant"]) ||
      safeText(fields["Restaurant Name"]);

    const recommendation =
      safeText(fields["Decision Display"]) ||
      safeText(fields["Recommendation"]) ||
      safeText(fields["Action Callout"]) ||
      safeText(fields["Name"]);

    const priority =
      safeText(fields["Decision Priority"]) ||
      safeText(fields["Priority"]);

    const summary =
      safeText(fields["Summary"]) ||
      safeText(fields["Brief Summary"]);

    const why =
      safeText(fields["Quick - Why"]) ||
      safeText(fields["Why This Surfaced"]);

    const firstAction =
      safeText(fields["Quick - First Action"]) ||
      safeText(fields["First Action"]);

    const ignoreRisk =
      safeText(fields["Quick - Ignore Risk"]) ||
      safeText(fields["Ignore Risk"]);

    const watch =
      safeText(fields["Quick - Watch"]) ||
      safeText(fields["Watch Today"]);

    const runId = safeText(fields["Run ID"]);
    const briefDate = safeText(fields["Brief Date"]);

    const context = `
KitchenPulse Context

Restaurant: ${restaurant || "Unknown"}
Run ID: ${runId || "Unknown"}
Brief Date: ${briefDate || "Unknown"}

Today's Recommendation:
${recommendation || "No recommendation available"}

Priority:
${priority || "Unknown"}

Summary:
${summary || "No summary available"}

Why This Surfaced:
${why || "Not available"}

First Action:
${firstAction || "Not available"}

Ignore Risk:
${ignoreRisk || "Not available"}

Watch Today:
${watch || "Not available"}
`.trim();

    const openaiResult = await fetchJsonOrText(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          instructions:
            "You are SynthoPulse, an operator copilot for restaurant owners and managers. " +
            "You are answering inside KitchenPulse. " +
            "Assume references like 'this' mean today's recommendation shown on the dashboard. " +
            "Use only the provided KitchenPulse context. " +
            "Be direct, concise, and action-oriented. " +
            "Do not ask for more context unless the provided context is actually missing critical data. " +
            "Prefer this structure when possible: Bottom line, Why this surfaced, What to do now, Risk if ignored, What else to watch. " +
            "Keep it tight enough for a dashboard response box.",
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text:
                    `KitchenPulse Context:\n${context}\n\n` +
                    `Operator Question:\n${userQuestion}`
                }
              ]
            }
          ],
          max_output_tokens: 500
        })
      }
    );

    if (!openaiResult.ok) {
      return sendJson(200, {
        reply: `OpenAI request failed\n\n${openaiResult.rawText}`,
        meta: {
          openai_status: openaiResult.status
        }
      });
    }

    const reply = extractOpenAIText(openaiResult.data);

    if (!reply) {
      return sendJson(200, {
        reply: "OpenAI returned no readable response.",
        meta: {
          openai_status: openaiResult.status,
          openai_raw: openaiResult.rawText.slice(0, 800)
        }
      });
    }

    return sendJson(200, {
      reply,
      meta: {
        restaurant,
        recommendation,
        priority
      }
    });
  } catch (err) {
    return sendJson(500, {
      error: "Server error",
      details: err.message
    });
  }
};
