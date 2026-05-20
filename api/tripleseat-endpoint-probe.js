function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
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

  const json = await response.json();

  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Failed to get Tripleseat access token");
  }

  return json.access_token;
}

async function testEndpoint(accessToken, url) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "KitchenPulse/1.0",
    },
  });

  const bodyText = await response.text();

  let json = null;
  try {
    json = JSON.parse(bodyText);
  } catch {
    json = null;
  }

  return {
    url,
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type"),
    parsedJson: Boolean(json),
    topLevelKeys: json && typeof json === "object" ? Object.keys(json) : [],
    count: Array.isArray(json)
      ? json.length
      : Array.isArray(json?.locations)
        ? json.locations.length
        : Array.isArray(json?.results)
          ? json.results.length
          : null,
    sample: json
      ? Array.isArray(json)
        ? json.slice(0, 2)
        : Array.isArray(json.locations)
          ? json.locations.slice(0, 2)
          : Array.isArray(json.results)
            ? json.results.slice(0, 2)
            : json
      : null,
    rawPreview: json ? null : bodyText.slice(0, 220),
  };
}

module.exports = async function handler(req, res) {
  try {
    const accessToken = await getTripleseatAccessToken();

    const urls = [
      "https://api.tripleseat.com/api/v1/locations",
      "https://api.tripleseat.com/api/v1/locations.json",
      "https://api.tripleseat.com/v1/locations",
      "https://api.tripleseat.com/v1/locations.json",
      "https://api.tripleseat.com/locations",
      "https://api.tripleseat.com/locations.json",
      "https://api.tripleseat.com/api/v1/events",
      "https://api.tripleseat.com/api/v1/events.json",
      "https://api.tripleseat.com/api/v1/bookings",
      "https://api.tripleseat.com/api/v1/bookings.json",
    ];

    const results = [];

    for (const url of urls) {
      results.push(await testEndpoint(accessToken, url));
    }

    return res.status(200).json({
      ok: true,
      checkedAt: new Date().toISOString(),
      results,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Tripleseat endpoint probe failed",
    });
  }
};
