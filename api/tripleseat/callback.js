// /api/tripleseat/callback.js

const REQUIRED_ENV_VARS = [
  "TRIPLESEAT_CLIENT_ID",
  "TRIPLESEAT_CLIENT_SECRET",
  "TRIPLESEAT_REDIRECT_URI",
  "TRIPLESEAT_TOKEN_URL",
];

function missingEnvVars() {
  return REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
}

function envStatus() {
  return {
    TRIPLESEAT_CLIENT_ID: process.env.TRIPLESEAT_CLIENT_ID ? "set" : "missing",
    TRIPLESEAT_CLIENT_SECRET: process.env.TRIPLESEAT_CLIENT_SECRET ? "set" : "missing",
    TRIPLESEAT_REDIRECT_URI: process.env.TRIPLESEAT_REDIRECT_URI ? "set" : "missing",
    TRIPLESEAT_TOKEN_URL: process.env.TRIPLESEAT_TOKEN_URL ? "set" : "missing",
  };
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

    return res.status(200).json({
      ok: true,
      route: "/api/tripleseat/callback",
      message: "Tripleseat OAuth callback received a code. Token exchange is the next step.",
      receivedCode: "yes",
      state: state || null,
      envStatus: envStatus(),
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
