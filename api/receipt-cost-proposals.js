const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID || "appD303evZM2SlvMR";

const AIRTABLE_TOKEN =
  process.env.AIRTABLE_TOKEN ||
  process.env.AIRTABLE_API_KEY ||
  process.env.AIRTABLE_PAT;

const RECEIPT_LINES_TABLE_ID = "tblbQ2BwFHbHFnOht";
const COST_PROPOSALS_TABLE_ID = "tblbdvzF3VUCQduj4";
const INVENTORY_ITEMS_TABLE_ID = "tblsWbZ1FJ92lqSo0";
const COST_SOURCE_ITEMS_TABLE_ID = "tblLSKZODdEi5X2un";
const COST_MOVEMENT_TABLE_ID = "tblGIXGxnNb9kJIQ0";
const MENU_ITEM_INGREDIENTS_TABLE_ID = "tbldpWvg1YHfuz2rq";

const LINE_FIELD = {
  lineName: "Line Name",
  receipt: "Receipt",
  restaurant: "Restaurant",
  vendor: "Vendor",
  lineItemName: "Line Item Name",
  matchedInventoryItem: "Matched Inventory Item",
  matchedCostSourceItem: "Matched Cost Source Item",
  category: "Category",
  quantity: "Quantity",
  unit: "Unit",
  packageSize: "Package Size",
  unitCost: "Unit Cost",
  lineTotal: "Line Total",
  confidence: "Confidence",
  needsReview: "Needs Review",
  approved: "Approved",
  rawLineText: "Raw Line Text",
  notes: "Notes",
};

const PROPOSAL_FIELD = {
  proposalName: "Proposal Name",
  receiptLine: "Receipt Line",
  matchedInventoryItem: "Matched Inventory Item",
  matchedCostSourceItem: "Matched Cost Source Item",
  vendor: "Vendor",
  parsedItemName: "Parsed Item Name",
  currentCost: "Current Cost",
  proposedCost: "Proposed Cost",
  changePercent: "Change Percent",
  proposalStatus: "Proposal Status",
  approved: "Approved",
  applied: "Applied",
  proposalReason: "Proposal Reason",
  notes: "Notes",
};

const INVENTORY_FIELD = {
  ingredientName: "Ingredient Name",
  supplier: "Supplier",
  costPerUnit: "Cost per Unit",
  restaurant: "Restaurant",
};

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

const MENU_COMPONENT_FIELD = {
  componentName: "Component Name",
  restaurant: "Restaurant",
  menuItem: "Menu Item",
  inventoryItem: "Inventory Item",
  costSourceItem: "Cost Source Item",
  includeInMenuCost: "Include in Menu Cost",
  active: "Active",
};

const COST_MOVEMENT_FIELD = {
  movementName: "Movement Name",
  restaurant: "Restaurant",
  sourceCostProposal: "Source Cost Proposal",
  receiptLine: "Receipt Line",
  inventoryItem: "Inventory Item",
  costSourceItem: "Cost Source Item",
  relatedMenuItems: "Related Menu Items",
  relatedMenuComponents: "Related Menu Components",
  vendor: "Vendor",
  costItemName: "Cost Item Name",
  vendorLineName: "Vendor Line Name",
  previousCost: "Previous Cost",
  latestCost: "Latest Cost",
  costChangeAmount: "Cost Change $",
  costChangePercent: "Cost Change %",
  direction: "Direction",
  severity: "Severity",
  reviewStatus: "Review Status",
  signalDate: "Signal Date",
  latestReceiptDate: "Latest Receipt Date",
  isLatest: "Is Latest",
  showOnWhatChanged: "Show on What Changed",
  showOnHome: "Show on Home",
  decisionEligible: "Decision Eligible",
  marginPressure: "Margin Pressure",
  suggestedAction: "Suggested Action",
  formattedCostBrief: "Formatted Cost Brief",
  notes: "Notes",
};

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
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

function airtableRecordUrl(tableId, recordId) {
  return `${airtableTableUrl(tableId)}/${recordId}`;
}

async function airtableRequest({ method = "GET", tableId, recordId, body }) {
  requireAirtableConfig();

  const response = await fetch(
    recordId ? airtableRecordUrl(tableId, recordId) : airtableTableUrl(tableId),
    {
      method,
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    }
  );

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    console.error("Airtable returned non-JSON:", text);
    throw new Error("Airtable returned a non-JSON response.");
  }

  if (!response.ok) {
    console.error("Airtable request failed:", data);
    throw new Error(
      data?.error?.message ||
        data?.error ||
        `Airtable request failed with status ${response.status}.`
    );
  }

  return data;
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
    } catch (error) {
      console.error("Airtable list returned non-JSON:", text);
      throw new Error("Airtable list returned a non-JSON response.");
    }

    if (!response.ok) {
      console.error("Airtable list failed:", data);
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

function linkedIds(value) {
  return Array.isArray(value) ? value : [];
}

function firstLinkedId(value) {
  const ids = linkedIds(value);
  return ids.length ? ids[0] : "";
}

function asNumberOrNull(value) {
  if (value === "" || value === null || typeof value === "undefined") return null;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
}

function money(value) {
  const numberValue = asNumberOrNull(value);
  if (numberValue === null) return "unknown";
  return numberValue.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function calculateChangePercent(currentCost, proposedCost) {
  const current = asNumberOrNull(currentCost);
  const proposed = asNumberOrNull(proposedCost);
  if (current === null || proposed === null || current === 0) return null;
  return (proposed - current) / current;
}

function isAlreadyCurrentCost(currentCost, proposedCost) {
  const current = asNumberOrNull(currentCost);
  const proposed = asNumberOrNull(proposedCost);
  if (current === null || proposed === null) return false;
  return Math.abs(current - proposed) < 0.01;
}

function isMeaningfulCostChange(currentCost, proposedCost) {
  const current = asNumberOrNull(currentCost);
  const proposed = asNumberOrNull(proposedCost);
  if (proposed === null || proposed <= 0) return false;
  if (current === null) return true;
  return Math.abs(current - proposed) >= 0.01;
}

function getProposedCostFromLineRecord(record) {
  const fields = record.fields || {};
  const unitCost = asNumberOrNull(fields[LINE_FIELD.unitCost]);
  const lineTotal = asNumberOrNull(fields[LINE_FIELD.lineTotal]);
  const quantity = asNumberOrNull(fields[LINE_FIELD.quantity]);

  if (unitCost !== null && unitCost > 0) return unitCost;
  if (lineTotal !== null && quantity !== null && quantity > 0) return lineTotal / quantity;
  if (lineTotal !== null && lineTotal > 0) return lineTotal;
  return null;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  return normalized
    .split(" ")
    .filter((token) => token.length >= 2)
    .filter(
      (token) =>
        ![
          "the",
          "and",
          "for",
          "with",
          "only",
          "fresh",
          "sys",
          "imp",
          "brl",
          "cls",
          "cs",
          "lb",
          "oz",
          "pk",
          "avg",
          "jmb",
          "rnd",
        ].includes(token)
    );
}

function scoreNameMatch(sourceName, targetName) {
  const source = normalizeText(sourceName);
  const target = normalizeText(targetName);
  if (!source || !target) return 0;
  if (source === target) return 100;
  if (source.includes(target) || target.includes(source)) return 82;

  const sourceTokens = tokenize(source);
  const targetTokens = tokenize(target);
  if (sourceTokens.length === 0 || targetTokens.length === 0) return 0;

  const targetSet = new Set(targetTokens);
  const overlap = sourceTokens.filter((token) => targetSet.has(token)).length;
  const union = new Set([...sourceTokens, ...targetTokens]).size;
  const jaccard = union > 0 ? overlap / union : 0;
  const coverage = overlap / sourceTokens.length;

  return Math.round(jaccard * 65 + coverage * 35);
}

function scoreVendorMatch(sourceVendor, targetSupplier) {
  const source = normalizeText(sourceVendor);
  const target = normalizeText(targetSupplier);
  if (!source || !target) return 0;
  if (source === target) return 18;
  if (source.includes(target) || target.includes(source)) return 14;

  const sourceTokens = tokenize(source);
  const targetTokens = tokenize(target);
  const targetSet = new Set(targetTokens);
  const overlap = sourceTokens.filter((token) => targetSet.has(token)).length;
  return overlap > 0 ? 8 : 0;
}

function getRecordCreatedTimeMs(record) {
  const created = new Date(record?.createdTime || 0).getTime();
  return Number.isNaN(created) ? 0 : created;
}

function getSuggestionDedupeKey(suggestion) {
  const targetType = suggestion.targetType || "";
  const name = normalizeText(suggestion.name || "");

  // Collapse duplicate-looking matches aggressively for the operator UI.
  // If two Cost Source Items have the same normalized name, only show one.
  // This prevents dropdowns from filling with old/test/current variants of the same vendor item.
  return [targetType, name].join("|");
}

function suggestionHasCurrentCost(suggestion) {
  return asNumberOrNull(suggestion.currentCost) !== null;
}

function compareMatchSuggestions(a, b) {
  if (b.score !== a.score) return b.score - a.score;

  if ((b.vendorScore || 0) !== (a.vendorScore || 0)) {
    return (b.vendorScore || 0) - (a.vendorScore || 0);
  }

  if ((b.nameScore || 0) !== (a.nameScore || 0)) {
    return (b.nameScore || 0) - (a.nameScore || 0);
  }

  const aHasMeaningfulDelta = Boolean(a.hasMeaningfulDelta);
const bHasMeaningfulDelta = Boolean(b.hasMeaningfulDelta);

if (aHasMeaningfulDelta !== bHasMeaningfulDelta) {
  return bHasMeaningfulDelta ? 1 : -1;
}

const aHasCost = suggestionHasCurrentCost(a);
const bHasCost = suggestionHasCurrentCost(b);

if (aHasCost !== bHasCost) return bHasCost ? 1 : -1;

// When duplicate records are otherwise identical, prefer the newest record.
if ((b.createdTimeMs || 0) !== (a.createdTimeMs || 0)) {
  return (b.createdTimeMs || 0) - (a.createdTimeMs || 0);
}

  return String(a.name || "").localeCompare(String(b.name || ""));
}

function dedupeMatchSuggestions(suggestions) {
  const groups = new Map();

  for (const suggestion of suggestions) {
    const key = getSuggestionDedupeKey(suggestion);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(suggestion);
  }

  return [...groups.values()].map((group) => {
    const sortedGroup = [...group].sort(compareMatchSuggestions);
    const winner = sortedGroup[0];

    return {
      ...winner,
      hiddenDuplicateCount: Math.max(0, group.length - 1),
      hiddenDuplicateRecordIds: sortedGroup.slice(1).map((item) => item.recordId),
    };
  });
}



  
function getCostSourceCurrentCost(record) {
  if (!record) return null;
  const fields = record.fields || {};

  return (
    asNumberOrNull(fields[COST_SOURCE_FIELD.unitPrice]) ??
    asNumberOrNull(fields[COST_SOURCE_FIELD.finalPrice]) ??
    asNumberOrNull(fields[COST_SOURCE_FIELD.price])
  );
}

function getInventoryCurrentCost(record) {
  if (!record) return null;
  const fields = record.fields || {};
  return asNumberOrNull(fields[INVENTORY_FIELD.costPerUnit]);
}

function normalizeLineRecord(record) {
  const fields = record.fields || {};

  return {
    id: record.id,
    createdTime: record.createdTime,
    lineName: fields[LINE_FIELD.lineName] || "",
    receiptIds: linkedIds(fields[LINE_FIELD.receipt]),
    receiptId: firstLinkedId(fields[LINE_FIELD.receipt]),
    restaurantIds: linkedIds(fields[LINE_FIELD.restaurant]),
    vendor: fields[LINE_FIELD.vendor] || "",
    lineItemName: fields[LINE_FIELD.lineItemName] || "",
    matchedInventoryItemIds: linkedIds(fields[LINE_FIELD.matchedInventoryItem]),
    matchedCostSourceItemIds: linkedIds(fields[LINE_FIELD.matchedCostSourceItem]),
    category: fields[LINE_FIELD.category] || "",
    quantity: asNumberOrNull(fields[LINE_FIELD.quantity]),
    unit: fields[LINE_FIELD.unit] || "",
    packageSize: fields[LINE_FIELD.packageSize] || "",
    unitCost: asNumberOrNull(fields[LINE_FIELD.unitCost]),
    lineTotal: asNumberOrNull(fields[LINE_FIELD.lineTotal]),
    confidence: fields[LINE_FIELD.confidence] || "",
    needsReview: Boolean(fields[LINE_FIELD.needsReview]),
    approved: Boolean(fields[LINE_FIELD.approved]),
    rawLineText: fields[LINE_FIELD.rawLineText] || "",
    notes: fields[LINE_FIELD.notes] || "",
  };
}

function normalizeProposalRecord(record, matchSuggestions = []) {
  const fields = record.fields || {};

  const matchedInventoryItemIds = linkedIds(
    fields[PROPOSAL_FIELD.matchedInventoryItem]
  );
  const matchedCostSourceItemIds = linkedIds(
    fields[PROPOSAL_FIELD.matchedCostSourceItem]
  );

  const currentCost = asNumberOrNull(fields[PROPOSAL_FIELD.currentCost]);
  const proposedCost = asNumberOrNull(fields[PROPOSAL_FIELD.proposedCost]);

  const approved = Boolean(fields[PROPOSAL_FIELD.approved]);
  const applied = Boolean(fields[PROPOSAL_FIELD.applied]);
  const hasMatch =
    matchedInventoryItemIds.length > 0 || matchedCostSourceItemIds.length > 0;

  const proposalStatus =
    fields[PROPOSAL_FIELD.proposalStatus] || "Needs Review";

  const alreadyCurrent = isAlreadyCurrentCost(currentCost, proposedCost);
  const meaningfulChange = isMeaningfulCostChange(currentCost, proposedCost);

  return {
    id: record.id,
    createdTime: record.createdTime,

    proposalName: fields[PROPOSAL_FIELD.proposalName] || "",
    receiptLineIds: linkedIds(fields[PROPOSAL_FIELD.receiptLine]),
    receiptLineId: firstLinkedId(fields[PROPOSAL_FIELD.receiptLine]),

    matchedInventoryItemIds,
    matchedCostSourceItemIds,

    vendor: fields[PROPOSAL_FIELD.vendor] || "",
    parsedItemName: fields[PROPOSAL_FIELD.parsedItemName] || "",

    currentCost,
    proposedCost,
    changePercent: asNumberOrNull(fields[PROPOSAL_FIELD.changePercent]),

    proposalStatus,
    approved,
    applied,

    proposalReason: fields[PROPOSAL_FIELD.proposalReason] || "",
    notes: fields[PROPOSAL_FIELD.notes] || "",

    hasMatch,
    alreadyCurrent,
    meaningfulChange,
    matchSuggestions,

    canApprove:
      proposalStatus === "Needs Review" &&
      hasMatch &&
      meaningfulChange &&
      !alreadyCurrent,

    canApply:
      approved &&
      !applied &&
      hasMatch &&
      meaningfulChange &&
      !alreadyCurrent &&
      proposalStatus === "Approved",
  };
}

function buildProposalCounts(proposals) {
  return {
    total: proposals.length,
    needsReview: proposals.filter(
      (proposal) =>
        proposal.proposalStatus === "Needs Review" && !proposal.alreadyCurrent
    ).length,
    approved: proposals.filter(
      (proposal) => proposal.proposalStatus === "Approved"
    ).length,
    rejected: proposals.filter(
      (proposal) => proposal.proposalStatus === "Rejected"
    ).length,
    applied: proposals.filter(
      (proposal) => proposal.proposalStatus === "Applied"
    ).length,
    blocked: proposals.filter((proposal) => {
      const hasMatch =
        proposal.matchedInventoryItemIds.length > 0 ||
        proposal.matchedCostSourceItemIds.length > 0;

      return (
        !hasMatch &&
        proposal.proposalStatus !== "Rejected" &&
        proposal.proposalStatus !== "Applied"
      );
    }).length,
    alreadyCurrent: proposals.filter((proposal) => proposal.alreadyCurrent)
      .length,
  };
}

function getTargetName({ inventoryRecord, costSourceRecord }) {
  const inventoryName =
    inventoryRecord?.fields?.[INVENTORY_FIELD.ingredientName] || "";
  const costSourceName =
    costSourceRecord?.fields?.[COST_SOURCE_FIELD.sourceItemName] || "";

  return inventoryName || costSourceName || "";
}

function buildProposalReason({
  line,
  currentCost,
  proposedCost,
  inventoryRecord,
  costSourceRecord,
}) {
  const targetName = getTargetName({ inventoryRecord, costSourceRecord });

  if (!targetName) {
    return [
      "Approved receipt line is ready for cost signal review, but it is not matched to an Inventory Item or Cost Source Item yet.",
      `Parsed item: ${line.lineItemName || "Unnamed line"}.`,
      `Receipt cost: ${money(proposedCost)}.`,
      "Match this line before tracking any cost signal.",
    ].join(" ");
  }

  if (currentCost === null) {
    return [
      `Approved receipt line matched to ${targetName}.`,
      `KitchenPulse does not have a current cost for this target yet.`,
      `Receipt cost: ${money(proposedCost)}.`,
    ].join(" ");
  }

  const changePercent = calculateChangePercent(currentCost, proposedCost);

  if (changePercent === null) {
    return [
      `Approved receipt line matched to ${targetName}.`,
      `Current cost: ${money(currentCost)}.`,
      `Receipt cost: ${money(proposedCost)}.`,
    ].join(" ");
  }

  const direction = changePercent >= 0 ? "increase" : "decrease";
  const percentText = Math.abs(changePercent).toLocaleString("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return [
    `Approved receipt line matched to ${targetName}.`,
    `Current cost is ${money(currentCost)} and receipt cost is ${money(
      proposedCost
    )}.`,
    `This is a ${percentText} ${direction}.`,
  ].join(" ");
}

async function getRecordCached({ tableId, recordId, cache }) {
  if (!recordId) return null;

  const key = `${tableId}:${recordId}`;

  if (cache.has(key)) return cache.get(key);

  const record = await airtableRequest({
    method: "GET",
    tableId,
    recordId,
  });

  cache.set(key, record);
  return record;
}

async function getMatchData() {
  const [inventoryRecords, costSourceRecords] = await Promise.all([
    listAirtableRecords({
      tableId: INVENTORY_ITEMS_TABLE_ID,
      fields: [
        INVENTORY_FIELD.ingredientName,
        INVENTORY_FIELD.supplier,
        INVENTORY_FIELD.costPerUnit,
        INVENTORY_FIELD.restaurant,
      ],
      pageSize: 100,
    }),
    listAirtableRecords({
      tableId: COST_SOURCE_ITEMS_TABLE_ID,
      fields: [
        COST_SOURCE_FIELD.sourceItemName,
        COST_SOURCE_FIELD.supplier,
        COST_SOURCE_FIELD.sku,
        COST_SOURCE_FIELD.category,
        COST_SOURCE_FIELD.unit,
        COST_SOURCE_FIELD.price,
        COST_SOURCE_FIELD.unitPrice,
        COST_SOURCE_FIELD.finalPrice,
      ],
      pageSize: 100,
    }),
  ]);

  return {
    inventoryRecords,
    costSourceRecords,
  };
}

function buildMatchSuggestionsForProposal({
  proposal,
  inventoryRecords,
  costSourceRecords,
}) {
  const parsedItemName = proposal.parsedItemName || proposal.proposalName || "";
  const vendor = proposal.vendor || "";
  const proposedCost = asNumberOrNull(proposal.proposedCost);
  const suggestions = [];

  for (const record of inventoryRecords) {
    const fields = record.fields || {};
    const name = fields[INVENTORY_FIELD.ingredientName] || "";
    const supplier = fields[INVENTORY_FIELD.supplier] || "";
    const currentCost = getInventoryCurrentCost(record);

    const nameScore = scoreNameMatch(parsedItemName, name);
    const vendorScore = scoreVendorMatch(vendor, supplier);
    const score = Math.min(100, nameScore + vendorScore);

    if (score < 25) continue;

    suggestions.push({
  targetType: "inventory",
  recordId: record.id,
  name,
  supplier,
  unit: "",
  currentCost,
  costDeltaAbs:
    currentCost !== null && proposedCost !== null
      ? Math.abs(currentCost - proposedCost)
      : null,
  hasMeaningfulDelta:
    currentCost !== null && proposedCost !== null
      ? Math.abs(currentCost - proposedCost) >= 0.01
      : true,
  score,
  nameScore,
  vendorScore,
      createdTime: record.createdTime || "",
      createdTimeMs: getRecordCreatedTimeMs(record),
      reason:
        score >= 85
          ? "Strong name/vendor match"
          : score >= 60
          ? "Likely item match"
          : "Possible item match",
    });
  }

  for (const record of costSourceRecords) {
    const fields = record.fields || {};
    const name = fields[COST_SOURCE_FIELD.sourceItemName] || "";
    const supplier = fields[COST_SOURCE_FIELD.supplier] || "";
    const sku = fields[COST_SOURCE_FIELD.sku] || "";
    const category = fields[COST_SOURCE_FIELD.category] || "";
    const unit = fields[COST_SOURCE_FIELD.unit] || "";
    const currentCost = getCostSourceCurrentCost(record);

    const nameScore = scoreNameMatch(parsedItemName, name);
    const vendorScore = scoreVendorMatch(vendor, supplier);
    const score = Math.min(100, nameScore + vendorScore);

    if (score < 25) continue;

    suggestions.push({
  targetType: "cost_source",
  recordId: record.id,
  name,
  supplier,
  sku,
  category,
  unit,
  currentCost,
  costDeltaAbs:
    currentCost !== null && proposedCost !== null
      ? Math.abs(currentCost - proposedCost)
      : null,
  hasMeaningfulDelta:
    currentCost !== null && proposedCost !== null
      ? Math.abs(currentCost - proposedCost) >= 0.01
      : true,
  score,
  nameScore,
  vendorScore,
      createdTime: record.createdTime || "",
      createdTimeMs: getRecordCreatedTimeMs(record),
      reason:
        score >= 85
          ? "Strong cost source match"
          : score >= 60
          ? "Likely cost source match"
          : "Possible cost source match",
    });
  }

  const sorted = dedupeMatchSuggestions(suggestions).sort(compareMatchSuggestions);

  const hasStrongMatch = sorted.some((suggestion) => suggestion.score >= 80);
  const hasLikelyMatch = sorted.some((suggestion) => suggestion.score >= 55);

  if (hasStrongMatch) {
    return sorted.filter((suggestion) => suggestion.score >= 80).slice(0, 5);
  }

  if (hasLikelyMatch) {
    return sorted.filter((suggestion) => suggestion.score >= 55).slice(0, 5);
  }

  return sorted.slice(0, 3);
}

function getProposalRecordStatus(record) {
  const fields = record.fields || {};
  return fields[PROPOSAL_FIELD.proposalStatus] || "Needs Review";
}

function getProposalRecordReceiptLineId(record) {
  const fields = record.fields || {};
  return firstLinkedId(fields[PROPOSAL_FIELD.receiptLine]);
}

function getProposalRecordCreatedTime(record) {
  const created = new Date(record.createdTime || 0).getTime();
  return Number.isNaN(created) ? 0 : created;
}

function hasProposalRecordMatch(record) {
  const fields = record.fields || {};

  return (
    linkedIds(fields[PROPOSAL_FIELD.matchedInventoryItem]).length > 0 ||
    linkedIds(fields[PROPOSAL_FIELD.matchedCostSourceItem]).length > 0
  );
}

function rankProposalRecordForDisplay(record) {
  const status = getProposalRecordStatus(record);
  const hasMatch = hasProposalRecordMatch(record);

  if (status === "Applied") return 1000;
  if (status === "Approved" && hasMatch) return 900;
  if (status === "Needs Review" && hasMatch) return 800;
  if (status === "Approved") return 700;
  if (status === "Needs Review") return 600;
  if (status === "Rejected") return 100;

  return 0;
}

function getCanonicalProposalRecords(records) {
  const groups = new Map();
  const unlinked = [];

  for (const record of records) {
    const receiptLineId = getProposalRecordReceiptLineId(record);

    if (!receiptLineId) {
      unlinked.push(record);
      continue;
    }

    if (!groups.has(receiptLineId)) groups.set(receiptLineId, []);
    groups.get(receiptLineId).push(record);
  }

  const canonical = [...unlinked];

  for (const groupRecords of groups.values()) {
    const sortedGroup = [...groupRecords].sort((a, b) => {
      const rankDiff =
        rankProposalRecordForDisplay(b) - rankProposalRecordForDisplay(a);

      if (rankDiff !== 0) return rankDiff;

      return getProposalRecordCreatedTime(b) - getProposalRecordCreatedTime(a);
    });

    canonical.push(sortedGroup[0]);
  }

  return canonical;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function percentText(value) {
  const numberValue = asNumberOrNull(value);
  if (numberValue === null) return "unknown";

  return Math.abs(numberValue).toLocaleString("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function getCostMovementDirection(changePercent) {
  const value = asNumberOrNull(changePercent);
  if (value === null || Math.abs(value) < 0.0001) return "Flat";
  return value > 0 ? "Increase" : "Decrease";
}

function getCostMovementSeverity(changePercent) {
  const value = Math.abs(asNumberOrNull(changePercent) || 0);
  if (value >= 0.15) return "High";
  if (value >= 0.08) return "Medium";
  if (value >= 0.03) return "Low";
  return "Watch";
}

function buildCostMovementMarginPressure({ itemName, vendor, changePercent }) {
  const direction = getCostMovementDirection(changePercent);
  const pct = percentText(changePercent);

  if (direction === "Increase") {
    return `${itemName} increased ${pct} from ${
      vendor || "the latest vendor receipt"
    }. This may pressure margin if menu price, portioning, or vendor terms stay unchanged.`;
  }

  if (direction === "Decrease") {
    return `${itemName} decreased ${pct} from ${
      vendor || "the latest vendor receipt"
    }. This may create margin room or support a feature if demand is there.`;
  }

  return `${itemName} was tracked from approved receipt data. No major cost movement is showing yet.`;
}

function buildCostMovementSuggestedAction({ changePercent }) {
  const direction = getCostMovementDirection(changePercent);
  const severity = getCostMovementSeverity(changePercent);

  if (direction === "Increase" && severity === "High") {
    return "Review menu price, portioning, vendor pricing, or whether this item should be featured before pushing affected menu items harder.";
  }

  if (direction === "Increase") {
    return "Watch this cost and review margin if the affected item is high-volume or already being promoted.";
  }

  if (direction === "Decrease") {
    return "Consider whether the lower cost creates room for a feature, margin improvement, or vendor negotiation benchmark.";
  }

  return "Keep tracking this item and compare against the next approved receipt.";
}
function buildCostMovementBrief({
  itemName,
  vendor,
  previousCost,
  latestCost,
  changePercent,
}) {
  const direction = getCostMovementDirection(changePercent);
  const pct = percentText(changePercent);

  if (direction === "Increase") {
    return `${itemName} cost is up ${pct}. Latest receipt shows ${money(
      latestCost
    )} vs ${money(previousCost)} previously from ${
      vendor || "the vendor"
    }. Review margin, portioning, pricing, or vendor terms.`;
  }

  if (direction === "Decrease") {
    return `${itemName} cost is down ${pct}. Latest receipt shows ${money(
      latestCost
    )} vs ${money(previousCost)} previously from ${
      vendor || "the vendor"
    }. This may improve margin or support a feature.`;
  }

  return `${itemName} was tracked from approved receipt data with no major cost movement.`;
}

function uniqueIds(ids) {
  return [...new Set((ids || []).filter(Boolean))];
}

async function findRelatedMenuContext({ inventoryItemId, costSourceItemId }) {
  if (!inventoryItemId && !costSourceItemId) {
    return {
      componentIds: [],
      menuItemIds: [],
    };
  }

  const componentRecords = await listAirtableRecords({
    tableId: MENU_ITEM_INGREDIENTS_TABLE_ID,
    fields: Object.values(MENU_COMPONENT_FIELD),
    pageSize: 100,
  });

  const matchedComponents = componentRecords.filter((record) => {
    const fields = record.fields || {};

    if (fields[MENU_COMPONENT_FIELD.active] === false) return false;
    if (fields[MENU_COMPONENT_FIELD.includeInMenuCost] === false) return false;

    const inventoryIds = linkedIds(fields[MENU_COMPONENT_FIELD.inventoryItem]);
    const costSourceIds = linkedIds(fields[MENU_COMPONENT_FIELD.costSourceItem]);

    return (
      (inventoryItemId && inventoryIds.includes(inventoryItemId)) ||
      (costSourceItemId && costSourceIds.includes(costSourceItemId))
    );
  });

  return {
    componentIds: uniqueIds(matchedComponents.map((record) => record.id)),
    menuItemIds: uniqueIds(
      matchedComponents.flatMap((record) =>
        linkedIds(record.fields?.[MENU_COMPONENT_FIELD.menuItem])
      )
    ),
  };
}

async function markOlderCostMovementsNotLatest({
  inventoryItemId,
  costSourceItemId,
  currentMovementId,
}) {
  const movementRecords = await listAirtableRecords({
    tableId: COST_MOVEMENT_TABLE_ID,
    fields: [
      COST_MOVEMENT_FIELD.inventoryItem,
      COST_MOVEMENT_FIELD.costSourceItem,
      COST_MOVEMENT_FIELD.isLatest,
    ],
    pageSize: 100,
  });

  const recordsToUpdate = movementRecords
    .filter((record) => record.id !== currentMovementId)
    .filter((record) => {
      const fields = record.fields || {};
      const inventoryIds = linkedIds(fields[COST_MOVEMENT_FIELD.inventoryItem]);
      const costSourceIds = linkedIds(fields[COST_MOVEMENT_FIELD.costSourceItem]);

      return (
        (inventoryItemId && inventoryIds.includes(inventoryItemId)) ||
        (costSourceItemId && costSourceIds.includes(costSourceItemId))
      );
    })
    .filter((record) => Boolean(record.fields?.[COST_MOVEMENT_FIELD.isLatest]))
    .map((record) => ({
      id: record.id,
      fields: {
        [COST_MOVEMENT_FIELD.isLatest]: false,
      },
    }));

  for (let index = 0; index < recordsToUpdate.length; index += 10) {
    const batch = recordsToUpdate.slice(index, index + 10);

    if (batch.length === 0) continue;

    await airtableRequest({
      method: "PATCH",
      tableId: COST_MOVEMENT_TABLE_ID,
      body: {
        records: batch,
      },
    });
  }
}

async function createCostMovementFromAppliedProposal({
  updatedProposalRecord,
  proposal,
  targetUpdates,
}) {
  const receiptLineId = proposal.receiptLineId || "";
  const inventoryItemId = proposal.matchedInventoryItemIds[0] || "";
  const costSourceItemId = proposal.matchedCostSourceItemIds[0] || "";

  const lineRecord = receiptLineId
    ? await airtableRequest({
        method: "GET",
        tableId: RECEIPT_LINES_TABLE_ID,
        recordId: receiptLineId,
      })
    : null;

  const line = lineRecord ? normalizeLineRecord(lineRecord) : null;

  const appliedUpdate =
    targetUpdates.find((update) => !update.skipped) || targetUpdates[0] || {};

  const previousCost =
    asNumberOrNull(appliedUpdate.previousValue) ?? proposal.currentCost;
  const latestCost = proposal.proposedCost;
  const changeAmount =
    previousCost !== null && latestCost !== null ? latestCost - previousCost : null;
  const changePercent = calculateChangePercent(previousCost, latestCost);

  const itemName =
    proposal.parsedItemName ||
    line?.lineItemName ||
    proposal.proposalName ||
    "Tracked cost item";

  const vendor = proposal.vendor || line?.vendor || "";
  const direction = getCostMovementDirection(changePercent);
  const severity = getCostMovementSeverity(changePercent);
  const signalDate = todayIsoDate();

  const relatedContext = await findRelatedMenuContext({
    inventoryItemId,
    costSourceItemId,
  });

  const movementName = `${itemName} cost ${
    direction === "Increase"
      ? "up"
      : direction === "Decrease"
      ? "down"
      : "tracked"
  } ${percentText(changePercent)} — ${vendor || "Vendor"} — ${signalDate}`;

  const fields = {
    [COST_MOVEMENT_FIELD.movementName]: movementName,
    [COST_MOVEMENT_FIELD.sourceCostProposal]: [updatedProposalRecord.id],
    [COST_MOVEMENT_FIELD.vendor]: vendor,
    [COST_MOVEMENT_FIELD.costItemName]: itemName,
    [COST_MOVEMENT_FIELD.vendorLineName]: line?.lineItemName || itemName,
    [COST_MOVEMENT_FIELD.latestCost]: latestCost,
    [COST_MOVEMENT_FIELD.direction]: direction,
    [COST_MOVEMENT_FIELD.severity]: severity,
    [COST_MOVEMENT_FIELD.reviewStatus]: "Active",
    [COST_MOVEMENT_FIELD.signalDate]: signalDate,
    [COST_MOVEMENT_FIELD.latestReceiptDate]: signalDate,
    [COST_MOVEMENT_FIELD.isLatest]: true,
    [COST_MOVEMENT_FIELD.showOnWhatChanged]: true,
    [COST_MOVEMENT_FIELD.showOnHome]:
      severity === "High" && direction === "Increase",
    [COST_MOVEMENT_FIELD.decisionEligible]: true,
    [COST_MOVEMENT_FIELD.marginPressure]: buildCostMovementMarginPressure({
      itemName,
      vendor,
      changePercent,
    }),
    [COST_MOVEMENT_FIELD.suggestedAction]: buildCostMovementSuggestedAction({
      changePercent,
    }),
    [COST_MOVEMENT_FIELD.formattedCostBrief]: buildCostMovementBrief({
      itemName,
      vendor,
      previousCost,
      latestCost,
      changePercent,
    }),
    [COST_MOVEMENT_FIELD.notes]:
      "Generated automatically when a Receipt Cost Proposal was tracked/applied.",
  };

  if (line?.restaurantIds?.length) {
    fields[COST_MOVEMENT_FIELD.restaurant] = line.restaurantIds;
  }

  if (receiptLineId) {
    fields[COST_MOVEMENT_FIELD.receiptLine] = [receiptLineId];
  }

  if (inventoryItemId) {
    fields[COST_MOVEMENT_FIELD.inventoryItem] = [inventoryItemId];
  }

  if (costSourceItemId) {
    fields[COST_MOVEMENT_FIELD.costSourceItem] = [costSourceItemId];
  }

  if (relatedContext.menuItemIds.length) {
    fields[COST_MOVEMENT_FIELD.relatedMenuItems] = relatedContext.menuItemIds;
  }

  if (relatedContext.componentIds.length) {
    fields[COST_MOVEMENT_FIELD.relatedMenuComponents] =
      relatedContext.componentIds;
  }

  if (previousCost !== null) {
    fields[COST_MOVEMENT_FIELD.previousCost] = previousCost;
  }

  if (changeAmount !== null) {
    fields[COST_MOVEMENT_FIELD.costChangeAmount] = changeAmount;
  }

  if (changePercent !== null) {
    fields[COST_MOVEMENT_FIELD.costChangePercent] = changePercent;
  }

  const created = await airtableRequest({
    method: "POST",
    tableId: COST_MOVEMENT_TABLE_ID,
    body: {
      records: [
        {
          fields,
        },
      ],
      typecast: true,
    },
  });

  const createdRecord = created.records?.[0] || null;

  if (createdRecord) {
    await markOlderCostMovementsNotLatest({
      inventoryItemId,
      costSourceItemId,
      currentMovementId: createdRecord.id,
    });
  }

  return createdRecord;
}

async function listProposals(req, res) {
  const includeHistory =
    String(req.query?.includeHistory || "").toLowerCase() === "true";

  const proposalRecordsRaw = await listAirtableRecords({
    tableId: COST_PROPOSALS_TABLE_ID,
    fields: Object.values(PROPOSAL_FIELD),
    pageSize: 100,
  });

  const proposalRecords = includeHistory
    ? proposalRecordsRaw
    : getCanonicalProposalRecords(proposalRecordsRaw);

  const baseProposals = proposalRecords.map((record) =>
    normalizeProposalRecord(record)
  );

  const needsSuggestions = baseProposals.some(
    (proposal) =>
      !proposal.hasMatch &&
      proposal.proposalStatus !== "Rejected" &&
      proposal.proposalStatus !== "Applied"
  );

  let inventoryRecords = [];
  let costSourceRecords = [];

  if (needsSuggestions) {
    const matchData = await getMatchData();
    inventoryRecords = matchData.inventoryRecords;
    costSourceRecords = matchData.costSourceRecords;
  }

  const proposals = proposalRecords
    .map((record) => {
      const proposal = normalizeProposalRecord(record);

      const matchSuggestions =
        !proposal.hasMatch &&
        proposal.proposalStatus !== "Rejected" &&
        proposal.proposalStatus !== "Applied"
          ? buildMatchSuggestionsForProposal({
              proposal,
              inventoryRecords,
              costSourceRecords,
            })
          : [];

      return normalizeProposalRecord(record, matchSuggestions);
    })
    .sort((a, b) => {
      const statusRank = {
        Approved: 1,
        "Needs Review": 2,
        Applied: 3,
        Rejected: 4,
      };

      const aRank = statusRank[a.proposalStatus] || 99;
      const bRank = statusRank[b.proposalStatus] || 99;

      if (a.alreadyCurrent !== b.alreadyCurrent) {
        return a.alreadyCurrent ? 1 : -1;
      }

      if (aRank !== bRank) return aRank - bRank;

      return String(a.parsedItemName || a.proposalName).localeCompare(
        String(b.parsedItemName || b.proposalName)
      );
    });

  return sendJson(res, 200, {
    ok: true,
    counts: buildProposalCounts(proposals),
    proposals,
    hiddenDuplicateCount: includeHistory
      ? 0
      : Math.max(0, proposalRecordsRaw.length - proposalRecords.length),
  });
}

function titleCaseItemName(value) {
  return String(value || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 2 && ["oz", "lb", "qt", "cs", "ct"].includes(word)) {
        return word;
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function friendlyVendorItemName(value, category = "") {
  const raw = String(value || "").trim();

  if (!raw) return "";

  const upper = raw.toUpperCase();
  const categoryUpper = String(category || "").toUpperCase();

  // Strong restaurant/vendor receipt patterns first.
  if (
    /\b(CHKN|CHICKEN)\b/.test(upper) &&
    /\b(WNG|WING|WINGS)\b/.test(upper)
  ) {
    if (/\b(JMB|JUMBO)\b/.test(upper)) return "Chicken Wings Jumbo";
    return "Chicken Wings";
  }

  if (/\bRIBEYE\b/.test(upper)) return "Ribeye";
  if (/\bSHRMP\b|\bSHRIMP\b/.test(upper)) return "Shrimp";
  if (/\bROMAINE\b/.test(upper) && /\b(HRTS|HEARTS)\b/.test(upper)) {
    return "Romaine Hearts";
  }

  if (/\bFRIES?\b/.test(upper)) return "Fries";
  if (/\bCHED\b|\bCHDR\b|\bCHEDDAR\b/.test(upper)) {
    if (/\bSHR\b|\bSHRD\b|\bSHRED\b|\bSHREDDED\b/.test(upper)) {
      return "Cheddar Cheese Shredded";
    }

    return "Cheddar Cheese";
  }

  if (/\bCLM\b|\bCLAM\b/.test(upper)) {
    if (/\bSHELL\b|\bSHLL\b/.test(upper)) return "To-Go Clamshell Containers";
  }

  if (/\bPOTATO\b|\bPOT\b/.test(upper)) {
    return "Potatoes";
  }

  // Generic abbreviation cleanup fallback.
  const cleaned = upper
    .replace(/&/g, " AND ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(
      (token) =>
        ![
          "SYS",
          "CLS",
          "CVP",
          "RND",
          "IMP",
          "BRL",
          "AVG",
          "PK",
          "CS",
          "EA",
          "RAW",
        ].includes(token)
    )
    .filter((token) => !/^\d+[A-Z]*$/.test(token))
    .map((token) => {
      const map = {
        CHKN: "CHICKEN",
        CHK: "CHICKEN",
        WNG: "WINGS",
        JMB: "JUMBO",
        SHRMP: "SHRIMP",
        CHDR: "CHEDDAR",
        CHED: "CHEDDAR",
        HRTS: "HEARTS",
        PRTN: "PORTIONS",
        PRTNS: "PORTIONS",
      };

      return map[token] || token;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return raw;

  const titled = titleCaseItemName(cleaned);

  // If the fallback is still ugly, prefer the raw line rather than inventing too much.
  if (titled.length <= 2) return raw;

  return titled;
}

function buildCostSourceFieldsFromLine({ line, proposedCost }) {
  const rawItemName =
  line.lineItemName ||
  line.lineName ||
  "New receipt cost item";

const itemName =
  friendlyVendorItemName(rawItemName, line.category) ||
  rawItemName ||
  "New receipt cost item";

  const fields = {
    [COST_SOURCE_FIELD.sourceItemName]: itemName,
    [COST_SOURCE_FIELD.supplier]: line.vendor || "",
    [COST_SOURCE_FIELD.unitPrice]: proposedCost,
    [COST_SOURCE_FIELD.price]: proposedCost,
    [COST_SOURCE_FIELD.finalPrice]: proposedCost,
  };

  if (line.category) {
    fields[COST_SOURCE_FIELD.category] = line.category;
  }

  if (line.unit) {
    fields[COST_SOURCE_FIELD.unit] = line.unit;
  }

  return fields;
}

function buildProposalFieldsFromLine({
  line,
  proposedCost,
  inventoryRecord,
  costSourceRecord,
}) {
  
  const inventoryCurrentCost = getInventoryCurrentCost(inventoryRecord);
  const costSourceCurrentCost = getCostSourceCurrentCost(costSourceRecord);

  const currentCost =
    inventoryCurrentCost !== null ? inventoryCurrentCost : costSourceCurrentCost;

  const changePercent = calculateChangePercent(currentCost, proposedCost);

  const matchedInventoryItemId = inventoryRecord?.id || "";
  const matchedCostSourceItemId = costSourceRecord?.id || "";
  const targetName = getTargetName({ inventoryRecord, costSourceRecord });

  const proposalName = `${line.vendor || "Vendor"} — ${
    line.lineItemName || line.lineName || "Parsed item"
  } — ${money(proposedCost)}`;

  const proposalReason = buildProposalReason({
    line,
    currentCost,
    proposedCost,
    inventoryRecord,
    costSourceRecord,
  });

  const fields = {
    [PROPOSAL_FIELD.proposalName]: proposalName,
    [PROPOSAL_FIELD.receiptLine]: [line.id],
    [PROPOSAL_FIELD.vendor]: line.vendor || "",
    [PROPOSAL_FIELD.parsedItemName]:
      line.lineItemName || line.lineName || "Parsed item",
    [PROPOSAL_FIELD.proposedCost]: proposedCost,
    [PROPOSAL_FIELD.proposalReason]: proposalReason,
    [PROPOSAL_FIELD.notes]: targetName
      ? ""
      : "Needs match before cost signal can be tracked.",
  };

  if (matchedInventoryItemId) {
    fields[PROPOSAL_FIELD.matchedInventoryItem] = [matchedInventoryItemId];
  }

  if (matchedCostSourceItemId) {
    fields[PROPOSAL_FIELD.matchedCostSourceItem] = [matchedCostSourceItemId];
  }

  if (currentCost !== null) {
    fields[PROPOSAL_FIELD.currentCost] = currentCost;
  }

  if (changePercent !== null) {
    fields[PROPOSAL_FIELD.changePercent] = changePercent;
  }

  return fields;
}
async function generateProposals(req, res) {
  const force = Boolean(req.body?.force);

  const [lineRecords, existingProposalRecords] = await Promise.all([
    listAirtableRecords({
      tableId: RECEIPT_LINES_TABLE_ID,
      fields: Object.values(LINE_FIELD),
      pageSize: 100,
    }),
    listAirtableRecords({
      tableId: COST_PROPOSALS_TABLE_ID,
      fields: Object.values(PROPOSAL_FIELD),
      pageSize: 100,
    }),
  ]);

  const existingProposalByLineId = new Map();

  for (const proposal of existingProposalRecords) {
    const fields = proposal.fields || {};
    const receiptLineIds = linkedIds(fields[PROPOSAL_FIELD.receiptLine]);

    for (const receiptLineId of receiptLineIds) {
      if (!existingProposalByLineId.has(receiptLineId)) {
        existingProposalByLineId.set(receiptLineId, proposal);
      }
    }
  }

  const recordCache = new Map();
  const recordsToCreate = [];
  const recordsToUpdate = [];
  const skipped = [];

  for (const record of lineRecords) {
    const line = normalizeLineRecord(record);

    if (!line.approved) {
      skipped.push({
        lineId: line.id,
        reason: "Line is not approved.",
      });
      continue;
    }

    const existingProposal = existingProposalByLineId.get(line.id);

    if (existingProposal && !force) {
      skipped.push({
        lineId: line.id,
        reason: "Cost signal already exists for this line.",
      });
      continue;
    }

    const proposedCost = getProposedCostFromLineRecord(record);

    if (proposedCost === null || proposedCost <= 0) {
      skipped.push({
        lineId: line.id,
        reason: "No usable receipt cost found on line.",
      });
      continue;
    }

    const matchedInventoryItemId = line.matchedInventoryItemIds[0] || "";
    const matchedCostSourceItemId = line.matchedCostSourceItemIds[0] || "";

    const inventoryRecord = matchedInventoryItemId
      ? await getRecordCached({
          tableId: INVENTORY_ITEMS_TABLE_ID,
          recordId: matchedInventoryItemId,
          cache: recordCache,
        })
      : null;

    const costSourceRecord = matchedCostSourceItemId
      ? await getRecordCached({
          tableId: COST_SOURCE_ITEMS_TABLE_ID,
          recordId: matchedCostSourceItemId,
          cache: recordCache,
        })
      : null;

    const fields = buildProposalFieldsFromLine({
      line,
      proposedCost,
      inventoryRecord,
      costSourceRecord,
    });

    if (existingProposal && force) {
      const existingFields = existingProposal.fields || {};
      const existingStatus =
        existingFields[PROPOSAL_FIELD.proposalStatus] || "Needs Review";

      recordsToUpdate.push({
        id: existingProposal.id,
        fields: {
          ...fields,
          [PROPOSAL_FIELD.proposalStatus]: existingStatus,
          [PROPOSAL_FIELD.approved]: Boolean(
            existingFields[PROPOSAL_FIELD.approved]
          ),
          [PROPOSAL_FIELD.applied]: Boolean(
            existingFields[PROPOSAL_FIELD.applied]
          ),
        },
      });
    } else {
      recordsToCreate.push({
        fields: {
          ...fields,
          [PROPOSAL_FIELD.proposalStatus]: "Needs Review",
          [PROPOSAL_FIELD.approved]: false,
          [PROPOSAL_FIELD.applied]: false,
        },
      });
    }
  }

  const createdRecords = [];
  const updatedRecords = [];

  for (let index = 0; index < recordsToCreate.length; index += 10) {
    const batch = recordsToCreate.slice(index, index + 10);

    if (batch.length === 0) continue;

    const created = await airtableRequest({
      method: "POST",
      tableId: COST_PROPOSALS_TABLE_ID,
      body: {
        records: batch,
        typecast: true,
      },
    });

    createdRecords.push(...(created.records || []));
  }

  for (let index = 0; index < recordsToUpdate.length; index += 10) {
    const batch = recordsToUpdate.slice(index, index + 10);

    if (batch.length === 0) continue;

    const updated = await airtableRequest({
      method: "PATCH",
      tableId: COST_PROPOSALS_TABLE_ID,
      body: {
        records: batch,
        typecast: true,
      },
    });

    updatedRecords.push(...(updated.records || []));
  }

  return sendJson(res, 200, {
    ok: true,
    message: `Generated ${createdRecords.length} and refreshed ${updatedRecords.length} cost signal${
      createdRecords.length + updatedRecords.length === 1 ? "" : "s"
    }.`,
    createdCount: createdRecords.length,
    updatedCount: updatedRecords.length,
    skippedCount: skipped.length,
    skipped,
    proposals: [...createdRecords, ...updatedRecords].map((record) =>
      normalizeProposalRecord(record)
    ),
  });
}

async function updateProposalReview(req, res, action) {
  const recordId = String(req.body?.recordId || req.body?.proposalId || "").trim();
  const notes = String(req.body?.notes || "").trim();

  if (!recordId) {
    return sendJson(res, 400, {
      ok: false,
      error: "Missing recordId.",
    });
  }

  const proposalRecord = await airtableRequest({
    method: "GET",
    tableId: COST_PROPOSALS_TABLE_ID,
    recordId,
  });

  const proposal = normalizeProposalRecord(proposalRecord);
  const fields = {};

  if (action === "approve") {
    if (!proposal.hasMatch) {
      return sendJson(res, 400, {
        ok: false,
        error: "Choose a KitchenPulse item match before approving this signal.",
      });
    }

    if (proposal.alreadyCurrent || !proposal.meaningfulChange) {
      return sendJson(res, 400, {
        ok: false,
        error:
          "This cost is already current. No approval is needed for this signal.",
      });
    }

    fields[PROPOSAL_FIELD.proposalStatus] = "Approved";
    fields[PROPOSAL_FIELD.approved] = true;

    if (notes) {
      fields[PROPOSAL_FIELD.notes] = notes;
    }
  } else if (action === "reject") {
    fields[PROPOSAL_FIELD.proposalStatus] = "Rejected";
    fields[PROPOSAL_FIELD.approved] = false;
    fields[PROPOSAL_FIELD.applied] = false;

    if (notes) {
      fields[PROPOSAL_FIELD.notes] = notes;
    }
  } else if (action === "return_to_review") {
    fields[PROPOSAL_FIELD.proposalStatus] = "Needs Review";
    fields[PROPOSAL_FIELD.approved] = false;
    fields[PROPOSAL_FIELD.applied] = false;

    if (notes) {
      fields[PROPOSAL_FIELD.notes] = notes;
    }
  } else {
    return sendJson(res, 400, {
      ok: false,
      error: `Unsupported signal review action: ${action}`,
    });
  }

  const updated = await airtableRequest({
    method: "PATCH",
    tableId: COST_PROPOSALS_TABLE_ID,
    recordId,
    body: {
      fields,
    },
  });

  return sendJson(res, 200, {
    ok: true,
    action,
    message:
      action === "approve"
        ? "Cost signal approved."
        : action === "reject"
        ? "Cost signal rejected."
        : "Cost signal returned to review.",
    proposal: normalizeProposalRecord(updated),
  });
}

async function setProposalMatch(req, res) {
  const proposalId = String(
    req.body?.proposalId || req.body?.recordId || ""
  ).trim();
  const targetType = String(req.body?.targetType || "").trim();
  const targetRecordId = String(req.body?.targetRecordId || "").trim();

  if (!proposalId) {
    return sendJson(res, 400, {
      ok: false,
      error: "Missing proposalId.",
    });
  }

  if (!targetRecordId) {
    return sendJson(res, 400, {
      ok: false,
      error: "Missing targetRecordId.",
    });
  }

  if (targetType !== "inventory" && targetType !== "cost_source") {
    return sendJson(res, 400, {
      ok: false,
      error: "targetType must be inventory or cost_source.",
    });
  }

  const proposalRecord = await airtableRequest({
    method: "GET",
    tableId: COST_PROPOSALS_TABLE_ID,
    recordId: proposalId,
  });

  const proposal = normalizeProposalRecord(proposalRecord);
  const receiptLineId = proposal.receiptLineId;

  if (!receiptLineId) {
    return sendJson(res, 400, {
      ok: false,
      error: "This signal is not linked to a receipt line.",
    });
  }

  const lineRecord = await airtableRequest({
    method: "GET",
    tableId: RECEIPT_LINES_TABLE_ID,
    recordId: receiptLineId,
  });

  const line = normalizeLineRecord(lineRecord);
  const proposedCost =
    proposal.proposedCost || getProposedCostFromLineRecord(lineRecord);

  if (proposedCost === null || proposedCost <= 0) {
    return sendJson(res, 400, {
      ok: false,
      error: "This signal does not have a usable receipt cost.",
    });
  }

  let inventoryRecord = null;
  let costSourceRecord = null;

  if (targetType === "inventory") {
    inventoryRecord = await airtableRequest({
      method: "GET",
      tableId: INVENTORY_ITEMS_TABLE_ID,
      recordId: targetRecordId,
    });

    await airtableRequest({
      method: "PATCH",
      tableId: RECEIPT_LINES_TABLE_ID,
      recordId: receiptLineId,
      body: {
        fields: {
          [LINE_FIELD.matchedInventoryItem]: [targetRecordId],
          [LINE_FIELD.matchedCostSourceItem]: [],
        },
      },
    });
  }

  if (targetType === "cost_source") {
    costSourceRecord = await airtableRequest({
      method: "GET",
      tableId: COST_SOURCE_ITEMS_TABLE_ID,
      recordId: targetRecordId,
    });

    await airtableRequest({
      method: "PATCH",
      tableId: RECEIPT_LINES_TABLE_ID,
      recordId: receiptLineId,
      body: {
        fields: {
          [LINE_FIELD.matchedInventoryItem]: [],
          [LINE_FIELD.matchedCostSourceItem]: [targetRecordId],
        },
      },
    });
  }

  const proposalFields = buildProposalFieldsFromLine({
    line,
    proposedCost,
    inventoryRecord,
    costSourceRecord,
  });

  const updatedProposal = await airtableRequest({
    method: "PATCH",
    tableId: COST_PROPOSALS_TABLE_ID,
    recordId: proposalId,
    body: {
      fields: {
        ...proposalFields,
        [PROPOSAL_FIELD.proposalStatus]:
          proposal.proposalStatus === "Rejected"
            ? "Needs Review"
            : proposal.proposalStatus,
        [PROPOSAL_FIELD.approved]:
          proposal.proposalStatus === "Approved" ? true : proposal.approved,
        [PROPOSAL_FIELD.applied]: false,
      },
      typecast: true,
    },
  });

  return sendJson(res, 200, {
    ok: true,
    action: "set_match",
    message: "Match saved. Cost signal refreshed.",
    proposal: normalizeProposalRecord(updatedProposal),
  });
}
async function createCostSourceItemFromProposal(req, res) {
  const proposalId = String(
    req.body?.proposalId || req.body?.recordId || ""
  ).trim();

  if (!proposalId) {
    return sendJson(res, 400, {
      ok: false,
      error: "Missing proposalId.",
    });
  }

  const proposalRecord = await airtableRequest({
    method: "GET",
    tableId: COST_PROPOSALS_TABLE_ID,
    recordId: proposalId,
  });

  const proposal = normalizeProposalRecord(proposalRecord);

  if (proposal.hasMatch) {
    return sendJson(res, 400, {
      ok: false,
      error: "This cost signal already has a KitchenPulse item match.",
    });
  }

  const receiptLineId = proposal.receiptLineId;

  if (!receiptLineId) {
    return sendJson(res, 400, {
      ok: false,
      error: "This signal is not linked to a receipt line.",
    });
  }

  const lineRecord = await airtableRequest({
    method: "GET",
    tableId: RECEIPT_LINES_TABLE_ID,
    recordId: receiptLineId,
  });

  const line = normalizeLineRecord(lineRecord);

  const proposedCost =
    proposal.proposedCost || getProposedCostFromLineRecord(lineRecord);

  if (proposedCost === null || proposedCost <= 0) {
    return sendJson(res, 400, {
      ok: false,
      error: "This signal does not have a usable receipt cost.",
    });
  }

  const matchData = await getMatchData();

  const duplicateSuggestions = buildMatchSuggestionsForProposal({
    proposal: {
      ...proposal,
      parsedItemName:
        proposal.parsedItemName ||
        line.lineItemName ||
        line.lineName ||
        "",
      vendor: proposal.vendor || line.vendor || "",
      proposedCost,
    },
    inventoryRecords: matchData.inventoryRecords,
    costSourceRecords: matchData.costSourceRecords,
  }).filter((suggestion) => suggestion.score >= 80);

  if (duplicateSuggestions.length > 0 && !Boolean(req.body?.forceCreate)) {
    return sendJson(res, 409, {
      ok: false,
      error:
        "KitchenPulse found a likely existing item. Review the match suggestion before creating a new cost item.",
      action: "possible_duplicate",
      suggestions: duplicateSuggestions,
    });
  }

  const created = await airtableRequest({
    method: "POST",
    tableId: COST_SOURCE_ITEMS_TABLE_ID,
    body: {
      records: [
        {
          fields: buildCostSourceFieldsFromLine({
            line,
            proposedCost,
          }),
        },
      ],
      typecast: true,
    },
  });

  const createdCostSourceRecord = created.records?.[0] || null;

  if (!createdCostSourceRecord?.id) {
    return sendJson(res, 500, {
      ok: false,
      error: "Cost Source Item could not be created.",
    });
  }

  await airtableRequest({
    method: "PATCH",
    tableId: RECEIPT_LINES_TABLE_ID,
    recordId: receiptLineId,
    body: {
      fields: {
        [LINE_FIELD.matchedInventoryItem]: [],
        [LINE_FIELD.matchedCostSourceItem]: [createdCostSourceRecord.id],
      },
    },
  });

  const proposalFields = buildProposalFieldsFromLine({
    line,
    proposedCost,
    inventoryRecord: null,
    costSourceRecord: createdCostSourceRecord,
  });

  const updatedProposal = await airtableRequest({
    method: "PATCH",
    tableId: COST_PROPOSALS_TABLE_ID,
    recordId: proposalId,
    body: {
      fields: {
        ...proposalFields,
        [PROPOSAL_FIELD.proposalStatus]:
          proposal.proposalStatus === "Rejected"
            ? "Needs Review"
            : proposal.proposalStatus,
        [PROPOSAL_FIELD.approved]: false,
        [PROPOSAL_FIELD.applied]: false,
        [PROPOSAL_FIELD.notes]:
          "Created new Cost Source Item from reviewed receipt line. Future receipts can now match against this item.",
      },
      typecast: true,
    },
  });

  return sendJson(res, 200, {
    ok: true,
    action: "create_cost_source_item",
    message:
      "New Cost Source Item created and linked. Review the matched cost signal before tracking movement.",
    costSourceItemId: createdCostSourceRecord.id,
    costSourceItem: createdCostSourceRecord,
    proposal: normalizeProposalRecord(updatedProposal),
  });
}
async function applyProposal(req, res) {
  const recordId = String(req.body?.recordId || req.body?.proposalId || "").trim();

  if (!recordId) {
    return sendJson(res, 400, {
      ok: false,
      error: "Missing recordId.",
    });
  }

  const proposalRecord = await airtableRequest({
    method: "GET",
    tableId: COST_PROPOSALS_TABLE_ID,
    recordId,
  });

  const proposal = normalizeProposalRecord(proposalRecord);

  if (proposal.applied || proposal.proposalStatus === "Applied") {
    return sendJson(res, 400, {
      ok: false,
      error: "This cost signal has already been tracked.",
    });
  }

  if (!proposal.approved || proposal.proposalStatus !== "Approved") {
    return sendJson(res, 400, {
      ok: false,
      error: "Approve this cost signal before tracking it.",
    });
  }

  if (proposal.proposedCost === null || proposal.proposedCost <= 0) {
    return sendJson(res, 400, {
      ok: false,
      error: "This signal does not have a usable receipt cost.",
    });
  }

  if (proposal.alreadyCurrent || !proposal.meaningfulChange) {
    return sendJson(res, 400, {
      ok: false,
      error:
        "This cost is already current. No cost movement is needed for this signal.",
    });
  }

  const targetUpdates = [];

  const inventoryItemId = proposal.matchedInventoryItemIds[0] || "";
  const costSourceItemId = proposal.matchedCostSourceItemIds[0] || "";

  if (inventoryItemId) {
    const inventoryRecord = await airtableRequest({
      method: "GET",
      tableId: INVENTORY_ITEMS_TABLE_ID,
      recordId: inventoryItemId,
    });

    const previousValue = getInventoryCurrentCost(inventoryRecord);

    if (!isMeaningfulCostChange(previousValue, proposal.proposedCost)) {
      targetUpdates.push({
        table: "Inventory Items",
        recordId: inventoryItemId,
        field: INVENTORY_FIELD.costPerUnit,
        previousValue,
        value: proposal.proposedCost,
        skipped: true,
        reason: "Already current",
      });
    } else {
      await airtableRequest({
        method: "PATCH",
        tableId: INVENTORY_ITEMS_TABLE_ID,
        recordId: inventoryItemId,
        body: {
          fields: {
            [INVENTORY_FIELD.costPerUnit]: proposal.proposedCost,
          },
        },
      });

      targetUpdates.push({
        table: "Inventory Items",
        recordId: inventoryItemId,
        field: INVENTORY_FIELD.costPerUnit,
        previousValue,
        value: proposal.proposedCost,
        skipped: false,
      });
    }
  }

  if (costSourceItemId) {
    const costSourceRecord = await airtableRequest({
      method: "GET",
      tableId: COST_SOURCE_ITEMS_TABLE_ID,
      recordId: costSourceItemId,
    });

    const previousValue = getCostSourceCurrentCost(costSourceRecord);

    if (!isMeaningfulCostChange(previousValue, proposal.proposedCost)) {
      targetUpdates.push({
        table: "Cost Source Items",
        recordId: costSourceItemId,
        field: COST_SOURCE_FIELD.unitPrice,
        previousValue,
        value: proposal.proposedCost,
        skipped: true,
        reason: "Already current",
      });
    } else {
      await airtableRequest({
        method: "PATCH",
        tableId: COST_SOURCE_ITEMS_TABLE_ID,
        recordId: costSourceItemId,
        body: {
          fields: {
            [COST_SOURCE_FIELD.unitPrice]: proposal.proposedCost,
          },
        },
      });

      targetUpdates.push({
        table: "Cost Source Items",
        recordId: costSourceItemId,
        field: COST_SOURCE_FIELD.unitPrice,
        previousValue,
        value: proposal.proposedCost,
        skipped: false,
      });
    }
  }

  if (targetUpdates.length === 0) {
    return sendJson(res, 400, {
      ok: false,
      error:
        "This signal is not matched to an Inventory Item or Cost Source Item yet.",
    });
  }

  const appliedUpdates = targetUpdates.filter((update) => !update.skipped);

  if (appliedUpdates.length === 0) {
    return sendJson(res, 400, {
      ok: false,
      error:
        "This cost is already current. No cost movement is needed for this signal.",
      targetUpdates,
    });
  }

  const updatedProposal = await airtableRequest({
    method: "PATCH",
    tableId: COST_PROPOSALS_TABLE_ID,
    recordId,
    body: {
      fields: {
        [PROPOSAL_FIELD.proposalStatus]: "Applied",
        [PROPOSAL_FIELD.approved]: true,
        [PROPOSAL_FIELD.applied]: true,
        [PROPOSAL_FIELD.notes]: `Tracked receipt cost ${money(
          proposal.proposedCost
        )} and created Cost Movement output.`,
      },
    },
  });

  const normalizedUpdatedProposal = normalizeProposalRecord(updatedProposal);

  const costMovementRecord = await createCostMovementFromAppliedProposal({
    updatedProposalRecord: updatedProposal,
    proposal: normalizedUpdatedProposal,
    targetUpdates,
  });

  return sendJson(res, 200, {
    ok: true,
    action: "apply",
    message: "Cost signal tracked and Cost Movement created.",
    targetUpdates,
    costMovementRecordId: costMovementRecord?.id || "",
    proposal: normalizedUpdatedProposal,
  });
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    requireAirtableConfig();

    if (req.method === "GET") {
      return await listProposals(req, res);
    }

    if (req.method !== "POST" && req.method !== "PATCH") {
      return sendJson(res, 405, {
        ok: false,
        error: "Method not allowed.",
      });
    }

    const action = String(req.body?.action || "").trim();

    if (action === "generate") {
      return await generateProposals(req, res);
    }

    if (
      action === "approve" ||
      action === "reject" ||
      action === "return_to_review"
    ) {
      return await updateProposalReview(req, res, action);
    }

        if (action === "set_match") {
      return await setProposalMatch(req, res);
    }

    if (action === "create_cost_source_item") {
      return await createCostSourceItemFromProposal(req, res);
    }

    if (action === "apply") {
      return await applyProposal(req, res);
    }

    return sendJson(res, 400, {
      ok: false,
      error:
        "Unsupported action. Use generate, approve, reject, return_to_review, set_match, create_cost_source_item, or apply.",
    });
  } catch (error) {
    console.error("receipt-cost-proposals route failed:", error);

    return sendJson(res, 500, {
      ok: false,
      error:
        error?.message ||
        "Receipt cost signals could not be loaded or updated. Check server logs.",
    });
  }
}
