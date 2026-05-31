/********************************************************************
 * SynthoPulse / KitchenPulse API
 * Route: api/refresh-movement-costs.js
 * Version: v1.1
 *
 * Purpose:
 * - Recalculate Item Movement cost/profit/margin fields from Menu Items.
 * - Default to only latest movement rows so old historical rows are not
 *   rewritten casually.
 * - Support full backfill with ?includeAll=1 when intentionally needed.
 * - Support dry-run with ?dryRun=1.
 *
 * Method:
 * - GET  /api/refresh-movement-costs
 * - POST /api/refresh-movement-costs
 *
 * Query:
 * - ?dryRun=1      Preview changes without writing
 * - ?includeAll=1  Refresh all Item Movement records, not just latest
 * - ?secret=...    Optional admin secret if ADMIN_REFRESH_SECRET is set
 *
 * Headers:
 * - x-admin-secret: optional admin secret if ADMIN_REFRESH_SECRET is set
 *
 * Reads:
 * - Menu Items
 * - Item Movement
 *
 * Writes:
 * - Item Movement, unless dryRun=1
 *
 * Does NOT:
 * - Touch POS Runs
 * - Touch Daily Sales
 * - Touch Top Sellers
 * - Touch Low Sellers
 * - Touch Forecasts & Insights
 ********************************************************************/

const Airtable = require("airtable");

const MENU_ITEMS_TABLE = "Menu Items";
const MOVEMENT_TABLE = "Item Movement";

const REQUIRED_SECRET = process.env.ADMIN_REFRESH_SECRET || "";

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

const base = getBase();

function send(res, status, body) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-secret");

  return res.status(status).json({
    route: "/api/refresh-movement-costs",
    version: "v1.1",
    ...body,
    generatedAt: new Date().toISOString(),
  });
}

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  const n = number(value);
  return Math.round(n * 100) / 100;
}

function percent(value) {
  const n = number(value);
  return Math.round(n * 10000) / 10000;
}

function bool(value) {
  return value === true;
}

function getLinkedRecordId(value) {
  if (!Array.isArray(value) || value.length === 0) return "";

  const first = value[0];

  if (typeof first === "string") return first;
  if (first && typeof first === "object" && first.id) return first.id;

  return "";
}

function linkedIds(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") return item.id || "";
      return "";
    })
    .filter(Boolean);
}

function batchArray(items, size = 10) {
  const batches = [];

  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }

  return batches;
}

async function getAllRecords(tableName, options = {}) {
  const records = [];

  await base(tableName)
    .select(options)
    .eachPage((page, fetchNextPage) => {
      records.push(...page);
      fetchNextPage();
    });

  return records;
}

async function updateInBatches(tableName, updates, batchSize = 10) {
  const results = [];

  for (const batch of batchArray(updates, batchSize)) {
    const result = await base(tableName).update(batch);
    results.push(...result);
  }

  return results;
}

function buildMenuMaps(menuRecords) {
  const menuById = new Map();
  const menuByName = new Map();

  for (const record of menuRecords) {
    const fields = record.fields || {};
    const itemName = text(fields["Item Name"]);

    const actualCost = number(fields["Actual Unit Cost"]);
    const estimatedCost = number(fields["Estimated Unit Cost"]);
    const effectiveCost = number(fields["Effective Unit Cost"]);

    const unitCost =
      effectiveCost > 0
        ? effectiveCost
        : actualCost > 0
          ? actualCost
          : estimatedCost > 0
            ? estimatedCost
            : 0;

    const payload = {
      id: record.id,
      itemName,
      unitCost: money(unitCost),
      decisionEligible: bool(fields["Decision Eligible"]),
      costQuality: text(fields["Cost Quality"]),
      restaurantIds: linkedIds(fields.Restaurant),
    };

    menuById.set(record.id, payload);

    const key = normalizeName(itemName);
    if (key && !menuByName.has(key)) {
      menuByName.set(key, payload);
    }
  }

  return { menuById, menuByName };
}

function resolveMenuForMovement(fields, menuMaps) {
  const itemName = text(fields.Item);
  const linkedMenuId = getLinkedRecordId(fields["Menu Item"]);

  return (
    menuMaps.menuById.get(linkedMenuId) ||
    menuMaps.menuByName.get(normalizeName(itemName)) ||
    null
  );
}

function calculateMovementCostFields(fields, menu) {
  const unitCost = number(menu.unitCost);

  const currentQty = number(fields["Current Qty"]);
  const previousQty = number(fields["Previous Qty"]);
  const currentRevenue = number(fields["Current Revenue"]);
  const previousRevenue = number(fields["Previous Revenue"]);

  const currentProfit = money(currentRevenue - currentQty * unitCost);
  const previousProfit = money(previousRevenue - previousQty * unitCost);
  const profitChange = money(currentProfit - previousProfit);

  const currentMargin =
    currentRevenue > 0 ? percent(currentProfit / currentRevenue) : 0;

  const previousMargin =
    previousRevenue > 0 ? percent(previousProfit / previousRevenue) : 0;

  const marginChange = percent(currentMargin - previousMargin);

  return {
    "Effective Unit Cost": unitCost,
    "Current Profit": currentProfit,
    "Previous Profit": previousProfit,
    "Profit Change": profitChange,
    "Current Margin Percent": currentMargin,
    "Previous Margin Percent": previousMargin,
    "Margin Change Percent": marginChange,
  };
}

function hasMeaningfulNumbers(fields) {
  const currentQty = number(fields["Current Qty"]);
  const previousQty = number(fields["Previous Qty"]);
  const currentRevenue = number(fields["Current Revenue"]);
  const previousRevenue = number(fields["Previous Revenue"]);

  return currentRevenue > 0 || currentQty > 0 || previousRevenue > 0 || previousQty > 0;
}

function hasMeaningfulDifference(currentFields, newFields) {
  const keys = Object.keys(newFields);

  return keys.some((key) => {
    const current = number(currentFields[key]);
    const next = number(newFields[key]);

    return Math.abs(current - next) >= 0.0001;
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return send(res, 200, { ok: true });
  }

  if (!["GET", "POST"].includes(req.method)) {
    return send(res, 405, {
      ok: false,
      error: "Method not allowed",
    });
  }

  if (REQUIRED_SECRET) {
    const providedSecret = req.headers["x-admin-secret"] || req.query.secret || "";

    if (providedSecret !== REQUIRED_SECRET) {
      return send(res, 401, {
        ok: false,
        error: "Unauthorized",
      });
    }
  }

  try {
    const dryRun = req.query.dryRun === "1" || req.query.dryRun === "true";
    const includeAll = req.query.includeAll === "1" || req.query.includeAll === "true";

    const [menuRecords, movementRecordsRaw] = await Promise.all([
      getAllRecords(MENU_ITEMS_TABLE, {
        fields: [
          "Item Name",
          "Actual Unit Cost",
          "Estimated Unit Cost",
          "Effective Unit Cost",
          "Cost Quality",
          "Decision Eligible",
          "Restaurant",
        ],
      }),
      getAllRecords(MOVEMENT_TABLE, {
        fields: [
          "Item",
          "Menu Item",
          "Current Qty",
          "Previous Qty",
          "Current Revenue",
          "Previous Revenue",
          "Effective Unit Cost",
          "Current Profit",
          "Previous Profit",
          "Profit Change",
          "Current Margin Percent",
          "Previous Margin Percent",
          "Margin Change Percent",
          "Is Latest Movement",
          "Decision Eligible",
          "Current Run ID",
          "Previous Run ID",
        ],
      }),
    ]);

    const movementRecords = includeAll
      ? movementRecordsRaw
      : movementRecordsRaw.filter((record) => bool(record.fields?.["Is Latest Movement"]));

    const menuMaps = buildMenuMaps(menuRecords);

    const updates = [];

    const skipped = {
      notLatestBecauseDefaultScope: includeAll ? 0 : movementRecordsRaw.length - movementRecords.length,
      noMenuMatch: 0,
      noUsableCost: 0,
      noCurrentNumbers: 0,
      noChangeNeeded: 0,
    };

    const samples = {
      updated: [],
      skippedNoCost: [],
      skippedNoMatch: [],
      skippedNoNumbers: [],
      noChangeNeeded: [],
    };

    for (const record of movementRecords) {
      const fields = record.fields || {};
      const itemName = text(fields.Item);

      const menu = resolveMenuForMovement(fields, menuMaps);

      if (!menu) {
        skipped.noMenuMatch++;
        if (samples.skippedNoMatch.length < 8) {
          samples.skippedNoMatch.push(itemName || record.id);
        }
        continue;
      }

      const unitCost = number(menu.unitCost);

      if (unitCost <= 0) {
        skipped.noUsableCost++;
        if (samples.skippedNoCost.length < 8) {
          samples.skippedNoCost.push(itemName || menu.itemName || record.id);
        }
        continue;
      }

      if (!hasMeaningfulNumbers(fields)) {
        skipped.noCurrentNumbers++;
        if (samples.skippedNoNumbers.length < 8) {
          samples.skippedNoNumbers.push(itemName || record.id);
        }
        continue;
      }

      const calculatedFields = calculateMovementCostFields(fields, menu);

      if (!hasMeaningfulDifference(fields, calculatedFields)) {
        skipped.noChangeNeeded++;
        if (samples.noChangeNeeded.length < 8) {
          samples.noChangeNeeded.push(itemName || record.id);
        }
        continue;
      }

      updates.push({
        id: record.id,
        fields: calculatedFields,
      });

      if (samples.updated.length < 8) {
        samples.updated.push({
          item: itemName || menu.itemName,
          movementRecordId: record.id,
          unitCost,
          currentRevenue: number(fields["Current Revenue"]),
          currentQty: number(fields["Current Qty"]),
          currentProfit: calculatedFields["Current Profit"],
          currentMargin: calculatedFields["Current Margin Percent"],
          isLatestMovement: bool(fields["Is Latest Movement"]),
        });
      }
    }

    const updatedRecords = dryRun || updates.length === 0
      ? []
      : await updateInBatches(MOVEMENT_TABLE, updates);

    return send(res, 200, {
      ok: true,
      mode: dryRun ? "dry_run" : "write",
      scope: includeAll ? "all_movement_records" : "latest_movement_only",
      scanned: {
        menuItems: menuRecords.length,
        itemMovementTotal: movementRecordsRaw.length,
        itemMovementInScope: movementRecords.length,
      },
      wouldUpdate: updates.length,
      updated: updatedRecords.length,
      skipped,
      samples,
    });
  } catch (error) {
    console.error("refresh-movement-costs error", error);

    return send(res, 500, {
      ok: false,
      error: error.message || "Failed to refresh movement costs",
    });
  }
};
