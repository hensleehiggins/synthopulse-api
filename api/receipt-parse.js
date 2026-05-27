export const config = {
  api: {
    bodyParser: true,
  },
};

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_PAT;
const CHLOES_RESTAURANT_ID = process.env.AIRTABLE_CHLOES_RESTAURANT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const VENDOR_RECEIPTS_TABLE = "Vendor Receipts";
const VENDOR_RECEIPT_LINES_TABLE = "Vendor Receipt Lines";

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

function requireEnv(res) {
  if (
    !AIRTABLE_BASE_ID ||
    !AIRTABLE_TOKEN ||
    !CHLOES_RESTAURANT_ID ||
    !OPENAI_API_KEY
  ) {
    sendJson(res, 500, {
      ok: false,
      error:
        "Missing required environment variables. Check AIRTABLE_BASE_ID, AIRTABLE_PAT or AIRTABLE_TOKEN, AIRTABLE_CHLOES_RESTAURANT_ID, and OPENAI_API_KEY.",
    });

    return false;
  }

  return true;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function safeNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(String(value).replace(/[^0-9.-]/g, ""));

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}

function safeDate(value) {
  const text = normalizeText(value);

  if (!text) {
    return "";
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function getFirstAttachment(fields) {
  const uploadedFiles = fields?.["Uploaded File"] || [];
  return uploadedFiles[0] || null;
}

function mapReceipt(record) {
  const fields = record.fields || {};
  const file = getFirstAttachment(fields);

  return {
    id: record.id,
    createdTime: record.createdTime,
    receiptName: fields["Receipt Name"] || "Receipt upload",
    restaurant: fields.Restaurant || [],
    vendor: fields.Vendor || "",
    receiptDate: fields["Receipt Date"] || "",
    processingStatus: fields["Processing Status"] || "",
    reviewNeeded: Boolean(fields["Review Needed"]),
    approved: Boolean(fields.Approved),
    rawText: fields["Raw OCR / AI Text"] || "",
    parsedJson: fields["Parsed JSON"] || "",
    totalAmount: fields["Total Amount"] || null,
    notes: fields.Notes || "",
    fileName: file?.filename || "",
    fileUrl: file?.url || "",
    fileType: file?.type || "",
  };
}

async function airtableFetch(path, options = {}) {
  const response = await fetch(`https://api.airtable.com/v0/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function fetchReceiptById(recordId) {
  const path = `${AIRTABLE_BASE_ID}/${encodeURIComponent(
    VENDOR_RECEIPTS_TABLE
  )}/${recordId}`;

  const result = await airtableFetch(path, {
    method: "GET",
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    status: 200,
    data: result.data,
  };
}

async function updateReceipt(recordId, fields) {
  const path = `${AIRTABLE_BASE_ID}/${encodeURIComponent(
    VENDOR_RECEIPTS_TABLE
  )}`;

  return airtableFetch(path, {
    method: "PATCH",
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
}

async function createReceiptLines(lines) {
  if (!lines.length) {
    return {
      ok: true,
      status: 200,
      data: {
        records: [],
      },
    };
  }

  const path = `${AIRTABLE_BASE_ID}/${encodeURIComponent(
    VENDOR_RECEIPT_LINES_TABLE
  )}`;

  return airtableFetch(path, {
    method: "POST",
    body: JSON.stringify({
      records: lines.map((fields) => ({ fields })),
      typecast: true,
    }),
  });
}

async function fetchExistingReceiptLinesForReceipt(receiptId) {
  const allRecords = [];
  let offset = "";

  do {
    const params = new URLSearchParams();
    params.set("pageSize", "100");

    if (offset) {
      params.set("offset", offset);
    }

    const path = `${AIRTABLE_BASE_ID}/${encodeURIComponent(
      VENDOR_RECEIPT_LINES_TABLE
    )}?${params.toString()}`;

    const result = await airtableFetch(path, {
      method: "GET",
    });

    if (!result.ok) {
      return result;
    }

    const records = Array.isArray(result.data?.records)
      ? result.data.records
      : [];

    allRecords.push(...records);

    offset = result.data?.offset || "";
  } while (offset);

  const matchingRecords = allRecords.filter((record) => {
    const linkedReceipts = record.fields?.Receipt || [];
    return linkedReceipts.includes(receiptId);
  });

  return {
    ok: true,
    status: 200,
    data: {
      records: matchingRecords,
    },
  };
}

function parseJsonFromModelText(text) {
  const raw = normalizeText(text);

  if (!raw) {
    throw new Error("OpenAI returned an empty parsing response.");
  }

  try {
    return JSON.parse(raw);
  } catch (directError) {
    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("OpenAI response did not contain parseable JSON.");
    }

    return JSON.parse(match[0]);
  }
}

function buildParsingPrompt(receipt) {
  return `
You are parsing a restaurant vendor receipt or invoice for KitchenPulse.

Return ONLY valid JSON. No markdown. No commentary.

Important rules:
- First classify the document.
- Only parse vendor receipts, invoices, or purchase documents showing items actually bought.
- Do NOT parse catalogs, product lists, price sheets, order guides, menus, marketing sheets, or sales flyers as receipts.
- If the document is not a receipt or invoice, return documentType, isReceiptOrInvoice false, unsupportedReason, rawText if visible, and an empty lines array.
- Catalog-like documents often have columns such as Supplier Name, Item #, Brand, Product, Pack, Size, Tokens, or long product lists without purchase totals.
- Large real invoices are allowed, but product catalogs and price sheets are not.
- Do not invent values.
- If a field is not visible, use empty string or null.
- Every line item must remain review-first.
- This parsing output is staging data only.

Invoice/table parsing rules:
- Many restaurant vendor invoices use table columns such as QTY, PACK, SIZE, ITEM DESCRIPTION, ITEM CODE, UNIT PRICE, and EXTENDED PRICE.
- If UNIT PRICE is visible, map it to unitCost.
- If EXTENDED PRICE, AMOUNT, LINE TOTAL, or TOTAL PRICE is visible, map it to lineTotal.
- Do not put the extended price into unitCost.
- Do not leave unitCost blank when a clearly labeled UNIT PRICE column is visible.
- For Sysco-style invoices, the right-side UNIT PRICE column is the unitCost and the EXTENDED PRICE column is the lineTotal.
- Quantity must come from the QTY column only. Do not treat numbers inside the item name, pack, or size as quantity.
- Package Size should combine PACK and SIZE when visible, such as "1 CS / 10 LB", "4 LB", "2/5 LB", or "1 LB".
- If QTY is 2, UNIT PRICE is 62.59, and the EXTENDED PRICE is not clearly aligned to the same row, return quantity 2, unitCost 62.59, and lineTotal 125.18 only if multiplication is appropriate. Do not copy nearby group totals or unrelated example prices.
- Do not reuse numeric values from these instructions as parsed receipt values. Example numbers in this prompt are only demonstrations, not receipt data.

Royal Food Service invoice rules:
- For Royal Food Service invoices, each item row has Description, Pack/Size, Unit Price, and Extended Amount on the same horizontal row. Do not borrow prices from rows below.
- If a line says "Juice Guava Lemonade Bottles 6/12oz" and the same row shows Unit Price $10.65 and Extended Amount $10.65, return unitCost 10.65 and lineTotal 10.65.
- Rows below such as "Juice Lemon Quart" or "Juice Lime Quart" may have Unit Price $3.95. Do not assign those prices to the Guava Lemonade row.
- When multiple juice rows appear together, preserve each row's own price. Do not reuse the last visible juice price for all juice items.

Price and item-code rules:

Price and item-code rules:
- Restaurant invoices often place ITEM CODE immediately before UNIT PRICE and EXTENDED PRICE.
- Item codes are not prices.
- Do not combine item code digits with price digits.
- Do not infer prices from long numeric strings.
- A valid unitCost or lineTotal should come from a clearly labeled UNIT PRICE, EXTENDED PRICE, AMOUNT, LINE TOTAL, or TOTAL PRICE column.
- If a number appears in the ITEM CODE column, ignore it for pricing.
- If a parsed price is unusually large for a single food-service line item, re-check whether the number is actually an item code plus a price.
- For Sysco-style invoices, the columns after ITEM DESCRIPTION are usually ITEM CODE, then UNIT PRICE, then EXTENDED PRICE.
- Example: if a row contains item code 650009 and price 38.95, return unitCost 38.95 and lineTotal 38.95. Do not return 650009, 6500.09, 5388.42, or any merged value.
- Example: if a row contains "SYS REL MAYONNAISE HEAVY DUTY" with item code 650009 and visible price 38.95, return lineItemName "Rel Mayonnaise Heavy Duty", unitCost 38.95, lineTotal 38.95.

Sysco subtotal / group total rules:
- Sysco invoices may show category/group totals near item rows, such as totals for a section or page.
- Do not use category totals, subtotal values, invoice totals, page totals, tax, delivery, or summary values as unitCost or lineTotal for an individual item.
- Only create line items from actual item rows that contain an item description and item code.
- A valid item row should have an item description plus item code plus UNIT PRICE and/or EXTENDED PRICE in the same row.
- If a large price appears near a category group but not directly on the item row, leave unitCost and lineTotal null rather than using that value.
- For Sysco rows, do not use numbers from the far bottom/summary/group total area as item prices.
- If the raw line text contains a product name followed by only one suspiciously high number, verify it is not a group total before assigning it as lineTotal.
- Do not create receipt line items for non-product category totals, group totals, invoice totals, paper/disposable totals, fuel surcharge, delivery/service charges, or misc charges.
- Do not create Cost Center staging lines for disposable supplies such as plastic containers, plastic cups, gloves, cutlery kits, liners, scrub pads, broiler brushes, paper towels, napkins, straws, lids, trays, plates, or bowls unless the document is specifically being reviewed for supplies.
- If a Sysco row says GROUP TOTAL, PAPER & DISPOSABLES TOTAL, CHGS FOR FUEL SURCHARGE, or similar, do not include it in lines.
- If a Sysco item row is followed by GROUP TOTAL or a nearby total value, do not assign the group total to that item. Use the UNIT PRICE from the row, and derive lineTotal from quantity × unitCost only when the row's extended price is unclear.
- Example: if a row says "2 CS ... LOBSTER BISQUE W/S ... UNIT PRICE 62.59" and a nearby GROUP TOTAL says 770.08, return unitCost 62.59 and lineTotal 125.18, not 770.08 or any unrelated prompt example value.
Examples:
- If raw text says "LOBSTER BISQUE W/S NE 1 CS 770.08" but 770.08 appears to be a category/group total rather than the row's UNIT PRICE or EXTENDED PRICE, return unitCost null and lineTotal null with low confidence.
- If raw text says "2 CS 65LB SYS REL POTATO FRY STEAK 9944149 39.95", return quantity 2, packageSize "65 LB", item code ignored, lineTotal 39.95, and unitCost 19.98 only if 39.95 is the extended price for quantity 2.
- If UNIT PRICE is visible separately from EXTENDED PRICE, use UNIT PRICE for unitCost and EXTENDED PRICE for lineTotal.

Item naming rules:
- lineItemName must be the specific purchased product, not a generic category.
- Do not return generic names like "Cheese", "Lettuce", "Chicken", "Beef", "Sauce", or "Produce" when the raw line contains a more specific item description.
- Preserve meaningful descriptors from the invoice item description such as "Parm Shaved", "Cheddar Shredded", "Romaine Hearts", "Chicken Wings Jumbo", "Ribeye", "Heavy Cream", etc.
- Remove only obvious pack, size, quantity, and item code values from lineItemName.
- If raw line text says "AREZIME CHEESE PARM SHAVED", return a lineItemName like "Arezime Cheese Parm Shaved" or "Shaved Parmesan Cheese", not "Cheese".
- If uncertain, prefer a longer specific lineItemName over a short generic one.
- If raw line text says "DRESSING BLUE CHEESE CHUNKY", return "Blue Cheese Chunky Dressing", not "Cheese".
- If raw line text says "AREZIME CHEESE PARM SHAVED", return "Arezime Cheese Parm Shaved" or "Shaved Parmesan Cheese", not "Cheese".
- Prefixes like SYS REL, SYS CLS, and vendor shorthand may be preserved if useful, but do not let them replace the actual product name.
- When the rawLineText conflicts with the visible table columns, trust the visible table columns for quantity, unit price, and extended price.
- Sysco shorthand SYS REL means Sysco Reliance, not Sysco Reliability. If a raw line says SYS REL POTATO FRY STEAK, return "Sysco Reliance Steak Fries". If it says SYS REL DRESSING BLUE CHEESE CHUNKY, return "Sysco Reliance Blue Cheese Dressing Chunky".

JSON shape:
{
  "documentType": "receipt_invoice" | "catalog_or_price_sheet" | "menu" | "unknown",
  "isReceiptOrInvoice": true,
  "unsupportedReason": "",
  "rawText": "plain text transcription of visible receipt/invoice content",
  "vendor": "vendor or supplier name",
  "receiptDate": "YYYY-MM-DD or empty string",
  "invoiceNumber": "invoice or receipt number if visible",
  "totalAmount": number or null,
  "subtotal": number or null,
  "tax": number or null,
  "confidence": "High" | "Medium" | "Low",
  "needsReview": true,
  "reviewReason": "short reason if review is needed",
  "lines": [
    {
      "lineItemName": "item name",
      "category": "Produce | Meat | Seafood | Dairy | Dry Goods | Liquor | Beer | Wine | NA Beverage | Supplies | Other",
      "quantity": number or null,
      "unit": "each/case/bottle/lb/oz/gal/keg/pack/box/etc or empty string",
      "packageSize": "case pack/package description or empty string",
      "unitCost": number or null,
      "lineTotal": number or null,
      "confidence": "High" | "Medium" | "Low",
      "rawLineText": "raw visible line text"
    }
  ]
}

Receipt metadata:
- Airtable record ID: ${receipt.id}
- Current receipt name: ${receipt.receiptName}
- Existing vendor field: ${receipt.vendor || ""}
- Existing receipt date field: ${receipt.receiptDate || ""}
- Uploaded filename: ${receipt.fileName}
`.trim();
}

async function callOpenAIForReceipt(receipt) {
  const prompt = buildParsingPrompt(receipt);

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
          content: [
            {
              type: "input_text",
              text: prompt,
            },
            {
              type: "input_image",
              image_url: receipt.fileUrl,
              detail: "high",
            },
          ],
        },
      ],
      max_output_tokens: 6000,
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

  return {
    ok: true,
    status: 200,
    data,
  };
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

function makeLineName({ receipt, parsed, line, index }) {
  const vendor =
    normalizeText(parsed.vendor) ||
    normalizeText(receipt.vendor) ||
    "Unknown vendor";

  const itemName =
    normalizeText(line.lineItemName) ||
    normalizeText(line.rawLineText) ||
    `Line ${index + 1}`;

  const date =
    normalizeText(parsed.receiptDate) ||
    normalizeText(receipt.receiptDate) ||
    new Date().toISOString().slice(0, 10);

  return `${vendor} — ${itemName} — ${date}`.slice(0, 180);
}

function normalizeCategory(value) {
  const allowed = new Set([
    "Produce",
    "Meat",
    "Seafood",
    "Dairy",
    "Dry Goods",
    "Liquor",
    "Beer",
    "Wine",
    "NA Beverage",
    "Supplies",
    "Other",
  ]);

  const text = normalizeText(value);

  if (allowed.has(text)) {
    return text;
  }

  return "Other";
}

function normalizeConfidence(value) {
  const text = normalizeText(value);

  if (["High", "Medium", "Low"].includes(text)) {
    return text;
  }

  return "Low";
}

function isUnsupportedDocument(parsed) {
  const documentType = normalizeText(parsed?.documentType).toLowerCase();
  const unsupportedReason = normalizeText(parsed?.unsupportedReason).toLowerCase();

  if (parsed?.isReceiptOrInvoice === false) return true;

  if (
    [
      "catalog_or_price_sheet",
      "catalog",
      "price_sheet",
      "product_list",
      "order_guide",
      "menu",
    ].includes(documentType)
  ) {
    return true;
  }

  if (
    unsupportedReason.includes("catalog") ||
    unsupportedReason.includes("price sheet") ||
    unsupportedReason.includes("product list") ||
    unsupportedReason.includes("order guide") ||
    unsupportedReason.includes("menu")
  ) {
    return true;
  }

  return false;
}

function unsupportedDocumentMessage(parsed) {
  return (
    normalizeText(parsed?.unsupportedReason) ||
    "This looks like a vendor catalog, product list, menu, order guide, or price sheet rather than a receipt or invoice. Upload a vendor receipt or invoice showing items actually purchased."
  );
}

function buildReceiptUpdateFields(receipt, parsed, parsedText) {
  const parsedVendor = normalizeText(parsed.vendor);
  const parsedDate = safeDate(parsed.receiptDate);
  const parsedTotal = safeNumber(parsed.totalAmount);

  const lineCount = Array.isArray(parsed.lines) ? parsed.lines.length : 0;

  const notesParts = [
    receipt.notes || "",
    `PARSING ACTION ${new Date().toISOString()}: AI parsed receipt into staging data. ${lineCount} line(s) detected.`,
    parsed.reviewReason ? `Parser review reason: ${parsed.reviewReason}` : "",
  ];

  const fields = {
  "Processing Status": lineCount > 0 ? "Parsed" : "Needs Review",
  "Review Needed": lineCount === 0,
  Approved: true,
  "Raw OCR / AI Text": normalizeText(parsed.rawText) || parsedText,
  "Parsed JSON": JSON.stringify(parsed, null, 2),
  "Processed At": new Date().toISOString(),
  Notes: notesParts.filter(Boolean).join("\n\n"),
};

  if (parsedVendor && !receipt.vendor) {
    fields.Vendor = parsedVendor;
  }

  if (parsedDate && !receipt.receiptDate) {
    fields["Receipt Date"] = parsedDate;
  }

  if (parsedTotal !== null) {
    fields["Total Amount"] = parsedTotal;
  }

  return fields;
}

function normalizeParsedLine(line) {
  const normalized = {
    ...line,
    quantity: safeNumber(line.quantity),
    unitCost: safeNumber(line.unitCost),
    lineTotal: safeNumber(line.lineTotal),
    unit: normalizeText(line.unit),
    packageSize: normalizeText(line.packageSize),
    rawLineText: normalizeText(line.rawLineText),
    confidence: normalizeConfidence(line.confidence),
    notes: normalizeText(line.notes),
  };

  const raw = normalized.rawLineText.toLowerCase();

  // Vendor invoices like Sysco often have explicit table columns:
  // QTY | PACK | SIZE | ITEM DESCRIPTION | ITEM CODE | UNIT PRICE | EXTENDED PRICE.
  // If the model captured line total but missed unit cost, derive it only when
  // quantity is present and the math is safe.
  if (
    normalized.unitCost === null &&
    normalized.lineTotal !== null &&
    normalized.quantity !== null &&
    normalized.quantity > 0
  ) {
    normalized.unitCost = Number(
      (normalized.lineTotal / normalized.quantity).toFixed(2)
    );
  }

  // If the model captured unit cost but missed line total, derive line total.
  if (
    normalized.lineTotal === null &&
    normalized.unitCost !== null &&
    normalized.quantity !== null &&
    normalized.quantity > 0
  ) {
    normalized.lineTotal = Number(
      (normalized.unitCost * normalized.quantity).toFixed(2)
    );
  }

  // If unit is blank but package text clearly includes LB/CS/OZ/etc, keep the unit readable.
  if (
    !normalized.unit &&
    /\b(lb|lbs|cs|case|oz|gal|qt|pt|pk|pack|ea|each)\b/i.test(raw)
  ) {
    const unitMatch = raw.match(
      /\b(lb|lbs|cs|case|oz|gal|qt|pt|pk|pack|ea|each)\b/i
    );
    normalized.unit = unitMatch?.[1] || "";
  }

  // Guard against obvious Sysco invoice subtotal/category total mistakes.
  // Safer behavior: leave questionable huge prices blank for human review
  // instead of allowing a subtotal/group total to become an approved item cost.
  const suspiciousHugeSingleLine =
    (
      (normalized.unitCost !== null && normalized.unitCost >= 500) ||
      (normalized.lineTotal !== null && normalized.lineTotal >= 500)
    ) &&
    normalized.rawLineText &&
    !/\b(unit price|extended price|line total|amount|subtotal|total)\b/i.test(
      normalized.rawLineText
    );

  if (suspiciousHugeSingleLine) {
    normalized.unitCost = null;
    normalized.lineTotal = null;
    normalized.confidence = "Low";
    normalized.notes = [
      normalizeText(normalized.notes),
      "Possible subtotal/group total or item-code/price merge captured as item price. Price left blank for review.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return normalized;
}


function buildLineFields({ receipt, parsed, line, index }) {
  const vendor =
    normalizeText(parsed.vendor) ||
    normalizeText(receipt.vendor) ||
    "";

  const normalizedLine = normalizeParsedLine(line);

  return {
    "Line Name": makeLineName({
      receipt,
      parsed,
      line: normalizedLine,
      index,
    }),
    Receipt: [receipt.id],
    Restaurant: [CHLOES_RESTAURANT_ID],
    Vendor: vendor,
    "Line Item Name": normalizeText(normalizedLine.lineItemName),
    Category: normalizeCategory(normalizedLine.category),
    Quantity: normalizedLine.quantity,
    Unit: normalizedLine.unit,
    "Package Size": normalizedLine.packageSize,
    "Unit Cost": normalizedLine.unitCost,
    "Line Total": normalizedLine.lineTotal,
    Confidence: normalizeConfidence(normalizedLine.confidence),
    "Needs Review": true,
    Approved: false,
    "Raw Line Text": normalizedLine.rawLineText,
    Notes: [
  "AI-parsed staging line.",
  normalizeText(normalizedLine.notes),
]
  .filter(Boolean)
  .join(" "),
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
      route: "receipt-parse",
      message: "Receipt parse API is reachable. Use POST with { recordId }.",
    });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      ok: false,
      error: "Method not allowed. Use POST.",
    });
  }

  if (!requireEnv(res)) {
    return;
  }

  try {
    const recordId = req.body?.recordId;

    if (!recordId || !String(recordId).startsWith("rec")) {
      return sendJson(res, 400, {
        ok: false,
        error: "A valid Airtable Vendor Receipts recordId is required.",
      });
    }

    const receiptResult = await fetchReceiptById(recordId);

    if (!receiptResult.ok) {
      return sendJson(res, receiptResult.status, {
        ok: false,
        error: "Could not fetch Vendor Receipts record.",
        details: receiptResult.data,
      });
    }

    const receipt = mapReceipt(receiptResult.data);

    if (!receipt.restaurant.includes(CHLOES_RESTAURANT_ID)) {
      return sendJson(res, 403, {
        ok: false,
        error: "Receipt does not belong to the configured restaurant.",
      });
    }

    if (!receipt.fileUrl) {
      return sendJson(res, 400, {
        ok: false,
        error: "Receipt has no uploaded file attached.",
      });
    }

    if (!receipt.approved) {
      return sendJson(res, 409, {
        ok: false,
        error:
          "Receipt must be approved before parsing. Approve it in Receipt Review first.",
      });
    }

    const existingLinesResult = await fetchExistingReceiptLinesForReceipt(
      receipt.id
    );

    if (!existingLinesResult.ok) {
      return sendJson(res, existingLinesResult.status, {
        ok: false,
        error: "Could not check existing receipt lines before parsing.",
        details: existingLinesResult.data,
      });
    }

    const existingLineCount = Array.isArray(existingLinesResult.data?.records)
      ? existingLinesResult.data.records.length
      : 0;

    const force = Boolean(req.body?.force);

    if (existingLineCount > 0 && !force) {
      return sendJson(res, 409, {
        ok: false,
        error:
          "This receipt already has parsed line records. Use force=true only if you intentionally want to parse it again.",
        existingLineCount,
      });
    }

    await updateReceipt(receipt.id, {
      "Processing Status": "Parsing",
      "Processed At": new Date().toISOString(),
      "Error Message": "",
    });

    const openAiResult = await callOpenAIForReceipt(receipt);

    if (!openAiResult.ok) {
      await updateReceipt(receipt.id, {
        "Processing Status": "Error",
        "Review Needed": true,
        Approved: false,
        "Error Message": "OpenAI receipt parsing failed.",
        "Processed At": new Date().toISOString(),
      });

      return sendJson(res, openAiResult.status, {
        ok: false,
        error: "OpenAI receipt parsing failed.",
        details: openAiResult.data,
      });
    }

    const parsedText = extractOpenAIText(openAiResult.data);
const parsed = parseJsonFromModelText(parsedText);

if (isUnsupportedDocument(parsed)) {
  const message = unsupportedDocumentMessage(parsed);

  await updateReceipt(receipt.id, {
    "Processing Status": "Needs Review",
    "Review Needed": true,
    Approved: false,
    "Raw OCR / AI Text": normalizeText(parsed.rawText) || parsedText,
    "Parsed JSON": JSON.stringify(parsed, null, 2),
    "Error Message": message,
    "Processed At": new Date().toISOString(),
    Notes: [receipt.notes || "", `PARSING REJECTED ${new Date().toISOString()}: ${message}`]
      .filter(Boolean)
      .join("\n\n"),
  });

  return sendJson(res, 422, {
    ok: false,
    errorType: "unsupported_document_type",
    error: message,
    recordId: receipt.id,
  });
}

const parsedLines = Array.isArray(parsed.lines) ? parsed.lines : [];
    const parsedLineLimit = 50;
const wasLineLimited = parsedLines.length > parsedLineLimit;

    const lineFields = parsedLines
      .filter((line) => {
        return (
          normalizeText(line.lineItemName) ||
          normalizeText(line.rawLineText) ||
          safeNumber(line.lineTotal) !== null
        );
      })
      .slice(0, parsedLineLimit)
      .map((line, index) => buildLineFields({ receipt, parsed, line, index }));

    const receiptUpdateFields = buildReceiptUpdateFields(
      receipt,
      parsed,
      parsedText
    );
    if (wasLineLimited) {
  receiptUpdateFields.Notes = [
    receiptUpdateFields.Notes || "",
    `KitchenPulse parsed the first ${parsedLineLimit} visible line items from a larger receipt/invoice. Upload remaining pages separately if more lines are needed.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

    const receiptUpdateResult = await updateReceipt(
      receipt.id,
      receiptUpdateFields
    );

    if (!receiptUpdateResult.ok) {
      return sendJson(res, receiptUpdateResult.status, {
        ok: false,
        error: "Airtable rejected the parsed receipt update.",
        details: receiptUpdateResult.data,
      });
    }

    const lineCreateResult = await createReceiptLines(lineFields);

    if (!lineCreateResult.ok) {
      await updateReceipt(receipt.id, {
        "Processing Status": "Needs Review",
        "Review Needed": true,
        Approved: false,
        "Error Message":
          "Receipt parsed, but Airtable rejected one or more parsed line records.",
        "Processed At": new Date().toISOString(),
      });

      return sendJson(res, lineCreateResult.status, {
        ok: false,
        error:
          "Receipt parsed, but Airtable rejected one or more parsed line records.",
        details: lineCreateResult.data,
      });
    }

    return sendJson(res, 200, {
      ok: true,
      message: "Receipt parsed into staging lines.",
      recordId: receipt.id,
      receiptName: receipt.receiptName,
      parsedVendor: parsed.vendor || "",
      parsedReceiptDate: parsed.receiptDate || "",
      parsedTotalAmount: safeNumber(parsed.totalAmount),
      lineCount: lineFields.length,
      createdLineIds: lineCreateResult.data.records.map((record) => record.id),
    });
  } catch (error) {
    console.error("Receipt parse error:", error);

    try {
      const recordId = req.body?.recordId;

      if (recordId && String(recordId).startsWith("rec")) {
        await updateReceipt(recordId, {
          "Processing Status": "Error",
          "Review Needed": true,
          Approved: false,
          "Error Message": error.message || "Unexpected receipt parse error.",
          "Processed At": new Date().toISOString(),
        });
      }
    } catch (cleanupError) {
      console.error("Receipt parse cleanup update failed:", cleanupError);
    }

    return sendJson(res, 500, {
      ok: false,
      error: error.message || "Unexpected receipt parse error.",
    });
  }
}
