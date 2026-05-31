/********************************************************************
 * KitchenPulse API - Latest Brief v1.1
 *
 * Purpose:
 * - Return the latest owner-facing Forecasts & Insights brief for Softr/Home.
 * - Treat Forecasts & Insights as the source of truth after the Airtable
 *   Decision Layer has already applied the completed decision-run gate.
 * - Fail closed if no latest brief exists.
 *
 * Request:
 * - GET /api/latest-brief
 *
 * Reads:
 * - Forecasts & Insights
 *
 * Does NOT:
 * - Read raw Runs directly
 * - Promote or modify records
 * - Generate new decisions
 * - Infer from partial/imported POS runs
 *
 * Important gate behavior:
 * - This endpoint only returns records where Is Latest Brief = true.
 * - The upstream Decision Layer v3.8 is responsible for only marking briefs
 *   latest when the source Run is completed and decision-ready.
 ********************************************************************/

const Airtable = require("airtable");

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN =
  process.env.AIRTABLE_PAT ||
  process.env.AIRTABLE_API_KEY ||
  process.env.AIRTABLE_TOKEN;

const BRIEFS_TABLE = "Forecasts & Insights";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJson(res, status, payload) {
  setCors(res);
  return res.status(status).json(payload);
}

function cleanText(value) {
  return String(value || "").trim();
}

function cleanFormattedBrief(value) {
  return String(value || "")
    .split("\n")
    .filter((line) => {
      const text = String(line || "").trim().toLowerCase();
      return text !== "operator hook" && text !== "• operator hook" && text !== "- operator hook";
    })
    .join("\n")
    .trim();
}

function getLinkedNames(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => item?.name || "").filter(Boolean);
}

function buildBriefPayload(record) {
  const fields = record.fields || {};

  return {
    ok: true,
    recordId: record.id,
    name: cleanText(fields["Name"]),
    runId: cleanText(fields["Run ID"]),
    restaurant: getLinkedNames(fields["Restaurant"]),
    briefDate: fields["Brief Date"] || "",
    decisionTimestamp: fields["Decision Timestamp"] || "",
    decisionSource: cleanText(fields["Decision Source"]),

    headline: cleanText(fields["Hero Headline"]),
    subheadline: cleanText(fields["Hero Subheadline"]),
    cardLabel: cleanText(fields["Hero Card Label"]),
    cardValue: cleanText(fields["Hero Card Value"]),
    priority: cleanText(fields["Hero Card Priority"]),
    timeContext: cleanText(fields["Hero Time Context"]),
    heroState: cleanText(fields["Hero State"]),
    heroConfidence: cleanText(fields["Hero Confidence"]),

    summary: cleanText(fields["Summary"]),
    topCallout: cleanText(fields["Top Callout"]),
    riskCallout: cleanText(fields["Risk Callout"]),
    formattedBrief: cleanFormattedBrief(fields["Formatted Brief (Display)"]),
    decisionDisplay: cleanText(fields["Decision Display"]),
    actionCallout: cleanText(fields["Action Callout"]),

    quickWhy: cleanText(fields["Quick - Why"]),
    quickFirstAction: cleanText(fields["Quick - First Action"]),
    quickIgnoreRisk: cleanText(fields["Quick - Ignore Risk"]),
    quickWatch: cleanText(fields["Quick - Watch"]),
    whyFull: cleanText(fields["Why Full"]),
  };
}

async function fetchLatestBrief() {
  if (!AIRTABLE_TOKEN) {
    throw new Error(
      "Missing Airtable token. Set AIRTABLE_PAT, AIRTABLE_API_KEY, or AIRTABLE_TOKEN in Vercel."
    );
  }

  if (!AIRTABLE_BASE_ID) {
    throw new Error("Missing AIRTABLE_BASE_ID in Vercel.");
  }

  const base = new Airtable({ apiKey: AIRTABLE_TOKEN }).base(AIRTABLE_BASE_ID);

  const records = await base(BRIEFS_TABLE)
    .select({
      filterByFormula: `{Is Latest Brief} = TRUE()`,
      maxRecords: 1,
      sort: [
        { field: "Decision Timestamp", direction: "desc" },
        { field: "Brief Date", direction: "desc" },
      ],
      fields: [
        "Name",
        "Run ID",
        "Restaurant",
        "Brief Date",
        "Summary",
        "Top Callout",
        "Risk Callout",
        "Formatted Brief (Display)",
        "Decision Display",
        "Action Callout",
        "Decision Timestamp",
        "Decision Source",
        "Quick - Why",
        "Quick - First Action",
        "Quick - Ignore Risk",
        "Quick - Watch",
        "Why Full",
        "Hero State",
        "Hero Confidence",
        "Hero Time Context",
        "Hero Headline",
        "Hero Subheadline",
        "Hero Pill 1",
        "Hero Pill 2",
        "Hero Pill 3",
        "Hero Card Label",
        "Hero Card Value",
        "Hero Card Priority",
      ],
    })
    .firstPage();

  return records[0] || null;
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, {
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const latestBrief = await fetchLatestBrief();

    if (!latestBrief) {
      return sendJson(res, 200, {
        ok: false,
        message: "No latest Forecasts & Insights brief found.",
      });
    }

    return sendJson(res, 200, buildBriefPayload(latestBrief));
  } catch (error) {
    console.error("latest-brief error:", error);

    return sendJson(res, 500, {
      ok: false,
      error: error.message || "Failed to load latest brief.",
    });
  }
}
