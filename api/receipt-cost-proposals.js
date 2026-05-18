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
};

const COST_SOURCE_FIELD = {
  sourceItemName: "Source Item Name",
  supplier: "Supplier",
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

function getProposedCostFromLine(line) {
  const fields = line.fields || {};

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

function normalizeProposalRecord(record) {
  const fields = record.fields || {};

  return {
    id: record.id,
    createdTime: record.createdTime,

    proposalName: fields[PROPOSAL_FIELD.proposalName] || "",
    receiptLineIds: linkedIds(fields[PROPOSAL_FIELD.receiptLine]),
    receiptLineId: firstLinkedId(fields[PROPOSAL_FIELD.receiptLine]),

    matchedInventoryItemIds: linkedIds(
      fields[PROPOSAL_FIELD.matchedInventoryItem]
    ),
    matchedCostSourceItemIds: linkedIds(
      fields[PROPOSAL_FIELD.matchedCostSourceItem]
    ),

    vendor: fields[PROPOSAL_FIELD.vendor] || "",
    parsedItemName: fields[PROPOSAL_FIELD.parsedItemName] || "",

    currentCost: asNumberOrNull(fields[PROPOSAL_FIELD.currentCost]),
    proposedCost: asNumberOrNull(fields[PROPOSAL_FIELD.proposedCost]),
    changePercent: asNumberOrNull(fields[PROPOSAL_FIELD.changePercent]),

    proposalStatus: fields[PROPOSAL_FIELD.proposalStatus] || "Needs Review",
    approved: Boolean(fields[PROPOSAL_FIELD.approved]),
    applied: Boolean(fields[PROPOSAL_FIELD.applied]),

    proposalReason: fields[PROPOSAL_FIELD.proposalReason] || "",
    notes: fields[PROPOSAL_FIELD.notes] || "",

    canApply:
      Boolean(fields[PROPOSAL_FIELD.approved]) &&
      !Boolean(fields[PROPOSAL_FIELD.applied]) &&
      (linkedIds(fields[PROPOSAL_FIELD.matchedInventoryItem]).length > 0 ||
        linkedIds(fields[PROPOSAL_FIELD.matchedCostSourceItem]).length > 0),
  };
}

function buildProposalCounts(proposals) {
  return {
    total: proposals.length,
    needsReview: proposals.filter(
      (proposal) => proposal.proposalStatus === "Needs Review"
    ).length,
    approved: proposals.filter((proposal) => proposal.proposalStatus === "Approved")
      .length,
    rejected: proposals.filter((proposal) => proposal.proposalStatus === "Rejected")
      .length,
    applied: proposals.filter((proposal) => proposal.proposalStatus === "Applied")
      .length,
    blocked: proposals.filter((proposal) => {
      const hasMatch =
        proposal.matchedInventoryItemIds.length > 0 ||
        proposal.matchedCostSourceItemIds.length > 0;

      return !hasMatch && proposal.proposalStatus !== "Rejected";
    }).length,
  };
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

function getCurrentCostFromInventoryRecord(record) {
  if (!record) return null;

  const fields = record.fields || {};
  return asNumberOrNull(fields[INVENTORY_FIELD.costPerUnit]);
}

function getCurrentCostFromCostSourceRecord(record) {
  if (!record) return null;

  const fields = record.fields || {};

  return (
    asNumberOrNull(fields[COST_SOURCE_FIELD.unitPrice]) ??
    asNumberOrNull(fields[COST_SOURCE_FIELD.finalPrice]) ??
    asNumberOrNull(fields[COST_SOURCE_FIELD.price])
  );
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

async function listProposals(req, res) {
  const records = await listAirtableRecords({
    tableId: COST_PROPOSALS_TABLE_ID,
    fields: Object.values(PROPOSAL_FIELD),
    pageSize: 100,
  });

  const proposals = records
    .map(normalizeProposalRecord)
    .sort((a, b) => {
      const statusRank = {
        "Needs Review": 1,
        Approved: 2,
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

  const existingReceiptLineIds = new Set();

  for (const proposal of existingProposalRecords) {
    const fields = proposal.fields || {};
    const receiptLineIds = linkedIds(fields[PROPOSAL_FIELD.receiptLine]);

    for (const receiptLineId of receiptLineIds) {
      existingReceiptLineIds.add(receiptLineId);
    }
  }

  const recordCache = new Map();
  const recordsToCreate = [];
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

    if (!force && existingReceiptLineIds.has(line.id)) {
      skipped.push({
        lineId: line.id,
        reason: "Proposal already exists for this line.",
      });
      continue;
    }

    const proposedCost = getProposedCostFromLine(record);

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

    const inventoryCurrentCost =
      getCurrentCostFromInventoryRecord(inventoryRecord);

    const costSourceCurrentCost =
      getCurrentCostFromCostSourceRecord(costSourceRecord);

    const currentCost =
      inventoryCurrentCost !== null ? inventoryCurrentCost : costSourceCurrentCost;

    const changePercent = calculateChangePercent(currentCost, proposedCost);

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
      [PROPOSAL_FIELD.proposalStatus]: "Needs Review",
      [PROPOSAL_FIELD.approved]: false,
      [PROPOSAL_FIELD.applied]: false,
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

    recordsToCreate.push({
      fields,
    });
  }

  const createdRecords = [];

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

  return sendJson(res, 200, {
    ok: true,
    message: `Generated ${createdRecords.length} cost proposal${
      createdRecords.length === 1 ? "" : "s"
    }.`,
    createdCount: createdRecords.length,
    skippedCount: skipped.length,
    skipped,
    proposals: createdRecords.map(normalizeProposalRecord),
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

    if (action === "apply") {
      return await applyProposal(req, res);
    }

    return sendJson(res, 400, {
      ok: false,
      error:
        "Unsupported action. Use generate, approve, reject, return_to_review, or apply.",
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
