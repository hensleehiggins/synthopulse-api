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
        .map((v) => {
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
    const n = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
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
        rawText,
      };
    } catch (err) {
      return {
        ok: false,
        status: "fetch_failed",
        data: null,
        rawText: err.message,
      };
    }
  }
function cleanAssistantReply(text) {
  return safeText(text)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
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
      currentRunId: safeText(fields["Current Run ID"]),
    };
  }

  function summarizeMovement(rows = []) {
    if (!rows.length) {
      return {
        summaryText: "No current-run movement rows available.",
        topRisks: [],
        topUpside: [],
      };
    }

    const riskTypes = new Set([
      "Declining",
      "Dropped from Top",
      "Dropped to Low",
      "New Low",
    ]);

    const upsideTypes = new Set([
      "Rising",
      "Recovered",
      "Recovered to Top",
      "New Top",
    ]);

    const impactRank = {
      High: 3,
      Medium: 2,
      Low: 1,
      "": 0,
    };

    const sorted = [...rows].sort((a, b) => {
      const impactDelta =
        (impactRank[b.impactLevel] || 0) - (impactRank[a.impactLevel] || 0);

      if (impactDelta !== 0) return impactDelta;

      const aDelta = Math.abs(a.currentQty - a.previousQty);
      const bDelta = Math.abs(b.currentQty - b.previousQty);

      return bDelta - aDelta;
    });

    const topRisks = sorted.filter((r) => riskTypes.has(r.movementType)).slice(0, 5);
    const topUpside = sorted.filter((r) => upsideTypes.has(r.movementType)).slice(0, 5);

    const lines = [];

    if (topUpside.length) {
      lines.push(
        `Upside signals: ${topUpside
          .map(
            (r) =>
              `${r.item} (${r.movementType}${r.impactLevel ? `, ${r.impactLevel}` : ""})`
          )
          .join("; ")}`
      );
    }

    if (topRisks.length) {
      lines.push(
        `Risk signals: ${topRisks
          .map(
            (r) =>
              `${r.item} (${r.movementType}${r.impactLevel ? `, ${r.impactLevel}` : ""})`
          )
          .join("; ")}`
      );
    }

    if (!lines.length) {
      lines.push(
        `Mixed movement: ${sorted
          .slice(0, 6)
          .map((r) => `${r.item} (${r.movementType || "Signal"})`)
          .join("; ")}`
      );
    }

    return {
      summaryText: lines.join("\n"),
      topRisks,
      topUpside,
    };
  }

  function summarizeExternalFactors(rows = [], restaurantName = "") {
    const filtered = rows
      .filter((r) => {
        const isActive = safeText(r["Active"]).toLowerCase() === "true";
        const restaurant = safeText(r["Restaurant"]);
        return isActive && (!restaurantName || restaurant.includes(restaurantName));
      })
      .slice(0, 12);

    if (!filtered.length) {
      return "No active external factors available.";
    }

    return filtered
      .map((r) => {
        const type = safeText(r["Type"]);
        const desc = safeText(r["Description"]);
        const note = safeText(r["Decision Note"]) || safeText(r["Notes"]);
        const direction = safeText(r["Impact Direction"]);
        const strength = safeText(r["Impact Strength"]);

        return [
          type,
          direction && `impact ${direction}`,
          strength && `strength ${strength}`,
          desc,
          note,
        ]
          .filter(Boolean)
          .join(" • ");
      })
      .join("\n");
  }

  function summarizeSales(rows = [], restaurantName = "") {
    const filtered = rows.filter((r) => {
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
      `Top revenue classes: ${topClasses.join("; ") || "None"}`,
    ].join("\n");
  }

  function summarizeMenuItems(rows = [], restaurantName = "") {
    const filtered = rows.filter((r) => {
      const restaurant = safeText(r["Restaurant"]);
      return !restaurantName || restaurant.includes(restaurantName);
    });

    if (!filtered.length) {
      return "No menu-item context available.";
    }

    const topMargin = filtered
      .filter((r) => safeText(r["Decision Eligible"]).toLowerCase() === "true")
      .map((r) => ({
        item: safeText(r["Item Name"]),
        price: safeNumber(r["Price"]),
        cost: safeNumber(r["Estimated Unit Cost"]),
        margin: safeNumber(r["Estimated Margin $"]),
      }))
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 8);

    if (!topMargin.length) {
      return "No decision-eligible menu items with usable margin data.";
    }

    return `Top decision-eligible margin items: ${topMargin
      .map((x) => `${x.item} (margin ~$${Math.round(x.margin)}, price $${Math.round(x.price)})`)
      .join("; ")}`;
  }

  async function airtableGet(tableId, params = "") {
    const url =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}` +
      `?cellFormat=string&timeZone=America/New_York&userLocale=en${
        params ? `&${params}` : ""
      }`;

    return fetchJsonOrText(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json",
      },
    });
  }

  async function airtableGetAll(tableId, options = {}) {
    const {
      fields = [],
      sortField = "",
      sortDirection = "desc",
      maxRecords = 1000,
    } = options;

    const records = [];
    let offset = "";

    do {
      const params = new URLSearchParams();
      params.set("cellFormat", "string");
      params.set("timeZone", "America/New_York");
      params.set("userLocale", "en");

      fields.forEach((field) => {
        params.append("fields[]", field);
      });

      if (sortField) {
        params.set("sort[0][field]", sortField);
        params.set("sort[0][direction]", sortDirection);
      }

      if (offset) params.set("offset", offset);

      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}?${params.toString()}`;

      const result = await fetchJsonOrText(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          "Content-Type": "application/json",
        },
      });

      if (!result.ok) {
        return {
          ok: false,
          records,
          error: result.rawText,
        };
      }

      const pageRecords = result.data?.records || [];
      records.push(...pageRecords);

      offset = result.data?.offset || "";

      if (records.length >= maxRecords) break;
    } while (offset);

    return {
      ok: true,
      records: records.slice(0, maxRecords),
    };
  }

  function normalizeForSearch(value) {
    return safeText(value)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseRequestedDays(message) {
    const clean = normalizeForSearch(message);

    const match = clean.match(/past\s+(\d+)\s+days|last\s+(\d+)\s+days|(\d+)\s+day/);

    if (match) {
      const days = Number(match[1] || match[2] || match[3]);
      if (Number.isFinite(days) && days > 0 && days <= 365) return days;
    }

    if (clean.includes("past month") || clean.includes("last month")) return 30;
    if (clean.includes("past week") || clean.includes("last week")) return 7;
    if (clean.includes("yesterday")) return 1;
    if (clean.includes("today")) return 1;

    return 30;
  }

  function dateIsWithinDays(value, days) {
    if (!value) return false;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return date >= cutoff && date <= now;
  }

  function detectMenuSearchTerms(message, menuRows = []) {
    const cleanMessage = normalizeForSearch(message);

    const quoted = safeText(message).match(/"([^"]+)"|'([^']+)'/);
    if (quoted) {
      const term = normalizeForSearch(quoted[1] || quoted[2]);
      if (term) {
        return {
          label: term,
          terms: [term],
        };
      }
    }

    const stopWords = new Set([
      "what",
      "were",
      "was",
      "with",
      "from",
      "that",
      "this",
      "sold",
      "sale",
      "sales",
      "margin",
      "profit",
      "past",
      "last",
      "days",
      "much",
      "many",
      "make",
      "made",
      "have",
      "show",
      "item",
      "items",
      "did",
      "does",
      "the",
      "and",
      "for",
      "over",
      "compare",
      "comparison",
      "revenue",
      "qty",
      "quantity",
    ]);

    const messageWords = cleanMessage
      .split(" ")
      .filter((word) => word.length >= 4 && !stopWords.has(word));

    const menuNames = menuRows
      .map((r) => safeText(r.fields?.["Item Name"]))
      .filter(Boolean);

    const scored = menuNames
      .map((name) => {
        const cleanName = normalizeForSearch(name);
        const nameWords = cleanName.split(" ").filter((word) => word.length >= 4);

        const matchedWords = messageWords.filter((word) =>
          nameWords.some((nameWord) => nameWord.includes(word) || word.includes(nameWord))
        );

        return {
          name,
          cleanName,
          matchedWords,
          score: matchedWords.length,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.cleanName.length - a.cleanName.length);

    if (!scored.length) {
      return {
        label: "",
        terms: [],
      };
    }

    const best = scored[0];

    return {
      label: best.name,
      terms: [...new Set([...best.matchedWords, best.cleanName])],
    };
  }

  function salesRowMatchesTerms(row, terms = []) {
    if (!terms.length) return true;

    const item = normalizeForSearch(row["Item"]);

    return terms.some((term) => {
      const cleanTerm = normalizeForSearch(term);
      return item.includes(cleanTerm) || cleanTerm.includes(item);
    });
  }

  function summarizeDeepSalesQuestion({ message, salesRows = [], menuRows = [] }) {
    const days = parseRequestedDays(message);
    const detected = detectMenuSearchTerms(message, menuRows);

    const filtered = salesRows
      .map((r) => r.fields || {})
      .filter((r) => dateIsWithinDays(r["Date"] || r["Date (Raw)"], days))
      .filter((r) => salesRowMatchesTerms(r, detected.terms));

    if (!filtered.length) {
      if (detected.label) {
        return `Deep Sales Lookup:\nNo matching sales rows found for "${detected.label}" in the past ${days} days.`;
      }

      return `Deep Sales Lookup:\nNo matching sales rows found in the past ${days} days.`;
    }

    const totalQty = filtered.reduce((sum, r) => sum + safeNumber(r["Qty"]), 0);
    const totalNetSales = filtered.reduce((sum, r) => sum + safeNumber(r["Net Sales"]), 0);
    const totalGrossSales = filtered.reduce((sum, r) => sum + safeNumber(r["Gross Sales"]), 0);
    const totalCost = filtered.reduce((sum, r) => sum + safeNumber(r["Total Cost"]), 0);

    const profitFromField = filtered.reduce((sum, r) => sum + safeNumber(r["Profit"]), 0);
    const fallbackProfit = totalNetSales - totalCost;
    const totalProfit = profitFromField || fallbackProfit;
    const margin = totalNetSales > 0 ? totalProfit / totalNetSales : 0;
    const avgSale = totalQty > 0 ? totalNetSales / totalQty : 0;

    const byItem = new Map();

    for (const r of filtered) {
      const item = safeText(r["Item"]) || "Unknown item";

      if (!byItem.has(item)) {
        byItem.set(item, {
          qty: 0,
          netSales: 0,
          grossSales: 0,
          cost: 0,
          profit: 0,
        });
      }

      const bucket = byItem.get(item);
      const netSales = safeNumber(r["Net Sales"]);
      const cost = safeNumber(r["Total Cost"]);
      const profit = safeNumber(r["Profit"]) || netSales - cost;

      bucket.qty += safeNumber(r["Qty"]);
      bucket.netSales += netSales;
      bucket.grossSales += safeNumber(r["Gross Sales"]);
      bucket.cost += cost;
      bucket.profit += profit;
    }

    const topItems = [...byItem.entries()]
      .sort((a, b) => b[1].netSales - a[1].netSales)
      .slice(0, 10)
      .map(([name, v]) => {
        const itemMargin = v.netSales > 0 ? v.profit / v.netSales : 0;

        return `${name}: qty ${Math.round(v.qty)}, net sales $${Math.round(
          v.netSales
        )}, profit $${Math.round(v.profit)}, margin ${(itemMargin * 100).toFixed(1)}%`;
      });

    return [
      "Deep Sales Lookup:",
      `Question scope: ${detected.label ? detected.label : "all matching sales"} over past ${days} days`,
      `Rows matched: ${filtered.length}`,
      `Total qty: ${Math.round(totalQty)}`,
      `Total net sales: $${Math.round(totalNetSales)}`,
      `Total gross sales: $${Math.round(totalGrossSales)}`,
      `Estimated/realized profit: $${Math.round(totalProfit)}`,
      `Realized margin: ${(margin * 100).toFixed(1)}%`,
      `Avg sale price: $${avgSale.toFixed(2)}`,
      `Matched item detail: ${topItems.join("; ")}`,
    ].join("\n");
  }

  function questionNeedsDeepSales(message) {
    const clean = normalizeForSearch(message);

    return (
      clean.includes("sales") ||
      clean.includes("sold") ||
      clean.includes("margin") ||
      clean.includes("profit") ||
      clean.includes("revenue") ||
      clean.includes("past") ||
      clean.includes("last") ||
      clean.includes("how many") ||
      clean.includes("how much") ||
      clean.includes("top selling") ||
      clean.includes("best selling")
    );
  }

  function getProductHelpContext() {
  return `
KitchenPulse Product Help Context

Receipt Intake:
- Receipt Intake is a review-first workflow for vendor receipts and invoices.
- Users can upload a receipt by file upload, PDF, or phone photo.
- Uploaded receipts land in Receipt Queue first.
- Approve & parse means the receipt is approved for AI reading, then KitchenPulse extracts vendor, date, totals, and line items.
- Approve & parse does not update costs, inventory, menu items, or margins.
- Parsed Line Review is where extracted receipt lines are checked.
- Approve line means the line is valid enough to become a cost proposal.
- Remove line means the parsed staging line is junk or not useful and should be removed from the review workflow.
- Approved parsed lines generate Pricing Update Review proposals.
- Link item & check cost links the vendor receipt line to a KitchenPulse Inventory Item or Cost Source Item and compares current cost to proposed receipt cost.
- Link item & check cost does not update cost data.
- Approve proposal means the proposed cost update is allowed.
- Apply cost update is the action that actually writes the approved cost to the matched Inventory Item or Cost Source Item.
- Already current means the matched KitchenPulse item already has the same cost as the receipt, so no cost update is needed.
- Archive receipt hides completed receipts from the active queue without deleting history.
- Receipt Intake currently supports vendor cost review and inventory/source cost updates.
- Automatic menu-item costing requires Menu Item Ingredients / recipe-component mappings showing which ingredients go into each menu item and in what quantities.
- Until recipe/component mappings exist, Receipt Intake should be described as vendor cost intelligence and controlled cost review, not full automatic menu margin updating.

Receipt Intake safety rules:
- Nothing updates inventory or costs at upload.
- Nothing updates inventory or costs at approve & parse.
- Nothing updates inventory or costs at approve line.
- Nothing updates inventory or costs at link item & check cost.
- Cost data changes only after Approve proposal and Apply cost update.
`;
}
  
  function questionNeedsWeatherContext(message) {
    const clean = normalizeForSearch(message);

    return (
      clean.includes("weather") ||
      clean.includes("rain") ||
      clean.includes("temperature") ||
      clean.includes("hot") ||
      clean.includes("cold") ||
      clean.includes("patio")
    );
  }

  function summarizeWeatherSalesContext({ salesRows = [], externalRows = [] }) {
    const recentSalesByDate = new Map();

    for (const record of salesRows) {
      const r = record.fields || {};
      const date = safeText(r["Date"] || r["Date (Raw)"]);

      if (!date || !dateIsWithinDays(date, 45)) continue;

      if (!recentSalesByDate.has(date)) {
        recentSalesByDate.set(date, {
          netSales: 0,
          qty: 0,
          topItems: new Map(),
        });
      }

      const bucket = recentSalesByDate.get(date);
      const item = safeText(r["Item"]) || "Unknown item";
      const netSales = safeNumber(r["Net Sales"]);
      const qty = safeNumber(r["Qty"]);

      bucket.netSales += netSales;
      bucket.qty += qty;

      if (!bucket.topItems.has(item)) {
        bucket.topItems.set(item, {
          qty: 0,
          netSales: 0,
        });
      }

      bucket.topItems.get(item).qty += qty;
      bucket.topItems.get(item).netSales += netSales;
    }

    const weatherRows = externalRows
      .map((record) => record.fields || {})
      .filter((r) => {
        const type = safeText(r["Type"]).toLowerCase();
        const date = safeText(r["Forecast Date"] || r["Display Date"] || r["Date"]);

        return type.includes("weather") && dateIsWithinDays(date, 45);
      })
      .slice(0, 20)
      .map((r) => {
        const date = safeText(r["Forecast Date"] || r["Display Date"] || r["Date"]);
        const desc = safeText(r["Description"]);
        const high = safeText(r["Temp High"]);
        const low = safeText(r["Temp Low"]);
        const rain = safeText(r["Rain Chance %"]);
        const sales = recentSalesByDate.get(date);

        const topItems = sales
          ? [...sales.topItems.entries()]
              .sort((a, b) => b[1].netSales - a[1].netSales)
              .slice(0, 4)
              .map(
                ([name, v]) =>
                  `${name} ($${Math.round(v.netSales)}, qty ${Math.round(v.qty)})`
              )
          : [];

        return [
          `${date}: ${desc || "Weather"}`,
          high && `high ${high}`,
          low && `low ${low}`,
          rain && `rain ${rain}`,
          sales && `sales $${Math.round(sales.netSales)}, qty ${Math.round(sales.qty)}`,
          topItems.length && `top items: ${topItems.join("; ")}`,
        ]
          .filter(Boolean)
          .join(" • ");
      });

    if (!weatherRows.length) {
      return "Weather/Sales Context:\nNo recent weather rows were available for comparison.";
    }

    return `Weather/Sales Context:\n${weatherRows.join("\n")}`;
  }

  if (req.method === "GET") {
    try {
      const briefResult = await airtableGet(
        BRIEFS_TABLE_ID,
        `filterByFormula=${encodeURIComponent(
          "{Is Latest Brief}=1"
        )}&sort[0][field]=${encodeURIComponent(
          "Brief Date"
        )}&sort[0][direction]=desc&maxRecords=1`
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

      let opener =
        "Ask me what to push today, what’s at risk, or what changed since last run.";

      if (topOpportunity || topRisk) {
        opener =
          `Biggest opportunity right now: ${
            topOpportunity || "not clearly identified yet"
          }. ` +
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
        restaurant: restaurantName,
      });
    } catch (err) {
      return sendJson(200, {
        status: "ok",
        opener: "Ask me what to push today, what’s at risk, or what changed since last run.",
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
      `filterByFormula=${encodeURIComponent(
        "{Is Latest Brief}=1"
      )}&sort[0][field]=${encodeURIComponent(
        "Brief Date"
      )}&sort[0][direction]=desc&maxRecords=1`
    );

    if (!briefResult.ok) {
      return sendJson(200, {
        reply: `Latest brief request failed\n\n${briefResult.rawText}`,
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

    const [movementResult, externalFactorsResult, salesResult, menuItemsResult] =
      await Promise.all([
        airtableGet(
          MOVEMENT_TABLE_ID,
          `sort[0][field]=${encodeURIComponent(
            "Created Time"
          )}&sort[0][direction]=desc&maxRecords=100`
        ),
        airtableGet(
          EXTERNAL_FACTORS_TABLE_ID,
          `sort[0][field]=${encodeURIComponent(
            "Display Date"
          )}&sort[0][direction]=desc&maxRecords=50`
        ),
        airtableGet(
          DAILY_SALES_TABLE_ID,
          `sort[0][field]=${encodeURIComponent(
            "Date"
          )}&sort[0][direction]=desc&maxRecords=200`
        ),
        airtableGet(MENU_ITEMS_TABLE_ID, `maxRecords=200`),
      ]);

    const movementRows = movementResult.ok
      ? (movementResult.data?.records || [])
          .map((r) => normalizeMovementRow(r.fields || {}))
          .filter((r) => r.item && (!runId || r.currentRunId.includes(runId)))
      : [];

    const movementSummary = summarizeMovement(movementRows);

    const externalFactorsSummary = externalFactorsResult.ok
      ? summarizeExternalFactors(
          (externalFactorsResult.data?.records || []).map((r) => r.fields || {}),
          restaurantName
        )
      : "External factors unavailable.";

    const salesSummary = salesResult.ok
      ? summarizeSales(
          (salesResult.data?.records || []).map((r) => r.fields || {}),
          restaurantName
        )
      : "Recent sales unavailable.";

    const menuSummary = menuItemsResult.ok
      ? summarizeMenuItems(
          (menuItemsResult.data?.records || []).map((r) => r.fields || {}),
          restaurantName
        )
      : "Menu item context unavailable.";

    let deepQuestionContext = "No deep question-specific lookup was needed.";

    const menuRecordsForLookup = menuItemsResult.ok
      ? menuItemsResult.data?.records || []
      : [];

    const needsDeepSales = questionNeedsDeepSales(rawMessage);
    const needsWeatherContext = questionNeedsWeatherContext(rawMessage);

    if (needsDeepSales || needsWeatherContext) {
      const [deepSalesResult, deepExternalResult] = await Promise.all([
        airtableGetAll(DAILY_SALES_TABLE_ID, {
          fields: [
            "Date",
            "Date (Raw)",
            "Restaurant",
            "Item",
            "Revenue Class",
            "Department",
            "Qty",
            "Total Cost",
            "Gross Sales",
            "Net Sales",
            "Profit",
            "Profit Margin Percentage",
            "Menu Item",
            "Run",
          ],
          sortField: "Date",
          sortDirection: "desc",
          maxRecords: 1500,
        }),
        airtableGetAll(EXTERNAL_FACTORS_TABLE_ID, {
          fields: [
            "Type",
            "Description",
            "Temp High",
            "Temp Low",
            "Rain Chance %",
            "Forecast Date",
            "Display Date",
            "Date",
            "Impact Direction",
            "Impact Strength",
            "Decision Note",
            "Notes",
            "Restaurant",
          ],
          sortField: "Display Date",
          sortDirection: "desc",
          maxRecords: 300,
        }),
      ]);

      const pieces = [];

      if (needsDeepSales && deepSalesResult.ok) {
        pieces.push(
          summarizeDeepSalesQuestion({
            message: rawMessage,
            salesRows: deepSalesResult.records,
            menuRows: menuRecordsForLookup,
          })
        );
      }

      if (needsWeatherContext && deepSalesResult.ok && deepExternalResult.ok) {
        pieces.push(
          summarizeWeatherSalesContext({
            salesRows: deepSalesResult.records,
            externalRows: deepExternalResult.records,
          })
        );
      }

      if (!deepSalesResult.ok) {
        pieces.push(
          `Deep sales lookup failed: ${deepSalesResult.error || "Unknown Airtable error"}`
        );
      }

      if (needsWeatherContext && !deepExternalResult.ok) {
        pieces.push(
          `Weather lookup failed: ${deepExternalResult.error || "Unknown Airtable error"}`
        );
      }

      deepQuestionContext =
        pieces.filter(Boolean).join("\n\n") || deepQuestionContext;
    }

    const decisionPayloadSummary = decisionPayload
      ? JSON.stringify(decisionPayload, null, 2)
      : "No structured decision payload available.";

    const movementEvidenceBlock = movementRows.length
      ? movementRows
          .slice(0, 10)
          .map((row) => {
            const delta = row.currentQty - row.previousQty;

            return [
              row.item,
              row.movementType,
              row.listType,
              row.impactLevel,
              `qty ${row.previousQty} → ${row.currentQty}`,
              `delta ${delta >= 0 ? "+" : ""}${delta}`,
              row.notes,
            ]
              .filter(Boolean)
              .join(" • ");
          })
          .join("\n")
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

Product Help / UX Guide:
${getProductHelpContext()}

Question-Specific Deep Lookup:
${deepQuestionContext}

Decision Payload:
${decisionPayloadSummary}
`.trim();

    const instructionText = `
You are Ask AI inside KitchenPulse, an operator copilot embedded inside the KitchenPulse restaurant dashboard.

You are NOT a generic chatbot.
You are NOT onboarding the user.
You are NOT trying to collect restaurant setup information.
You already have the restaurant's current KitchenPulse context loaded below: latest brief, movement signals, sales summary, external factors, menu economics, question-specific lookup context, and decision payload.

PRIMARY RULE:
Always answer from the current KitchenPulse context first.

When the context includes "Question-Specific Deep Lookup", treat it as the most relevant source for item/date/sales/margin/weather questions. If the deep lookup gives exact totals, use those totals directly. If the lookup says no matching rows were found, say that clearly and do not invent numbers. For broad analytical questions, synthesize the deep lookup with movement, menu economics, weather, events, and the latest brief rather than answering from only one section.
NEVER SAY:
- "Send me your sales data"
- "Tell me about your restaurant"
- "Provide your menu"
- "Upload your POS data"
- "I need information about your restaurant"
- "Once you give me more details..."
- "As a general restaurant assistant..."

WHEN ASKED WHAT YOU CAN DO:
Explain what you can do using the current restaurant data already available:
- explain today's recommendation
- identify what to push
- identify what is at risk
- explain what changed since the last run
- interpret movement signals
- connect sales, margin, weather, events, staffing, and menu economics
- answer scoped item/date sales questions when a deep lookup is available
- suggest next operator actions

WHEN CONTEXT IS LIMITED:
Do not ask for broad restaurant data.
Say exactly what KitchenPulse currently knows and what specific field is missing.
Example: "KitchenPulse has the latest sales movement and event pressure, but item-level cost is still estimated, so treat margin as directional."

STYLE:
- Be direct, concise, and confident
- Do not use Markdown formatting
- Do not use asterisks for bold text
- Do not use bold headings or decorative formatting
- Use plain text only
- For simple operator questions, keep responses tight, usually 3–5 sentences
- For analytical questions involving comparisons, date ranges, margins, weather, events, or multiple items, give enough detail to answer fully without becoming long-winded
- When useful, structure the answer with short plain-text labels like "Bottom line:", "Why:", "What to do:", or "Watch:"
- Write like you're talking to a GM in real time

THINKING:
- Synthesize movement, sales, external factors, and menu economics
- Make clear calls: what to push, what to watch, what does not matter
- Focus on what actually drives revenue, margin, and floor behavior
- Highlight tradeoffs only when they change the decision

BOUNDARIES:
- Never invent numbers or projections
- Never claim to have searched all history unless the deep lookup context says the exact scope was loaded
- If a question asks for a date range, item total, margin, profit, or sales count, use the Question-Specific Deep Lookup when available
- If only a sample is available, call it a sample
- Only reference numbers if clearly supported by the provided context
- Do not pretend to see data that is not in the KitchenPulse context
- Do not give generic restaurant consulting when current KitchenPulse context is available
- Do not ask the user for files, exports, menu data, POS data, weather data, event data, staffing data, or sales data unless they explicitly ask how to add or fix that data source

DEFAULT REDIRECT:
If the user asks a broad or generic question, answer by grounding it back into the current restaurant context.
Example:
User: "What can you do for me?"
Good answer: "I can help you act on the latest KitchenPulse brief. Right now I can explain what to push, what is at risk, what changed since the last run, and how events or weather may affect service. Ask me things like 'what should I push tonight?', 'what is the biggest risk?', or 'why did this recommendation surface?'"

TONE:
- Slightly opinionated
- Practical over perfect
- Feels like: "I've seen this — here's what actually matters"

GOAL:
The user should feel:
"This is exactly how I'd want my best operator to think."

No fluff. No onboarding. No generic setup questions. Stay inside KitchenPulse and get to the point.
`;

    const openaiResult = await fetchJsonOrText("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
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
                text: `KitchenPulse Context:\n${context}`,
              },
            ],
          },
          ...history.map((msg) => {
            const role = msg.role === "assistant" ? "assistant" : "user";

            return {
              role,
              content: [
                {
                  type: role === "assistant" ? "output_text" : "input_text",
                  text: safeText(msg.content),
                },
              ],
            };
          }),
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: rawMessage,
              },
            ],
          },
        ],
        max_output_tokens: 1100,
      }),
    });

    if (!openaiResult.ok) {
      return sendJson(200, {
        reply: `OpenAI request failed\n\n${openaiResult.rawText}`,
      });
    }

    const reply = cleanAssistantReply(extractOpenAIText(openaiResult.data));

return sendJson(200, {
  reply: reply || "No readable response returned.",
      meta: {
        restaurant: restaurantName,
        runId,
        movement_rows_used: movementRows.length,
        external_factors_loaded: externalFactorsResult.ok,
        sales_loaded: salesResult.ok,
        menu_loaded: menuItemsResult.ok,
        deep_sales_lookup_used: needsDeepSales,
        weather_lookup_used: needsWeatherContext,
      },
    });
  } catch (err) {
    return sendJson(500, {
      error: "Server error",
      details: err.message,
    });
  }
};
