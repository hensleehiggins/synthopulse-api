const AIRTABLE_TOKEN = process.env.AIRTABLE_PAT;

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_TOKEN) {
  console.error("Missing AIRTABLE_PAT env var.");
}

if (!AIRTABLE_BASE_ID) {
  console.error("Missing AIRTABLE_BASE_ID env var.");
}

const COST_SOURCE_TABLE = "Cost Source Items";

const COST_FIELDS = [
  "Source Item Name",
  "Supplier",
  "SKU",
  "Category",
  "Unit",
  "Price",
  "Unit Price",
  "Final Price",
  "Vendor Receipt Lines",
  "Receipt Cost Proposals",
];

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function airtableUrl(tableName, params = {}) {
  const url = new URL(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
      tableName
    )}`
  );

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;

    if (key === "fields" && Array.isArray(value)) {
      value.forEach((fieldName) => {
        url.searchParams.append("fields[]", fieldName);
      });
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => url.searchParams.append(key, entry));
      return;
    }

    url.searchParams.set(key, value);
  });

  return url.toString();
}

async function fetchAirtablePage(tableName, params = {}) {
  if (!AIRTABLE_TOKEN) {
  throw new Error("Missing AIRTABLE_PAT environment variable.");
}

if (!AIRTABLE_BASE_ID) {
  throw new Error("Missing AIRTABLE_BASE_ID environment variable.");
}

  const response = await fetch(airtableUrl(tableName, params), {
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        payload?.error ||
        `Airtable request failed for ${tableName}.`
    );
  }

  return payload;
}

async function fetchAllRecords(tableName, params = {}) {
  const records = [];
  let offset = null;

  do {
    const payload = await fetchAirtablePage(tableName, {
      pageSize: 100,
      ...params,
      ...(offset ? { offset } : {}),
    });

    records.push(...(payload.records || []));
    offset = payload.offset || null;
  } while (offset);

  return records;
}

function text(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item) return "";
        if (typeof item === "string") return item;
        if (typeof item === "object" && item.name) return item.name;
        return String(item);
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object" && value.name) return value.name;

  return String(value);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function pickCurrentCost(fields) {
  return (
    numberOrNull(fields["Unit Price"]) ??
    numberOrNull(fields["Final Price"]) ??
    numberOrNull(fields.Price) ??
    null
  );
}

function getLinkedIds(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry) return "";
      if (typeof entry === "string") return entry;
      if (typeof entry === "object" && entry.id) return entry.id;
      return "";
    })
    .filter(Boolean);
}

function parseIsoDateFromText(value) {
  const raw = text(value);
  if (!raw) return null;

  const match = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return match ? match[1] : null;
}

function toIsoDate(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const direct = parseIsoDateFromText(value);
    if (direct) return direct;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

function newestIsoDate(values) {
  const dates = values.filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

function newestReceiptDateFromLinkedLines(linkedLines) {
  const possibleDates = [];

  linkedLines.forEach((line) => {
    const fields = line.fields || {};

    [
      "Receipt Date",
      "Invoice Date",
      "Line Date",
      "Parsed Receipt Date",
      "Vendor Receipt Date",
      "Created",
      "Created Time",
    ].forEach((fieldName) => {
      const iso = toIsoDate(fields[fieldName]);
      if (iso) possibleDates.push(iso);
    });

    Object.values(fields).forEach((value) => {
      const iso = parseIsoDateFromText(value);
      if (iso) possibleDates.push(iso);
    });
  });

  return newestIsoDate(possibleDates);
}

function daysAgo(isoDate) {
  if (!isoDate) return null;

  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  const diffMs = todayUtc - date.getTime();
  return Math.floor(diffMs / 86400000);
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    const aDate = a.lastSeenDate || "";
    const bDate = b.lastSeenDate || "";

    if (aDate !== bDate) return bDate.localeCompare(aDate);

    const aCost = Number(a.currentCost || 0);
    const bCost = Number(b.currentCost || 0);

    if (aCost !== bCost) return bCost - aCost;

    return String(a.itemName || "").localeCompare(String(b.itemName || ""));
  });
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed.",
      });
    }

    const costRecords = await fetchAllRecords(COST_SOURCE_TABLE, {
      fields: COST_FIELDS,
    });

    const items = costRecords.map((record) => {
      const fields = record.fields || {};
      const linkedReceiptLineIds = getLinkedIds(fields["Vendor Receipt Lines"]);
      const currentCost = pickCurrentCost(fields);

      return {
        id: record.id,
        itemName: text(fields["Source Item Name"]) || "Unnamed cost item",
        supplier: text(fields.Supplier) || "Unknown vendor",
        sku: text(fields.SKU),
        category: text(fields.Category) || "Other",
        unit: text(fields.Unit),
        currentCost,
        linkedReceiptLineIds,
        sourceLineCount: linkedReceiptLineIds.length,
        lastSeenDate: null,
        lastSeenDaysAgo: null,
      };
    });

    const allLinkedLineIds = [
      ...new Set(items.flatMap((item) => item.linkedReceiptLineIds)),
    ];

    let receiptLinesById = new Map();

    if (allLinkedLineIds.length > 0) {
      try {
        const receiptLineRecords = [];

        for (let index = 0; index < allLinkedLineIds.length; index += 20) {
          const chunk = allLinkedLineIds.slice(index, index + 20);
          const formula = `OR(${chunk
            .map((id) => `RECORD_ID()='${id}'`)
            .join(",")})`;

          const chunkRecords = await fetchAllRecords("Vendor Receipt Lines", {
            filterByFormula: formula,
          });

          receiptLineRecords.push(...chunkRecords);
        }

        receiptLinesById = new Map(
          receiptLineRecords.map((record) => [record.id, record])
        );
      } catch (lineError) {
        receiptLinesById = new Map();
      }
    }

    const hydratedItems = items.map((item) => {
      const linkedLines = item.linkedReceiptLineIds
        .map((id) => receiptLinesById.get(id))
        .filter(Boolean);

      const lastSeenDate = newestReceiptDateFromLinkedLines(linkedLines);

      return {
        ...item,
        lastSeenDate,
        lastSeenDaysAgo: daysAgo(lastSeenDate),
      };
    });

    const sortedItems = sortItems(hydratedItems);

    const pricedItems = sortedItems.filter(
      (item) => item.currentCost !== null && item.currentCost !== undefined
    );

    const vendors = new Set(
      sortedItems.map((item) => item.supplier).filter(Boolean)
    );

    const highestCostItem = pricedItems.reduce((winner, item) => {
      if (!winner) return item;
      return Number(item.currentCost || 0) > Number(winner.currentCost || 0)
        ? item
        : winner;
    }, null);

    const freshlySeenItems = sortedItems.filter(
      (item) =>
        item.lastSeenDaysAgo !== null &&
        item.lastSeenDaysAgo >= 0 &&
        item.lastSeenDaysAgo <= 14
    ).length;

    return res.status(200).json({
      ok: true,
      counts: {
        totalItems: sortedItems.length,
        pricedItems: pricedItems.length,
        vendors: vendors.size,
        needsPrice: sortedItems.length - pricedItems.length,
        freshlySeenItems,
        highestCostItem: highestCostItem
          ? {
              id: highestCostItem.id,
              itemName: highestCostItem.itemName,
              supplier: highestCostItem.supplier,
              currentCost: highestCostItem.currentCost,
            }
          : null,
      },
      items: sortedItems,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Vendor cost ledger could not be loaded.",
    });
  }
}
