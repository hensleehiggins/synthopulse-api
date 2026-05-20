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

  const list =
    Array.isArray(json) ? json :
    Array.isArray(json?.events) ? json.events :
    Array.isArray(json?.bookings) ? json.bookings :
    Array.isArray(json?.leads) ? json.leads :
    Array.isArray(json?.results) ? json.results :
    null;

  return {
    url,
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type"),
    parsedJson: Boolean(json),
    topLevelKeys: json && typeof json === "object" ? Object.keys(json) : [],
    count: Array.isArray(list) ? list.length : null,
    sample: Array.isArray(list) ? list.slice(0, 2) : json,
    rawPreview: json ? null : bodyText.slice(0, 300),
  };
}

module.exports = async function handler(req, res) {
  try {
    const accessToken = await getTripleseatAccessToken();
    const apiBaseUrl = requireEnv("TRIPLESEAT_API_BASE_URL").replace(/\/$/, "");

    const locationId = process.env.TRIPLESEAT_LOCATION_ID || "34084";

    const urls = [
      `${apiBaseUrl}/events`,
      `${apiBaseUrl}/events?location_id=${locationId}`,
      `${apiBaseUrl}/events.json`,
      `${apiBaseUrl}/events.json?location_id=${locationId}`,

      `${apiBaseUrl}/bookings`,
      `${apiBaseUrl}/bookings?location_id=${locationId}`,
      `${apiBaseUrl}/bookings.json`,
      `${apiBaseUrl}/bookings.json?location_id=${locationId}`,

      `${apiBaseUrl}/leads`,
      `${apiBaseUrl}/leads?location_id=${locationId}`,
      `${apiBaseUrl}/leads.json`,
      `${apiBaseUrl}/leads.json?location_id=${locationId}`,

      `${apiBaseUrl}/accounts`,
      `${apiBaseUrl}/contacts`,
    ];

    const results = [];

    for (const url of urls) {
      results.push(await testEndpoint(accessToken, url));
    }

    return res.status(200).json({
      ok: true,
      checkedAt: new Date().toISOString(),
      apiBaseUrl,
      locationId,
      results,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Tripleseat events probe failed",
    });
  }
};
