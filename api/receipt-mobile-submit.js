const { requireKitchenPulseUser } = require("./_auth");

export const config = {
  api: {
    bodyParser: false,
  },
};

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_PAT;
const CHLOES_RESTAURANT_ID = process.env.AIRTABLE_CHLOES_RESTAURANT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

function getHeader(req, name) {
  const target = String(name || "").toLowerCase();
  const headers = req.headers || {};

  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === target) {
      return Array.isArray(value) ? value[0] : value;
    }
  }

  return "";
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

function isHeicUpload(uploadedFile) {
  const fileName = String(
    uploadedFile?.originalFilename || uploadedFile?.newFilename || ""
  ).toLowerCase();

  const mimeType = String(uploadedFile?.mimetype || "").toLowerCase();

  return (
    fileName.endsWith(".heic") ||
    fileName.endsWith(".heif") ||
    mimeType.includes("heic") ||
    mimeType.includes("heif")
  );
}

function makeHeicError() {
  const error = new Error(
    "This photo is still in iPhone HEIC format. Retake or choose the photo again so KitchenPulse can convert it to JPEG before processing."
  );

  error.status = 415;
  error.errorType = "heic_upload_not_supported";

  return error;
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
  const vendor = normalizeText(vendorName);
  const date = safeDate(receiptDate) || new Date().toISOString().slice(0, 10);
  const label = vendor ? `${vendor} receipt` : "Mobile receipt";

  return `${label} - ${date} - ${nowText()}`.slice(0, 180);
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

function parseJsonFromModelText(text) {
  const raw = String(text || "").trim();

  if (!raw) {
    throw new Error("OpenAI returned an empty document preflight response.");
  }

  try {
    return JSON.parse(raw);
  } catch (directError) {
    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("OpenAI document preflight response did not contain JSON.");
    }

    return JSON.parse(match[0]);
  }
}

function extractOpenAIText(openAiData) {
  if (typeof openAiData?.output_text === "string") {
    return openAiData.output_text;
  }

  const output = Array.isArray(openAiData?.output) ? openAiData.output : [];
  const textParts = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const contentItem of content) {
      if (typeof contentItem?.text === "string") {
        textParts.push(contentItem.text);
      }
    }
  }

  return textParts.join("\n").trim();
}

function buildDocumentPreflightPrompt({ fileName, contentType }) {
  return `
You are checking an upload for KitchenPulse Receipt Intake.

Return ONLY valid JSON. No markdown. No commentary.

Decide whether this file is a restaurant vendor receipt, invoice, or purchase document showing items actually bought.

Accept:
- vendor receipt
- vendor invoice
- purchase receipt
- delivery invoice
- restaurant supply receipt with quantities/prices/totals

Reject:
- catalog
- product list
- price sheet
- order guide
- menu
- marketing flyer
- sales sheet
- vendor product brochure
- random screenshot
- app screenshot
- camera roll screenshot
- giant product table that does not show a specific purchase
- text, notes, keyboard mashing, or other non-receipt content

Important:
- Large real invoices are allowed.
- Do not reject just because there are many line items.
- Reject only when the document is not a receipt/invoice/purchase record.
- Catalog-like documents often have columns such as Supplier Name, Item #, Brand, Product, Pack, Size, Tokens, or long product lists without purchase totals.
- If uncertain but it looks like a real purchase document, allow it.
- If the image is clearly not a receipt or invoice, reject it.

JSON shape:
{
  "documentType": "receipt_invoice" | "catalog_or_price_sheet" | "menu" | "order_guide" | "screenshot" | "unknown",
  "isReceiptOrInvoice": true,
  "confidence": "High" | "Medium" | "Low",
  "reason": "short reason",
  "userMessage": "short message suitable for the upload UI"
}

File metadata:
- Uploaded filename: ${fileName || ""}
- Content type: ${contentType || ""}
`.trim();
}

function isUnsupportedPreflightResult(result) {
  const documentType = String(result?.documentType || "").toLowerCase();
  const isReceiptOrInvoice = result?.isReceiptOrInvoice;

  if (isReceiptOrInvoice === false) return true;

  return [
    "catalog_or_price_sheet",
    "catalog",
    "price_sheet",
    "product_list",
    "order_guide",
    "menu",
    "marketing_flyer",
    "sales_sheet",
    "screenshot",
    "unknown_non_receipt",
  ].includes(documentType);
}

function unsupportedPreflightMessage(result) {
  return (
    String(result?.userMessage || "").trim() ||
    String(result?.reason || "").trim() ||
    "This does not look like a vendor receipt or invoice. Upload a clear receipt or invoice showing items actually purchased."
  );
}

async function callOpenAIForDocumentPreflight({
  fileUrl,
  fileName,
  contentType,
}) {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY for receipt upload preflight.");
  }

  const prompt = buildDocumentPreflightPrompt({ fileName, contentType });

  const content = [
    {
      type: "input_text",
      text: prompt,
    },
  ];

  if (String(contentType || "").toLowerCase().includes("pdf")) {
    content.push({
      type: "input_file",
      file_url: fileUrl,
    });
  } else {
    content.push({
      type: "input_image",
      image_url: fileUrl,
      detail: "high",
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_RECEIPT_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content,
        },
      ],
      max_output_tokens: 800,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data,
    };
  }

  const text = extractOpenAIText(data);
  const parsed = parseJsonFromModelText(text);

  return {
    ok: true,
    status: 200,
    data,
    parsed,
  };
}

async function uploadReceiptPhoto({ uploadedFile, put, fs }) {
  if (!uploadedFile) {
    throw new Error("Receipt photo is required.");
  }

  if (isHeicUpload(uploadedFile)) {
    throw makeHeicError();
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

async function deleteUploadedPhoto({ uploadedPhoto, del }) {
  if (!uploadedPhoto?.url || !del || !BLOB_TOKEN) {
    return;
  }

  try {
    await del(uploadedPhoto.url, { token: BLOB_TOKEN });
  } catch (error) {
    console.error("Could not delete rejected mobile receipt blob:", error);
  }
}

async function createVendorReceiptRecord({
  uploadedPhoto,
  vendorName,
  receiptDate,
  notes,
  auth,
  preflight,
}) {
  const normalizedVendor = normalizeText(vendorName);
  const normalizedDate = safeDate(receiptDate);
  const normalizedNotes = normalizeText(notes);
  const submittedAt = new Date().toISOString();
  const restaurantRecordId =
    auth?.restaurantRecordId || CHLOES_RESTAURANT_ID;

  const operatorName =
    normalizeText(auth?.operatorUser?.displayName) ||
    normalizeText(auth?.email) ||
    "KitchenPulse operator";

  const noteParts = [
    "Submitted from KitchenPulse Operator mobile app.",
    "Mobile receipt uploads are auth-checked and document-preflighted before Airtable receipt creation.",
    "Vendor/date are optional because KitchenPulse reads them from the image when possible.",
    "Operator tip shown in app: right-side-up photos process faster.",
    `Submitted by: ${operatorName}`,
    auth?.email ? `Operator email: ${auth.email}` : "",
    auth?.operatorUser?.recordId
      ? `Operator User record: ${auth.operatorUser.recordId}`
      : "",
    normalizedNotes ? `Staff note: ${normalizedNotes}` : "",
    preflight?.reason ? `Upload preflight: ${preflight.reason}` : "",
    preflight?.confidence ? `Upload preflight confidence: ${preflight.confidence}` : "",
    `Submitted at: ${submittedAt}`,
    uploadedPhoto?.url ? `Photo URL: ${uploadedPhoto.url}` : "",
    uploadedPhoto?.filename ? `Photo file: ${uploadedPhoto.filename}` : "",
  ];

  const fields = {
    "Receipt Name": buildReceiptName({
      vendorName: normalizedVendor,
      receiptDate: normalizedDate,
    }),
    Restaurant: [restaurantRecordId],
    Source: "Mobile App",
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
  const authorization = getHeader(req, "authorization");

  const response = await fetch(parseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
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
    const auth = await requireKitchenPulseUser(req, res, {
      source: "mobile",
      minimumRole: "Staff",
      touchLastLogin: false,
    });

    if (!auth) {
      return;
    }

    if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN || !CHLOES_RESTAURANT_ID) {
      return sendJson(res, 500, {
        ok: false,
        error:
          "Missing required environment variables. Check AIRTABLE_BASE_ID, AIRTABLE_PAT or AIRTABLE_TOKEN, and AIRTABLE_CHLOES_RESTAURANT_ID.",
      });
    }

    if (!OPENAI_API_KEY) {
      return sendJson(res, 500, {
        ok: false,
        error:
          "Missing OPENAI_API_KEY. Mobile receipt upload needs document preflight before creating Airtable records.",
      });
    }

    let put;
    let del;
    let formidable;
    let fs;

    try {
      const blobModule = await import("@vercel/blob");
      const formidableModule = await import("formidable");
      const fsModule = await import("fs");

      put = blobModule.put;
      del = blobModule.del;
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

    if (!put || !formidable || !fs) {
      return sendJson(res, 500, {
        ok: false,
        error:
          "Receipt upload dependencies loaded incorrectly. Check @vercel/blob, formidable, and fs imports.",
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

    const preflightResult = await callOpenAIForDocumentPreflight({
      fileUrl: uploadedPhoto.url,
      fileName: uploadedPhoto.filename,
      contentType: uploadedPhoto.contentType,
    });

    if (!preflightResult.ok) {
      await deleteUploadedPhoto({ uploadedPhoto, del });

      return sendJson(res, preflightResult.status || 500, {
        ok: false,
        error:
          "KitchenPulse could not verify this upload as a receipt or invoice. Try a clearer receipt photo or invoice file.",
        errorType: "receipt_preflight_failed",
        details: preflightResult.data,
      });
    }

    if (isUnsupportedPreflightResult(preflightResult.parsed)) {
      const message = unsupportedPreflightMessage(preflightResult.parsed);

      await deleteUploadedPhoto({ uploadedPhoto, del });

      return sendJson(res, 422, {
        ok: false,
        errorType: "unsupported_document_type",
        error: message,
        documentType: preflightResult.parsed?.documentType || "unsupported",
        confidence: preflightResult.parsed?.confidence || "",
      });
    }

    const receiptRecord = await createVendorReceiptRecord({
      uploadedPhoto,
      vendorName,
      receiptDate,
      notes,
      auth,
      preflight: preflightResult.parsed,
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
      preflight: preflightResult.parsed || null,
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
      errorType: error.errorType || "receipt_mobile_submit_failed",
      details: error.details || null,
    });
  }
}
