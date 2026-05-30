const Airtable = require("airtable");

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

function fieldText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";

  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (!v) return "";
        if (typeof v === "string") return v;
        if (typeof v === "number") return String(v);
        if (v?.name) return v.name;
        if (v?.label) return v.label;
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    if (value.name) return value.name;
    if (value.label) return value.label;
  }

  return String(value);
}

function fieldBool(value) {
  if (typeof value === "boolean") return value;
  const clean = fieldText(value).toLowerCase();
  return clean === "true" || clean === "yes" || clean === "checked" || clean === "1";
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fieldText(value);

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  }).format(date);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
      return res.status(500).json({
        ok: false,
        error: "Missing Airtable environment variables.",
      });
    }

    const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID);

    const records = await base("Staff Reliability Signals")
      .select({
        maxRecords: 25,
        sort: [{ field: "Generated At", direction: "desc" }],
      })
      .firstPage();

    const signals = records.map((record) => {
      const f = record.fields || {};

      return {
        id: record.id,
        signalName: fieldText(f["Signal Name"]),
        employeeName: fieldText(f["Employee Name"]),
        externalEmployeeId: fieldText(f["External Employee ID"]),
        signalType: fieldText(f["Signal Type"]),
        signalDate: f["Signal Date"] || "",
        signalDateLabel: formatDate(f["Signal Date"]),
        severity: fieldText(f["Severity"]) || "Watch",
        summary: fieldText(f["Summary"]),
        watchWindowDays: f["Watch Window Days"] || null,
        countsTowardWatch: fieldBool(f["Counts Toward Watch"]),
        activeWatch: fieldBool(f["Active Watch"]),
        source: fieldText(f["Source"]),
        notes: fieldText(f["Notes"]),
        generatedAt: f["Generated At"] || "",
        isDemo:
          fieldText(f["Source"]).toLowerCase() === "demo" ||
          fieldText(f["Staff Shift Record ID"]).toLowerCase().includes("demo") ||
          fieldText(f["External Employee ID"]).toLowerCase().includes("demo"),
      };
    });

    const activeSignals = signals.filter((signal) => signal.activeWatch);
    const realActiveSignals = activeSignals.filter((signal) => !signal.isDemo);
    const demoSignals = signals.filter((signal) => signal.isDemo);

    return res.status(200).json({
      ok: true,
      count: signals.length,
      activeCount: activeSignals.length,
      realActiveCount: realActiveSignals.length,
      demoCount: demoSignals.length,
      signals,
      activeSignals,
      realActiveSignals,
      demoSignals,
    });
  } catch (err) {
    console.error("staff-reliability-signals failed", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load staff reliability signals.",
    });
  }
}
