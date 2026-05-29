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

function normalizeImagePreflight(value) {
  const allowedOrientations = new Set([
    "upright",
    "rotate_90_clockwise",
    "rotate_90_counterclockwise",
    "upside_down",
    "unclear",
  ]);

  const allowedReadability = new Set(["good", "fair", "poor"]);

  const orientation = allowedOrientations.has(value?.orientation)
    ? value.orientation
    : "unclear";

  const readability = allowedReadability.has(value?.readability)
    ? value.readability
    : "fair";

  return {
    orientation,
    readability,
    isLikelyReceiptOrInvoice: value?.isLikelyReceiptOrInvoice !== false,
    warning: normalizeText(value?.warning),
    visibleVendor: normalizeText(value?.visibleVendor),
    visibleDate: normalizeText(value?.visibleDate),
    confidence: ["High", "Medium", "Low"].includes(value?.confidence)
      ? value.confidence
      : "Low",
  };
}

function buildImagePreflightPrompt(receipt) {
  return `
You are doing an image preflight check before a restaurant vendor receipt is parsed.

Return ONLY valid JSON. No markdown. No commentary.

Inspect the uploaded image and identify orientation/readability. Do not parse line items.

Allowed orientation values:
- upright
- rotate_90_clockwise
- rotate_90_counterclockwise
- upside_down
- unclear

Allowed readability values:
- good
- fair
- poor

Return this exact JSON shape:
{
  "orientation": "upright | rotate_90_clockwise | rotate_90_counterclockwise | upside_down | unclear",
  "readability": "good | fair | poor",
  "isLikelyReceiptOrInvoice": true,
  "visibleVendor": "vendor name if obvious, otherwise empty string",
  "visibleDate": "YYYY-MM-DD if obvious, otherwise empty string",
  "confidence": "High | Medium | Low",
  "warning": "short warning if image is rotated, blurry, cropped, upside down, not a receipt, or hard to read"
}

Receipt metadata:
- Airtable record ID: ${receipt.id}
- Current receipt name: ${receipt.receiptName}
- Uploaded filename: ${receipt.fileName}
`.trim();
}

async function callOpenAIJsonImage({ prompt, imageUrl, maxOutputTokens = 1000 }) {
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
              image_url: imageUrl,
              detail: "high",
            },
          ],
        },
      ],
      max_output_tokens: maxOutputTokens,
    }),
  });

  const data = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function runImagePreflight(receipt) {
  try {
    const result = await callOpenAIJsonImage({
      prompt: buildImagePreflightPrompt(receipt),
      imageUrl: receipt.fileUrl,
      maxOutputTokens: 1000,
    });

    if (!result.ok) {
      return normalizeImagePreflight({
        orientation: "unclear",
        readability: "fair",
        isLikelyReceiptOrInvoice: true,
        confidence: "Low",
        warning:
          "Image preflight could not complete. Continue parsing, but review output carefully.",
      });
    }

    const text = extractOpenAIText(result.data);
    const parsed = parseJsonFromModelText(text);

    return normalizeImagePreflight(parsed);
  } catch (error) {
    return normalizeImagePreflight({
      orientation: "unclear",
      readability: "fair",
      isLikelyReceiptOrInvoice: true,
      confidence: "Low",
      warning:
        "Image preflight failed before parsing. Continue parsing, but review output carefully.",
    });
  }
}

function buildOrientationInstruction(imagePreflight) {
  if (!imagePreflight) {
    return "";
  }

  const orientation = imagePreflight.orientation || "unclear";
  const readability = imagePreflight.readability || "fair";
  const warning = normalizeText(imagePreflight.warning);

  const orientationGuidance = {
    upright:
      "The receipt appears upright. Parse normally.",
    rotate_90_clockwise:
      "The receipt image appears rotated 90 degrees clockwise. Mentally rotate it 90 degrees counterclockwise before reading rows and columns.",
    rotate_90_counterclockwise:
      "The receipt image appears rotated 90 degrees counterclockwise. Mentally rotate it 90 degrees clockwise before reading rows and columns.",
    upside_down:
      "The receipt image appears upside down. Mentally rotate it 180 degrees before reading rows and columns.",
    unclear:
      "The receipt orientation is unclear. Inspect the image carefully and only parse rows that are readable with confidence.",
  };

  return `
Image preflight:
- Detected orientation: ${orientation}
- Detected readability: ${readability}
- Preflight warning: ${warning || "none"}
- Orientation handling: ${orientationGuidance[orientation] || orientationGuidance.unclear}

If the image is rotated or upside down, interpret the receipt after applying the orientation handling above. Do not punish the operator for a rotated upload. If text or row alignment remains uncertain, leave questionable values blank and set confidence Low.
`.trim();
}

function buildParsingPrompt(receipt, imagePreflight) {
  const imageInstruction = buildOrientationInstruction(imagePreflight);

  return `
You are parsing a restaurant vendor receipt or invoice for KitchenPulse.

Return ONLY valid JSON. No markdown. No commentary.

${imageInstruction ? `${imageInstruction}\n` : ""}

Core rules:
- Parse only vendor receipts, invoices, or purchase documents showing items actually bought.
- Do not parse catalogs, product lists, price sheets, order guides, menus, marketing sheets, or sales flyers as receipts.
- Do not invent values.
- Do not copy numeric values from these instructions into the output.
- Only use numbers visible on the uploaded receipt/invoice image.
- If a value is not clearly visible, use empty string or null.
- Every parsed line is staging data for human review.

Document classification:
- If this is not a receipt/invoice, return isReceiptOrInvoice false, an unsupportedReason, rawText if visible, and an empty lines array.
- If this is a receipt/invoice, return isReceiptOrInvoice true and parse purchased item rows only.

Table parsing rules:
- Restaurant invoices often use rows with columns like quantity, pack, size, item description, item code, unit price, and extended amount.
- Each parsed line must come from one visible item row.
- Do not borrow prices, quantities, item codes, or totals from nearby rows.
- Do not reuse the last visible price for later rows.
- Do not use subtotal, group total, page total, invoice total, tax, delivery charge, service charge, fuel surcharge, or misc charge values as item prices.
- Item codes are not prices.
- Item codes should be ignored for pricing.
- Quantity must come from the row quantity column only.
- Package Size should capture visible pack/size text, such as case count, weight, bottle count, ounces, gallons, or pounds.
- Unit Cost must come from the unit price column on the same row.
- Line Total must come from the extended amount column on the same row.
- If the extended amount is unclear but quantity and unit price are clearly visible on the same row, lineTotal may be calculated as quantity multiplied by unitCost.
- If price alignment is uncertain, leave unitCost and/or lineTotal null and set confidence Low.
- If a row has a visible unit price but the extended price column appears contaminated by a group total or subtotal, use the unit price and leave lineTotal null unless multiplication is clearly appropriate.

Sysco-specific rules:
- Sysco invoices commonly place ITEM CODE after ITEM DESCRIPTION, followed by UNIT PRICE and EXTENDED PRICE.
- Do not merge item code digits with price digits.
- Sysco category/group totals often appear near item rows. Do not assign those totals to individual products.
- Rows containing GROUP TOTAL, PAPER & DISPOSABLES TOTAL, CHGS FOR FUEL SURCHARGE, subtotal, tax, or invoice total are not product lines.
- Disposable/supply lines such as gloves, plastic containers, cups, cutlery, liners, scrub pads, brushes, paper towels, napkins, straws, lids, trays, plates, and bowls should not be included unless the document is specifically being reviewed for supplies.
- Sysco shorthand SYS REL means Sysco Reliance, not Sysco Reliability.
- Sysco shorthand SYS CLS may be preserved only when useful, but do not let vendor shorthand replace the actual product name.
- If an item description appears misspelled or incomplete, do not combine it with words from nearby rows. For example, do not add "chunky" to shortening unless "chunky" appears on the same visible row.
- If the row appears to combine a package size from one item and a price from another item, set confidence Low and leave questionable price fields null.

Royal Food Service rules:
- Royal Food Service invoices use row-aligned Quantity Ordered, Quantity Shipped, Item, Description, Package/Size, Unit Price, and Extended Amount.
- Quantity should come from the shipped quantity column when visible. If shipped quantity is not visible, use ordered quantity.
- On Royal Food Service invoices, quantity usually means one purchased vendor package, case, bag, carton, bottle, or count-pack — not one individual food unit.
- If the package/size column contains values like 50ct, 50LB, 12/1ct, 1 gal, 1 qt, lb, bag, carton, case, or similar package text, store that text in packageSize.
- When quantity is 1 and packageSize is present, set unit to "package" unless the invoice clearly says a more specific unit such as lb, qt, gal, case, bag, or carton.
- Preserve each row's own unit price and extended amount.
- Do not borrow prices from adjacent juice, produce, dairy, or other nearby rows.
- When several similar products appear together, each product must keep the price from its own row.

Halperns rules:
- Halperns / Halpern's Steak & Seafood invoices use row-aligned ORD, SHP, U/M, Item/Size/Description, Wgt/Qty Shipped, Price, and Extension.
- Do not create a parsed line for Transportation Fee, delivery fee, fuel surcharge, service charge, freight, or other non-product charges.
- Do not include "Country of Origin" text in item names, packageSize, or raw product descriptions. Treat it as metadata/noise.
- If a line includes package sizing such as "2 OZ", "4 OZ", "5-6 OZ", "72CT", "10#", "5/2#", or similar, store that sizing in packageSize when possible, not in lineItemName.
- Remove leading package-size text from product names. Example: "4 OZ IMPORTED LAMB LOIN CHOP" should become lineItemName "Imported Lamb Loin Chop" with packageSize "4 oz".
- "Italian Meatball, Beef 2 oz 72ct" should become lineItemName "Italian Meatball Beef" with packageSize "2 oz 72ct".
- Preserve each row's own price and extension. Do not borrow prices from nearby rows.
- If weight/quantity shipped is visible and differs from ordered/shipped case quantity, keep the purchased unit as the vendor unit/case and preserve weight/pack details in packageSize or rawLineText.

Item naming rules:
- lineItemName must be the specific purchased product, not a generic category.
- Preserve meaningful descriptors such as brand, product type, flavor, cut, style, size description, and preparation.
- Remove only obvious quantity, pack, size, item code, and pricing values from lineItemName.
- Do not return generic names like Cheese, Lettuce, Chicken, Beef, Sauce, Produce, Juice, or Dressing when the row contains a more specific description.
- Prefer a longer specific lineItemName over a short generic one.
- If the item description says blue cheese dressing, the name should remain blue cheese dressing, not cheese.
- If the item description says guava lemonade bottles, the name should remain guava lemonade bottles, not lemon juice or lime juice.

Output JSON shape:
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

async function callOpenAIForReceipt(receipt, imagePreflight) {
  const prompt = buildParsingPrompt(receipt, imagePreflight);

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

function buildReceiptUpdateFields(receipt, parsed, parsedText, imagePreflight) {
  const parsedVendor = normalizeText(parsed.vendor);
  const parsedDate = safeDate(parsed.receiptDate);
  const parsedTotal = safeNumber(parsed.totalAmount);

  const lineCount = Array.isArray(parsed.lines) ? parsed.lines.length : 0;

  const preflightWarning = normalizeText(imagePreflight?.warning);
  const preflightNeedsAttention =
    imagePreflight?.orientation &&
    imagePreflight.orientation !== "upright" ||
    imagePreflight?.readability === "poor" ||
    imagePreflight?.confidence === "Low";

  const parsedForStorage = {
    ...parsed,
    imagePreflight,
  };

  const notesParts = [
    receipt.notes || "",
    `PARSING ACTION ${new Date().toISOString()}: AI parsed receipt into staging data. ${lineCount} line(s) detected.`,
    imagePreflight
      ? `Image preflight: orientation=${imagePreflight.orientation}, readability=${imagePreflight.readability}, confidence=${imagePreflight.confidence}.${preflightWarning ? ` Warning: ${preflightWarning}` : ""}`
      : "",
    parsed.reviewReason ? `Parser review reason: ${parsed.reviewReason}` : "",
  ];

  const fields = {
    "Processing Status": lineCount > 0 ? "Parsed" : "Needs Review",
    "Review Needed": lineCount === 0 || Boolean(preflightNeedsAttention),
    Approved: true,
    "Raw OCR / AI Text": normalizeText(parsed.rawText) || parsedText,
    "Parsed JSON": JSON.stringify(parsedForStorage, null, 2),
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

  const rawUpper = normalized.rawLineText.toUpperCase();
  const nameUpper = normalizeText(normalized.lineItemName).toUpperCase();

  const looksLikeMangledShortening =
    /\bSHOREING\b|\bSHORING\b/.test(rawUpper) ||
    /\bSHOREING\b|\bSHORING\b/.test(nameUpper);

  if (looksLikeMangledShortening) {
    normalized.lineItemName = "Sysco Classic Shortening Fry Canola Clear";
    normalized.confidence = "Low";
    normalized.notes = [
      normalizeText(normalized.notes),
      "Possible OCR row-mix: shortening row may have borrowed price or words from nearby lines. Verify against invoice before approval.",
    ]
      .filter(Boolean)
      .join(" ");
  }

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

  if (
    !normalized.unit &&
    /\b(lb|lbs|cs|case|oz|gal|qt|pt|pk|pack|ea|each)\b/i.test(raw)
  ) {
    const unitMatch = raw.match(
      /\b(lb|lbs|cs|case|oz|gal|qt|pt|pk|pack|ea|each)\b/i
    );
    normalized.unit = unitMatch?.[1] || "";
  }

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

function buildLineFields({ receipt, parsed, line, index, imagePreflight }) {
  const vendor =
    normalizeText(parsed.vendor) ||
    normalizeText(receipt.vendor) ||
    "";

  const normalizedLine = normalizeParsedLine(line);

  const preflightNote =
    imagePreflight &&
    (imagePreflight.orientation !== "upright" ||
      imagePreflight.readability === "poor" ||
      imagePreflight.confidence === "Low")
      ? `Image preflight: orientation=${imagePreflight.orientation}, readability=${imagePreflight.readability}. Verify row alignment.`
      : "";

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
      preflightNote,
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

    const imagePreflight = await runImagePreflight(receipt);

const rotatedOrUnsafeImage = [
  "rotate_90_clockwise",
  "rotate_90_counterclockwise",
  "upside_down",
].includes(imagePreflight.orientation);

const poorReadability = imagePreflight.readability === "poor";

if (rotatedOrUnsafeImage || poorReadability) {
  const imageIssueMessage = rotatedOrUnsafeImage
    ? `Receipt image appears rotated (${imagePreflight.orientation}). Re-upload the receipt upright before parsing so KitchenPulse does not misread row prices or merge category headers into item names.`
    : "Receipt image readability is poor. Re-upload a clearer image before parsing so KitchenPulse does not misread row prices.";

  await updateReceipt(receipt.id, {
    "Processing Status": "Needs Review",
    "Review Needed": true,
    Approved: false,
    "Raw OCR / AI Text": "",
    "Parsed JSON": JSON.stringify(
      {
        documentType: "unknown",
        isReceiptOrInvoice: true,
        unsupportedReason: imageIssueMessage,
        rawText: "",
        vendor: imagePreflight.visibleVendor || receipt.vendor || "",
        receiptDate: imagePreflight.visibleDate || receipt.receiptDate || "",
        invoiceNumber: "",
        totalAmount: null,
        subtotal: null,
        tax: null,
        confidence: "Low",
        needsReview: true,
        reviewReason: imageIssueMessage,
        lines: [],
        imagePreflight,
      },
      null,
      2
    ),
    "Error Message": imageIssueMessage,
    "Processed At": new Date().toISOString(),
    Notes: [
      receipt.notes || "",
      `IMAGE PREFLIGHT BLOCKED PARSE ${new Date().toISOString()}: ${imageIssueMessage}`,
      `Image preflight: orientation=${imagePreflight.orientation}, readability=${imagePreflight.readability}, confidence=${imagePreflight.confidence}.`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  return sendJson(res, 422, {
    ok: false,
    errorType: "rotated_or_unreadable_receipt_image",
    error: imageIssueMessage,
    recordId: receipt.id,
    imagePreflight,
  });
}

const openAiResult = await callOpenAIForReceipt(receipt, imagePreflight);

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
        imagePreflight,
        details: openAiResult.data,
      });
    }

    const parsedText = extractOpenAIText(openAiResult.data);
    const parsed = parseJsonFromModelText(parsedText);

    if (isUnsupportedDocument(parsed)) {
      const message = unsupportedDocumentMessage(parsed);
      const parsedForStorage = {
        ...parsed,
        imagePreflight,
      };

      await updateReceipt(receipt.id, {
        "Processing Status": "Needs Review",
        "Review Needed": true,
        Approved: false,
        "Raw OCR / AI Text": normalizeText(parsed.rawText) || parsedText,
        "Parsed JSON": JSON.stringify(parsedForStorage, null, 2),
        "Error Message": message,
        "Processed At": new Date().toISOString(),
        Notes: [
          receipt.notes || "",
          `PARSING REJECTED ${new Date().toISOString()}: ${message}`,
          `Image preflight: orientation=${imagePreflight.orientation}, readability=${imagePreflight.readability}, confidence=${imagePreflight.confidence}.`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      });

      return sendJson(res, 422, {
        ok: false,
        errorType: "unsupported_document_type",
        error: message,
        recordId: receipt.id,
        imagePreflight,
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
      .map((line, index) =>
        buildLineFields({ receipt, parsed, line, index, imagePreflight })
      );

    const receiptUpdateFields = buildReceiptUpdateFields(
      receipt,
      parsed,
      parsedText,
      imagePreflight
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
        imagePreflight,
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
        imagePreflight,
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
      imagePreflight,
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
