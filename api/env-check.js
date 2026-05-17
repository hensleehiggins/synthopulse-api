// /api/env-check.js

function summarizeUrl(value) {
  if (!value) return { status: "missing" };

  try {
    const url = new URL(value);
    return {
      status: "set",
      origin: url.origin,
      pathname: url.pathname,
      fullNonSecretValue: value,
    };
  } catch {
    return {
      status: "set-but-invalid-url",
      preview: String(value).slice(0, 80),
    };
  }
}

function summarizeSecret(value) {
  if (!value) return { status: "missing" };

  return {
    status: "set",
    length: String(value).length,
    startsWith: String(value).slice(0, 4),
    endsWith: String(value).slice(-4),
  };
}

export default async function handler(req, res) {
  return res.status(200).json({
    ok: true,
    route: "/api/env-check",
    env: {
      TRIPLESEAT_AUTH_URL: summarizeUrl(process.env.TRIPLESEAT_AUTH_URL),
      TRIPLESEAT_TOKEN_URL: summarizeUrl(process.env.TRIPLESEAT_TOKEN_URL),
      TRIPLESEAT_API_BASE_URL: summarizeUrl(process.env.TRIPLESEAT_API_BASE_URL),
      TRIPLESEAT_REDIRECT_URI: summarizeUrl(process.env.TRIPLESEAT_REDIRECT_URI),

      TRIPLESEAT_CLIENT_ID: summarizeSecret(process.env.TRIPLESEAT_CLIENT_ID),
      TRIPLESEAT_CLIENT_SECRET: summarizeSecret(process.env.TRIPLESEAT_CLIENT_SECRET),
      TRIPLESEAT_API_KEY: summarizeSecret(process.env.TRIPLESEAT_API_KEY),
      TRIPLESEAT_WEBHOOK_SECRET: summarizeSecret(process.env.TRIPLESEAT_WEBHOOK_SECRET),

      AIRTABLE_BASE_ID: summarizeSecret(process.env.AIRTABLE_BASE_ID),
      AIRTABLE_PAT_OR_TOKEN: summarizeSecret(process.env.AIRTABLE_PAT || process.env.AIRTABLE_TOKEN),
      AIRTABLE_CHLOES_RESTAURANT_ID: summarizeSecret(process.env.AIRTABLE_CHLOES_RESTAURANT_ID),
    },
    checkedAt: new Date().toISOString(),
  });
}
