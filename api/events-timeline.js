/********************************************************************
 * SynthoPulse / KitchenPulse API
 * Route: api/events-timeline.js
 * Version: v1.1
 *
 * Purpose:
 * - Return upcoming External Factors events for the Softr Events / Local
 *   Demand Signals page.
 * - Keep weather and non-event context out of the event timeline.
 * - Prefer Event Name over Description.
 * - Support future multi-tenant filtering with ?restaurantId=rec...
 * - Fail closed with a useful JSON response instead of a Vercel crash page.
 *
 * Method:
 * - GET /api/events-timeline
 * - GET /api/events-timeline?restaurantId=recXXXXXXXXXXXXXX
 *
 * Reads:
 * - External Factors
 *
 * Writes:
 * - Nothing
 *
 * Notes:
 * - This route intentionally does not read Runs or decision-run gates.
 * - It only serves upcoming event/context records.
 ********************************************************************/

const Airtable = require("airtable");

const DEFAULT_RESTAURANT_ID = "recn2LoRESKN33zHW"; // Chloe's Steakhouse

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getEnv(name, aliases = []) {
  const keys = [name, ...aliases];

  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }

  return "";
}

function getBase() {
  const token = getEnv("AIRTABLE_PAT", [
    "AIRTABLE_TOKEN",
    "AIRTABLE_API_KEY",
    "AIRTABLE_PERSONAL_ACCESS_TOKEN",
  ]);

  const baseId = getEnv("AIRTABLE_BASE_ID", ["KITCHENPULSE_BASE_ID"]);

  if (!token) {
    throw new Error("Missing Airtable token environment variable.");
  }

  if (!baseId) {
    throw new Error("Missing Airtable base ID environment variable.");
  }

  return new Airtable({ apiKey: token }).base(baseId);
}

function escapeFormulaString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function bool(value) {
  return value === true;
}

function toIso(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString();
}

function easternDateKey(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDateLabel(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function isFutureOrToday(value) {
  if (!value) return true;

  const eventKey = easternDateKey(value);
  if (!eventKey) return true;

  const todayKey = easternDateKey(new Date());

  return eventKey >= todayKey;
}

function getPrimaryDate(fields) {
  return (
    fields["Start DateTime"] ||
    fields["Start Time"] ||
    fields["Display Date"] ||
    fields["Forecast Date"] ||
    fields["Event Sort Date"] ||
    ""
  );
}

function getEventName(fields) {
  return (
    text(fields["Event Name"]) ||
    text(fields["Description"]) ||
    "Untitled event"
  );
}

function getLinkedRestaurantIds(fields) {
  const links = fields["Restaurant"];

  if (!Array.isArray(links)) return [];

  return links
    .map((link) => {
      if (typeof link === "string") return link;
      if (link && typeof link === "object") return link.id || "";
      return "";
    })
    .filter(Boolean);
}

function externalEventRecord(record) {
  const fields = record.fields || {};
  const start = getPrimaryDate(fields);

  return {
    id: record.id,
    recordId: record.id,

    name: getEventName(fields),
    eventName: getEventName(fields),
    description: text(fields["Description"]),

    start: toIso(start),
    startDateTime: toIso(fields["Start DateTime"] || fields["Start Time"] || start),
    end: toIso(fields["End DateTime"] || fields["End Time"]),
    endDateTime: toIso(fields["End DateTime"] || fields["End Time"]),
    dateLabel: formatDateLabel(start),

    venue: text(fields["Venue / Area"]),
    venueArea: text(fields["Venue / Area"]),

    type: text(fields["Type"]),
    source: text(fields["Source"]),
    sourceType: text(fields["Source Type"]),

    trafficEffect: text(fields["Traffic Effect"]),
    confidence: text(fields["Confidence"]),
    estimatedDraw: text(fields["Estimated Draw"]),

    eventWeight: number(fields["Event Weight"]),
    impactStrength: number(fields["Impact Strength"]),
    priorityScore:
      number(fields["Priority Score"]) || number(fields["Auto Priority Score"]),

    decisionDriving: bool(fields["Decision Driving Event"]),
    decisionDrivingEvent: bool(fields["Decision Driving Event"]),

    active: bool(fields["Active"]),
    activeEvent: bool(fields["Active (Event)"]),
    activeNow: bool(fields["Active Now (Event)"]),

    showOnHomeAlert: bool(fields["Show on Home Alert"]),
    showOnServicePressure: bool(fields["Show on Service Pressure"]),

    needsReview: bool(fields["Needs Review"]),
    autoImported: bool(fields["Auto Imported"]),

    decisionHint: text(fields["Decision Hint"]),
    decisionNote: text(fields["Decision Note"]),
    eventSummary: text(fields["Event Summary"]),

    restaurantIds: getLinkedRestaurantIds(fields),
  };
}

function buildFormula() {
  return `
    AND(
      {Type} = "Event",
      {Active} = TRUE(),
      OR(
        IS_SAME({Start DateTime}, TODAY(), 'day'),
        IS_AFTER({Start DateTime}, TODAY()),
        IS_SAME({Event Sort Date}, TODAY(), 'day'),
        IS_AFTER({Event Sort Date}, TODAY()),
        IS_SAME({Display Date}, TODAY(), 'day'),
        IS_AFTER({Display Date}, TODAY())
      )
    )
  `;
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      route: "events-timeline",
      error: "Method not allowed",
    });
  }

  try {
    const base = getBase();

    const restaurantId =
      text(req.query?.restaurantId) ||
      text(req.query?.restaurant) ||
      DEFAULT_RESTAURANT_ID;

const records = await base("External Factors")
  .select({
    filterByFormula: buildFormula(),
    maxRecords: 60,
    sort: [{ field: "Start DateTime", direction: "asc" }],
  })
  .firstPage();

const events = records
  .map(externalEventRecord)
  .filter((event) => {
    if (!restaurantId) return true;
    if (!event.restaurantIds || event.restaurantIds.length === 0) return true;
    return event.restaurantIds.includes(restaurantId);
  })
  .filter((event) => isFutureOrToday(event.startDateTime || event.start))
      .sort((a, b) => {
        const aMs = new Date(a.startDateTime || a.start || 0).getTime();
        const bMs = new Date(b.startDateTime || b.start || 0).getTime();

        if (!Number.isFinite(aMs) && !Number.isFinite(bMs)) return 0;
        if (!Number.isFinite(aMs)) return 1;
        if (!Number.isFinite(bMs)) return -1;

        return aMs - bMs;
      });

    return res.status(200).json({
      ok: true,
      route: "events-timeline",
      version: "v1.1",
      restaurantId,
      count: events.length,
      events,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      route: "events-timeline",
      version: "v1.1",
      error: err.message,
      generatedAt: new Date().toISOString(),
    });
  }
}
