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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  res.status(statusCode).json(payload);
}

function requireEnv(res) {
  if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN || !CHLOES_RESTAURANT_ID) {
    sendJson(res, 500, {
      ok: false,
      error:
        "Missing required environment variables. Check AIRTABLE_BASE_ID, AIRTABLE_PAT or AIRTABLE_TOKEN, and AIRTABLE_CHLOES_RESTAURANT_ID.",
    });

    return false;
  }

  return true;
}

function formatReviewNote(action, reviewerNote) {
  const now = new Date().toISOString();

  const actionLabel =
  action === "approve"
    ? "Approved"
    : action === "reject"
    ? "Rejected"
    : action === "archive"
    ? "Archived"
    : "Returned to review";

  const noteParts = [
    `REVIEW ACTION ${now}: ${actionLabel} from KitchenPulse Receipt Review.`,
    reviewerNote ? `Reviewer note: ${reviewerNote}` : "",
  ];

  return noteParts.filter(Boolean).join("\n");
}

async function fetchReceiptRecords() {
  const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    VENDOR_RECEIPTS_TABLE
  )}?pageSize=50`;

  const airtableResponse = await fetch(airtableUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  const airtableData = await airtableResponse.json();

  if (!airtableResponse.ok) {
    return {
      ok: false,
      status: airtableResponse.status,
      data: airtableData,
    };
  }

  return {
    ok: true,
    status: 200,
    data: airtableData,
  };
}

function mapReceipt(record) {
  const fields = record.fields || {};
  const uploadedFiles = fields["Uploaded File"] || [];
  const firstFile = uploadedFiles[0];

  return {
    id: record.id,
    createdTime: record.createdTime,
    receiptName: fields["Receipt Name"] || "Receipt upload",
    restaurant: fields.Restaurant || [],
    vendor: fields.Vendor || "",
    receiptDate: fields["Receipt Date"] || "",
    processingStatus: fields["Processing Status"] || "Staged",
    reviewNeeded: Boolean(fields["Review Needed"]),
    approved: Boolean(fields.Approved),
    totalAmount: fields["Total Amount"] || null,
    errorMessage: fields["Error Message"] || "",
    processedAt: fields["Processed At"] || "",
    notes: fields.Notes || "",
    archived: Boolean(fields.Archived),
    fileName: firstFile?.filename || "",
    fileUrl: firstFile?.url || "",
  };
}

async function updateReceiptReview({
  recordId,
  action,
  reviewerNote,
  existingNotes,
}) {
  const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    VENDOR_RECEIPTS_TABLE
  )}`;

  const reviewNote = formatReviewNote(action, reviewerNote);
  const nextNotes = [existingNotes || "", reviewNote].filter(Boolean).join("\n\n");

  let fields = {
    Notes: nextNotes,
    "Processed At": new Date().toISOString(),
  };

  if (action === "approve") {
    fields = {
      ...fields,
      "Processing Status": "Approved",
      "Review Needed": false,
      Approved: true,
      "Error Message": "",
    };
  }

  if (action === "reject") {
    fields = {
      ...fields,
      "Processing Status": "Rejected",
      "Review Needed": false,
      Approved: false,
      "Error Message":
        reviewerNote ||
        "Receipt was rejected during manual review. No downstream updates were made.",
    };
  }

  if (action === "needs_review") {
    fields = {
      ...fields,
      "Processing Status": "Needs Review",
      "Review Needed": true,
      Approved: false,
    };
  }

  if (action === "archive") {
    fields = {
    ...fields,
    Archived: true,
    };
}

  const airtableResponse = await fetch(airtableUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      records: [
        {
          id: recordId,
          fields,
        },
      ],
      typecast: true,
    }),
  });

  const airtableData = await airtableResponse.json();

  if (!airtableResponse.ok) {
    return {
      ok: false,
      status: airtableResponse.status,
      data: airtableData,
    };
  }

  return {
    ok: true,
    status: 200,
    data: airtableData,
  };
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!requireEnv(res)) {
    return;
  }

  if (req.method === "GET") {
    try {
      const result = await fetchReceiptRecords();

      if (!result.ok) {
        return sendJson(res, result.status, {
          ok: false,
          error: "Airtable rejected the receipt review list request.",
          details: result.data,
        });
      }

      const records = Array.isArray(result.data?.records)
        ? result.data.records
        : [];

      const receipts = records
        .map(mapReceipt)
        .filter((receipt) => {
          const hasRestaurant = receipt.restaurant.includes(
            CHLOES_RESTAURANT_ID
          );

          const isLegacyFailedTest =
            receipt.processingStatus === "Error" && !receipt.fileUrl;

          return hasRestaurant && !isLegacyFailedTest;
        })
        .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

      const pendingCount = receipts.filter(
        (receipt) => receipt.reviewNeeded && !receipt.approved
      ).length;

      const approvedCount = receipts.filter(
        (receipt) => receipt.approved
      ).length;

      const rejectedCount = receipts.filter(
        (receipt) => receipt.processingStatus === "Rejected"
      ).length;

      return sendJson(res, 200, {
        ok: true,
        counts: {
          total: receipts.length,
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
        },
        receipts,
      });
    } catch (error) {
      console.error("Receipt review GET error:", error);

      return sendJson(res, 500, {
        ok: false,
        error: error.message || "Unexpected receipt review list error.",
      });
    }
  }

  if (req.method === "POST") {
    try {
      const recordId = req.body?.recordId;
      const action = req.body?.action;
      const reviewerNote = String(req.body?.reviewerNote || "").trim();

      if (!recordId || !String(recordId).startsWith("rec")) {
        return sendJson(res, 400, {
          ok: false,
          error: "A valid Airtable receipt recordId is required.",
        });
      }

      if (!["approve", "reject", "needs_review", "archive"].includes(action)) {
        return sendJson(res, 400, {
        ok: false,
        error:
        "Invalid review action. Use approve, reject, needs_review, or archive.",
  });
}

      const currentRecordsResult = await fetchReceiptRecords();

      if (!currentRecordsResult.ok) {
        return sendJson(res, currentRecordsResult.status, {
          ok: false,
          error: "Could not verify receipt before review update.",
          details: currentRecordsResult.data,
        });
      }

      const matchingRecord = currentRecordsResult.data.records?.find(
        (record) => record.id === recordId
      );

      if (!matchingRecord) {
        return sendJson(res, 404, {
          ok: false,
          error: "Receipt record was not found.",
        });
      }

      const receipt = mapReceipt(matchingRecord);

      if (!receipt.restaurant.includes(CHLOES_RESTAURANT_ID)) {
        return sendJson(res, 403, {
          ok: false,
          error: "Receipt does not belong to the configured restaurant.",
        });
      }

      if (!receipt.fileUrl) {
        return sendJson(res, 400, {
          ok: false,
          error:
            "Receipt has no uploaded file attached. It cannot be approved from the review workflow.",
        });
      }

      const updateResult = await updateReceiptReview({
        recordId,
        action,
        reviewerNote,
        existingNotes: receipt.notes,
      });

      if (!updateResult.ok) {
        return sendJson(res, updateResult.status, {
          ok: false,
          error: "Airtable rejected the receipt review update.",
          details: updateResult.data,
        });
      }

      const updatedRecord = updateResult.data?.records?.[0];

      return sendJson(res, 200, {
  ok: true,
  message:
    action === "approve"
      ? "Receipt approved. No downstream cost or inventory updates were made."
      : action === "reject"
      ? "Receipt rejected. No downstream cost or inventory updates were made."
      : action === "archive"
      ? "Receipt archived. It is hidden from the active queue."
      : "Receipt returned to review. No downstream cost or inventory updates were made.",
  recordId: updatedRecord?.id,
  action,
});
    } catch (error) {
      console.error("Receipt review POST error:", error);

      return sendJson(res, 500, {
        ok: false,
        error: error.message || "Unexpected receipt review update error.",
      });
    }
  }

  return sendJson(res, 405, {
    ok: false,
    error: "Method not allowed. Use GET or POST.",
  });
}
