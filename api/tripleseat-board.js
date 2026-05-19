const Airtable = require("airtable");

const base = new Airtable({
  apiKey: process.env.AIRTABLE_PAT,
}).base(process.env.AIRTABLE_BASE_ID);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function send(res, status, body) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  res.status(status).json(body);
}

function text(value) {
  if (!value) return "";

  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.name) return item.name;
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }

  if (value?.name) return value.name;

  return String(value);
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

function intakeRecord(record) {
  const fields = record.fields || {};
  const start = fields["Start DateTime"];

  return {
    id: record.id,
    eventName: text(fields["Event Name"]) || "Unnamed Tripleseat event",
    startDateTime: toIso(start),
    dateLabel: formatDateLabel(start),
    venueArea: text(fields["Venue / Area"]),
    city: text(fields["City"]),
    source: text(fields["Source"]),
    status: text(fields["Status"]),
    tripleseatStatus: text(fields["Tripleseat Status"]),
    guestCount: number(fields["Guest Count"]),
    eventType: text(fields["Event Type / Meal Period"]),
    room: text(fields["Room / Space"]),
    contact: text(fields["Contact / Account"]),
    localConfidence: number(fields["Local Confidence"]),
    suggestedEventWeight: number(fields["Suggested Event Weight"]),
    promoteToDecision: bool(fields["Promote to Decision"]),
    needsReview: bool(fields["Needs Review"]),
  };
}

function externalRecord(record) {
  const fields = record.fields || {};
  const start = fields["Start DateTime"];

  return {
    id: record.id,
    eventName:
      text(fields["Event Name"]) ||
      text(fields["Description"]) ||
      "Unnamed private event",
    description: text(fields["Description"]),
    startDateTime: toIso(start),
    endDateTime: toIso(fields["End DateTime"]),
    dateLabel: formatDateLabel(start),
    venueArea: text(fields["Venue / Area"]),
    active: bool(fields["Active"]),
    eventWeight: number(fields["Event Weight"]),
    impactStrength: number(fields["Impact Strength"]),
    estimatedDraw: text(fields["Estimated Draw"]),
    trafficEffect: text(fields["Traffic Effect"]),
    confidence: text(fields["Confidence"]),
    decisionDrivingEvent: bool(fields["Decision Driving Event"]),
    externalEventId: text(fields["External Event ID"]),
    eventSummary: text(fields["Event Summary"]),
    decisionNote: text(fields["Decision Note"]),
    notes: text(fields["Notes"]),
    source: text(fields["Source"]),
    sourceType: text(fields["Source Type"]),
  };
}

function isTripleseatOrPrivateDemand(record) {
  const fields = record.fields || {};

  const type = text(fields["Type"]).toLowerCase();
  if (type !== "event") return false;

  if (!bool(fields["Active"])) return false;

  const externalEventId = text(fields["External Event ID"]).toLowerCase();
  const notes = text(fields["Notes"]).toLowerCase();
  const summary = text(fields["Event Summary"]).toLowerCase();
  const source = text(fields["Source"]).toLowerCase();
  const sourceType = text(fields["Source Type"]).toLowerCase();
  const venueArea = text(fields["Venue / Area"]).toLowerCase();
  const eventName = text(fields["Event Name"]).toLowerCase();
  const description = text(fields["Description"]).toLowerCase();
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
    externalEventId.includes("ts-") ||
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

async function getAllRecords(tableName, options = {}) {
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
    return send(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const [intakeRecords, externalRecords] = await Promise.all([
      getAllRecords("Event Intake Queue", {
        fields: [
          "Event Name",
          "Start DateTime",
          "Venue / Area",
          "City",
          "Source",
          "Status",
          "Tripleseat Status",
          "Guest Count",
          "Event Type / Meal Period",
          "Room / Space",
          "Contact / Account",
          "Local Confidence",
          "Suggested Event Weight",
          "Promote to Decision",
          "Needs Review",
        ],
      }),
      getAllRecords("External Factors", {
        fields: [
          "Type",
          "Event Name",
          "Description",
          "Start DateTime",
          "End DateTime",
          "Venue / Area",
          "Active",
          "Event Weight",
          "Impact Strength",
          "Estimated Draw",
          "Traffic Effect",
          "Confidence",
          "Decision Driving Event",
          "External Event ID",
          "Event Summary",
          "Decision Note",
          "Notes",
          "Source",
          "Source Type",
        ],
      }),
    ]);

    const needsReview = intakeRecords
      .filter((record) => {
        const fields = record.fields || {};
        const source = text(fields["Source"]).toLowerCase();
        const status = text(fields["Status"]).toLowerCase();

        return (
          source === "tripleseat" &&
          status !== "processed" &&
          status !== "ignored" &&
          bool(fields["Needs Review"])
        );
      })
      .map(intakeRecord)
      .filter((event) => isFutureOrToday(event.startDateTime))
      .sort(
        (a, b) =>
          new Date(a.startDateTime || 0) - new Date(b.startDateTime || 0)
      )
      .slice(0, 10);

    const privateEvents = externalRecords
      .filter(isTripleseatOrPrivateDemand)
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
          event.impactStrength >= 8
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
      stats,
      needsReview,
      decisionDrivers,
      activeToday,
      upcomingBookedDemand,
      privateEvents,
    });
  } catch (error) {
    console.error("tripleseat-board error", error);

    return send(res, 500, {
      ok: false,
      error: error.message || "Failed to load Tripleseat board",
    });
  }
};
