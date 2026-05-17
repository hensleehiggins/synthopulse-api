// /api/tripleseat-oauth-probe.js

const CLIENT_ID = process.env.TRIPLESEAT_CLIENT_ID;
const REDIRECT_URI =
  process.env.TRIPLESEAT_REDIRECT_URI ||
  "https://project-1csz2.vercel.app/api/tripleseat/callback";

const BASES = [
  "https://api.tripleseat.com",
  "https://www.tripleseat.com",
  "https://tripleseat.com",
  "https://chloessteakhouse.tripleseat.com",
];

const AUTH_PATHS = [
  "/oauth/authorize",
  "/oauth2/authorize",
  "/oauth/authorize.json",
  "/oauth2/authorize.json",
  "/oauth/applications/authorize",
  "/oauth2/applications/authorize",
];

const TOKEN_PATHS = [
  "/oauth/token",
  "/oauth2/token",
  "/oauth/token.json",
  "/oauth2/token.json",
  "/api/oauth/token",
  "/api/oauth2/token",
];

function buildAuthUrl(base, path) {
  const url = new URL(`${base}${path}`);
  url.searchParams.set("client_id", CLIENT_ID || "missing-client-id");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", "probe");
  return url.toString();
}

async function probeGet(url) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      Accept: "text/html,application/json",
    },
  });

  const text = await response.text();

  return {
    status: response.status,
    ok: response.ok,
    location: response.headers.get("location"),
    contentType: response.headers.get("content-type"),
    bodyPreview: text.slice(0, 300),
  };
}

async function probePost(url) {
  const response = await fetch(url, {
    method: "POST",
    redirect: "manual",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: "probe-code",
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID || "missing-client-id",
      client_secret: "probe-secret",
    }),
  });

  const text = await response.text();

  return {
    status: response.status,
    ok: response.ok,
    location: response.headers.get("location"),
    contentType: response.headers.get("content-type"),
    bodyPreview: text.slice(0, 300),
  };
}

export default async function handler(req, res) {
  try {
    const authResults = [];
    const tokenResults = [];

    for (const base of BASES) {
      for (const path of AUTH_PATHS) {
        const url = buildAuthUrl(base, path);

        try {
          const result = await probeGet(url);
          authResults.push({
            base,
            path,
            url,
            ...result,
          });
        } catch (error) {
          authResults.push({
            base,
            path,
            error: error.message,
          });
        }
      }

      for (const path of TOKEN_PATHS) {
        const url = `${base}${path}`;

        try {
          const result = await probePost(url);
          tokenResults.push({
            base,
            path,
            url,
            ...result,
          });
        } catch (error) {
          tokenResults.push({
            base,
            path,
            error: error.message,
          });
        }
      }
    }

    const interestingAuthResults = authResults.filter((r) => {
      const body = String(r.bodyPreview || "").toLowerCase();
      return (
        r.status !== 404 ||
        body.includes("oauth") ||
        body.includes("authorize") ||
        body.includes("invalid") ||
        body.includes("client")
      );
    });

    const interestingTokenResults = tokenResults.filter((r) => {
      const body = String(r.bodyPreview || "").toLowerCase();
      return (
        r.status !== 404 ||
        body.includes("oauth") ||
        body.includes("token") ||
        body.includes("invalid") ||
        body.includes("client")
      );
    });

    return res.status(200).json({
      ok: true,
      route: "/api/tripleseat-oauth-probe",
      message: "OAuth endpoint probe completed.",
      clientIdStatus: CLIENT_ID ? "set" : "missing",
      redirectUri: REDIRECT_URI,
      summary: {
        authResults: authResults.length,
        interestingAuthResults: interestingAuthResults.length,
        tokenResults: tokenResults.length,
        interestingTokenResults: interestingTokenResults.length,
      },
      interestingAuthResults,
      interestingTokenResults,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      route: "/api/tripleseat-oauth-probe",
      error: error.message,
    });
  }
}
