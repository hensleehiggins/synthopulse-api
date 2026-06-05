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

  const STAFFING_API = "https://project-1csz2.vercel.app/api/staffing-board";

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

  function safeBool(value) {
    if (value === true) return true;

    const clean = safeText(value).toLowerCase();

    return (
      clean === "true" ||
      clean === "yes" ||
      clean === "checked" ||
      clean === "1"
    );
  }

  function normalizeForSearch(value) {
    return safeText(value)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
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

  function extractJsonObject(text) {
    const raw = safeText(text);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      // Continue.
    }

    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }

    try {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
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
        rawText: err?.message || "Fetch failed",
      };
    }
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

  function etDateKey(value) {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const year = parts.find((part) => part.type === "year")?.value || "";
    const month = parts.find((part) => part.type === "month")?.value || "";
    const day = parts.find((part) => part.type === "day")?.value || "";

    if (!year || !month || !day) return "";

    return `${year}-${month}-${day}`;
  }

  function isSameEtDate(a, b) {
    const aKey = etDateKey(a);
    const bKey = etDateKey(b);

    return Boolean(aKey && bKey && aKey === bKey);
  }

  function formatTimeOnly(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatShortDate(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

   function eventStart(fields = {}) {
    return (
      fields["Start DateTime"] ||
      fields["Start Time"] ||
      fields["Event Start DateTime"] ||
      fields["Event Start"] ||
      fields["Event Sort Date"] ||
      null
    );
  }

  function eventEnd(fields = {}) {
    const startRaw = eventStart(fields);
    if (!startRaw) return null;

    const start = new Date(startRaw);
    if (Number.isNaN(start.getTime())) return null;

    const rawEnd =
      fields["End DateTime"] ||
      fields["End Time"] ||
      fields["Event End DateTime"] ||
      fields["Event End"] ||
      null;

    if (!rawEnd) {
      return new Date(start.getTime() + 4 * 60 * 60 * 1000).toISOString();
    }

    const end = new Date(rawEnd);

    if (Number.isNaN(end.getTime()) || end <= start) {
      return new Date(start.getTime() + 4 * 60 * 60 * 1000).toISOString();
    }

    return rawEnd;
  }

  function isTodayOrTonightEvent(fields = {}) {
    const rawStart = eventStart(fields);
    const rawEnd = eventEnd(fields);

    if (!rawStart || !rawEnd) return false;

    const now = new Date();
    const start = new Date(rawStart);
    const end = new Date(rawEnd);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return false;
    }

    const startsToday = isSameEtDate(start, now);
    const happeningNow = start <= now && end >= now;
    const notAlreadyOver = end >= now;
    const startsWithinServiceWindow =
      startsToday && start.getTime() - now.getTime() <= 18 * 60 * 60 * 1000;

    return notAlreadyOver && (happeningNow || startsWithinServiceWindow);
  }

  function eventScore(fields = {}) {
    const weight = safeNumber(fields["Event Weight"]);
    const impact = safeNumber(fields["Impact Strength"]);
    const estimatedDraw = normalizeForSearch(fields["Estimated Draw"]);
    const trafficEffect = normalizeForSearch(fields["Traffic Effect"]);
    const confidence = normalizeForSearch(fields["Confidence"]);

    let score = weight + impact;

    if (safeBool(fields["Decision Driving Event"])) score += 8;
    if (safeBool(fields["Active"]) || safeBool(fields["Active (Event)"])) score += 3;

    if (estimatedDraw.includes("very")) score += 4;
    else if (estimatedDraw.includes("high")) score += 3;
    else if (estimatedDraw.includes("medium")) score += 1;

    if (trafficEffect.includes("very")) score += 4;
    else if (trafficEffect.includes("high")) score += 3;
    else if (trafficEffect.includes("medium")) score += 1;

    if (confidence.includes("very")) score += 3;
    else if (confidence.includes("high")) score += 2;

    return score;
  }

  function pressureLabelFromScore(score) {
    if (score >= 24) return "Critical";
    if (score >= 17) return "High";
    if (score >= 10) return "Watch";
    if (score >= 4) return "Low";
    return "Quiet";
  }

  function isTripleseatOrBookedEvent(fields = {}) {
    const source = normalizeForSearch(fields["Source"]);
    const sourceType = normalizeForSearch(fields["Source Type"]);
    const venueArea = normalizeForSearch(fields["Venue / Area"]);
    const eventName = normalizeForSearch(fields["Event Name"]);
    const description = normalizeForSearch(fields["Description"]);
    const textBlob = `${source} ${sourceType} ${venueArea} ${eventName} ${description}`;

    return (
      source.includes("tripleseat") ||
      sourceType.includes("tripleseat") ||
      sourceType.includes("private") ||
      textBlob.includes("private event") ||
      textBlob.includes("private dining") ||
      textBlob.includes("buyout") ||
      textBlob.includes("banquet") ||
      textBlob.includes("event hall") ||
      textBlob.includes("ascend hall") ||
      venueArea.includes("ascend") ||
      venueArea.includes("event hall") ||
      venueArea.includes("private dining") ||
      venueArea.includes("banquet")
    );
  }

  function normalizeEventRecord(record) {
    const fields = record.fields || {};
    const start = eventStart(fields);
    const end = eventEnd(fields);
    const score = eventScore(fields);
    const name =
      safeText(fields["Event Name"]) ||
      safeText(fields["Description"]) ||
      "Event";

    return {
      name,
      type: safeText(fields["Type"]),
      source: safeText(fields["Source"]),
      sourceType: safeText(fields["Source Type"]),
      venueArea: safeText(fields["Venue / Area"]),
      start,
      end,
      time: start ? formatTimeOnly(start) : "",
      date: start ? formatShortDate(start) : "",
      estimatedDraw: safeText(fields["Estimated Draw"]),
      trafficEffect: safeText(fields["Traffic Effect"]),
      confidence: safeText(fields["Confidence"]),
      impactStrength: safeText(fields["Impact Strength"]),
      eventWeight: safeText(fields["Event Weight"]),
      decisionDriving: safeBool(fields["Decision Driving Event"]),
      active: safeBool(fields["Active"]) || safeBool(fields["Active (Event)"]),
      summary: safeText(fields["Event Summary"]),
      decisionNote: safeText(fields["Decision Note"]),
      description: safeText(fields["Description"]),
      pressure: pressureLabelFromScore(score),
      score,
      booked: isTripleseatOrBookedEvent(fields),
    };
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
    if (!rows.length) return "No current-run movement evidence available.";

    const impactRank = {
      High: 3,
      Medium: 2,
      Low: 1,
      "": 0,
    };

    function movementImpactScore(row = {}) {
  const impactRank = {
    High: 3,
    Medium: 2,
    Low: 1,
    "": 0,
  };

  const qtyDelta = Math.abs(safeNumber(row.currentQty) - safeNumber(row.previousQty));
  const revenue = safeNumber(row.currentRevenue);

  return (
    (impactRank[row.impactLevel] || 0) * 100 +
    qtyDelta * 10 +
    Math.min(Math.round(revenue / 25), 25)
  );
}

function isPositiveMovementRow(row = {}) {
  const text = normalizeForSearch(
    `${row.movementType} ${row.listType} ${row.notes}`
  );

  const qtyDelta = safeNumber(row.currentQty) - safeNumber(row.previousQty);
  const revenueDelta =
    safeNumber(row.currentRevenue) - safeNumber(row.previousRevenue);

  return (
    text.includes("new top") ||
    text.includes("rising") ||
    text.includes("recovered") ||
    text.includes("opportunity") ||
    qtyDelta > 0 ||
    revenueDelta > 0
  );
}

function isWatchMovementRow(row = {}) {
  const text = normalizeForSearch(
    `${row.movementType} ${row.listType} ${row.notes}`
  );

  const qtyDelta = safeNumber(row.currentQty) - safeNumber(row.previousQty);
  const revenueDelta =
    safeNumber(row.currentRevenue) - safeNumber(row.previousRevenue);

  return (
    text.includes("dropped") ||
    text.includes("new low") ||
    text.includes("low seller") ||
    text.includes("declin") ||
    text.includes("risk") ||
    qtyDelta < 0 ||
    revenueDelta < 0
  );
}

function movementAnchorLine(row) {
  if (!row || !row.item) return "None";

  const qtyDelta = safeNumber(row.currentQty) - safeNumber(row.previousQty);
  const revenueDelta =
    safeNumber(row.currentRevenue) - safeNumber(row.previousRevenue);

  return [
    row.item,
    row.movementType || row.listType || "movement signal",
    `qty ${row.previousQty} to ${row.currentQty} (${qtyDelta >= 0 ? "+" : ""}${qtyDelta})`,
    `revenue ${revenueDelta >= 0 ? "+" : ""}$${Math.round(revenueDelta)}`,
    row.impactLevel && `impact ${row.impactLevel}`,
    row.notes,
  ]
    .filter(Boolean)
    .join(" • ");
}

function pickMovementAnchors(rows = []) {
  const sorted = [...rows]
    .filter((row) => row && row.item)
    .sort((a, b) => movementImpactScore(b) - movementImpactScore(a));

  const support =
    sorted.find((row) => isPositiveMovementRow(row)) ||
    sorted[0] ||
    null;

  const watch =
    sorted.find((row) => isWatchMovementRow(row)) ||
    sorted.find((row) => row !== support) ||
    null;

  return {
    primary: sorted[0] || null,
    support,
    watch,
  };
}

function warningLine(warning) {
  if (!warning) return "";

  if (typeof warning === "string") return warning;

  return [
    safeText(warning.department || warning.role || warning.area),
    safeText(warning.message || warning.note || warning.warning),
    safeText(warning.severity),
  ]
    .filter(Boolean)
    .join(" • ");
}

function shiftSearchText(shift) {
  if (!shift) return "";

  if (typeof shift === "string") return normalizeForSearch(shift);

  return normalizeForSearch(
    [
      shift.employeeName,
      shift.employee,
      shift.name,
      shift.role,
      shift.department,
      shift.startTime,
      shift.start,
      shift.startDateTime,
      shift.status,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function staffingAnchorLine(staffingSummary) {
  if (!staffingSummary || staffingSummary.status !== "ready") {
    return "Staffing feed is unavailable. Manager should verify floor, bar, and kitchen coverage before service.";
  }

  const warnings = Array.isArray(staffingSummary.coverageWarnings)
    ? staffingSummary.coverageWarnings
    : [];

  const shifts = Array.isArray(staffingSummary.todayShifts)
    ? staffingSummary.todayShifts
    : [];

  if (warnings.length) {
    return `Coverage warning present: ${warningLine(warnings[0]) || "review staffing coverage before service"}.`;
  }

  if (!shifts.length) {
    return "No shifts are loaded yet. Manager should verify FOH, bar, and BOH coverage before service.";
  }

  const hasBohCoverage = shifts.some((shift) => {
    const text = shiftSearchText(shift);

    return (
      text.includes("boh") ||
      text.includes("kitchen") ||
      text.includes("line cook") ||
      text.includes("cook") ||
      text.includes("expo") ||
      text.includes("chef")
    );
  });

  if (!hasBohCoverage) {
    return `${shifts.length} shifts are loaded, but BOH coverage is not fully visible in the shift feed. Manager should verify kitchen/expo readiness before leaning into high-volume or high-margin items.`;
  }

  return `${shifts.length} shifts are loaded with BOH coverage visible and no coverage warnings flagged.`;
}

function buildHuddleAnchors({
  eventRows = [],
  staffingSummary,
  movementRows = [],
  recommendation,
  actionCallout,
  weatherRows = [],
}) {
  const movementAnchors = pickMovementAnchors(movementRows);

  const eventAnchor = eventRows.length
    ? eventRows
        .slice(0, 3)
        .map((event) =>
          [
            event.name,
            event.booked ? "private/booked" : "local/public",
            event.pressure,
            event.time && `time ${event.time}`,
            event.venueArea && `area ${event.venueArea}`,
          ]
            .filter(Boolean)
            .join(" • ")
        )
        .join("\n")
    : "No live event pressure is currently flagged.";

  const primaryCall =
    recommendation ||
    actionCallout ||
    "No current KitchenPulse recommendation text is loaded.";

  const weatherAnchor = weatherRows.length
    ? weatherRows[0]
    : "No active weather/patio pressure is loaded.";

  return [
    `Live pressure anchor: ${eventAnchor}`,
    `Primary KitchenPulse call: ${primaryCall}`,
    `Primary movement anchor: ${movementAnchorLine(movementAnchors.primary)}`,
    `Support item anchor: ${movementAnchorLine(movementAnchors.support)}`,
    `Watch item anchor: ${movementAnchorLine(movementAnchors.watch)}`,
    `Staffing anchor: ${staffingAnchorLine(staffingSummary)}`,
    `Weather / patio anchor: ${weatherAnchor}`,
  ].join("\n");
}

    const sorted = [...rows].sort((a, b) => {
      const impactDelta =
        (impactRank[b.impactLevel] || 0) - (impactRank[a.impactLevel] || 0);

      if (impactDelta !== 0) return impactDelta;

      const aDelta = Math.abs(a.currentQty - a.previousQty);
      const bDelta = Math.abs(b.currentQty - b.previousQty);

      return bDelta - aDelta;
    });

    return sorted
      .slice(0, 12)
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
      .join("\n");
  }

  function summarizeRecentSales(rows = []) {
    if (!rows.length) return "No recent sales sample available.";

    const byItem = new Map();
    const byClass = new Map();

    for (const record of rows) {
      const fields = record.fields || {};
      const item = safeText(fields["Item"]);
      const revenueClass = safeText(fields["Revenue Class"]) || "Unknown";
      const qty = safeNumber(fields["Qty"]);
      const netSales = safeNumber(fields["Net Sales"]);

      if (item) {
        if (!byItem.has(item)) byItem.set(item, { qty: 0, netSales: 0 });
        byItem.get(item).qty += qty;
        byItem.get(item).netSales += netSales;
      }

      if (!byClass.has(revenueClass)) {
        byClass.set(revenueClass, { qty: 0, netSales: 0 });
      }

      byClass.get(revenueClass).qty += qty;
      byClass.get(revenueClass).netSales += netSales;
    }

    const topItems = [...byItem.entries()]
      .sort((a, b) => b[1].netSales - a[1].netSales)
      .slice(0, 8)
      .map(
        ([name, v]) =>
          `${name} ($${Math.round(v.netSales)}, qty ${Math.round(v.qty)})`
      );

    const topClasses = [...byClass.entries()]
      .sort((a, b) => b[1].netSales - a[1].netSales)
      .slice(0, 5)
      .map(([name, v]) => `${name} ($${Math.round(v.netSales)})`);

    return [
      `Rows sampled: ${rows.length}`,
      `Top items: ${topItems.join("; ") || "None"}`,
      `Top revenue classes: ${topClasses.join("; ") || "None"}`,
    ].join("\n");
  }

  function summarizeMenuEconomics(rows = []) {
    if (!rows.length) return "No menu economics sample available.";

    const eligible = rows
      .map((record) => record.fields || {})
      .filter((fields) => safeBool(fields["Decision Eligible"]))
      .map((fields) => ({
        item: safeText(fields["Item Name"]),
        price: safeNumber(fields["Price"]),
        cost: safeNumber(fields["Estimated Unit Cost"]),
        margin: safeNumber(fields["Estimated Margin $"]),
      }))
      .filter((row) => row.item)
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 8);

    if (!eligible.length) {
      return "No decision-eligible menu item margin rows available.";
    }

    return eligible
      .map(
        (row) =>
          `${row.item} • price $${Math.round(row.price)} • est margin $${Math.round(
            row.margin
          )}`
      )
      .join("\n");
  }

  function summarizeStaffing(staffing) {
    if (!staffing) {
      return {
        summary: "Staffing board unavailable.",
        coverageWarnings: [],
        todayShifts: [],
        status: "unavailable",
      };
    }

    const coverageWarnings = Array.isArray(staffing.coverageWarnings)
      ? staffing.coverageWarnings
      : [];

    const todayShifts = Array.isArray(staffing.todayShifts)
      ? staffing.todayShifts
      : [];

    const warningLines = coverageWarnings
      .slice(0, 8)
      .map((warning) => {
        if (typeof warning === "string") return warning;

        return [
          safeText(warning.department || warning.role || warning.area),
          safeText(warning.message || warning.note || warning.warning),
          safeText(warning.severity),
        ]
          .filter(Boolean)
          .join(" • ");
      })
      .filter(Boolean);

    const shiftLines = todayShifts
      .slice(0, 12)
      .map((shift) => {
        if (typeof shift === "string") return shift;

        return [
          safeText(shift.employeeName || shift.employee || shift.name),
          safeText(shift.role),
          safeText(shift.department),
          safeText(shift.startTime || shift.start || shift.startDateTime),
          safeText(shift.endTime || shift.end || shift.endDateTime),
          safeText(shift.status),
        ]
          .filter(Boolean)
          .join(" • ");
      })
      .filter(Boolean);

    const summary = [
      `Today's shifts loaded: ${todayShifts.length}`,
      coverageWarnings.length
        ? `Coverage warnings: ${warningLines.join("; ") || coverageWarnings.length}`
        : "Coverage warnings: none flagged",
      shiftLines.length ? `Shift sample: ${shiftLines.join("; ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      summary,
      coverageWarnings,
      todayShifts,
      status: "ready",
    };
  }

  function classifyTone({ events = [], staffingSummary, movementRows = [] }) {
    const hasHighEvent = events.some(
      (event) => event.pressure === "High" || event.pressure === "Critical"
    );

    const hasBooked = events.some((event) => event.booked);
    const hasLocal = events.some((event) => !event.booked);
    const hasCoverageRisk = staffingSummary.coverageWarnings.length > 0;
    const hasMovement = movementRows.length > 0;

    let score = 0;

    if (hasBooked) score += 2;
    if (hasLocal) score += 2;
    if (hasHighEvent) score += 2;
    if (hasCoverageRisk) score += 2;
    if (hasMovement) score += 1;
    if (events.length >= 2) score += 1;
    if (staffingSummary.status !== "ready") score += 1;

    if (score >= 7) return "Hot";
    if (score >= 4) return "Spicy";
    if (score >= 2) return "Warm";
    return "Steady";
  }

  function fallbackHuddle({ tone, events = [], staffingSummary, movementSummary }) {
    const booked = events.find((event) => event.booked);
    const local = events.find((event) => !event.booked);

    const bookedLine = booked
      ? `${booked.name}${booked.venueArea ? ` in ${booked.venueArea}` : ""}${
          booked.time ? ` around ${booked.time}` : ""
        }`
      : "no private event pressure is currently flagged";

    const localLine = local
      ? `${local.name}${local.venueArea ? ` near ${local.venueArea}` : ""}${
          local.time ? ` around ${local.time}` : ""
        }`
      : "no major outside local surge is currently flagged";

    const coverageLine = staffingSummary.coverageWarnings.length
      ? "Coverage has at least one warning, so keep manager communication tight and call for support before the rush stacks up."
      : staffingSummary.todayShifts.length
        ? "Coverage is loaded, so the focus is clean handoffs and staying ahead of the pressure window."
        : "No staff shifts are loaded yet, so use manager judgment and keep the floor read tight.";

    return {
      tone,
      managerRead: `Tonight looks ${tone.toLowerCase()}. The main booked signal is ${bookedLine}, and the local signal is ${localLine}. ${coverageLine} Run the shift around pacing, fast communication, and protecting the items KitchenPulse has already flagged.`,
      lineupScript: `Team, tonight is about staying ahead instead of reacting late. We have ${bookedLine}, and local pressure is ${localLine}. Keep the host stand, bar, and kitchen talking early. If the room starts to stack, call it out before tickets or guest waits get away from us.`,
      watchPoints: [
        "Host/floor: set wait expectations early and do not let small delays surprise guests.",
        "Kitchen/bar: protect timing, handoffs, and fire pacing around the pressure window.",
        "Menu push: lean into the current KitchenPulse recommendation and watch any movement risk items.",
      ],
      confidence: "Directional",
      signalsUsed: ["Latest brief", "Events", "Staffing", "Movement"],
      fallback: true,
    };
  }

  async function buildHuddle() {
    const [
      briefResult,
      movementResult,
      externalFactorsResult,
      salesResult,
      menuResult,
      staffingResult,
    ] = await Promise.all([
      airtableGet(
        BRIEFS_TABLE_ID,
        `filterByFormula=${encodeURIComponent(
          "{Is Latest Brief}=1"
        )}&sort[0][field]=${encodeURIComponent(
          "Brief Date"
        )}&sort[0][direction]=desc&maxRecords=1`
      ),
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
        )}&sort[0][direction]=desc&maxRecords=100`
      ),
      airtableGet(
        DAILY_SALES_TABLE_ID,
        `sort[0][field]=${encodeURIComponent(
          "Date"
        )}&sort[0][direction]=desc&maxRecords=200`
      ),
      airtableGet(MENU_ITEMS_TABLE_ID, `maxRecords=200`),
      fetchJsonOrText(STAFFING_API, { method: "GET" }),
    ]);

    const latestBrief = briefResult.ok ? briefResult.data?.records?.[0] : null;
    const briefFields = latestBrief?.fields || {};

    const decisionPayload = parseDecisionJson(briefFields["Decision JSON"]);

    const restaurantName = safeText(briefFields["Restaurant"]);
    const runId = safeText(briefFields["Run ID"]);
    const recommendation = safeText(briefFields["Decision Display"]);
    const priority = safeText(briefFields["Decision Priority"]);
    const summary = safeText(briefFields["Summary"]);
    const actionCallout = safeText(briefFields["Action Callout"]);
    const formattedBrief = safeText(briefFields["Formatted Brief (Display)"]);

    const movementRows = movementResult.ok
      ? (movementResult.data?.records || [])
          .map((record) => normalizeMovementRow(record.fields || {}))
          .filter((row) => row.item && (!runId || row.currentRunId.includes(runId)))
      : [];

    const movementSummary = summarizeMovement(movementRows);

    const allExternalRows = externalFactorsResult.ok
      ? externalFactorsResult.data?.records || []
      : [];

    const eventRows = allExternalRows
      .map((record) => record.fields || {})
      .filter((fields) => {
        const type = normalizeForSearch(fields["Type"]);
        const active = safeBool(fields["Active"]) || safeBool(fields["Active (Event)"]);

        return type.includes("event") && active && isTodayOrTonightEvent(fields);
      })
      .map((fields) => normalizeEventRecord({ fields }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const weatherRows = allExternalRows
      .map((record) => record.fields || {})
      .filter((fields) => {
        const type = normalizeForSearch(fields["Type"]);
        const active = safeBool(fields["Active"]);
        return type.includes("weather") && active;
      })
      .slice(0, 5)
      .map((fields) => {
        return [
          safeText(fields["Description"]) || "Weather",
          safeText(fields["Temp High"]) && `high ${safeText(fields["Temp High"])}`,
          safeText(fields["Temp Low"]) && `low ${safeText(fields["Temp Low"])}`,
          safeText(fields["Rain Chance %"]) &&
            `rain ${safeText(fields["Rain Chance %"])}`,
          safeText(fields["Decision Note"]) || safeText(fields["Notes"]),
        ]
          .filter(Boolean)
          .join(" • ");
      });

    const salesSummary = salesResult.ok
      ? summarizeRecentSales(salesResult.data?.records || [])
      : "Recent sales unavailable.";

    const menuSummary = menuResult.ok
      ? summarizeMenuEconomics(menuResult.data?.records || [])
      : "Menu economics unavailable.";

    const staffingSummary = summarizeStaffing(staffingResult.ok ? staffingResult.data : null);

const huddleAnchors = buildHuddleAnchors({
  eventRows,
  staffingSummary,
  movementRows,
  recommendation,
  actionCallout,
  weatherRows,
});

const tone = classifyTone({
      events: eventRows,
      staffingSummary,
      movementRows,
    });

    const context = `
KitchenPulse Pre-Shift Huddle Context

Restaurant:
${restaurantName || "Unknown"}

Run ID:
${runId || "Unknown"}

Current Tone:
${tone}

Latest Recommendation:
${recommendation || "None"}

Decision Priority:
${priority || "Unknown"}

Action Callout:
${actionCallout || "None"}

Brief Summary:
${summary || "None"}

Latest Brief Text:
${summary || actionCallout || recommendation || "None"}

Required Huddle Anchors:
${huddleAnchors}

Important event freshness rule:
Only the events listed under "Tonight / Today Event Pressure" are live service-pressure events. Do not mention event names, private events, local events, or "looming" demand from Latest Brief Text, Decision Payload, or older brief language unless that same event also appears under "Tonight / Today Event Pressure".

Tonight / Today Event Pressure:
${
  eventRows.length
    ? eventRows
        .map((event) =>
          [
            event.name,
            event.booked ? "booked/private" : "local/public",
            event.pressure,
            event.time && `time ${event.time}`,
            event.venueArea && `area ${event.venueArea}`,
            event.estimatedDraw && `draw ${event.estimatedDraw}`,
            event.trafficEffect && `traffic ${event.trafficEffect}`,
            event.confidence && `confidence ${event.confidence}`,
            event.summary,
            event.decisionNote,
          ]
            .filter(Boolean)
            .join(" • ")
        )
        .join("\n")
    : "No major active event pressure found for today/tonight."
}

Weather / Patio Context:
${weatherRows.length ? weatherRows.join("\n") : "No active weather context loaded."}

Staffing / Coverage:
${staffingSummary.summary}

Movement Signals:
${movementSummary}

Recent Sales:
${salesSummary}

Menu Economics:
${menuSummary}
`.trim();

    const instructions = `
You are KitchenPulse generating a pre-shift huddle for a restaurant GM.

This is not a generic dashboard summary.
This should sound like a sharp restaurant consultant or strong operator reading the shift before service.

Use the KitchenPulse context provided.
Do not invent specific facts, numbers, events, weather, staff counts, or item names.
If a signal is missing, do not fake it. Work from what is known.

Event freshness rule:
Only mention events that appear in the "Tonight / Today Event Pressure" section.
Do not mention stale events, prior-day local events, old private events, or future booked demand unless it is explicitly listed in that section.
If that section says no major active event pressure, say there is no live event pressure currently flagged.

Goal:
Give the GM something worth reading at lineup. It should feel alive, specific, and service-minded.

Anchor rules:
Use the Required Huddle Anchors section as the working read.
When item names are available, mention at least one support item and one watch item.
If there is no live event pressure, mention that briefly once, then move on. Do not let the whole read become about no events.
If the staffing anchor says BOH coverage is not fully visible, include a calm manager caveat to verify kitchen/expo readiness before pushing high-volume or high-margin items.
Do not turn missing staffing data into panic. Frame it as manager verification.
Do not write vague filler like "clean execution, table awareness, and communication" unless it is tied to a specific item, coverage gap, event, weather, or manager action.
Do not say "the useful read is coming from..." because that sounds canned.
Give the GM a practical opinion.

Write in plain English.
No Markdown.
No asterisks.
No emojis.
No corporate fluff.
No "as an AI".
No "based on the data provided" unless absolutely necessary.
No long lectures.

Output valid JSON only with this exact shape:
{
  "tone": "Steady | Warm | Spicy | Hot",
  "managerRead": "A conversational manager read of how the shift is likely to behave. 3 to 5 sentences.",
  "lineupScript": "A 30 to 45 second talk track the GM can read to staff. It should sound natural spoken aloud.",
  "watchPoints": [
    "Host/floor watch point.",
    "Kitchen/bar watch point.",
    "Menu/service watch point."
  ],
  "confidence": "Good | Directional | Limited",
  "signalsUsed": ["Latest brief", "Events", "Weather", "Staffing", "Movement", "Sales", "Menu economics"]
}

Tone guide:
Steady = normal service, no major signal.
Warm = some signal, stay alert.
Spicy = real pressure or opportunity, team needs a clear plan.
Hot = high pressure, high-risk, or high-opportunity service.

ManagerRead:
Make it feel like a live shift read, not canned text.
Mention the actual pressure if it exists.
Connect event/weather/staffing/movement/menu signals into how service will feel.
Give an opinion.

LineupScript:
Write it as something a GM would actually say to the team.
It can be direct, practical, and motivating.
It should not sound like a report.

WatchPoints:
Each point should be specific and operational.
Avoid repeating the same generic "communication and pacing" line unless that is truly the key issue.
`.trim();

    if (!OPENAI_API_KEY) {
      return fallbackHuddle({
        tone,
        events: eventRows,
        staffingSummary,
        movementSummary,
      });
    }

    const openaiResult = await fetchJsonOrText("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        instructions,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: context,
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Generate the pre-shift huddle now.",
              },
            ],
          },
        ],
        max_output_tokens: 1000,
      }),
    });

    if (!openaiResult.ok) {
      return fallbackHuddle({
        tone,
        events: eventRows,
        staffingSummary,
        movementSummary,
      });
    }

    const rawText = cleanAssistantReply(extractOpenAIText(openaiResult.data));
    const parsed = extractJsonObject(rawText);

    if (!parsed || typeof parsed !== "object") {
      return fallbackHuddle({
        tone,
        events: eventRows,
        staffingSummary,
        movementSummary,
      });
    }

    const watchPoints = Array.isArray(parsed.watchPoints)
      ? parsed.watchPoints.map(safeText).filter(Boolean).slice(0, 3)
      : [];

    while (watchPoints.length < 3) {
      watchPoints.push("Keep the team communicating early and adjust before pressure stacks up.");
    }

    const signalsUsed = Array.isArray(parsed.signalsUsed)
      ? parsed.signalsUsed.map(safeText).filter(Boolean).slice(0, 8)
      : ["Latest brief", "Events", "Staffing", "Movement"];

    let finalManagerRead =
  safeText(parsed.managerRead) ||
  fallbackHuddle({ tone, events: eventRows, staffingSummary, movementSummary })
    .managerRead;

let finalLineupScript =
  safeText(parsed.lineupScript) ||
  fallbackHuddle({ tone, events: eventRows, staffingSummary, movementSummary })
    .lineupScript;

let finalWatchPoints = watchPoints;
let finalSignalsUsed = signalsUsed;

if (eventRows.length === 0) {
  const positiveStaleEventLanguage =
    /\b(event traffic|booked demand|looming private|bar crawl|downtown crawl|local surge)\b/i;

  const privateEventLanguage =
    /\b(private event|private events|booked event|booked events)\b/i;

  function hasNegatedEventLanguage(text) {
    const raw = safeText(text);

    return /\b(no|not|without|do not have|don't have|does not have|is not|isn't|are not|aren't|not carrying)\b.{0,90}\b(event|events|private|booked|demand|pressure|surge)\b/i.test(
      raw
    );
  }

  function hasPositiveStaleEventMention(text) {
    const raw = safeText(text);
    if (!raw) return false;

    if (hasNegatedEventLanguage(raw)) return false;

    return positiveStaleEventLanguage.test(raw) || privateEventLanguage.test(raw);
  }

  const staleEventMentioned =
    hasPositiveStaleEventMention(finalManagerRead) ||
    hasPositiveStaleEventMention(finalLineupScript) ||
    finalWatchPoints.some((point) => hasPositiveStaleEventMention(point));

  if (staleEventMentioned) {
    const corrected = fallbackHuddle({
      tone,
      events: eventRows,
      staffingSummary,
      movementSummary,
    });

    finalManagerRead = corrected.managerRead;
    finalLineupScript = corrected.lineupScript;
    finalWatchPoints = corrected.watchPoints;
  }

  finalSignalsUsed = finalSignalsUsed.filter((signal) => {
    const clean = normalizeForSearch(signal);
    return clean !== "events" && clean !== "event";
  });

  if (!finalSignalsUsed.length) {
    finalSignalsUsed = [
      "Latest brief",
      "Weather",
      "Staffing",
      "Movement",
      "Sales",
      "Menu economics",
    ];
  }
}

return {
  tone: safeText(parsed.tone) || tone,
  managerRead: finalManagerRead,
  lineupScript: finalLineupScript,
  watchPoints: finalWatchPoints,
  confidence: safeText(parsed.confidence) || "Directional",
  signalsUsed: finalSignalsUsed,
  fallback: false,
  meta: {
    restaurant: restaurantName,
    runId,
    event_count: eventRows.length,
    movement_rows: movementRows.length,
    staffing_loaded: staffingResult.ok,
    weather_rows: weatherRows.length,
  },
};
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return sendJson(405, { error: "Method not allowed. Use GET or POST." });
  }

  try {
    if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
      return sendJson(500, {
        error: "Missing Airtable environment variables.",
      });
    }

    const huddle = await buildHuddle();

    return sendJson(200, {
      ok: true,
      ...huddle,
    });
  } catch (err) {
    return sendJson(500, {
      ok: false,
      error: "Pre-shift huddle failed.",
      details: err?.message || "Unknown error",
    });
  }
};
