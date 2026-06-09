const AIRTABLE_API_KEY =
  process.env.AIRTABLE_PAT ||
  process.env.AIRTABLE_API_KEY ||
  process.env.AIRTABLE_TOKEN ||
  process.env.KITCHENPULSE_AIRTABLE_API_KEY;

const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID ||
  process.env.KITCHENPULSE_AIRTABLE_BASE_ID ||
  "appD303evZM2SlvMR";

const AIRTABLE_API_URL = "https://api.airtable.com/v0";

const TABLES = {
  costSourceItems: "Cost Source Items",
  parLevels: "Par Levels",
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

const BRAND_NOISE_WORDS = new Set([
  "arezcls",
  "cmblrsv",
  "sys",
  "cls",
  "whlfcs",
  "whlfimp",
  "jdmtmp",
  "jdmtimp",
  "maeploy",
  "brklyn",
  "higbak",
  "kinghaw",
  "kens",
]);

const PHRASE_CLEANUPS = [
  {
    pattern: /\banchovy filet easy open tin\b/i,
    replacement: "Anchovy Filets",
  },
  {
    pattern: /\banchovy filet\b/i,
    replacement: "Anchovy Filets",
  },
  {
    pattern: /\bsoup lobster bisque w\/s\b/i,
    replacement: "Lobster Bisque",
  },
  {
    pattern: /\bsoup lobster bisque\b/i,
    replacement: "Lobster Bisque",
  },
];

function sendJson(res, status, payload) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(status).json(payload);
}

function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value) {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean).join(", ");
  }

  if (value && typeof value === "object") {
    if (value.name) return cleanText(value.name);
    return "";
  }

  return String(value || "").trim();
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;

  if (Array.isArray(value)) {
    return numberOrNull(value[0]);
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getField(fields, names = []) {
  for (const name of names) {
    const value = fields?.[name];

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return null;
}

function getText(fields, names = []) {
  return cleanText(getField(fields, names));
}

function getNumber(fields, names = []) {
  return numberOrNull(getField(fields, names));
}

function splitPackFromName(value) {
  const raw = cleanText(value);

  if (!raw) {
    return {
      itemPart: "",
      packPart: "",
    };
  }

  const parts = raw
    .split(/\s+[—-]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      itemPart: parts.slice(0, -1).join(" - "),
      packPart: parts[parts.length - 1],
    };
  }

  return {
    itemPart: raw,
    packPart: "",
  };
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (/^(and|or|of|the|with|w)$/.test(word)) return word;
      if (/^[a-z]{1,2}$/.test(word)) return word.toUpperCase();

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function removeBrandNoise(value) {
  const words = normalizeSearch(value).split(" ").filter(Boolean);

  const cleanedWords = words.filter((word, index) => {
    if (index === 0 && BRAND_NOISE_WORDS.has(word)) return false;
    return true;
  });

  return cleanedWords.join(" ");
}

function humanizeSourceName(sourceName) {
  const source = cleanText(sourceName);

  if (!source) return "";

  const { itemPart } = splitPackFromName(source);
  const baseName = itemPart || source;

  for (const cleanup of PHRASE_CLEANUPS) {
    if (cleanup.pattern.test(baseName)) {
      return cleanup.replacement;
    }
  }

  const noBrand = removeBrandNoise(baseName);

  if (!noBrand) {
    return baseName;
  }

  return titleCase(noBrand);
}

function normalizeVendor(value) {
  const raw = cleanText(value);
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (
    compact.includes("SYSCO") ||
    compact.includes("SYCSO") ||
    compact.includes("SYSCOATLANTA") ||
    compact.includes("SYCSOATLANTA")
  ) {
    return "Sysco Atlanta LLC";
  }

  return raw;
}

function linkedRecordNames(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return "";
      return cleanText(item?.name);
    })
    .filter(Boolean);
}

function unique(values = []) {
  const seen = new Set();
  const output = [];

  values.forEach((value) => {
    const cleaned = cleanText(value);
    const key = normalizeSearch(cleaned);

    if (!cleaned || !key || seen.has(key)) return;

    seen.add(key);
    output.push(cleaned);
  });

  return output;
}

function suggestionSearchText(suggestion) {
  return normalizeSearch(
    [
      suggestion.displayName,
      suggestion.sourceItemName,
      suggestion.vendorItemName,
      suggestion.vendor,
      suggestion.unit,
      suggestion.packSize,
      suggestion.category,
      ...(suggestion.aliases || []),
    ].join(" ")
  );
}

function scoreSuggestion(suggestion, query) {
  const search = normalizeSearch(query);

  if (!search) return 1;

  const display = normalizeSearch(suggestion.displayName);
  const source = normalizeSearch(suggestion.sourceItemName);
  const vendorItem = normalizeSearch(suggestion.vendorItemName);
  const vendor = normalizeSearch(suggestion.vendor);
  const full = suggestionSearchText(suggestion);

  if (display === search) return 120;
  if (source === search) return 115;
  if (vendorItem === search) return 110;

  if (display.startsWith(search)) return 100;
  if (source.startsWith(search)) return 95;
  if (vendorItem.startsWith(search)) return 92;

  if (display.includes(search)) return 85;
  if (source.includes(search)) return 80;
  if (vendorItem.includes(search)) return 78;

  const queryTokens = search.split(" ").filter(Boolean);

  if (queryTokens.length && queryTokens.every((token) => full.includes(token))) {
    return 70;
  }

  if (vendor.includes(search)) return 25;

  return 0;
}

async function fetchAirtableTable(tableName) {
  if (!AIRTABLE_API_KEY) {
    throw new Error("Missing Airtable API key.");
  }

  const records = [];
  let offset = "";

  do {
    const url = new URL(
      `${AIRTABLE_API_URL}/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`
    );

    url.searchParams.set("pageSize", "100");

    if (offset) {
      url.searchParams.set("offset", offset);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        payload?.error?.message ||
        payload?.error ||
        `Airtable request failed for ${tableName}.`;

      throw new Error(message);
    }

    records.push(...(payload.records || []));
    offset = payload.offset || "";
  } while (offset);

  return records;
}

function buildCostSourceSuggestion(record) {
  const fields = record.fields || {};

  const sourceItemName = getText(fields, [
    "Source Item Name",
    "Item Name",
    "Name",
  ]);

  if (!sourceItemName) return null;

  const displayName =
    getText(fields, [
      "Display Item Name",
      "Friendly Item Name",
      "Clean Item Name",
    ]) || humanizeSourceName(sourceItemName);

  const { packPart } = splitPackFromName(sourceItemName);

  const vendor = normalizeVendor(
    getText(fields, ["Vendor", "Preferred Vendor", "Supplier"])
  );

  const unit = getText(fields, ["Unit", "Current Unit", "Order Unit"]);
  const category = getText(fields, ["Category", "Cost Category"]);
  const currentCost = getNumber(fields, [
    "Current Cost",
    "Current Unit Cost",
    "Unit Cost",
    "Latest Cost",
    "Cost",
  ]);

  const aliases = unique([
    sourceItemName,
    displayName,
    getText(fields, ["Search Aliases", "Aliases"]),
    ...linkedRecordNames(fields["Vendor Receipt Lines"]),
    ...linkedRecordNames(fields["Receipt Cost Proposals"]),
  ]);

  return {
    id: record.id,
    source: "cost_source_item",
    displayName,
    itemName: displayName,
    sourceItemName,
    vendorItemName: displayName,
    vendor,
    unit,
    vendorOrderUnit: unit,
    category,
    packSize: getText(fields, ["Pack Size", "Package Size"]) || packPart,
    currentCost,
    aliases,
    confidence: "Catalog",
  };
}

function buildParLevelSuggestion(record) {
  const fields = record.fields || {};

  const orderItemName = getText(fields, [
    "Order Item Name",
    "Ingredient",
    "Item Name",
  ]);

  if (!orderItemName) return null;

  const vendorItemName = getText(fields, ["Vendor Item Name"]);
  const preferredVendor = normalizeVendor(getText(fields, ["Preferred Vendor"]));
  const unit = getText(fields, ["Vendor Order Unit", "Count Unit"]);
  const packSize = getText(fields, ["OI Pack Size", "Pack Size"]);

  const displayName = orderItemName;

  return {
    id: record.id,
    source: "order_rule",
    displayName,
    itemName: orderItemName,
    sourceItemName: orderItemName,
    vendorItemName,
    vendor: preferredVendor,
    unit,
    vendorOrderUnit: getText(fields, ["Vendor Order Unit"]),
    category: "",
    packSize,
    currentCost: null,
    aliases: unique([
      orderItemName,
      vendorItemName,
      preferredVendor,
      getText(fields, ["Order Vendor SKU"]),
    ]),
    confidence: "Order rule",
  };
}

function dedupeSuggestions(suggestions = []) {
  const byKey = new Map();

  suggestions.forEach((suggestion) => {
    const key = normalizeSearch(
      [
        suggestion.displayName,
        suggestion.vendor,
        suggestion.packSize,
        suggestion.unit,
      ].join(" ")
    );

    if (!key) return;

    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, suggestion);
      return;
    }

    if (existing.source !== "cost_source_item" && suggestion.source === "cost_source_item") {
      byKey.set(key, suggestion);
    }
  });

  return [...byKey.values()];
}

function getLimit(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) return DEFAULT_LIMIT;

  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(numeric)));
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, {
      ok: false,
      error: "Method not allowed.",
    });
  }

  try {
    const query = cleanText(req.query?.q || req.query?.query || "");
    const limit = getLimit(req.query?.limit);

    const [costSourceRecords, parLevelRecords] = await Promise.all([
      fetchAirtableTable(TABLES.costSourceItems),
      fetchAirtableTable(TABLES.parLevels).catch(() => []),
    ]);

    const suggestions = dedupeSuggestions([
      ...costSourceRecords.map(buildCostSourceSuggestion).filter(Boolean),
      ...parLevelRecords.map(buildParLevelSuggestion).filter(Boolean),
    ]);

    const scored = suggestions
      .map((suggestion) => ({
        suggestion,
        score: scoreSuggestion(suggestion, query),
      }))
      .filter((item) => {
        if (!query) return true;
        return item.score > 0;
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;

        if (a.suggestion.source !== b.suggestion.source) {
          if (a.suggestion.source === "cost_source_item") return -1;
          if (b.suggestion.source === "cost_source_item") return 1;
        }

        return String(a.suggestion.displayName || "").localeCompare(
          String(b.suggestion.displayName || "")
        );
      })
      .slice(0, limit)
      .map((item) => ({
        ...item.suggestion,
        matchScore: item.score,
      }));

    return sendJson(res, 200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      query,
      count: scored.length,
      suggestions: scored,
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: error?.message || "Order item suggestions could not be loaded.",
    });
  }
}
