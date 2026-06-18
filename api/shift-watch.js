/*
 * KitchenPulse Shift Watch API v1.0
 *
 * Route: /api/shift-watch
 *
 * Why this exists:
 * Shift Watch must not infer live event pressure in a Softr Vibe block.
 * It selects today/tonight event context server-side from Airtable, returns
 * the selected record IDs/reasons, and combines the result with staffing.
 *
 * Query params:
 * - restaurantId=CHLOE (optional; defaults to CHLOE)
 * - debug=1 (optional; exposes candidate diagnostics)
 */

const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID || "appD303evZM2SlvMR";

const AIRTABLE_TOKEN =
  process.env.AIRTABLE_API_KEY ||
  process.env.AIRTABLE_TOKEN ||
  process.env.AIRTABLE_PAT;

const EXTERNAL_FACTORS_TABLE = "External Factors";
const DEFAULT_RESTAURANT_ID = "CHLOE";
const STAFFING_API = "https://project-1csz2.vercel.app/api/staffing-board";

const EVENT_FIELDS = [
  "Event Name",
  "Description",
  "Type",
  "Active",
  "Active (Event)",
  "Restaurant ID",
  "Restaurant",
  "Source",
  "Source Type",
  "External Event ID",
  "Venue / Area",
  "Start DateTime",
  "End DateTime",
  "Forecast Date",
  "Display Date",
  "Short Date",
  "Event Weight",
  "Decision Driving Event",
  "Impact Strength",
  "Estimated Draw",
  "Traffic Effect",
  "Confidence",
  "Event Summary",
  "Decision Note",
  "Auto Imported",
];

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
}

function sendJson(res, status, payload) {
  setCors(res);
  return res.status(status).json(payload);
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function text(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return clean(value);
  if (typeof value === "boolean") return value ? "true" : "false";

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item === null || item === undefined) return "";
        if (typeof item === "string" || typeof item === "number") return clean(item);
        if (typeof item === "object") return clean(item.name || item.label || item.id || "");
        return clean(item);
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    return clean(value.name || value.label || value.id || "");
  }

  return clean(value);
}

function bool(value) {
  if (value === true) return true;
  const normalized = text(value).toLowerCase();
  return ["true", "yes", "checked", "1"].includes(normalized);
}

function number(value) {
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(value) {
  return text(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

  return year && month && day ? `${year}-${month}-${day}` : "";
}

function sameEtDate(a, b) {
  const aKey = etDateKey(a);
  const bKey = etDateKey(b);
  return Boolean(aKey && bKey && aKey === bKey);
}

function formatEventTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function eventStart(fields = {}) {
  return (
    fields["Start DateTime"] ||
    fields["Start Time"] ||
    fields["Event Start DateTime"] ||
    fields["Event Start"] ||
    fields["Event Sort Date"] ||
    fields["Display Date"] ||
    fields["Forecast Date"] ||
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

function isWatchWindow(fields = {}, now = new Date()) {
  const startRaw = eventStart(fields);
  const endRaw = eventEnd(fields);
  if (!startRaw || !endRaw) return false;

  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  const hoursSinceEnd = (now.getTime() - end.getTime()) / (1000 * 60 * 60);
  const happeningNow = start <= now && end >= now;
  const upcomingToday = sameEtDate(start, now) && start >= now;
  const recentlyEnded = hoursSinceEnd >= 0 && hoursSinceEnd <= 2;

  return happeningNow || upcomingToday || recentlyEnded;
}

function eventScore(fields = {}) {
  const weight = number(fields["Event Weight"]);
  const impact = number(fields["Impact Strength"]);
  const draw = normalize(fields["Estimated Draw"]);
  const traffic = normalize(fields["Traffic Effect"]);
  const confidence = normalize(fields["Confidence"]);

  let score = weight + impact;
  if (bool(fields["Decision Driving Event"])) score += 8;
  if (bool(fields["Active"]) || bool(fields["Active (Event)"])) score += 3;
  if (draw.includes("very")) score += 4;
  else if (draw.includes("high")) score += 3;
  else if (draw.includes("medium")) score += 1;
  if (traffic.includes("very")) score += 4;
  else if (traffic.includes("high")) score += 3;
  else if (traffic.includes("medium")) score += 1;
  if (confidence.includes("very")) score += 3;
  else if (confidence.includes("high")) score += 2;

  return score;
}

function pressureLabel(score) {
  if (score >= 24) return "Critical";
  if (score >= 17) return "High";
  if (score >= 10) return "Watch";
  if (score >= 4) return "Low";
  return "Quiet";
}

function isBookedDemand(fields = {}) {
  const source = normalize(fields["Source"]);
  const sourceType = normalize(fields["Source Type"]);
  const venue = normalize(fields["Venue / Area"]);
  const name = normalize(fields["Event Name"]);
  const description = normalize(fields["Description"]);
  const blob = `${source} ${sourceType} ${venue} ${name} ${description}`;

  return (
    source.includes("tripleseat") ||
    sourceType.includes("tripleseat") ||
    sourceType.includes("private") ||
    blob.includes("private event") ||
    blob.includes("private dining") ||
    blob.includes("buyout") ||
    blob.includes("banquet") ||
    blob.includes("event hall") ||
    blob.includes("ascend hall") ||
    venue.includes("ascend") ||
    venue.includes("event hall") ||
    venue.includes("private dining") ||
    venue.includes("banquet")
  );
}

function isLocalPressure(fields = {}) {
  if (isBookedDemand(fields)) return false;

  const source = normalize(fields["Source"]);
  const sourceType = normalize(fields["Source Type"]);
  const importedOrBroad =
    bool(fields["Auto Imported"]) ||
    source.includes("ticketmaster") ||
    source.includes("eventbrite") ||
    source.includes("apify") ||
    sourceType.includes("imported");

  if (importedOrBroad) {
    return bool(fields["Decision Driving Event"]) && number(fields["Event Weight"]) >= 8;
  }

  return true;
}

function isActiveEvent(fields = {}) {
  return (
    normalize(fields["Type"]).includes("event") &&
    (bool(fields["Active"]) || bool(fields["Active (Event)"]))
  );
}

function restaurantMatches(fields = {}, restaurantId) {
  const requested = normalize(restaurantId);
  if (!requested) return true;

  const restaurantIds = normalize(fields["Restaurant ID"]);
  if (!restaurantIds) {
    // Chloe's is currently the only live restaurant. Do not suppress a valid
    // event simply because an older record predates Restaurant ID population.
    return requested === normalize(DEFAULT_RESTAURANT_ID);
  }

  return restaurantIds.split(" ").includes(requested) || restaurantIds.includes(requested);
}

function normalizeEvent(record, now) {
  const fields = record.fields || {};
  const start = eventStart(fields);
  const end = eventEnd(fields);
  const score = eventScore(fields);
  const booked = isBookedDemand(fields);
  const name = text(fields["Event Name"]) || text(fields["Description"]) || "Event";
  const venue = text(fields["Venue / Area"]);
  const currentlyHappening = Boolean(start && end && new Date(start) <= now && new Date(end) >= now);

  return {
    id: record.id,
    externalEventId: text(fields["External Event ID"]),
    name,
    venue,
    start,
    end,
    formattedStart: start ? formatEventTime(start) : "",
    source: text(fields["Source"]),
    sourceType: text(fields["Source Type"]),
    summary: text(fields["Event Summary"]) || text(fields["Description"]),
    decisionNote: text(fields["Decision Note"]),
    estimatedDraw: text(fields["Estimated Draw"]),
    trafficEffect: text(fields["Traffic Effect"]),
    confidence: text(fields["Confidence"]),
    eventWeight: number(fields["Event Weight"]),
    impactStrength: number(fields["Impact Strength"]),
    decisionDriving: bool(fields["Decision Driving Event"]),
    booked,
    local: isLocalPressure(fields),
    pressure: pressureLabel(score),
    score,
    currentlyHappening,
    reasonSelected: "",
  };
}

function dedupeEvents(events = []) {
  const groups = new Map();

  for (const event of events) {
    const key = event.externalEventId
      ? `external:${normalize(event.externalEventId)}`
      : `fallback:${normalize(event.name)}|${etDateKey(event.start)}|${normalize(event.venue)}`;

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, event);
      continue;
    }

    const existingScore = (existing.currentlyHappening ? 1000 : 0) + existing.score;
    const nextScore = (event.currentlyHappening ? 1000 : 0) + event.score;

    if (nextScore > existingScore) {
      groups.set(key, event);
    }
  }

  return [...groups.values()];
}

function sortWatchEvents(events = [], now = new Date()) {
  return [...events].sort((a, b) => {
    if (a.currentlyHappening !== b.currentlyHappening) {
      return a.currentlyHappening ? -1 : 1;
    }

    const aStart = new Date(a.start || 0).getTime();
    const bStart = new Date(b.start || 0).getTime();
    const aDistance = Math.abs(aStart - now.getTime());
    const bDistance = Math.abs(bStart - now.getTime());

    if (aDistance !== bDistance) return aDistance - bDistance;
    if (a.score !== b.score) return b.score - a.score;
    return aStart - bStart;
  });
}

async function fetchAirtableEvents() {
  if (!AIRTABLE_TOKEN) {
    throw new Error("Missing Airtable token. Set AIRTABLE_PAT, AIRTABLE_API_KEY, or AIRTABLE_TOKEN.");
  }

  const records = [];
  let offset = "";

  do {
    const params = new URLSearchParams();
    params.set("pageSize", "100");
    EVENT_FIELDS.forEach((field) => params.append("fields[]", field));
    if (offset) params.set("offset", offset);

    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(EXTERNAL_FACTORS_TABLE)}?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`Airtable error ${response.status}: ${JSON.stringify(payload)}`);
    }

    records.push(...(payload.records || []));
    offset = payload.offset || "";
  } while (offset);

  return records;
}

async function fetchStaffing() {
  try {
    const response = await fetch(`${STAFFING_API}?v=${Date.now()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const payload = await response.json();
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Staffing unavailable");

    return {
      status: "ready",
      todayShifts: Array.isArray(payload.todayShifts) ? payload.todayShifts : [],
      coverageWarnings: Array.isArray(payload.coverageWarnings) ? payload.coverageWarnings : [],
      activeByDepartment: payload.activeByDepartment || payload.byDepartment || {},
    };
  } catch (error) {
    return {
      status: "unavailable",
      todayShifts: [],
      coverageWarnings: [],
      activeByDepartment: {},
      error: error.message || "Staffing unavailable",
    };
  }
}

function buildCoverage(staffing) {
  const warnings = staffing.coverageWarnings || [];
  const shifts = staffing.todayShifts || [];
  const departments = staffing.activeByDepartment || {};

  if (staffing.status !== "ready") {
    return {
      tone: "Watch",
      title: "Staffing feed unavailable",
      meta: "Manager check recommended",
      body: "KitchenPulse could not load live staffing for this scan. Verify floor, bar, kitchen, and manager coverage before service.",
    };
  }

  if (warnings.length) {
    const warning = warnings[0] || {};
    return {
      tone: String(warning.severity || "Watch").replace(/^Medium$/i, "Watch"),
      title: warning.title || "Coverage needs review",
      meta: [warning.role, warning.department].filter(Boolean).join(" • ") || `${shifts.length} shifts loaded today`,
      body: warning.detail || "Confirm coverage and handoffs before service.",
    };
  }

  if (shifts.length) {
    const foh = Number(departments.FOH || departments.foh || 0);
    const bar = Number(departments.Bar || departments.bar || 0);
    const manager = Number(departments.Management || departments.management || 0);

    return {
      tone: "Covered",
      title: "Coverage snapshot loaded",
      meta: `${foh} FOH • ${bar} Bar • ${manager} Manager`,
      body: "Staffing data is live for today. Watch for schedule changes as service approaches.",
    };
  }

  return {
    tone: "Watch",
    title: "No shifts loaded today",
    meta: "Manager check recommended",
    body: "No Staff Shifts records are available for today. Verify the service plan before the floor gets busy.",
  };
}

function buildSpice({ bookedDemand, localPressure, coverage, events, staffing }) {
  let score = 0;
  if (bookedDemand) score += 2;
  if (localPressure) score += 2;
  if (["High", "Critical"].includes(bookedDemand?.pressure)) score += 2;
  if (["High", "Critical"].includes(localPressure?.pressure)) score += 2;
  if (["High", "Critical", "Watch"].includes(coverage.tone)) score += 2;
  if (events.length >= 2) score += 1;
  if (staffing.status !== "ready") score += 1;

  if (score >= 7) {
    return {
      tone: "Critical",
      title: "Hot shift likely",
      meta: `Overall spice level: Hot • ${events.length} active pressure signal${events.length === 1 ? "" : "s"}`,
      body: "Pressure is stacked. Confirm the service plan early and keep host, floor, bar, and kitchen communication tight.",
    };
  }

  if (score >= 4) {
    return {
      tone: "High",
      title: "Spicy night likely",
      meta: `Overall spice level: Spicy • ${events.length} active pressure signal${events.length === 1 ? "" : "s"}`,
      body: "There is meaningful demand or coverage pressure in play. Review pacing and readiness before service builds.",
    };
  }

  if (score >= 2) {
    return {
      tone: "Watch",
      title: "Warm shift watch",
      meta: `Overall spice level: Warm • ${events.length} active pressure signal${events.length === 1 ? "" : "s"}`,
      body: "One or more signals could affect pacing. A quick manager check now is cheaper than reacting later.",
    };
  }

  return {
    tone: "Clear",
    title: "Mild shift expected",
    meta: "Overall spice level: Mild",
    body: "Normal pre-service scan. Keep an eye on the current KitchenPulse decision and standard pacing.",
  };
}

function cardFromEvent(event, kind) {
  if (!event) {
    return kind === "booked"
      ? {
          tone: "Quiet",
          title: "No private event pressure",
          meta: "No booked demand in today’s service window",
          body: "No active Tripleseat/private event is currently driving the Shift Watch.",
          recordId: "",
          reasonSelected: "No booked event matched the current service window.",
        }
      : {
          tone: "Clear",
          title: "Outside pressure clear",
          meta: "No outside surge in today’s service window",
          body: "Outside pressure looks clear. Focus stays on booked demand, coverage, and today’s decision.",
          recordId: "",
          reasonSelected: "No qualifying local/public event matched the current service window.",
        };
  }

  return {
    tone: event.pressure,
    title: event.name,
    meta: `${event.formattedStart}${event.venue ? ` • ${event.venue}` : ""}`,
    body:
      event.summary ||
      event.decisionNote ||
      (kind === "booked"
        ? "Booked demand may increase kitchen, bar, and manager load during this service window."
        : "Local demand may affect pacing and walk-in flow during this service window."),
    recordId: event.id,
    externalEventId: event.externalEventId,
    reasonSelected: event.reasonSelected,
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const now = new Date();
    const restaurantId = clean(req.query?.restaurantId || DEFAULT_RESTAURANT_ID);
    const includeDebug = String(req.query?.debug || "") === "1";

    const [records, staffing] = await Promise.all([fetchAirtableEvents(), fetchStaffing()]);

    const rawCandidates = records.filter((record) => {
      const fields = record.fields || {};
      return isActiveEvent(fields) && restaurantMatches(fields, restaurantId) && isWatchWindow(fields, now);
    });

    const events = dedupeEvents(rawCandidates.map((record) => normalizeEvent(record, now)));
    const sortedBooked = sortWatchEvents(events.filter((event) => event.booked), now);
    const sortedLocal = sortWatchEvents(events.filter((event) => event.local), now);

    const selectedBooked = sortedBooked[0] || null;
    const selectedLocal = sortedLocal[0] || null;

    if (selectedBooked) {
      selectedBooked.reasonSelected = selectedBooked.currentlyHappening
        ? "Selected because it is a live Tripleseat/private event in the current service window."
        : "Selected because it is the next Tripleseat/private event in today’s service window.";
    }

    if (selectedLocal) {
      selectedLocal.reasonSelected = selectedLocal.currentlyHappening
        ? "Selected because it is a live local/public pressure event in the current service window."
        : "Selected because it is the next qualifying local/public pressure event in today’s service window.";
    }

    const coverage = buildCoverage(staffing);
    const spice = buildSpice({
      bookedDemand: selectedBooked,
      localPressure: selectedLocal,
      coverage,
      events,
      staffing,
    });

    const payload = {
      ok: true,
      generatedAt: now.toISOString(),
      restaurantId,
      localPressure: cardFromEvent(selectedLocal, "local"),
      bookedDemand: cardFromEvent(selectedBooked, "booked"),
      coverage,
      shiftSpice: spice,
      diagnostics: {
        activeTodayEventCount: events.length,
        bookedCandidateCount: sortedBooked.length,
        localCandidateCount: sortedLocal.length,
        selectedBookedRecordId: selectedBooked?.id || "",
        selectedLocalRecordId: selectedLocal?.id || "",
        selectionModel: "server-side Airtable pagination + ET service window + source classification + dedupe",
      },
    };

    if (includeDebug) {
      payload.debug = {
        nowEtDate: etDateKey(now),
        rawCandidateCount: rawCandidates.length,
        candidates: events.map((event) => ({
          id: event.id,
          name: event.name,
          start: event.start,
          source: event.source,
          venue: event.venue,
          booked: event.booked,
          local: event.local,
          score: event.score,
          pressure: event.pressure,
        })),
      };
    }

    return sendJson(res, 200, payload);
  } catch (error) {
    console.error("shift-watch error", error);
    return sendJson(res, 500, {
      ok: false,
      error: error.message || "Failed to build Shift Watch.",
    });
  }
};
