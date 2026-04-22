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
  const q = safeText(message).toLowerCase().trim();

  if (
    q === "why this?" ||
    q === "why this" ||
    q === "why did this surface?" ||
    q === "why did this surface"
  ) {
    return {
      normalized:
        "Why did today's recommendation surface? Explain only the strongest 1 to 3 business signals behind it. Do not generalize. Do not give advice. Do not broaden into strategy.",
      intent: "why"
    };
  }

  if (
    q === "what should i do first?" ||
    q === "what should i do first" ||
    q === "what should i do right now?" ||
    q === "what should i do right now"
  ) {
    return {
      normalized:
        "What should the operator do first based on today's recommendation? Give only the most immediate actions for this shift. Prefer concrete execution steps over monitoring language.",
      intent: "first_action"
    };
  }

  if (
    q === "what happens if i ignore this?" ||
    q === "what happens if i ignore this" ||
    q === "what's the real risk?" ||
    q === "whats the real risk?" ||
    q === "what is the real risk?" ||
    q === "what is the real risk"
  ) {
    return {
      normalized:
        "What is the single biggest downside risk if the operator ignores today's recommendation? Answer only that risk.",
      intent: "ignore_risk"
    };
  }

  if (
    q === "what else should i watch today?" ||
    q === "what else should i watch today" ||
    q === "what should i watch today?" ||
    q === "what should i watch today"
  ) {
    return {
      normalized:
        "Besides today's recommendation, what else should the operator watch today?",
      intent: "watch"
    };
  }

  if (
    q === "what should i push today?" ||
    q === "what should i push today"
  ) {
    return {
      normalized:
        "What is the clearest item or category the operator should push today? Answer only with the best push play based on today's signals.",
      intent: "push"
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
  return [
    "Answer only why the recommendation surfaced.",
    "Use only the strongest live signals.",
    "Do not generalize.",
    "Do not give actions.",
    "Do not give strategy.",
    "Do not include a conclusion or wrap-up sentence.",
    "Keep it to 2 short paragraphs max."
  ].join(" ");
        case "push":
          return [
          "Answer only what should be pushed today.",
          "Focus on the clearest upside play.",
          "If no real upside signal exists, say that directly.",
          "Do not include a full report.",
          "Keep it short and grounded in live signals."
        ].join(" ");

      case "first_action":
  return [
    "Answer only what the operator should do first.",
    "Return only the top 2 or 3 immediate actions.",
    "Use concrete shift-level actions.",
    "Do not include monitoring, reassessment, or contingency steps unless they are the main action.",
    "Do not include a full report format."
  ].join(" ");

     case "ignore_risk":
  return [
    "Answer only the real downside risk.",
    "Do not include bottom line, why this surfaced, actions, or watch items.",
    "Return 1 short paragraph only.",
    "Focus on the most likely business consequence if the recommendation is ignored."
  ].join(" ");

      case "watch":
        return [
          "Answer only what else the operator should watch today beyond the main recommendation.",
          "Focus on secondary risks, emerging upside, or context shifts.",
          "Do not restate the full main recommendation.",
          "Keep it tight and grounded."
        ].join(" ");

      default:
        return [
          "When the operator asks a broad or freeform question, use this exact structure:",
          "Bottom line:",
          "Why this surfaced:",
          "What to do now:",
          "Risk if ignored:",
          "What else to watch:",
          "Keep each section short.",
          "Prioritize risk over upside when signals are mixed.",
          "Do not invent facts or generic restaurant advice."
        ].join(" ");
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
      "You are SynthoPulse, the operator copilot inside KitchenPulse.",
      "Your job is to help a restaurant owner or manager interpret today's decision and act on it.",
      "You are not a generic assistant.",
      "You are not a consultant.",
      "Use only the KitchenPulse data provided in this request.",
      "Do not invent items, trends, weather pressure, event pressure, or business signals.",
      "If evidence is weak or missing, say that directly.",
      "Treat references like 'this' or 'today' as today's current KitchenPulse recommendation.",
      "Be direct, operator-focused, commercially aware, and action-oriented.",
      "Avoid fluff, theory, motivational language, and generic restaurant advice.",
      "Prefer plain business language.",
      "Keep answers tight.",
      "Default to 2 to 5 sentences unless the question clearly needs a little more.",
      "For broad questions, prioritize this order: recommendation first, then movement, then external context, then what to do.",
      "When signals are mixed, prioritize downside protection over upside chasing.",
      "Never hallucinate menu items or operational conditions.",
      buildIntentGuidance(intent)
    ].join(" ");

    const userPrompt = `
TODAY'S DECISION
${recommendation || "No recommendation available."}

DECISION PRIORITY
${priority || "Unknown"}

ACTION CALLOUT
${actionCallout || "Not available."}

SUMMARY
${summary || "No summary available."}

STRUCTURED DECISION SIGNALS
${decisionSummary.text || "No structured decision payload available."}

MOVEMENT SUMMARY
${movementSummary.summaryText || "No movement summary available."}

TOP RISKS
${
  movementSummary.risks.length
    ? movementSummary.risks
        .map(r =>
          `${r.item} | ${r.movementType} | ${r.impactLevel || "No impact level"} | current qty ${r.currentQty} | previous qty ${r.previousQty}`
        )
        .join("\n")
    : "None"
}

TOP OPPORTUNITIES
${
  movementSummary.opportunities.length
    ? movementSummary.opportunities
        .map(r =>
          `${r.item} | ${r.movementType} | ${r.impactLevel || "No impact level"} | current qty ${r.currentQty} | previous qty ${r.previousQty}`
        )
        .join("\n")
    : "None"
}

MOVEMENT EVIDENCE
${movementEvidenceBlock}

FULL CONTEXT
${context}

OPERATOR QUESTION
${userQuestion}
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
          instructions: instructionText,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: userPrompt
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
