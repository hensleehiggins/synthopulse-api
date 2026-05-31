/********************************************************************
 * SynthoPulse / KitchenPulse API
 * Route: api/tripleseat-webhook.js
 * Version: v1.1
 *
 * Purpose:
 * - Receive Tripleseat webhook payloads.
 * - Normalize Tripleseat event-like payloads into Event Intake Queue.
 * - Upsert by Source Event ID to prevent duplicate intake records.
 * - Protect KitchenPulse from Tripleseat notes/tasks/admin reminders
 *   being treated as real demand events.
 *
 * Method:
 * - GET  /api/tripleseat-webhook
 * - POST /api/tripleseat-webhook
 *
 * Reads:
 * - Event Intake Queue, for existing Source Event ID lookup
 *
 * Writes:
 * - Event Intake Queue
 *
 * Does NOT:
 * - Promote directly to External Factors
 * - Write Forecasts & Insights
 * - Touch POS Runs / Decision Layer
 *
 * Important behavior:
 * - Obvious tests/admin/task records are still captured for visibility,
 *   but marked Needs Review and Record Type = Review / Non-Demand.
 * - Real event records are marked Tripleseat Record Type = Event,
 *   Needs Review = true, Status = New.
 ********************************************************************/

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_PAT || process.env.AIRTABLE_TOKEN;
const AIRTABLE_TABLE_NAME = "Event Intake Queue";
const CHLOES_RESTAURANT_ID = process.env.AIRTABLE_CHLOES_RESTAURANT_ID;

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: "Unable to stringify payload",
      message: error.message,
    });
  }
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function numberOrUndefined(value) {
  if (value === null || value === undefined || value === "") return undefined;

  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toDateOnly(value) {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  return date.toISOString().slice(0, 10);
}

function toIsoOrUndefined(value) {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  return date.toISOString();
}

function eventBlob(...values) {
  return values
    .map(text)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
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

function classifyTripleseatRecord(normalized, rawBody) {
  const blob = eventBlob(
    normalized.eventName,
    normalized.eventTypeMealPeriod,
    normalized.roomSpace,
    normalized.contactAccount,
    normalized.tripleseatStatus,
    rawBody?.type,
    rawBody?.event_type,
    rawBody?.action,
    rawBody?.subject,
    rawBody?.name,
    rawBody?.description,
    rawBody?.note,
    rawBody?.task,
    rawBody?.todo
  );

  const adminPhrases = [
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
  ];

  const testPhrases = [
    "webhook test",
    "code test",
    "api test",
    "test event",
    "kitchenpulse test",
    "demo",
  ];

  const hasEventId = Boolean(normalized.sourceEventId);
  const hasEventName = Boolean(text(normalized.eventName));
  const hasStart = Boolean(normalized.startDateTime || normalized.eventDate);
  const hasDemandSignal =
    numberOrUndefined(normalized.guestCount) !== undefined ||
    numberOrUndefined(normalized.estimatedRevenue) !== undefined ||
    numberOrUndefined(normalized.bookedRevenue) !== undefined ||
    Boolean(text(normalized.roomSpace));

  const isAdmin = adminPhrases.some((phrase) => blob.includes(phrase));
  const isTest = testPhrases.some((phrase) => blob.includes(phrase));
  const status = normalizeStatus(normalized.tripleseatStatus);

  if (!hasEventId) {
    return {
      recordType: "Review / Non-Demand",
      status: "Needs Review",
      needsReview: true,
      promoteToDecision: false,
      reason: "Missing Tripleseat event/source ID.",
    };
  }

  if (isTest) {
    return {
      recordType: "Review / Non-Demand",
      status: "Needs Review",
      needsReview: true,
      promoteToDecision: false,
      reason: "Obvious test/demo record. Captured but not treated as demand.",
    };
  }

  if (isAdmin) {
    return {
      recordType: "Review / Non-Demand",
      status: "Needs Review",
      needsReview: true,
      promoteToDecision: false,
      reason: "Admin/task/reminder-style Tripleseat record. Captured for review only.",
    };
  }

  if (status === "Cancelled" || status === "Lost" || status === "Closed") {
    return {
      recordType: "Review / Non-Demand",
      status: "Needs Review",
      needsReview: true,
      promoteToDecision: false,
      reason: `Tripleseat status is ${status}. Captured but not promoted.`,
    };
  }

  if (!hasEventName || !hasStart) {
    return {
      recordType: "Review / Non-Demand",
      status: "Needs Review",
      needsReview: true,
      promoteToDecision: false,
      reason: "Missing event name or start date/time. Captured for review.",
    };
  }

  const guestCount = numberOrUndefined(normalized.guestCount) || 0;
  const isLikelyDecisionDriver =
    (status === "Definite" || status === "Confirmed") &&
    (guestCount >= 30 || hasDemandSignal);

  return {
    recordType: "Event",
    status: "New",
    needsReview: true,
    promoteToDecision: false,
    reason: isLikelyDecisionDriver
      ? "Real Tripleseat event with likely demand signal. Needs review before promotion."
      : "Real Tripleseat event captured. Needs review before promotion.",
  };
}

function normalizeTripleseatPayload(body) {
  const event =
    body?.event ||
    body?.data?.event ||
    body?.booking?.event ||
    body?.payload?.event ||
    body?.data ||
    body ||
    {};

  const sourceEventId = firstDefined(
    event?.id,
    event?.event_id,
    event?.tripleseat_event_id,
    body?.event_id,
    body?.id
  );

  const eventName = firstDefined(
    event?.name,
    event?.event_name,
    event?.title,
    body?.event_name,
    body?.name,
    body?.title,
    "Tripleseat Event"
  );

  const startDateTime = firstDefined(
    event?.start_time,
    event?.starts_at,
    event?.start_datetime,
    event?.startDateTime,
    event?.event_start,
    event?.event_start_iso8601,
    event?.event_start_utc,
    event?.start_date,
    body?.start_time,
    body?.starts_at
  );

  const endDateTime = firstDefined(
    event?.end_time,
    event?.ends_at,
    event?.end_datetime,
    event?.endDateTime,
    event?.event_end,
    event?.event_end_iso8601,
    event?.event_end_utc,
    event?.end_date,
    body?.end_time,
    body?.ends_at
  );

  const updatedAt = firstDefined(
    event?.updated_at,
    event?.updatedAt,
    body?.updated_at,
    body?.updatedAt
  );

  const bookedAt = firstDefined(
    event?.created_at,
    event?.createdAt,
    event?.booked_at,
    event?.bookedAt,
    body?.created_at,
    body?.booked_at
  );

  const guestCount = firstDefined(
    event?.guest_count,
    event?.guestCount,
    event?.guests,
    event?.attendance,
    event?.guaranteed_guest_count
  );

  const estimatedRevenue = firstDefined(
    event?.estimated_revenue,
    event?.estimatedRevenue,
    event?.revenue_estimate,
    event?.total_event_grand_total,
    event?.grand_total,
    event?.food_and_beverage_min
  );

  const bookedRevenue = firstDefined(
    event?.booked_revenue,
    event?.bookedRevenue,
    event?.actual_revenue,
    event?.total_revenue,
    event?.total_actual_amount
  );

  return {
    eventName,
    sourceEventId,
    tripleseatEventId: sourceEventId,
    tripleseatStatus: firstDefined(event?.status, event?.event_status, body?.status),
    guestCount,
    roomSpace: firstDefined(
      event?.room_name,
      event?.room,
      event?.space,
      event?.location_name,
      event?.room?.name,
      Array.isArray(event?.rooms)
        ? event.rooms.map((room) => room?.name).filter(Boolean).join(", ")
        : ""
    ),
    contactAccount: firstDefined(
      event?.contact_name,
      event?.contact,
      event?.account_name,
      event?.account,
      event?.customer_name
    ),
    estimatedRevenue,
    bookedRevenue,
    depositPaid: firstDefined(event?.deposit_paid, event?.depositPaid, event?.deposit),
    balanceDue: firstDefined(event?.balance_due, event?.balanceDue),
    eventTypeMealPeriod: firstDefined(event?.event_type, event?.meal_period, event?.type),
    ownerManager: firstDefined(
      event?.owner_name,
      event?.owner,
      event?.manager_name,
      event?.event_manager
    ),
    startDateTime: toIsoOrUndefined(startDateTime) || startDateTime,
    endDateTime: toIsoOrUndefined(endDateTime) || endDateTime,
    eventDate: toDateOnly(firstDefined(event?.event_date, event?.date, startDateTime)),
    bookedAt: toIsoOrUndefined(bookedAt) || bookedAt,
    updatedAt: toIsoOrUndefined(updatedAt) || updatedAt,
  };
}

function airtableApiBaseUrl() {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    AIRTABLE_TABLE_NAME
  )}`;
}

function escapeFormulaString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function findExistingAirtableRecord(sourceEventId) {
  if (!sourceEventId) return null;

  const formula = `AND({Source} = "Tripleseat", {Source Event ID} = "${escapeFormulaString(
    sourceEventId
  )}")`;

  const url = `${airtableApiBaseUrl()}?filterByFormula=${encodeURIComponent(
    formula
  )}&maxRecords=1`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
    },
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Airtable lookup error ${response.status}: ${responseText}`);
  }

  const data = JSON.parse(responseText);
  return data.records?.[0] || null;
}

async function createAirtableRecord(fields) {
  const response = await fetch(airtableApiBaseUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      records: [{ fields }],
      typecast: true,
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Airtable create error ${response.status}: ${responseText}`);
  }

  const data = JSON.parse(responseText);

  return {
    action: "created",
    recordId: data.records?.[0]?.id,
    raw: data,
  };
}

async function updateAirtableRecord(recordId, fields) {
  const response = await fetch(`${airtableApiBaseUrl()}/${recordId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields,
      typecast: true,
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Airtable update error ${response.status}: ${responseText}`);
  }

  const data = JSON.parse(responseText);

  return {
    action: "updated",
    recordId: data.id,
    raw: data,
  };
}

async function upsertAirtableRecord(fields) {
  if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
    throw new Error("Missing AIRTABLE_BASE_ID or AIRTABLE_PAT/AIRTABLE_TOKEN env var.");
  }

  const existingRecord = await findExistingAirtableRecord(fields["Source Event ID"]);

  if (existingRecord?.id) {
    return updateAirtableRecord(existingRecord.id, fields);
  }

  return createAirtableRecord(fields);
}

function capturedHeaders(req) {
  return {
    "content-type": req.headers["content-type"],
    "user-agent": req.headers["user-agent"],
    host: req.headers.host,
    "x-forwarded-for": req.headers["x-forwarded-for"],
    "x-forwarded-host": req.headers["x-forwarded-host"],
    "x-forwarded-proto": req.headers["x-forwarded-proto"],
    "x-tripleseat-signature": req.headers["x-tripleseat-signature"],
    "x-tripleseat-signature-256": req.headers["x-tripleseat-signature-256"],
    "x-tripleseat-webhook-signature": req.headers["x-tripleseat-webhook-signature"],
    "x-webhook-signature": req.headers["x-webhook-signature"],
    "x-webhook-signature-256": req.headers["x-webhook-signature-256"],
    "x-hub-signature": req.headers["x-hub-signature"],
    "x-hub-signature-256": req.headers["x-hub-signature-256"],
    "x-signature": req.headers["x-signature"],
    "x-signature-256": req.headers["x-signature-256"],
  };
}

export default async function handler(req, res) {
  const receivedAt = new Date().toISOString();

  try {
    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        route: "/api/tripleseat-webhook",
        version: "v1.1",
        message: "Tripleseat webhook route is live.",
        timestamp: receivedAt,
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        route: "/api/tripleseat-webhook",
        version: "v1.1",
        error: "Method not allowed",
      });
    }

    const rawEnvelope = {
      receivedAt,
      method: req.method,
      query: req.query || {},
      headers: capturedHeaders(req),
      payload: req.body || {},
    };

    const normalized = normalizeTripleseatPayload(req.body || {});
    const classification = classifyTripleseatRecord(normalized, req.body || {});

    const fields = {
      "Event Name": normalized.eventName,
      Source: "Tripleseat",
      "Source Event ID": normalized.sourceEventId,
      "Tripleseat Event ID": normalized.tripleseatEventId,
      "Tripleseat Record Type": classification.recordType,
      "Needs Review": classification.needsReview,
      Status: classification.status,
      "Raw Source": safeJson(rawEnvelope),
      Notes: `Captured from Tripleseat webhook. ${classification.reason}`,
    };

    if (normalized.tripleseatStatus) {
      fields["Tripleseat Status"] = normalizeStatus(normalized.tripleseatStatus);
    }

    const guestCount = numberOrUndefined(normalized.guestCount);
    const estimatedRevenue = numberOrUndefined(normalized.estimatedRevenue);
    const bookedRevenue = numberOrUndefined(normalized.bookedRevenue);
    const depositPaid = numberOrUndefined(normalized.depositPaid);
    const balanceDue = numberOrUndefined(normalized.balanceDue);

    if (guestCount !== undefined) fields["Guest Count"] = guestCount;
    if (normalized.roomSpace) fields["Room / Space"] = normalized.roomSpace;
    if (normalized.contactAccount) fields["Contact / Account"] = normalized.contactAccount;
    if (estimatedRevenue !== undefined) fields["Estimated Revenue"] = estimatedRevenue;
    if (bookedRevenue !== undefined) fields["Booked Revenue"] = bookedRevenue;
    if (depositPaid !== undefined) fields["Deposit Paid"] = depositPaid;
    if (balanceDue !== undefined) fields["Balance Due"] = balanceDue;
    if (normalized.eventTypeMealPeriod) fields["Event Type / Meal Period"] = normalized.eventTypeMealPeriod;
    if (normalized.ownerManager) fields["Owner / Event Manager"] = normalized.ownerManager;
    if (normalized.eventDate) fields["Event Date"] = normalized.eventDate;
    if (normalized.startDateTime) fields["Start DateTime"] = normalized.startDateTime;
    if (normalized.endDateTime) fields["End DateTime"] = normalized.endDateTime;
    if (normalized.bookedAt) fields["Booked At"] = normalized.bookedAt;
    if (normalized.updatedAt) fields["Updated At"] = normalized.updatedAt;

    if (CHLOES_RESTAURANT_ID) {
      fields.Restaurant = [CHLOES_RESTAURANT_ID];
    }

    const airtableResult = await upsertAirtableRecord(fields);

    return res.status(200).json({
      ok: true,
      route: "/api/tripleseat-webhook",
      version: "v1.1",
      message: `Tripleseat webhook received and ${airtableResult.action} in Airtable.`,
      receivedAt,
      airtableAction: airtableResult.action,
      airtableRecordId: airtableResult.recordId,
      classification,
      normalized,
    });
  } catch (error) {
    console.error("Tripleseat webhook error:", error);

    return res.status(500).json({
      ok: false,
      route: "/api/tripleseat-webhook",
      version: "v1.1",
      error: error.message,
      receivedAt,
    });
  }
}
