// /api/tripleseat-sync.js

const REQUIRED_ENV_VARS = [
  "TRIPLESEAT_API_BASE_URL",
  "AIRTABLE_BASE_ID",
];

const AIRTABLE_TOKEN = process.env.AIRTABLE_PAT || process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const INTEGRATION_TABLE_NAME = "Integration Accounts";

function missingEnvVars() {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

  if (!AIRTABLE_TOKEN) {
    missing.push("AIRTABLE_PAT or AIRTABLE_TOKEN");
  }

  return missing;
}

function envStatus() {
  return {
    TRIPLESEAT_API_BASE_URL: process.env.TRIPLESEAT_API_BASE_URL ? "set" : "missing",
    AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID ? "set" : "missing",
    AIRTABLE_PAT_OR_TOKEN: AIRTABLE_TOKEN ? "set" : "missing",
  };
}

function airtableIntegrationUrl() {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    INTEGRATION_TABLE_NAME
  )}`;
}

async function findTripleseatIntegrationAccount() {
  const formula = `{Provider} = "Tripleseat"`;

  const url = `${airtableIntegrationUrl()}?filterByFormula=${encodeURIComponent(
    formula
  )}&maxRecords=1`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
    },
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Airtable integration lookup error ${response.status}: ${text}`);
  }

  const data = JSON.parse(text);
  return data.records?.[0] || null;
}

function getField(record, fieldName) {
  return record?.fields?.[fieldName];
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed",
      });
    }

    const missing = missingEnvVars();

    if (missing.length > 0) {
      return res.status(200).json({
        ok: false,
        route: "/api/tripleseat-sync",
        message: "Tripleseat sync route is installed, but required env vars are missing.",
        missingEnvVars: missing,
        envStatus: envStatus(),
      });
    }

    const account = await findTripleseatIntegrationAccount();

    if (!account?.id) {
      return res.status(200).json({
        ok: false,
        route: "/api/tripleseat-sync",
        message: "No Integration Accounts record found where Provider = Tripleseat.",
        envStatus: envStatus(),
      });
    }

    const accessToken = getField(account, "Access Token");
    const refreshToken = getField(account, "Refresh Token");
    const status = getField(account, "Status");
    const tokenExpiresAt = getField(account, "Token Expires At");
    const lastSyncedAt = getField(account, "Last Synced At");
    const lastError = getField(account, "Last Error");

    if (!accessToken) {
      return res.status(200).json({
        ok: false,
        route: "/api/tripleseat-sync",
        message: "Tripleseat Integration Account exists, but no Access Token is stored yet.",
        integrationAccountRecordId: account.id,
        accountName: getField(account, "Account Name") || null,
        status: status || null,
        hasAccessToken: false,
        hasRefreshToken: Boolean(refreshToken),
        tokenExpiresAt: tokenExpiresAt || null,
        lastSyncedAt: lastSyncedAt || null,
        lastError: lastError || null,
        nextStep: "Owner OAuth authorization is still needed before Tripleseat event sync can run.",
        envStatus: envStatus(),
      });
    }

    return res.status(200).json({
      ok: true,
      route: "/api/tripleseat-sync",
      message: "Tripleseat token found. Event fetch mapping is the next step.",
      integrationAccountRecordId: account.id,
      accountName: getField(account, "Account Name") || null,
      status: status || null,
      hasAccessToken: true,
      hasRefreshToken: Boolean(refreshToken),
      tokenExpiresAt: tokenExpiresAt || null,
      lastSyncedAt: lastSyncedAt || null,
      lastError: lastError || null,
      envStatus: envStatus(),
    });
  } catch (error) {
    console.error("Tripleseat sync route error:", error);

    return res.status(500).json({
      ok: false,
      route: "/api/tripleseat-sync",
      error: error.message,
    });
  }
}
