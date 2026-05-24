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
- giant product table that does not show a specific purchase

Important:
- Large real invoices are allowed.
- Do not reject just because there are many line items.
- Reject only when the document is not a receipt/invoice/purchase record.
- Catalog-like documents often have columns such as Supplier Name, Item #, Brand, Product, Pack, Size, Tokens, or long product lists without purchase totals.
- If uncertain but it looks like a real purchase document, allow it.

JSON shape:
{
  "documentType": "receipt_invoice" | "catalog_or_price_sheet" | "menu" | "order_guide" | "unknown",
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
  ].includes(documentType);
}

function unsupportedPreflightMessage(result) {
  return (
    String(result?.userMessage || "").trim() ||
    String(result?.reason || "").trim() ||
    "This looks like a vendor catalog, product list, menu, order guide, or price sheet rather than a receipt or invoice. Upload a vendor receipt or invoice showing items actually purchased."
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

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    const mode = req.query?.mode;

    if (mode === "recent") {
      if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN || !CHLOES_RESTAURANT_ID) {
        return sendJson(res, 500, {
          ok: false,
          error:
            "Missing required environment variables. Check AIRTABLE_BASE_ID, AIRTABLE_PAT or AIRTABLE_TOKEN, and AIRTABLE_CHLOES_RESTAURANT_ID.",
        });
      }

      const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
        VENDOR_RECEIPTS_TABLE
      )}?pageSize=25`;

      const airtableResponse = await fetch(airtableUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      const airtableData = await airtableResponse.json();

      if (!airtableResponse.ok) {
        return sendJson(res, airtableResponse.status, {
          ok: false,
          error: "Airtable rejected the recent receipts request.",
          details: airtableData,
        });
      }

      const records = Array.isArray(airtableData?.records)
        ? airtableData.records
        : [];

      const recentReceipts = records
        .filter((record) => {
          const fields = record.fields || {};
          const status = fields["Processing Status"];
          const restaurantLinks = fields.Restaurant || [];
          const hasRestaurant = restaurantLinks.includes(CHLOES_RESTAURANT_ID);

          return hasRestaurant && status !== "Error";
        })
        .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime))
        .slice(0, 5)
        .map((record) => {
          const fields = record.fields || {};
          const uploadedFiles = fields["Uploaded File"] || [];
          const firstFile = uploadedFiles[0];

          return {
            id: record.id,
            createdTime: record.createdTime,
            receiptName: fields["Receipt Name"] || "Receipt upload",
            vendor: fields.Vendor || "",
            receiptDate: fields["Receipt Date"] || "",
            processingStatus: fields["Processing Status"] || "Staged",
            reviewNeeded: Boolean(fields["Review Needed"]),
            approved: Boolean(fields.Approved),
            fileName: firstFile?.filename || "",
            fileUrl: firstFile?.url || "",
          };
        });

      return sendJson(res, 200, {
        ok: true,
        receipts: recentReceipts,
      });
    }

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
    if (
      !AIRTABLE_BASE_ID ||
      !AIRTABLE_TOKEN ||
      !CHLOES_RESTAURANT_ID ||
      !OPENAI_API_KEY
    ) {
      return sendJson(res, 500, {
        ok: false,
        error:
          "Missing required environment variables. Check AIRTABLE_BASE_ID, AIRTABLE_PAT or AIRTABLE_TOKEN, AIRTABLE_CHLOES_RESTAURANT_ID, and OPENAI_API_KEY.",
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

    const preflightResult = await callOpenAIForDocumentPreflight({
      fileUrl: blob.url,
      fileName: originalFileName,
      contentType,
    });

    if (!preflightResult.ok) {
      try {
        if (del && blob?.url) {
          await del(blob.url, { token: BLOB_TOKEN });
        }
      } catch (deleteError) {
        console.error("Could not delete blob after failed preflight:", deleteError);
      }

      return sendJson(res, preflightResult.status || 500, {
        ok: false,
        error:
          "KitchenPulse could not verify this upload as a receipt or invoice. Try a clearer receipt photo or invoice file.",
        details: preflightResult.data,
      });
    }

    if (isUnsupportedPreflightResult(preflightResult.parsed)) {
      const message = unsupportedPreflightMessage(preflightResult.parsed);

      try {
        if (del && blob?.url) {
          await del(blob.url, { token: BLOB_TOKEN });
        }
      } catch (deleteError) {
        console.error("Could not delete unsupported upload blob:", deleteError);
      }

      return sendJson(res, 422, {
        ok: false,
        errorType: "unsupported_document_type",
        error: message,
        documentType: preflightResult.parsed?.documentType || "unsupported",
        confidence: preflightResult.parsed?.confidence || "",
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
      preflightResult.parsed?.reason
        ? `Upload preflight: ${preflightResult.parsed.reason}`
        : "",
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
      try {
        if (del && blob?.url) {
          await del(blob.url, { token: BLOB_TOKEN });
        }
      } catch (deleteError) {
        console.error("Could not delete blob after Airtable failure:", deleteError);
      }

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
      preflight: preflightResult.parsed || null,
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
