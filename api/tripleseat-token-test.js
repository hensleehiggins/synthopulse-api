function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
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
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    });

    const text = await response.text();

    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    return res.status(response.status).json({
      ok: response.ok,
      status: response.status,
      tokenUrl,
      receivedAccessToken: Boolean(json?.access_token),
      tokenType: json?.token_type || null,
      expiresIn: json?.expires_in || null,
      scope: json?.scope || null,
      error: json?.error || null,
      errorDescription: json?.error_description || null,
      rawPreview: response.ok ? null : text.slice(0, 500),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Tripleseat token test failed",
    });
  }
};
