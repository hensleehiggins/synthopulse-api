const AIRTABLE_API_KEY =
  process.env.AIRTABLE_PAT ||
  process.env.AIRTABLE_API_KEY ||
  process.env.AIRTABLE_TOKEN ||
  process.env.KITCHENPULSE_AIRTABLE_API_KEY;

const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID ||
  process.env.KITCHENPULSE_AIRTABLE_BASE_ID ||
  "appD303evZM2SlvMR";

const AIRTABLE_RESTAURANT_ID =
  process.env.AIRTABLE_CHLOES_RESTAURANT_ID ||
  process.env.KITCHENPULSE_RESTAURANT_ID ||
  process.env.RESTAURANT_RECORD_ID ||
  "";

const AIRTABLE_API_URL = "https://api.airtable.com/v0";

const TABLES = {
  parLevels: "Par Levels",
};

function sendJson(res, status, payload) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(status).json(payload);
}

function cleanText(value) {
  return String(value || "").trim();
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;

  if (Array.isArray(value)) {
    return numberOrNull(value[0]);
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function boolValue(value) {
  return value === true;
}

function normalizeVendor(value) {
  const raw = cleanText(value);
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

function normalizeSourceType(value) {
  const sourceType = cleanText(value).toLowerCase();

  if (sourceType === "count_seed") return "count_seed";
  if (sourceType === "receipt_seed") return "receipt_seed";
  if (sourceType === "manual") return "manual";
  if (sourceType === "par_row") return "par_row";

  return "manual";
}

function buildSetupNotes({
  sourceType,
  sourceItemId,
  sourceRecordId,
  itemName,
  currentStock,
  countUnit,
  storageArea,
  preferredVendor,
  vendorOrderUnit,
  packSize,
  unitConversionNotes,
  notes,
}) {
  const parts = [];

  if (sourceType === "count_seed") {
    parts.push(
      "Created from an approved stock-count seed. Review target stock, reorder point, vendor unit, and conversion notes before trusting reorder math."
    );
  } else if (sourceType === "receipt_seed") {
    parts.push(
      "Created from an approved receipt-backed seed. Review count unit, target stock, reorder point, vendor unit, and conversion notes before trusting reorder math."
    );
  } else {
    parts.push(
      "Created from Order Intelligence setup. Review ordering rules before trusting reorder math."
    );
  }

  if (itemName) {
    parts.push(`Item: ${itemName}.`);
  }

  if (currentStock !== null) {
    parts.push(`Starting stock: ${currentStock}${countUnit ? ` ${countUnit}` : ""}.`);
  }

  if (storageArea) {
    parts.push(`Storage area: ${storageArea}.`);
  }

  if (preferredVendor) {
    parts.push(`Preferred vendor: ${preferredVendor}.`);
  }

  if (vendorOrderUnit) {
    parts.push(`Vendor order unit: ${vendorOrderUnit}.`);
  }

  if (packSize) {
    parts.push(`Pack size: ${packSize}.`);
  }

  if (unitConversionNotes) {
    parts.push(`Conversion notes: ${unitConversionNotes}`);
  }

  if (sourceItemId) {
    parts.push(`Source item id: ${sourceItemId}.`);
  }

  if (sourceRecordId && sourceRecordId !== sourceItemId) {
    parts.push(`Source record id: ${sourceRecordId}.`);
  }

  if (notes) {
    parts.push(`Setup notes: ${notes}`);
  }

  return parts.join(" ");
}

function buildParLevelFields(body) {
  const sourceType = normalizeSourceType(body.sourceType);
  const sourceItemId = cleanText(body.sourceItemId || body.itemId);
  const sourceRecordId = cleanText(body.sourceRecordId || body.recordId);
  const itemName = cleanText(body.itemName || body.orderItemName || body.name);

  const currentStock = numberOrNull(body.currentStock);
  const targetStock = numberOrNull(body.targetStock || body.parTarget || body.oiTargetStock);
  const reorderPoint = numberOrNull(body.reorderPoint);
  const estimatedDailyUsage = numberOrNull(body.estimatedDailyUsage);

  const preferredVendor = normalizeVendor(body.preferredVendor);
  const vendorItemName = cleanText(body.vendorItemName);
  const orderVendorSku = cleanText(body.orderVendorSku || body.vendorSku);
  const storageArea = cleanText(body.storageArea);
  const countUnit = cleanText(body.countUnit || body.unit);
  const vendorOrderUnit = cleanText(body.vendorOrderUnit || body.orderUnit);
  const packSize = cleanText(body.packSize || body.oiPackSize);
  const unitConversionNotes = cleanText(
    body.unitConversionNotes || body.oiUnitConversionNotes
  );
  const orderDays = Array.isArray(body.orderDays) ? body.orderDays : [];
  const deliveryDays = Array.isArray(body.deliveryDays) ? body.deliveryDays : [];
  const vendorCutoffTime = cleanText(body.vendorCutoffTime);
  const notes = cleanText(body.notes || body.setupNotes);

  const criticalItem = boolValue(body.criticalItem);
  const emergencyRunRisk = boolValue(body.emergencyRunRisk);
  const eventSensitive = boolValue(body.eventSensitive);

  if (!itemName) {
    throw new Error("Missing item name.");
  }

  const fields = {
    // Primary field and newer clean Order Intelligence name.
    Ingredient: itemName,
    "Order Item Name": itemName,

    // Starting stock context.
    "Current Stock": currentStock,
    "Last Checked": new Date().toISOString(),

    // Clean Order Intelligence setup fields.
    "Preferred Vendor": preferredVendor,
    "Vendor Item Name": vendorItemName,
    "Order Vendor SKU": orderVendorSku,
    "Count Unit": countUnit,
    "Vendor Order Unit": vendorOrderUnit,
    "OI Pack Size": packSize,
    "OI Unit Conversion Notes": unitConversionNotes,
    "OI Target Stock": targetStock,
    "OI Safety Stock": numberOrNull(body.safetyStock || body.oiSafetyStock),
    "OI Lead Time Days": numberOrNull(body.leadTimeDays || body.oiLeadTimeDays),
    "OI Vendor Cutoff Time": vendorCutoffTime,
    "OI Critical Item": criticalItem,
    "OI Emergency Run Risk": emergencyRunRisk,
    "OI Event Sensitive": eventSensitive,

    // Older PAR fallback fields still used by the current board/math.
    "Par Target": targetStock,
    "Reorder Point": reorderPoint,
    "Estimated Daily Usage": estimatedDailyUsage,

    // Notes/audit breadcrumbs.
    "Unit Conversion Notes": unitConversionNotes,
  };

  if (storageArea) {
    fields["Storage Area"] = storageArea;
  }

  if (orderDays.length > 0) {
    fields["OI Order Days"] = orderDays.map(cleanText).filter(Boolean);
  }

  if (deliveryDays.length > 0) {
    fields["OI Delivery Days"] = deliveryDays.map(cleanText).filter(Boolean);
  }

  if (AIRTABLE_RESTAURANT_ID) {
    fields.Restaurant = [AIRTABLE_RESTAURANT_ID];
  }

  const setupNotes = buildSetupNotes({
    sourceType,
    sourceItemId,
    sourceRecordId,
    itemName,
    currentStock,
    countUnit,
    storageArea,
    preferredVendor,
    vendorOrderUnit,
    packSize,
    unitConversionNotes,
    notes,
  });

  if (setupNotes) {
    fields["Unit Conversion Notes"] = setupNotes;
    fields["OI Unit Conversion Notes"] = unitConversionNotes || setupNotes;
  }

  Object.keys(fields).forEach((key) => {
    const value = fields[key];

    if (value === null || value === undefined || value === "") {
      delete fields[key];
    }

    if (Array.isArray(value) && value.length === 0) {
      delete fields[key];
    }
  });

  return {
    fields,
    audit: {
      sourceType,
      sourceItemId,
      sourceRecordId,
      itemName,
      currentStock,
      targetStock,
      reorderPoint,
      preferredVendor,
      storageArea,
      countUnit,
      vendorOrderUnit,
      packSize,
    },
  };
}

async function createParLevelRecord(fields) {
  if (!AIRTABLE_API_KEY) {
    throw new Error("Missing Airtable API key.");
  }

  const url = `${AIRTABLE_API_URL}/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    TABLES.parLevels
  )}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      records: [
        {
          fields,
        },
      ],
      typecast: true,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.error ||
      "Airtable could not create the order rule.";

    throw new Error(message);
  }

  return payload?.records?.[0] || null;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      route: "order-rule-setup",
      accepts: {
        method: "POST",
        required: ["itemName"],
        recommended: [
          "sourceType",
          "sourceItemId",
          "currentStock",
          "countUnit",
          "storageArea",
          "targetStock",
          "reorderPoint",
          "preferredVendor",
          "vendorOrderUnit",
          "packSize",
          "unitConversionNotes",
        ],
      },
    });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      ok: false,
      error: "Method not allowed.",
    });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    const { fields, audit } = buildParLevelFields(body);
    const record = await createParLevelRecord(fields);

    return sendJson(res, 200, {
      ok: true,
      message: "Order rule created.",
      recordId: record?.id || "",
      createdTime: record?.createdTime || "",
      audit,
      record,
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: error?.message || "Order rule setup failed.",
    });
  }
}
