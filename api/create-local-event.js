/********************************************************************
 * SynthoPulse / KitchenPulse API
 * Route: api/create-local-event.js
 * Version: v1.1
 *
 * Purpose:
 * - Create a manual local/event-pressure record in External Factors.
 * - Used by Softr/Vibe manual event forms.
 * - Supports future multi-tenant use with optional restaurantId.
 * - Converts restaurant-local datetime values into UTC ISO strings.
 * - Avoids over-weighting every manual event as Very High by default.
 *
 * Method:
 * - GET  /api/create-local-event
 * - POST /api/create-local-event
 *
 * Body:
 * {
 *   "eventName": "Downtown Concert",
 *   "startDateTime": "2026-06-01T19:00",
 *   "endDateTime": "2026-06-01T23:00",
 *   "venueArea": "Downtown",
 *   "city": "Winder",
 *   "notes": "Optional notes",
 *   "restaurantId": "rec...",
 *   "estimatedDraw": "High",
 *   "trafficEffect": "Moderate",
 *   "confidence": "High",
 *   "eventWeight": 8
 * }
 *
 * Reads:
 * - Nothing
 *
 * Writes:
 * - External Factors
 *
 * Does NOT:
 * - Touch POS Runs
 * - Touch Forecasts & Insights
 * - Touch Decision Layer output directly
 ********************************************************************/

const Airtable = require("airtable");

const DEFAULT_RESTAURANT_ID = "recn2LoRESKN33zHW"; // Chloe's Steakhouse
const DEFAULT_TIMEZONE = "America/New_York";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
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

  if (!token) throw new Error("Missing Airtable token environment variable.");
  if (!baseId) throw new Error("Missing Airtable base ID environment variable.");

  return new Airtable({ apiKey: token }).base(baseId);
}

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampNumber(value, min, max, fallback) {
  const n = number(value, fallback);
  return Math.max(min, Math.min(max, n));
}

function isValidRecordId(value) {
  return /^rec[A-Za-z0-9]{14}$/.test(text(value));
}

function parseDateTimeLocal(value) {
  const raw = text(value);
  if (!raw) return null;

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0),
  };
}

function getEasternOffsetMinutesForUtcDate(utcDate) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DEFAULT_TIMEZONE,
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(utcDate);

  const tzName = parts.find((part) => part.type === "timeZoneName")?.value || "";
  const match = tzName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);

  if (!match) {
    return -300;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] || 0);

  return sign * (hours * 60 + minutes);
}

function localEasternDateTimeToUtcIso(value) {
  const raw = text(value);
  const parsed = parseDateTimeLocal(raw);

  if (!parsed) {
    const asDate = new Date(raw);
    if (!Number.isNaN(asDate.getTime())) return asDate.toISOString();
    return "";
  }

  const naiveUtcMs = Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    parsed.hour,
    parsed.minute,
    parsed.second
  );

  const firstOffsetMinutes = getEasternOffsetMinutesForUtcDate(new Date(naiveUtcMs));
  let actualUtcMs = naiveUtcMs - firstOffsetMinutes * 60 * 1000;

  const secondOffsetMinutes = getEasternOffsetMinutesForUtcDate(new Date(actualUtcMs));
  actualUtcMs = naiveUtcMs - secondOffsetMinutes * 60 * 1000;

  return new Date(actualUtcMs).toISOString();
}

function easternDateKeyFromInput(value) {
  const parsed = parseDateTimeLocal(value);

  if (parsed) {
    return `${String(parsed.year).padStart(4, "0")}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
  }

  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asDate);
}

function isFutureOrToday(value) {
  const dateKey = easternDateKeyFromInput(value);

  if (!dateKey) return false;

  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return dateKey >= todayKey;
}

function getDefaultEventEnd(startDateTime) {
  const startIso = localEasternDateTimeToUtcIso(startDateTime);

  if (!startIso) return "";

  const start = new Date(startIso);

  if (Number.isNaN(start.getTime())) return "";

  // Default local event pressure window: 4 hours.
  return new Date(start.getTime() + 4 * 60 * 60 * 1000).toISOString();
}

function allowedOrDefault(value, allowed, fallback) {
  const clean = text(value);
  return allowed.includes(clean) ? clean : fallback;
}

function removeEmptyFields(fields) {
  const cleaned = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    cleaned[key] = value;
  }

  return cleaned;
}

function buildExternalEventId({ eventName, startIso, venueArea }) {
  return `manual-${eventName}-${startIso}-${venueArea || "local"}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function looksAdminOrNonDemand({ eventName, venueArea, notes }) {
  const blob = [eventName, venueArea, notes].map(text).join(" ").toLowerCase();

  const blockedPhrases = [
    "menu finalization",
    "deposit follow",
    "payment follow",
    "balance due",
    "contract pending",
    "beo review",
    "final count",
    "planning call",
    "internal hold",
    "staff meeting",
    "manager meeting",
    "task",
    "todo",
    "to-do",
    "reminder",
    "note only",
    "demo",
    "test event",
    "webhook test",
    "api test",
  ];

  return blockedPhrases.some((phrase) => blob.includes(phrase));
}

function buildEventSummary({ eventName, venueArea, estimatedDraw, trafficEffect }) {
  return `${eventName}${venueArea ? ` near ${venueArea}` : ""} is expected to create ${estimatedDraw.toLowerCase()} local demand with ${trafficEffect.toLowerCase()} traffic effect.`;
}

function buildDecisionNote({ eventName, venueArea, trafficEffect }) {
  return `Manual local demand signal: ${eventName}${venueArea ? ` near ${venueArea}` : ""}. Watch pacing, staffing awareness, bar/kitchen readiness, and local traffic impact. Traffic effect: ${trafficEffect}.`;
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      route: "/api/create-local-event",
      version: "v1.1",
      message: "Route is live. Use POST to create a local event.",
      generatedAt: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      route: "/api/create-local-event",
      version: "v1.1",
      error: "Method not allowed",
    });
  }

  try {
    const {
      eventName,
      startDateTime,
      endDateTime,
      venueArea,
      city,
      notes,
      restaurantId,
      estimatedDraw,
      trafficEffect,
      confidence,
      eventWeight,
      impactStrength,
      priorityScore,
      showOnHomeAlert,
      showOnServicePressure,
      decisionDrivingEvent,
    } = req.body || {};

    const cleanEventName = text(eventName);
    const cleanVenueArea = text(venueArea);
    const cleanNotes = text(notes);

    if (!cleanEventName || !text(startDateTime)) {
      return res.status(400).json({
        ok: false,
        route: "/api/create-local-event",
        version: "v1.1",
        error: "Event name and start date/time are required.",
      });
    }

    if (looksAdminOrNonDemand({ eventName: cleanEventName, venueArea: cleanVenueArea, notes: cleanNotes })) {
      return res.status(400).json({
        ok: false,
        route: "/api/create-local-event",
        version: "v1.1",
        error: "Refusing to create this as live demand because it looks like an admin/task/test/non-demand item.",
      });
    }

    if (!isFutureOrToday(startDateTime)) {
      return res.status(400).json({
        ok: false,
        route: "/api/create-local-event",
        version: "v1.1",
        error: "Cannot create a past event as live demand context.",
      });
    }

    const startIso = localEasternDateTimeToUtcIso(startDateTime);
    const finalEndDateTime = endDateTime
      ? localEasternDateTimeToUtcIso(endDateTime)
      : getDefaultEventEnd(startDateTime);

    if (!startIso) {
      return res.status(400).json({
        ok: false,
        route: "/api/create-local-event",
        version: "v1.1",
        error: "Invalid start date/time.",
      });
    }

    if (!finalEndDateTime) {
      return res.status(400).json({
        ok: false,
        route: "/api/create-local-event",
        version: "v1.1",
        error: "Invalid end date/time.",
      });
    }

    const startMs = new Date(startIso).getTime();
    const endMs = new Date(finalEndDateTime).getTime();

    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs <= startMs) {
      return res.status(400).json({
        ok: false,
        route: "/api/create-local-event",
        version: "v1.1",
        error: "End date/time must be after start date/time.",
      });
    }

    const resolvedRestaurantId = isValidRecordId(restaurantId)
      ? text(restaurantId)
      : DEFAULT_RESTAURANT_ID;

    const draw = allowedOrDefault(
      estimatedDraw,
      ["Low", "Medium", "High", "Very High"],
      "Medium"
    );

    const traffic = allowedOrDefault(
      trafficEffect,
      ["Low", "Moderate", "High", "Very High"],
      "Moderate"
    );

    const confidenceValue = allowedOrDefault(
      confidence,
      ["Low", "Medium", "High", "Very High"],
      "High"
    );

    const weight = clampNumber(eventWeight ?? impactStrength ?? priorityScore, 1, 10, 6);

    const serviceDate = easternDateKeyFromInput(startDateTime);
    const externalEventId = buildExternalEventId({
      eventName: cleanEventName,
      startIso,
      venueArea: cleanVenueArea,
    });

    const shouldShowOnHomeAlert = showOnHomeAlert !== undefined
      ? Boolean(showOnHomeAlert)
      : weight >= 7;

    const shouldShowOnServicePressure = showOnServicePressure !== undefined
      ? Boolean(showOnServicePressure)
      : true;

    const shouldDriveDecision = decisionDrivingEvent !== undefined
      ? Boolean(decisionDrivingEvent)
      : weight >= 6;

    const base = getBase();

    const createdFields = removeEmptyFields({
      Type: "Event",
      Source: "Manual",
      "Source Type": "Manual",

      "Event Name": cleanEventName,
      Description: cleanEventName,

      "Display Date": serviceDate,
      Date: serviceDate,
      "Forecast Date": serviceDate,

      "Start DateTime": startIso,
      "End DateTime": finalEndDateTime,
      "Start Time": startIso,
      "End Time": finalEndDateTime,

      "Venue / Area": cleanVenueArea,
      City: text(city),
      Restaurant: [resolvedRestaurantId],

      Active: true,
      "Active (Event)": true,
      "Decision Driving Event": shouldDriveDecision,
      "Show on Service Pressure": shouldShowOnServicePressure,
      "Show on Home Alert": shouldShowOnHomeAlert,

      "Traffic Effect": traffic,
      Confidence: confidenceValue,
      "Estimated Draw": draw,
      "Impact Direction": "Positive",
      "Impact Strength": weight,
      "Event Weight": weight,
      "Priority Score": weight,
      "Distance Weight": 2,

      "External Event ID": externalEventId,
      "Event Summary": buildEventSummary({
        eventName: cleanEventName,
        venueArea: cleanVenueArea,
        estimatedDraw: draw,
        trafficEffect: traffic,
      }),
      "Decision Note": buildDecisionNote({
        eventName: cleanEventName,
        venueArea: cleanVenueArea,
        trafficEffect: traffic,
      }),

      "Needs Review": false,
      "Auto Imported": false,
      Notes: cleanNotes || "Submitted manually from KitchenPulse portal.",
    });

    const records = await base("External Factors").create(
      [
        {
          fields: createdFields,
        },
      ],
      { typecast: true }
    );

    const record = records[0];

    return res.status(200).json({
      ok: true,
      route: "/api/create-local-event",
      version: "v1.1",
      id: record.id,
      recordId: record.id,
      event: {
        id: record.id,
        recordId: record.id,
        eventName: cleanEventName,
        description: cleanEventName,
        startDateTime: startIso,
        endDateTime: finalEndDateTime,
        displayDate: serviceDate,
        venueArea: cleanVenueArea,
        city: text(city),
        notes: createdFields.Notes,
        type: "Event",
        source: "Manual",
        sourceType: "Manual",
        showOnServicePressure: shouldShowOnServicePressure,
        showOnHomeAlert: shouldShowOnHomeAlert,
        active: true,
        activeEvent: true,
        decisionDriving: shouldDriveDecision,
        trafficEffect: traffic,
        confidence: confidenceValue,
        estimatedDraw: draw,
        eventWeight: weight,
        externalEventId,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      route: "/api/create-local-event",
      version: "v1.1",
      error: err.message,
      generatedAt: new Date().toISOString(),
    });
  }
};
