const Airtable = require("airtable");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const base = new Airtable({
  apiKey: requireEnv("AIRTABLE_PAT"),
}).base(requireEnv("AIRTABLE_BASE_ID"));

async function getTripleseatAccessToken() {
  const tokenUrl = requireEnv("TRIPLESEAT_TOKEN_URL");
  const clientId = requireEnv("TRIPLESEAT_CLIENT_ID");
  const clientSecret = requireEnv("TRIPLESEAT_CLIENT_SECRET");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }).toString(),
  });

  const json = await response.json();

  if (!response.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || "Failed to get Tripleseat access token"
    );
  }

  return json.access_token;
}

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
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

function normalizeStatus(value) {
  const status = text(value).toUpperCase();

  if (status.includes("DEFINITE")) return "Definite";
  if (status.includes("TENTATIVE")) return "Tentative";
  if (status.includes("PROSPECT")) return "Prospect";
  if (status.includes("CANCEL")) return "Cancelled";
  if (status.includes("LOST")) return "Lost";

  return text(value) || "Unknown";
}

function getRoomName(event) {
  if (Array.isArray(event.rooms) && event.rooms.length > 0) {
    return event.rooms.map((room) => room.name).filter(Boolean).join(", ");
  }

  if (event.room?.name) return event.room.name;

  return "";
}

function getContactOrAccount(event) {
  const contact = event.contact;
  const account = event.account;

  if (contact?.first_name || contact?.last_name) {
    return [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  }

  if (account?.name) return account.name;

  if (event.contact_name) return event.contact_name;

  return "";
}

function getEventType(event) {
  if (event.event_type) return event.event_type;
  if (event.event_type_name) return event.event_type_name;
  if (event.event_style) return event.event_style;
  return "";
}

function mapTripleseatEventToAirtable(event) {
  const sourceEventId = text(event.id);
  const eventName = text(event.name) || `Tripleseat Event ${sourceEventId}`;
  const status = normalizeStatus(event.status);
  const startDateTime =
    toIso(event.event_start_iso8601) ||
    toIso(event.event_start_utc) ||
    toIso(event.start_date);

  const endDateTime =
    toIso(event.event_end_iso8601) ||
    toIso(event.event_end_utc) ||
    toIso(event.end_date);

  const location = event.location || {};
  const roomName = getRoomName(event);
  const guestCount = number(event.guest_count || event.guaranteed_guest_count);
  const estimatedRevenue = number(
    event.total_event_grand_total ||
      event.grand_total ||
      event.food_and_beverage_min ||
      event.total_actual_amount
  );

  const needsReview =
    status !== "Cancelled" &&
    status !== "Lost" &&
    status !== "Unknown";

  const suggestedWeight =
    guestCount >= 100 ? 10 :
    guestCount >= 75 ? 9 :
    guestCount >= 50 ? 8 :
    guestCount >= 30 ? 7 :
    guestCount >= 15 ? 5 :
    3;

  return {
    "Event Name": eventName,
    "Start DateTime": startDateTime,
    "End DateTime": endDateTime,
    "Venue / Area": roomName,
    "City": text(location.city),
    "Source": "Tripleseat",
    "Source Event ID": sourceEventId,
    "Raw Source": JSON.stringify(event).slice(0, 95000),
    "Local Confidence": suggestedWeight,
    "Suggested Event Weight": suggestedWeight,
    "Promote to Decision": suggestedWeight >= 8,
    "Needs Review": needsReview,
    "External Event ID": `tripleseat-${sourceEventId}`,
    "Status": needsReview ? "Needs Review" : "Processed",
    "Notes": `Imported from Tripleseat. Status: ${status}. Guests: ${guestCount || "unknown"}.`,
    "Tripleseat Event ID": sourceEventId,
    "Tripleseat Status": status,
    "Guest Count": guestCount,
    "Event Type / Meal Period": getEventType(event),
    "Room / Space": roomName,
    "Contact / Account": getContactOrAccount(event),
    "Tripleseat Record Type": "Event",
    "Estimated Revenue": estimatedRevenue,
    "Event Date": event.event_date || event.start_date || null,
    "Booked At": toIso(event.created_at),
    "Updated At": toIso(event.updated_at),
    "Owner / Event Manager": event.owner?.first_name || event.owner?.email || "",
    "Revenue Status": estimatedRevenue > 0 ? "Estimated" : "",
  };
}

function removeEmptyFields(fields) {
  const cleaned = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === "") continue;
    cleaned[key] = value;
  }

  return cleaned;
}

async function fetchTripleseatEvents() {
  const accessToken = await getTripleseatAccessToken();
  const apiBaseUrl = requireEnv("TRIPLESEAT_API_BASE_URL").replace(/\/$/, "");
  const locationId = process.env.TRIPLESEAT_LOCATION_ID || "34084";

  const url = new URL(`${apiBaseUrl}/events`);
  url.searchParams.set("location_id", locationId);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": "KitchenPulse/1.0",
    },
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.error || json.message || "Failed to fetch Tripleseat events");
  }

  const events = Array.isArray(json.results)
    ? json.results
    : Array.isArray(json.events)
      ? json.events
      : Array.isArray(json)
        ? json
        : [];

  return {
    url: url.toString(),
    totalPages: json.total_pages || null,
    count: events.length,
    events,
  };
}

async function getExistingTripleseatRecords() {
  const existing = new Map();

  await base("Event Intake Queue")
    .select({
      fields: ["Source", "Source Event ID"],
    })
    .eachPage((records, fetchNextPage) => {
      for (const record of records) {
        if (record.fields.Source === "Tripleseat" && record.fields["Source Event ID"]) {
          existing.set(String(record.fields["Source Event ID"]), record.id);
        }
      }

      fetchNextPage();
    });

  return existing;
}

async function batchCreate(records) {
  const created = [];

  for (let i = 0; i < records.length; i += 10) {
    const chunk = records.slice(i, i + 10);
    const result = await base("Event Intake Queue").create(chunk);
    created.push(...result);
  }

  return created;
}

async function batchUpdate(records) {
  const updated = [];

  for (let i = 0; i < records.length; i += 10) {
    const chunk = records.slice(i, i + 10);
    const result = await base("Event Intake Queue").update(chunk);
    updated.push(...result);
  }

  return updated;
}

module.exports = async function handler(req, res) {
  try {
    const write = req.query.write === "1";

    const fetched = await fetchTripleseatEvents();
    const existing = await getExistingTripleseatRecords();

    const creates = [];
    const updates = [];

    for (const event of fetched.events) {
      const mapped = removeEmptyFields(mapTripleseatEventToAirtable(event));
      const sourceEventId = mapped["Source Event ID"];

      if (!sourceEventId) continue;

      const existingRecordId = existing.get(String(sourceEventId));

      if (existingRecordId) {
        updates.push({
          id: existingRecordId,
          fields: mapped,
        });
      } else {
        creates.push({
          fields: mapped,
        });
      }
    }

    let createdCount = 0;
    let updatedCount = 0;

    if (write) {
      const created = await batchCreate(creates);
      const updated = await batchUpdate(updates);

      createdCount = created.length;
      updatedCount = updated.length;
    }

    return res.status(200).json({
      ok: true,
      mode: write ? "write" : "dry_run",
      sourceUrl: fetched.url,
      fetchedCount: fetched.count,
      totalPages: fetched.totalPages,
      wouldCreate: creates.length,
      wouldUpdate: updates.length,
      createdCount,
      updatedCount,
      sampleCreate: creates.slice(0, 2),
      sampleUpdate: updates.slice(0, 2),
    });
  } catch (error) {
    console.error("tripleseat-sync-events error", error);

    return res.status(500).json({
      ok: false,
      error: error.message || "Tripleseat event sync failed",
    });
  }
};
