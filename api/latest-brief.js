import Airtable from "airtable";

export default async function handler(req, res) {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT })
    .base(process.env.AIRTABLE_BASE_ID);

  try {
    const records = await base("Forecasts & Insights")
      .select({
        filterByFormula: `{Is Latest Brief} = TRUE()`,
        maxRecords: 1,
      })
      .firstPage();

    if (!records.length) {
      return res.status(200).json({ ok: false });
    }

    const r = records[0].fields;

    res.status(200).json({
      ok: true,
      headline: r["Hero Headline"] || "",
      cardValue: r["Hero Card Value"] || "",
      priority: r["Hero Card Priority"] || "",
      timeContext: r["Hero Time Context"] || "",
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
