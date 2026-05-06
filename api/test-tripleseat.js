const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function send(res, status, body) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  return res.status(status).json(body);
}

async function tryFetchEventsWithBearer(token) {
  const url = "https://api.tripleseat.com/v1/events.json";

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    mode: "bearer_direct",
    bodyPreview: json || text.slice(0, 800),
  };
}

async function tryFetchEventsWithQueryKey(key) {
  const url = `https://api.tripleseat.com/v1/events.json?api_key=${encodeURIComponent(key)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const text = await response.text();

  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    mode: "query_api_key",
    bodyPreview: json || text.slice(0, 800),
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return send(res, 200, { ok: true });
  }

  if (req.method !== "GET") {
    return send(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const key = process.env.TRIPLESEAT_API_KEY;

    if (!key) {
      return send(res, 500, {
        ok: false,
        error: "Missing TRIPLESEAT_API_KEY environment variable.",
      });
    }

    const bearerAttempt = await tryFetchEventsWithBearer(key);

    if (bearerAttempt.ok) {
      return send(res, 200, {
        ok: true,
        workingMode: "bearer_direct",
        result: bearerAttempt,
      });
    }

    const queryAttempt = await tryFetchEventsWithQueryKey(key);

    if (queryAttempt.ok) {
      return send(res, 200, {
        ok: true,
        workingMode: "query_api_key",
        result: queryAttempt,
      });
    }

    return send(res, 401, {
      ok: false,
      error: "Tripleseat auth test failed using both Bearer token and api_key query styles.",
      attempts: [bearerAttempt, queryAttempt],
      nextStep:
        "If the key you found is a consumer key, we also need the consumer secret for OAuth2 token generation.",
    });
  } catch (error) {
    console.error("test-tripleseat error", error);

    return send(res, 500, {
      ok: false,
      error: error.message || "Tripleseat test failed.",
    });
  }
};
