const AIRTABLE_TOKEN = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_TOKEN) {
  console.error("Missing AIRTABLE_PAT env var.");
}

if (!AIRTABLE_BASE_ID) {
  console.error("Missing AIRTABLE_BASE_ID env var.");
}

const COST_MOVEMENT_TABLE = "Cost Movement";

const COST_MOVEMENT_FIELD_IDS = {
  costSourceItems: "fldQm9oR7NCaDCjX2",
  previousCost: "fldI5qZmL4FCtGFRv",
  movementName: "fldJEbKfznts1bZli",
  movementDate: "fldKpWYzCjZzIvIOw",
  signalDate: "fldLC9rQlJ4VBHZbA",
  itemName: "fldR6ue6PnpWGErfR",
  status: "fldNi2qMbGFz042a9",
  latestCost: "fldYjqopqSgT82D70",
  changePercent: "fldhLiA9HmOnKYkW2",
  vendor: "fldp2mDXFUqAXkCyM",
  direction: "fldpVAh3ihF7TirUV",
  active: "fldwgCG4QqJsoc3l6",
  changeAmount: "fldzrAqTOZieB1Gmk",
};

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

const RECEIPT_LINE_DATE_FIELDS = [
  "Receipt Date",
  "Invoice Date",
  "Line Date",
  "Parsed Receipt Date",
  "Vendor Receipt Date",
  "Created",
  "Created Time",
];

const RECEIPT_LINE_UNIT_COST_FIELDS = [
  "Unit Cost",
  "Unit Price",
  "Final Unit Cost",
  "Final Unit Price",
  "Receipt Unit Cost",
  "Proposed Cost",
  "Price",
];

const RECEIPT_LINE_TOTAL_FIELDS = [
  "Line Total",
  "Extended Price",
  "Extended Amount",
  "Final Line Total",
  "Total",
];

const RECEIPT_LINE_QUANTITY_FIELDS = [
  "Quantity",
  "Qty",
  "Shipped Quantity",
  "Quantity Shipped",
  "Pack Qty",
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

function normalizeSupplierName(value) {
  const raw = text(value).trim();
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (
    compact.includes("SYSCO") ||
    compact.includes("SYCSO") ||
    compact.includes("SYSCOATLANTA") ||
    compact.includes("SYCSOATLANTA")
  ) {
    return "Sysco Atlanta LLC";
  }

  return raw;
}

function selectName(value) {
  if (!value) return "";
  if (typeof value === "object" && value.name) return String(value.name);
  return text(value);
}

function movementDirectionFromValue(value, changeAmount) {
  const raw = selectName(value).toLowerCase();

  if (raw.includes("increase") || raw.includes("up")) return "up";
  if (raw.includes("decrease") || raw.includes("down")) return "down";

  const amount = numberOrNull(changeAmount);

  if (amount === null) return "baseline";
  if (Math.abs(amount) < 0.01) return "flat";

  return amount > 0 ? "up" : "down";
}

function buildCostMovementByCostSourceItem(records, itemsById = new Map()) {
  const movementByCostSourceItem = new Map();

  records.forEach((record) => {
    const fields = record.fields || {};
    const costSourceItemIds = getLinkedIds(
      fields[COST_MOVEMENT_FIELD_IDS.costSourceItems]
    );

    if (!costSourceItemIds.length) return;

    const status = selectName(fields[COST_MOVEMENT_FIELD_IDS.status]).toLowerCase();
    const active = fields[COST_MOVEMENT_FIELD_IDS.active] === true;

    if (status && status !== "active" && !active) return;

    const movementDate =
      toIsoDate(fields[COST_MOVEMENT_FIELD_IDS.signalDate]) ||
      toIsoDate(fields[COST_MOVEMENT_FIELD_IDS.movementDate]) ||
      toIsoDate(record.createdTime);

    const previousCost = roundMoney(fields[COST_MOVEMENT_FIELD_IDS.previousCost]);
    const latestCost = roundMoney(fields[COST_MOVEMENT_FIELD_IDS.latestCost]);
    const changeAmount = roundMoney(fields[COST_MOVEMENT_FIELD_IDS.changeAmount]);
    const changePercent = numberOrNull(fields[COST_MOVEMENT_FIELD_IDS.changePercent]);
    const movementDirection = movementDirectionFromValue(
      fields[COST_MOVEMENT_FIELD_IDS.direction],
      changeAmount
    );

    const movement = {
      source: "Cost Movement",
      recordId: record.id,
      createdTime: record.createdTime || "",
      movementDate,
      previousCost,
      latestReceiptCost: latestCost,
      changeAmount,
      changePercent,
      movementDirection,
      movementLabel:
        movementDirection === "up"
          ? "Up"
          : movementDirection === "down"
            ? "Down"
            : movementDirection === "flat"
              ? "Flat"
              : "No prior",
      itemName: text(fields[COST_MOVEMENT_FIELD_IDS.itemName]),
      supplier: normalizeSupplierName(fields[COST_MOVEMENT_FIELD_IDS.vendor]),
      summary: text(fields[COST_MOVEMENT_FIELD_IDS.movementName]),
      priceHistory: [],
    };

    costSourceItemIds.forEach((costSourceItemId) => {
      const existing = movementByCostSourceItem.get(costSourceItemId);
      const item = itemsById.get(costSourceItemId);
      const currentCost = item?.currentCost ?? null;

      const movementMatchesCurrent =
        currentCost !== null &&
        latestCost !== null &&
        Math.abs(Number(latestCost) - Number(currentCost)) <= 0.01;

      const existingMatchesCurrent =
        currentCost !== null &&
        existing?.latestReceiptCost !== null &&
        Math.abs(Number(existing.latestReceiptCost) - Number(currentCost)) <= 0.01;

      if (!existing) {
        movementByCostSourceItem.set(costSourceItemId, movement);
        return;
      }

      // Prefer the movement that matches the current Cost Source Item price.
      // This handles cases like Asparagus where an older inverse movement is still active.
      if (movementMatchesCurrent && !existingMatchesCurrent) {
        movementByCostSourceItem.set(costSourceItemId, movement);
        return;
      }

      if (!movementMatchesCurrent && existingMatchesCurrent) {
        return;
      }

      // If both match or neither matches, prefer newest movement date, then newest created time.
      const movementDateValue = String(movement.movementDate || "");
      const existingDateValue = String(existing.movementDate || "");

      if (movementDateValue > existingDateValue) {
        movementByCostSourceItem.set(costSourceItemId, movement);
        return;
      }

      if (movementDateValue < existingDateValue) {
        return;
      }

      if (String(movement.createdTime || "") > String(existing.createdTime || "")) {
        movementByCostSourceItem.set(costSourceItemId, movement);
      }
    });
  });

  return movementByCostSourceItem;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;

  if (Array.isArray(value)) {
    return numberOrNull(value[0]);
  }

  const cleaned =
    typeof value === "string"
      ? value.replace(/[$,%]/g, "").trim()
      : value;

  const numberValue = Number(cleaned);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function roundMoney(value) {
  const numberValue = numberOrNull(value);
  if (numberValue === null) return null;

  return Number(numberValue.toFixed(2));
}

function pickCurrentCost(fields) {
  return (
    roundMoney(fields["Unit Price"]) ??
    roundMoney(fields["Final Price"]) ??
    roundMoney(fields.Price) ??
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

function pickFirstNumber(fields, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = roundMoney(fields[fieldName]);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function getReceiptLineDate(record) {
  const fields = record.fields || {};
  const possibleDates = [];

  RECEIPT_LINE_DATE_FIELDS.forEach((fieldName) => {
    const iso = toIsoDate(fields[fieldName]);
    if (iso) possibleDates.push(iso);
  });

  Object.values(fields).forEach((value) => {
    const iso = parseIsoDateFromText(value);
    if (iso) possibleDates.push(iso);
  });

  const createdTimeDate = toIsoDate(record.createdTime);
  if (createdTimeDate) possibleDates.push(createdTimeDate);

  return newestIsoDate(possibleDates);
}

function getReceiptLineUnitCost(record) {
  const fields = record.fields || {};

  const directUnitCost = pickFirstNumber(fields, RECEIPT_LINE_UNIT_COST_FIELDS);

  if (directUnitCost !== null) {
    return directUnitCost;
  }

  const lineTotal = pickFirstNumber(fields, RECEIPT_LINE_TOTAL_FIELDS);
  const quantity = pickFirstNumber(fields, RECEIPT_LINE_QUANTITY_FIELDS);

  if (lineTotal !== null && quantity !== null && quantity > 0) {
    return roundMoney(lineTotal / quantity);
  }

  return null;
}

function newestReceiptDateFromLinkedLines(linkedLines) {
  const possibleDates = linkedLines
    .map((line) => getReceiptLineDate(line))
    .filter(Boolean);

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

function buildReceiptPriceHistory(linkedLines, currentCost) {
  const entries = linkedLines
    .map((line) => {
      const date = getReceiptLineDate(line);
      const cost = getReceiptLineUnitCost(line);
      const fields = line.fields || {};

      return {
        recordId: line.id,
        date,
        cost,
        lineName:
          text(fields["Line Name"]) ||
          text(fields["Line Item Name"]) ||
          text(fields["Item Name"]) ||
          "",
      };
    })
    .filter((entry) => entry.date && entry.cost !== null)
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return String(b.recordId).localeCompare(String(a.recordId));
    });

  if (!entries.length) {
    return {
      latestEntry: null,
      previousEntry: null,
      history: [],
    };
  }

  const entriesByDate = new Map();

  entries.forEach((entry) => {
    if (!entriesByDate.has(entry.date)) {
      entriesByDate.set(entry.date, []);
    }

    entriesByDate.get(entry.date).push(entry);
  });

  const sortedDates = [...entriesByDate.keys()].sort((a, b) =>
    b.localeCompare(a)
  );

  const latestDate = sortedDates[0];
  const latestDateEntries = entriesByDate.get(latestDate) || [];

  let latestEntry = latestDateEntries[0] || null;

  if (currentCost !== null) {
    const matchingCurrentCost = latestDateEntries.find(
      (entry) => Math.abs(Number(entry.cost) - Number(currentCost)) <= 0.01
    );

    if (matchingCurrentCost) {
      latestEntry = matchingCurrentCost;
    }
  }

  let previousEntry = null;

  for (const date of sortedDates.slice(1)) {
    const dateEntries = entriesByDate.get(date) || [];
    const firstCostEntry = dateEntries.find((entry) => entry.cost !== null);

    if (firstCostEntry) {
      previousEntry = firstCostEntry;
      break;
    }
  }

  return {
    latestEntry,
    previousEntry,
    history: entries.slice(0, 8),
  };
}

function buildMovement(item, linkedLines) {
  const currentCost = item.currentCost;
  const priceHistory = buildReceiptPriceHistory(linkedLines, currentCost);
  const latestReceiptCost = priceHistory.latestEntry?.cost ?? null;
  const previousCost = priceHistory.previousEntry?.cost ?? null;
  const movementCurrentCost = currentCost ?? latestReceiptCost;

  if (movementCurrentCost === null) {
    return {
      previousCost: null,
      latestReceiptCost,
      changeAmount: null,
      changePercent: null,
      movementDirection: "missing",
      movementLabel: "Needs price",
      priceHistory: priceHistory.history,
    };
  }

  if (previousCost === null) {
    return {
      previousCost: null,
      latestReceiptCost,
      changeAmount: null,
      changePercent: null,
      movementDirection: "baseline",
      movementLabel: "No prior",
      priceHistory: priceHistory.history,
    };
  }

  const changeAmount = roundMoney(movementCurrentCost - previousCost);
  const changePercent =
    previousCost === 0 || changeAmount === null
      ? null
      : Number((changeAmount / previousCost).toFixed(4));

  let movementDirection = "flat";

  if (changeAmount !== null && Math.abs(changeAmount) >= 0.01) {
    movementDirection = changeAmount > 0 ? "up" : "down";
  }

  return {
    previousCost,
    latestReceiptCost,
    changeAmount,
    changePercent,
    movementDirection,
    movementLabel:
      movementDirection === "up"
        ? "Up"
        : movementDirection === "down"
          ? "Down"
          : "Flat",
    priceHistory: priceHistory.history,
  };
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
      const linkedProposalIds = getLinkedIds(fields["Receipt Cost Proposals"]);
      const currentCost = pickCurrentCost(fields);

      return {
        id: record.id,
        itemName: text(fields["Source Item Name"]) || "Unnamed cost item",
        supplier: normalizeSupplierName(fields.Supplier) || "Unknown vendor",
        sku: text(fields.SKU),
        category: text(fields.Category) || "Other",
        unit: text(fields.Unit),
        currentCost,
        linkedReceiptLineIds,
        linkedProposalIds,
        sourceLineCount: linkedReceiptLineIds.length,
        proposalCount: linkedProposalIds.length,
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
        console.error("Cost source ledger could not hydrate receipt lines:", lineError);
        receiptLinesById = new Map();
      }
    }

    let costMovementByCostSourceItem = new Map();

try {
  const costMovementRecords = await fetchAllRecords(COST_MOVEMENT_TABLE);
  const itemsById = new Map(items.map((item) => [item.id, item]));

costMovementByCostSourceItem =
  buildCostMovementByCostSourceItem(costMovementRecords, itemsById);
} catch (movementError) {
  console.error("Cost source ledger could not hydrate Cost Movement:", movementError);
  costMovementByCostSourceItem = new Map();
}

    const hydratedItems = items.map((item) => {
      const linkedLines = item.linkedReceiptLineIds
        .map((id) => receiptLinesById.get(id))
        .filter(Boolean);

      const fallbackMovement = buildMovement(item, linkedLines);
const activeMovement = costMovementByCostSourceItem.get(item.id);
const movement = activeMovement || fallbackMovement;
      const lastSeenDate =
        newestReceiptDateFromLinkedLines(linkedLines) ||
        movement.priceHistory?.[0]?.date ||
        null;

      return {
        ...item,
        previousCost: movement.previousCost,
        latestReceiptCost: movement.latestReceiptCost,
        changeAmount: movement.changeAmount,
        changePercent: movement.changePercent,
        movementDirection: movement.movementDirection,
        movementLabel: movement.movementLabel,
        movement,
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

    const movementCounts = sortedItems.reduce(
      (acc, item) => {
        const direction = item.movementDirection || "baseline";

        if (direction === "up") acc.up += 1;
        else if (direction === "down") acc.down += 1;
        else if (direction === "flat") acc.flat += 1;
        else if (direction === "missing") acc.missing += 1;
        else acc.baseline += 1;

        return acc;
      },
      {
        up: 0,
        down: 0,
        flat: 0,
        baseline: 0,
        missing: 0,
      }
    );

    const highestCostItem = pricedItems.reduce((winner, item) => {
      if (!winner) return item;
      return Number(item.currentCost || 0) > Number(winner.currentCost || 0)
        ? item
        : winner;
    }, null);

    const freshestMovementItem = sortedItems.find((item) =>
      ["up", "down"].includes(item.movementDirection)
    );

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
        movementUp: movementCounts.up,
        movementDown: movementCounts.down,
        movementFlat: movementCounts.flat,
        movementBaseline: movementCounts.baseline,
        movementMissing: movementCounts.missing,
        highestCostItem: highestCostItem
          ? {
              id: highestCostItem.id,
              itemName: highestCostItem.itemName,
              supplier: highestCostItem.supplier,
              currentCost: highestCostItem.currentCost,
            }
          : null,
        freshestMovementItem: freshestMovementItem
          ? {
              id: freshestMovementItem.id,
              itemName: freshestMovementItem.itemName,
              supplier: freshestMovementItem.supplier,
              currentCost: freshestMovementItem.currentCost,
              previousCost: freshestMovementItem.previousCost,
              changeAmount: freshestMovementItem.changeAmount,
              changePercent: freshestMovementItem.changePercent,
              movementDirection: freshestMovementItem.movementDirection,
              lastSeenDate: freshestMovementItem.lastSeenDate,
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
