// api/home-alert.js

const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID || "appD303evZM2SlvMR";

const AIRTABLE_TOKEN =
  process.env.AIRTABLE_API_KEY ||
  process.env.AIRTABLE_TOKEN ||
  process.env.AIRTABLE_PAT;

const EXTERNAL_FACTORS_TABLE = "External Factors";

const RESTAURANT_ID = "CHLOE";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJson(res, status, payload) {
  setCors(res);
  res.status(status).json(payload);
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getField(record, fieldName) {
  return record?.fields?.[fieldName];
}

function getTextField(record, fieldName) {
  const value = getField(record, fieldName);

  if (Array.isArray(value)) {
    return clean(value.join(", "));
  }

  return clean(value);
}

function getDateOnly(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getTodayDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysBetween(startDate, endDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((endDate - startDate) / msPerDay);
}

function buildDateLabel(record) {
  const existingLabel =
    getTextField(record, "Event Card Date Label") ||
    getTextField(record, "Event Display Date");

  if (existingLabel) return existingLabel;

  const displayDate =
    getField(record, "Display Date") ||
    getField(record, "Forecast Date") ||
    getField(record, "Date") ||
    getField(record, "Start DateTime");

  const dateOnly = getDateOnly(displayDate);
  if (!dateOnly) return "";

  const diff = daysBetween(getTodayDateOnly(), dateOnly);

  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1) return `In ${diff} days`;

  return "";
}

function buildTitle(eventName, dateLabel) {
  const name = clean(eventName) || "Demand alert";
  const label = clean(dateLabel);
  const lower = label.toLowerCase();

  if (!label) return name;

  if (lower.includes("today") || lower.includes("tomorrow")) {
    return `${name} ${lower}`;
  }

  return `${name} coming up`;
}

function fallbackSummary(eventName) {
  const name = clean(eventName).toLowerCase();

  if (name.includes("mother")) {
    return "Major restaurant-demand holiday. Expect family groups, premium entrées, desserts, wine/cocktails, and staffing pressure.";
  }

  if (name.includes("valentine")) {
    return "Major steakhouse demand signal. Watch reservations, two-tops, premium entrées, wine/cocktails, desserts, and pacing.";
  }

  if (name.includes("new year")) {
    return "Major celebration demand signal. Watch premium item prep, beverage staffing, desserts, and late-service pacing.";
  }

  if (name.includes("father")) {
    return "Restaurant-demand holiday. Expect family groups, premium entrées, cocktails, dessert attach, and staffing pressure.";
  }

  if (name.includes("easter")) {
    return "Family celebration holiday. Watch hours, reservation pace, patio/weather fit, and dessert demand.";
  }

  return "Important demand signal coming up. Watch reservations, staffing coverage, premium items, and service pacing.";
}

function buildAlert(record) {
  const eventName =
    getTextField(record, "Event Name") ||
    getTextField(record, "Description") ||
    "Demand alert";

  const dateLabel = buildDateLabel(record);

  const summary =
    getTextField(record, "Event Summary") ||
    getTextField(record, "Description") ||
    fallbackSummary(eventName);

  const pressure =
    getTextField(record, "Event Pressure Label") ||
    getTextField(record, "Estimated Draw") ||
    "Demand pressure";

  return {
    show: true,
    eventName,
    title: buildTitle(eventName, dateLabel),
    dateLabel,
    summary,
    pressure,
    source: getTextField(record, "Source") || "KitchenPulse",
    externalEventId: getTextField(record, "External Event ID"),
    recordId: record.id,
  };
}

async function fetchHomeAlert() {
  if (!AIRTABLE_TOKEN) {
    throw new Error(
      "Missing Airtable token. Set AIRTABLE_API_KEY, AIRTABLE_TOKEN, or AIRTABLE_PAT in Vercel."
    );
  }

  const formula = `AND(
    {Home Alert Window} = "Show",
    {Show on Home Alert} = 1,
    {Active} = 1,
    FIND("${RESTAURANT_ID}", ARRAYJOIN({Restaurant ID}))
  )`;

  const params = new URLSearchParams();

  params.set("maxRecords", "1");
  params.set("filterByFormula", formula);
  params.append("sort[0][field]", "Display Date");
  params.append("sort[0][direction]", "asc");
  params.append("sort[1][field]", "Priority Score");
  params.append("sort[1][direction]", "desc");

  [
    "Event Name",
    "Event Summary",
    "Description",
    "Display Date",
    "Forecast Date",
    "Date",
    "Start DateTime",
    "Event Card Date Label",
    "Event Display Date",
    "Event Pressure Label",
    "Estimated Draw",
    "Source",
    "External Event ID",
  ].forEach((field) => params.append("fields[]", field));

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    EXTERNAL_FACTORS_TABLE
  )}?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Airtable error ${response.status}: ${JSON.stringify(data)}`
    );
  }

  const record = data.records?.[0];

  if (!record) {
    return {
      show: false,
      message: "No home alert in window.",
    };
  }

  return buildAlert(record);
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, {
      show: false,
      error: "Method not allowed",
    });
  }

  try {
    const alert = await fetchHomeAlert();

    return sendJson(res, 200, {
      ok: true,
      ...alert,
    });
  } catch (error) {
    console.error("home-alert error:", error);

    return sendJson(res, 500, {
      ok: false,
      show: false,
      error: error.message || "Failed to load home alert.",
    });
  }
}
