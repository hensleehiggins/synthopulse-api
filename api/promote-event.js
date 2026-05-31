/********************************************************************
 * SynthoPulse / KitchenPulse API
 * Route: api/promote-event.js
 * Version: v1.1
 *
 * Purpose:
 * - Promote a reviewed event into live External Factors demand context.
 * - Support promotion from:
 *   - Event Intake Queue
 *   - External Factors
 * - Protect KitchenPulse from accidentally promoting weather, notes,
 *   admin tasks, cancelled/lost/closed events, or malformed records.
 *
 * Method:
 * - POST /api/promote-event
 *
 * Body:
 * {
 *   "recordId": "rec...",
 *   "sourceTable": "Event Intake Queue" | "External Factors"
 * }
 *
 * Reads:
 * - Event Intake Queue
 * - External Factors
 *
 * Writes:
 * - External Factors
 * - Event Intake Queue, when promoting from intake
 *
 * Does NOT:
 * - Touch POS Runs
 * - Touch Daily Sales
 * - Touch Forecasts & Insights
 * - Touch Decision Layer output directly
 *
 * Safety:
 * - Requires a valid event name and start date/time.
 * - Refuses Tripleseat records marked Review / Non-Demand.
 * - Refuses cancelled/lost/closed records.
 * - Refuses External Factors records that are not Type = Event.
 ********************************************************************/

import Airtable from "airtable";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function bool(value) {
  return value === true;
}

function linkedIds(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") return item.id || "";
      return "";
    })
    .filter(Boolean);
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

function toIso(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function isFutureOrToday(value) {
  if (!value) return false;

  const eventKey = easternDateKey(value);
  const todayKey = easternDateKey(new Date());

  return Boolean(eventKey && todayKey && eventKey >= todayKey);
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

function escapeFormulaString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function getDrawLabel(guestCount, suggestedWeight) {
  if (guestCount >= 75 || suggestedWeight >= 9) return "Very High";
  if (guestCount >= 50 || suggestedWeight >= 8) return "High";
  if (guestCount >= 30 || suggestedWeight >= 6) return "Medium";
  return "Low";
}

function getTrafficEffect(guestCount, suggestedWeight) {
  if (guestCount >= 75 || suggestedWeight >= 9) return "Very High";
  if (guestCount >= 50 || suggestedWeight >= 8) return "High";
  if (guestCount >= 30 || suggestedWeight >= 6) return "Moderate";
  return "Low";
}

function buildExternalEventId(fields) {
  const existing = text(fields["External Event ID"]);
  if (existing) return existing;

  const tripleseatId =
    text(fields["Tripleseat Event ID"]) || text(fields["Source Event ID"]);

  if (tripleseatId) return `tripleseat-${tripleseatId}`;

  const localName = text(fields["Event Name"]);
  const start = text(fields["Start DateTime"] || fields["Start Time"]);

  if (localName && start) {
    return `manual-${localName}-${start}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);
  }

  return "";
}

function buildEventSummary({ eventName, guestCount, venue, startText }) {
  return `${eventName} is a confirmed ${guestCount || "booked"}-guest event${
    venue ? ` in ${venue}` : ""
  }${startText ? ` at ${startText}` : ""}. Confirm room coverage, pacing, and kitchen/bar awareness before service.`;
}

function buildDecisionNote({ eventName, guestCount, venue }) {
  return `Confirmed event: ${eventName}${
    guestCount ? `, ${guestCount} guests` : ""
  }${
    venue ? `, ${venue}` : ""
  }. Treat as booked demand pressure for pre-shift planning, room coverage, pacing, and handoff notes.`;
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

function eventBlob(fields) {
  return [
    fields["Event Name"],
    fields["Description"],
    fields["Notes"],
    fields["Event Type / Meal Period"],
    fields["Room / Space"],
    fields["Venue / Area"],
    fields["Tripleseat Record Type"],
    fields["Status"],
    fields["Tripleseat Status"],
  ]
    .map(text)
    .join(" ")
    .toLowerCase();
}

function isAdminOrNonDemand(fields) {
  const blob = eventBlob(fields);

  const phrases = [
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

  return phrases.some((phrase) => blob.includes(phrase));
}

function validateIntakeFieldsForPromotion(fields) {
  const eventName = text(fields["Event Name"]);
  const startDateTime = toIso(fields["Start DateTime"]);
  const status = normalizeStatus(
    fields["Tripleseat Status"] || fields["Status"]
  );

  const recordType = text(fields["Tripleseat Record Type"]);

  if (!eventName) {
    throw new Error("Cannot promote intake record without Event Name.");
  }

  if (!startDateTime) {
    throw new Error("Cannot promote intake record without valid Start DateTime.");
  }

  if (!isFutureOrToday(startDateTime)) {
    throw new Error("Cannot promote past event into live demand pressure.");
  }

  if (recordType && recordType !== "Event") {
    throw new Error(
      `Cannot promote intake record because Tripleseat Record Type is "${recordType}", not Event.`
    );
  }

  if (status === "Cancelled" || status === "Lost" || status === "Closed") {
    throw new Error(`Cannot promote event with Tripleseat status "${status}".`);
  }

  if (isAdminOrNonDemand(fields)) {
    throw new Error(
      "Cannot promote this record because it looks like an admin/task/test/non-demand item."
    );
  }

  return true;
}

function validateExternalFieldsForPromotion(fields) {
  const type = text(fields.Type);
  const eventName = text(fields["Event Name"]) || text(fields.Description);
  const startDateTime = toIso(
    fields["Start DateTime"] || fields["Start Time"] || fields["Forecast Date"]
  );

  if (type && type !== "Event") {
    throw new Error(`Cannot promote External Factors record because Type is "${type}", not Event.`);
  }

  if (!eventName) {
    throw new Error("Cannot promote External Factors record without Event Name or Description.");
  }

  if (!startDateTime) {
    throw new Error("Cannot promote External Factors record without valid Start DateTime / Start Time / Forecast Date.");
  }

  if (!isFutureOrToday(startDateTime)) {
    throw new Error("Cannot promote past External Factors event into live demand pressure.");
  }

  if (isAdminOrNonDemand(fields)) {
    throw new Error(
      "Cannot promote this External Factors record because it looks like an admin/task/test/non-demand item."
    );
  }

  return true;
}

async function findExternalFactorByExternalEventId(base, externalEventId) {
  if (!externalEventId) return null;

  const matches = await base("External Factors")
    .select({
      maxRecords: 1,
      filterByFormula: `{External Event ID} = "${escapeFormulaString(externalEventId)}"`,
    })
    .firstPage();

  return matches[0] || null;
}

async function promoteExternalFactorRecord(base, recordId) {
  const existing = await base("External Factors").find(recordId);
  const fields = existing.fields || {};

  validateExternalFieldsForPromotion(fields);

  const updated = await base("External Factors").update(
    recordId,
    {
      Type: "Event",
      "Needs Review": false,
      Active: true,
      "Active (Event)": true,
      "Decision Driving Event": true,
      "Show on Service Pressure": true,
      "Show on Home Alert": true,
      "Auto Imported": bool(fields["Auto Imported"]),
      "Impact Direction": text(fields["Impact Direction"]) || "Positive",
      "Impact Strength": number(fields["Impact Strength"]) || 7,
      "Event Weight": number(fields["Event Weight"]) || 7,
      "Priority Score": number(fields["Priority Score"]) || 7,
      Confidence: text(fields.Confidence) || "High",
    },
    { typecast: true }
  );

  return {
    mode: "external_factor_promoted",
    externalFactorRecordId: updated.id,
    eventName: updated.fields["Event Name"] || updated.fields.Description || "",
  };
}

async function promoteIntakeRecord(base, recordId) {
  const intakeRecord = await base("Event Intake Queue").find(recordId);
  const fields = intakeRecord.fields || {};

  validateIntakeFieldsForPromotion(fields);

  const eventName =
    text(fields["Event Name"]) ||
    `Tripleseat Event ${text(fields["Tripleseat Event ID"]) || text(fields["Source Event ID"])}`;

  const startDateTime = toIso(fields["Start DateTime"]);
  const endDateTime = toIso(fields["End DateTime"]);
  const serviceDate = easternDateKey(fields["Start DateTime"]);

  const guestCount = number(fields["Guest Count"]);
  const suggestedWeight = number(fields["Suggested Event Weight"]) || 7;
  const priorityScore = Math.max(7, suggestedWeight || 7);

  const venue = text(fields["Room / Space"]) || text(fields["Venue / Area"]);
  const externalEventId = buildExternalEventId(fields);
  const drawLabel = getDrawLabel(guestCount, suggestedWeight);
  const trafficEffect = getTrafficEffect(guestCount, suggestedWeight);

  if (!externalEventId) {
    throw new Error("Cannot promote event without External Event ID or Tripleseat Event ID.");
  }

  if (!startDateTime || !serviceDate) {
    throw new Error("Cannot promote event without a valid Start DateTime.");
  }

  const eventSummary =
    text(fields["Event Summary"]) ||
    buildEventSummary({
      eventName,
      guestCount,
      venue,
      startText: "",
    });

  const decisionNote =
    text(fields["Decision Note"]) ||
    buildDecisionNote({
      eventName,
      guestCount,
      venue,
    });

  const restaurantLinks = linkedIds(fields.Restaurant);

  const externalFields = removeEmptyFields({
    "Display Date": serviceDate,
    Date: serviceDate,
    "Forecast Date": serviceDate,

    Type: "Event",
    "Event Name": eventName,
    Description:
      text(fields["Notes"]) ||
      `${eventName}${guestCount ? ` — ${guestCount} guests` : ""}${
        venue ? ` in ${venue}` : ""
      }.`,
    "Source Type": text(fields.Source) || "Tripleseat",
    Source: text(fields.Source) || "Tripleseat",
    "Event Type": "Private Event",
    "Venue / Area": venue,

    "Start Time": startDateTime,
    "End Time": endDateTime,
    "Start DateTime": startDateTime,
    "End DateTime": endDateTime,

    Restaurant: restaurantLinks,

    "Estimated Draw": drawLabel,
    "Traffic Effect": trafficEffect,
    Confidence: "High",
    "Impact Direction": "Positive",
    "Impact Strength": priorityScore,
    "Event Weight": priorityScore,
    "Priority Score": priorityScore,

    Active: true,
    "Active (Event)": true,
    "Decision Driving Event": true,
    "Show on Service Pressure": true,
    "Show on Home Alert": true,
    "Auto Imported": true,
    "Needs Review": false,

    "External Event ID": externalEventId,
    "Event Summary": eventSummary,
    "Decision Note": decisionNote,
  });

  const existingExternalFactor = await findExternalFactorByExternalEventId(
    base,
    externalEventId
  );

  let externalFactorRecord;

  if (existingExternalFactor) {
    externalFactorRecord = await base("External Factors").update(
      existingExternalFactor.id,
      externalFields,
      { typecast: true }
    );
  } else {
    externalFactorRecord = await base("External Factors").create(externalFields, {
      typecast: true,
    });
  }

  await base("Event Intake Queue").update(
    recordId,
    {
      Status: "Processed",
      "Needs Review": false,
      "Promote to Decision": true,
      "Tripleseat Record Type": "Event",
      "External Event ID": externalEventId,
    },
    { typecast: true }
  );

  return {
    mode: existingExternalFactor
      ? "intake_promoted_external_updated"
      : "intake_promoted_external_created",
    intakeRecordId: recordId,
    externalFactorRecordId: externalFactorRecord.id,
    externalEventId,
    eventName,
    serviceDate,
  };
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      route: "/api/promote-event",
      version: "v1.1",
      error: "Method not allowed",
    });
  }

  try {
    const { recordId, sourceTable } = req.body || {};

    if (!recordId) {
      return res.status(400).json({
        ok: false,
        route: "/api/promote-event",
        version: "v1.1",
        error: "Missing recordId",
      });
    }

    const base = getBase();

    let result;

    if (sourceTable === "External Factors") {
      result = await promoteExternalFactorRecord(base, recordId);
    } else if (sourceTable === "Event Intake Queue" || !sourceTable) {
      result = await promoteIntakeRecord(base, recordId);
    } else {
      return res.status(400).json({
        ok: false,
        route: "/api/promote-event",
        version: "v1.1",
        error: `Unsupported sourceTable: ${sourceTable}`,
      });
    }

    return res.status(200).json({
      ok: true,
      route: "/api/promote-event",
      version: "v1.1",
      ...result,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("promote-event failed:", err);

    return res.status(500).json({
      ok: false,
      route: "/api/promote-event",
      version: "v1.1",
      error: err.message || "Event promotion failed.",
      generatedAt: new Date().toISOString(),
    });
  }
}
