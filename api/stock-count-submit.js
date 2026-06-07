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

  return parsed
    .map((line) => {
      const itemName = String(line?.itemName || "").trim();
      const storageArea = String(line?.storageArea || "Other").trim();
      const quantityNumber = Number(line?.quantity);
      const unit = String(line?.unit || "").trim();
      const notes = String(line?.notes || "").trim();

      return {
        itemName,
        storageArea,
        quantity: Number.isFinite(quantityNumber) ? quantityNumber : null,
        unit,
        notes,
      };
    })
    .filter((line) => {
      return line.itemName && line.quantity !== null && line.quantity > 0;
    });
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

async function uploadOptionalPhoto({ uploadedFile, put, fs }) {
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

  const blobPath = `stock-counts/chloes/${Date.now()}-${safeFileName(
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
    });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      ok: false,
      error: "Method not allowed. Use POST.",
    });
  }

  try {
    if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN || !CHLOES_RESTAURANT_ID) {
      return sendJson(res, 500, {
        ok: false,
        error:
          "Missing required environment variables. Check AIRTABLE_BASE_ID, AIRTABLE_PAT or AIRTABLE_TOKEN, and AIRTABLE_CHLOES_RESTAURANT_ID.",
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
    const counterNameValue = getFieldValue(formFields, "counterName");
    const sessionNotesValue = getFieldValue(formFields, "sessionNotes");
    const rawLines = getFieldValue(formFields, "lines");

    const counterName = String(counterNameValue || "").trim();
    const sessionNotes = String(sessionNotesValue || "").trim();
    const sessionName =
      typeof sessionNameValue === "string" && sessionNameValue.trim()
        ? sessionNameValue.trim()
        : buildFallbackSessionName();

    if (!counterName) {
      return sendJson(res, 400, {
        ok: false,
        error: "Counter name is required.",
      });
    }

    const lines = parseLines(rawLines);

    if (!lines.length) {
      return sendJson(res, 400, {
        ok: false,
        error: "At least one counted item with a quantity is required.",
      });
    }

    const uploadedFile = getUploadedFile(files);
    const uploadedPhoto = uploadedFile
      ? await uploadOptionalPhoto({ uploadedFile, put, fs })
      : null;

    const countTimeText = nowText();

    const reviewNotes = [
      sessionNotes ? `Staff note: ${sessionNotes}` : "",
      "Initial mobile stock count submission.",
      `Counter: ${counterName}`,
      `Submitted at: ${countTimeText}`,
      uploadedPhoto?.url ? `Photo URL: ${uploadedPhoto.url}` : "",
      uploadedPhoto?.filename ? `Photo file: ${uploadedPhoto.filename}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const sessionFields = {
      "Session Name": sessionName,
      Restaurant: [CHLOES_RESTAURANT_ID],
      "Count Date Text": countTimeText,
      "Submitted By": counterName,
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
        "Counter Name": counterName,
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
    });
  } catch (error) {
    console.error("Stock count submit error:", error);

    return sendJson(res, error.status || 500, {
      ok: false,
      error: error.message || "Unexpected stock count submit error.",
      details: error.details || null,
      stack: error.stack,
    });
  }
}
