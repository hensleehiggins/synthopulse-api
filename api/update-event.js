export default async function handler(req, res) {
  // CORS for Softr/Vibe
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const {
      recordId,
      eventName,
      startDateTime,
      endDateTime,
      venueArea,
      estimatedDraw,
      trafficEffect,
    } = req.body || {};

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

    if (eventName !== undefined) {
      fields["Event Name"] = eventName;
      fields["Description"] = eventName;
    }

    if (startDateTime !== undefined && startDateTime !== "") {
  fields["Start DateTime"] = startDateTime;
}

    if (endDateTime !== undefined && endDateTime !== "") {
      fields["End DateTime"] = endDateTime;
    }

    if (venueArea !== undefined) {
      fields["Venue / Area"] = venueArea;
    }

    if (estimatedDraw !== undefined && estimatedDraw !== "") {
      fields["Estimated Draw"] = estimatedDraw;
    }

    if (trafficEffect !== undefined && trafficEffect !== "") {
      fields["Traffic Effect"] = trafficEffect;
    }

    // Reclassify board placement after edit.
    // Uses Event Sort Date / startDateTime as the source.
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

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      if (eventDay.getTime() === today.getTime()) {
        fields["Active"] = true;
        fields["Needs Review"] = false;
        fields["Event Board Column"] = "Active Today";
      } else if (eventDay.getTime() > today.getTime()) {
        fields["Active"] = false;
        fields["Needs Review"] = false;
        fields["Event Board Column"] = "Upcoming Impact";
      } else {
        fields["Active"] = false;
        fields["Needs Review"] = false;
        fields["Event Board Column"] = "Past / Stale";
      }
    }

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
      }),
    });

    const airtableData = await airtableRes.json();

    if (!airtableRes.ok) {
      return res.status(airtableRes.status).json({
        ok: false,
        error:
          airtableData?.error?.message ||
          airtableData?.error?.type ||
          "Airtable update failed",
        airtable: airtableData,
      });
    }

    return res.status(200).json({
      ok: true,
      recordId,
      updatedFields: fields,
      airtable: airtableData,
    });
  } catch (err) {
    console.error("update-event failed:", err);

    return res.status(500).json({
      ok: false,
      error: err?.message || "Unknown server error",
    });
  }
}
