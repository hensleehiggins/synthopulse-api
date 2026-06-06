const AIRTABLE_API_KEY =
  process.env.AIRTABLE_PAT ||
  process.env.AIRTABLE_API_KEY ||
  process.env.AIRTABLE_TOKEN ||
  process.env.KITCHENPULSE_AIRTABLE_API_KEY;

const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID ||
  process.env.KITCHENPULSE_AIRTABLE_BASE_ID ||
  "appD303evZM2SlvMR";

const AIRTABLE_API_URL = "https://api.airtable.com/v0";

const TABLES = {
  parLevels: "Par Levels",
  vendorReceiptLines: "Vendor Receipt Lines",
  weeklyItemTrends: "Weekly Item Trends",
};

const FIELD_SETS = {
  parLevels: [
    "Ingredient",
    "Inventory Items",
    "Current Stock",
    "Par Target",
    "Reorder Point",
    "Last Checked",
    "Status",
    "Estimated Daily Usage",
    "Days of Stock Left",
    "Suggested Par",
    "Reorder Needed?",
  ],
  vendorReceiptLines: [
    "Line Item Name",
    "Vendor",
    "Category",
    "Quantity",
    "Unit",
    "Package Size",
    "Unit Cost",
    "Line Total",
    "Confidence",
    "Needs Review",
    "Approved",
    "Raw Line Text",
  ],
  weeklyItemTrends: [
    "Item Name",
    "Trend Direction",
    "Trend Strength",
    "Confidence",
    "Owner Summary",
    "Recommended Action",
    "Is Active",
    "Current Qty",
    "Prior Qty",
    "Qty Change",
    "Qty Change Percent",
  ],
};

function sendJson(res, status, payload) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(status).json(payload);
}

function getField(record, name) {
  return record?.fields?.[name];
}

function selectName(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(selectName).filter(Boolean).join(", ");
  if (typeof value === "object" && value.name) return value.name;
  return "";
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "object" && value.specialValue) {
    return null;
  }

  if (Array.isArray(value)) {
    return numberOrNull(value[0]);
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function boolValue(value) {
  return value === true;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function normalizeVendor(value) {
  const raw = String(value || "").trim();
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

function tokensForMatch(value) {
  const stopWords = new Set([
    "the",
    "and",
    "with",
    "case",
    "pack",
    "lb",
    "lbs",
    "ct",
    "each",
    "ea",
    "oz",
    "gal",
    "cs",
    "sys",
    "cls",
    "food",
    "service",
    "atlanta",
    "llc",
  ]);

  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function matchScore(left, right) {
  const leftText = normalizeText(left);
  const rightText = normalizeText(right);

  if (!leftText || !rightText) return 0;

  if (leftText === rightText) return 1;
  if (rightText.includes(leftText) || leftText.includes(rightText)) return 0.9;

  const leftTokens = tokensForMatch(leftText);
  const rightTokens = new Set(tokensForMatch(rightText));

  if (!leftTokens.length || !rightTokens.size) return 0;

  const hits = leftTokens.filter((token) => rightTokens.has(token)).length;
  return hits / Math.max(1, Math.min(leftTokens.length, rightTokens.size));
}

function dateOnly(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function daysAgoFromIso(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const ms = now.getTime() - date.getTime();

  return Math.max(0, Math.floor(ms / 86400000));
}

function airtableUrl(tableName, fields = []) {
  const url = new URL(
    `${AIRTABLE_API_URL}/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`
  );

  url.searchParams.set("pageSize", "100");

  fields.forEach((field) => {
    url.searchParams.append("fields[]", field);
  });

  return url;
}

async function fetchAirtableTable(tableName, fields = []) {
  if (!AIRTABLE_API_KEY) {
    throw new Error("Missing Airtable API key.");
  }

  const records = [];
  let offset = "";

  do {
    const url = airtableUrl(tableName, fields);
    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      },
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        payload?.error?.message ||
          payload?.error ||
          `Airtable request failed for ${tableName}.`
      );
    }

    records.push(...(payload.records || []));
    offset = payload.offset || "";
  } while (offset);

  return records;
}

function buildReceiptLine(line) {
  const itemName = getField(line, "Line Item Name") || "";
  const vendor = normalizeVendor(getField(line, "Vendor"));
  const category = selectName(getField(line, "Category"));
  const quantity = numberOrNull(getField(line, "Quantity"));
  const unit = getField(line, "Unit") || "";
  const packageSize = getField(line, "Package Size") || "";
  const unitCost = numberOrNull(getField(line, "Unit Cost"));
  const lineTotal = numberOrNull(getField(line, "Line Total"));
  const confidence = selectName(getField(line, "Confidence"));
  const needsReview = boolValue(getField(line, "Needs Review"));
  const approved = boolValue(getField(line, "Approved"));
  const rawLineText = getField(line, "Raw Line Text") || "";

  return {
    id: line.id,
    createdTime: line.createdTime,
    itemName,
    normalizedItemName: normalizeText(itemName),
    vendor,
    category,
    quantity,
    unit,
    packageSize,
    unitCost,
    lineTotal,
    confidence,
    needsReview,
    approved,
    rawLineText,
    lastSeenDate: dateOnly(line.createdTime),
    lastSeenDaysAgo: daysAgoFromIso(line.createdTime),
  };
}

function buildTrend(trend) {
  const itemName = getField(trend, "Item Name") || "";
  const isActive = boolValue(getField(trend, "Is Active"));

  return {
    id: trend.id,
    itemName,
    normalizedItemName: normalizeText(itemName),
    direction: selectName(getField(trend, "Trend Direction")),
    strength: selectName(getField(trend, "Trend Strength")),
    confidence: selectName(getField(trend, "Confidence")),
    ownerSummary: getField(trend, "Owner Summary") || "",
    recommendedAction: getField(trend, "Recommended Action") || "",
    currentQty: numberOrNull(getField(trend, "Current Qty")),
    priorQty: numberOrNull(getField(trend, "Prior Qty")),
    qtyChange: numberOrNull(getField(trend, "Qty Change")),
    qtyChangePercent: numberOrNull(getField(trend, "Qty Change Percent")),
    isActive,
  };
}

function findBestReceiptMatch(itemName, receiptLines) {
  let best = null;

  for (const line of receiptLines) {
    const score = matchScore(itemName, line.itemName);

    if (score < 0.34) continue;

    if (
      !best ||
      score > best.score ||
      (score === best.score &&
        String(line.createdTime || "") > String(best.line.createdTime || ""))
    ) {
      best = { score, line };
    }
  }

  return best;
}

function findBestTrendMatch(itemName, trends) {
  let best = null;

  for (const trend of trends) {
    if (!trend.isActive) continue;

    const score = matchScore(itemName, trend.itemName);

    if (score < 0.34) continue;

    if (!best || score > best.score) {
      best = { score, trend };
    }
  }

  return best;
}

function classifyParItem({
  currentStock,
  parTarget,
  reorderPoint,
  reorderNeededText,
  estimatedDailyUsage,
}) {
  const reorderFlag = String(reorderNeededText || "").toLowerCase();
  const hasCurrentStock = currentStock !== null;
  const hasParTarget = parTarget !== null;
  const hasReorderPoint = reorderPoint !== null;

  if (!hasCurrentStock) return "needs_count";
  if (!hasParTarget && !hasReorderPoint) return "needs_setup";

  if (
    reorderFlag.includes("yes") ||
    (hasReorderPoint && currentStock <= reorderPoint)
  ) {
    return "critical";
  }

  if (hasParTarget && currentStock < parTarget) {
    return "order_soon";
  }

  if (
    estimatedDailyUsage !== null &&
    estimatedDailyUsage > 0 &&
    currentStock / estimatedDailyUsage <= 2
  ) {
    return "watch";
  }

  return "stable";
}

function statusLabel(status) {
  if (status === "critical") return "Critical";
  if (status === "order_soon") return "Order soon";
  if (status === "watch") return "Watch";
  if (status === "needs_count") return "Needs count";
  if (status === "needs_setup") return "Needs setup";
  return "Stable";
}

function priorityForStatus(status) {
  if (status === "critical") return 100;
  if (status === "order_soon") return 80;
  if (status === "watch") return 65;
  if (status === "needs_count") return 55;
  if (status === "needs_setup") return 40;
  return 10;
}

function recommendationType(status, trendMatch) {
  if (status === "critical") return "Critical Need";
  if (trendMatch?.trend) return "Pressure Adjusted";
  if (status === "order_soon") return "Normal PAR";
  if (status === "watch") return "Usage Watch";
  if (status === "needs_count") return "Needs Count";
  if (status === "needs_setup") return "Needs Setup";
  return "Stable";
}

function buildReason({
  ingredient,
  currentStock,
  parTarget,
  reorderPoint,
  status,
  suggestedOrderQty,
  receiptMatch,
  trendMatch,
}) {
  const parts = [];

  if (status === "critical") {
    parts.push(
      `${ingredient} is at or below reorder pressure. Current stock is ${
        currentStock ?? "unknown"
      }${reorderPoint !== null ? ` against a reorder point of ${reorderPoint}` : ""}.`
    );
  } else if (status === "order_soon") {
    parts.push(
      `${ingredient} is below target PAR. Suggested order quantity is ${suggestedOrderQty}.`
    );
  } else if (status === "needs_count") {
    parts.push(
      `${ingredient} needs a fresh count before KitchenPulse should trust an order recommendation.`
    );
  } else if (status === "needs_setup") {
    parts.push(
      `${ingredient} needs PAR setup before KitchenPulse can calculate reorder pressure.`
    );
  } else {
    parts.push(`${ingredient} is currently above reorder pressure based on available PAR data.`);
  }

  if (receiptMatch?.line) {
    const line = receiptMatch.line;
    const costText =
      line.unitCost !== null
        ? `$${line.unitCost.toFixed(2)}${line.unit ? ` / ${line.unit}` : ""}`
        : line.lineTotal !== null
          ? `$${line.lineTotal.toFixed(2)} line total`
          : "";

    parts.push(
      `Last receipt signal: ${line.vendor || "unknown vendor"}${
        costText ? ` at ${costText}` : ""
      }${line.packageSize ? `, package ${line.packageSize}` : ""}.`
    );
  }

  if (trendMatch?.trend) {
    const trend = trendMatch.trend;
    const direction = trend.direction || "trend";
    const strength = trend.strength ? ` ${trend.strength.toLowerCase()}` : "";

    parts.push(
      `Demand pressure: ${direction}${strength}${
        trend.ownerSummary ? `. ${trend.ownerSummary}` : ""
      }`
    );
  }

  return parts.join(" ");
}

function buildOwnerRead(counts) {
  if (!counts.activeParItems && !counts.receiptBackedItems) {
    return "Order Intelligence needs live item data before it can make useful reorder calls. Receipt intake should continue because it is currently the strongest source of vendor/package truth.";
  }

  if (counts.criticalItems > 0) {
    return `${counts.criticalItems} item${
      counts.criticalItems === 1 ? "" : "s"
    } currently show critical reorder pressure. ${counts.receiptBackedItems} tracked item${
      counts.receiptBackedItems === 1 ? "" : "s"
    } have receipt-backed vendor context.`;
  }

  if (counts.orderSoonItems > 0) {
    return `${counts.orderSoonItems} item${
      counts.orderSoonItems === 1 ? "" : "s"
    } are below target PAR but not yet critical. Receipt-backed vendor lines are helping fill in package and cost context while manual PAR data is still incomplete.`;
  }

  return `No critical PAR pressure is visible from current records. Data quality is still the main watch item: ${counts.needsCountItems} item${
    counts.needsCountItems === 1 ? "" : "s"
  } need counts and ${counts.blankParRows} PAR row${
    counts.blankParRows === 1 ? "" : "s"
  } appear blank or incomplete.`;
}

function buildParItem(parRecord, receiptLines, trends) {
  const ingredient = String(getField(parRecord, "Ingredient") || "").trim();
  const linkedInventoryItems = getField(parRecord, "Inventory Items") || [];
  const fallbackName = Array.isArray(linkedInventoryItems)
    ? linkedInventoryItems.map((item) => item.name).filter(Boolean).join(", ")
    : "";

  const itemName = ingredient || fallbackName || "Unnamed PAR item";

  const currentStock = numberOrNull(getField(parRecord, "Current Stock"));
  const parTarget = numberOrNull(getField(parRecord, "Par Target"));
  const reorderPoint = numberOrNull(getField(parRecord, "Reorder Point"));
  const estimatedDailyUsage = numberOrNull(getField(parRecord, "Estimated Daily Usage"));
  const daysOfStockLeft =
    numberOrNull(getField(parRecord, "Days of Stock Left")) ||
    (currentStock !== null && estimatedDailyUsage
      ? currentStock / estimatedDailyUsage
      : null);

  const suggestedPar = numberOrNull(getField(parRecord, "Suggested Par"));
  const reorderNeededText = getField(parRecord, "Reorder Needed?") || "";
  const status = classifyParItem({
    currentStock,
    parTarget,
    reorderPoint,
    reorderNeededText,
    estimatedDailyUsage,
  });

  const rawSuggestedOrder =
    parTarget !== null && currentStock !== null ? Math.max(0, parTarget - currentStock) : null;

  const suggestedOrderQty =
    rawSuggestedOrder !== null ? Math.ceil(rawSuggestedOrder) : null;

  const receiptMatch = findBestReceiptMatch(itemName, receiptLines);
  const trendMatch = findBestTrendMatch(itemName, trends);

  const priority =
    priorityForStatus(status) +
    (receiptMatch ? 6 : 0) +
    (trendMatch ? 10 : 0) +
    (daysOfStockLeft !== null && daysOfStockLeft <= 2 ? 8 : 0);

  const signals = [
    "PAR",
    receiptMatch ? "Receipt-backed" : "",
    trendMatch ? "Demand pressure" : "",
    currentStock === null ? "Needs count" : "",
    parTarget === null ? "Needs target" : "",
  ].filter(Boolean);

  const confidence =
    currentStock !== null && parTarget !== null && receiptMatch
      ? "High"
      : currentStock !== null && parTarget !== null
        ? "Medium"
        : "Low";

  return {
    id: parRecord.id,
    itemName,
    normalizedItemName: normalizeText(itemName),
    currentStock,
    parTarget,
    reorderPoint,
    estimatedDailyUsage,
    daysOfStockLeft,
    suggestedPar,
    suggestedOrderQty,
    reorderNeeded: String(reorderNeededText || "").toLowerCase().includes("yes"),
    status,
    statusLabel: statusLabel(status),
    recommendationType: recommendationType(status, trendMatch),
    priority,
    confidence,
    signals,
    lastChecked: getField(parRecord, "Last Checked") || "",
    receipt: receiptMatch?.line || null,
    receiptMatchScore: receiptMatch?.score || 0,
    trend: trendMatch?.trend || null,
    trendMatchScore: trendMatch?.score || 0,
    reason: buildReason({
      ingredient: itemName,
      currentStock,
      parTarget,
      reorderPoint,
      status,
      suggestedOrderQty,
      receiptMatch,
      trendMatch,
    }),
  };
}

function buildReceiptOnlyItem(line) {
  return {
    id: `receipt-${line.id}`,
    itemName: line.itemName || "Receipt-backed item",
    normalizedItemName: line.normalizedItemName,
    currentStock: null,
    parTarget: null,
    reorderPoint: null,
    estimatedDailyUsage: null,
    daysOfStockLeft: null,
    suggestedPar: null,
    suggestedOrderQty: null,
    reorderNeeded: false,
    status: "needs_setup",
    statusLabel: "Needs setup",
    recommendationType: "Receipt Seed",
    priority: 35,
    confidence: line.approved && !line.needsReview ? "Medium" : "Low",
    signals: ["Receipt-backed", "Needs PAR"],
    lastChecked: "",
    receipt: line,
    receiptMatchScore: 1,
    trend: null,
    trendMatchScore: 0,
    reason: `${line.itemName} exists in approved receipt history but does not yet have a usable PAR record. Add count unit, target PAR, reorder point, and vendor order rules before trusting reorder guidance.`,
  };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, {
      ok: false,
      error: "Method not allowed.",
    });
  }

  try {
    const [parRecords, rawReceiptLines, rawTrends] = await Promise.all([
      fetchAirtableTable(TABLES.parLevels, FIELD_SETS.parLevels),
      fetchAirtableTable(TABLES.vendorReceiptLines, FIELD_SETS.vendorReceiptLines),
      fetchAirtableTable(TABLES.weeklyItemTrends, FIELD_SETS.weeklyItemTrends).catch(
        () => []
      ),
    ]);

    const receiptLines = rawReceiptLines
      .map(buildReceiptLine)
      .filter((line) => line.itemName)
      .sort((a, b) => String(b.createdTime || "").localeCompare(String(a.createdTime || "")));

    const trustedReceiptLines = receiptLines.filter(
      (line) => line.approved === true && line.needsReview !== true
    );

    const trends = rawTrends.map(buildTrend).filter((trend) => trend.itemName);

    const blankParRows = parRecords.filter((record) => {
      const ingredient = String(getField(record, "Ingredient") || "").trim();
      const linked = getField(record, "Inventory Items") || [];
      return !ingredient && (!Array.isArray(linked) || linked.length === 0);
    }).length;

    const parItems = parRecords
      .filter((record) => {
        const ingredient = String(getField(record, "Ingredient") || "").trim();
        const linked = getField(record, "Inventory Items") || [];
        return ingredient || (Array.isArray(linked) && linked.length > 0);
      })
      .map((record) => buildParItem(record, trustedReceiptLines, trends));

    const parNames = parItems.map((item) => item.normalizedItemName);

    const receiptOnlyItems = trustedReceiptLines
      .filter((line) => {
        if (!line.itemName) return false;

        const alreadyCovered = parNames.some((name) => {
          return matchScore(name, line.itemName) >= 0.5;
        });

        return !alreadyCovered;
      })
      .slice(0, 40)
      .map(buildReceiptOnlyItem);

    const items = [...parItems, ...receiptOnlyItems]
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return String(a.itemName || "").localeCompare(String(b.itemName || ""));
      })
      .slice(0, 80);

    const counts = {
      totalParRows: parRecords.length,
      blankParRows,
      activeParItems: parItems.length,
      receiptBackedItems: items.filter((item) => item.receipt).length,
      approvedReceiptLines: trustedReceiptLines.length,
      criticalItems: items.filter((item) => item.status === "critical").length,
      orderSoonItems: items.filter((item) => item.status === "order_soon").length,
      watchItems: items.filter((item) => item.status === "watch").length,
      stableItems: items.filter((item) => item.status === "stable").length,
      needsCountItems: items.filter((item) => item.status === "needs_count").length,
      needsSetupItems: items.filter((item) => item.status === "needs_setup").length,
      demandPressureItems: items.filter((item) => item.trend).length,
    };

    return sendJson(res, 200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      ownerRead: buildOwnerRead(counts),
      counts,
      items,
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: error?.message || "Order Intelligence could not be loaded.",
    });
  }
}
