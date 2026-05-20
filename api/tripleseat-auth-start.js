function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

module.exports = async function handler(req, res) {
  try {
    const authUrl = requireEnv("TRIPLESEAT_AUTH_URL");
    const clientId = requireEnv("TRIPLESEAT_CLIENT_ID");
    const redirectUri = requireEnv("TRIPLESEAT_REDIRECT_URI");

    // Tripleseat docs show scope as read write.
    // We can move this to an env var later if needed.
    const scope = process.env.TRIPLESEAT_SCOPE || "read write";

    const statePayload = {
      source: "kitchenpulse",
      createdAt: new Date().toISOString(),
    };

    const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

    const url = new URL(authUrl);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scope);
    url.searchParams.set("state", state);

    res.writeHead(302, {
      Location: url.toString(),
    });

    return res.end();
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to start Tripleseat OAuth",
    });
  }
};
