import Airtable from "airtable";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(
    process.env.AIRTABLE_BASE_ID
  );
}

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function linkedIds(value) {
  return Array.isArray(value) ? value : [];
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

  return "";
}

function buildEventSummary({ eventName, guestCount, venue, startText }) {
  return `${eventName} is a confirmed ${guestCount || "booked"}-guest Tripleseat event${
    venue ? ` in ${venue}` : ""
  }${startText ? ` at ${startText}` : ""}. Confirm room coverage, pacing, and kitchen/bar awareness before service.`;
}

function buildDecisionNote({ eventName, guestCount, venue }) {
  return `Confirmed Tripleseat private event: ${eventName}${
    guestCount ? `, ${guestCount} guests` : ""
  }${venue ? `, ${venue}` : ""}. Treat as booked demand pressure for pre-shift planning, room coverage, pacing, and handoff notes.`;
}

function removeEmptyFields(fields) {
  const cleaned = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === "") continue;
    cleaned[key] = value;
  }

  return cleaned;
}

async function findExternalFactorByExternalEventId(base, externalEventId) {
  if (!externalEventId) return null;

  const matches = await base("External Factors")
    .select({
      maxRecords: 1,
      filterByFormula: `{External Event ID} = "${externalEventId.replace(/"/g, '\\"')}"`,
    })
    .firstPage();

  return matches[0] || null;
}

async function promoteExternalFactorRecord(base, recordId) {
  const updated = await base("External Factors").update(recordId, {
    "Needs Review": false,
    Active: true,
    "Active (Event)": true,
    "Decision Driving Event": true,
    "Show on Service Pressure": true,
    "Show on Home Alert": true,
    "Auto Imported": true,
    "Impact Direction": "Positive",
    "Impact Strength": 7,
    "Event Weight": 7,
    "Priority Score": 7,
    Confidence: "High",
  });

  return {
    mode: "external_factor_promoted",
    externalFactorRecordId: updated.id,
  };
}

async function promoteIntakeRecord(base, recordId) {
  const intakeRecord = await base("Event Intake Queue").find(recordId);
  const fields = intakeRecord.fields || {};

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
    "Source Type": "Tripleseat",
    Source: "Tripleseat",
    "Event Type": "Private Event",
    "Venue / Area": venue,

    "Start Time": startDateTime,
    "End Time": endDateTime,
    "Start DateTime": startDateTime,
    "End DateTime": endDateTime,

    Restaurant: linkedIds(fields.Restaurant),

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
      externalFields
    );
  } else {
    externalFactorRecord = await base("External Factors").create(externalFields);
  }

  await base("Event Intake Queue").update(recordId, {
    Status: "Processed",
    "Needs Review": false,
    "Promote to Decision": true,
    "Tripleseat Record Type": "Event",
    "External Event ID": externalEventId,
  });

  return {
    mode: existingExternalFactor
      ? "intake_promoted_external_updated"
      : "intake_promoted_external_created",
    intakeRecordId: recordId,
    externalFactorRecordId: externalFactorRecord.id,
    externalEventId,
  };
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { recordId, sourceTable } = req.body || {};

    if (!recordId) {
      return res.status(400).json({ ok: false, error: "Missing recordId" });
    }

    const base = getBase();

    let result;

    if (sourceTable === "External Factors") {
      result = await promoteExternalFactorRecord(base, recordId);
    } else {
      try {
        result = await promoteIntakeRecord(base, recordId);
      } catch (intakeError) {
        if (sourceTable === "Event Intake Queue") {
          throw intakeError;
        }

        result = await promoteExternalFactorRecord(base, recordId);
      }
    }

    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("promote-event failed:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Event promotion failed.",
    });
  }
}
