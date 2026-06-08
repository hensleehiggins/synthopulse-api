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

const VENDOR_RECEIPTS_TABLE = "Vendor Receipts";

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
  const file =
    files?.receiptPhoto ||
    files?.photo ||
    files?.receipt ||
    files?.uploadedFile;

  if (Array.isArray(file)) {
    return file[0];
  }

  return file;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function safeFileName(name) {
  return String(name || "receipt")
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

function safeDate(value) {
  const text = normalizeText(value);

  if (!text) {
    return "";
  }

  const slashMatch = text.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})\b/);

  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    let year = Number(slashMatch[3]);

    if (year < 100) {
      year += year >= 70 ? 1900 : 2000;
    }

    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    ) {
      return [
        String(year).padStart(4, "0"),
        String(month).padStart(2, "0"),
        String(day).padStart(2, "0"),
      ].join("-");
    }

    return "";
  }

  const parsed = new Date(text);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

function buildReceiptName({ vendorName, receiptDate }) {
  const vendor = normalizeText(vendorName) || "Mobile receipt";
  const date = safeDate(receiptDate) || new Date().toISOString().slice(0, 10);

  return `${vendor} receipt - ${date} - ${nowText()}`.slice(0, 180);
}

function buildParseUrl(req) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;

  return `${protocol}://${host}/api/receipt-parse`;
}

async function parseMultipartForm(req, formidable) {
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    maxFileSize: 20 * 1024 * 1024,
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

async function uploadReceiptPhoto({ uploadedFile, put, fs }) {
  if (!uploadedFile) {
    throw new Error("Receipt photo is required.");
  }

  if (!BLOB_TOKEN) {
    throw new Error(
      "Missing Vercel Blob read/write token. Receipt upload needs BLOB_READ_WRITE_TOKEN."
    );
  }

  if (
    !uploadedFile.filepath ||
    !(uploadedFile.originalFilename || uploadedFile.newFilename) ||
    !uploadedFile.size ||
    Number(uploadedFile.size) <= 0
  ) {
    throw new Error("The receipt photo was empty or could not be read.");
  }

  const originalFileName =
    uploadedFile.originalFilename || uploadedFile.newFilename || "receipt-photo.jpg";

  const contentType = uploadedFile.mimetype || "image/jpeg";
  const fileBuffer = fs.readFileSync(uploadedFile.filepath);

  const blobPath = `receipts/chloes/${Date.now()}-${safeFileName(
    originalFileName
  )}`;

  const blob = await put(blobPath, fileBuffer, {
    access: "public",
    contentType,
    addRandomSuffix: true,
    token: BLOB_TOKEN,
  });

  if (!blob?.url) {
    throw new Error("Receipt photo upload failed before Airtable record creation.");
  }

  return {
    url: blob.url,
    filename: originalFileName,
    contentType,
    size: uploadedFile.size,
  };
}

async function createVendorReceiptRecord({
  uploadedPhoto,
  vendorName,
  receiptDate,
  notes,
}) {
  const normalizedVendor = normalizeText(vendorName);
  const normalizedDate = safeDate(receiptDate);
  const normalizedNotes = normalizeText(notes);
  const submittedAt = new Date().toISOString();

  const noteParts = [
    "Submitted from KitchenPulse Operator mobile app.",
    "Mobile receipt uploads are parser-first. Vendor/date are optional because KitchenPulse reads them from the image when possible.",
    "Operator tip shown in app: right-side-up photos process faster.",
    normalizedNotes ? `Staff note: ${normalizedNotes}` : "",
    `Submitted at: ${submittedAt}`,
    uploadedPhoto?.url ? `Photo URL: ${uploadedPhoto.url}` : "",
    uploadedPhoto?.filename ? `Photo file: ${uploadedPhoto.filename}` : "",
  ];

  const fields = {
    "Receipt Name": buildReceiptName({
      vendorName: normalizedVendor,
      receiptDate: normalizedDate,
    }),
    Restaurant: [CHLOES_RESTAURANT_ID],
    "Processing Status": "Parsing",
    "Review Needed": true,
    Approved: true,
    Notes: noteParts.filter(Boolean).join("\n"),
    "Uploaded File": [
      {
        url: uploadedPhoto.url,
        filename: uploadedPhoto.filename || "receipt-photo.jpg",
      },
    ],
  };

  if (normalizedVendor) {
    fields.Vendor = normalizedVendor;
  }

  if (normalizedDate) {
    fields["Receipt Date"] = normalizedDate;
  }

  const data = await airtableRequest({
    tableName: VENDOR_RECEIPTS_TABLE,
    method: "POST",
    body: {
      records: [{ fields }],
      typecast: true,
    },
  });

  const record = data?.records?.[0];

  if (!record?.id) {
    throw new Error("Airtable did not return a Vendor Receipts record ID.");
  }

  return {
    id: record.id,
    fields: record.fields || {},
  };
}

async function parseReceiptNow({ req, recordId }) {
  const parseUrl = buildParseUrl(req);

  const response = await fetch(parseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recordId,
    }),
  });

  const data = await response.json().catch(() => ({}));

  return {
    ok: response.ok && data?.ok !== false,
    status: response.status,
    data,
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
      route: "receipt-mobile-submit",
      message:
        "Receipt mobile submit API is reachable. Use POST with receiptPhoto.",
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
          "Receipt upload dependencies are missing or failed to load. Make sure @vercel/blob and formidable are installed and redeployed.",
        details: importError.message,
      });
    }

    if (!formidable || !fs) {
      return sendJson(res, 500, {
        ok: false,
        error:
          "Receipt upload dependencies loaded incorrectly. Check formidable and fs imports.",
      });
    }

    const { fields: formFields, files } = await parseMultipartForm(
      req,
      formidable
    );

    const vendorName = getFieldValue(formFields, "vendorName");
    const receiptDate = getFieldValue(formFields, "receiptDate");
    const notes = getFieldValue(formFields, "notes");
    const uploadedFile = getUploadedFile(files);

    const uploadedPhoto = await uploadReceiptPhoto({
      uploadedFile,
      put,
      fs,
    });

    const receiptRecord = await createVendorReceiptRecord({
      uploadedPhoto,
      vendorName,
      receiptDate,
      notes,
    });

    const parseResult = await parseReceiptNow({
      req,
      recordId: receiptRecord.id,
    });

    if (!parseResult.ok) {
      return sendJson(res, parseResult.status || 500, {
        ok: false,
        error:
          parseResult.data?.error ||
          "Receipt was uploaded, but KitchenPulse could not parse it.",
        errorType: parseResult.data?.errorType || "receipt_parse_failed",
        recordId: receiptRecord.id,
        receiptName:
          receiptRecord.fields?.["Receipt Name"] || "Mobile receipt upload",
        parser: parseResult.data || null,
      });
    }

    return sendJson(res, 200, {
      ok: true,
      message: "Receipt sent for processing.",
      recordId: receiptRecord.id,
      receiptName:
        receiptRecord.fields?.["Receipt Name"] || "Mobile receipt upload",
      parsedVendor: parseResult.data?.parsedVendor || "",
      parsedReceiptDate: parseResult.data?.parsedReceiptDate || "",
      parsedTotalAmount: parseResult.data?.parsedTotalAmount ?? null,
      lineCount: parseResult.data?.lineCount || 0,
      transformApplied: parseResult.data?.transformApplied || "",
      orientationNeedsReview: Boolean(parseResult.data?.orientationNeedsReview),
      parser: {
        parserVersion: parseResult.data?.parserVersion || "",
        orientationConfidence: parseResult.data?.orientationConfidence || "",
        orientationLineCount: parseResult.data?.orientationLineCount || 0,
      },
    });
  } catch (error) {
    console.error("Receipt mobile submit error:", error);

    return sendJson(res, error.status || 500, {
      ok: false,
      error: error.message || "Unexpected receipt submit error.",
      details: error.details || null,
      stack: error.stack,
    });
  }
}
