const { requireKitchenPulseUser } = require("./_auth");

export const config = {
  api: {
    bodyParser: false,
  },
};

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_PAT;
const CHLOES_RESTAURANT_ID = process.env.AIRTABLE_CHLOES_RESTAURANT_ID;

const BLOB_TOKEN =
  process.env.BLOB_READ_WRITE_TOKEN ||
  process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN;

const STOCK_COUNT_SESSIONS_TABLE = "Stock Count Sessions";
const STOCK_COUNT_LINES_TABLE = "Stock Count Lines";

const MAX_COUNT_LINES = Number(process.env.STOCK_COUNT_MAX_LINES || 50);
const MAX_COUNT_QUANTITY = Number(process.env.STOCK_COUNT_MAX_QUANTITY || 1000);
const MAX_ITEM_NAME_LENGTH = 120;
const MAX_STORAGE_AREA_LENGTH = 80;
const MAX_UNIT_LENGTH = 40;
const MAX_LINE_NOTES_LENGTH = 500;
const MAX_SESSION_NOTES_LENGTH = 1000;

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  res.status(statusCode).json(payload);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function truncateText(value, maxLength) {
  return normalizeText(value).slice(0, maxLength);
}

function getFieldValue(fields, key) {
  const value = fields?.[key];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getUploadedFile(files) {
  const file = files?.countPhoto;

  if (Array.isArray(file)) {
    return file[0];
  }

  return file;
}

function safeFileName(name) {
  return String(name || "stock-count")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

function nowText() {
  const now = new Date();

  return `${now.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
  })} ${now.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function buildFallbackSessionName() {
  return `Stock Count - ${nowText()}`;
}

function parseQuantity(value, lineNumber) {
  const cleaned = String(value ?? "").replace(/,/g, "").trim();
  const quantity = Number(cleaned);

  if (!Number.isFinite(quantity)) {
    throw new Error(`Line ${lineNumber}: Count quantity must be a number.`);
  }

  if (quantity <= 0) {
    throw new Error(`Line ${lineNumber}: Count quantity must be greater than zero.`);
  }

  if (quantity > MAX_COUNT_QUANTITY) {
    throw new Error(
      `Line ${lineNumber}: Count quantity ${quantity.toLocaleString()} is too high. Maximum allowed is ${MAX_COUNT_QUANTITY.toLocaleString()}.`
    );
  }

  return quantity;
}

function looksLikeJunkText(value) {
  const text = normalizeText(value).toLowerCase();

  if (!text) {
    return true;
  }

  const compact = text.replace(/[^a-z0-9]+/g, "");

  if (!compact) {
    return true;
  }

  const hardRejects = [
    "fellonkeyboard",
    "keyboardmash",
    "asdf",
    "asdfasdf",
    "qwerty",
    "qwertyuiop",
    "aaaaaaaa",
    "zzzzzzzz",
  ];

  if (hardRejects.includes(compact)) {
    return true;
  }

  if (text.includes("fell on keyboard")) {
    return true;
  }

  if (/^(.)\1{7,}$/.test(compact)) {
    return true;
  }

  return false;
}

function validateItemName(itemName, lineNumber) {
  if (!itemName) {
    throw new Error(`Line ${lineNumber}: Item name is required.`);
  }

  if (itemName.length > MAX_ITEM_NAME_LENGTH) {
    throw new Error(
      `Line ${lineNumber}: Item name is too long. Keep it under ${MAX_ITEM_NAME_LENGTH} characters.`
    );
  }

  if (looksLikeJunkText(itemName)) {
    throw new Error(
      `Line ${lineNumber}: Item name does not look valid. Select or enter a real inventory item.`
    );
  }
}

function validateShortText({ value, maxLength, label, lineNumber }) {
  const text = normalizeText(value);

  if (text.length > maxLength) {
    throw new Error(
      `Line ${lineNumber}: ${label} is too long. Keep it under ${maxLength} characters.`
    );
  }

  return text;
}

function parseLines(rawLines) {
  let parsed;

  try {
    parsed = JSON.parse(String(rawLines || "[]"));
  } catch {
    throw new Error("Count lines were not valid JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Count lines must be an array.");
  }

  if (parsed.length > MAX_COUNT_LINES) {
    throw new Error(
      `Too many count lines submitted at once. Maximum allowed is ${MAX_COUNT_LINES}.`
    );
  }

  const cleanedLines = [];

  parsed.forEach((line, index) => {
    const lineNumber = index + 1;

    const itemName = truncateText(line?.itemName, MAX_ITEM_NAME_LENGTH);
    const storageArea =
      validateShortText({
        value: line?.storageArea || "Other",
        maxLength: MAX_STORAGE_AREA_LENGTH,
        label: "Storage area",
        lineNumber,
      }) || "Other";

    const unit = validateShortText({
      value: line?.unit || "",
      maxLength: MAX_UNIT_LENGTH,
      label: "Count unit",
      lineNumber,
    });

    const notes = truncateText(line?.notes || "", MAX_LINE_NOTES_LENGTH);

    const hasAnyContent =
      itemName ||
      normalizeText(line?.quantity) ||
      unit ||
      storageArea !== "Other" ||
      notes;

    if (!hasAnyContent) {
      return;
    }

    validateItemName(itemName, lineNumber);

    const quantity = parseQuantity(line?.quantity, lineNumber);

    cleanedLines.push({
      itemName,
      storageArea,
      quantity,
      unit,
      notes,
    });
  });

  if (!cleanedLines.length) {
    throw new Error("At least one counted item with a valid quantity is required.");
  }

  return cleanedLines;
}

function chunkArray(items, chunkSize) {
  const chunks = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

async function parseMultipartForm(req, formidable) {
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    maxFileSize: 15 * 1024 * 1024,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({ fields, files });
    });
  });
}

async function airtableRequest({ tableName, method = "POST", body }) {
  const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    tableName
  )}`;

  const response = await fetch(airtableUrl, {
    method,
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.error ||
      `Airtable rejected the ${tableName} request.`;

    const error = new Error(message);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

async function uploadOptionalPhoto({ uploadedFile, put, fs, restaurantSlug }) {
  if (!uploadedFile) {
    return null;
  }

  if (!BLOB_TOKEN) {
    throw new Error(
      "Missing Vercel Blob read/write token. Count photo upload needs BLOB_READ_WRITE_TOKEN."
    );
  }

  if (
    !uploadedFile.filepath ||
    !(uploadedFile.originalFilename || uploadedFile.newFilename) ||
    !uploadedFile.size ||
    Number(uploadedFile.size) <= 0
  ) {
    throw new Error("The count photo was empty or could not be read.");
  }

  const originalFileName =
    uploadedFile.originalFilename || uploadedFile.newFilename || "stock-count";

  const contentType = uploadedFile.mimetype || "application/octet-stream";
  const fileBuffer = fs.readFileSync(uploadedFile.filepath);

  const blobPath = `stock-counts/${restaurantSlug}/${Date.now()}-${safeFileName(
    originalFileName
  )}`;

  const blob = await put(blobPath, fileBuffer, {
    access: "public",
    contentType,
    addRandomSuffix: true,
    token: BLOB_TOKEN,
  });

  if (!blob?.url) {
    throw new Error("Count photo upload failed before Airtable record creation.");
  }

  return {
    url: blob.url,
    filename: originalFileName,
    contentType,
    size: uploadedFile.size,
  };
}

function getOperatorName(auth) {
  return (
    normalizeText(auth?.operatorUser?.displayName) ||
    normalizeText(auth?.email) ||
    "KitchenPulse operator"
  );
}

function getRestaurantRecordId(auth) {
  return normalizeText(auth?.restaurantRecordId) || CHLOES_RESTAURANT_ID || "";
}

function buildRestaurantSlug(auth, restaurantRecordId) {
  return safeFileName(
    normalizeText(auth?.restaurantName) || restaurantRecordId || "restaurant"
  ).toLowerCase();
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      route: "stock-count-submit",
      message: "Stock count submit API is reachable. Use POST to submit counts.",
      tables: {
        sessions: STOCK_COUNT_SESSIONS_TABLE,
        lines: STOCK_COUNT_LINES_TABLE,
      },
      safeguards: {
        authRequiredForPost: true,
        maxLines: MAX_COUNT_LINES,
        maxQuantity: MAX_COUNT_QUANTITY,
      },
    });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      ok: false,
      error: "Method not allowed. Use POST.",
    });
  }

  try {
    const auth = await requireKitchenPulseUser(req, res, {
      source: "mobile",
      minimumRole: "Staff",
      touchLastLogin: false,
    });

    if (!auth) {
      return;
    }

    if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
      return sendJson(res, 500, {
        ok: false,
        error:
          "Missing required environment variables. Check AIRTABLE_BASE_ID and AIRTABLE_PAT or AIRTABLE_TOKEN.",
      });
    }

    const restaurantRecordId = getRestaurantRecordId(auth);

    if (!restaurantRecordId) {
      return sendJson(res, 403, {
        ok: false,
        error:
          "This operator account is not assigned to a restaurant, so stock counts cannot be submitted.",
      });
    }

    let put;
    let formidable;
    let fs;

    try {
      const blobModule = await import("@vercel/blob");
      const formidableModule = await import("formidable");
      const fsModule = await import("fs");

      put = blobModule.put;
      formidable =
        formidableModule.default ||
        formidableModule.formidable ||
        formidableModule.default?.default;
      fs = fsModule.default || fsModule;
    } catch (importError) {
      return sendJson(res, 500, {
        ok: false,
        error:
          "Stock count upload dependencies are missing or failed to load. Make sure @vercel/blob and formidable are installed and redeployed.",
        details: importError.message,
      });
    }

    if (!formidable || !fs) {
      return sendJson(res, 500, {
        ok: false,
        error:
          "Stock count dependencies loaded incorrectly. Check formidable and fs imports.",
      });
    }

    const { fields: formFields, files } = await parseMultipartForm(
      req,
      formidable
    );

    const sessionNameValue = getFieldValue(formFields, "sessionName");
    const clientCounterNameValue = getFieldValue(formFields, "counterName");
    const sessionNotesValue = getFieldValue(formFields, "sessionNotes");
    const rawLines = getFieldValue(formFields, "lines");

    const operatorName = getOperatorName(auth);
    const clientCounterName = normalizeText(clientCounterNameValue);
    const sessionNotes = truncateText(
      sessionNotesValue || "",
      MAX_SESSION_NOTES_LENGTH
    );

    const sessionName =
      typeof sessionNameValue === "string" && sessionNameValue.trim()
        ? sessionNameValue.trim().slice(0, 180)
        : buildFallbackSessionName();

    const lines = parseLines(rawLines);

    const uploadedFile = getUploadedFile(files);
    const restaurantSlug = buildRestaurantSlug(auth, restaurantRecordId);

    const uploadedPhoto = uploadedFile
      ? await uploadOptionalPhoto({
          uploadedFile,
          put,
          fs,
          restaurantSlug,
        })
      : null;

    const countTimeText = nowText();

    const reviewNotes = [
      sessionNotes ? `Staff note: ${sessionNotes}` : "",
      "Mobile stock count submission.",
      "Stock count upload was auth-checked before Airtable record creation.",
      `Submitted by: ${operatorName}`,
      auth?.email ? `Operator email: ${auth.email}` : "",
      auth?.operatorUser?.recordId
        ? `Operator User record: ${auth.operatorUser.recordId}`
        : "",
      clientCounterName && clientCounterName !== operatorName
        ? `Client-supplied counter name: ${clientCounterName}`
        : "",
      `Submitted at: ${countTimeText}`,
      uploadedPhoto?.url ? `Photo URL: ${uploadedPhoto.url}` : "",
      uploadedPhoto?.filename ? `Photo file: ${uploadedPhoto.filename}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const sessionFields = {
      "Session Name": sessionName,
      Restaurant: [restaurantRecordId],
      "Count Date Text": countTimeText,
      "Submitted By": operatorName,
      "Session Status": "Submitted",
      "Review Notes": reviewNotes,
    };

    const sessionData = await airtableRequest({
      tableName: STOCK_COUNT_SESSIONS_TABLE,
      method: "POST",
      body: {
        records: [{ fields: sessionFields }],
        typecast: true,
      },
    });

    const sessionRecord = sessionData?.records?.[0];

    if (!sessionRecord?.id) {
      throw new Error("Airtable did not return a stock count session record ID.");
    }

    const lineRecords = lines.map((line) => {
      const quantityText =
        line.quantity % 1 === 0 ? String(line.quantity) : line.quantity.toFixed(2);

      const lineNotes = [
        line.notes ? line.notes : "",
        uploadedPhoto?.url ? `Photo URL: ${uploadedPhoto.url}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const fields = {
        "Count Line Name": `${line.itemName} - ${quantityText}${
          line.unit ? ` ${line.unit}` : ""
        }`,
        "Stock Count Session": [sessionRecord.id],
        "Count Item Name": line.itemName,
        "Storage Area": line.storageArea || "Other",
        "Count Quantity": line.quantity,
        "Count Unit": line.unit,
        "Count Notes": lineNotes,
        "Count Review State": "Submitted",
        "Approved For Ordering": false,
        "Counter Name": operatorName,
        "Count Time Text": countTimeText,
      };

      if (uploadedPhoto?.url) {
        fields.Photo = [
          {
            url: uploadedPhoto.url,
            filename: uploadedPhoto.filename || "stock-count-photo",
          },
        ];
      }

      return { fields };
    });

    const createdLineRecords = [];

    for (const chunk of chunkArray(lineRecords, 10)) {
      const lineData = await airtableRequest({
        tableName: STOCK_COUNT_LINES_TABLE,
        method: "POST",
        body: {
          records: chunk,
          typecast: true,
        },
      });

      createdLineRecords.push(...(lineData.records || []));
    }

    return sendJson(res, 200, {
      ok: true,
      message: "Stock count submitted for review.",
      sessionId: sessionRecord.id,
      sessionName,
      lineCount: createdLineRecords.length,
      photoUrl: uploadedPhoto?.url || "",
      operator: {
        email: auth.email || "",
        displayName: operatorName,
        role: auth.role || "",
      },
      safeguards: {
        maxQuantity: MAX_COUNT_QUANTITY,
        maxLines: MAX_COUNT_LINES,
      },
    });
  } catch (error) {
    console.error("Stock count submit error:", error);

    return sendJson(res, error.status || 500, {
      ok: false,
      error: error.message || "Unexpected stock count submit error.",
      details: error.details || null,
    });
  }
}
