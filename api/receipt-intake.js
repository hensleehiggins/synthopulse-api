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

function buildFallbackReceiptName() {
  const now = new Date();

  return `Receipt Upload — ${now.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
  })} ${now.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function getFieldValue(fields, key) {
  const value = fields?.[key];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getUploadedFile(files) {
  const file = files?.receiptFile;

  if (Array.isArray(file)) {
    return file[0];
  }

  return file;
}

function safeFileName(name) {
  return String(name || "receipt")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 120);
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

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      route: "receipt-intake",
      message: "Receipt intake API is reachable. Use POST to submit a receipt.",
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

    if (!BLOB_TOKEN) {
  return sendJson(res, 500, {
    ok: false,
    error:
      "Missing Vercel Blob read/write token. Check that the public Blob store is connected to this project for Production and Preview.",
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

    const uploadedFile = getUploadedFile(files);

    if (
  !uploadedFile ||
  !uploadedFile.filepath ||
  !(uploadedFile.originalFilename || uploadedFile.newFilename) ||
  !uploadedFile.size ||
  Number(uploadedFile.size) <= 0
) {
  return sendJson(res, 400, {
    ok: false,
    error: "A receipt photo, PDF, or file is required before submitting.",
  });
}

    const receiptName = getFieldValue(formFields, "receiptName");
    const vendor = getFieldValue(formFields, "vendor");
    const receiptDate = getFieldValue(formFields, "receiptDate");
    const notes = getFieldValue(formFields, "notes");

    const originalFileName =
      uploadedFile.originalFilename || uploadedFile.newFilename || "receipt";

    const contentType = uploadedFile.mimetype || "application/octet-stream";

    const finalReceiptName =
      typeof receiptName === "string" && receiptName.trim()
        ? receiptName.trim()
        : buildFallbackReceiptName();

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
  return sendJson(res, 500, {
    ok: false,
    error: "Receipt file upload failed before Airtable record creation.",
  });
}

    const fileSizeText = uploadedFile.size
      ? `${Math.round(Number(uploadedFile.size) / 1024).toLocaleString()} KB`
      : "Unknown size";

    const intakeNotes = [
      notes ? `Staff note: ${notes}` : "",
      "Initial Vibe receipt upload.",
      `Uploaded file attached: ${originalFileName}`,
      contentType ? `File type: ${contentType}` : "",
      `File size: ${fileSizeText}`,
      `Blob URL: ${blob.url}`,
    ]
      .filter(Boolean)
      .join("\n");

    const fields = {
      "Receipt Name": finalReceiptName,
      Restaurant: [CHLOES_RESTAURANT_ID],
      Source: "Owner Upload",
      "Processing Status": "Staged",
      "Review Needed": true,
      Approved: false,
      Notes: intakeNotes,
      "Uploaded File": [
        {
          url: blob.url,
          filename: originalFileName,
        },
      ],
    };

    if (vendor && String(vendor).trim()) {
      fields.Vendor = String(vendor).trim();
    }

    if (receiptDate && String(receiptDate).trim()) {
      fields["Receipt Date"] = String(receiptDate).trim();
    }

    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
      VENDOR_RECEIPTS_TABLE
    )}`;

    const airtableResponse = await fetch(airtableUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: [{ fields }],
        typecast: true,
      }),
    });

    const airtableData = await airtableResponse.json();

    if (!airtableResponse.ok) {
      return sendJson(res, airtableResponse.status, {
        ok: false,
        error: "Airtable rejected the receipt upload request.",
        details: airtableData,
      });
    }

    const createdRecord = airtableData?.records?.[0];

    return sendJson(res, 200, {
      ok: true,
      message: "Receipt submitted for review.",
      recordId: createdRecord?.id,
      receiptName: finalReceiptName,
      fileName: originalFileName,
      fileUrl: blob.url,
    });
  } catch (error) {
    console.error("Receipt intake error:", error);

    return sendJson(res, 500, {
      ok: false,
      error: error.message || "Unexpected receipt intake error.",
      stack: error.stack,
    });
  }
}
