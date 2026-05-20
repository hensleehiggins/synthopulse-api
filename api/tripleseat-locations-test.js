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
    throw new Error(
      json.error_description || json.error || "Failed to get Tripleseat access token"
    );
  }

  return json.access_token;
}

module.exports = async function handler(req, res) {
  try {
    const apiBaseUrl = requireEnv("TRIPLESEAT_API_BASE_URL").replace(/\/$/, "");
    const accessToken = await getTripleseatAccessToken();

    const response = await fetch(`${apiBaseUrl}/locations`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "User-Agent": "KitchenPulse/1.0",
      },
    });

    const text = await response.text();

    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    return res.status(200).json({
      ok: response.ok,
      upstreamStatus: response.status,
      urlTested: `${apiBaseUrl}/locations`,
      parsedJson: Boolean(json),
      topLevelKeys: json && typeof json === "object" ? Object.keys(json) : [],
      count: Array.isArray(json)
        ? json.length
        : Array.isArray(json?.locations)
          ? json.locations.length
          : null,
      sample: Array.isArray(json)
        ? json.slice(0, 3)
        : Array.isArray(json?.locations)
          ? json.locations.slice(0, 3)
          : json,
      rawPreview: json ? null : text.slice(0, 500),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Tripleseat locations test failed",
    });
  }
};
