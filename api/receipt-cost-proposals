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

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept"
  );
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  return res.status(statusCode).json(payload);
}

function requireAirtableConfig() {
  if (!AIRTABLE_BASE_ID) {
    throw new Error("Missing AIRTABLE_BASE_ID.");
  }

  if (!AIRTABLE_TOKEN) {
    throw new Error("Missing AIRTABLE_TOKEN / AIRTABLE_API_KEY / AIRTABLE_PAT.");
  }
}

function airtableTableUrl(tableId) {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    tableId
  )}`;
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

    if (offset) {
      params.set("offset", offset);
    }

    for (const fieldName of fields) {
      params.append("fields[]", fieldName);
    }

    const response = await fetch(
      `${airtableTableUrl(tableId)}?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

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
  if (Array.isArray(value)) return value;
  return [];
}

function firstLinkedId(value) {
  const ids = linkedIds(value);
  return ids.length ? ids[0] : "";
}

function asNumberOrNull(value) {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return null;
  }

  return numberValue;
}

function money(value) {
  const numberValue = asNumberOrNull(value);

  if (numberValue === null) return "unknown";

  return numberValue.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function calculateChangePercent(currentCost, proposedCost) {
  const current = asNumberOrNull(currentCost);
  const proposed = asNumberOrNull(proposedCost);

  if (current === null || proposed === null || current === 0) {
    return null;
  }

  return (proposed - current) / current;
}

function getProposedCostFromLineRecord(record) {
  const fields = record.fields || {};

  const unitCost = asNumberOrNull(fields[LINE_FIELD.unitCost]);
  const lineTotal = asNumberOrNull(fields[LINE_FIELD.lineTotal]);
  const quantity = asNumberOrNull(fields[LINE_FIELD.quantity]);

  if (unitCost !== null && unitCost > 0) {
    return unitCost;
  }

  if (lineTotal !== null && quantity !== null && quantity > 0) {
    return lineTotal / quantity;
  }

  if (lineTotal !== null && lineTotal > 0) {
    return lineTotal;
  }

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

  if (source.includes(target) || target.includes(source)) {
    return 82;
  }

  const sourceTokens = tokenize(source);
  const targetTokens = tokenize(target);

  if (sourceTokens.length === 0 || targetTokens.length === 0) {
    return 0;
  }

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

  const approved = Boolean(fields[PROPOSAL_FIELD.approved]);
  const applied = Boolean(fields[PROPOSAL_FIELD.applied]);
  const hasMatch =
    matchedInventoryItemIds.length > 0 || matchedCostSourceItemIds.length > 0;

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

    currentCost: asNumberOrNull(fields[PROPOSAL_FIELD.currentCost]),
    proposedCost: asNumberOrNull(fields[PROPOSAL_FIELD.proposedCost]),
    changePercent: asNumberOrNull(fields[PROPOSAL_FIELD.changePercent]),

    proposalStatus: fields[PROPOSAL_FIELD.proposalStatus] || "Needs Review",
    approved,
    applied,

    proposalReason: fields[PROPOSAL_FIELD.proposalReason] || "",
    notes: fields[PROPOSAL_FIELD.notes] || "",

    hasMatch,
    matchSuggestions,

    canApply:
      approved &&
      !applied &&
      hasMatch &&
      (fields[PROPOSAL_FIELD.proposalStatus] || "Needs Review") === "Approved",
  };
}

function buildProposalCounts(proposals) {
  return {
    total: proposals.length,
    needsReview: proposals.filter(
      (proposal) => proposal.proposalStatus === "Needs Review"
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

      return !hasMatch && proposal.proposalStatus !== "Rejected";
    }).length,
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
      "Approved receipt line is ready for pricing review, but it is not matched to an Inventory Item or Cost Source Item yet.",
      `Parsed item: ${line.lineItemName || "Unnamed line"}.`,
      `Proposed cost from receipt: ${money(proposedCost)}.`,
      "Match this line before applying any cost update.",
    ].join(" ");
  }

  if (currentCost === null) {
    return [
      `Approved receipt line matched to ${targetName}.`,
      `KitchenPulse does not have a current cost for this target yet.`,
      `Proposed cost from receipt: ${money(proposedCost)}.`,
    ].join(" ");
  }

  const changePercent = calculateChangePercent(currentCost, proposedCost);

  if (changePercent === null) {
    return [
      `Approved receipt line matched to ${targetName}.`,
      `Current cost: ${money(currentCost)}.`,
      `Proposed cost from receipt: ${money(proposedCost)}.`,
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
    `Current cost is ${money(currentCost)} and proposed cost is ${money(
      proposedCost
    )}.`,
    `This is a ${percentText} ${direction}.`,
  ].join(" ");
}

async function getRecordCached({ tableId, recordId, cache }) {
  if (!recordId) return null;

  const key = `${tableId}:${recordId}`;

  if (cache.has(key)) {
    return cache.get(key);
  }

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
      currentCost,
      score,
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
      score,
      reason:
        score >= 85
          ? "Strong cost source match"
          : score >= 60
          ? "Likely cost source match"
          : "Possible cost source match",
    });
  }

  return suggestions
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      const aHasCost = a.currentCost !== null && typeof a.currentCost !== "undefined";
      const bHasCost = b.currentCost !== null && typeof b.currentCost !== "undefined";

      if (aHasCost !== bHasCost) return bHasCost ? 1 : -1;

      return String(a.name).localeCompare(String(b.name));
    })
    .slice(0, 5);
}

async function listProposals(req, res) {
  const proposalRecords = await listAirtableRecords({
    tableId: COST_PROPOSALS_TABLE_ID,
    fields: Object.values(PROPOSAL_FIELD),
    pageSize: 100,
  });

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

      if (aRank !== bRank) return aRank - bRank;

      return String(a.parsedItemName || a.proposalName).localeCompare(
        String(b.parsedItemName || b.proposalName)
      );
    });

  return sendJson(res, 200, {
    ok: true,
    counts: buildProposalCounts(proposals),
    proposals,
  });
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
      : "Needs match before price update can be applied.",
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
        reason: "Proposal already exists for this line.",
      });
      continue;
    }

    const proposedCost = getProposedCostFromLineRecord(record);

    if (proposedCost === null || proposedCost <= 0) {
      skipped.push({
        lineId: line.id,
        reason: "No usable proposed cost found on line.",
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
    message: `Generated ${createdRecords.length} and refreshed ${updatedRecords.length} cost proposal${
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

  const fields = {};

  if (action === "approve") {
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
      error: `Unsupported proposal review action: ${action}`,
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
        ? "Cost proposal approved."
        : action === "reject"
        ? "Cost proposal rejected."
        : "Cost proposal returned to review.",
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
      error: "This proposal is not linked to a receipt line.",
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
      error: "This proposal does not have a usable proposed cost.",
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
    message: "Match saved. Cost proposal refreshed.",
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
      error: "This proposal has already been applied.",
    });
  }

  if (!proposal.approved || proposal.proposalStatus !== "Approved") {
    return sendJson(res, 400, {
      ok: false,
      error: "Approve this cost proposal before applying it.",
    });
  }

  if (proposal.proposedCost === null || proposal.proposedCost <= 0) {
    return sendJson(res, 400, {
      ok: false,
      error: "This proposal does not have a usable proposed cost.",
    });
  }

  const targetUpdates = [];

  const inventoryItemId = proposal.matchedInventoryItemIds[0] || "";
  const costSourceItemId = proposal.matchedCostSourceItemIds[0] || "";

  if (inventoryItemId) {
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
      value: proposal.proposedCost,
    });
  }

  if (costSourceItemId) {
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
      value: proposal.proposedCost,
    });
  }

  if (targetUpdates.length === 0) {
    return sendJson(res, 400, {
      ok: false,
      error:
        "This proposal is not matched to an Inventory Item or Cost Source Item yet.",
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
        [PROPOSAL_FIELD.notes]: `Applied proposed cost ${money(
          proposal.proposedCost
        )} from receipt proposal.`,
      },
    },
  });

  return sendJson(res, 200, {
    ok: true,
    action: "apply",
    message: "Cost proposal applied.",
    targetUpdates,
    proposal: normalizeProposalRecord(updatedProposal),
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

    if (action === "apply") {
      return await applyProposal(req, res);
    }

    return sendJson(res, 400, {
      ok: false,
      error:
        "Unsupported action. Use generate, approve, reject, return_to_review, set_match, or apply.",
    });
  } catch (error) {
    console.error("receipt-cost-proposals route failed:", error);

    return sendJson(res, 500, {
      ok: false,
      error:
        error?.message ||
        "Receipt cost proposals could not be loaded or updated. Check server logs.",
    });
  }
}
