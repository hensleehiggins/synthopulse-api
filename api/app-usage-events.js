/********************************************************************
 * KitchenPulse API - App Usage Events
 *
 * Purpose:
 * - Captures lightweight product usage telemetry from the mobile app/portal.
 * - Writes App Usage Events.
 * - Updates Operator Users last activity fields.
 *
 * Does NOT:
 * - Touch operational count/receipt/order data
 * - Create orders
 * - Expose data without KitchenPulse auth
 ********************************************************************/

const Airtable = require("airtable");
const { requireKitchenPulseUser, sendJson } = require("./_auth");

const APP_USAGE_EVENTS_TABLE =
  process.env.AIRTABLE_APP_USAGE_EVENTS_TABLE || "App Usage Events";

const OPERATOR_USERS_TABLE =
  process.env.AIRTABLE_OPERATOR_USERS_TABLE || "Operator Users";

let cachedBase = null;

function getAirtableBase() {
  if (cachedBase) {
    return cachedBase;
  }

  const apiKey = process.env.AIRTABLE_PAT || process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey) {
    throw new Error("Missing AIRTABLE_PAT or AIRTABLE_TOKEN.");
  }

  if (!baseId) {
    throw new Error("Missing AIRTABLE_BASE_ID.");
  }

  cachedBase = new Airtable({ apiKey }).base(baseId);
  return cachedBase;
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
}

function cleanText(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeChoice(value, allowedValues, fallback) {
  const cleaned = cleanText(value, 80);

  return allowedValues.includes(cleaned) ? cleaned : fallback;
}

function safeBoolean(value) {
  return value === true;
}

function safeMetadataJson(value) {
  if (!value || typeof value === "undefined") {
    return "";
  }

  if (typeof value === "string") {
    return value.slice(0, 9000);
  }

  try {
    return JSON.stringify(value).slice(0, 9000);
  } catch {
    return "";
  }
}

function platformFromValue(value) {
  return normalizeChoice(
    value,
    ["iOS", "Android", "Web", "Unknown"],
    "Unknown"
  );
}

function surfaceFromValue(value) {
  return normalizeChoice(
    value,
    ["Mobile App", "Portal", "API", "Unknown"],
    "Mobile App"
  );
}

function eventTypeFromValue(value) {
  return normalizeChoice(
    value,
    [
      "App Opened",
      "Session Restored",
      "Login Started",
      "Login Success",
      "Login Failed",
      "Screen Viewed",
      "Item Search",
      "Item Opened",
      "Count Started",
      "Count Submitted",
      "Receipt Started",
      "Receipt Submitted",
      "Setup Opened",
      "Setup Saved",
      "Orders Opened",
      "Order Draft Added",
      "Alert Viewed",
      "Alert Acknowledged",
      "Error",
    ],
    "Screen Viewed"
  );
}

function entityTypeFromValue(value) {
  return normalizeChoice(
    value,
    [
      "Par Level",
      "Stock Count",
      "Receipt",
      "Receipt Line",
      "Cost Signal",
      "Order Draft",
      "Order Draft Line",
      "Alert",
      "User",
      "None",
    ],
    "None"
  );
}

function buildEventName({ auth, eventType, screenName, eventAt }) {
  const who =
    cleanText(auth?.operatorUser?.displayName, 80) ||
    cleanText(auth?.email, 80) ||
    "Operator";

  const screen = screenName ? ` — ${screenName}` : "";

  return `${who} — ${eventType}${screen} — ${eventAt}`;
}

async function updateOperatorActivity({ auth, surface, eventType, eventAt }) {
  const operatorRecordId = auth?.operatorUser?.recordId;

  if (!operatorRecordId) {
    return;
  }

  const fields = {
    "Last Activity Type": eventType,
  };

  if (surface === "Mobile App") {
    fields["Last Mobile Activity At"] = eventAt;
  }

  if (surface === "Portal") {
    fields["Last Portal Activity At"] = eventAt;
  }

  try {
    await getAirtableBase()(OPERATOR_USERS_TABLE).update(
      operatorRecordId,
      fields
    );
  } catch (error) {
    console.error("Operator activity update failed:", error);
  }
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      ok: false,
      error: "method_not_allowed",
      message: "Use POST for app usage events.",
    });
  }

  try {
    const surface = surfaceFromValue(req.body?.surface);
    const source = surface === "Portal" ? "portal" : "mobile";

    const auth = await requireKitchenPulseUser(req, res, {
      source,
      minimumRole: "Staff",
      touchLastLogin: false,
    });

    if (!auth) {
      return;
    }

    const eventAt = new Date().toISOString();
    const eventType = eventTypeFromValue(req.body?.eventType);
    const screenName = cleanText(req.body?.screenName, 120);
    const actionName = cleanText(req.body?.actionName, 120);
    const entityType = entityTypeFromValue(req.body?.entityType);
    const entityRecordId = cleanText(req.body?.entityRecordId, 80);
    const entityName = cleanText(req.body?.entityName, 180);
    const appVersion = cleanText(req.body?.appVersion, 80);
    const platform = platformFromValue(req.body?.platform);
    const deviceInfo = cleanText(req.body?.deviceInfo, 250);
    const success =
      typeof req.body?.success === "undefined"
        ? true
        : safeBoolean(req.body?.success);
    const errorMessage = cleanText(req.body?.errorMessage, 1000);
    const metadataJson = safeMetadataJson(req.body?.metadata);

    const fields = {
      "Event Name": buildEventName({
        auth,
        eventType,
        screenName,
        eventAt,
      }),
      Surface: surface,
      "Event Type": eventType,
      "Screen Name": screenName,
      "Action Name": actionName,
      "Entity Type": entityType,
      "Entity Record ID": entityRecordId,
      "Entity Name": entityName,
      "Event At": eventAt,
      "App Version": appVersion,
      Platform: platform,
      "Device Info": deviceInfo,
      Success: success,
      "Error Message": errorMessage,
      "Metadata JSON": metadataJson,
    };

    if (auth.restaurantRecordId) {
      fields.Restaurant = [auth.restaurantRecordId];
    }

    if (auth.operatorUser?.recordId) {
      fields["Operator User"] = [auth.operatorUser.recordId];
    }

    const createdRecords = await getAirtableBase()(APP_USAGE_EVENTS_TABLE).create(
      [
        {
          fields,
        },
      ],
      {
        typecast: true,
      }
    );

    await updateOperatorActivity({
      auth,
      surface,
      eventType,
      eventAt,
    });

    return sendJson(res, 200, {
      ok: true,
      eventId: createdRecords?.[0]?.id || null,
      eventType,
      surface,
      eventAt,
    });
  } catch (error) {
    console.error("App usage event failed:", error);

    return sendJson(res, 500, {
      ok: false,
      error: "app_usage_event_failed",
      message:
        error instanceof Error
          ? error.message
          : "Could not record app usage event.",
    });
  }
};
