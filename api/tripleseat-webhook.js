// /api/tripleseat-webhook.js

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

function toDateOnly(value) {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  return date.toISOString().slice(0, 10);
}

function normalizeTripleseatPayload(body) {
  const event =
    body?.event ||
    body?.data?.event ||
    body?.booking?.event ||
    body?.payload?.event ||
    body?.data ||
    body;

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
    "Tripleseat Event"
  );

  const startDateTime = firstDefined(
    event?.start_time,
    event?.starts_at,
    event?.start_datetime,
    event?.startDateTime,
    event?.event_start,
    body?.start_time,
    body?.starts_at
  );

  const endDateTime = firstDefined(
    event?.end_time,
    event?.ends_at,
    event?.end_datetime,
    event?.endDateTime,
    event?.event_end,
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

  return {
    eventName,
    sourceEventId,
    tripleseatEventId: sourceEventId,
    tripleseatStatus: firstDefined(event?.status, event?.event_status, body?.status),
    guestCount: firstDefined(event?.guest_count, event?.guestCount, event?.guests, event?.attendance),
    roomSpace: firstDefined(event?.room_name, event?.room, event?.space, event?.location_name),
    contactAccount: firstDefined(
      event?.contact_name,
      event?.contact,
      event?.account_name,
      event?.account,
      event?.customer_name
    ),
    estimatedRevenue: firstDefined(
      event?.estimated_revenue,
      event?.estimatedRevenue,
      event?.revenue_estimate
    ),
    bookedRevenue: firstDefined(
      event?.booked_revenue,
      event?.bookedRevenue,
      event?.actual_revenue,
      event?.total_revenue
    ),
    depositPaid: firstDefined(event?.deposit_paid, event?.depositPaid, event?.deposit),
    balanceDue: firstDefined(event?.balance_due, event?.balanceDue),
    eventTypeMealPeriod: firstDefined(event?.event_type, event?.meal_period, event?.type),
    ownerManager: firstDefined(
      event?.owner_name,
      event?.owner,
      event?.manager_name,
      event?.event_manager
    ),
    startDateTime,
    endDateTime,
    eventDate: toDateOnly(firstDefined(event?.event_date, event?.date, startDateTime)),
    bookedAt,
    updatedAt,
  };
}

async function createAirtableRecord(fields) {
  if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
    throw new Error("Missing AIRTABLE_BASE_ID or AIRTABLE_PAT/AIRTABLE_TOKEN env var.");
  }

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    AIRTABLE_TABLE_NAME
  )}`;

  const response = await fetch(url, {
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

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Airtable error ${response.status}: ${text}`);
  }

  return JSON.parse(text);
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      route: "/api/tripleseat-webhook",
      message: "Tripleseat webhook route is live.",
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  const receivedAt = new Date().toISOString();

  try {
    const rawEnvelope = {
      receivedAt,
      method: req.method,
      query: req.query || {},
      headers: {
        "content-type": req.headers["content-type"],
        "user-agent": req.headers["user-agent"],
        "x-tripleseat-signature": req.headers["x-tripleseat-signature"],
        "x-webhook-signature": req.headers["x-webhook-signature"],
        "x-hub-signature": req.headers["x-hub-signature"],
        "x-hub-signature-256": req.headers["x-hub-signature-256"],
      },
      payload: req.body || {},
    };

    const normalized = normalizeTripleseatPayload(req.body || {});

    const fields = {
      "Event Name": normalized.eventName,
      Source: "Tripleseat",
      "Source Event ID": normalized.sourceEventId,
      "Tripleseat Event ID": normalized.tripleseatEventId,
      "Tripleseat Record Type": "Event",
      "Needs Review": true,
      Status: "New",
      "Raw Source": safeJson(rawEnvelope),
      Notes: "Captured from Tripleseat webhook. Review before promotion to External Factors.",
    };

    if (normalized.tripleseatStatus) {
      fields["Tripleseat Status"] = normalized.tripleseatStatus;
    }

    if (normalized.guestCount !== undefined) {
      fields["Guest Count"] = Number(normalized.guestCount);
    }

    if (normalized.roomSpace) {
      fields["Room / Space"] = normalized.roomSpace;
    }

    if (normalized.contactAccount) {
      fields["Contact / Account"] = normalized.contactAccount;
    }

    if (normalized.estimatedRevenue !== undefined) {
      fields["Estimated Revenue"] = Number(normalized.estimatedRevenue);
    }

    if (normalized.bookedRevenue !== undefined) {
      fields["Booked Revenue"] = Number(normalized.bookedRevenue);
    }

    if (normalized.depositPaid !== undefined) {
      fields["Deposit Paid"] = Number(normalized.depositPaid);
    }

    if (normalized.balanceDue !== undefined) {
      fields["Balance Due"] = Number(normalized.balanceDue);
    }

    if (normalized.eventTypeMealPeriod) {
      fields["Event Type / Meal Period"] = normalized.eventTypeMealPeriod;
    }

    if (normalized.ownerManager) {
      fields["Owner / Event Manager"] = normalized.ownerManager;
    }

    if (normalized.eventDate) {
      fields["Event Date"] = normalized.eventDate;
    }

    if (normalized.startDateTime) {
      fields["Start DateTime"] = normalized.startDateTime;
    }

    if (normalized.endDateTime) {
      fields["End DateTime"] = normalized.endDateTime;
    }

    if (normalized.bookedAt) {
      fields["Booked At"] = normalized.bookedAt;
    }

    if (normalized.updatedAt) {
      fields["Updated At"] = normalized.updatedAt;
    }

    if (CHLOES_RESTAURANT_ID) {
      fields.Restaurant = [CHLOES_RESTAURANT_ID];
    }

    const airtableResult = await createAirtableRecord(fields);

    return res.status(200).json({
      ok: true,
      message: "Tripleseat webhook received and stored in Airtable.",
      receivedAt,
      airtableRecordId: airtableResult.records?.[0]?.id,
      normalized,
    });
  } catch (error) {
    console.error("Tripleseat webhook error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
      receivedAt,
    });
  }
}
