function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function preview(value, max = 12000) {
  if (value === null || value === undefined) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function summarizeJson(json) {
  if (Array.isArray(json)) {
    return {
      shape: "array",
      count: json.length,
      sample: json.slice(0, 3),
    };
  }

  if (json && typeof json === "object") {
    const keys = Object.keys(json);
    const possibleArrays = {};

    for (const key of keys) {
      if (Array.isArray(json[key])) {
        possibleArrays[key] = {
          count: json[key].length,
          sample: json[key].slice(0, 3),
        };
      }
    }

    return {
      shape: "object",
      keys,
      possibleArrays,
      sample: json,
    };
  }

  return {
    shape: typeof json,
    sample: json,
  };
}

async function getTripleseatAccessToken() {
  const tokenUrl = requireEnv("TRIPLESEAT_TOKEN_URL");
  const clientId = requireEnv("TRIPLESEAT_CLIENT_ID");
  const clientSecret = requireEnv("TRIPLESEAT_CLIENT_SECRET");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }).toString(),
  });

  const raw = await response.text();

  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }

  if (!response.ok || !json?.access_token) {
    throw new Error(
      json?.error_description ||
        json?.error ||
        `Failed to get Tripleseat access token. Status ${response.status}. Preview: ${raw.slice(0, 400)}`
    );
  }

  return json.access_token;
}

async function testEndpoint({ url, accessToken }) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": "KitchenPulse/1.0",
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();

  let parsedJson = false;
  let json = null;

  try {
    json = JSON.parse(raw);
    parsedJson = true;
  } catch {
    parsedJson = false;
  }

  return {
    url,
    ok: response.ok,
    status: response.status,
    contentType,
    parsedJson,
    summary: parsedJson ? summarizeJson(json) : null,
    rawPreview: parsedJson ? null : preview(raw, 3000),
  };
}

module.exports = async function handler(req, res) {
  try {
    const accessToken = await getTripleseatAccessToken();

    const apiBaseUrl = requireEnv("TRIPLESEAT_API_BASE_URL").replace(/\/$/, "");
    const locationId = process.env.TRIPLESEAT_LOCATION_ID || "34084";

    const candidates = [
      `${apiBaseUrl}/leads`,
      `${apiBaseUrl}/leads?location_id=${encodeURIComponent(locationId)}`,
      `${apiBaseUrl}/lead_sources`,
      `${apiBaseUrl}/bookings`,
      `${apiBaseUrl}/bookings?location_id=${encodeURIComponent(locationId)}`,
    ];

    const results = [];

    for (const url of candidates) {
      results.push(await testEndpoint({ url, accessToken }));
    }

    const winners = results.filter(
      (result) =>
        result.ok &&
        result.parsedJson &&
        result.summary &&
        (
          result.summary.shape === "array" ||
          Object.values(result.summary.possibleArrays || {}).some(
            (item) => item.count > 0
          )
        )
    );

    return res.status(200).json({
      ok: true,
      checkedAt: new Date().toISOString(),
      apiBaseUrl,
      locationId,
      winnerCount: winners.length,
      winners: winners.map((winner) => ({
        url: winner.url,
        status: winner.status,
        summary: winner.summary,
      })),
      results,
    });
  } catch (error) {
    console.error("tripleseat-leads-probe error", error);

    return res.status(500).json({
      ok: false,
      error: error.message || "Tripleseat leads probe failed",
    });
  }
};
