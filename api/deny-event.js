/********************************************************************
 * SynthoPulse / KitchenPulse API
 * Route: api/deny-event.js
 * Version: v1.1
 *
 * Purpose:
 * - Deny/remove an External Factors event from live demand context.
 * - Mark the record inactive and not decision-driving.
 * - Preserve the record for audit/review instead of deleting it.
 *
 * Method:
 * - POST /api/deny-event
 *
 * Body:
 * {
 *   "recordId": "rec...",
 *   "reason": "optional note"
 * }
 *
 * Reads:
 * - External Factors
 *
 * Writes:
 * - External Factors
 *
 * Does NOT:
 * - Delete records
 * - Touch POS Runs
 * - Touch Decision Layer output
 * - Touch Forecasts & Insights
 ********************************************************************/

import Airtable from "airtable";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getEnv(name, aliases = []) {
  const keys = [name, ...aliases];

  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }

  return "";
}

function getBase() {
  const token = getEnv("AIRTABLE_PAT", [
    "AIRTABLE_TOKEN",
    "AIRTABLE_API_KEY",
    "AIRTABLE_PERSONAL_ACCESS_TOKEN",
  ]);

  const baseId = getEnv("AIRTABLE_BASE_ID", ["KITCHENPULSE_BASE_ID"]);

  if (!token) throw new Error("Missing Airtable token environment variable.");
  if (!baseId) throw new Error("Missing Airtable base ID environment variable.");

  return new Airtable({ apiKey: token }).base(baseId);
}

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      route: "/api/deny-event",
      version: "v1.1",
      error: "Method not allowed",
    });
  }

  try {
    const { recordId, reason } = req.body || {};

    if (!recordId) {
      return res.status(400).json({
        ok: false,
        route: "/api/deny-event",
        version: "v1.1",
        error: "Missing recordId",
      });
    }

    const base = getBase();
    const existing = await base("External Factors").find(recordId);

    const existingNotes = text(existing.fields.Notes);
    const denialReason = text(reason) || "Denied from KitchenPulse event review.";
    const updatedNotes = existingNotes
      ? `${existingNotes}\n\nDenied: ${denialReason}`
      : `Denied: ${denialReason}`;

    const updated = await base("External Factors").update(
      recordId,
      {
        "Needs Review": false,
        Active: false,
        "Active (Event)": false,
        "Decision Driving Event": false,
        "Show on Service Pressure": false,
        "Show on Home Alert": false,
        Notes: updatedNotes,
      },
      { typecast: true }
    );

    return res.status(200).json({
      ok: true,
      route: "/api/deny-event",
      version: "v1.1",
      recordId: updated.id,
      eventName: updated.fields["Event Name"] || updated.fields.Description || "",
      message: "Event denied and removed from live demand context.",
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("deny-event failed:", err);

    return res.status(500).json({
      ok: false,
      route: "/api/deny-event",
      version: "v1.1",
      error: err.message || "Event denial failed.",
      generatedAt: new Date().toISOString(),
    });
  }
}
