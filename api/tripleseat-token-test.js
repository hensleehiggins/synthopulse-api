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

async function tryTokenRequest(label, tokenUrl, bodyMode) {
  const clientId = requireEnv("TRIPLESEAT_CLIENT_ID");
  const clientSecret = requireEnv("TRIPLESEAT_CLIENT_SECRET");

  let headers;
  let body;

  if (bodyMode === "form") {
    headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    };

    body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }).toString();
  } else {
    headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    body = JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    });
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers,
    body,
  });

  const bodyText = await response.text();

  let json = null;
  try {
    json = JSON.parse(bodyText);
  } catch {
    json = null;
  }

  return {
    label,
    tokenUrl,
    bodyMode,
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type"),
    parsedJson: Boolean(json),
    topLevelKeys: json && typeof json === "object" ? Object.keys(json) : [],
    receivedAccessToken: Boolean(json?.access_token),
    accessToken: redactToken(json?.access_token),
    tokenType: json?.token_type || null,
    expiresIn: json?.expires_in || null,
    scope: json?.scope || null,
    error: json?.error || null,
    errorDescription: json?.error_description || null,
    rawPreview: bodyText.slice(0, 350),
  };
}

module.exports = async function handler(req, res) {
  try {
    const envTokenUrl = requireEnv("TRIPLESEAT_TOKEN_URL");

    const tests = [
      await tryTokenRequest("env token url + form", envTokenUrl, "form"),
      await tryTokenRequest("env token url + json", envTokenUrl, "json"),
      await tryTokenRequest("oauth2 token + form", "https://api.tripleseat.com/oauth2/token", "form"),
      await tryTokenRequest("oauth token + form", "https://api.tripleseat.com/oauth/token", "form"),
    ];

    return res.status(200).json({
      ok: true,
      checkedAt: new Date().toISOString(),
      tests,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Tripleseat token test failed",
    });
  }
};
