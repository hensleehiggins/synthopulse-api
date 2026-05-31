/********************************************************************
 * SynthoPulse / KitchenPulse API
 * Route: api/update-event.js
 * Version: v1.1
 *
 * Purpose:
 * - Update an External Factors event from the Softr/Vibe Events page.
 * - Safely convert datetime-local values from restaurant Eastern time
 *   into UTC ISO strings for Airtable.
 * - Keep event records typed as Event and prevent accidental weather/admin
 *   context edits from turning into live demand pressure incorrectly.
 *
 * Method:
 * - GET  /api/update-event
 * - POST /api/update-event
 *
 * Body:
 * {
 *   "recordId": "rec...",
 *   "eventName": "Company Dinner",
 *   "startDateTime": "2026-06-01T17:00",
 *   "endDateTime": "2026-06-01T20:00",
 *   "venueArea": "Private Dining",
 *   "estimatedDraw": "Medium",
 *   "trafficEffect": "High"
 * }
 *
 * Reads:
 * - External Factors
 *
 * Writes:
 * - External Factors
 *
 * Does NOT:
 * - Delete records
 * - Touch POS Runs
 * - Touch Decision Layer output
 * - Touch Forecasts & Insights
 ********************************************************************/

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

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function escapeFormulaString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
    timeZone: "America/New_York",
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
    // Safe fallback for Eastern. This should rarely happen.
    return -300;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] || 0);

  return sign * (hours * 60 + minutes);
}

function localEasternDateTimeToUtcIso(value) {
  const parsed = parseDateTimeLocal(value);

  if (!parsed) {
    // If Softr ever sends a full ISO string, preserve valid values.
    const asDate = new Date(value);
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

  // First pass guesses offset at the naive UTC instant.
  const firstOffsetMinutes = getEasternOffsetMinutesForUtcDate(new Date(naiveUtcMs));
  let actualUtcMs = naiveUtcMs - firstOffsetMinutes * 60 * 1000;

  // Second pass catches DST boundary days.
  const secondOffsetMinutes = getEasternOffsetMinutesForUtcDate(new Date(actualUtcMs));
  actualUtcMs = naiveUtcMs - secondOffsetMinutes * 60 * 1000;

  return new Date(actualUtcMs).toISOString();
}

function easternDateKeyFromLocalInput(value) {
  const parsed = parseDateTimeLocal(value);

  if (parsed) {
    return `${String(parsed.year).padStart(4, "0")}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
  }

  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asDate);
}

function easternTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function applyActiveStateFromStart(fields, startDateTimeInput) {
  const eventDay = easternDateKeyFromLocalInput(startDateTimeInput);
  const today = easternTodayKey();

  if (!eventDay || !today) return;

  fields["Needs Review"] = false;

  if (eventDay === today) {
    fields["Active"] = true;
    fields["Active (Event)"] = true;
  } else {
    fields["Active"] = false;
    fields["Active (Event)"] = false;
  }
}

function buildAirtableUrl({ baseId, tableName, recordId }) {
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${recordId}`;
}

async function fetchAirtableRecord({ token, baseId, tableName, recordId }) {
  const response = await fetch(buildAirtableUrl({ baseId, tableName, recordId }), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        data?.error?.type ||
        raw ||
        `Airtable fetch failed with status ${response.status}`
    );
  }

  return data;
}

function looksAdminOrNonDemand(fields, incoming = {}) {
  const blob = [
    fields?.["Event Name"],
    fields?.Description,
    fields?.Notes,
    fields?.["Event Type"],
    fields?.["Venue / Area"],
    incoming.eventName,
    incoming.venueArea,
  ]
    .map(text)
    .join(" ")
    .toLowerCase();

  const phrases = [
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

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      route: "update-event",
      version: "v1.1",
      message: "Route is live. Use POST to update an event.",
      time: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      route: "update-event",
      version: "v1.1",
      error: "Method not allowed",
    });
  }

  try {
    const body = req.body || {};

    const recordId = text(body.recordId);
    const eventName = body.eventName;
    const startDateTime = body.startDateTime;
    const endDateTime = body.endDateTime;
    const venueArea = body.venueArea;
    const estimatedDraw = body.estimatedDraw;
    const trafficEffect = body.trafficEffect;

    if (!recordId) {
      return res.status(400).json({
        ok: false,
        route: "update-event",
        version: "v1.1",
        error: "Missing recordId",
      });
    }

    if (!isValidRecordId(recordId)) {
      return res.status(400).json({
        ok: false,
        route: "update-event",
        version: "v1.1",
        error: "Invalid Airtable recordId format",
      });
    }

    const AIRTABLE_TOKEN = getEnv("AIRTABLE_PAT", [
      "AIRTABLE_TOKEN",
      "AIRTABLE_API_KEY",
      "AIRTABLE_PERSONAL_ACCESS_TOKEN",
    ]);

    const AIRTABLE_BASE_ID = getEnv("AIRTABLE_BASE_ID", [
      "KITCHENPULSE_BASE_ID",
    ]);

    if (!AIRTABLE_TOKEN) {
      return res.status(500).json({
        ok: false,
        route: "update-event",
        version: "v1.1",
        error: "Missing Airtable token environment variable",
      });
    }

    if (!AIRTABLE_BASE_ID) {
      return res.status(500).json({
        ok: false,
        route: "update-event",
        version: "v1.1",
        error: "Missing Airtable base ID environment variable",
      });
    }

    const tableName = "External Factors";

    const existing = await fetchAirtableRecord({
      token: AIRTABLE_TOKEN,
      baseId: AIRTABLE_BASE_ID,
      tableName,
      recordId,
    });

    const existingFields = existing?.fields || {};

    if (text(existingFields.Type) && text(existingFields.Type) !== "Event") {
      return res.status(400).json({
        ok: false,
        route: "update-event",
        version: "v1.1",
        error: `Refusing to update record because Type is "${existingFields.Type}", not Event.`,
      });
    }

    if (looksAdminOrNonDemand(existingFields, body)) {
      return res.status(400).json({
        ok: false,
        route: "update-event",
        version: "v1.1",
        error:
          "Refusing to update record because it looks like an admin/task/test/non-demand item.",
      });
    }

    const fields = {
      Type: "Event",
    };

    if (eventName !== undefined) {
      fields["Event Name"] = text(eventName);
      fields["Description"] = text(eventName);
    }

    if (venueArea !== undefined) {
      fields["Venue / Area"] = text(venueArea);
    }

    if (startDateTime !== undefined && text(startDateTime) !== "") {
      const startIso = localEasternDateTimeToUtcIso(startDateTime);

      if (!startIso) {
        return res.status(400).json({
          ok: false,
          route: "update-event",
          version: "v1.1",
          error: "Invalid startDateTime",
        });
      }

      fields["Start DateTime"] = startIso;
      fields["Start Time"] = startIso;

      const serviceDate = easternDateKeyFromLocalInput(startDateTime);
      if (serviceDate) {
        fields["Display Date"] = serviceDate;
        fields["Forecast Date"] = serviceDate;
        fields["Date"] = serviceDate;
      }

      applyActiveStateFromStart(fields, startDateTime);
    }

    if (endDateTime !== undefined && text(endDateTime) !== "") {
      const endIso = localEasternDateTimeToUtcIso(endDateTime);

      if (!endIso) {
        return res.status(400).json({
          ok: false,
          route: "update-event",
          version: "v1.1",
          error: "Invalid endDateTime",
        });
      }

      fields["End DateTime"] = endIso;
      fields["End Time"] = endIso;
    }

    if (estimatedDraw !== undefined && text(estimatedDraw) !== "") {
      fields["Estimated Draw"] = text(estimatedDraw);
    }

    if (trafficEffect !== undefined && text(trafficEffect) !== "") {
      fields["Traffic Effect"] = text(trafficEffect);
    }

    fields["Needs Review"] = false;

    const airtableUrl = buildAirtableUrl({
      baseId: AIRTABLE_BASE_ID,
      tableName,
      recordId,
    });

    const airtableRes = await fetch(airtableUrl, {
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

    const rawText = await airtableRes.text();

    let airtableData = null;
    try {
      airtableData = rawText ? JSON.parse(rawText) : null;
    } catch (parseErr) {
      airtableData = { raw: rawText };
    }

    if (!airtableRes.ok) {
      return res.status(airtableRes.status).json({
        ok: false,
        route: "update-event",
        version: "v1.1",
        error:
          airtableData?.error?.message ||
          airtableData?.error?.type ||
          rawText ||
          "Airtable update failed",
        airtable: airtableData,
        sentFields: fields,
      });
    }

    return res.status(200).json({
      ok: true,
      route: "update-event",
      version: "v1.1",
      recordId,
      updatedFields: fields,
      airtable: airtableData,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      route: "update-event",
      version: "v1.1",
      error: err?.message || "Unknown server error",
      generatedAt: new Date().toISOString(),
    });
  }
}
