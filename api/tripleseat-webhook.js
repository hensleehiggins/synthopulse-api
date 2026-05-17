export const config = {
  api: {
    bodyParser: true,
  },
};

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_PAT;
const CHLOES_RESTAURANT_ID = process.env.AIRTABLE_CHLOES_RESTAURANT_ID;

const EVENT_INTAKE_TABLE = "Event Intake Queue";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Tripleseat-Signature, X-Webhook-Signature"
  );
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  return res.status(statusCode).json(payload);
}

function safeString(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  return String(value).trim();
}

function safeNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function safeDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function safeDateOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function firstPresent(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function findNestedValue(obj, keys) {
  if (!obj || typeof obj !== "object") return "";

  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = findNestedValue(value, keys);
      if (nested !== "") return nested;
    }
  }

  return "";
}

function buildEventName(payload) {
  return (
    safeString(
      firstPresent(
        findNestedValue(payload, ["event_name", "eventName", "name", "title"]),
        payload?.event?.name,
        payload?.booking?.name,
        payload?.lead?.name
      )
    ) || "Tripleseat Event"
  );
}

function buildExternalEventId(payload) {
  return safeString(
    firstPresent(
      findNestedValue(payload, [
        "event_id",
        "eventId",
        "id",
        "booking_id",
        "bookingId",
        "lead_id",
        "leadId",
      ])
    )
  );
}

function buildRecordType(payload) {
  const explicitType = safeString(
    firstPresent(
      payload?.type,
      payload?.object,
      payload?.record_type,
      payload?.recordType,
      payload?.event_type,
      payload?.eventType
    )
  );

  const lower = explicitType.toLowerCase();

  if (lower.includes("booking")) return "Booking";
  if (lower.includes("lead")) return "Lead";
  if (lower.includes("event")) return "Event";

  if (payload?.booking) return "Booking";
  if (payload?.lead) return "Lead";
  if (payload?.event) return "Event";

  return "Event";
}

function buildStatus(payload) {
  return safeString(
    firstPresent(
      findNestedValue(payload, ["status", "event_status", "booking_status"]),
      payload?.event?.status,
      payload?.booking?.status,
      payload?.lead?.status
    )
  );
}

function buildStartDateTime(payload) {
  return safeDate(
    firstPresent(
      findNestedValue(payload, [
        "start_at",
        "starts_at",
        "start_time",
        "startTime",
        "start_datetime",
        "startDateTime",
        "event_start",
        "eventStart",
        "date",
        "event_date",
        "eventDate",
      ])
    )
  );
}

function buildEndDateTime(payload) {
  return safeDate(
    firstPresent(
      findNestedValue(payload, [
        "end_at",
        "ends_at",
        "end_time",
        "endTime",
        "end_datetime",
        "endDateTime",
        "event_end",
        "eventEnd",
      ])
    )
  );
}

function buildGuestCount(payload) {
  return safeNumber(
    firstPresent(
      findNestedValue(payload, [
        "guest_count",
        "guestCount",
        "guests",
        "guest_total",
        "guestTotal",
        "attendees",
        "party_size",
        "partySize",
      ])
    )
  );
}

function buildRoomSpace(payload) {
  return safeString(
    firstPresent(
      findNestedValue(payload, [
        "room",
        "room_name",
        "roomName",
        "space",
        "space_name",
        "location",
        "location_name",
      ])
    )
  );
}

function buildContactAccount(payload) {
  return safeString(
    firstPresent(
      findNestedValue(payload, [
        "contact_name",
        "contactName",
        "account_name",
        "accountName",
        "customer_name",
        "customerName",
        "client_name",
        "clientName",
      ])
    )
  );
}

function buildOwnerManager(payload) {
  return safeString(
    firstPresent(
      findNestedValue(payload, [
        "owner",
        "owner_name",
        "ownerName",
        "manager",
        "manager_name",
        "managerName",
        "event_manager",
        "eventManager",
      ])
    )
  );
}

function buildUpdatedAt(payload) {
  return safeDate(
    firstPresent(
      findNestedValue(payload, [
        "updated_at",
        "updatedAt",
        "modified_at",
        "modifiedAt",
      ])
    )
  );
}

function buildBookedAt(payload) {
  return safeDate(
    firstPresent(
      findNestedValue(payload, [
        "created_at",
        "createdAt",
        "booked_at",
        "bookedAt",
      ])
    )
  );
}

function buildMoney(payload, keys) {
  return safeNumber(findNestedValue(payload, keys));
}

function buildRawSource(req, payload) {
  return JSON.stringify(
    {
      receivedAt: new Date().toISOString(),
      method: req.method,
      query: req.query || {},
      headers: {
        "content-type": req.headers["content-type"],
        "user-agent": req.headers["user-agent"],
        "x-tripleseat-signature": req.headers["x-tripleseat-signature"],
        "x-webhook-signature": req.headers["x-webhook-signature"],
      },
      payload,
    },
    null,
    2
  );
}

async function createEventIntakeRecord({ req, payload }) {
  const eventName = buildEventName(payload);
  const externalEventId = buildExternalEventId(payload);
  const recordType = buildRecordType(payload);
  const status = buildStatus(payload);
  const startDateTime = buildStartDateTime(payload);
  const endDateTime = buildEndDateTime(payload);
  const guestCount = buildGuestCount(payload);
  const roomSpace = buildRoomSpace(payload);
  const contactAccount = buildContactAccount(payload);
  const ownerManager = buildOwnerManager(payload);
  const updatedAt = buildUpdatedAt(payload);
  const bookedAt = buildBookedAt(payload);

  const bookedRevenue = buildMoney(payload, [
    "booked_revenue",
    "bookedRevenue",
    "actual_revenue",
    "actualRevenue",
    "revenue",
    "total",
    "grand_total",
    "grandTotal",
  ]);

  const estimatedRevenue = buildMoney(payload, [
    "estimated_revenue",
    "estimatedRevenue",
    "projected_revenue",
    "projectedRevenue",
    "estimated_total",
    "estimatedTotal",
  ]);

  const depositPaid = buildMoney(payload, [
    "deposit_paid",
    "depositPaid",
    "deposit",
    "paid_deposit",
    "paidDeposit",
  ]);

  const balanceDue = buildMoney(payload, [
    "balance_due",
    "balanceDue",
    "remaining_balance",
    "remainingBalance",
  ]);

  const fields = {
    "Event Name": eventName,
    Source: "Tripleseat",
    "Source Event ID": externalEventId || `tripleseat-${Date.now()}`,
    "External Event ID": externalEventId || `tripleseat-${Date.now()}`,
    "Raw Source": buildRawSource(req, payload),
    "Needs Review": true,
    Status: "New",
    Restaurant: CHLOES_RESTAURANT_ID ? [CHLOES_RESTAURANT_ID] : undefined,
    "Tripleseat Event ID": externalEventId,
    "Tripleseat Status": status,
    "Tripleseat Record Type": recordType,
    "Room / Space": roomSpace,
    "Contact / Account": contactAccount,
    "Owner / Event Manager": ownerManager,
    "Booked At": bookedAt || undefined,
    "Updated At": updatedAt || undefined,
    Notes: "Created by Tripleseat webhook intake. Review before promotion to External Factors.",
  };

  if (startDateTime) {
    fields["Start DateTime"] = startDateTime;
    fields["Event Date"] = safeDateOnly(startDateTime);
  }

  if (endDateTime) {
    fields["End DateTime"] = endDateTime;
  }

  if (guestCount !== undefined) {
    fields["Guest Count"] = guestCount;
  }

  if (bookedRevenue !== undefined) {
    fields["Booked Revenue"] = bookedRevenue;
  }

  if (estimatedRevenue !== undefined) {
    fields["Estimated Revenue"] = estimatedRevenue;
  }

  if (depositPaid !== undefined) {
    fields["Deposit Paid"] = depositPaid;
  }

  if (balanceDue !== undefined) {
    fields["Balance Due"] = balanceDue;
  }

  Object.keys(fields).forEach((key) => {
    if (fields[key] === undefined || fields[key] === "") {
      delete fields[key];
    }
  });

  const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    EVENT_INTAKE_TABLE
  )}`;

  const airtableResponse = await fetch(airtableUrl, {
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

  const airtableData = await airtableResponse.json();

  if (!airtableResponse.ok) {
    const error = new Error("Airtable rejected Tripleseat webhook intake.");
    error.details = airtableData;
    error.status = airtableResponse.status;
    throw error;
  }

  return airtableData?.records?.[0];
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      route: "tripleseat-webhook",
      message: "Tripleseat webhook endpoint is live. Use POST for webhook events.",
    });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      ok: false,
      error: "Method not allowed. Use POST.",
    });
  }

  try {
    if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
      return sendJson(res, 500, {
        ok: false,
        error:
          "Missing AIRTABLE_BASE_ID or AIRTABLE_PAT/AIRTABLE_TOKEN environment variable.",
      });
    }

    const payload = req.body || {};

    const createdRecord = await createEventIntakeRecord({
      req,
      payload,
    });

    return sendJson(res, 200, {
      ok: true,
      message: "Tripleseat webhook received and stored for review.",
      recordId: createdRecord?.id,
    });
  } catch (error) {
    console.error("Tripleseat webhook error:", {
      message: error.message,
      status: error.status,
      details: error.details,
    });

    return sendJson(res, error.status || 500, {
      ok: false,
      error: error.message || "Unexpected Tripleseat webhook error.",
      details: error.details || null,
    });
  }
}
