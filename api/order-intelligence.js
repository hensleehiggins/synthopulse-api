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
  stockCountLines: "Stock Count Lines",
};

const FIELD_SETS = {
  parLevels: [
    "Order Item Name",
    "Restaurant",
    "Preferred Vendor",
    "Vendor Item Name",
    "Order Vendor SKU",
    "Storage Area",
    "Count Unit",
    "Vendor Order Unit",
    "OI Pack Size",
    "OI Unit Conversion Notes",
    "OI Target Stock",
    "OI Safety Stock",
    "OI Lead Time Days",
    "OI Order Days",
    "OI Delivery Days",
    "OI Vendor Cutoff Time",
    "OI Critical Item",
    "OI Emergency Run Risk",
    "OI Event Sensitive",

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
  stockCountLines: [
    "Count Line Name",
    "Stock Count Session",
    "Count Item Name",
    "Storage Area",
    "Count Quantity",
    "Count Unit",
    "Count Notes",
    "Photo",
    "Count Review State",
    "Approved For Ordering",
    "Counter Name",
    "Count Time Text",
  ],
};

const STOCK_COUNT_MATCH_THRESHOLD = 0.75;
const RECEIPT_MATCH_THRESHOLD = 0.75;

const MATCH_STOP_WORDS = new Set([
  "the",
  "and",
  "with",
  "for",
  "from",
  "item",
  "items",
  "test",
  "case",
  "cases",
  "pack",
  "packs",
  "package",
  "packages",
  "box",
  "boxes",
  "bag",
  "bags",
  "can",
  "cans",
  "bottle",
  "bottles",
  "sleeve",
  "sleeves",
  "loaf",
  "loaves",
  "tray",
  "trays",
  "tub",
  "tubs",
  "jar",
  "jars",
  "each",
  "ea",
  "ct",
  "count",
  "dozen",
  "dz",
  "lb",
  "lbs",
  "pound",
  "pounds",
  "oz",
  "ounce",
  "ounces",
  "gal",
  "gallon",
  "gallons",
  "qt",
  "quart",
  "quarts",
  "pt",
  "pint",
  "pints",
  "cs",
  "sys",
  "cls",
  "food",
  "foods",
  "service",
  "atlanta",
  "llc",
]);

const GENERIC_STOCK_TOKENS = new Set([
  "bread",
  "bacon",
  "cheese",
  "beef",
  "chicken",
  "pork",
  "fish",
  "seafood",
  "shrimp",
  "lettuce",
  "tomato",
  "tomatoes",
  "onion",
  "onions",
  "sauce",
  "milk",
  "cream",
  "butter",
  "flour",
  "oil",
  "wine",
  "beer",
  "liquor",
  "vodka",
  "rum",
  "gin",
  "bourbon",
  "whiskey",
  "tequila",
  "produce",
  "dairy",
  "meat",
  "steak",
  "vegetable",
  "vegetables",
  "fruit",
  "egg",
  "eggs",
  "rice",
  "pasta",
  "potato",
  "potatoes",
  "mushroom",
  "mushrooms",
  "greens",
  "herbs",
  "spice",
  "spices",
  "seasoning",
  "stock",
  "broth",
]);

function sendJson(res, status, payload) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(status).json(payload);
}

function getField(record, name) {
  return record?.fields?.[name];
}

function getFirstField(record, names = []) {
  for (const name of names) {
    const value = getField(record, name);

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return null;
}

function getFirstText(record, names = []) {
  const value = getFirstField(record, names);

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.name) return item.name;
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object" && value?.name) return value.name;

  return String(value || "").trim();
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
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !MATCH_STOP_WORDS.has(token));
}

function meaningfulTokensForMatch(value) {
  return tokensForMatch(value).filter((token) => !GENERIC_STOCK_TOKENS.has(token));
}

function uniqueTokens(tokens = []) {
  return [...new Set(tokens)];
}
function uniqueSorted(values = []) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b))
  );
}

function allTokensInSet(tokens = [], tokenSet = new Set()) {
  return tokens.every((token) => tokenSet.has(token));
}

function isGenericOnlyName(value) {
  const tokens = tokensForMatch(value);
  if (!tokens.length) return false;

  return tokens.every((token) => GENERIC_STOCK_TOKENS.has(token));
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

function getSafeItemMatchDetails({
  targetItemName,
  sourceItemName,
  sourceLabel,
  genericBlockNotes,
  noMeaningfulOverlapNotes,
  weakOverlapNotes,
  exactNotes,
  sameTokensNotes,
  containmentNotes,
  tokenOverlapNotes,
}) {
  const targetText = normalizeText(targetItemName);
  const sourceText = normalizeText(sourceItemName);

  if (!targetText || !sourceText) {
    return {
      score: 0,
      confidence: "None",
      type: "no_match",
      notes: "Missing item name.",
      blocked: true,
    };
  }

  if (targetText === sourceText) {
    return {
      score: 1,
      confidence: "Exact",
      type: "exact_name",
      notes: exactNotes || `Exact ${sourceLabel} match.`,
      blocked: false,
    };
  }

  const targetTokens = uniqueTokens(tokensForMatch(targetText));
  const sourceTokens = uniqueTokens(tokensForMatch(sourceText));

  if (!targetTokens.length || !sourceTokens.length) {
    return {
      score: 0,
      confidence: "None",
      type: "no_tokens",
      notes: `Not enough usable words to safely match this ${sourceLabel}.`,
      blocked: true,
    };
  }

  const targetGenericOnly = isGenericOnlyName(targetText);
  const sourceGenericOnly = isGenericOnlyName(sourceText);

  if (targetGenericOnly || sourceGenericOnly) {
    return {
      score: 0,
      confidence: "Blocked",
      type: "generic_name_blocked",
      notes:
        genericBlockNotes ||
        `Generic names require an exact match or a manual order-rule link before this ${sourceLabel} can affect another item.`,
      blocked: true,
    };
  }

  const targetTokenSet = new Set(targetTokens);
  const sourceTokenSet = new Set(sourceTokens);

  const sharedTokens = sourceTokens.filter((token) => targetTokenSet.has(token));
  const sharedMeaningfulTokens = sharedTokens.filter(
    (token) => !GENERIC_STOCK_TOKENS.has(token)
  );

  if (!sharedTokens.length || !sharedMeaningfulTokens.length) {
    return {
      score: 0,
      confidence: "None",
      type: "no_meaningful_overlap",
      notes:
        noMeaningfulOverlapNotes ||
        `The ${sourceLabel} did not share a specific enough item word with this target.`,
      blocked: true,
    };
  }

  const sameTokenSet =
    targetTokens.length === sourceTokens.length &&
    allTokensInSet(targetTokens, sourceTokenSet) &&
    allTokensInSet(sourceTokens, targetTokenSet);

  if (sameTokenSet) {
    return {
      score: 0.95,
      confidence: "High",
      type: "same_tokens",
      notes: sameTokensNotes || `${sourceLabel} uses the same item words in a different order.`,
      blocked: false,
    };
  }

  const sourceContainedInTarget = allTokensInSet(sourceTokens, targetTokenSet);
  const targetContainedInSource = allTokensInSet(targetTokens, sourceTokenSet);
  const textContainment = targetText.includes(sourceText) || sourceText.includes(targetText);

  if (sourceContainedInTarget || targetContainedInSource || textContainment) {
    const shorterLength = Math.min(targetTokens.length, sourceTokens.length);

    if (shorterLength >= 2 && sharedMeaningfulTokens.length >= 1) {
      return {
        score: 0.86,
        confidence: "High",
        type: "strong_containment",
        notes: containmentNotes || `${sourceLabel} is a strong specific name match.`,
        blocked: false,
      };
    }
  }

  const overlapScore =
    sharedTokens.length / Math.max(1, Math.max(targetTokens.length, sourceTokens.length));

  const targetMeaningfulTokens = meaningfulTokensForMatch(targetText);
  const sourceMeaningfulTokens = meaningfulTokensForMatch(sourceText);

  const meaningfulOverlapScore =
    sharedMeaningfulTokens.length /
    Math.max(1, Math.min(targetMeaningfulTokens.length, sourceMeaningfulTokens.length));

  if (overlapScore >= RECEIPT_MATCH_THRESHOLD && meaningfulOverlapScore >= 0.67) {
    return {
      score: overlapScore,
      confidence: overlapScore >= 0.9 ? "High" : "Medium",
      type: "token_overlap",
      notes: tokenOverlapNotes || `${sourceLabel} shares enough specific item words to match.`,
      blocked: false,
    };
  }

  return {
    score: overlapScore,
    confidence: "Low",
    type: "weak_overlap",
    notes:
      weakOverlapNotes ||
      `${sourceLabel} was not specific enough to safely attach to this item.`,
    blocked: true,
  };
}

function getStockCountMatchDetails(targetItemName, countItemName) {
  return getSafeItemMatchDetails({
    targetItemName,
    sourceItemName: countItemName,
    sourceLabel: "approved count",
    exactNotes: "Exact approved count match.",
    sameTokensNotes: "Approved count uses the same item words in a different order.",
    containmentNotes: "Approved count is a strong specific name match.",
    tokenOverlapNotes: "Approved count shares enough specific item words to match.",
    genericBlockNotes:
      "Generic stock count names require an exact match or a manual order-rule link before they can affect another item.",
    noMeaningfulOverlapNotes:
      "The approved count did not share a specific enough item word with this target.",
    weakOverlapNotes:
      "Approved count was not specific enough to safely attach to this item. It should appear as a separate Count Seed instead.",
  });
}

function getReceiptMatchDetails(targetItemName, receiptItemName) {
  return getSafeItemMatchDetails({
    targetItemName,
    sourceItemName: receiptItemName,
    sourceLabel: "receipt line",
    exactNotes: "Exact receipt line match.",
    sameTokensNotes: "Receipt line uses the same item words in a different order.",
    containmentNotes: "Receipt line is a strong specific vendor/item match.",
    tokenOverlapNotes: "Receipt line shares enough specific item words to match.",
    genericBlockNotes:
      "Generic order item names require an exact receipt match or a manual order-rule link before vendor/package context can attach.",
    noMeaningfulOverlapNotes:
      "The receipt line did not share a specific enough item word with this order item.",
    weakOverlapNotes:
      "Receipt line was not specific enough to safely attach. Keep vendor/package context separate until the item is manually linked.",
  });
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

async function fetchAirtablePage(tableName, fields = [], offset = "") {
  const url = airtableUrl(tableName, fields);
  if (offset) url.searchParams.set("offset", offset);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.error ||
      `Airtable request failed for ${tableName}.`;

    throw new Error(message);
  }

  return payload;
}

function looksLikeMissingFieldError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("unknown field") ||
    message.includes("invalid field") ||
    (message.includes("field") && message.includes("does not exist"))
  );
}

async function fetchAirtableTable(tableName, fields = []) {
  if (!AIRTABLE_API_KEY) {
    throw new Error("Missing Airtable API key.");
  }

  const records = [];
  let offset = "";
  let fieldList = fields;

  do {
    try {
      const payload = await fetchAirtablePage(tableName, fieldList, offset);

      records.push(...(payload.records || []));
      offset = payload.offset || "";
    } catch (error) {
      if (fieldList.length && looksLikeMissingFieldError(error)) {
        console.warn(
          `Field-filtered fetch failed for ${tableName}. Retrying without field whitelist.`
        );

        records.length = 0;
        offset = "";
        fieldList = [];
        continue;
      }

      throw error;
    }
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

function photoInfo(value) {
  const files = Array.isArray(value) ? value : [];
  const first = files[0];

  return {
    hasPhoto: Boolean(first?.url),
    photoUrl: first?.url || "",
    photoName: first?.filename || "",
  };
}

function buildStockCountLine(record) {
  const itemName =
    getField(record, "Count Item Name") ||
    getField(record, "Count Line Name") ||
    "";

  const photo = photoInfo(getField(record, "Photo"));
  const reviewState = getField(record, "Count Review State") || "";
  const approvedForOrdering = boolValue(getField(record, "Approved For Ordering"));

  return {
    id: record.id,
    createdTime: record.createdTime,
    itemName,
    normalizedItemName: normalizeText(itemName),
    storageArea:
      selectName(getField(record, "Storage Area")) ||
      getField(record, "Storage Area") ||
      "",
    quantity: numberOrNull(getField(record, "Count Quantity")),
    unit: getField(record, "Count Unit") || "",
    notes: getField(record, "Count Notes") || "",
    reviewState,
    approvedForOrdering,
    counterName: getField(record, "Counter Name") || "",
    countTimeText: getField(record, "Count Time Text") || "",
    hasPhoto: photo.hasPhoto,
    photoUrl: photo.photoUrl,
    photoName: photo.photoName,
    lastSeenDate: dateOnly(record.createdTime),
    lastSeenDaysAgo: daysAgoFromIso(record.createdTime),
  };
}

function findBestStockCountMatch(itemName, stockCountLines) {
  let best = null;

  for (const line of stockCountLines) {
    if (!line.approvedForOrdering) continue;
    if (!line.itemName) continue;
    if (line.quantity === null) continue;

    const details = getStockCountMatchDetails(itemName, line.itemName);

    if (details.blocked) continue;
    if (details.score < STOCK_COUNT_MATCH_THRESHOLD) continue;

    if (
      !best ||
      details.score > best.score ||
      (details.score === best.score &&
        String(line.createdTime || "") > String(best.line.createdTime || ""))
    ) {
      best = {
        ...details,
        line,
      };
    }
  }

  return best;
}

function stockCountLineIsSafelyCovered(line, itemNames = []) {
  return itemNames.some((itemName) => {
    const details = getStockCountMatchDetails(itemName, line.itemName);
    return !details.blocked && details.score >= STOCK_COUNT_MATCH_THRESHOLD;
  });
}

function getReceiptCandidateNames(itemName, orderRules = {}) {
  return uniqueSorted([
    itemName,
    orderRules.vendorItemName,
  ]).filter(Boolean);
}

function findBestReceiptMatch(itemName, receiptLines, orderRules = {}) {
  let best = null;
  const candidateNames = getReceiptCandidateNames(itemName, orderRules);

  for (const line of receiptLines) {
    for (const candidateName of candidateNames) {
      const details = getReceiptMatchDetails(candidateName, line.itemName);

      if (details.blocked) continue;
      if (details.score < RECEIPT_MATCH_THRESHOLD) continue;

      if (
        !best ||
        details.score > best.score ||
        (details.score === best.score &&
          String(line.createdTime || "") > String(best.line.createdTime || ""))
      ) {
        best = {
          ...details,
          line,
          matchedOn: candidateName,
        };
      }
    }
  }

  return best;
}

function receiptLineIsSafelyCovered(line, itemNames = [], parItems = []) {
  const names = [...itemNames];

  parItems.forEach((item) => {
    if (item?.orderRules?.vendorItemName) {
      names.push(item.orderRules.vendorItemName);
    }
  });

  return names.some((itemName) => {
    const details = getReceiptMatchDetails(itemName, line.itemName);
    return !details.blocked && details.score >= RECEIPT_MATCH_THRESHOLD;
  });
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
  criticalItem,
  emergencyRunRisk,
  suggestedOrderQty,
}) {
  const reorderFlag = String(reorderNeededText || "").toLowerCase();
  const hasCurrentStock = currentStock !== null;
  const hasParTarget = parTarget !== null;
  const hasReorderPoint = reorderPoint !== null;
  const hasSuggestedOrder =
    suggestedOrderQty !== null && Number(suggestedOrderQty) > 0;

  if (!hasCurrentStock) return "needs_count";

  if (!hasParTarget) return "needs_setup";

  if (!hasSuggestedOrder) {
    if (
      estimatedDailyUsage !== null &&
      estimatedDailyUsage > 0 &&
      currentStock / estimatedDailyUsage <= 2
    ) {
      return "watch";
    }

    return "stable";
  }

  if (
    criticalItem === true ||
    emergencyRunRisk === true ||
    reorderFlag.includes("yes") ||
    (hasReorderPoint && currentStock <= reorderPoint)
  ) {
    return "critical";
  }

  if (currentStock < parTarget) {
    return "order_soon";
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

function recommendationType(status, trendMatch, orderRules) {
  if (status === "critical") return "Critical Need";
  if (trendMatch?.trend || orderRules.eventSensitive) return "Pressure Adjusted";
  if (status === "order_soon") return "Normal PAR";
  if (status === "watch") return "Usage Watch";
  if (status === "needs_count") return "Needs Count";
  if (status === "needs_setup") return "Needs Setup";
  return "Stable";
}

function formatOrderRules(orderRules) {
  const parts = [];

  if (orderRules.preferredVendor) {
    parts.push(`preferred vendor ${orderRules.preferredVendor}`);
  }

  if (orderRules.vendorItemName) {
    parts.push(`vendor item ${orderRules.vendorItemName}`);
  }

  if (orderRules.orderVendorSku) {
    parts.push(`SKU ${orderRules.orderVendorSku}`);
  }

  if (orderRules.vendorOrderUnit) {
    parts.push(`order unit ${orderRules.vendorOrderUnit}`);
  }

  if (orderRules.packSize) {
    parts.push(`pack ${orderRules.packSize}`);
  }

  return parts.join(", ");
}

function buildReason({
  itemName,
  currentStock,
  parTarget,
  reorderPoint,
  status,
  suggestedOrderQty,
  receiptMatch,
  trendMatch,
  stockCountMatch,
  orderRules,
}) {
  const parts = [];

  if (status === "critical") {
    parts.push(
      `${itemName} is at or below reorder pressure. Current stock is ${
        currentStock ?? "unknown"
      }${reorderPoint !== null ? ` against a reorder point of ${reorderPoint}` : ""}.`
    );
  } else if (status === "order_soon") {
    parts.push(
      `${itemName} is below target stock. Suggested order quantity is ${suggestedOrderQty}.`
    );
  } else if (status === "needs_count") {
    parts.push(
      `${itemName} needs a fresh count before KitchenPulse should trust an order recommendation.`
    );
  } else if (status === "needs_setup") {
    parts.push(
      `${itemName} needs order-rule setup before KitchenPulse can calculate reorder pressure.`
    );
  } else {
    parts.push(`${itemName} is currently above reorder pressure based on available stock rules.`);
  }

  if (orderRules.emergencyRunRisk) {
    parts.push(
      "Emergency run risk is flagged, so this item should stay visible even before perfect usage data exists."
    );
  }

  if (orderRules.criticalItem) {
    parts.push("Critical item is flagged, so KitchenPulse treats this as higher priority.");
  }

  if (orderRules.eventSensitive) {
    parts.push(
      "Event sensitivity is flagged, so upcoming events should be allowed to lift the order recommendation."
    );
  }

  const orderRuleText = formatOrderRules(orderRules);
  if (orderRuleText) {
    parts.push(`Order rule context: ${orderRuleText}.`);
  }

  if (stockCountMatch?.line) {
    const countLine = stockCountMatch.line;
    const scoreText = stockCountMatch.score
      ? ` Match confidence ${Math.round(stockCountMatch.score * 100)}%.`
      : "";

    parts.push(
      `Latest approved stock count: ${countLine.quantity}${
        countLine.unit ? ` ${countLine.unit}` : ""
      }${countLine.storageArea ? ` in ${countLine.storageArea}` : ""}${
        countLine.counterName ? ` by ${countLine.counterName}` : ""
      }. ${stockCountMatch.notes || ""}${scoreText}`.trim()
    );
  }

  if (receiptMatch?.line) {
    const line = receiptMatch.line;
    const costText =
      line.unitCost !== null
        ? `$${line.unitCost.toFixed(2)}${line.unit ? ` / ${line.unit}` : ""}`
        : line.lineTotal !== null
          ? `$${line.lineTotal.toFixed(2)} line total`
          : "";

    const scoreText = receiptMatch.score
      ? ` Match confidence ${Math.round(receiptMatch.score * 100)}%.`
      : "";

    parts.push(
      `Last receipt signal: ${line.vendor || "unknown vendor"}${
        costText ? ` at ${costText}` : ""
      }${line.packageSize ? `, package ${line.packageSize}` : ""}. ${
        receiptMatch.notes || ""
      }${scoreText}`.trim()
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
  if (!counts.activeParItems && !counts.receiptBackedItems && !counts.approvedStockCountLines) {
    return "Order Intelligence needs live item data before it can make useful reorder calls. Receipt intake and stock counts should continue because they are currently the strongest sources of vendor, package, and on-hand truth.";
  }

  if (counts.criticalItems > 0) {
    return `${counts.criticalItems} item${
      counts.criticalItems === 1 ? "" : "s"
    } currently show critical reorder pressure. ${counts.receiptBackedItems} tracked item${
      counts.receiptBackedItems === 1 ? "" : "s"
    } have receipt-backed vendor context, and ${counts.stockCountBackedItems} item${
      counts.stockCountBackedItems === 1 ? "" : "s"
    } have approved count context.`;
  }

  if (counts.orderSoonItems > 0) {
    return `${counts.orderSoonItems} item${
      counts.orderSoonItems === 1 ? "" : "s"
    } are below target stock but not yet critical. Approved stock counts and receipt-backed vendor lines are helping fill in the ordering picture while setup is still incomplete.`;
  }

  if (counts.stockCountSeedItems > 0) {
    return `${counts.stockCountSeedItems} approved count item${
      counts.stockCountSeedItems === 1 ? "" : "s"
    } did not safely match an existing order rule or receipt-backed item. Those should be reviewed as Count Seeds instead of being forced onto a fuzzy match.`;
  }

  return `No critical reorder pressure is visible from current records. Data quality is still the main watch item: ${counts.needsCountItems} item${
    counts.needsCountItems === 1 ? "" : "s"
  } need counts and ${counts.blankParRows} order rule row${
    counts.blankParRows === 1 ? "" : "s"
  } appear blank or incomplete.`;
}

function getLinkedFallbackName(parRecord) {
  const linkedInventoryItems = getField(parRecord, "Inventory Items") || [];

  if (!Array.isArray(linkedInventoryItems)) return "";

  return linkedInventoryItems
    .map((item) => {
      if (typeof item === "string") return "";
      if (item?.name) return item.name;
      return "";
    })
    .filter(Boolean)
    .join(", ");
}

function buildOrderRules(parRecord) {
  return {
    preferredVendor: normalizeVendor(getFirstText(parRecord, ["Preferred Vendor"])),
    vendorItemName: getFirstText(parRecord, ["Vendor Item Name"]),
    orderVendorSku: getFirstText(parRecord, ["Order Vendor SKU"]),
    storageArea: getFirstText(parRecord, ["Storage Area"]),
    countUnit: getFirstText(parRecord, ["Count Unit"]),
    vendorOrderUnit: getFirstText(parRecord, ["Vendor Order Unit"]),
    packSize: getFirstText(parRecord, ["OI Pack Size"]),
    unitConversionNotes: getFirstText(parRecord, ["OI Unit Conversion Notes"]),
    safetyStock: numberOrNull(getField(parRecord, "OI Safety Stock")),
    leadTimeDays: numberOrNull(getField(parRecord, "OI Lead Time Days")),
    orderDays: getFirstText(parRecord, ["OI Order Days"]),
    deliveryDays: getFirstText(parRecord, ["OI Delivery Days"]),
    vendorCutoffTime: getFirstText(parRecord, ["OI Vendor Cutoff Time"]),
    criticalItem: boolValue(getField(parRecord, "OI Critical Item")),
    emergencyRunRisk: boolValue(getField(parRecord, "OI Emergency Run Risk")),
    eventSensitive: boolValue(getField(parRecord, "OI Event Sensitive")),
  };
}

function parRecordHasIdentity(record) {
  const itemName = getFirstText(record, ["Order Item Name", "Ingredient"]);
  const linked = getField(record, "Inventory Items") || [];

  return Boolean(itemName || (Array.isArray(linked) && linked.length > 0));
}

function buildParItem(parRecord, receiptLines, trends, stockCountLines) {
  const itemName =
    getFirstText(parRecord, ["Order Item Name", "Ingredient"]) ||
    getLinkedFallbackName(parRecord) ||
    "Unnamed order item";

  const orderRules = buildOrderRules(parRecord);

  const parTarget = numberOrNull(
    getFirstField(parRecord, ["OI Target Stock", "Par Target"])
  );

  const reorderPoint = numberOrNull(getField(parRecord, "Reorder Point"));
  const estimatedDailyUsage = numberOrNull(getField(parRecord, "Estimated Daily Usage"));

  const receiptMatch = findBestReceiptMatch(itemName, receiptLines, orderRules);
  const trendMatch = findBestTrendMatch(itemName, trends);
  const stockCountMatch = findBestStockCountMatch(itemName, stockCountLines);

  const approvedStockCount = numberOrNull(stockCountMatch?.line?.quantity);
  const manualCurrentStock = numberOrNull(getField(parRecord, "Current Stock"));
  const receiptQuantity = numberOrNull(receiptMatch?.line?.quantity);

  const currentStock =
    approvedStockCount !== null
      ? approvedStockCount
      : manualCurrentStock !== null
        ? manualCurrentStock
        : receiptQuantity;

  const stockSource =
    approvedStockCount !== null
      ? "Approved stock count"
      : manualCurrentStock !== null
        ? "Manual count"
        : receiptQuantity !== null
          ? "Last approved receipt quantity"
          : "Missing";

  const fieldDaysOfStockLeft = numberOrNull(getField(parRecord, "Days of Stock Left"));

  const daysOfStockLeft =
    fieldDaysOfStockLeft !== null
      ? fieldDaysOfStockLeft
      : currentStock !== null && estimatedDailyUsage
        ? currentStock / estimatedDailyUsage
        : null;

  const suggestedPar = numberOrNull(getField(parRecord, "Suggested Par"));
  const reorderNeededText = getField(parRecord, "Reorder Needed?") || "";

  const rawSuggestedOrder =
    parTarget !== null && currentStock !== null
      ? Math.max(0, parTarget - currentStock)
      : null;

  const suggestedOrderQty =
    rawSuggestedOrder !== null ? Math.ceil(rawSuggestedOrder) : null;

  const status = classifyParItem({
    currentStock,
    parTarget,
    reorderPoint,
    reorderNeededText,
    estimatedDailyUsage,
    criticalItem: orderRules.criticalItem,
    emergencyRunRisk: orderRules.emergencyRunRisk,
    suggestedOrderQty,
  });

  const priority =
    priorityForStatus(status) +
    (receiptMatch ? 6 : 0) +
    (trendMatch ? 10 : 0) +
    (orderRules.criticalItem ? 12 : 0) +
    (orderRules.emergencyRunRisk ? 10 : 0) +
    (orderRules.eventSensitive ? 5 : 0) +
    (stockSource === "Approved stock count" ? 12 : 0) +
    (stockSource === "Last approved receipt quantity" ? 3 : 0) +
    (daysOfStockLeft !== null && daysOfStockLeft <= 2 ? 8 : 0);

  const signals = [
    "Order Rules",
    stockSource === "Approved stock count" ? "Approved count" : "",
    stockCountMatch?.confidence === "Exact" ? "Exact count match" : "",
    stockCountMatch?.confidence === "High" ? "Strong count match" : "",
    receiptMatch ? "Receipt-backed" : "",
    receiptMatch?.confidence === "Exact" ? "Exact receipt match" : "",
    receiptMatch?.confidence === "High" ? "Strong receipt match" : "",
    stockSource === "Last approved receipt quantity" ? "Receipt quantity" : "",
    trendMatch ? "Demand pressure" : "",
    orderRules.criticalItem ? "Critical item" : "",
    orderRules.emergencyRunRisk ? "Emergency risk" : "",
    orderRules.eventSensitive ? "Event sensitive" : "",
    currentStock === null ? "Needs count" : "",
    parTarget === null ? "Needs target" : "",
    orderRules.preferredVendor ? "Vendor rule" : "",
  ].filter(Boolean);

  const confidence =
    approvedStockCount !== null && parTarget !== null
      ? "High"
      : manualCurrentStock !== null && parTarget !== null && receiptMatch
        ? "High"
        : currentStock !== null && parTarget !== null
          ? "Medium"
          : currentStock !== null
            ? "Medium"
            : "Low";

  return {
    id: parRecord.id,
    itemName,
    normalizedItemName: normalizeText(itemName),
    currentStock,
    stockSource,
    parTarget,
    reorderPoint,
    estimatedDailyUsage,
    daysOfStockLeft,
    suggestedPar,
    suggestedOrderQty,
    reorderNeeded: String(reorderNeededText || "").toLowerCase().includes("yes"),
    status,
    statusLabel: statusLabel(status),
    recommendationType: recommendationType(status, trendMatch, orderRules),
    priority,
    confidence,
    signals,
    lastChecked: getField(parRecord, "Last Checked") || "",
    orderRules,
    receipt: receiptMatch?.line || null,
    receiptMatchScore: receiptMatch?.score || 0,
    receiptMatchConfidence: receiptMatch?.confidence || "",
    receiptMatchType: receiptMatch?.type || "",
    receiptMatchNotes: receiptMatch?.notes || "",
    receiptMatchedOn: receiptMatch?.matchedOn || "",
    stockCount: stockCountMatch?.line || null,
    stockCountMatchScore: stockCountMatch?.score || 0,
    stockCountMatchConfidence: stockCountMatch?.confidence || "",
    stockCountMatchType: stockCountMatch?.type || "",
    stockCountMatchNotes: stockCountMatch?.notes || "",
    trend: trendMatch?.trend || null,
    trendMatchScore: trendMatch?.score || 0,
    reason: buildReason({
      itemName,
      currentStock,
      parTarget,
      reorderPoint,
      status,
      suggestedOrderQty,
      receiptMatch,
      trendMatch,
      stockCountMatch,
      orderRules,
    }),
  };
}

function buildReceiptOnlyItem(line, stockCountLines) {
  const stockCountMatch = findBestStockCountMatch(line.itemName, stockCountLines);
  const approvedStockCount = numberOrNull(stockCountMatch?.line?.quantity);
  const receiptQuantity = numberOrNull(line.quantity);

  const currentStock =
    approvedStockCount !== null ? approvedStockCount : receiptQuantity;

  const stockSource =
    approvedStockCount !== null
      ? "Approved stock count"
      : receiptQuantity !== null
        ? "Last approved receipt quantity"
        : "Missing";

  return {
    id: `receipt-${line.id}`,
    itemName: line.itemName || "Receipt-backed item",
    normalizedItemName: line.normalizedItemName,
    currentStock,
    stockSource,
    parTarget: null,
    reorderPoint: null,
    estimatedDailyUsage: null,
    daysOfStockLeft: null,
    suggestedPar: null,
    suggestedOrderQty: null,
    reorderNeeded: false,
    status: "needs_setup",
    statusLabel: "Needs setup",
    recommendationType: approvedStockCount !== null ? "Count Seed" : "Receipt Seed",
    priority: approvedStockCount !== null ? 48 : receiptQuantity !== null ? 38 : 35,
    confidence:
      approvedStockCount !== null
        ? "Medium"
        : line.approved && !line.needsReview
          ? "Medium"
          : "Low",
    signals: [
      "Receipt-backed",
      approvedStockCount !== null ? "Approved count" : "",
      stockCountMatch?.confidence === "Exact" ? "Exact count match" : "",
      stockCountMatch?.confidence === "High" ? "Strong count match" : "",
      receiptQuantity !== null ? "Receipt quantity" : "",
      "Needs order rules",
    ].filter(Boolean),
    lastChecked: stockCountMatch?.line?.countTimeText || "",
    orderRules: {
      preferredVendor: line.vendor || "",
      vendorItemName: line.itemName || "",
      orderVendorSku: "",
      storageArea: stockCountMatch?.line?.storageArea || "",
      countUnit: stockCountMatch?.line?.unit || "",
      vendorOrderUnit: line.unit || "",
      packSize: line.packageSize || "",
      unitConversionNotes: "",
      safetyStock: null,
      leadTimeDays: null,
      orderDays: "",
      deliveryDays: "",
      vendorCutoffTime: "",
      criticalItem: false,
      emergencyRunRisk: false,
      eventSensitive: false,
    },
    receipt: line,
    receiptMatchScore: 1,
    receiptMatchConfidence: "Exact",
    receiptMatchType: "receipt_seed",
    receiptMatchNotes: "Receipt seed is its own source item and has not been attached to another order rule.",
    receiptMatchedOn: line.itemName,
    stockCount: stockCountMatch?.line || null,
    stockCountMatchScore: stockCountMatch?.score || 0,
    stockCountMatchConfidence: stockCountMatch?.confidence || "",
    stockCountMatchType: stockCountMatch?.type || "",
    stockCountMatchNotes: stockCountMatch?.notes || "",
    trend: null,
    trendMatchScore: 0,
    reason:
      approvedStockCount !== null
        ? `${line.itemName} exists in approved receipt history and now has an approved stock count of ${approvedStockCount}${
            stockCountMatch?.line?.unit ? ` ${stockCountMatch.line.unit}` : ""
          }. ${stockCountMatch?.notes || ""} Add target stock, reorder point, vendor order unit, and vendor order rules before trusting reorder guidance.`
        : `${line.itemName} exists in approved receipt history. Latest approved receipt quantity is ${
            receiptQuantity !== null ? receiptQuantity : "unknown"
          }${line.unit ? ` ${line.unit}` : ""}. Add count unit, target stock, reorder point, vendor order unit, and vendor order rules before trusting reorder guidance.`,
  };
}

function buildStockCountOnlyItem(line) {
  return {
    id: `stock-count-${line.id}`,
    itemName: line.itemName || "Counted item",
    normalizedItemName: line.normalizedItemName,
    currentStock: line.quantity,
    stockSource: "Approved stock count",
    parTarget: null,
    reorderPoint: null,
    estimatedDailyUsage: null,
    daysOfStockLeft: null,
    suggestedPar: null,
    suggestedOrderQty: null,
    reorderNeeded: false,
    status: "needs_setup",
    statusLabel: "Needs setup",
    recommendationType: "Count Seed",
    priority: 50,
    confidence: "Medium",
    signals: ["Approved count", "Count Seed", "Needs order rules"],
    lastChecked: line.countTimeText || "",
    orderRules: {
      preferredVendor: "",
      vendorItemName: "",
      orderVendorSku: "",
      storageArea: line.storageArea || "",
      countUnit: line.unit || "",
      vendorOrderUnit: "",
      packSize: "",
      unitConversionNotes: "",
      safetyStock: null,
      leadTimeDays: null,
      orderDays: "",
      deliveryDays: "",
      vendorCutoffTime: "",
      criticalItem: false,
      emergencyRunRisk: false,
      eventSensitive: false,
    },
    receipt: null,
    receiptMatchScore: 0,
    receiptMatchConfidence: "",
    receiptMatchType: "",
    receiptMatchNotes: "",
    receiptMatchedOn: "",
    stockCount: line,
    stockCountMatchScore: 1,
    stockCountMatchConfidence: "Count Seed",
    stockCountMatchType: "count_seed",
    stockCountMatchNotes:
      "Approved count did not safely match an existing order rule or receipt-backed item. Create or link an order rule before using it for reorder math.",
    trend: null,
    trendMatchScore: 0,
    reason: `${line.itemName} has an approved stock count of ${line.quantity}${
      line.unit ? ` ${line.unit}` : ""
    }${line.storageArea ? ` in ${line.storageArea}` : ""}. This approved count was not forced onto a fuzzy item match. Add or link an order-rule record with target stock and reorder point before KitchenPulse can calculate reorder pressure.`,
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
    const [parRecords, rawReceiptLines, rawTrends, rawStockCountLines] =
      await Promise.all([
        fetchAirtableTable(TABLES.parLevels, FIELD_SETS.parLevels),
        fetchAirtableTable(TABLES.vendorReceiptLines, FIELD_SETS.vendorReceiptLines),
        fetchAirtableTable(TABLES.weeklyItemTrends, FIELD_SETS.weeklyItemTrends).catch(
          () => []
        ),
        fetchAirtableTable(TABLES.stockCountLines, FIELD_SETS.stockCountLines).catch(
          () => []
        ),
      ]);

    const receiptLines = rawReceiptLines
      .map(buildReceiptLine)
      .filter((line) => line.itemName)
      .sort((a, b) =>
        String(b.createdTime || "").localeCompare(String(a.createdTime || ""))
      );

    const trustedReceiptLines = receiptLines.filter(
      (line) => line.approved === true && line.needsReview !== true
    );

    const trends = rawTrends.map(buildTrend).filter((trend) => trend.itemName);

    const approvedStockCountLines = rawStockCountLines
      .map(buildStockCountLine)
      .filter((line) => {
        return (
          line.itemName &&
          line.quantity !== null &&
          line.approvedForOrdering === true &&
          String(line.reviewState || "").toLowerCase() !== "rejected"
        );
      })
      .sort((a, b) =>
        String(b.createdTime || "").localeCompare(String(a.createdTime || ""))
      );

    const blankParRows = parRecords.filter((record) => {
      return !parRecordHasIdentity(record);
    }).length;

    const parItems = parRecords
      .filter(parRecordHasIdentity)
      .map((record) =>
        buildParItem(record, trustedReceiptLines, trends, approvedStockCountLines)
      );

    const parNames = parItems.map((item) => item.normalizedItemName);

    const receiptOnlyItems = trustedReceiptLines
      .filter((line) => {
        if (!line.itemName) return false;
        return !receiptLineIsSafelyCovered(line, parNames, parItems);
      })
      .slice(0, 40)
      .map((line) => buildReceiptOnlyItem(line, approvedStockCountLines));

    const coveredNames = [...parItems, ...receiptOnlyItems].map(
      (item) => item.normalizedItemName
    );

    const stockCountOnlyItems = approvedStockCountLines
      .filter((line) => {
        if (!line.itemName) return false;
        return !stockCountLineIsSafelyCovered(line, coveredNames);
      })
      .slice(0, 40)
      .map(buildStockCountOnlyItem);

    const items = [...parItems, ...receiptOnlyItems, ...stockCountOnlyItems]
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
      approvedStockCountLines: approvedStockCountLines.length,
      stockCountBackedItems: items.filter((item) => item.stockCount).length,
      stockCountAutoMatchedItems: items.filter((item) => {
        return item.stockCount && item.stockCountMatchType !== "count_seed";
      }).length,
      stockCountSeedItems: stockCountOnlyItems.length,
      stockCountGenericSeedItems: stockCountOnlyItems.filter((item) => {
        return isGenericOnlyName(item.itemName);
      }).length,
      receiptAutoMatchedItems: items.filter((item) => {
        return item.receipt && item.receiptMatchType !== "receipt_seed";
      }).length,
      receiptSeedItems: receiptOnlyItems.length,
      criticalItems: items.filter((item) => item.status === "critical").length,
      orderSoonItems: items.filter((item) => item.status === "order_soon").length,
      watchItems: items.filter((item) => item.status === "watch").length,
      stableItems: items.filter((item) => item.status === "stable").length,
      needsCountItems: items.filter((item) => item.status === "needs_count").length,
      needsSetupItems: items.filter((item) => item.status === "needs_setup").length,
      demandPressureItems: items.filter((item) => item.trend).length,
      criticalRuleItems: items.filter((item) => item.orderRules?.criticalItem).length,
      emergencyRiskItems: items.filter((item) => item.orderRules?.emergencyRunRisk)
        .length,
      eventSensitiveItems: items.filter((item) => item.orderRules?.eventSensitive)
        .length,
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
