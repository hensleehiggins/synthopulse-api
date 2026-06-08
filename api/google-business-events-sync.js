// api/google-business-events-sync.js
// KitchenPulse — Google Business Profile Event Posts -> Event Intake Queue
// Uses Google Business Profile Local Posts API, not dashboard scraping.

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const GOOGLE_BUSINESS_ACCOUNT_ID = process.env.GOOGLE_BUSINESS_ACCOUNT_ID;
const GOOGLE_BUSINESS_LOCATION_ID = process.env.GOOGLE_BUSINESS_LOCATION_ID;

const CHLOES_RESTAURANT_RECORD_ID =
  process.env.CHLOES_RESTAURANT_RECORD_ID || "recn2LoRESKN33zHW";

const GOOGLE_BUSINESS_SYNC_SECRET = process.env.GOOGLE_BUSINESS_SYNC_SECRET;

const AIRTABLE_TABLE_NAME = "Event Intake Queue";
const TIME_ZONE = "America/New_York";

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
}

function jsonResponse(res, status, payload) {
  res.status(status).json(payload);
}

function getTimeZoneOffsetMinutes(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = dtf.formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});

  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return (asUTC - date.getTime()) / 60000;
}

function googleScheduleToIso(dateObj, timeObj, timeZone = TIME_ZONE) {
  if (!dateObj?.year || !dateObj?.month || !dateObj?.day) return null;

  const hour = Number.isFinite(timeObj?.hours) ? timeObj.hours : 0;
  const minute = Number.isFinite(timeObj?.minutes) ? timeObj.minutes : 0;
  const second = Number.isFinite(timeObj?.seconds) ? timeObj.seconds : 0;

  const utcGuess = new Date(
    Date.UTC(dateObj.year, dateObj.month - 1, dateObj.day, hour, minute, second)
  );

  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess, timeZone);
  const utcDate = new Date(utcGuess.getTime() - offsetMinutes * 60 * 1000);

  return utcDate.toISOString();
}

function getLocalPostId(postName) {
  return String(postName || "").split("/").pop() || "";
}

function eventTitleFromPost(post) {
  const eventTitle = post?.event?.title;
  if (eventTitle) return eventTitle;

  const summary = String(post?.summary || "").trim();
  if (summary) return summary.slice(0, 120);

  return "Google Business Event";
}

function isEventPost(post) {
  return post?.topicType === "EVENT" && post?.event?.schedule;
}

async function refreshGoogleAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token"
    })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      `Google token refresh failed: ${response.status} ${JSON.stringify(payload)}`
    );
  }

  return payload.access_token;
}

async function fetchGoogleBusinessPosts(accessToken) {
  const allPosts = [];
  let pageToken = "";

  do {
    const parent = `accounts/${GOOGLE_BUSINESS_ACCOUNT_ID}/locations/${GOOGLE_BUSINESS_LOCATION_ID}`;
    const url = new URL(
      `https://mybusiness.googleapis.com/v4/${parent}/localPosts`
    );

    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        `Google localPosts.list failed: ${response.status} ${JSON.stringify(payload)}`
      );
    }

    allPosts.push(...(payload.localPosts || []));
    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  return allPosts;
}

async function fetchExistingGoogleIntakeRecords() {
  const formula = "FIND('google-business:', {External Event ID})";
  const url = new URL(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`
  );

  url.searchParams.set("pageSize", "100");
  url.searchParams.set("filterByFormula", formula);
  url.searchParams.append("fields[]", "External Event ID");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`
    }
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      `Airtable existing lookup failed: ${response.status} ${JSON.stringify(payload)}`
    );
  }

  const byExternalId = new Map();

  for (const record of payload.records || []) {
    const externalId = record.fields?.["External Event ID"];
    if (externalId) byExternalId.set(externalId, record.id);
  }

  return byExternalId;
}

async function airtableCreate(records) {
  if (!records.length) return [];

  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        records,
        typecast: true
      })
    }
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      `Airtable create failed: ${response.status} ${JSON.stringify(payload)}`
    );
  }

  return payload.records || [];
}

async function airtableUpdate(records) {
  if (!records.length) return [];

  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        records,
        typecast: true
      })
    }
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      `Airtable update failed: ${response.status} ${JSON.stringify(payload)}`
    );
  }

  return payload.records || [];
}

function intakeFieldsFromGooglePost(post) {
  const schedule = post.event.schedule;
  const startIso = googleScheduleToIso(schedule.startDate, schedule.startTime);
  const endIso = googleScheduleToIso(schedule.endDate, schedule.endTime);

  const sourceEventId = getLocalPostId(post.name);
  const externalEventId = `google-business:${sourceEventId}`;
  const eventName = eventTitleFromPost(post);

  const summary = String(post.summary || "").trim();
  const searchUrl = post.searchUrl || post.callToAction?.url || "";

  return {
    "Event Name": eventName,
    "Start DateTime": startIso,
    ...(endIso ? { "End DateTime": endIso } : {}),

    "Venue / Area": "Chloe's Steakhouse / Google Business Profile",
    "City": "Winder",

    "Source": "Google Business",
    "Source URL": searchUrl,
    "Source Event ID": sourceEventId,
    "External Event ID": externalEventId,
    "Raw Source": JSON.stringify(post, null, 2),

    "Local Confidence": 10,
    "Suggested Event Weight": 10,
    "Promote to Decision": true,
    "Needs Review": false,

    "Restaurant": [CHLOES_RESTAURANT_RECORD_ID],
    "Status": "New",

    "Notes": [
      "Google Business Profile house-owned event post.",
      "Treat as trusted service-pressure and decision-layer demand signal.",
      summary ? `Post summary: ${summary}` : ""
    ].filter(Boolean).join(" ")
  };
}

function chunk(records, size = 10) {
  const chunks = [];

  for (let i = 0; i < records.length; i += size) {
    chunks.push(records.slice(i, i + size));
  }

  return chunks;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return jsonResponse(res, 405, { error: "Method not allowed" });
    }

    if (
      GOOGLE_BUSINESS_SYNC_SECRET &&
      req.headers.authorization !== `Bearer ${GOOGLE_BUSINESS_SYNC_SECRET}`
    ) {
      return jsonResponse(res, 401, { error: "Unauthorized" });
    }

    requireEnv("AIRTABLE_BASE_ID", AIRTABLE_BASE_ID);
    requireEnv("AIRTABLE_TOKEN", AIRTABLE_TOKEN);
    requireEnv("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID);
    requireEnv("GOOGLE_CLIENT_SECRET", GOOGLE_CLIENT_SECRET);
    requireEnv("GOOGLE_REFRESH_TOKEN", GOOGLE_REFRESH_TOKEN);
    requireEnv("GOOGLE_BUSINESS_ACCOUNT_ID", GOOGLE_BUSINESS_ACCOUNT_ID);
    requireEnv("GOOGLE_BUSINESS_LOCATION_ID", GOOGLE_BUSINESS_LOCATION_ID);

    const accessToken = await refreshGoogleAccessToken();
    const posts = await fetchGoogleBusinessPosts(accessToken);

    const eventPosts = posts.filter(isEventPost);
    const existingByExternalId = await fetchExistingGoogleIntakeRecords();

    const creates = [];
    const updates = [];

    for (const post of eventPosts) {
      const fields = intakeFieldsFromGooglePost(post);

      if (!fields["Start DateTime"]) {
        continue;
      }

      const existingRecordId = existingByExternalId.get(fields["External Event ID"]);

      if (existingRecordId) {
        updates.push({
          id: existingRecordId,
          fields
        });
      } else {
        creates.push({ fields });
      }
    }

    let created = 0;
    let updated = 0;

    for (const group of chunk(creates, 10)) {
      const result = await airtableCreate(group);
      created += result.length;
    }

    for (const group of chunk(updates, 10)) {
      const result = await airtableUpdate(group);
      updated += result.length;
    }

    return jsonResponse(res, 200, {
      ok: true,
      totalPostsSeen: posts.length,
      eventPostsSeen: eventPosts.length,
      created,
      updated
    });
  } catch (error) {
    console.error(error);

    return jsonResponse(res, 500, {
      ok: false,
      error: error.message
    });
  }
};
