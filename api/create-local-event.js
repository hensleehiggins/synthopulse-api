const Airtable = require("airtable");

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const {
      eventName,
      startDateTime,
      endDateTime,
      venueArea,
      city,
      notes,
    } = req.body || {};

    if (!eventName || !startDateTime) {
      return res.status(400).json({
        ok: false,
        error: "Event name and start date/time are required.",
      });
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(
      process.env.AIRTABLE_BASE_ID
    );

    const records = await base("Event Intake Queue").create([
      {
        fields: {
          "Event Name": eventName,
          "Start DateTime": startDateTime,
          ...(endDateTime ? { "End DateTime": endDateTime } : {}),
          ...(venueArea ? { "Venue / Area": venueArea } : {}),
          ...(city ? { City: city } : {}),
          Source: "Manual",
          "Needs Review": true,
          Status: "Needs Review",
          Notes: notes || "Submitted from KitchenPulse portal.",
        },
      },
    ]);

    return res.status(200).json({
      ok: true,
      id: records[0].id,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}
