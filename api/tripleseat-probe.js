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

function apiBase() {
  return process.env.TRIPLESEAT_API_BASE_URL.replace(/\/$/, "");
}

function redactedUrl(url) {
  return url
    .replace(/api_key=[^&]+/g, "api_key=REDACTED")
    .replace(/auth_token=[^&]+/g, "auth_token=REDACTED")
    .replace(/access_token=[^&]+/g, "access_token=REDACTED");
}

async function fetchWithPreview(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  return {
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get("content-type"),
    bodyPreview: text.slice(0, 600),
  };
}

async function tryRequest(label, path, authMode) {
  const key = process.env.TRIPLESEAT_API_KEY;
  let url = `${apiBase()}${path}`;
  const headers = {
    Accept: "application/json",
  };

  if (authMode === "bearer") {
    headers.Authorization = `Bearer ${key}`;
  }

  if (authMode === "x-api-key") {
    headers["X-API-Key"] = key;
  }

  if (authMode === "token-header") {
    headers.Authorization = `Token token=${key}`;
  }

  if (authMode === "api-key-query") {
    url += url.includes("?") ? `&api_key=${encodeURIComponent(key)}` : `?api_key=${encodeURIComponent(key)}`;
  }

  if (authMode === "auth-token-query") {
    url += url.includes("?") ? `&auth_token=${encodeURIComponent(key)}` : `?auth_token=${encodeURIComponent(key)}`;
  }

  if (authMode === "access-token-query") {
    url += url.includes("?") ? `&access_token=${encodeURIComponent(key)}` : `?access_token=${encodeURIComponent(key)}`;
  }

  const result = await fetchWithPreview(url, {
    method: "GET",
    headers,
  });

  return {
    label,
    path,
    authMode,
    url: redactedUrl(url),
    ...result,
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
      "/v1/events.json",
      "/v1/bookings.json",
      "/v1/leads.json",
      "/v1/accounts.json",
      "/v1/contacts.json",
    ];

    const authModes = [
      "bearer",
      "x-api-key",
      "token-header",
      "api-key-query",
      "auth-token-query",
      "access-token-query",
    ];

    const results = [];

    for (const path of paths) {
      for (const authMode of authModes) {
        try {
          results.push(await tryRequest(`${path} with ${authMode}`, path, authMode));
        } catch (error) {
          results.push({
            label: `${path} with ${authMode}`,
            path,
            authMode,
            ok: false,
            error: error.message,
          });
        }
      }
    }

    const usefulResults = results.filter((result) => {
      const body = String(result.bodyPreview || "").toLowerCase();
      return (
        result.ok ||
        result.status === 401 ||
        result.status === 403 ||
        body.includes("permission") ||
        body.includes("unauthorized") ||
        body.includes("invalid") ||
        body.includes("token") ||
        body.includes("api")
      );
    });

    return res.status(200).json({
      ok: true,
      route: "/api/tripleseat-probe",
      message: "Tripleseat API auth-style probe completed.",
      envStatus: envStatus(),
      summary: {
        totalRequests: results.length,
        usefulResults: usefulResults.length,
      },
      results: usefulResults,
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
