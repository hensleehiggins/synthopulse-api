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
  const MOVEMENT_TABLE_ID = "tblt4IDWrqDL9jg0S";

  function sendJson(status, payload) {
    return res.status(status).json(payload);
  }

  function safeText(value) {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) {
      return value
        .map(v => {
          if (v === null || v === undefined) return "";
          if (typeof v === "string") return v.trim();
          if (typeof v === "object") {
            return String(v.name || v.id || "").trim();
          }
          return String(v).trim();
        })
        .filter(Boolean)
        .join(", ");
    }
    if (typeof value === "object") {
      return String(value.name || value.id || "").trim();
    }
    return String(value).trim();
  }

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
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
      return {
        normalized:
          "Why did today's recommendation surface? Explain the real business signals behind it and what it means operationally.",
        intent: "why"
      };
    }

    if (q === "what should i do first?" || q === "what should i do first") {
      return {
        normalized:
          "What should the operator do first based on today's recommendation? Give the first concrete actions only.",
        intent: "first_action"
      };
    }

    if (q === "what happens if i ignore this?" || q === "what happens if i ignore this") {
      return {
        normalized:
          "What happens if the operator ignores today's recommendation? Explain the downside risk plainly.",
        intent: "ignore_risk"
      };
    }

    if (q === "what else should i watch today?" || q === "what else should i watch today") {
      return {
        normalized:
          "Besides today's recommendation, what else should the operator watch today?",
        intent: "watch"
      };
    }

    return {
      normalized: safeText(message),
      intent: "freeform"
    };
  }

  function parseDecisionJson(rawValue) {
    const raw = safeText(rawValue);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function normalizeMovementRow(fields = {}) {
    return {
      item: safeText(fields["Item"]),
      movementType: safeText(fields["Movement Type"]),
      listType: safeText(fields["List Type"]),
      impactLevel: safeText(fields["Impact Level"]),
      currentQty: safeNumber(fields["Current Qty"]),
      previousQty: safeNumber(fields["Previous Qty"]),
      currentRevenue: safeNumber(fields["Current Revenue"]),
      previousRevenue: safeNumber(fields["Previous Revenue"]),
      notes: safeText(fields["Notes"]),
      currentRunId: safeText(fields["Current Run ID"]),
      previousRunId: safeText(fields["Previous Run ID"])
    };
  }

  function buildMovementSummary(rows = []) {
    if (!rows.length) {
      return {
        topRows: [],
        risks: [],
        opportunities: [],
        summaryText: "No meaningful movement rows were available for the current run."
      };
    }

    const riskTypes = new Set(["Declining", "Dropped from Top", "Dropped to Low", "New Low"]);
    const upsideTypes = new Set(["Rising", "Recovered", "Recovered to Top", "New Top"]);

    const impactRank = { High: 3, Medium: 2, Low: 1, "": 0 };

    const sorted = [...rows].sort((a, b) => {
      const impactDelta = (impactRank[b.impactLevel] || 0) - (impactRank[a.impactLevel] || 0);
      if (impactDelta !== 0) return impactDelta;

      const qtyDelta =
        Math.abs(b.currentQty - b.previousQty) - Math.abs(a.currentQty - a.previousQty);
      if (qtyDelta !== 0) return qtyDelta;

      return b.currentQty - a.currentQty;
    });

    const risks = sorted.filter(r => riskTypes.has(r.movementType)).slice(0, 5);
    const opportunities = sorted.filter(r => upsideTypes.has(r.movementType)).slice(0, 5);
    const topRows = sorted.slice(0, 8);

    const lines = [];

    if (opportunities.length) {
      lines.push(
        `Top opportunities: ${opportunities
          .map(r => `${r.item} (${r.movementType}${r.impactLevel ? `, ${r.impactLevel}` : ""})`)
          .join("; ")}`
      );
    }

    if (risks.length) {
      lines.push(
        `Top risks: ${risks
          .map(r => `${r.item} (${r.movementType}${r.impactLevel ? `, ${r.impactLevel}` : ""})`)
          .join("; ")}`
      );
    }

    if (!lines.length) {
      lines.push(
        `Movement present but mixed: ${topRows
          .map(r => `${r.item} (${r.movementType || "Signal"})`)
          .join("; ")}`
      );
    }

    return {
      topRows,
      risks,
      opportunities,
      summaryText: lines.join("\n")
    };
  }

  function summarizeDecisionPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return {
        text: "No structured decision payload was available.",
        topRisk: null,
        topOpportunity: null
      };
    }

    const lines = [];

    if (safeText(payload.recommendation)) {
      lines.push(`Recommendation: ${safeText(payload.recommendation)}`);
    }

    if (safeText(payload.decisionPriority)) {
      lines.push(`Decision Priority: ${safeText(payload.decisionPriority)}`);
    }

    if (safeText(payload.summary)) {
      lines.push(`Decision Summary: ${safeText(payload.summary)}`);
    }

    if (payload.topOpportunity) {
      lines.push(
        `Top Opportunity: ${safeText(payload.topOpportunity.item)} • ${safeText(payload.topOpportunity.movementType)} • score ${safeNumber(payload.topOpportunity.score)} • est. impact $${Math.round(safeNumber(payload.topOpportunity.estimatedImpact))}`
      );
    }

    if (payload.topRisk) {
      lines.push(
        `Top Risk: ${safeText(payload.topRisk.item)} • ${safeText(payload.topRisk.movementType)} • score ${safeNumber(payload.topRisk.score)} • est. impact $${Math.round(safeNumber(payload.topRisk.estimatedImpact))}`
      );
    }

    const externalFactors = Array.isArray(payload.activeExternalFactors)
      ? payload.activeExternalFactors
      : [];

    if (externalFactors.length) {
      lines.push(
        `External Context: ${externalFactors
          .slice(0, 5)
          .map(f => {
            const type = safeText(f.type) || "Factor";
            const direction = safeText(f.impactDirection);
            const note = safeText(f.decisionNote || f.description);
            return [type, direction, note].filter(Boolean).join(" • ");
          })
          .join(" | ")}`
      );
    }

    return {
      text: lines.join("\n"),
      topRisk: payload.topRisk || null,
      topOpportunity: payload.topOpportunity || null
    };
  }

  function buildIntentGuidance(intent) {
  switch (intent) {

    case "why":
      return `
You must answer ONLY why the recommendation surfaced.

STRICT RULES:
- No actions
- No risk section
- No "what to watch"
- No "bottom line"
- No multiple sections

Return 1–2 short paragraphs explaining the cause only.
`;

    case "do_now":
      return `
You must answer ONLY what to do right now.

STRICT RULES:
- Actions only
- No explanation unless necessary
- No extra sections

Return a short list of actions.
`;

    case "risk":
      return `
You must answer ONLY the real downside risk.

STRICT RULES:
- No actions
- No summary
- No monitoring

Return a concise explanation of the risk.
`;

    case "push":
      return `
You must answer ONLY what should be pushed today.

STRICT RULES:
- Focus on upside only
- No risks
- No monitoring

Return a direct recommendation and why.
`;

    case "next_run":
      return `
You must answer ONLY what to watch next run.

STRICT RULES:
- Monitoring only
- No actions
- No summary

Return 2–4 items to watch.
`;

    default:
      return `
Answer the operator's question directly.

Use structure ONLY if the question clearly requires it.
`;
  }
}

  async function fetchLatestBrief() {
    const formula = encodeURIComponent("{Is Latest Brief}=1");
    const sortField = encodeURIComponent("Brief Date");

    const briefUrl =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${BRIEFS_TABLE_ID}` +
      `?filterByFormula=${formula}` +
      `&sort[0][field]=${sortField}` +
      `&sort[0][direction]=desc` +
      `&maxRecords=1` +
      `&cellFormat=string` +
      `&timeZone=America/New_York` +
      `&userLocale=en`;

    return fetchJsonOrText(briefUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json"
      }
    });
  }

  async function fetchRecentMovementRows() {
    const sortField = encodeURIComponent("Created Time");

    const movementUrl =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${MOVEMENT_TABLE_ID}` +
      `?sort[0][field]=${sortField}` +
      `&sort[0][direction]=desc` +
      `&maxRecords=100` +
      `&cellFormat=string` +
      `&timeZone=America/New_York` +
      `&userLocale=en`;

    return fetchJsonOrText(movementUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json"
      }
    });
  }

  if (req.method === "GET") {
    const briefCheck = await fetchLatestBrief();

    return sendJson(200, {
      status: "ok",
      message: "SynthoPulse API is live.",
      debug: {
        airtable_base_id: AIRTABLE_BASE_ID,
        briefs_table_target: BRIEFS_TABLE_ID,
        movement_table_target: MOVEMENT_TABLE_ID,
        latest_brief_status: briefCheck.status,
        latest_brief_preview: briefCheck.rawText.slice(0, 600)
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

    const { normalized: userQuestion, intent } = normalizeQuestion(rawMessage);

    const briefResult = await fetchLatestBrief();

    if (!briefResult.ok) {
      return sendJson(200, {
        reply: `Airtable latest-brief request failed\n\n${briefResult.rawText}`,
        meta: {
          airtable_status: briefResult.status
        }
      });
    }

    const latestRecord = briefResult.data?.records?.[0];
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

    const actionCallout =
      safeText(fields["Action Callout"]);

    const formattedBrief =
      safeText(fields["Formatted Brief (Display)"]);

    const runId = safeText(fields["Run ID"]);
    const briefDate = safeText(fields["Brief Date"]);
    const decisionSource = safeText(fields["Decision Source"]);
    const decisionJson = parseDecisionJson(fields["Decision JSON"]);
    const decisionSummary = summarizeDecisionPayload(decisionJson);

    const movementResult = await fetchRecentMovementRows();

    let currentRunMovement = [];
    let movementSummary = {
      topRows: [],
      risks: [],
      opportunities: [],
      summaryText: "Movement rows were not available."
    };

    if (movementResult.ok) {
      const rawMovementRecords = Array.isArray(movementResult.data?.records)
        ? movementResult.data.records
        : [];

      currentRunMovement = rawMovementRecords
        .map(record => normalizeMovementRow(record.fields || {}))
        .filter(row => {
          if (!row.item) return false;
          if (!runId) return false;
          return row.currentRunId.includes(runId);
        });

      movementSummary = buildMovementSummary(currentRunMovement);
    }

    const context = `
KitchenPulse Live Context

Restaurant: ${restaurant || "Unknown"}
Run ID: ${runId || "Unknown"}
Brief Date: ${briefDate || "Unknown"}
Decision Source: ${decisionSource || "Unknown"}

Today's Recommendation:
${recommendation || "No recommendation available"}

Decision Priority:
${priority || "Unknown"}

Action Callout:
${actionCallout || "Not available"}

Summary:
${summary || "No summary available"}

Decision Payload Summary:
${decisionSummary.text || "No structured decision payload available."}

Formatted Brief:
${formattedBrief || "Not available"}

Movement Summary:
${movementSummary.summaryText || "Not available"}
`.trim();

    const movementEvidenceBlock = currentRunMovement.length
      ? currentRunMovement
          .slice(0, 8)
          .map(row => {
            const delta = row.currentQty - row.previousQty;
            const deltaText =
              Number.isFinite(delta) ? `qty delta ${delta >= 0 ? "+" : ""}${delta}` : "";

            return [
              row.item,
              row.movementType,
              row.listType,
              row.impactLevel,
              deltaText,
              row.notes
            ]
              .filter(Boolean)
              .join(" • ");
          })
          .join("\n")
      : "No current-run movement evidence available.";

    const instructionText = [
  "You are SynthoPulse, an operator copilot for restaurant owners and managers inside KitchenPulse.",
  "You are not a generic assistant and not a consultant.",

  "Assume references like 'this' mean today's recommendation shown on the dashboard.",

  "Use only the provided KitchenPulse context and movement evidence.",
  "Do not invent menu items, weather concerns, traffic patterns, or business signals that are not present.",

  "Be direct, commercially aware, and action-oriented.",

  "CRITICAL RESPONSE RULE:",
  "Keep answers tight. Default to 2–4 sentences unless the question clearly requires more.",
  "You MUST strictly follow the intent-specific instructions below.",
  "You are NOT allowed to expand beyond the requested scope.",
  "If the user asks a narrow question, your answer MUST be narrow.",
  "Do NOT include multiple sections unless explicitly required.",
  "Do NOT default to a full report format.",

  buildIntentGuidance(intent)
].join(" ");

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
          instructions: instructionText,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text:
                    `KitchenPulse Context:\n${context}\n\n` +
                    `Movement Evidence:\n${movementEvidenceBlock}\n\n` +
                    `Operator Question:\n${userQuestion}`
                }
              ]
            }
          ],
          max_output_tokens: 700
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
        intent,
        restaurant,
        runId,
        priority,
        recommendation,
        movement_rows_used: currentRunMovement.length,
        used_decision_json: !!decisionJson
      }
    });
  } catch (err) {
    return sendJson(500, {
      error: "Server error",
      details: err.message
    });
  }
};
