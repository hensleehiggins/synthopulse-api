// /api/tripleseat/callback.js

const REQUIRED_ENV_VARS = [
  "TRIPLESEAT_CLIENT_ID",
  "TRIPLESEAT_CLIENT_SECRET",
  "TRIPLESEAT_REDIRECT_URI",
  "TRIPLESEAT_TOKEN_URL",
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
    TRIPLESEAT_CLIENT_ID: process.env.TRIPLESEAT_CLIENT_ID ? "set" : "missing",
    TRIPLESEAT_CLIENT_SECRET: process.env.TRIPLESEAT_CLIENT_SECRET ? "set" : "missing",
    TRIPLESEAT_REDIRECT_URI: process.env.TRIPLESEAT_REDIRECT_URI ? "set" : "missing",
    TRIPLESEAT_TOKEN_URL: process.env.TRIPLESEAT_TOKEN_URL ? "set" : "missing",
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

function calculateExpiresAt(tokenResponse) {
  const expiresIn = Number(tokenResponse.expires_in || tokenResponse.expiresIn);

  if (!expiresIn || Number.isNaN(expiresIn)) {
    return undefined;
  }

  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

async function storeTokenInAirtable(tokenResponse) {
  const account = await findTripleseatIntegrationAccount();

  if (!account?.id) {
    throw new Error("No Integration Accounts record found where Provider = Tripleseat.");
  }

  const fields = {
    Status: "Connected",
    "Access Token": tokenResponse.access_token || "",
    "Last Synced At": new Date().toISOString(),
    "Last Error": "",
    Notes:
      "Tripleseat OAuth token captured through /api/tripleseat/callback. Stored for controlled/demo phase only.",
  };

  if (tokenResponse.refresh_token) {
    fields["Refresh Token"] = tokenResponse.refresh_token;
  }

  if (tokenResponse.scope) {
    fields.Scope = tokenResponse.scope;
  }

  const expiresAt = calculateExpiresAt(tokenResponse);
  if (expiresAt) {
    fields["Token Expires At"] = expiresAt;
  }

  const response = await fetch(`${airtableIntegrationUrl()}/${account.id}`, {
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

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Airtable token storage error ${response.status}: ${text}`);
  }

  return {
    accountRecordId: account.id,
    airtableResponse: JSON.parse(text),
  };
}

async function exchangeCodeForToken(code) {
  const body = new URLSearchParams();

  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", process.env.TRIPLESEAT_REDIRECT_URI);
  body.set("client_id", process.env.TRIPLESEAT_CLIENT_ID);
  body.set("client_secret", process.env.TRIPLESEAT_CLIENT_SECRET);

  const response = await fetch(process.env.TRIPLESEAT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`Tripleseat token exchange error ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed",
      });
    }

    const { code, state, error, error_description } = req.query || {};

    if (error) {
      return res.status(400).json({
        ok: false,
        route: "/api/tripleseat/callback",
        message: "Tripleseat returned an OAuth error.",
        error,
        error_description,
      });
    }

    const missing = missingEnvVars();

    if (missing.length > 0) {
      return res.status(200).json({
        ok: false,
        route: "/api/tripleseat/callback",
        message: "Tripleseat OAuth callback route is installed, but required env vars are missing.",
        receivedCode: code ? "yes" : "no",
        state: state || null,
        missingEnvVars: missing,
        envStatus: envStatus(),
      });
    }

    if (!code) {
      return res.status(200).json({
        ok: true,
        route: "/api/tripleseat/callback",
        message: "Tripleseat OAuth callback route is installed. No code received yet.",
        receivedCode: "no",
        state: state || null,
        envStatus: envStatus(),
      });
    }

    const tokenResponse = await exchangeCodeForToken(code);
    const storageResult = await storeTokenInAirtable(tokenResponse);

    return res.status(200).json({
      ok: true,
      route: "/api/tripleseat/callback",
      message: "Tripleseat OAuth token received and stored in Airtable Integration Accounts.",
      receivedCode: "yes",
      state: state || null,
      integrationAccountRecordId: storageResult.accountRecordId,
      tokenStored: Boolean(tokenResponse.access_token),
      refreshTokenStored: Boolean(tokenResponse.refresh_token),
      expiresAt: calculateExpiresAt(tokenResponse) || null,
    });
  } catch (error) {
    console.error("Tripleseat callback route error:", error);

    return res.status(500).json({
      ok: false,
      route: "/api/tripleseat/callback",
      error: error.message,
    });
  }
}
