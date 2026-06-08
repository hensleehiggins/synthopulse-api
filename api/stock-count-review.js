const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID ||
  process.env.KITCHENPULSE_AIRTABLE_BASE_ID;

const AIRTABLE_TOKEN =
  process.env.AIRTABLE_TOKEN ||
  process.env.AIRTABLE_PAT ||
  process.env.AIRTABLE_API_KEY ||
  process.env.KITCHENPULSE_AIRTABLE_API_KEY;

const STOCK_COUNT_LINES_TABLE = "Stock Count Lines";

const FIELD_NAMES = [
  "Count Line Name",
  "Stock Count Session",
  "Count Item Name",
  "Storage Area",
  "Count Quantity",
  "Count Unit",
  "Count Notes",
  "Photo",
  "Count Review State",
  "Approved For Ordering",
  "Counter Name",
  "Count Time Text",
];

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store, max-age=0");
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  res.status(statusCode).json(payload);
}

function airtableTableUrl(tableName) {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    tableName
  )}`;
}

function airtableRecordUrl(tableName, recordId) {
  return `${airtableTableUrl(tableName)}/${recordId}`;
}

function selectName(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(selectName).filter(Boolean).join(", ");
  if (typeof value === "object" && value.name) return value.name;
  return "";
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;

  if (Array.isArray(value)) {
    return numberOrNull(value[0]);
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function photoInfo(value) {
  const files = Array.isArray(value) ? value : [];
  const first = files[0];

  return {
    hasPhoto: Boolean(first?.url),
    photoUrl: first?.url || "",
    photoName: first?.filename || "",
  };
}

function normalizeReviewState(value) {
  return String(value || "").trim().toLowerCase();
}

function isPendingReviewState(value) {
  const state = normalizeReviewState(value);

  return (
    !state ||
    state === "submitted" ||
    state === "needs review" ||
    state === "needs_review"
  );
}

function normalizeLine(record) {
  const fields = record.fields || {};
  const photo = photoInfo(fields.Photo);
  const reviewState = fields["Count Review State"] || "Submitted";

  return {
    id: record.id,
    createdTime: record.createdTime,
    countLineName: fields["Count Line Name"] || "",
    session: selectName(fields["Stock Count Session"]),
    itemName: fields["Count Item Name"] || fields["Count Line Name"] || "",
    storageArea: selectName(fields["Storage Area"]) || fields["Storage Area"] || "",
    quantity: numberOrNull(fields["Count Quantity"]),
    unit: fields["Count Unit"] || "",
    notes: fields["Count Notes"] || "",
    reviewState,
    approvedForOrdering: fields["Approved For Ordering"] === true,
    counterName: fields["Counter Name"] || "",
    countTimeText: fields["Count Time Text"] || "",
    hasPhoto: photo.hasPhoto,
    photoUrl: photo.photoUrl,
    photoName: photo.photoName,
  };
}

async function fetchPendingLines() {
  const url = new URL(airtableTableUrl(STOCK_COUNT_LINES_TABLE));

  url.searchParams.set("pageSize", "100");
  url.searchParams.set(
    "filterByFormula",
    "AND(OR({Count Review State}=BLANK(), {Count Review State}='Submitted', {Count Review State}='Needs Review'), NOT({Approved For Ordering}=1))"
  );

  FIELD_NAMES.forEach((fieldName) => {
    url.searchParams.append("fields[]", fieldName);
  });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        data?.error ||
        "Airtable rejected the stock count review request."
    );
  }

  const records = Array.isArray(data.records) ? data.records : [];

  return records
    .map(normalizeLine)
    .filter((line) => {
      if (line.approvedForOrdering) return false;
      return isPendingReviewState(line.reviewState);
    })
    .sort((a, b) =>
      String(b.createdTime || "").localeCompare(String(a.createdTime || ""))
    );
}

async function updateLine({ recordId, action }) {
  const isApprove = action === "approve";
  const isReject = action === "reject";

  if (!isApprove && !isReject) {
    throw new Error("Action must be approve or reject.");
  }

  const fields = isApprove
    ? {
        "Count Review State": "Approved",
        "Approved For Ordering": true,
      }
    : {
        "Count Review State": "Rejected",
        "Approved For Ordering": false,
      };

  const response = await fetch(airtableRecordUrl(STOCK_COUNT_LINES_TABLE, recordId), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields,
      typecast: true,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        data?.error ||
        "Airtable rejected the stock count approval update."
    );
  }

  return normalizeLine(data);
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
    return sendJson(res, 500, {
      ok: false,
      error:
        "Missing required environment variables. Check AIRTABLE_BASE_ID and AIRTABLE_PAT or AIRTABLE_TOKEN.",
    });
  }

  try {
    if (req.method === "GET") {
      const lines = await fetchPendingLines();

      return sendJson(res, 200, {
        ok: true,
        generatedAt: new Date().toISOString(),
        pendingCount: lines.length,
        lines,
      });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const recordId = String(body.recordId || "").trim();
      const action = String(body.action || "").trim().toLowerCase();

      if (!recordId) {
        return sendJson(res, 400, {
          ok: false,
          error: "recordId is required.",
        });
      }

      const updatedLine = await updateLine({ recordId, action });

      return sendJson(res, 200, {
        ok: true,
        action,
        line: updatedLine,
      });
    }

    return sendJson(res, 405, {
      ok: false,
      error: "Method not allowed.",
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: error?.message || "Stock count review could not be loaded.",
    });
  }
}
