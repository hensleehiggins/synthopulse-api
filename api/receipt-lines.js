const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID || "appD303evZM2SlvMR";

const AIRTABLE_TOKEN =
  process.env.AIRTABLE_TOKEN ||
  process.env.AIRTABLE_API_KEY ||
  process.env.AIRTABLE_PAT;

const RECEIPT_LINES_TABLE_ID = "tblbQ2BwFHbHFnOht";

const FIELD = {
  lineName: "Line Name",
  receipt: "Receipt",
  restaurant: "Restaurant",
  vendor: "Vendor",
  lineItemName: "Line Item Name",
  matchedInventoryItem: "Matched Inventory Item",
  matchedCostSourceItem: "Matched Cost Source Item",
  category: "Category",
  quantity: "Quantity",
  unit: "Unit",
  packageSize: "Package Size",
  unitCost: "Unit Cost",
  lineTotal: "Line Total",
  confidence: "Confidence",
  needsReview: "Needs Review",
  approved: "Approved",
  rawLineText: "Raw Line Text",
  notes: "Notes",
};

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept"
  );
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  return res.status(statusCode).json(payload);
}

function requireAirtableConfig() {
  if (!AIRTABLE_BASE_ID) {
    throw new Error("Missing AIRTABLE_BASE_ID.");
  }

  if (!AIRTABLE_TOKEN) {
    throw new Error("Missing AIRTABLE_TOKEN / AIRTABLE_API_KEY / AIRTABLE_PAT.");
  }
}

function airtableUrl(tableId) {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    tableId
  )}`;
}

async function airtableRequest({ method = "GET", tableId, recordId, body }) {
  requireAirtableConfig();

  const url = recordId
    ? `${airtableUrl(tableId)}/${recordId}`
    : airtableUrl(tableId);

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    console.error("Airtable returned non-JSON:", text);
    throw new Error("Airtable returned a non-JSON response.");
  }

  if (!response.ok) {
    console.error("Airtable request failed:", data);
    throw new Error(
      data?.error?.message ||
        data?.error ||
        `Airtable request failed with status ${response.status}.`
    );
  }

  return data;
}

function firstLinkedId(value) {
  if (Array.isArray(value) && value.length > 0) return value[0];
  return "";
}

function linkedIds(value) {
  if (Array.isArray(value)) return value;
  return [];
}

function titleCaseItemName(value) {
  return String(value || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 2 && ["oz", "lb", "qt", "cs", "ct"].includes(word)) {
        return word;
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function isNonItemChargeLine(value) {
  const upper = String(value || "").toUpperCase();

  // Food products can legitimately contain words like Bowl/Bowls.
  // Do not treat Sysco sourdough bread bowls as disposable bowls.
   if (
    /\bBREAD\b/.test(upper) &&
    /\b(SOUR|DGH|DOUGH)\b/.test(upper) &&
    /\b(BOWL|BOWLS)\b/.test(upper)
  ) {
    return false;
  }

  if (
    /\bREMOTE\s*-\s*STOCK\b/.test(upper) ||
    /\bOUT\s+EA\b/.test(upper) ||
    /\bOUT\s+CS\b/.test(upper)
  ) {
    return true;
  }

  if (
    /\bCAMBRO\b/.test(upper) ||
    (
      /\b(COVER|COVERS)\b/.test(upper) &&
      /\b(PLAS|PLASTIC|CAMWR|CAMBRO|CONTAINER|CNTNR)\b/.test(upper)
    )
  ) {
    return true;
  }

  return (
    // Sysco category / group totals
    /\bTOTAL\b/.test(upper) &&
    /\b(PAPER|DISPOSABLE|DISPOSABLES|GROUP|SUPPLIES|EQUIPMENT)\b/.test(upper)
  ) || (
    /\bCATEGORY\b/.test(upper) && /\bTOTAL\b/.test(upper)
  ) || (
    /\bGROUP\s+TOTAL\b/.test(upper)
  ) || (
    // Delivery / service / misc charges
    /\bFUEL\b/.test(upper) && /\bSURCHARGE\b/.test(upper)
  ) || (
    /\bDELIVERY\b/.test(upper) && /\b(CHARGE|FEE)\b/.test(upper)
  ) || (
    /\bTRANSPORTATION\b/.test(upper) && /\bFEE\b/.test(upper)
  ) || (
    /\bFREIGHT\b/.test(upper)
  ) || (
    /\bSERVICE\b/.test(upper) && /\b(CHARGE|FEE)\b/.test(upper)
  ) || (
    /\bMISC\b/.test(upper) && /\bCHARGES?\b/.test(upper)
  ) || (
    /\bCHGS?\b/.test(upper) && /\bFUEL\b/.test(upper)
  ) || (
    // Disposable / supply lines we do not want in food cost tracking right now
    /\b(CONTAINER|CNTNR|CUP|CUPS|LID|LIDS|COVER|COVERS|CUTLERY|FORK|FORKS|KNIFE|KNIVES|SPOON|SPOONS|NAPKIN|NAPKINS|STRAW|STRAWS|PLATE|PLATES|BOWL|BOWLS|TRAY|TRAYS|LINER|LINERS|GLOVE|GLOVES|NITRILE|PAD\s+SCOUR|SCOUR\s+PAD|SCOUR|BRUSH|TOWEL|TOWELS)\b/.test(upper)
  ) || (
    /\bPLAS\b/.test(upper) && /\b(CONTAINER|CUP|CLR|CLEAR|MICRO|BLACK|BLK)\b/.test(upper)
  ) || (
    /\bEARTHCHO\b/.test(upper) && /\bKIT\b/.test(upper) && /\bCUTLERY\b/.test(upper)
  );
}

function removeVendorNoiseFromItemName(value) {
  return String(value || "")
    .replace(/\bCOUNTRY\s+OF\s+ORIGIN\s*:?\s*[A-Z\s]+/gi, " ")
    .replace(/\bORIGIN\s*:?\s*[A-Z\s]+/gi, " ")
    .replace(/\bPRODUCT\s+OF\s+[A-Z\s]+/gi, " ")
    .replace(/\bINDONESIA\b/gi, " ")
    .replace(/\bCHILE\b/gi, " ")
    .replace(/\bCANADA\b/gi, " ")
    .replace(/\bUSA\b/gi, " ")
    .replace(/\bU\.S\.A\.\b/gi, " ")
    .replace(/\bHALPERNS?\b/gi, " ")
    .replace(/\bHALPERN['’]?S\b/gi, " ")
    .replace(/\bABE\b/gi, " ")
    .replace(/\bDRISCOLL['’]?S?\b/gi, " ")
    .replace(/\bDAR\b/gi, " ")
    .replace(/\bSTANDARD\b/gi, " ")
    // Common Sysco/OCR brand or column noise that should not lead the human-readable item name.
    .replace(/\bBRIEZIME\b/gi, " ")
    .replace(/\bAREAZIMP\b/gi, " ")
    .replace(/\bAREZZIO\b/gi, " ")
    .replace(/\bPREZIME\b/gi, " ")
    .replace(/\bBRRLTMP\b/gi, " ")
    .replace(/\bCRYBURKLN\b/gi, " ")
    .replace(/\bDOMITE\b/gi, " ")
    .replace(/\bFLOWED\b/gi, " ")
    .replace(/\bFULLRED\b/gi, " ")
    .replace(/\bSYS\s+REFI\b/gi, " ")
    .replace(/\bSYK\b/gi, " ")
    .replace(/\bONY\d+\b/gi, " ")
    .replace(/\bONX[A-Z0-9]*\b/gi, " ")
    .replace(/\bCH?I\b/gi, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+\)/g, " ")
    .replace(/\(\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removePackageSizeFromItemName(value) {
  return String(value || "")
    // leading sizes: "4 OZ Lamb..." / "5-6 OZ Canadian..."
    .replace(/^\s*\d+(?:[./-]\d+)?(?:\s*-\s*\d+(?:[./-]\d+)?)?\s*(OZ|OUNCE|OUNCES|LB|LBS|#)\b\s*/i, "")
    // embedded pack/count text: "2 OZ 72CT", "12/1CT", "5/2#", "10#"
    .replace(/\b\d+(?:[./-]\d+)?(?:\s*-\s*\d+(?:[./-]\d+)?)?\s*(OZ|0Z|OUNCE|OUNCES)\b/gi, " ")
    .replace(/\b\d+\s*CT\b/gi, " ")
    .replace(/\b\d+\s*\/\s*\d+\s*CT\b/gi, " ")
    .replace(/\b\d+\s*\/\s*\d+\s*#\b/gi, " ")
    .replace(/\b\d+\s*#\b/gi, " ")
    .replace(/\b\d+\s*PC\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function compactMatchText(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAnyToken(text, tokens) {
  const upper = compactMatchText(text);
  return tokens.some((token) => new RegExp(`\\b${token}\\b`).test(upper));
}

function hasAllSignals(text, signalGroups) {
  return signalGroups.every((group) => hasAnyToken(text, group));
}

function conservativeSyscoFriendlyName(upper) {
  // These rules intentionally require multiple identifying signals.
  // Do not collapse multi-word prepared items into a generic family name.

  if (hasAllSignals(upper, [["CREAM"], ["CHEESE"], ["LOAF"]])) {
    return "Cream Cheese Loaf";
  }

  if (
    hasAllSignals(upper, [
      ["MOZZARELLA", "MOZZ"],
      ["SHRD", "SHRED", "SHREDDED"],
      ["WHL", "WHOLE"],
    ])
  ) {
    return "Shredded Whole Milk Mozzarella";
  }

  if (hasAllSignals(upper, [["PARM", "PARMESAN"], ["SHAVED"]])) {
    return "Shaved Parmesan";
  }

  if (hasAllSignals(upper, [["SOUR"], ["CREAM"], ["CULTRD", "CULTURED"]])) {
    return "Sour Cream";
  }

  if (hasAllSignals(upper, [["ICE"], ["CREAM"], ["VAN", "VANILLA"]])) {
    return "Vanilla Ice Cream";
  }

  if (hasAllSignals(upper, [["ASIAGO"], ["CHEESE", "CHSE", "CHS"]])) {
    if (hasAnyToken(upper, ["SHRD", "SHRED", "SHREDDED", "SRPD"])) {
      return "Shredded Asiago Cheese";
    }

    return "Asiago Cheese";
  }

  if (hasAllSignals(upper, [["BLUE"], ["CRUMBLES", "CRUMBLED", "CRUMBLE"]])) {
    return "Blue Cheese Crumbles";
  }

  if (hasAllSignals(upper, [["SOUR"], ["DGH", "DOUGH"], ["BOWL", "BOWLS", "SXL", "XL"]])) {
    return "Sourdough Bread Bowls";
  }

  if (hasAllSignals(upper, [["EMPANADA"], ["DISC", "DISCS"], ["DGH", "DOUGH"]])) {
    return "Empanada Dough Discs";
  }

  if (hasAllSignals(upper, [["BROWNIE"], ["CHOC", "CHOCOLATE"], ["CHIP"]])) {
    return "Chocolate Chip Brownies";
  }

  if (hasAnyToken(upper, ["TIRAMISU", "TRAMISU"])) {
    return "Tiramisu";
  }

  if (hasAllSignals(upper, [["ANCHOVY"], ["FILET", "FILETS", "FILLET", "FILLETS"]])) {
    return "Anchovy Filets";
  }

  if (hasAllSignals(upper, [["CAPER", "CAPPER", "CAREER"], ["NONPAREIL", "NONAREIL", "NORMARELL", "NONARELL"]])) {
    return "Nonpareil Capers";
  }

  if (hasAllSignals(upper, [["RANCH"], ["DRESSING"]])) {
    return "Ranch Dressing";
  }

  if (hasAllSignals(upper, [["MAYONNAISE", "MAYO", "MAXONNAISE"], ["HEAVY"], ["DUTY"]])) {
    return "Mayonnaise Heavy Duty";
  }

  if (hasAllSignals(upper, [["OLIVE"], ["OIL"], ["BLEND"], ["80", "8020"]])) {
    return "Olive Oil Blend 80/20";
  }

  if (hasAllSignals(upper, [["OLIVE", "EVOO", "EYVO"], ["OIL", "TIN", "ROBUS"]])) {
    return "Extra Virgin Olive Oil";
  }

  if (hasAllSignals(upper, [["JASMINE"], ["RICE", "THAI", "GRAD", "GRADE"]])) {
    return "Jasmine Rice";
  }

  if (hasAnyToken(upper, ["MARINARA", "MARRINARA"])) {
    return "Marinara Sauce";
  }

  if (hasAllSignals(upper, [["SAUCE"], ["STEAK"]])) {
    return "Steak Sauce";
  }

  if (hasAllSignals(upper, [["SHORTENING", "SHORTINING"], ["FRY"], ["CANOLA"]])) {
    return "Canola Fry Shortening";
  }

  if (hasAllSignals(upper, [["POTATO", "POTATOES", "POT"], ["FRY", "FRIES"], ["STEAK"]])) {
    if (hasAnyToken(upper, ["SYS", "REL", "RELIANCE"])) {
      return "Sysco Reliance Steak Fries";
    }

    return "Steak Fries";
  }

  if (hasAllSignals(upper, [["APPLE"], ["JUICE"], ["BTL", "BOTTLE", "BOTTLES"]])) {
    return "Apple Juice Bottles";
  }

  if (hasAllSignals(upper, [["BASE"], ["BEEF", "BF"]])) {
    return "Beef Base";
  }

  if (
    hasAllSignals(upper, [
      ["COCACOL", "COCACOLA", "COCA", "COKE"],
      ["SYRUP"],
      ["CLASSIC", "CLSC"],
    ])
  ) {
    return "Coca-Cola Classic Syrup";
  }

  return "";
}

function buildDisplayQuantityTextFromLine(line) {
  const parts = [];

  if (line.quantity !== null && typeof line.quantity !== "undefined") {
    parts.push(String(line.quantity));
  }

  if (line.unit) {
    parts.push(line.unit);
  }

  const quantityText = parts.join(" ").trim();
  const packageText = line.packageSize ? String(line.packageSize).trim() : "";

  if (quantityText && packageText) return `${quantityText} · ${packageText}`;
  if (quantityText) return quantityText;
  if (packageText) return packageText;
  return "Quantity not parsed";
}

function buildLineReviewHint({ originalLineItemName, cleanedLineName, rawLineText, confidence }) {
  const reasons = [];
  const sourceText = compactMatchText([originalLineItemName, rawLineText].filter(Boolean).join(" "));
  const confidenceText = String(confidence || "").toLowerCase();

  if (confidenceText.includes("low")) {
    reasons.push("Low parser confidence");
  }

  if (/\b(BRIEZIME|CRYBURKLN|DOMITE|FLOWED|EYVO|SXL|NONARELL|SHORTINING|MAXONNAISE)\b/.test(sourceText)) {
    reasons.push("OCR spelling looks noisy");
  }

  if (cleanedLineName && originalLineItemName && cleanedLineName !== originalLineItemName) {
    reasons.push("Display name cleaned from vendor/OCR text");
  }

  return reasons.join(" · ");
}

function friendlyVendorItemName(value, category = "") {
 const rawOriginal = String(value || "").trim();
if (!rawOriginal) return "";

const raw = removePackageSizeFromItemName(
  removeVendorNoiseFromItemName(rawOriginal)
);

if (!raw) return "";

const upper = raw.toUpperCase();

  if (isNonItemChargeLine(upper)) return "";

  const conservativeSyscoName = conservativeSyscoFriendlyName(upper);
  if (conservativeSyscoName) return conservativeSyscoName;

    // Royal / general produce and prep cleanup.
  // Keep this outside the Sysco-only block so Royal Food Service lines can use it.
    if (
    /\bBERRIES\b/.test(upper) &&
    (/\bSTRAWBERRY\b/.test(upper) || /\bSTRAWBERRIES\b/.test(upper))
  ) {
    if (/\bDRISCOLL\b/.test(upper)) return "Driscoll Strawberries";
    return "Strawberries";
  }

  if (/\bSTRAWBERRY\b/.test(upper) || /\bSTRAWBERRIES\b/.test(upper)) {
    if (/\bDRISCOLL\b/.test(upper)) return "Driscoll Strawberries";
    return "Strawberries";
  }

  if (/\bBUTTER\b/.test(upper) && /\bUNSALTED\b/.test(upper)) {
    return "Unsalted Butter";
  }

  if (/\bHERB\b/.test(upper) && /\bMINT\b/.test(upper)) {
    return "Mint";
  }

  if (/\bMINT\b/.test(upper)) {
    return "Mint";
  }

  if (/\bLEMON\b/.test(upper) || /\bLEMONS\b/.test(upper)) {
    return "Lemons";
  }

  if (
    /\bTOMATO\b/.test(upper) &&
    /\bCHERRY\b/.test(upper) &&
    /\bHEIRLOOM\b/.test(upper)
  ) {
    return "Heirloom Cherry Tomatoes";
  }

  if (
    /\bBEAN\b/.test(upper) &&
    /\bGREEN\b/.test(upper)
  ) {
    return "Green Beans";
  }

  if (/\bRASPBERRY\b/.test(upper) || /\bRASPBERRIES\b/.test(upper)) {
    return "Raspberries";
  }

  if (/\bPARSLEY\b/.test(upper) && /\bITALIAN\b/.test(upper)) {
    return "Italian Parsley";
  }
  if (
    /\bBERRIES\b/.test(upper) &&
    (/\bBLACKBERRY\b/.test(upper) || /\bBLACKBERRIES\b/.test(upper))
  ) {
    return "Blackberries";
  }

  if (/\bBLACKBERRY\b/.test(upper) || /\bBLACKBERRIES\b/.test(upper)) {
    return "Blackberries";
  }

  if (/\bASPARAGUS\b/.test(upper)) {
    return "Asparagus";
  }

  if (
    /\bFLOWERS?\b/.test(upper) &&
    /\bEDIBLE\b/.test(upper) &&
    /\bORCHID\b/.test(upper)
  ) {
    return "Edible Orchids";
  }

  if (
    (/\bBRUSSEL\b/.test(upper) || /\bBRUSSELS\b/.test(upper)) &&
    (/\bSPROUT\b/.test(upper) || /\bSPROUTS\b/.test(upper))
  ) {
    return "Brussels Sprouts";
  }

  if (/\bMUSHROOM\b/.test(upper) && /\bSHIITAKE\b/.test(upper)) {
    return "Shiitake Mushrooms";
  }

  if (
    /\bGARLIC\b/.test(upper) &&
    (/\bPEELED\b/.test(upper) ||
      /\bPELD\b/.test(upper) ||
      /\bPLD\b/.test(upper))
  ) {
    return "Peeled Garlic";
  }

  if (/\bSHALLOT\b/.test(upper) || /\bSHALLOTS\b/.test(upper)) {
    if (
      /\bPEELED\b/.test(upper) ||
      /\bPELD\b/.test(upper) ||
      /\bPLD\b/.test(upper)
    ) {
      return "Peeled Shallots";
    }

    return "Shallots";
  }

  if (
    /\bSP\b/.test(upper) &&
    /\bBASE\b/.test(upper) &&
    /\bMI\b/.test(upper) &&
    /\bTUB\b/.test(upper)
  ) {
    return "Beef Base";
  }

  if (
    /\bBASE\b/.test(upper) &&
    (/\bBEEF\b/.test(upper) || /\bBF\b/.test(upper))
  ) {
    return "Beef Base";
  }

  if (/\bAPPLE\b/.test(upper) && /\bFUJI\b/.test(upper)) {
    return "Fuji Apples";
  }

  if (
    /\bPICKLE\b/.test(upper) &&
    (/\bCHIP\b/.test(upper) || /\bCHIPS\b/.test(upper))
  ) {
    return "Pickle Chips";
  }

  if (/\bCILANTRO\b/.test(upper)) {
    return "Cilantro";
  }

  if (/\bPARSLEY\b/.test(upper) && /\bCURLY\b/.test(upper)) {
    return "Curly Parsley";
  }
  
  const isSyscoReliance =
    /\bSYS\s+REL\b/.test(upper) ||
    /\bSYSCO\s+REL\b/.test(upper) ||
    /\bSYSCO\s+RELIABILITY\b/.test(upper) ||
    /\bRELIABILITY\b/.test(upper);

  if (isSyscoReliance) {
    if (/\bDRESSING\b/.test(upper)) {
      const isBlueCheese =
        /\bBLUE\b/.test(upper) && /\b(CHS|CHSE|CHEESE)\b/.test(upper);

      if (isBlueCheese) {
        const isChunky =
          /\bCHUNKY\b|\bCHNKY\b|\bCHNK\b/.test(upper);

        return isChunky
          ? "Sysco Reliance Blue Cheese Dressing Chunky"
          : "Sysco Reliance Blue Cheese Dressing";
      }
    }

      if (
    /\bBERRIES\b/.test(upper) &&
    (/\bBLACKBERRY\b/.test(upper) || /\bBLACKBERRIES\b/.test(upper))
  ) {
    return "Blackberries";
  }

  if (/\bBLACKBERRY\b/.test(upper) || /\bBLACKBERRIES\b/.test(upper)) {
    return "Blackberries";
  }

  if (/\bASPARAGUS\b/.test(upper)) {
    return "Asparagus";
  }

  if (
    /\bFLOWERS?\b/.test(upper) &&
    /\bEDIBLE\b/.test(upper) &&
    /\bORCHID\b/.test(upper)
  ) {
    return "Edible Orchids";
  }

  if (
    (/\bBRUSSEL\b/.test(upper) || /\bBRUSSELS\b/.test(upper)) &&
    (/\bSPROUT\b/.test(upper) || /\bSPROUTS\b/.test(upper))
  ) {
    return "Brussels Sprouts";
  }

  if (/\bMUSHROOM\b/.test(upper) && /\bSHIITAKE\b/.test(upper)) {
    return "Shiitake Mushrooms";
  }

  if (
    /\bGARLIC\b/.test(upper) &&
    (/\bPEELED\b/.test(upper) || /\bPELD\b/.test(upper) || /\bPLD\b/.test(upper))
  ) {
    return "Peeled Garlic";
  }

  if (/\bSHALLOT\b/.test(upper) || /\bSHALLOTS\b/.test(upper)) {
    if (
      /\bPEELED\b/.test(upper) ||
      /\bPELD\b/.test(upper) ||
      /\bPLD\b/.test(upper)
    ) {
      return "Peeled Shallots";
    }

    return "Shallots";
  }

    if (
    /\bSP\b/.test(upper) &&
    /\bBASE\b/.test(upper) &&
    /\bMI\b/.test(upper) &&
    /\bTUB\b/.test(upper)
  ) {
    return "Beef Base";
  }

  if (
    /\bBASE\b/.test(upper) &&
    (/\bBEEF\b/.test(upper) || /\bBF\b/.test(upper))
  ) {
    return "Beef Base";
  }

  if (/\bAPPLE\b/.test(upper) && /\bFUJI\b/.test(upper)) {
    return "Fuji Apples";
  }

  if (
    /\bPICKLE\b/.test(upper) &&
    (/\bCHIP\b/.test(upper) || /\bCHIPS\b/.test(upper))
  ) {
    return "Pickle Chips";
  }

      if (/\bCILANTRO\b/.test(upper)) {
    return "Cilantro";
  }

  if (/\bPARSLEY\b/.test(upper) && /\bCURLY\b/.test(upper)) {
    return "Curly Parsley";
  }

        if (/\bPOTATO\b|\bPOTATOES\b|\bPOT\b/.test(upper)) {
      if (/\bFRY\b|\bFRIES\b/.test(upper) && /\bSTEAK\b/.test(upper)) {
        return "Sysco Reliance Steak Fries";
      }

      return "Sysco Reliance Potatoes";
    }

    if (/\bMAYONNAISE\b|\bMAYO\b/.test(upper)) {
      if (/\bHEAVY\b/.test(upper) && /\bDUTY\b/.test(upper)) {
        return "Sysco Reliance Mayonnaise Heavy Duty";
      }

      return "Sysco Reliance Mayonnaise";
    }
  }

    if (/\bMEATBALL\b|\bMEATBALLS\b/.test(upper)) {
    if (/\bBEEF\b/.test(upper)) return "Italian Meatball Beef";
    return "Italian Meatballs";
  }

  if (
    /\bLAMB\b/.test(upper) &&
    /\bLOIN\b/.test(upper) &&
    /\bCHOP\b/.test(upper)
  ) {
    return "Imported Lamb Loin Chop";
  }

  if (/\bSNAPPER\b/.test(upper) && /\bFILLET\b/.test(upper)) {
    return "Snapper Fillet";
  }

  if (
    /\bLOBSTER\b/.test(upper) &&
    (/\bTAIL\b/.test(upper) || /\bTAILS\b/.test(upper))
  ) {
    return "Canadian Lobster Tails";
  }

  if (
    /\bBACON\b/.test(upper) &&
    /\bWRAPPED\b/.test(upper) &&
    /\bDATES\b/.test(upper)
  ) {
    return "Bacon Wrapped Dates Goat Cheese";
  }

  if (
    /\bPORK\b/.test(upper) &&
    (/\bRIB\b/.test(upper) || /\bRIBS\b/.test(upper))
  ) {
    return "Pork St Louis Ribs";
  }
  
  if (/\bDRESSING\b/.test(upper)) {
    const isBlueCheese =
      /\bBLUE\b/.test(upper) && /\b(CHS|CHSE|CHEESE)\b/.test(upper);

    if (isBlueCheese) {
      const isChunky =
        /\bCHUNKY\b|\bCHNKY\b|\bCHNK\b/.test(upper);

      return isChunky
        ? "Blue Cheese Dressing Chunky"
        : "Blue Cheese Dressing";
    }

    if (/\bRANCH\b/.test(upper)) return "Ranch Dressing";
    if (/\bCAESAR\b/.test(upper)) return "Caesar Dressing";
    if (/\bITALIAN\b/.test(upper)) return "Italian Dressing";

    return "Dressing";
  }

  if (
    /\bOCEAN\s*SPRAY\b|\bOCEANSPRAY\b|\bOCN\s*SPRAY\b|\bOCNSPRAY\b|\bOCNSPRY\b|\bOCN\s*SPRY\b/.test(upper)
  ) {
    if (/\bCRANBERRY\b|\bCRNBRY\b|\bCRAN\b/.test(upper)) {
      if (/\bJUICE\b|\bDRINK\b|\bRTS\b|\bCKTAIL\b|\bCOCKTAIL\b/.test(upper)) {
        return "Ocean Spray Cranberry Juice";
      }

      return "Ocean Spray Cranberry";
    }

    return "Ocean Spray";
  }

  if (/\bSEASONING\b/.test(upper)) {
    if (/\bCAJUN\b/.test(upper)) return "Cajun Seasoning";
    return "Seasoning";
  }

  if (/\bSALT\b/.test(upper)) {
    if (/\bKOSHER\b/.test(upper)) return "Kosher Salt";
    return "Salt";
  }

  if (/\bCHEESE\b/.test(upper)) {
    if (/\bSWISS\b/.test(upper) && /\b(AMER|AMERICAN)\b/.test(upper)) {
      return "Swiss/American Cheese Slices";
    }

    if (/\bCHEDDAR\b|\bCHED\b|\bCHDR\b/.test(upper)) {
      if (/\bSHARP\b/.test(upper)) return "Sharp Cheddar Cheese";

      if (/\bSHR\b|\bSHRD\b|\bSHRED\b|\bSHREDDED\b/.test(upper)) {
        return "Cheddar Cheese Shredded";
      }

      return "Cheddar Cheese";
    }

    if (/\bSWISS\b/.test(upper)) return "Swiss Cheese";
    if (/\b(AMER|AMERICAN)\b/.test(upper)) return "American Cheese";
  }

    if (
    (/\bCHIX\b/.test(upper) || /\bCHICKEN\b/.test(upper)) &&
    /\bAIRLINE\b/.test(upper) &&
    (/\bBRST\b/.test(upper) || /\bBREAST\b/.test(upper))
  ) {
    return "Airline Chicken Breast";
  }
  
  if (
    /\b(CHKN|CHICKEN)\b/.test(upper) &&
    /\b(WNG|WING|WINGS)\b/.test(upper)
  ) {
    if (/\b(JMB|JUMBO)\b/.test(upper)) return "Chicken Wings Jumbo";
    return "Chicken Wings";
  }

  if (/\bMAYONNAISE\b|\bMAYO\b/.test(upper)) {
    if (/\bHEAVY\b/.test(upper) && /\bDUTY\b/.test(upper)) {
      return "Mayonnaise Heavy Duty";
    }

    return "Mayonnaise";
  }

  if (/\bCRANBERRY\b|\bCRNBRY\b/.test(upper)) {
    if (/\bJUICE\b|\bDRINK\b|\bRTS\b|\bCKTAIL\b|\bCOCKTAIL\b/.test(upper)) {
      return "Cranberry Juice";
    }

    return "Cranberry";
  }

  if (/\bCARROT\b/.test(upper)) {
    if (/\bBABY\b/.test(upper) && /\b(TRI|COLOR|COLOUR)\b/.test(upper)) {
      return "Tri-Color Baby Carrots";
    }

    if (/\bBABY\b/.test(upper)) return "Baby Carrots";
    return "Carrots";
  }

  if (/\bCUCUMBER\b|\bCUC\b/.test(upper)) {
    if (/\bPICKL\b|\bPICKLING\b/.test(upper)) return "Pickling Cucumbers";
    return "Cucumbers";
  }

    if (/\bDILL\b/.test(upper)) return "Dill";

  if (/\bPOTATO\b|\bPOTATOES\b|\bPOT\b/.test(upper)) {
    if (/\bFRY\b|\bFRIES\b/.test(upper) && /\bSTEAK\b/.test(upper)) {
      return "Steak Fries";
    }

    if (/\bYUKON\b/.test(upper) && /\bGOLD\b/.test(upper)) {
      return "Potato Yukon Gold";
    }

    if (/\bIDAHO\b/.test(upper)) {
      return "Potato Idaho";
    }

    if (/\bRUSSET\b/.test(upper)) {
      return "Potato Russet";
    }

    if (/\bRED\b/.test(upper)) {
      return "Red Potatoes";
    }

    if (/\bSWEET\b/.test(upper)) {
      return "Sweet Potatoes";
    }

    return "Potatoes";
  }

  const cleaned = upper
    .replace(/&/g, " AND ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(
      (token) =>
        ![
          "SYS",
          "CLS",
          "CVP",
          "RND",
          "IMP",
          "BRL",
          "BRBL",
          "BRRL",
          "BRRBL",
          "BRRLIMP",
          "BBRLIMP",
          "BRRLCLS",
          "BBRLCLS",
          "IMPFRSH",
          "MCC",
          "PACKER",
          "PLD",
          "PRIN",
          "ONLY",
          "AVG",
          "WT",
          "TWT",
          "RES",
          "PET",
          "RTS",
          "PK",
          "PKG",
          "PACKAGE",
          "CS",
          "EA",
          "RAW",
          "BRAND",
          "FRESH",
          "SLICED",
          "SLI",
        ].includes(token)
    )
    .filter((token) => !/^\d+[A-Z]*$/.test(token))
    .filter((token) => !/^[A-Z]*\d+[A-Z]*$/.test(token))
    .map((token) => {
      const map = {
        CHKN: "CHICKEN",
        CHK: "CHICKEN",
        WNG: "WINGS",
        JMB: "JUMBO",
        SHRMP: "SHRIMP",
        CHDR: "CHEDDAR",
        CHED: "CHEDDAR",
        HRTS: "HEARTS",
      };

      return map[token] || token;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length <= 2) return raw;

  return titleCaseItemName(cleaned);
}
function asNumberOrNull(value) {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return null;
  }

  return numericValue;
}

function normalizeLineRecord(record) {
  const fields = record.fields || {};

  const rawLineName = fields[FIELD.lineItemName] || "";
  const rawLineText = fields[FIELD.rawLineText] || "";
  const category = fields[FIELD.category] || "";
  const confidence = fields[FIELD.confidence] || "";
  const cleanedLineName =
    friendlyVendorItemName(rawLineName || rawLineText, category) || rawLineName;

  const quantity =
    typeof fields[FIELD.quantity] === "number" ? fields[FIELD.quantity] : null;
  const unit = fields[FIELD.unit] || "";
  const packageSize = fields[FIELD.packageSize] || "";
  const unitCost =
    typeof fields[FIELD.unitCost] === "number" ? fields[FIELD.unitCost] : null;
  const lineTotal =
    typeof fields[FIELD.lineTotal] === "number"
      ? fields[FIELD.lineTotal]
      : null;

  const previewLine = {
    quantity,
    unit,
    packageSize,
  };

return {
    id: record.id,
    createdTime: record.createdTime,

    lineName: fields[FIELD.lineName] || "",
    receiptIds: linkedIds(fields[FIELD.receipt]),
    receiptId: firstLinkedId(fields[FIELD.receipt]),
    restaurantIds: linkedIds(fields[FIELD.restaurant]),

    vendor: fields[FIELD.vendor] || "",
    lineItemName: cleanedLineName,
    originalLineItemName: rawLineName,
    matchedInventoryItemIds: linkedIds(fields[FIELD.matchedInventoryItem]),
    matchedCostSourceItemIds: linkedIds(fields[FIELD.matchedCostSourceItem]),

    category,
    quantity,
    unit,
    packageSize,
    unitCost,
    lineTotal,

    confidence,
    needsReview: Boolean(fields[FIELD.needsReview]),
    approved: Boolean(fields[FIELD.approved]),
    rawLineText,
    notes: fields[FIELD.notes] || "",

    // Display-only helpers for Softr/human review. These do not overwrite Airtable
    // unless the operator edits/saves or approves the cleaned line.
    displayLineItemName: cleanedLineName,
    displayQuantityText: buildDisplayQuantityTextFromLine(previewLine),
    displayReviewHint: buildLineReviewHint({
      originalLineItemName: rawLineName,
      cleanedLineName,
      rawLineText,
      confidence,
    }),
  };
}

function buildCounts(lines) {
  return {
    total: lines.length,
    approved: lines.filter((line) => line.approved).length,
    needsReview: lines.filter((line) => line.needsReview && !line.approved)
      .length,
    pending: lines.filter((line) => !line.approved && !line.needsReview).length,
  };
}

function sanitizeUpdateFields(input = {}) {
  const fields = {};

  if (Object.prototype.hasOwnProperty.call(input, "lineItemName")) {
    fields[FIELD.lineItemName] = String(input.lineItemName || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(input, "category")) {
    const category = String(input.category || "").trim();

    if (category) {
      fields[FIELD.category] = category;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "quantity")) {
    const quantity = asNumberOrNull(input.quantity);

    if (quantity !== null) {
      fields[FIELD.quantity] = quantity;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "unit")) {
    fields[FIELD.unit] = String(input.unit || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(input, "packageSize")) {
    fields[FIELD.packageSize] = String(input.packageSize || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(input, "unitCost")) {
    const unitCost = asNumberOrNull(input.unitCost);

    if (unitCost !== null) {
      fields[FIELD.unitCost] = unitCost;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "lineTotal")) {
    const lineTotal = asNumberOrNull(input.lineTotal);

    if (lineTotal !== null) {
      fields[FIELD.lineTotal] = lineTotal;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "rawLineText")) {
    fields[FIELD.rawLineText] = String(input.rawLineText || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(input, "notes")) {
    fields[FIELD.notes] = String(input.notes || "").trim();
  }

  return fields;
}

async function listReceiptLines(req, res) {
  const receiptId =
    typeof req.query.receiptId === "string" ? req.query.receiptId.trim() : "";

  const maxRecordsRaw =
    typeof req.query.maxRecords === "string" ? Number(req.query.maxRecords) : 100;

  const maxRecords =
    Number.isFinite(maxRecordsRaw) && maxRecordsRaw > 0
      ? Math.min(maxRecordsRaw, 100)
      : 100;

  const params = new URLSearchParams();
  params.set("pageSize", String(maxRecords));

  const fieldsToReturn = Object.values(FIELD);

  for (const fieldName of fieldsToReturn) {
    params.append("fields[]", fieldName);
  }

  const url = `${airtableUrl(RECEIPT_LINES_TABLE_ID)}?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    console.error("Airtable receipt lines returned non-JSON:", text);
    throw new Error("Airtable receipt lines returned a non-JSON response.");
  }

  if (!response.ok) {
    console.error("Airtable receipt lines request failed:", data);
    throw new Error(
      data?.error?.message ||
        data?.error ||
        `Could not load receipt lines. Airtable status ${response.status}.`
    );
  }

  let lines = Array.isArray(data.records)
    ? data.records.map(normalizeLineRecord)
    : [];

  if (receiptId) {
    lines = lines.filter((line) => line.receiptIds.includes(receiptId));
  }

  lines = lines.filter((line) => {
  const text = [
    line.originalLineItemName,
    line.lineItemName,
    line.rawLineText,
    line.category,
    line.packageSize,
  ]
    .filter(Boolean)
    .join(" ");

  return !isNonItemChargeLine(text);
});

  lines.sort((a, b) => {
    if (a.approved !== b.approved) return a.approved ? 1 : -1;
    if (a.needsReview !== b.needsReview) return a.needsReview ? -1 : 1;
    return String(a.lineItemName || a.lineName).localeCompare(
      String(b.lineItemName || b.lineName)
    );
  });

  return sendJson(res, 200, {
    ok: true,
    receiptId: receiptId || null,
    counts: buildCounts(lines),
    lines,
  });
}

async function updateReceiptLine(req, res) {
  const body = req.body || {};
  const recordId = String(body.recordId || body.lineId || "").trim();
  const action = String(body.action || "update_line").trim();

  if (!recordId) {
    return sendJson(res, 400, {
      ok: false,
      error: "Missing recordId.",
    });
  }

  const fields = {};

  if (action === "approve_line") {
    const existingRecord = await airtableRequest({
  method: "GET",
  tableId: RECEIPT_LINES_TABLE_ID,
  recordId,
});

const existingLine = normalizeLineRecord(existingRecord);

const chargeCheckText = [
  existingLine.originalLineItemName,
  existingLine.lineItemName,
  existingLine.rawLineText,
  existingLine.category,
  existingLine.packageSize,
]
  .filter(Boolean)
  .join(" ");

if (isNonItemChargeLine(chargeCheckText)) {
  return sendJson(res, 400, {
    ok: false,
    error: "This looks like a vendor charge, not a product line. It should not be approved as a cost item.",
  });
}

if (
  existingLine.lineItemName &&
  existingLine.originalLineItemName &&
  existingLine.lineItemName !== existingLine.originalLineItemName
) {
  fields[FIELD.lineItemName] = existingLine.lineItemName;
}
    fields[FIELD.approved] = true;
    fields[FIELD.needsReview] = false;

    if (body.notes) {
      fields[FIELD.notes] = String(body.notes).trim();
    }
  } else if (action === "needs_review") {
    fields[FIELD.approved] = false;
    fields[FIELD.needsReview] = true;

    if (body.notes) {
      fields[FIELD.notes] = String(body.notes).trim();
    }
    } else if (action === "update_line") {
    Object.assign(fields, sanitizeUpdateFields(body.line || body));

    // A saved edit should not automatically approve the line.
    // It simply keeps the human correction in Airtable for review.
    if (Object.keys(fields).length === 0) {
      return sendJson(res, 400, {
        ok: false,
        error: "No editable line fields were provided.",
      });
    }
  } else if (action === "remove_line") {
    await fetch(`${airtableUrl(RECEIPT_LINES_TABLE_ID)}/${recordId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    return sendJson(res, 200, {
      ok: true,
      action,
      message: "Line removed.",
      removedLineId: recordId,
    });
  } else {
    return sendJson(res, 400, {
      ok: false,
      error: `Unsupported action: ${action}`,
    });
  }

  const updated = await airtableRequest({
    method: "PATCH",
    tableId: RECEIPT_LINES_TABLE_ID,
    recordId,
    body: {
      fields,
    },
  });

  return sendJson(res, 200, {
    ok: true,
    action,
    message:
      action === "approve_line"
        ? "Line approved."
        : action === "needs_review"
        ? "Line returned to review."
        : "Line updated.",
    line: normalizeLineRecord(updated),
  });
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    requireAirtableConfig();

    if (req.method === "GET") {
      return await listReceiptLines(req, res);
    }

    if (req.method === "POST" || req.method === "PATCH") {
      return await updateReceiptLine(req, res);
    }

    return sendJson(res, 405, {
      ok: false,
      error: "Method not allowed.",
    });
  } catch (error) {
    console.error("receipt-lines route failed:", error);

    return sendJson(res, 500, {
      ok: false,
      error:
        error?.message ||
        "Receipt lines could not be loaded or updated. Check server logs.",
    });
  }
}
