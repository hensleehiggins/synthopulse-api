const Airtable = require("airtable");

const base = new Airtable({
  apiKey: process.env.AIRTABLE_PAT,
}).base(process.env.AIRTABLE_BASE_ID);

const MENU_ITEMS_TABLE = "Menu Items";
const MOVEMENT_TABLE = "Item Movement";

const REQUIRED_SECRET = process.env.ADMIN_REFRESH_SECRET || "";

function send(res, status, body) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-secret");
  return res.status(status).json(body);
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

function getLinkedRecordId(value) {
  if (!Array.isArray(value) || value.length === 0) return "";

  const first = value[0];

  if (typeof first === "string") return first;
  if (first && typeof first === "object" && first.id) return first.id;

  return "";
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

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    const result = await base(tableName).update(batch);
    results.push(...result);
  }

  return results;
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
    const providedSecret =
      req.headers["x-admin-secret"] ||
      req.query.secret ||
      "";

    if (providedSecret !== REQUIRED_SECRET) {
      return send(res, 401, {
        ok: false,
        error: "Unauthorized",
      });
    }
  }

  try {
    const [menuRecords, movementRecords] = await Promise.all([
      getAllRecords(MENU_ITEMS_TABLE, {
        fields: [
          "Item Name",
          "Actual Unit Cost",
          "Estimated Unit Cost",
          "Effective Unit Cost",
          "Decision Eligible",
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
        ],
      }),
    ]);

    const menuById = new Map();
    const menuByName = new Map();

    for (const record of menuRecords) {
      const fields = record.fields || {};
      const itemName = fields["Item Name"] || "";

      const actualCost = number(fields["Actual Unit Cost"]);
      const estimatedCost = number(fields["Estimated Unit Cost"]);
      const effectiveCost = number(fields["Effective Unit Cost"]);

      const unitCost =
        actualCost > 0
          ? actualCost
          : estimatedCost > 0
            ? estimatedCost
            : effectiveCost > 0
              ? effectiveCost
              : 0;

      const payload = {
        id: record.id,
        itemName,
        unitCost: money(unitCost),
        decisionEligible: fields["Decision Eligible"] === true,
      };

      menuById.set(record.id, payload);

      const key = normalizeName(itemName);
      if (key && !menuByName.has(key)) {
        menuByName.set(key, payload);
      }
    }

    const updates = [];
    const skipped = {
      noMenuMatch: 0,
      noUsableCost: 0,
      noCurrentNumbers: 0,
    };

    const samples = {
      updated: [],
      skippedNoCost: [],
      skippedNoMatch: [],
    };

    for (const record of movementRecords) {
      const fields = record.fields || {};
      const itemName = fields["Item"] || "";

      const linkedMenuId = getLinkedRecordId(fields["Menu Item"]);
      const menu =
        menuById.get(linkedMenuId) ||
        menuByName.get(normalizeName(itemName));

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

      const currentQty = number(fields["Current Qty"]);
      const previousQty = number(fields["Previous Qty"]);
      const currentRevenue = number(fields["Current Revenue"]);
      const previousRevenue = number(fields["Previous Revenue"]);

      if (currentRevenue <= 0 && currentQty <= 0 && previousRevenue <= 0 && previousQty <= 0) {
        skipped.noCurrentNumbers++;
        continue;
      }

      const currentProfit = money(currentRevenue - currentQty * unitCost);
      const previousProfit = money(previousRevenue - previousQty * unitCost);
      const profitChange = money(currentProfit - previousProfit);

      const currentMargin =
        currentRevenue > 0 ? percent(currentProfit / currentRevenue) : 0;

      const previousMargin =
        previousRevenue > 0 ? percent(previousProfit / previousRevenue) : 0;

      const marginChange = percent(currentMargin - previousMargin);

      updates.push({
        id: record.id,
        fields: {
          "Effective Unit Cost": unitCost,
          "Current Profit": currentProfit,
          "Previous Profit": previousProfit,
          "Profit Change": profitChange,
          "Current Margin Percent": currentMargin,
          "Previous Margin Percent": previousMargin,
          "Margin Change Percent": marginChange,
        },
      });

      if (samples.updated.length < 8) {
        samples.updated.push({
          item: itemName || menu.itemName,
          unitCost,
          currentRevenue,
          currentQty,
          currentProfit,
          currentMargin,
        });
      }
    }

    const updatedRecords = updates.length
      ? await updateInBatches(MOVEMENT_TABLE, updates)
      : [];

    return send(res, 200, {
      ok: true,
      scanned: {
        menuItems: menuRecords.length,
        itemMovement: movementRecords.length,
      },
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
