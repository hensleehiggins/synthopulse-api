// /api/tripleseat/auth.js

const REQUIRED_ENV_VARS = [
  "TRIPLESEAT_CLIENT_ID",
  "TRIPLESEAT_REDIRECT_URI",
  "TRIPLESEAT_AUTH_URL",
];

function missingEnvVars() {
  return REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
}

function buildAuthUrl() {
  const authUrl = new URL(process.env.TRIPLESEAT_AUTH_URL);

  authUrl.searchParams.set("client_id", process.env.TRIPLESEAT_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", process.env.TRIPLESEAT_REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");

  if (process.env.TRIPLESEAT_SCOPE) {
    authUrl.searchParams.set("scope", process.env.TRIPLESEAT_SCOPE);
  }

  authUrl.searchParams.set("state", "chloes-tripleseat");

  return authUrl.toString();
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed",
      });
    }

    const missing = missingEnvVars();

    if (missing.length > 0) {
      return res.status(200).json({
        ok: false,
        route: "/api/tripleseat/auth",
        message: "Tripleseat OAuth start route is installed, but required env vars are missing.",
        missingEnvVars: missing,
envStatus: {
  TRIPLESEAT_CLIENT_ID: process.env.TRIPLESEAT_CLIENT_ID ? "set" : "missing",
  TRIPLESEAT_REDIRECT_URI: process.env.TRIPLESEAT_REDIRECT_URI ? "set" : "missing",
  TRIPLESEAT_AUTH_URL: process.env.TRIPLESEAT_AUTH_URL ? "set" : "missing",
  TRIPLESEAT_SCOPE: process.env.TRIPLESEAT_SCOPE ? "set" : "not set",
},
        requiredEnvVars: REQUIRED_ENV_VARS,
        optionalEnvVars: ["TRIPLESEAT_SCOPE"],
      });
    }

    const redirectTo = buildAuthUrl();

    return res.redirect(302, redirectTo);
  } catch (error) {
    console.error("Tripleseat auth route error:", error);

    return res.status(500).json({
      ok: false,
      route: "/api/tripleseat/auth",
      error: error.message,
    });
  }
}
