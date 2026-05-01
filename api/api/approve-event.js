import Airtable from "airtable";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { recordId } = req.body || {};

    if (!recordId) {
      return res.status(400).json({ ok: false, error: "Missing recordId" });
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT })
      .base(process.env.AIRTABLE_BASE_ID);

    await base("External Factors").update(recordId, {
      "Needs Review": false,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}
