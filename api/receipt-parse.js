/********************************************************************
 * SynthoPulse / KitchenPulse API
 * Route: api/receipt-parse.js
 * Version: v3.1-physical-rotation-us-date-normalization
 *
 * Purpose:
 * - Parse approved Vendor Receipts into Vendor Receipt Lines.
 * - Keep receipt uploads review-first and staging-first.
 * - Physically rotate receipt image candidates before parsing.
 * - Pick the strongest candidate based on receipt evidence.
 * - Write clear transform/orientation debug fields back to Airtable.
 *
 * Reads:
 * - Vendor Receipts
 * - Vendor Receipt Lines
 *
 * Writes:
 * - Vendor Receipts
 * - Vendor Receipt Lines
 *
 * Required package:
 * - npm install sharp
 ********************************************************************/

import sharp from "sharp";

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
const PARSER_VERSION = "receipt-parse-v3.1-physical-rotation-us-date-normalization";
const MAX_PARSE_CANDIDATES = 4;
const PARSED_LINE_LIMIT = 50;
const AIRTABLE_BATCH_SIZE = 10;

const TRANSFORM_CANDIDATES = [
  {
    transformApplied: "none",
    rotationDegrees: 0,
    source: "original",
  },
  {
    transformApplied: "rotate_90_clockwise",
    rotationDegrees: 90,
    source: "physical-rotation",
  },
  {
    transformApplied: "rotate_90_counterclockwise",
    rotationDegrees: -90,
    source: "physical-rotation",
  },
  {
    transformApplied: "rotate_180",
    rotationDegrees: 180,
    source: "physical-rotation",
  },
];

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

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);

    if (isValidDateParts(year, month, day)) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    return "";
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function isValidDateParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function formatDateParts(year, month, day) {
  if (!isValidDateParts(year, month, day)) {
    return "";
  }

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function normalizeUsSlashDate(value) {
  const text = normalizeText(value);
  const match = text.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})\b/);

  if (!match) {
    return "";
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  let year = Number(match[3]);

  if (year < 100) {
    year += year >= 70 ? 1900 : 2000;
  }

  return formatDateParts(year, month, day);
}

function extractLikelyUsReceiptDateFromText(value) {
  const text = normalizeText(value);

  if (!text) {
    return "";
  }

  const matches = [...text.matchAll(/\b(\d{1,2})[\/](\d{1,2})[\/](\d{2}|\d{4})\b/g)];

  for (const match of matches) {
    const normalized = normalizeUsSlashDate(match[0]);

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function normalizeReceiptDate(value, sourceText = "") {
  const fromVisibleText = extractLikelyUsReceiptDateFromText(sourceText);

  if (fromVisibleText) {
    return fromVisibleText;
  }

  const fromValueSlash = normalizeUsSlashDate(value);

  if (fromValueSlash) {
    return fromValueSlash;
  }

  return safeDate(value);
}

function normalizeParsedReceiptDates(parsed, parsedText = "") {
  if (!parsed || typeof parsed !== "object") {
    return parsed;
  }

  const sourceText = [parsed.rawText, parsedText].filter(Boolean).join("\n");
  const normalizedDate = normalizeReceiptDate(parsed.receiptDate, sourceText);

  if (!normalizedDate) {
    return parsed;
  }

  return {
    ...parsed,
    receiptDate: normalizedDate,
  };
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
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

  const createdRecords = [];

  for (const batch of chunkArray(lines, AIRTABLE_BATCH_SIZE)) {
    const result = await airtableFetch(path, {
      method: "POST",
      body: JSON.stringify({
        records: batch.map((fields) => ({ fields })),
        typecast: true,
      }),
    });

    if (!result.ok) {
      return {
        ok: false,
        status: result.status,
        data: result.data,
        createdRecords,
      };
    }

    createdRecords.push(...(result.data?.records || []));
  }

  return {
    ok: true,
    status: 200,
    data: {
      records: createdRecords,
    },
  };
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

Important:
- This is only a clue for the parser.
- Do not reject the upload just because it is rotated.
- If uncertain, use orientation unclear and readability fair.

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

async function fetchImageBuffer(imageUrl) {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(
      `Could not download receipt image for physical rotation. Status=${response.status}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function imageBufferToDataUrl(buffer, mimeType = "image/jpeg") {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function normalizeTransformApplied(value) {
  const allowed = new Set([
    "none",
    "rotate_90_clockwise",
    "rotate_90_counterclockwise",
    "rotate_180",
    "unresolved",
  ]);

  const text = normalizeText(value);

  if (allowed.has(text)) {
    return text;
  }

  return "unresolved";
}

function transformToLegacyOrientation(transformApplied) {
  const normalized = normalizeTransformApplied(transformApplied);

  if (normalized === "none") return "upright";
  if (normalized === "rotate_180") return "upside_down";
  if (normalized === "unresolved") return "unclear";
  return normalized;
}

function transformLabel(transformApplied) {
  const labels = {
    none: "no rotation",
    rotate_90_clockwise: "rotated 90° clockwise",
    rotate_90_counterclockwise: "rotated 90° counterclockwise",
    rotate_180: "rotated 180°",
    unresolved: "unresolved",
  };

  return labels[transformApplied] || labels.unresolved;
}

function makeCandidatePreflight(basePreflight, candidate) {
  const normalizedBase = normalizeImagePreflight(basePreflight || {});
  const transformApplied = normalizeTransformApplied(candidate.transformApplied);

  return {
    ...normalizedBase,
    orientation: transformToLegacyOrientation(transformApplied),
    transformApplied,
    rotationDegrees: candidate.rotationDegrees,
    candidateSource: candidate.source,
    warning: [
      normalizedBase.warning,
      `KitchenPulse created a physical image candidate with transformApplied=${transformApplied}.`,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

async function buildPhysicalRotationCandidates(receipt, imagePreflight) {
  const originalBuffer = await fetchImageBuffer(receipt.fileUrl);
  const normalizedBase = normalizeImagePreflight(imagePreflight || {});

  const candidates = [];

  for (let index = 0; index < TRANSFORM_CANDIDATES.length; index += 1) {
    const candidate = TRANSFORM_CANDIDATES[index];

    let transformedBuffer = originalBuffer;

    if (candidate.rotationDegrees !== 0) {
      transformedBuffer = await sharp(originalBuffer)
        .rotate(candidate.rotationDegrees)
        .jpeg({ quality: 92 })
        .toBuffer();
    }

    const imageUrl = imageBufferToDataUrl(transformedBuffer, "image/jpeg");
    const transformApplied = normalizeTransformApplied(candidate.transformApplied);

    candidates.push({
      index,
      transformApplied,
      selectedOrientation: transformApplied,
      orientation: transformToLegacyOrientation(transformApplied),
      rotationDegrees: candidate.rotationDegrees,
      source: candidate.source,
      imageUrl,
      imagePreflight: makeCandidatePreflight(normalizedBase, candidate),
    });
  }

  return candidates.slice(0, MAX_PARSE_CANDIDATES);
}

function buildOrientationInstruction(imagePreflight) {
  if (!imagePreflight) {
    return "";
  }

  const transformApplied = normalizeTransformApplied(
    imagePreflight.transformApplied
  );
  const readability = imagePreflight.readability || "fair";
  const warning = normalizeText(imagePreflight.warning);

  return `
Image transform candidate:
- transformApplied: ${transformApplied}
- Physical transform: ${transformLabel(transformApplied)}
- Detected readability from original preflight: ${readability}
- Preflight warning: ${warning || "none"}

Important:
- KitchenPulse has already physically transformed this image candidate before sending it to you.
- Do not mentally rotate the image.
- Parse the image exactly as shown.
- If row/column alignment is poor in this transformed candidate, return fewer lines, use lower confidence, and explain the alignment concern in reviewReason.
- Do not punish the operator for a rotated upload.
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
- For U.S. vendor invoices, slash dates like 06/02/26 mean MM/DD/YY, so 06/02/26 must be returned as 2026-06-02, not 2026-07-02.
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
  "documentType": "receipt_invoice | catalog_or_price_sheet | menu | unknown",
  "isReceiptOrInvoice": true,
  "unsupportedReason": "",
  "rawText": "plain text transcription of visible receipt/invoice content",
  "vendor": "vendor or supplier name",
  "receiptDate": "YYYY-MM-DD or empty string",
  "invoiceNumber": "invoice or receipt number if visible",
  "totalAmount": number or null,
  "subtotal": number or null,
  "tax": number or null,
  "confidence": "High | Medium | Low",
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
      "confidence": "High | Medium | Low",
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

async function callOpenAIForReceipt(receipt, imagePreflight, candidateImageUrl) {
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
              image_url: candidateImageUrl || receipt.fileUrl,
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

function confidenceScore(value) {
  const confidence = normalizeConfidence(value);

  if (confidence === "High") return 18;
  if (confidence === "Medium") return 10;
  return 3;
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

function scoreParsedReceipt(parsed, parsedText, imagePreflight) {
  if (!parsed || typeof parsed !== "object") {
    return -1000;
  }

  if (isUnsupportedDocument(parsed)) {
    return -500;
  }

  const lines = Array.isArray(parsed.lines) ? parsed.lines : [];
  const nonEmptyLines = lines.filter((line) => {
    return (
      normalizeText(line?.lineItemName) ||
      normalizeText(line?.rawLineText) ||
      safeNumber(line?.lineTotal) !== null
    );
  });

  const pricedLines = nonEmptyLines.filter((line) => {
    return safeNumber(line?.unitCost) !== null || safeNumber(line?.lineTotal) !== null;
  });

  const namedLines = nonEmptyLines.filter((line) => normalizeText(line?.lineItemName));
  const highConfidenceLines = nonEmptyLines.filter(
    (line) => normalizeConfidence(line?.confidence) === "High"
  );
  const mediumConfidenceLines = nonEmptyLines.filter(
    (line) => normalizeConfidence(line?.confidence) === "Medium"
  );

  const rawTextLength = normalizeText(parsed.rawText || parsedText).length;

  let score = 0;

  score += nonEmptyLines.length * 8;
  score += pricedLines.length * 5;
  score += namedLines.length * 3;
  score += highConfidenceLines.length * 2;
  score += mediumConfidenceLines.length;
  score += Math.min(20, Math.floor(rawTextLength / 200));
  score += confidenceScore(parsed.confidence);

  if (normalizeText(parsed.vendor)) score += 12;
  if (normalizeReceiptDate(parsed.receiptDate, parsed.rawText || parsedText)) score += 10;
  if (safeNumber(parsed.totalAmount) !== null) score += 8;
  if (safeNumber(parsed.subtotal) !== null) score += 4;
  if (safeNumber(parsed.tax) !== null) score += 2;

  if (imagePreflight?.readability === "poor") score -= 6;
  if (imagePreflight?.confidence === "Low") score -= 3;

  if (nonEmptyLines.length === 0) score -= 40;
  if (!normalizeText(parsed.vendor) && !normalizeText(parsed.rawText)) score -= 20;

  return score;
}

function summarizeCandidate(candidateResult) {
  const parsed = candidateResult.parsed || {};
  const lines = Array.isArray(parsed.lines) ? parsed.lines : [];
  const transformApplied = normalizeTransformApplied(
    candidateResult.transformApplied
  );

  return {
    transformApplied,
    selectedOrientation: transformApplied,
    source: candidateResult.source,
    ok: Boolean(candidateResult.ok),
    status: candidateResult.status || null,
    score: candidateResult.score ?? null,
    lineCount: lines.length,
    vendor: normalizeText(parsed.vendor),
    receiptDate: normalizeReceiptDate(parsed.receiptDate, parsed.rawText),
    totalAmount: safeNumber(parsed.totalAmount),
    confidence: normalizeText(parsed.confidence),
    unsupported: candidateResult.parsed ? isUnsupportedDocument(parsed) : false,
    error: normalizeText(candidateResult.error),
  };
}

async function runReceiptParseCandidates(receipt, imagePreflight) {
  const candidates = await buildPhysicalRotationCandidates(receipt, imagePreflight);
  const results = [];

  for (const candidate of candidates) {
    try {
      const openAiResult = await callOpenAIForReceipt(
        receipt,
        candidate.imagePreflight,
        candidate.imageUrl
      );

      if (!openAiResult.ok) {
        results.push({
          ...candidate,
          ok: false,
          status: openAiResult.status,
          error: "OpenAI receipt parsing failed for physical rotation candidate.",
          details: openAiResult.data,
          score: -1000,
        });
        continue;
      }

      const parsedText = extractOpenAIText(openAiResult.data);
      const parsed = normalizeParsedReceiptDates(
        parseJsonFromModelText(parsedText),
        parsedText
      );
      const score = scoreParsedReceipt(
        parsed,
        parsedText,
        candidate.imagePreflight
      );

      results.push({
        ...candidate,
        ok: true,
        status: 200,
        data: openAiResult.data,
        parsedText,
        parsed,
        score,
      });
    } catch (error) {
      results.push({
        ...candidate,
        ok: false,
        status: 500,
        error: error.message || "Physical rotation candidate parse failed.",
        score: -1000,
      });
    }
  }

  const viable = results.filter((result) => result.ok && result.parsed);
  const supported = viable.filter((result) => !isUnsupportedDocument(result.parsed));
  const pool = supported.length ? supported : viable;

  const best = pool.sort((a, b) => b.score - a.score)[0] || null;

  return {
    best,
    results,
    summary: results.map(summarizeCandidate),
  };
}

function buildOrientationDebugSummary({ bestCandidate, parsed, candidateSummary }) {
  const transformApplied = normalizeTransformApplied(
    bestCandidate?.transformApplied
  );
  const score = bestCandidate?.score ?? 0;
  const lineCount = Array.isArray(parsed?.lines) ? parsed.lines.length : 0;
  const vendor = normalizeText(parsed?.vendor) || "no vendor detected";
  const totalDetected = safeNumber(parsed?.totalAmount) !== null;
  const confidence = normalizeConfidence(parsed?.confidence);

  const candidateText = Array.isArray(candidateSummary)
    ? candidateSummary
        .map(
          (candidate) =>
            `${candidate.transformApplied}: score=${candidate.score}, lines=${candidate.lineCount}, confidence=${candidate.confidence || ""}`
        )
        .join(" | ")
    : "";

  return [
    `Selected ${transformApplied}. Candidate scored ${score} with ${lineCount} parsed line(s), vendor ${vendor}, ${totalDetected ? "total detected" : "no total detected"}, and ${confidence} confidence.`,
    candidateText ? `Candidates: ${candidateText}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 5000);
}

function buildReceiptUpdateFields({
  receipt,
  parsed,
  parsedText,
  selectedPreflight,
  originalPreflight,
  candidateSummary,
  bestCandidate,
}) {
  const parsedVendor = normalizeText(parsed.vendor);
  const parsedDate = normalizeReceiptDate(parsed.receiptDate, parsed.rawText || parsedText);
  const parsedTotal = safeNumber(parsed.totalAmount);

  const lineCount = Array.isArray(parsed.lines) ? parsed.lines.length : 0;
  const transformApplied = normalizeTransformApplied(bestCandidate?.transformApplied);
  const selectedOrientation = transformApplied;
  const orientationScore = Number.isFinite(bestCandidate?.score)
    ? Math.round(bestCandidate.score)
    : 0;
  const orientationConfidence = normalizeConfidence(parsed.confidence);
  const orientationNeedsReview =
    lineCount === 0 ||
    transformApplied === "unresolved" ||
    selectedPreflight?.readability === "poor" ||
    selectedPreflight?.confidence === "Low" ||
    parsed?.confidence === "Low";

  const selectedWarning = normalizeText(selectedPreflight?.warning);
  const originalWarning = normalizeText(originalPreflight?.warning);

  const parsedForStorage = {
    ...parsed,
    parserVersion: PARSER_VERSION,
    transformApplied,
    selectedOrientation,
    orientationScore,
    orientationLineCount: lineCount,
    orientationConfidence,
    orientationNeedsReview,
    originalImagePreflight: originalPreflight || null,
    selectedImagePreflight: selectedPreflight || null,
    orientationCandidateSummary: candidateSummary || [],
  };

  const orientationDebugSummary = buildOrientationDebugSummary({
    bestCandidate,
    parsed,
    candidateSummary,
  });

  const notesParts = [
    receipt.notes || "",
    `PARSING ACTION ${new Date().toISOString()}: AI parsed receipt into staging data. ${lineCount} line(s) detected. Parser=${PARSER_VERSION}.`,
    `Transform applied: ${transformApplied}. Orientation score=${orientationScore}. Orientation confidence=${orientationConfidence}.${selectedWarning ? ` Warning: ${selectedWarning}` : ""}`,
    originalPreflight
      ? `Original preflight: orientation=${originalPreflight.orientation}, readability=${originalPreflight.readability}, confidence=${originalPreflight.confidence}.${originalWarning ? ` Warning: ${originalWarning}` : ""}`
      : "",
    candidateSummary?.length
      ? `Physical rotation candidates: ${candidateSummary
          .map(
            (candidate) =>
              `${candidate.transformApplied}: score=${candidate.score}, lines=${candidate.lineCount}`
          )
          .join(" | ")}`
      : "",
    parsed.reviewReason ? `Parser review reason: ${parsed.reviewReason}` : "",
  ];

  const fields = {
    "Processing Status": lineCount > 0 ? "Parsed" : "Needs Review",
    "Review Needed": Boolean(orientationNeedsReview),
    Approved: true,
    "Raw OCR / AI Text": normalizeText(parsed.rawText) || parsedText,
    "Parsed JSON": JSON.stringify(parsedForStorage, null, 2),
    "Processed At": new Date().toISOString(),
    "Error Message": "",
    Notes: notesParts.filter(Boolean).join("\n\n"),
    "Parser Version": PARSER_VERSION,
    "Selected Orientation": selectedOrientation,
    "Transform Applied": transformApplied,
    "Orientation Score": orientationScore,
    "Orientation Line Count": lineCount,
    "Orientation Confidence": orientationConfidence,
    "Orientation Debug Summary": orientationDebugSummary,
    "Orientation Needs Review": Boolean(orientationNeedsReview),
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

function buildLineFields({ receipt, parsed, line, index, selectedPreflight }) {
  const vendor =
    normalizeText(parsed.vendor) ||
    normalizeText(receipt.vendor) ||
    "";

  const normalizedLine = normalizeParsedLine(line);
  const transformApplied = normalizeTransformApplied(
    selectedPreflight?.transformApplied
  );

  const preflightNote =
    selectedPreflight &&
    (transformApplied !== "none" ||
      selectedPreflight.readability === "poor" ||
      selectedPreflight.confidence === "Low")
      ? `Image transform recovery: transformApplied=${transformApplied}, readability=${selectedPreflight.readability}. Verify row alignment.`
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

function summaryLine(candidate) {
  return `${candidate.transformApplied}: ok=${candidate.ok}, score=${candidate.score}, lines=${candidate.lineCount}${candidate.error ? `, error=${candidate.error}` : ""}`;
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
      version: PARSER_VERSION,
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
      "Parser Version": PARSER_VERSION,
      "Transform Applied": "unresolved",
      "Selected Orientation": "unresolved",
      "Orientation Needs Review": true,
    });

    const originalPreflight = await runImagePreflight(receipt);
    const candidateRun = await runReceiptParseCandidates(
      receipt,
      originalPreflight
    );
    const bestCandidate = candidateRun.best;

    if (!bestCandidate) {
      const failedSummary = `No physical rotation candidate produced parseable receipt JSON. Candidates: ${candidateRun.summary
        .map(summaryLine)
        .join(" | ")}`;

      await updateReceipt(receipt.id, {
        "Processing Status": "Needs Review",
        "Review Needed": true,
        Approved: false,
        "Error Message":
          "KitchenPulse could not parse this receipt after trying physical rotation candidates.",
        "Processed At": new Date().toISOString(),
        "Parser Version": PARSER_VERSION,
        "Selected Orientation": "unresolved",
        "Transform Applied": "unresolved",
        "Orientation Score": 0,
        "Orientation Line Count": 0,
        "Orientation Confidence": "Failed",
        "Orientation Debug Summary": failedSummary,
        "Orientation Needs Review": true,
        "Parsed JSON": JSON.stringify(
          {
            parserVersion: PARSER_VERSION,
            transformApplied: "unresolved",
            selectedOrientation: "unresolved",
            originalImagePreflight: originalPreflight,
            orientationCandidateSummary: candidateRun.summary,
          },
          null,
          2
        ),
        Notes: [
          receipt.notes || "",
          `PARSING FAILED ${new Date().toISOString()}: ${failedSummary}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      });

      return sendJson(res, 422, {
        ok: false,
        errorType: "receipt_parse_physical_rotation_candidates_failed",
        error:
          "KitchenPulse could not parse this receipt after trying physical rotation candidates.",
        recordId: receipt.id,
        parserVersion: PARSER_VERSION,
        originalPreflight,
        orientationCandidateSummary: candidateRun.summary,
      });
    }

    const parsed = bestCandidate.parsed;
    const parsedText = bestCandidate.parsedText || "";
    const selectedPreflight = bestCandidate.imagePreflight;
    const selectedTransform = normalizeTransformApplied(
      bestCandidate.transformApplied
    );

    if (isUnsupportedDocument(parsed)) {
      const message = unsupportedDocumentMessage(parsed);
      const lineCount = Array.isArray(parsed.lines) ? parsed.lines.length : 0;
      const orientationScore = Number.isFinite(bestCandidate.score)
        ? Math.round(bestCandidate.score)
        : 0;
      const orientationDebugSummary = buildOrientationDebugSummary({
        bestCandidate,
        parsed,
        candidateSummary: candidateRun.summary,
      });
      const parsedForStorage = {
        ...parsed,
        parserVersion: PARSER_VERSION,
        transformApplied: selectedTransform,
        selectedOrientation: selectedTransform,
        orientationScore,
        orientationLineCount: lineCount,
        orientationConfidence: normalizeConfidence(parsed.confidence),
        orientationNeedsReview: true,
        originalImagePreflight: originalPreflight,
        selectedImagePreflight: selectedPreflight,
        orientationCandidateSummary: candidateRun.summary,
      };

      await updateReceipt(receipt.id, {
        "Processing Status": "Needs Review",
        "Review Needed": true,
        Approved: false,
        "Raw OCR / AI Text": normalizeText(parsed.rawText) || parsedText,
        "Parsed JSON": JSON.stringify(parsedForStorage, null, 2),
        "Error Message": message,
        "Processed At": new Date().toISOString(),
        "Parser Version": PARSER_VERSION,
        "Selected Orientation": selectedTransform,
        "Transform Applied": selectedTransform,
        "Orientation Score": orientationScore,
        "Orientation Line Count": lineCount,
        "Orientation Confidence": normalizeConfidence(parsed.confidence),
        "Orientation Debug Summary": orientationDebugSummary,
        "Orientation Needs Review": true,
        Notes: [
          receipt.notes || "",
          `PARSING REJECTED ${new Date().toISOString()}: ${message}`,
          orientationDebugSummary,
        ]
          .filter(Boolean)
          .join("\n\n"),
      });

      return sendJson(res, 422, {
        ok: false,
        errorType: "unsupported_document_type",
        error: message,
        recordId: receipt.id,
        parserVersion: PARSER_VERSION,
        originalPreflight,
        selectedPreflight,
        transformApplied: selectedTransform,
        selectedOrientation: selectedTransform,
        orientationCandidateSummary: candidateRun.summary,
      });
    }

    const parsedLines = Array.isArray(parsed.lines) ? parsed.lines : [];
    const wasLineLimited = parsedLines.length > PARSED_LINE_LIMIT;

    const lineFields = parsedLines
      .filter((line) => {
        return (
          normalizeText(line.lineItemName) ||
          normalizeText(line.rawLineText) ||
          safeNumber(line.lineTotal) !== null
        );
      })
      .slice(0, PARSED_LINE_LIMIT)
      .map((line, index) =>
        buildLineFields({
          receipt,
          parsed,
          line,
          index,
          selectedPreflight,
        })
      );

    const receiptUpdateFields = buildReceiptUpdateFields({
      receipt,
      parsed,
      parsedText,
      selectedPreflight,
      originalPreflight,
      candidateSummary: candidateRun.summary,
      bestCandidate,
    });

    if (wasLineLimited) {
      receiptUpdateFields.Notes = [
        receiptUpdateFields.Notes || "",
        `KitchenPulse parsed the first ${PARSED_LINE_LIMIT} visible line items from a larger receipt/invoice. Upload remaining pages separately if more lines are needed.`,
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
        parserVersion: PARSER_VERSION,
        originalPreflight,
        selectedPreflight,
        transformApplied: selectedTransform,
        selectedOrientation: selectedTransform,
        orientationCandidateSummary: candidateRun.summary,
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
        parserVersion: PARSER_VERSION,
        originalPreflight,
        selectedPreflight,
        transformApplied: selectedTransform,
        selectedOrientation: selectedTransform,
        orientationCandidateSummary: candidateRun.summary,
        details: lineCreateResult.data,
      });
    }

    return sendJson(res, 200, {
      ok: true,
      message: "Receipt parsed into staging lines.",
      parserVersion: PARSER_VERSION,
      recordId: receipt.id,
      receiptName: receipt.receiptName,
      parsedVendor: parsed.vendor || "",
      parsedReceiptDate: normalizeReceiptDate(parsed.receiptDate, parsed.rawText || parsedText) || "",
      parsedTotalAmount: safeNumber(parsed.totalAmount),
      lineCount: lineFields.length,
      originalPreflight,
      selectedPreflight,
      transformApplied: selectedTransform,
      selectedOrientation: selectedTransform,
      orientationScore: Number.isFinite(bestCandidate.score)
        ? Math.round(bestCandidate.score)
        : 0,
      orientationLineCount: Array.isArray(parsed.lines) ? parsed.lines.length : 0,
      orientationConfidence: normalizeConfidence(parsed.confidence),
      orientationCandidateSummary: candidateRun.summary,
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
          "Parser Version": PARSER_VERSION,
          "Transform Applied": "unresolved",
          "Selected Orientation": "unresolved",
          "Orientation Confidence": "Failed",
          "Orientation Needs Review": true,
          "Orientation Debug Summary": error.message || "Unexpected receipt parse error.",
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
