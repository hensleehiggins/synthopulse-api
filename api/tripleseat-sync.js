// /api/tripleseat-sync.js

const REQUIRED_ENV_VARS = [
  "TRIPLESEAT_API_BASE_URL",
  "AIRTABLE_BASE_ID",
];

const AIRTABLE_TOKEN = process.env.AIRTABLE_PAT || process.env.AIRTABLE_TOKEN;

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

    return res.status(200).json({
      ok: true,
      route: "/api/tripleseat-sync",
      message: "Tripleseat sync route is installed. Token lookup and event fetch are the next step.",
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
