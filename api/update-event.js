export default async function handler(req, res) {
  // CORS for Softr/Vibe
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Browser health check. This prevents the scary Vercel crash page on GET.
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      route: "update-event",
      message: "Route is live. Use POST to update an event.",
      time: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  function localDateTimeToEasternIso(value) {
  if (!value) return "";

  // Softr/Vibe datetime-local sends values like "2026-05-05T17:00".
  // Treat that as Eastern restaurant time and convert to UTC for Airtable.
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return value;

  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  // KitchenPulse first tenant is Georgia/Eastern.
  // May is EDT, so Eastern local + 4 hours = UTC.
  const utcMs = Date.UTC(year, month - 1, day, hour + 4, minute || 0, 0);

  return new Date(utcMs).toISOString();
}
  try {
    const body = req.body || {};

    const recordId = body.recordId;
    const eventName = body.eventName;
    const startDateTime = body.startDateTime;
    const endDateTime = body.endDateTime;
    const venueArea = body.venueArea;
    const estimatedDraw = body.estimatedDraw;
    const trafficEffect = body.trafficEffect;

    if (!recordId) {
      return res.status(400).json({
        ok: false,
        error: "Missing recordId",
      });
    }

    const AIRTABLE_TOKEN =
      process.env.AIRTABLE_PAT ||
      process.env.AIRTABLE_TOKEN ||
      process.env.AIRTABLE_API_KEY ||
      process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;

    const AIRTABLE_BASE_ID =
      process.env.AIRTABLE_BASE_ID ||
      process.env.KITCHENPULSE_BASE_ID;

    if (!AIRTABLE_TOKEN) {
      return res.status(500).json({
        ok: false,
        error: "Missing Airtable token environment variable",
      });
    }

    if (!AIRTABLE_BASE_ID) {
      return res.status(500).json({
        ok: false,
        error: "Missing Airtable base ID environment variable",
      });
    }

    const tableName = "External Factors";

    const fields = {};

    // Writable text fields
    if (eventName !== undefined) {
      fields["Event Name"] = eventName || "";
      fields["Description"] = eventName || "";
    }

    if (venueArea !== undefined) {
      fields["Venue / Area"] = venueArea || "";
    }

    // Writable date fields.
    // Do NOT write Event Sort Date. It is a formula.
    if (startDateTime !== undefined && startDateTime !== "") {
  fields["Start DateTime"] = localDateTimeToEasternIso(startDateTime);
}

if (endDateTime !== undefined && endDateTime !== "") {
  fields["End DateTime"] = localDateTimeToEasternIso(endDateTime);
}

    // Writable single-select fields.
    // Your Airtable choices are exactly:
    // Estimated Draw: Low, Medium, High, Very High
    // Traffic Effect: Low, Medium, High, Very High, High positive
    if (estimatedDraw !== undefined && estimatedDraw !== "") {
      fields["Estimated Draw"] = estimatedDraw;
    }

    if (trafficEffect !== undefined && trafficEffect !== "") {
      fields["Traffic Effect"] = trafficEffect;
    }

    // Writable checkbox helpers.
    // Do NOT write Event Board Column. It is a formula.
    // Airtable formula decides:
    // Needs Review / Active Today / Upcoming Impact
    if (startDateTime) {
      const eventDate = new Date(startDateTime);
      const now = new Date();

      const eventDay = new Date(
        eventDate.getFullYear(),
        eventDate.getMonth(),
        eventDate.getDate()
      );

      const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

      if (eventDay.getTime() === today.getTime()) {
        fields["Active"] = true;
        fields["Needs Review"] = false;
      } else if (eventDay.getTime() > today.getTime()) {
        fields["Active"] = false;
        fields["Needs Review"] = false;
      } else {
        fields["Active"] = false;
        fields["Needs Review"] = false;
      }
    }

    console.log("update-event payload:", {
      recordId,
      fields,
    });

    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
      tableName
    )}/${recordId}`;

    const airtableRes = await fetch(airtableUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields,
        typecast: true,
      }),
    });

    let airtableData = null;
    const rawText = await airtableRes.text();

    try {
      airtableData = rawText ? JSON.parse(rawText) : null;
    } catch (parseErr) {
      airtableData = {
        raw: rawText,
      };
    }

    if (!airtableRes.ok) {
      console.error("Airtable update failed:", {
        status: airtableRes.status,
        airtableData,
        fields,
      });

      return res.status(airtableRes.status).json({
        ok: false,
        error:
          airtableData?.error?.message ||
          airtableData?.error?.type ||
          rawText ||
          "Airtable update failed",
        airtable: airtableData,
        sentFields: fields,
      });
    }

    return res.status(200).json({
      ok: true,
      recordId,
      updatedFields: fields,
      airtable: airtableData,
    });
  } catch (err) {
    console.error("update-event crashed:", err);

    return res.status(500).json({
      ok: false,
      error: err?.message || "Unknown server error",
    });
  }
}
