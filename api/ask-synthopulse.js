module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const AIRTABLE_PAT = String(process.env.AIRTABLE_PAT || "").trim();
  const AIRTABLE_BASE_ID = String(process.env.AIRTABLE_BASE_ID || "").trim();
  const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();

  // ✅ DEBUG + AUTH CHECK ROUTE
  if (req.method === "GET") {
    let airtableAuthCheck = null;

    try {
      const testResponse = await fetch(
        `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${AIRTABLE_PAT}`,
            "Content-Type": "application/json"
          }
        }
      );

      const text = await testResponse.text();

      airtableAuthCheck = {
        status: testResponse.status,
        ok: testResponse.ok,
        body_preview: text.slice(0, 300)
      };
    } catch (err) {
      airtableAuthCheck = {
        status: "request_failed",
        ok: false,
        body_preview: err.message
      };
    }

    return res.status(200).json({
      status: "ok",
      message: "SynthoPulse API is live.",
      debug: {
        airtable_pat_prefix: AIRTABLE_PAT.slice(0, 4),
        airtable_pat_length: AIRTABLE_PAT.length,
        airtable_base_id: AIRTABLE_BASE_ID,
        openai_key_prefix: OPENAI_API_KEY.slice(0, 3),
        openai_key_length: OPENAI_API_KEY.length,
        airtable_auth_check: airtableAuthCheck
      }
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const body = req.body || {};
    const message = String(body.message || "").trim();

    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    // 🔴 Airtable test call (this is where your failure is happening)
    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Runs?maxRecords=1`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          "Content-Type": "application/json"
        }
      }
    );

    const airtableText = await airtableRes.text();

    if (!airtableRes.ok) {
      return res.status(500).json({
        error: "Airtable error",
        status: airtableRes.status,
        body: airtableText
      });
    }

    // 🔵 OpenAI call
    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5.3",
        input: `You are SynthoPulse AI, a restaurant operator copilot.\n\nUser question: ${message}\n\nAnswer clearly and operationally.`
      })
    });

    const openaiData = await openaiRes.json();

    return res.status(200).json({
      reply: openaiData.output?.[0]?.content?.[0]?.text || "No response"
    });

  } catch (err) {
    return res.status(500).json({
      error: "Server crash",
      details: err.message
    });
  }
};
