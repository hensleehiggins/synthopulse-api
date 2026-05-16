export const config = {
  api: {
    bodyParser: true,
  },
};

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_PAT;
const CHLOES_RESTAURANT_ID = process.env.AIRTABLE_CHLOES_RESTAURANT_ID;

const VENDOR_RECEIPTS_TABLE = "Vendor Receipts";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
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

    const {
      receiptName,
      vendor,
      receiptDate,
      notes,
      fileName,
      fileType,
      fileSize,
    } = req.body || {};

    if (!fileName) {
      return sendJson(res, 400, {
        ok: false,
        error: "A receipt file name is required before staging.",
      });
    }

    const finalReceiptName =
      typeof receiptName === "string" && receiptName.trim()
        ? receiptName.trim()
        : buildFallbackReceiptName();

    const fileSizeText = fileSize
      ? `${Math.round(Number(fileSize) / 1024).toLocaleString()} KB`
      : "Unknown size";

    const intakeNotes = [
      notes ? `Staff note: ${notes}` : "",
      "Initial Vibe upload staging pass.",
      `Uploaded file pending attachment wiring: ${fileName}`,
      fileType ? `File type: ${fileType}` : "",
      `File size: ${fileSizeText}`,
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
        error: "Airtable rejected the receipt staging request.",
        details: airtableData,
      });
    }

    const createdRecord = airtableData?.records?.[0];

    return sendJson(res, 200, {
      ok: true,
      message: "Receipt staged for review.",
      recordId: createdRecord?.id,
      receiptName: finalReceiptName,
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: error.message || "Unexpected receipt intake error.",
    });
  }
}
