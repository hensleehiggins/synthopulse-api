const Airtable = require("airtable");

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(
      process.env.AIRTABLE_BASE_ID
    );

    const records = await base("External Factors")
  .select({
    filterByFormula: `
      AND(
        {Type} = "Event",
        OR(
          IS_SAME({Start DateTime}, TODAY(), 'day'),
          IS_AFTER({Start DateTime}, TODAY()),
          IS_SAME({Event Sort Date}, TODAY(), 'day'),
          IS_AFTER({Event Sort Date}, TODAY())
        )
      )
    `,
    maxRecords: 40,
    sort: [{ field: "Start DateTime", direction: "asc" }],
  })
  .firstPage();

    const events = records.map((rec) => {
      const f = rec.fields || {};

      return {
        id: rec.id,
        name: f["Event Name"] || f["Description"] || "Untitled event",
        start: f["Start DateTime"] || f["Start Time"] || "",
        end: f["End DateTime"] || f["End Time"] || "",
        venue: f["Venue / Area"] || "",
        trafficEffect: f["Traffic Effect"] || "",
        confidence: f["Confidence"] || "",
        estimatedDraw: f["Estimated Draw"] || "",
        eventWeight: f["Event Weight"] || 0,
        decisionDriving: !!f["Decision Driving Event"],
        
      };
    });

    return res.status(200).json({ ok: true, events });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
