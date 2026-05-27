const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID || "appD303evZM2SlvMR";

const AIRTABLE_TOKEN =
  process.env.AIRTABLE_TOKEN ||
  process.env.AIRTABLE_API_KEY ||
  process.env.AIRTABLE_PAT;

const RECEIPT_LINES_TABLE_ID = "tblbQ2BwFHbHFnOht";

const FIELD = {
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

function airtableUrl(tableId) {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    tableId
  )}`;
}

async function airtableRequest({ method = "GET", tableId, recordId, body }) {
  requireAirtableConfig();

  const url = recordId
    ? `${airtableUrl(tableId)}/${recordId}`
    : airtableUrl(tableId);

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

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

function firstLinkedId(value) {
  if (Array.isArray(value) && value.length > 0) return value[0];
  return "";
}

function linkedIds(value) {
  if (Array.isArray(value)) return value;
  return [];
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

function isNonItemChargeLine(value) {
  const upper = String(value || "").toUpperCase();

  return (
    // Sysco category / group totals
    /\bTOTAL\b/.test(upper) &&
    /\b(PAPER|DISPOSABLE|DISPOSABLES|GROUP|SUPPLIES|EQUIPMENT)\b/.test(upper)
  ) || (
    /\bCATEGORY\b/.test(upper) && /\bTOTAL\b/.test(upper)
  ) || (
    /\bGROUP\s+TOTAL\b/.test(upper)
  ) || (
    // Delivery / service / misc charges
    /\bFUEL\b/.test(upper) && /\bSURCHARGE\b/.test(upper)
  ) || (
    /\bDELIVERY\b/.test(upper) && /\b(CHARGE|FEE)\b/.test(upper)
  ) || (
    /\bSERVICE\b/.test(upper) && /\b(CHARGE|FEE)\b/.test(upper)
  ) || (
    /\bMISC\b/.test(upper) && /\bCHARGES?\b/.test(upper)
  ) || (
    /\bCHGS?\b/.test(upper) && /\bFUEL\b/.test(upper)
  ) || (
    // Disposable / supply lines we do not want in food cost tracking right now
    /\b(CONTAINER|CNTNR|CUP|CUPS|LID|LIDS|CUTLERY|FORK|FORKS|KNIFE|KNIVES|SPOON|SPOONS|NAPKIN|NAPKINS|STRAW|STRAWS|PLATE|PLATES|BOWL|BOWLS|TRAY|TRAYS|LINER|LINERS|GLOVE|GLOVES|NITRILE|PAD\s+SCOUR|SCOUR\s+PAD|BRUSH|TOWEL|TOWELS)\b/.test(upper)
  ) || (
    /\bPLAS\b/.test(upper) && /\b(CONTAINER|CUP|CLR|CLEAR|MICRO|BLACK|BLK)\b/.test(upper)
  ) || (
    /\bEARTHCHO\b/.test(upper) && /\bKIT\b/.test(upper) && /\bCUTLERY\b/.test(upper)
  );
}

function friendlyVendorItemName(value, category = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const upper = raw.toUpperCase();

  if (isNonItemChargeLine(upper)) return "";

  const isSyscoReliance =
    /\bSYS\s+REL\b/.test(upper) ||
    /\bSYSCO\s+REL\b/.test(upper) ||
    /\bSYSCO\s+RELIABILITY\b/.test(upper) ||
    /\bRELIABILITY\b/.test(upper);

  if (isSyscoReliance) {
    if (/\bDRESSING\b/.test(upper)) {
      const isBlueCheese =
        /\bBLUE\b/.test(upper) && /\b(CHS|CHSE|CHEESE)\b/.test(upper);

      if (isBlueCheese) {
        const isChunky =
          /\bCHUNKY\b|\bCHNKY\b|\bCHNK\b/.test(upper);

        return isChunky
          ? "Sysco Reliance Blue Cheese Dressing Chunky"
          : "Sysco Reliance Blue Cheese Dressing";
      }
    }

    if (/\bPOTATO\b|\bPOTATOES\b|\bPOT\b/.test(upper)) {
  if (/\bFRY\b|\bFRIES\b/.test(upper) && /\bSTEAK\b/.test(upper)) {
    return isSyscoReliance
      ? "Sysco Reliance Steak Fries"
      : "Steak Fries";
  }

  if (/\bYUKON\b/.test(upper) && /\bGOLD\b/.test(upper)) {
    return "Potato Yukon Gold";
  }

  if (/\bIDAHO\b/.test(upper)) {
    return "Potato Idaho";
  }

  if (/\bRUSSET\b/.test(upper)) {
    return "Potato Russet";
  }

  if (/\bRED\b/.test(upper)) {
    return "Red Potatoes";
  }

  if (/\bSWEET\b/.test(upper)) {
    return "Sweet Potatoes";
  }

  return isSyscoReliance ? "Sysco Reliance Potatoes" : "Potatoes";
}

      return "Sysco Reliance Potatoes";
    }

    if (/\bMAYONNAISE\b|\bMAYO\b/.test(upper)) {
      if (/\bHEAVY\b/.test(upper) && /\bDUTY\b/.test(upper)) {
        return "Sysco Reliance Mayonnaise Heavy Duty";
      }

      return "Sysco Reliance Mayonnaise";
    }
  }

  if (/\bDRESSING\b/.test(upper)) {
    const isBlueCheese =
      /\bBLUE\b/.test(upper) && /\b(CHS|CHSE|CHEESE)\b/.test(upper);

    if (isBlueCheese) {
      const isChunky =
        /\bCHUNKY\b|\bCHNKY\b|\bCHNK\b/.test(upper);

      return isChunky
        ? "Blue Cheese Dressing Chunky"
        : "Blue Cheese Dressing";
    }

    if (/\bRANCH\b/.test(upper)) return "Ranch Dressing";
    if (/\bCAESAR\b/.test(upper)) return "Caesar Dressing";
    if (/\bITALIAN\b/.test(upper)) return "Italian Dressing";

    return "Dressing";
  }

  if (
    /\bOCEAN\s*SPRAY\b|\bOCEANSPRAY\b|\bOCN\s*SPRAY\b|\bOCNSPRAY\b|\bOCNSPRY\b|\bOCN\s*SPRY\b/.test(upper)
  ) {
    if (/\bCRANBERRY\b|\bCRNBRY\b|\bCRAN\b/.test(upper)) {
      if (/\bJUICE\b|\bDRINK\b|\bRTS\b|\bCKTAIL\b|\bCOCKTAIL\b/.test(upper)) {
        return "Ocean Spray Cranberry Juice";
      }

      return "Ocean Spray Cranberry";
    }

    return "Ocean Spray";
  }

  if (/\bSEASONING\b/.test(upper)) {
    if (/\bCAJUN\b/.test(upper)) return "Cajun Seasoning";
    return "Seasoning";
  }

  if (/\bSALT\b/.test(upper)) {
    if (/\bKOSHER\b/.test(upper)) return "Kosher Salt";
    return "Salt";
  }

  if (/\bCHEESE\b/.test(upper)) {
    if (/\bSWISS\b/.test(upper) && /\b(AMER|AMERICAN)\b/.test(upper)) {
      return "Swiss/American Cheese Slices";
    }

    if (/\bCHEDDAR\b|\bCHED\b|\bCHDR\b/.test(upper)) {
      if (/\bSHARP\b/.test(upper)) return "Sharp Cheddar Cheese";

      if (/\bSHR\b|\bSHRD\b|\bSHRED\b|\bSHREDDED\b/.test(upper)) {
        return "Cheddar Cheese Shredded";
      }

      return "Cheddar Cheese";
    }

    if (/\bSWISS\b/.test(upper)) return "Swiss Cheese";
    if (/\b(AMER|AMERICAN)\b/.test(upper)) return "American Cheese";
  }

  if (
    /\b(CHKN|CHICKEN)\b/.test(upper) &&
    /\b(WNG|WING|WINGS)\b/.test(upper)
  ) {
    if (/\b(JMB|JUMBO)\b/.test(upper)) return "Chicken Wings Jumbo";
    return "Chicken Wings";
  }

  if (/\bMAYONNAISE\b|\bMAYO\b/.test(upper)) {
    if (/\bHEAVY\b/.test(upper) && /\bDUTY\b/.test(upper)) {
      return "Mayonnaise Heavy Duty";
    }

    return "Mayonnaise";
  }

  if (/\bCRANBERRY\b|\bCRNBRY\b/.test(upper)) {
    if (/\bJUICE\b|\bDRINK\b|\bRTS\b|\bCKTAIL\b|\bCOCKTAIL\b/.test(upper)) {
      return "Cranberry Juice";
    }

    return "Cranberry";
  }

  if (/\bCARROT\b/.test(upper)) {
    if (/\bBABY\b/.test(upper) && /\b(TRI|COLOR|COLOUR)\b/.test(upper)) {
      return "Tri-Color Baby Carrots";
    }

    if (/\bBABY\b/.test(upper)) return "Baby Carrots";
    return "Carrots";
  }

  if (/\bCUCUMBER\b|\bCUC\b/.test(upper)) {
    if (/\bPICKL\b|\bPICKLING\b/.test(upper)) return "Pickling Cucumbers";
    return "Cucumbers";
  }

  if (/\bDILL\b/.test(upper)) return "Dill";

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
          "BRBL",
          "BRRL",
          "BRRBL",
          "BRRLIMP",
          "BBRLIMP",
          "BRRLCLS",
          "BBRLCLS",
          "IMPFRSH",
          "MCC",
          "PACKER",
          "PLD",
          "PRIN",
          "ONLY",
          "AVG",
          "WT",
          "TWT",
          "RES",
          "PET",
          "RTS",
          "PK",
          "PKG",
          "PACKAGE",
          "CS",
          "EA",
          "RAW",
          "BRAND",
          "FRESH",
          "SLICED",
          "SLI",
        ].includes(token)
    )
    .filter((token) => !/^\d+[A-Z]*$/.test(token))
    .filter((token) => !/^[A-Z]*\d+[A-Z]*$/.test(token))
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
      };

      return map[token] || token;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length <= 2) return raw;

  return titleCaseItemName(cleaned);
}
function asNumberOrNull(value) {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return null;
  }

  return numericValue;
}

function normalizeLineRecord(record) {
  const fields = record.fields || {};

const rawLineName = fields[FIELD.lineItemName] || "";
const rawLineText = fields[FIELD.rawLineText] || "";
const cleanedLineName =
  friendlyVendorItemName(rawLineName || rawLineText, fields[FIELD.category]) ||
  rawLineName;

return {
    id: record.id,
    createdTime: record.createdTime,

    lineName: fields[FIELD.lineName] || "",
    receiptIds: linkedIds(fields[FIELD.receipt]),
    receiptId: firstLinkedId(fields[FIELD.receipt]),
    restaurantIds: linkedIds(fields[FIELD.restaurant]),

    vendor: fields[FIELD.vendor] || "",
    lineItemName: cleanedLineName,
    originalLineItemName: rawLineName,
    matchedInventoryItemIds: linkedIds(fields[FIELD.matchedInventoryItem]),
    matchedCostSourceItemIds: linkedIds(fields[FIELD.matchedCostSourceItem]),

    category: fields[FIELD.category] || "",
    quantity:
      typeof fields[FIELD.quantity] === "number" ? fields[FIELD.quantity] : null,
    unit: fields[FIELD.unit] || "",
    packageSize: fields[FIELD.packageSize] || "",
    unitCost:
      typeof fields[FIELD.unitCost] === "number" ? fields[FIELD.unitCost] : null,
    lineTotal:
      typeof fields[FIELD.lineTotal] === "number"
        ? fields[FIELD.lineTotal]
        : null,

    confidence: fields[FIELD.confidence] || "",
    needsReview: Boolean(fields[FIELD.needsReview]),
    approved: Boolean(fields[FIELD.approved]),
    rawLineText: fields[FIELD.rawLineText] || "",
    notes: fields[FIELD.notes] || "",
  };
}

function buildCounts(lines) {
  return {
    total: lines.length,
    approved: lines.filter((line) => line.approved).length,
    needsReview: lines.filter((line) => line.needsReview && !line.approved)
      .length,
    pending: lines.filter((line) => !line.approved && !line.needsReview).length,
  };
}

function sanitizeUpdateFields(input = {}) {
  const fields = {};

  if (Object.prototype.hasOwnProperty.call(input, "lineItemName")) {
    fields[FIELD.lineItemName] = String(input.lineItemName || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(input, "category")) {
    const category = String(input.category || "").trim();

    if (category) {
      fields[FIELD.category] = category;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "quantity")) {
    const quantity = asNumberOrNull(input.quantity);

    if (quantity !== null) {
      fields[FIELD.quantity] = quantity;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "unit")) {
    fields[FIELD.unit] = String(input.unit || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(input, "packageSize")) {
    fields[FIELD.packageSize] = String(input.packageSize || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(input, "unitCost")) {
    const unitCost = asNumberOrNull(input.unitCost);

    if (unitCost !== null) {
      fields[FIELD.unitCost] = unitCost;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "lineTotal")) {
    const lineTotal = asNumberOrNull(input.lineTotal);

    if (lineTotal !== null) {
      fields[FIELD.lineTotal] = lineTotal;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "rawLineText")) {
    fields[FIELD.rawLineText] = String(input.rawLineText || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(input, "notes")) {
    fields[FIELD.notes] = String(input.notes || "").trim();
  }

  return fields;
}

async function listReceiptLines(req, res) {
  const receiptId =
    typeof req.query.receiptId === "string" ? req.query.receiptId.trim() : "";

  const maxRecordsRaw =
    typeof req.query.maxRecords === "string" ? Number(req.query.maxRecords) : 100;

  const maxRecords =
    Number.isFinite(maxRecordsRaw) && maxRecordsRaw > 0
      ? Math.min(maxRecordsRaw, 100)
      : 100;

  const params = new URLSearchParams();
  params.set("pageSize", String(maxRecords));

  const fieldsToReturn = Object.values(FIELD);

  for (const fieldName of fieldsToReturn) {
    params.append("fields[]", fieldName);
  }

  const url = `${airtableUrl(RECEIPT_LINES_TABLE_ID)}?${params.toString()}`;

  const response = await fetch(url, {
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
    console.error("Airtable receipt lines returned non-JSON:", text);
    throw new Error("Airtable receipt lines returned a non-JSON response.");
  }

  if (!response.ok) {
    console.error("Airtable receipt lines request failed:", data);
    throw new Error(
      data?.error?.message ||
        data?.error ||
        `Could not load receipt lines. Airtable status ${response.status}.`
    );
  }

  let lines = Array.isArray(data.records)
    ? data.records.map(normalizeLineRecord)
    : [];

  if (receiptId) {
    lines = lines.filter((line) => line.receiptIds.includes(receiptId));
  }

  lines = lines.filter((line) => {
  const text = [
    line.originalLineItemName,
    line.lineItemName,
    line.rawLineText,
    line.category,
    line.packageSize,
  ]
    .filter(Boolean)
    .join(" ");

  return !isNonItemChargeLine(text);
});

  lines.sort((a, b) => {
    if (a.approved !== b.approved) return a.approved ? 1 : -1;
    if (a.needsReview !== b.needsReview) return a.needsReview ? -1 : 1;
    return String(a.lineItemName || a.lineName).localeCompare(
      String(b.lineItemName || b.lineName)
    );
  });

  return sendJson(res, 200, {
    ok: true,
    receiptId: receiptId || null,
    counts: buildCounts(lines),
    lines,
  });
}

async function updateReceiptLine(req, res) {
  const body = req.body || {};
  const recordId = String(body.recordId || body.lineId || "").trim();
  const action = String(body.action || "update_line").trim();

  if (!recordId) {
    return sendJson(res, 400, {
      ok: false,
      error: "Missing recordId.",
    });
  }

  const fields = {};

  if (action === "approve_line") {
    const existingRecord = await airtableRequest({
  method: "GET",
  tableId: RECEIPT_LINES_TABLE_ID,
  recordId,
});

const existingLine = normalizeLineRecord(existingRecord);

const chargeCheckText = [
  existingLine.originalLineItemName,
  existingLine.lineItemName,
  existingLine.rawLineText,
  existingLine.category,
  existingLine.packageSize,
]
  .filter(Boolean)
  .join(" ");

if (isNonItemChargeLine(chargeCheckText)) {
  return sendJson(res, 400, {
    ok: false,
    error: "This looks like a vendor charge, not a product line. It should not be approved as a cost item.",
  });
}

if (
  existingLine.lineItemName &&
  existingLine.originalLineItemName &&
  existingLine.lineItemName !== existingLine.originalLineItemName
) {
  fields[FIELD.lineItemName] = existingLine.lineItemName;
}
    fields[FIELD.approved] = true;
    fields[FIELD.needsReview] = false;

    if (body.notes) {
      fields[FIELD.notes] = String(body.notes).trim();
    }
  } else if (action === "needs_review") {
    fields[FIELD.approved] = false;
    fields[FIELD.needsReview] = true;

    if (body.notes) {
      fields[FIELD.notes] = String(body.notes).trim();
    }
    } else if (action === "update_line") {
    Object.assign(fields, sanitizeUpdateFields(body.line || body));

    // A saved edit should not automatically approve the line.
    // It simply keeps the human correction in Airtable for review.
    if (Object.keys(fields).length === 0) {
      return sendJson(res, 400, {
        ok: false,
        error: "No editable line fields were provided.",
      });
    }
  } else if (action === "remove_line") {
    await fetch(`${airtableUrl(RECEIPT_LINES_TABLE_ID)}/${recordId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    return sendJson(res, 200, {
      ok: true,
      action,
      message: "Line removed.",
      removedLineId: recordId,
    });
  } else {
    return sendJson(res, 400, {
      ok: false,
      error: `Unsupported action: ${action}`,
    });
  }

  const updated = await airtableRequest({
    method: "PATCH",
    tableId: RECEIPT_LINES_TABLE_ID,
    recordId,
    body: {
      fields,
    },
  });

  return sendJson(res, 200, {
    ok: true,
    action,
    message:
      action === "approve_line"
        ? "Line approved."
        : action === "needs_review"
        ? "Line returned to review."
        : "Line updated.",
    line: normalizeLineRecord(updated),
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
      return await listReceiptLines(req, res);
    }

    if (req.method === "POST" || req.method === "PATCH") {
      return await updateReceiptLine(req, res);
    }

    return sendJson(res, 405, {
      ok: false,
      error: "Method not allowed.",
    });
  } catch (error) {
    console.error("receipt-lines route failed:", error);

    return sendJson(res, 500, {
      ok: false,
      error:
        error?.message ||
        "Receipt lines could not be loaded or updated. Check server logs.",
    });
  }
}
