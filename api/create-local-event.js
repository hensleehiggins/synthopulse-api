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

    const records = await base("External Factors").create([
  {
    fields: {
      Type: "Event",
      Source: "Manual",
      "Source Type": "Manual",

      "Event Name": eventName,
      Description: eventName,
      "Start DateTime": startDateTime,
      "Start Time": startDateTime,
      "Venue / Area": venueArea || "",

      Restaurant: ["recn2LoRESKN33zHW"],

      Active: true,
      "Active (Event)": true,
      "Decision Driving Event": true,

      "Traffic Effect": "Very High",
      Confidence: "Very High",
      "Estimated Draw": "Very High",
      "Distance Weight": 2,
      "Event Weight": 10,

      "Needs Review": false,
      "Auto Imported": false,
      Notes: notes || "Submitted manually from KitchenPulse portal.",
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
