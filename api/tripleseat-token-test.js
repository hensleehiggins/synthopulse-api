function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function redactToken(value) {
  if (!value || typeof value !== "string") return null;
  return {
    present: true,
    length: value.length,
    startsWith: value.slice(0, 8),
    endsWith: value.slice(-6),
  };
}

module.exports = async function handler(req, res) {
  try {
    const clientId = requireEnv("TRIPLESEAT_CLIENT_ID");
    const clientSecret = requireEnv("TRIPLESEAT_CLIENT_SECRET");

    const tokenUrl =
      process.env.TRIPLESEAT_CLIENT_CREDENTIALS_TOKEN_URL ||
      "https://api.tripleseat.com/oauth/token";

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    });

    const bodyText = await response.text();

    let json = null;
    try {
      json = JSON.parse(bodyText);
    } catch {
      json = null;
    }

    return res.status(200).json({
      ok: response.ok,
      upstreamStatus: response.status,
      tokenUrl,
      parsedJson: Boolean(json),
      topLevelKeys: json && typeof json === "object" ? Object.keys(json) : [],
      receivedAccessToken: Boolean(json?.access_token),
      accessToken: redactToken(json?.access_token),
      tokenType: json?.token_type || null,
      expiresIn: json?.expires_in || null,
      scope: json?.scope || null,
      error: json?.error || null,
      errorDescription: json?.error_description || null,
      rawPreview: bodyText.slice(0, 800),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Tripleseat token test failed",
    });
  }
};
