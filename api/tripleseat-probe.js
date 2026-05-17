// /api/tripleseat-probe.js

const REQUIRED_ENV_VARS = [
  "TRIPLESEAT_API_BASE_URL",
  "TRIPLESEAT_API_KEY",
];

function missingEnvVars() {
  return REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
}

function envStatus() {
  return {
    TRIPLESEAT_API_BASE_URL: process.env.TRIPLESEAT_API_BASE_URL ? "set" : "missing",
    TRIPLESEAT_API_KEY: process.env.TRIPLESEAT_API_KEY ? "set" : "missing",
  };
}

function buildUrl(path) {
  const base = process.env.TRIPLESEAT_API_BASE_URL.replace(/\/$/, "");
  return `${base}${path}`;
}

async function tryEndpoint(path) {
  const url = buildUrl(path);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.TRIPLESEAT_API_KEY}`,
      "X-API-Key": process.env.TRIPLESEAT_API_KEY,
    },
  });

  const text = await response.text();

  return {
    path,
    url,
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get("content-type"),
    bodyPreview: text.slice(0, 500),
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

    const missing = missingEnvVars();

    if (missing.length > 0) {
      return res.status(200).json({
        ok: false,
        route: "/api/tripleseat-probe",
        message: "Tripleseat probe route is installed, but required env vars are missing.",
        missingEnvVars: missing,
        envStatus: envStatus(),
      });
    }

    const paths = [
      "/events.json",
      "/events",
      "/v1/events.json",
      "/v1/events",
      "/bookings.json",
      "/bookings",
      "/v1/bookings.json",
      "/v1/bookings",
    ];

    const results = [];

    for (const path of paths) {
      try {
        results.push(await tryEndpoint(path));
      } catch (error) {
        results.push({
          path,
          ok: false,
          error: error.message,
        });
      }
    }

    return res.status(200).json({
      ok: true,
      route: "/api/tripleseat-probe",
      message: "Tripleseat API probe completed.",
      envStatus: envStatus(),
      results,
    });
  } catch (error) {
    console.error("Tripleseat probe route error:", error);

    return res.status(500).json({
      ok: false,
      route: "/api/tripleseat-probe",
      error: error.message,
    });
  }
}
