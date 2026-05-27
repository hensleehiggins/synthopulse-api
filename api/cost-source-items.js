const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID || "appD303evZM2SlvMR";

const AIRTABLE_TOKEN =
  process.env.AIRTABLE_TOKEN ||
  process.env.AIRTABLE_API_KEY ||
  process.env.AIRTABLE_PAT;

const COST_SOURCE_ITEMS_TABLE_ID = "tblLSKZODdEi5X2un";

const COST_SOURCE_FIELD = {
  sourceItemName: "Source Item Name",
  supplier: "Supplier",
  sku: "SKU",
  category: "Category",
  unit: "Unit",
  price: "Price",
  unitPrice: "Unit Price",
  finalPrice: "Final Price",
};

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  return res.status(statusCode).json(payload);
}

function requireAirtableConfig() {
  if (!AIRTABLE_BASE_ID) throw new Error("Missing AIRTABLE_BASE_ID.");
  if (!AIRTABLE_TOKEN) {
    throw new Error("Missing AIRTABLE_TOKEN / AIRTABLE_API_KEY / AIRTABLE_PAT.");
  }
}

function airtableTableUrl(tableId) {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableId)}`;
}

async function listAirtableRecords({ tableId, fields = [], pageSize = 100 }) {
  requireAirtableConfig();

  const allRecords = [];
  let offset = "";

  do {
    const params = new URLSearchParams();
    params.set("pageSize", String(Math.min(pageSize, 100)));
    if (offset) params.set("offset", offset);
    for (const fieldName of fields) params.append("fields[]", fieldName);

    const response = await fetch(`${airtableTableUrl(tableId)}?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error("Airtable returned a non-JSON response.");
    }

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
          data?.error ||
          `Airtable list failed with status ${response.status}.`
      );
    }

    allRecords.push(...(Array.isArray(data.records) ? data.records : []));
    offset = data.offset || "";
  } while (offset);

  return allRecords;
}

function asNumberOrNull(value) {
  if (value === "" || value === null || typeof value === "undefined") return null;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
}

function getCurrentCost(fields) {
  return (
    asNumberOrNull(fields[COST_SOURCE_FIELD.unitPrice]) ??
    asNumberOrNull(fields[COST_SOURCE_FIELD.finalPrice]) ??
    asNumberOrNull(fields[COST_SOURCE_FIELD.price])
  );
}

function normalizeCostSourceRecord(record) {
  const fields = record.fields || {};
  const currentCost = getCurrentCost(fields);

  return {
    id: record.id,
    createdTime: record.createdTime || "",
    itemName: fields[COST_SOURCE_FIELD.sourceItemName] || "Unnamed item",
    supplier: fields[COST_SOURCE_FIELD.supplier] || "Unknown vendor",
    sku: fields[COST_SOURCE_FIELD.sku] || "",
    category: fields[COST_SOURCE_FIELD.category] || "Other",
    unit: fields[COST_SOURCE_FIELD.unit] || "",
    currentCost,
    status: currentCost === null ? "Needs price" : "Baseline",
  };
}

function buildCounts(items) {
  const vendorSet = new Set(items.map((item) => item.supplier).filter(Boolean));
  const pricedItems = items.filter((item) => item.currentCost !== null);

  const highestCostItem = [...pricedItems].sort(
    (a, b) => (b.currentCost || 0) - (a.currentCost || 0)
  )[0];

  return {
    totalItems: items.length,
    pricedItems: pricedItems.length,
    vendors: vendorSet.size,
    needsPrice: items.filter((item) => item.currentCost === null).length,
    highestCostItem: highestCostItem || null,
  };
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, {
      ok: false,
      error: "Method not allowed.",
    });
  }

  try {
    const records = await listAirtableRecords({
      tableId: COST_SOURCE_ITEMS_TABLE_ID,
      fields: Object.values(COST_SOURCE_FIELD),
      pageSize: 100,
    });

    const items = records
      .map(normalizeCostSourceRecord)
      .sort((a, b) => {
        const vendorCompare = String(a.supplier).localeCompare(String(b.supplier));
        if (vendorCompare !== 0) return vendorCompare;
        return String(a.itemName).localeCompare(String(b.itemName));
      });

    return sendJson(res, 200, {
      ok: true,
      counts: buildCounts(items),
      items,
    });
  } catch (error) {
    console.error("cost-source-items route failed:", error);

    return sendJson(res, 500, {
      ok: false,
      error:
        error?.message ||
        "Tracked vendor cost items could not be loaded. Check server logs.",
    });
  }
}
