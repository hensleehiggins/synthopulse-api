/********************************************************************
 * SynthoPulse / KitchenPulse API
 * Route: api/tripleseat-board.js
 * Version: v1.1
 *
 * Purpose:
 * - Return Tripleseat/private-event board data for Softr/Vibe.
 * - Separate review queue, active today, decision drivers, and upcoming
 *   booked demand.
 * - Keep admin/task/demo/weather/non-event records out of the board.
 * - Support future multi-tenant filtering with ?restaurantId=rec...
 *
 * Method:
 * - GET /api/tripleseat-board
 * - GET /api/tripleseat-board?restaurantId=recXXXXXXXXXXXXXX
 *
 * Reads:
 * - Event Intake Queue
 * - External Factors
 *
 * Writes:
 * - Nothing
 *
 * Does NOT:
 * - Promote events
 * - Approve/deny events
 * - Touch POS Runs
 * - Touch Decision Layer output
 ********************************************************************/

const Airtable = require("airtable");

const DEFAULT_RESTAURANT_ID = "recn2LoRESKN33zHW"; // Chloe's Steakhouse

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

function send(res, status, body) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(status).json(body);
}

function text(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") return value.trim();

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.name) return item.name;
        if (item?.id) return item.id;
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }

  if (value?.name) return String(value.name).trim();
  if (value?.id) return String(value.id).trim();

  return String(value).trim();
}

function bool(value) {
  return value === true;
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toIso(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function linkedIds(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item?.id) return item.id;
      return "";
    })
    .filter(Boolean);
}

function belongsToRestaurant(fields, restaurantId) {
  const ids = linkedIds(fields.Restaurant);

  if (!restaurantId) return true;

  // If an older event has no Restaurant link, allow it for Chloe only.
  if (ids.length === 0 && restaurantId === DEFAULT_RESTAURANT_ID) return true;

  return ids.includes(restaurantId);
}

function formatDateLabel(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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

function isFutureOrToday(value) {
  if (!value) return true;

  const eventKey = easternDateKey(value);
  if (!eventKey) return true;

  const todayKey = easternDateKey(new Date());

  return eventKey >= todayKey;
}

function isToday(value) {
  if (!value) return false;

  const eventKey = easternDateKey(value);
  const todayKey = easternDateKey(new Date());

  return Boolean(eventKey && todayKey && eventKey === todayKey);
}

function eventBlob(fields) {
  return [
    fields["Event Name"],
    fields.Description,
    fields.Notes,
    fields["Event Type"],
    fields["Event Type / Meal Period"],
    fields["Venue / Area"],
    fields["Room / Space"],
    fields["Tripleseat Record Type"],
    fields.Status,
    fields["Tripleseat Status"],
    fields.Source,
    fields["Source Type"],
    fields.Type,
  ]
    .map(text)
    .join(" ")
    .toLowerCase();
}

function looksAdminOrNonDemand(fields) {
  const blob = eventBlob(fields);

  const blocked = [
    "menu finalization",
    "menu finalisation",
    "menu pending",
    "final menu",
    "deposit follow",
    "deposit due",
    "deposit pending",
    "payment due",
    "payment follow",
    "balance due",
    "contract pending",
    "contract due",
    "contract follow",
    "beo review",
    "beo pending",
    "final count",
    "guest count due",
    "headcount due",
    "planning call",
    "planning meeting",
    "internal hold",
    "admin hold",
    "staff meeting",
    "manager meeting",
    "filmed interview",
    "interview",
    "task",
    "todo",
    "to-do",
    "reminder",
    "note",
    "follow up",
    "follow-up",
    "demo",
    "test event",
    "webhook test",
    "api test",
  ];

  return blocked.some((phrase) => blob.includes(phrase));
}

function normalizeStatus(value) {
  const status = text(value).toUpperCase();

  if (status.includes("DEFINITE")) return "Definite";
  if (status.includes("CONFIRMED")) return "Confirmed";
  if (status.includes("TENTATIVE")) return "Tentative";
  if (status.includes("PROSPECT")) return "Prospect";
  if (status.includes("CANCEL")) return "Cancelled";
  if (status.includes("LOST")) return "Lost";
  if (status.includes("CLOSED")) return "Closed";

  return text(value);
}

function isClosedStatus(fields) {
  const status = normalizeStatus(fields["Tripleseat Status"] || fields.Status);

  return status === "Cancelled" || status === "Lost" || status === "Closed";
}

function intakeRecord(record) {
  const fields = record.fields || {};
  const start = fields["Start DateTime"];

  return {
    id: record.id,
    recordId: record.id,
    eventName: text(fields["Event Name"]) || "Unnamed Tripleseat event",
    startDateTime: toIso(start),
    dateLabel: formatDateLabel(start),
    venueArea: text(fields["Venue / Area"]) || text(fields["Room / Space"]),
    city: text(fields.City),
    source: text(fields.Source),
    status: text(fields.Status),
    tripleseatStatus: text(fields["Tripleseat Status"]),
    tripleseatRecordType: text(fields["Tripleseat Record Type"]),
    guestCount: number(fields["Guest Count"]),
    eventType: text(fields["Event Type / Meal Period"]),
    room: text(fields["Room / Space"]),
    contact: text(fields["Contact / Account"]),
    localConfidence: number(fields["Local Confidence"]),
    suggestedEventWeight: number(fields["Suggested Event Weight"]),
    promoteToDecision: bool(fields["Promote to Decision"]),
    needsReview: bool(fields["Needs Review"]),
    restaurantIds: linkedIds(fields.Restaurant),
  };
}

function externalRecord(record) {
  const fields = record.fields || {};
  const start = fields["Start DateTime"] || fields["Start Time"];

  return {
    id: record.id,
    recordId: record.id,
    eventName:
      text(fields["Event Name"]) ||
      text(fields.Description) ||
      "Unnamed private event",
    description: text(fields.Description),
    startDateTime: toIso(start),
    endDateTime: toIso(fields["End DateTime"] || fields["End Time"]),
    dateLabel: formatDateLabel(start),
    venueArea: text(fields["Venue / Area"]),
    active: bool(fields.Active),
    activeEvent: bool(fields["Active (Event)"]),
    eventWeight: number(fields["Event Weight"]),
    impactStrength: number(fields["Impact Strength"]),
    priorityScore: number(fields["Priority Score"]),
    estimatedDraw: text(fields["Estimated Draw"]),
    trafficEffect: text(fields["Traffic Effect"]),
    confidence: text(fields.Confidence),
    decisionDrivingEvent: bool(fields["Decision Driving Event"]),
    showOnHomeAlert: bool(fields["Show on Home Alert"]),
    showOnServicePressure: bool(fields["Show on Service Pressure"]),
    externalEventId: text(fields["External Event ID"]),
    eventSummary: text(fields["Event Summary"]),
    decisionNote: text(fields["Decision Note"]),
    notes: text(fields.Notes),
    source: text(fields.Source),
    sourceType: text(fields["Source Type"]),
    restaurantIds: linkedIds(fields.Restaurant),
  };
}

function isTripleseatOrPrivateDemand(record, restaurantId) {
  const fields = record.fields || {};

  if (!belongsToRestaurant(fields, restaurantId)) return false;

  const type = text(fields.Type).toLowerCase();
  if (type !== "event") return false;

  if (!bool(fields.Active)) return false;
  if (isClosedStatus(fields)) return false;
  if (looksAdminOrNonDemand(fields)) return false;

  const externalEventId = text(fields["External Event ID"]).toLowerCase();
  const notes = text(fields.Notes).toLowerCase();
  const summary = text(fields["Event Summary"]).toLowerCase();
  const source = text(fields.Source).toLowerCase();
  const sourceType = text(fields["Source Type"]).toLowerCase();
  const venueArea = text(fields["Venue / Area"]).toLowerCase();
  const eventName = text(fields["Event Name"]).toLowerCase();
  const description = text(fields.Description).toLowerCase();
  const decisionNote = text(fields["Decision Note"]).toLowerCase();

  const blob = [
    externalEventId,
    notes,
    summary,
    source,
    sourceType,
    venueArea,
    eventName,
    description,
    decisionNote,
  ].join(" ");

  const fromTripleseat =
    source.includes("tripleseat") ||
    sourceType.includes("tripleseat") ||
    externalEventId.includes("tripleseat") ||
    blob.includes("tripleseat");

  const privateDemandLanguage =
    blob.includes("private dining") ||
    blob.includes("private event") ||
    blob.includes("private room") ||
    blob.includes("conference dinner") ||
    blob.includes("graduation dinner") ||
    blob.includes("rehearsal dinner") ||
    blob.includes("booked demand") ||
    blob.includes("banquet") ||
    blob.includes("buyout") ||
    blob.includes("corporate dinner") ||
    blob.includes("happy hour");

  return fromTripleseat || privateDemandLanguage;
}

async function getAllRecords(base, tableName, options = {}) {
  const records = [];

  await base(tableName)
    .select(options)
    .eachPage((page, fetchNextPage) => {
      records.push(...page);
      fetchNextPage();
    });

  return records;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return send(res, 200, { ok: true });
  }

  if (req.method !== "GET") {
    return send(res, 405, {
      ok: false,
      route: "/api/tripleseat-board",
      version: "v1.1",
      error: "Method not allowed",
    });
  }

  try {
    const base = getBase();
    const restaurantId =
      text(req.query?.restaurantId) ||
      text(req.query?.restaurant) ||
      DEFAULT_RESTAURANT_ID;

    const [intakeRecords, externalRecords] = await Promise.all([
      getAllRecords(base, "Event Intake Queue", {
        fields: [
          "Event Name",
          "Start DateTime",
          "Venue / Area",
          "City",
          "Source",
          "Status",
         
          "Tripleseat Record Type",
          "Guest Count",
          "Event Type / Meal Period",
          "Room / Space",
          "Contact / Account",
          "Local Confidence",
          "Suggested Event Weight",
          "Promote to Decision",
          "Needs Review",
          "Restaurant",
        ],
      }),
      getAllRecords(base, "External Factors", {
        fields: [
          "Type",
          "Event Name",
          "Description",
          "Start DateTime",
          "End DateTime",
          "Start Time",
          "End Time",
          "Venue / Area",
          "Active",
          "Active (Event)",
          "Event Weight",
          "Impact Strength",
          "Priority Score",
          "Estimated Draw",
          "Traffic Effect",
          "Confidence",
          "Decision Driving Event",
          "Show on Home Alert",
          "Show on Service Pressure",
          "External Event ID",
          "Event Summary",
          "Decision Note",
          "Notes",
          "Source",
          "Source Type",
          "Restaurant",
          
          "Status",
        ],
      }),
    ]);

    const needsReview = intakeRecords
      .filter((record) => {
        const fields = record.fields || {};
        const source = text(fields.Source).toLowerCase();
        const status = text(fields.Status).toLowerCase();
        const recordType = text(fields["Tripleseat Record Type"]);

        if (!belongsToRestaurant(fields, restaurantId)) return false;
        if (source !== "tripleseat") return false;
        if (status === "processed" || status === "ignored") return false;
        if (!bool(fields["Needs Review"])) return false;
        if (recordType && recordType !== "Event") return false;
        if (isClosedStatus(fields)) return false;
        if (looksAdminOrNonDemand(fields)) return false;

        return true;
      })
      .map(intakeRecord)
      .filter((event) => isFutureOrToday(event.startDateTime))
      .sort(
        (a, b) =>
          new Date(a.startDateTime || 0) - new Date(b.startDateTime || 0)
      )
      .slice(0, 6);

    const privateEvents = externalRecords
      .filter((record) => isTripleseatOrPrivateDemand(record, restaurantId))
      .map(externalRecord)
      .filter((event) => isFutureOrToday(event.startDateTime))
      .sort(
        (a, b) =>
          new Date(a.startDateTime || 0) - new Date(b.startDateTime || 0)
      );

    const decisionDrivers = privateEvents
      .filter(
        (event) =>
          event.decisionDrivingEvent ||
          event.eventWeight >= 8 ||
          event.impactStrength >= 8 ||
          event.priorityScore >= 8
      )
      .slice(0, 8);

    const decisionDriverIds = new Set(decisionDrivers.map((event) => event.id));

    const activeToday = privateEvents
      .filter((event) => isToday(event.startDateTime))
      .slice(0, 8);

    const activeTodayIds = new Set(activeToday.map((event) => event.id));

    const upcomingBookedDemand = privateEvents
      .filter((event) => !isToday(event.startDateTime))
      .filter((event) => !decisionDriverIds.has(event.id))
      .filter((event) => !activeTodayIds.has(event.id))
      .slice(0, 12);

    const stats = {
      needsReview: needsReview.length,
      confirmedPrivateEvents: privateEvents.length,
      decisionDrivers: decisionDrivers.length,
      activeToday: activeToday.length,
      upcomingBookedDemand: upcomingBookedDemand.length,
    };

    return send(res, 200, {
      ok: true,
      route: "/api/tripleseat-board",
      version: "v1.1",
      restaurantId,
      stats,
      needsReview,
      decisionDrivers,
      activeToday,
      upcomingBookedDemand,
      privateEvents,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("tripleseat-board error", error);

    return send(res, 500, {
      ok: false,
      route: "/api/tripleseat-board",
      version: "v1.1",
      error: error.message || "Failed to load Tripleseat board",
      generatedAt: new Date().toISOString(),
    });
  }
};
