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
  const EXTERNAL_FACTORS_TABLE_ID = "tbl73d4esGTQcHg6c";
  const DAILY_SALES_TABLE_ID = "tbl2FbE1R7b2QesQE";
  const MENU_ITEMS_TABLE_ID = "tblD56pucadUQj7TY";

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
          if (typeof v === "object") return String(v.name || v.id || "").trim();
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
      currentRunId: safeText(fields["Current Run ID"])
    };
  }

  function summarizeMovement(rows = []) {
    if (!rows.length) {
      return {
        summaryText: "No current-run movement rows available.",
        topRisks: [],
        topUpside: []
      };
    }

    const riskTypes = new Set(["Declining", "Dropped from Top", "Dropped to Low", "New Low"]);
    const upsideTypes = new Set(["Rising", "Recovered", "Recovered to Top", "New Top"]);
    const impactRank = { High: 3, Medium: 2, Low: 1, "": 0 };

    const sorted = [...rows].sort((a, b) => {
      const impactDelta = (impactRank[b.impactLevel] || 0) - (impactRank[a.impactLevel] || 0);
      if (impactDelta !== 0) return impactDelta;

      const aDelta = Math.abs(a.currentQty - a.previousQty);
      const bDelta = Math.abs(b.currentQty - b.previousQty);
      return bDelta - aDelta;
    });

    const topRisks = sorted.filter(r => riskTypes.has(r.movementType)).slice(0, 5);
    const topUpside = sorted.filter(r => upsideTypes.has(r.movementType)).slice(0, 5);

    const lines = [];
    if (topUpside.length) {
      lines.push(
        `Upside signals: ${topUpside.map(r => `${r.item} (${r.movementType}${r.impactLevel ? `, ${r.impactLevel}` : ""})`).join("; ")}`
      );
    }
    if (topRisks.length) {
      lines.push(
        `Risk signals: ${topRisks.map(r => `${r.item} (${r.movementType}${r.impactLevel ? `, ${r.impactLevel}` : ""})`).join("; ")}`
      );
    }
    if (!lines.length) {
      lines.push(
        `Mixed movement: ${sorted.slice(0, 6).map(r => `${r.item} (${r.movementType || "Signal"})`).join("; ")}`
      );
    }

    return {
      summaryText: lines.join("\n"),
      topRisks,
      topUpside
    };
  }

  function summarizeExternalFactors(rows = [], restaurantName = "") {
    const filtered = rows
      .filter(r => {
        const isActive = safeText(r["Active"]).toLowerCase() === "true";
        const restaurant = safeText(r["Restaurant"]);
        return isActive && (!restaurantName || restaurant.includes(restaurantName));
      })
      .slice(0, 12);

    if (!filtered.length) {
      return "No active external factors available.";
    }

    return filtered.map(r => {
      const type = safeText(r["Type"]);
      const desc = safeText(r["Description"]);
      const note = safeText(r["Decision Note"]) || safeText(r["Notes"]);
      const direction = safeText(r["Impact Direction"]);
      const strength = safeText(r["Impact Strength"]);
      return [type, direction && `impact ${direction}`, strength && `strength ${strength}`, desc, note]
        .filter(Boolean)
        .join(" • ");
    }).join("\n");
  }

  function summarizeSales(rows = [], restaurantName = "") {
    const filtered = rows.filter(r => {
      const restaurant = safeText(r["Restaurant"]);
      return !restaurantName || restaurant.includes(restaurantName);
    });

    if (!filtered.length) {
      return "No recent sales rows available.";
    }

    const byItem = new Map();
    const byClass = new Map();
    const dates = new Set();

    for (const r of filtered) {
      const item = safeText(r["Item"]);
      const revenueClass = safeText(r["Revenue Class"]) || "Unknown";
      const qty = safeNumber(r["Qty"]);
      const sales = safeNumber(r["Net Sales"]);
      const date = safeText(r["Date"]);

      if (date) dates.add(date);

      if (item) {
        if (!byItem.has(item)) byItem.set(item, { qty: 0, sales: 0 });
        byItem.get(item).qty += qty;
        byItem.get(item).sales += sales;
      }

      if (!byClass.has(revenueClass)) byClass.set(revenueClass, { qty: 0, sales: 0 });
      byClass.get(revenueClass).qty += qty;
      byClass.get(revenueClass).sales += sales;
    }

    const topItems = [...byItem.entries()]
      .sort((a, b) => b[1].sales - a[1].sales)
      .slice(0, 8)
      .map(([name, v]) => `${name} ($${Math.round(v.sales)}, qty ${Math.round(v.qty)})`);

    const topClasses = [...byClass.entries()]
      .sort((a, b) => b[1].sales - a[1].sales)
      .slice(0, 6)
      .map(([name, v]) => `${name} ($${Math.round(v.sales)})`);

    const totalSales = filtered.reduce((sum, r) => sum + safeNumber(r["Net Sales"]), 0);
    const totalQty = filtered.reduce((sum, r) => sum + safeNumber(r["Qty"]), 0);

    return [
      `Recent sales rows analyzed: ${filtered.length}`,
      `Dates represented: ${[...dates].slice(0, 5).join(", ") || "Unknown"}`,
      `Total net sales in sample: $${Math.round(totalSales)}`,
      `Total quantity in sample: ${Math.round(totalQty)}`,
      `Top items by sales: ${topItems.join("; ") || "None"}`,
      `Top revenue classes: ${topClasses.join("; ") || "None"}`
    ].join("\n");
  }

  function summarizeMenuItems(rows = [], restaurantName = "") {
    const filtered = rows.filter(r => {
      const restaurant = safeText(r["Restaurant"]);
      return !restaurantName || restaurant.includes(restaurantName);
    });

    if (!filtered.length) {
      return "No menu-item context available.";
    }

    const topMargin = filtered
      .filter(r => safeText(r["Decision Eligible"]).toLowerCase() === "true")
      .map(r => ({
        item: safeText(r["Item Name"]),
        price: safeNumber(r["Price"]),
        cost: safeNumber(r["Estimated Unit Cost"]),
        margin: safeNumber(r["Estimated Margin $"])
      }))
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 8);

    if (!topMargin.length) {
      return "No decision-eligible menu items with usable margin data.";
    }

    return `Top decision-eligible margin items: ${topMargin
      .map(x => `${x.item} (margin ~$${Math.round(x.margin)}, price $${Math.round(x.price)})`)
      .join("; ")}`;
  }

  async function airtableGet(tableId, params = "") {
    const url =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}` +
      `?cellFormat=string&timeZone=America/New_York&userLocale=en${params ? `&${params}` : ""}`;

    return fetchJsonOrText(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json"
      }
    });
  }

if (req.method === "GET") {
  try {
    const briefResult = await airtableGet(
      BRIEFS_TABLE_ID,
      `filterByFormula=${encodeURIComponent("{Is Latest Brief}=1")}&sort[0][field]=${encodeURIComponent("Brief Date")}&sort[0][direction]=desc&maxRecords=1`
    );

    const latestBrief = briefResult.ok ? briefResult.data?.records?.[0] : null;
    const briefFields = latestBrief?.fields || {};

    const recommendation = safeText(briefFields["Decision Display"]);
    const actionCallout = safeText(briefFields["Action Callout"]);
    const priority = safeText(briefFields["Decision Priority"]);
    const restaurantName = safeText(briefFields["Restaurant"]);

    const decisionPayload = parseDecisionJson(briefFields["Decision JSON"]);
    const topOpportunity = safeText(decisionPayload?.topOpportunity?.item);
    const topRisk = safeText(decisionPayload?.topRisk?.item);

    let opener = "Ask me what to push today, what’s at risk, or what changed since last run.";

    if (topOpportunity || topRisk) {
      opener =
        `Biggest opportunity right now: ${topOpportunity || "not clearly identified yet"}. ` +
        `Biggest risk: ${topRisk || "not clearly identified yet"}. ` +
        `Ask me what to push, what’s at risk, or how to play tonight.`;
    } else if (recommendation || actionCallout) {
      opener =
        `${restaurantName ? restaurantName + " — " : ""}` +
        `${actionCallout || recommendation}. ` +
        `Ask me what to push, what’s at risk, or how to play tonight.`;
    }

    return sendJson(200, {
      status: "ok",
      opener,
      recommendation,
      actionCallout,
      priority,
      restaurant: restaurantName
    });
  } catch (err) {
    return sendJson(200, {
      status: "ok",
      opener: "Ask me what to push today, what’s at risk, or what changed since last run."
    });
  }
}

  if (req.method !== "POST") {
    return sendJson(405, { error: "Method not allowed. Use POST." });
  }

  try {
    const body = req.body || {};
const rawMessage = safeText(body.message);
const history = Array.isArray(body.history) ? body.history : [];

if (!rawMessage) {
  return sendJson(400, { error: "Missing message" });
}

    const briefResult = await airtableGet(
      BRIEFS_TABLE_ID,
      `filterByFormula=${encodeURIComponent("{Is Latest Brief}=1")}&sort[0][field]=${encodeURIComponent("Brief Date")}&sort[0][direction]=desc&maxRecords=1`
    );

    if (!briefResult.ok) {
      return sendJson(200, {
        reply: `Latest brief request failed\n\n${briefResult.rawText}`
      });
    }

    const latestBrief = briefResult.data?.records?.[0];
    const briefFields = latestBrief?.fields || {};

    const restaurantName = safeText(briefFields["Restaurant"]);
    const runId = safeText(briefFields["Run ID"]);
    const recommendation = safeText(briefFields["Decision Display"]);
    const priority = safeText(briefFields["Decision Priority"]);
    const summary = safeText(briefFields["Summary"]);
    const actionCallout = safeText(briefFields["Action Callout"]);
    const formattedBrief = safeText(briefFields["Formatted Brief (Display)"]);
    const decisionPayload = parseDecisionJson(briefFields["Decision JSON"]);

    const [
      movementResult,
      externalFactorsResult,
      salesResult,
      menuItemsResult
    ] = await Promise.all([
      airtableGet(
        MOVEMENT_TABLE_ID,
        `sort[0][field]=${encodeURIComponent("Created Time")}&sort[0][direction]=desc&maxRecords=100`
      ),
      airtableGet(
        EXTERNAL_FACTORS_TABLE_ID,
        `sort[0][field]=${encodeURIComponent("Display Date")}&sort[0][direction]=desc&maxRecords=50`
      ),
      airtableGet(
        DAILY_SALES_TABLE_ID,
        `sort[0][field]=${encodeURIComponent("Date")}&sort[0][direction]=desc&maxRecords=200`
      ),
      airtableGet(
        MENU_ITEMS_TABLE_ID,
        `maxRecords=200`
      )
    ]);

    const movementRows = movementResult.ok
      ? (movementResult.data?.records || [])
          .map(r => normalizeMovementRow(r.fields || {}))
          .filter(r => r.item && (!runId || r.currentRunId.includes(runId)))
      : [];

    const movementSummary = summarizeMovement(movementRows);

    const externalFactorsSummary = externalFactorsResult.ok
      ? summarizeExternalFactors(
          (externalFactorsResult.data?.records || []).map(r => r.fields || {}),
          restaurantName
        )
      : "External factors unavailable.";

    const salesSummary = salesResult.ok
      ? summarizeSales(
          (salesResult.data?.records || []).map(r => r.fields || {}),
          restaurantName
        )
      : "Recent sales unavailable.";

    const menuSummary = menuItemsResult.ok
      ? summarizeMenuItems(
          (menuItemsResult.data?.records || []).map(r => r.fields || {}),
          restaurantName
        )
      : "Menu item context unavailable.";

    const decisionPayloadSummary = decisionPayload
      ? JSON.stringify(decisionPayload, null, 2)
      : "No structured decision payload available.";

    const movementEvidenceBlock = movementRows.length
      ? movementRows.slice(0, 10).map(row => {
          const delta = row.currentQty - row.previousQty;
          return [
            row.item,
            row.movementType,
            row.listType,
            row.impactLevel,
            `qty ${row.previousQty} → ${row.currentQty}`,
            `delta ${delta >= 0 ? "+" : ""}${delta}`,
            row.notes
          ].filter(Boolean).join(" • ");
        }).join("\n")
      : "No current-run movement evidence available.";

    const context = `
KitchenPulse Multi-Table Context

Restaurant: ${restaurantName || "Unknown"}
Run ID: ${runId || "Unknown"}

Latest Recommendation:
${recommendation || "None"}

Decision Priority:
${priority || "Unknown"}

Action Callout:
${actionCallout || "None"}

Brief Summary:
${summary || "None"}

Formatted Brief:
${formattedBrief || "None"}

Movement Summary:
${movementSummary.summaryText}

Movement Evidence:
${movementEvidenceBlock}

External Factors:
${externalFactorsSummary}

Recent Sales Summary:
${salesSummary}

Menu Economics Summary:
${menuSummary}

Decision Payload:
${decisionPayloadSummary}
`.trim();

const instructionText = `
You are Ask AI inside KitchenPulse, an elite operator copilot for restaurant owners.

You think like a sharp, experienced operator who has seen these patterns before.

STYLE:
- Be direct, concise, and confident
- No markdown, no sections
- Keep responses tight (3–5 sentences most of the time)
- Write like you're talking to a GM in real time
- Avoid phrases like "you should consider" or "you might want to"
- Prefer decisive language: "lean into", "push", "avoid", "watch"
- Prefer referencing specific items over generic categories (e.g., say the item, not “drinks” or “items”)

THINKING:
- Synthesize movement, sales, external factors, and menu economics
- Make clear calls: what to push, what to watch, what doesn’t matter
- Focus on what actually drives revenue and behavior
- Highlight tradeoffs only when they change the decision

CRITICAL:
- Never invent numbers or projections
- Only reference numbers if clearly supported
- If context is incomplete, say it briefly and still give your best judgment

TONE:
- Slightly opinionated
- Practical over perfect
- Feels like: “I’ve seen this — here’s what actually matters”

GOAL:
The user should feel:
“This is exactly how I’d want my best operator to think.”

No fluff. No over-explaining. Get to the point.
`;

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
    role: "system",
    content: [
      {
        type: "input_text",
        text: `KitchenPulse Context:\n${context}`
      }
    ]
  },
  ...history.map((msg) => ({
    role: msg.role === "assistant" ? "assistant" : "user",
    content: [
      {
        type: "input_text",
        text: safeText(msg.content)
      }
    ]
  })),
  {
    role: "user",
    content: [
      {
        type: "input_text",
        text: rawMessage
      }
    ]
  }
],
          max_output_tokens: 1100
        })
      }
    );

    if (!openaiResult.ok) {
      return sendJson(200, {
        reply: `OpenAI request failed\n\n${openaiResult.rawText}`
      });
    }

    const reply = extractOpenAIText(openaiResult.data);

    return sendJson(200, {
      reply: reply || "No readable response returned.",
      meta: {
        restaurant: restaurantName,
        runId,
        movement_rows_used: movementRows.length,
        external_factors_loaded: externalFactorsResult.ok,
        sales_loaded: salesResult.ok,
        menu_loaded: menuItemsResult.ok
      }
    });
  } catch (err) {
    return sendJson(500, {
      error: "Server error",
      details: err.message
    });
  }
};
