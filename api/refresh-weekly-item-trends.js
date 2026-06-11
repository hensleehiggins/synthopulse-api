/******************************************************************** 
 * KitchenPulse API - Refresh Weekly Item Trends v1.1
 *
* Purpose:
 * - Recalculate Weekly Item Trends for one restaurant/tenant.
 * - Build current/prior trend windows from clean completed POS dinner/close
 *   reporting runs.
 * - Use mapped, Decision Eligible Menu Items and Daily Sales rows.
 * - Upsert useful current-vs-prior trend rows and deactivate stale trend rows
 *   for the restaurant.
 *
 * Request:
 * - GET or POST
 * - Pass restaurantId=rec... or restaurantName=Chloe
 * - Optional x-admin-secret header or ?secret=... when ADMIN_REFRESH_SECRET is set
 *
 * Reporting-run gate:
 * - Runs must be:
 *   - Run Status = Completed
 *   - Same restaurant/tenant
 *   - POS close/dinner reporting run
 *   - Not partial, test, fake, sample, imported, or explicitly unsafe
 *
 * Important:
 * - Weekly Trends do NOT require Use For Decision Layer.
 * - Weekly Trends do NOT require Is Latest Decision Run.
 * - Those flags control current decision truth, not historical reporting windows.
 * - This route intentionally compares multiple clean historical close runs so
 *   weekly movement does not collapse to only the latest decision run.
 *
 * Touches:
 * - Weekly Item Trends
 *   - Creates/updates useful movement rows
 *   - Marks current calculated rows active
 *   - Deactivates stale rows for this restaurant
 *
 * Does NOT:
 * - Create or update Runs
 * - Create or update Daily Sales
 * - Create or update Top/Low Sellers
 * - Create or update Item Movement
 * - Create or update Forecasts & Insights
 ********************************************************************/

const Airtable = require("airtable");

const base = new Airtable({
  apiKey: process.env.AIRTABLE_PAT,
}).base(process.env.AIRTABLE_BASE_ID);

const REQUIRED_SECRET = process.env.ADMIN_REFRESH_SECRET || "";
const RUN_STATUS_COMPLETED = "Completed";

const TABLES = {
  restaurants: "Restaurants",
  menuItems: "Menu Items",
  dailySales: "Daily Sales",
  runs: "Runs",
  weeklyTrends: "Weekly Item Trends",
};

const CURRENT_RUN_COUNT = 5;
const PRIOR_RUN_COUNT = 5;

const MATERIALITY = {
  // Minimum baseline needed before a row is worth calculating.
  minCurrentOrPriorQty: 2,

  // Lower row-creation thresholds. Softr still ranks and limits display.
// Lighter signals use Trend Strength = Watch to avoid creating new Airtable select options.
  minRevenueChange: 50,
  minProfitChange: 25,
  minQtyChange: 1,
  minDisplayPriority: 20,

  // Stronger owner-alert thresholds used for Trend Strength, not row creation.
  ownerRevenueChange: 200,
  ownerProfitChange: 100,
  ownerQtyChange: 5,
};

function send(res, status, body) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-secret");
  return res.status(status).json(body);
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  const n = num(value);
  return Math.round(n * 100) / 100;
}

function pct(current, prior) {
  if (!prior) return current > 0 ? 1 : 0;
  return (current - prior) / Math.abs(prior);
}

function safeRatio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getLinkedId(value) {
  if (!Array.isArray(value) || value.length === 0) return "";

  const first = value[0];

  if (typeof first === "string") return first;
  if (first && typeof first === "object" && first.id) return first.id;

  return "";
}

function getLinkedIds(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object" && entry.id) return entry.id;
      return "";
    })
    .filter(Boolean);
}

function hasLinkedId(value, targetId) {
  if (!targetId) return false;
  return getLinkedIds(value).includes(targetId);
}

function parseRunDate(runId, createdTime) {
  const match = String(runId || "").match(/(\d{4}-\d{2}-\d{2})/);

  if (match) {
    return match[1];
  }

  if (createdTime) {
    return new Date(createdTime).toISOString().slice(0, 10);
  }

  return "";
}

function isReportingRunId(runId) {
  const text = String(runId || "").toLowerCase();

  if (!text.includes("pos-")) return false;
  if (!text.includes("-close-")) return false;
  if (text.includes("test")) return false;
  if (text.includes("fake")) return false;
  if (text.includes("sample")) return false;
  if (text.includes("imported")) return false;

  return true;
}

function getSelectName(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.name) return value.name;
  return "";
}

function isCompletedReportingRun(fields = {}) {
  const status = getSelectName(fields["Run Status"]);

  // New hardened runs should explicitly say Completed.
  if (status === RUN_STATUS_COMPLETED) return true;

  // Legacy POS close runs created before Run Status hardening often have no
  // Run Status value. Weekly Trends may use those as historical reporting runs
  // if they pass the later restaurant, close-run, unsafe-history, and Daily Sales
  // gates.
  if (!status) return true;

  return false;
}

function isExplicitlyUnsafeHistoricalRun(fields = {}) {
  const runId = String(fields["Run ID"] || "").toLowerCase();
  const gateReason = String(fields["Completion Gate Reason"] || "").toLowerCase();

  const blockedFragments = [
    "partial",
    "test",
    "fake",
    "sample",
    "imported",
    "historical test",
    "do not use",
  ];

  return blockedFragments.some(
    (fragment) => runId.includes(fragment) || gateReason.includes(fragment)
  );
}

function normalizeServiceType(value) {
  const text = String(value || "").trim().toLowerCase();

  if (!text) return "unknown";
  if (text.includes("dinner")) return "dinner";
  if (text.includes("lunch")) return "lunch";
  if (text.includes("brunch")) return "brunch";
  if (text.includes("full")) return "full_day";

  return text.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function isAllowedOwnerItemName(itemName) {
  const text = String(itemName || "").toLowerCase();

  if (!text.trim()) return false;

  const blockedFragments = [
    "open food",
    "open bar",
    "misc",
    "discount",
    "gratuity",
    "service charge",
    "gift card",
    "employee meal",
    "comp",
    "miller lite",
  ];

  return !blockedFragments.some((fragment) => text.includes(fragment));
}

async function getAllRecords(tableName, options = {}) {
  const records = [];

  await base(tableName)
    .select(options)
    .eachPage((page, fetchNextPage) => {
      records.push(...page);
      fetchNextPage();
    });

  return records;
}

async function updateBatches(tableName, updates, batchSize = 10) {
  const out = [];

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    const result = await base(tableName).update(batch);
    out.push(...result);
  }

  return out;
}

async function createBatches(tableName, creates, batchSize = 10) {
  const out = [];

  for (let i = 0; i < creates.length; i += batchSize) {
    const batch = creates.slice(i, i + batchSize);
    const result = await base(tableName).create(batch);
    out.push(...result);
  }

  return out;
}

function addSale(bucket, sale, menuById) {
  const itemName = sale.itemName;
  const key = normalizeName(itemName);

  if (!key) return;

  const menu = sale.menuItemId ? menuById.get(sale.menuItemId) : null;

  // Tenant/quality safety:
  // Weekly owner-facing trends only use mapped, decision-eligible Menu Items.
  if (!menu || !menu.decisionEligible) return;

  const existing =
    bucket.get(key) ||
    {
      itemName: menu.itemName || itemName,
      menuItemId: sale.menuItemId,
      qty: 0,
      revenue: 0,
      profit: 0,
      runIds: new Set(),
    };

  const unitCost = menu.unitCost || 0;

  const computedProfit =
    unitCost > 0
      ? sale.revenue - sale.qty * unitCost
      : sale.profitFallback;

  existing.qty += sale.qty;
  existing.revenue += sale.revenue;
  existing.profit += computedProfit;
  existing.runIds.add(sale.runId);

  bucket.set(key, existing);
}

function classifyTrend({
  currentQty,
  priorQty,
  currentRevenue,
  priorRevenue,
  currentProfit,
  priorProfit,
  currentMargin,
  priorMargin,
}) {
  const qtyChange = currentQty - priorQty;
  const revenueChange = currentRevenue - priorRevenue;
  const profitChange = currentProfit - priorProfit;
  const marginChange = currentMargin - priorMargin;

  const qtyChangePct = pct(currentQty, priorQty);
  const revenueChangePct = pct(currentRevenue, priorRevenue);
  const profitChangePct = pct(currentProfit, priorProfit);

  const maxQty = Math.max(currentQty, priorQty);
  const maxRevenue = Math.max(currentRevenue, priorRevenue);
  const absRevenueChange = Math.abs(revenueChange);
  const absProfitChange = Math.abs(profitChange);
  const absQtyChange = Math.abs(qtyChange);
  const hasUsefulMovement =
  absProfitChange >= MATERIALITY.minProfitChange ||
  absRevenueChange >= MATERIALITY.minRevenueChange ||
  absQtyChange >= MATERIALITY.minQtyChange;

  let direction = "Stable";

  if (priorQty <= 0 && currentQty > 0) {
    direction = "New / Insufficient Baseline";
  } else if (
    profitChange <= -MATERIALITY.minProfitChange ||
    revenueChange <= -MATERIALITY.minRevenueChange ||
    qtyChange <= -MATERIALITY.minQtyChange
  ) {
    direction = "Declining";
  } else if (
    profitChange < 0 ||
    revenueChange < 0 ||
    qtyChange < 0 ||
    marginChange < -0.05
  ) {
    direction = "Softening";
  } else if (
    profitChange >= MATERIALITY.minProfitChange ||
    revenueChange >= MATERIALITY.minRevenueChange ||
    qtyChange >= MATERIALITY.minQtyChange
  ) {
    direction = "Improving";
  }

  let confidence = "Low";

  if (maxQty >= 20 || maxRevenue >= 1000) {
    confidence = "High";
  } else if (maxQty >= 10 || maxRevenue >= 500) {
    confidence = "Medium";
  } else if (maxQty < 5 && maxRevenue < 200) {
    confidence = "Insufficient Data";
  }

  let strength = "Watch";

  if (absProfitChange >= 400 || absRevenueChange >= 1000 || absQtyChange >= 20) {
    strength = "High";
  } else if (absProfitChange >= 200 || absRevenueChange >= 500 || absQtyChange >= 10) {
    strength = "Medium";
  } else if (
  absProfitChange >= MATERIALITY.ownerProfitChange ||
  absRevenueChange >= MATERIALITY.ownerRevenueChange ||
  absQtyChange >= MATERIALITY.ownerQtyChange
) {
  strength = "Low";
} else if (hasUsefulMovement) {
  strength = "Watch";
}

  const priority =
    Math.round(
      Math.min(100, absProfitChange / 4 + absRevenueChange / 25 + absQtyChange * 4)
    ) + (direction === "Declining" ? 20 : direction === "Softening" ? 8 : 0);

  const hasBaseline = maxQty >= MATERIALITY.minCurrentOrPriorQty;

const active =
  hasBaseline &&
  (hasUsefulMovement || priority >= MATERIALITY.minDisplayPriority) &&
  direction !== "Stable" &&
  direction !== "New / Insufficient Baseline";

  return {
    direction,
    strength,
    confidence,
    priority,
    active,
    qtyChange,
    revenueChange,
    profitChange,
    marginChange,
    qtyChangePct,
    revenueChangePct,
    profitChangePct,
  };
}

function formatCurrencyShort(value) {
  const n = money(value);
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";

  return `${sign}$${Math.abs(n).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

function formatPctShort(value) {
  const n = num(value);
  const sign = n > 0 ? "+" : "";
  return `${sign}${Math.round(n * 100)}%`;
}

function buildOwnerSummary(
  itemName,
  trend,
  currentQty,
  priorQty,
  currentRevenue,
  priorRevenue,
  currentProfit,
  priorProfit
) {
  if (trend.direction === "Declining") {
    return `${itemName} is down across the recent reporting window: ${currentQty} sold vs ${priorQty} prior, revenue ${formatCurrencyShort(
      trend.revenueChange
    )}, profit ${formatCurrencyShort(
      trend.profitChange
    )}. This is more meaningful than a one-run movement because it spans multiple dinner runs.`;
  }

  if (trend.direction === "Softening") {
    return `${itemName} is softening across recent dinner runs. Current window: ${currentQty} sold / ${formatCurrencyShort(
      currentRevenue
    )} revenue vs ${priorQty} sold / ${formatCurrencyShort(
      priorRevenue
    )} prior. Watch whether this continues before making a major change.`;
  }

  if (trend.direction === "Improving") {
    return `${itemName} is improving across recent dinner runs: ${currentQty} sold vs ${priorQty} prior, revenue ${formatCurrencyShort(
      trend.revenueChange
    )}, profit ${formatCurrencyShort(
      trend.profitChange
    )}. Keep visibility high if margin quality is acceptable.`;
  }

  return `${itemName} has movement, but not enough clean trend context to treat as a major owner risk yet.`;
}

function buildRecommendedAction(itemName, trend, currentMargin) {
  if (trend.direction === "Declining") {
    return `Review ${itemName} for visibility, server confidence, prep quality, and whether a competing item is pulling demand. If this is a core item, check the next service before changing prep too aggressively.`;
  }

  if (trend.direction === "Softening") {
    return `Keep ${itemName} on watch. Do not overreact from one slow run, but ask managers whether guest feedback, availability, or menu placement changed.`;
  }

  if (trend.direction === "Improving") {
    if (currentMargin >= 0.6) {
      return `Protect margin and keep ${itemName} visible. This may be an item worth leaning into while demand is improving.`;
    }

    return `Demand is improving, but margin should be checked before pushing ${itemName} harder.`;
  }

  return `No urgent action. Keep monitoring until there is stronger volume, revenue, or profit movement.`;
}

function resolveRequestedRestaurant(req, restaurants) {
  const requestedRestaurantId =
    req.query.restaurantId ||
    req.headers["x-restaurant-id"] ||
    "";

  const requestedRestaurantName = String(
    req.query.restaurantName ||
      req.headers["x-restaurant-name"] ||
      ""
  )
    .trim()
    .toLowerCase();

  if (requestedRestaurantId) {
    const match = restaurants.find((record) => record.id === requestedRestaurantId);

    if (match) {
      return match;
    }

    throw new Error(`No restaurant found for restaurantId=${requestedRestaurantId}`);
  }

  if (requestedRestaurantName) {
    const match = restaurants.find((record) =>
      String(record.fields["Restaurant Name"] || "")
        .toLowerCase()
        .includes(requestedRestaurantName)
    );

    if (match) {
      return match;
    }

    throw new Error(`No restaurant found for restaurantName=${requestedRestaurantName}`);
  }

  throw new Error(
    "Missing restaurant selector. Pass restaurantId=rec... or restaurantName=Chloe."
  );
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return send(res, 200, { ok: true });
  }

  if (!["GET", "POST"].includes(req.method)) {
    return send(res, 405, { ok: false, error: "Method not allowed" });
  }

  if (REQUIRED_SECRET) {
    const providedSecret = req.headers["x-admin-secret"] || req.query.secret || "";

    if (providedSecret !== REQUIRED_SECRET) {
      return send(res, 401, { ok: false, error: "Unauthorized" });
    }
  }

  try {
    const [restaurants, runs, menuItems, dailySales, existingTrends] =
      await Promise.all([
        getAllRecords(TABLES.restaurants, {
          fields: ["Restaurant Name"],
        }),
        getAllRecords(TABLES.runs, {
          fields: [
            "Run ID",
            "Created Time",
            "Restaurant",
            "Run Status",
            "Use For Decision Layer",
            "Is Latest Decision Run",
            "Completion Gate Reason",
            "Service Date",
            "Service Type",
          ],
        }),
        getAllRecords(TABLES.menuItems, {
          fields: [
            "Item Name",
            "Actual Unit Cost",
            "Estimated Unit Cost",
            "Effective Unit Cost",
            "Decision Eligible",
            "Restaurant",
          ],
        }),
        getAllRecords(TABLES.dailySales, {
          fields: [
            "Date",
            "Restaurant",
            "Item",
            "Qty",
            "Net Sales",
            "Profit",
            "Menu Item",
            "Run",
          ],
        }),
        getAllRecords(TABLES.weeklyTrends, {
          fields: ["Trend Name", "Restaurant", "Item Name", "Is Active"],
        }),
      ]);

    const restaurant = resolveRequestedRestaurant(req, restaurants);
    const restaurantId = restaurant.id;
    const restaurantName = restaurant.fields["Restaurant Name"] || restaurantId;

    const menuById = new Map();

    for (const record of menuItems) {
      const fields = record.fields || {};

      if (!hasLinkedId(fields["Restaurant"], restaurantId)) continue;
      if (fields["Decision Eligible"] !== true) continue;

      const actual = num(fields["Actual Unit Cost"]);
      const estimated = num(fields["Estimated Unit Cost"]);
      const effective = num(fields["Effective Unit Cost"]);

      const unitCost =
        actual > 0
          ? actual
          : estimated > 0
            ? estimated
            : effective > 0
              ? effective
              : 0;

      menuById.set(record.id, {
        id: record.id,
        itemName: fields["Item Name"] || "",
        unitCost,
        decisionEligible: true,
      });
    }

    let skippedNonDecisionRuns = 0;
    let skippedWrongRestaurantRuns = 0;
    let skippedNonCloseRuns = 0;
    const rejectedRunExamples = [];

    const reportingRuns = runs
      .map((record) => {
        const fields = record.fields || {};
        const runId = fields["Run ID"] || "";
        const runDate = fields["Service Date"] || parseRunDate(runId, fields["Created Time"]);
        const serviceType = getSelectName(fields["Service Type"]);
        const restaurantIds = getLinkedIds(fields["Restaurant"]);
        const completedReportingRun = isCompletedReportingRun(fields);
        const explicitlyUnsafeHistoricalRun = isExplicitlyUnsafeHistoricalRun(fields);

        return {
  id: record.id,
  runId,
  runDate,
  createdTime: fields["Created Time"] || "",
  restaurantIds,
  runStatus: getSelectName(fields["Run Status"]),
  useForDecisionLayer: fields["Use For Decision Layer"] === true,
  isLatestDecisionRun: fields["Is Latest Decision Run"] === true,
  completedReportingRun,
  explicitlyUnsafeHistoricalRun,
  serviceType,
  serviceKey: normalizeServiceType(serviceType),
};
      })
      .filter((run) => {
        if (!run.restaurantIds.includes(restaurantId)) {
        skippedWrongRestaurantRuns++;
        if (rejectedRunExamples.length < 20) {
        rejectedRunExamples.push({
        runId: run.runId,
        reason: "Wrong restaurant",
        runStatus: run.runStatus,
        serviceType: run.serviceType,
        serviceKey: run.serviceKey,
        useForDecisionLayer: run.useForDecisionLayer,
        isLatestDecisionRun: run.isLatestDecisionRun,
      });
    }
  return false;
}

        if (!isReportingRunId(run.runId)) {
  skippedNonCloseRuns++;
  if (rejectedRunExamples.length < 20) {
    rejectedRunExamples.push({
      runId: run.runId,
      reason: "Run ID is not POS close format",
      runStatus: run.runStatus,
      serviceType: run.serviceType,
      serviceKey: run.serviceKey,
      useForDecisionLayer: run.useForDecisionLayer,
      isLatestDecisionRun: run.isLatestDecisionRun,
    });
  }
  return false;
}

        if (!run.runDate) {
  skippedNonCloseRuns++;
  if (rejectedRunExamples.length < 20) {
    rejectedRunExamples.push({
      runId: run.runId,
      reason: "Missing run date",
      runStatus: run.runStatus,
      serviceType: run.serviceType,
      serviceKey: run.serviceKey,
      useForDecisionLayer: run.useForDecisionLayer,
      isLatestDecisionRun: run.isLatestDecisionRun,
    });
  }
  return false;
}

       if (!run.completedReportingRun || run.explicitlyUnsafeHistoricalRun) {
  skippedNonDecisionRuns++;
  if (rejectedRunExamples.length < 20) {
    rejectedRunExamples.push({
      runId: run.runId,
      reason: !run.completedReportingRun
  ? "Run Status is neither Completed nor blank legacy reporting status"
  : "Explicitly unsafe historical run",
      runStatus: run.runStatus,
      serviceType: run.serviceType,
      serviceKey: run.serviceKey,
      useForDecisionLayer: run.useForDecisionLayer,
      isLatestDecisionRun: run.isLatestDecisionRun,
    });
  }
  return false;
}

        // Weekly trend rows should compare the same operating service.
        // Current POS export convention is Close/Dinner, but this remains tenant-safe
        // because the decision gate is the primary guard and Service Type is metadata.
        if (run.serviceKey !== "unknown" && run.serviceKey !== "dinner") {
  skippedNonCloseRuns++;
  if (rejectedRunExamples.length < 20) {
    rejectedRunExamples.push({
      runId: run.runId,
      reason: "Service Type is not dinner/unknown",
      runStatus: run.runStatus,
      serviceType: run.serviceType,
      serviceKey: run.serviceKey,
      useForDecisionLayer: run.useForDecisionLayer,
      isLatestDecisionRun: run.isLatestDecisionRun,
    });
  }
  return false;
}

        return true;
      })
      .sort((a, b) => {
        if (a.runDate !== b.runDate) {
          return b.runDate.localeCompare(a.runDate);
        }

        return String(b.createdTime || "").localeCompare(String(a.createdTime || ""));
      });

    const selectedRuns = reportingRuns.slice(0, CURRENT_RUN_COUNT + PRIOR_RUN_COUNT);
    const currentRuns = selectedRuns.slice(0, CURRENT_RUN_COUNT);
    const priorRuns = selectedRuns.slice(
      CURRENT_RUN_COUNT,
      CURRENT_RUN_COUNT + PRIOR_RUN_COUNT
    );

if (currentRuns.length < 2 || priorRuns.length < 2) {
  const staleTrendUpdates = [];

  for (const record of existingTrends) {
    const fields = record.fields || {};
    const trendName = fields["Trend Name"] || "";
    const linkedToRestaurant = hasLinkedId(fields["Restaurant"], restaurantId);
    const hasNoRestaurantLink = getLinkedIds(fields["Restaurant"]).length === 0;

    const appearsToBelongToRestaurant =
      linkedToRestaurant ||
      hasNoRestaurantLink ||
      String(trendName).toLowerCase().includes(String(restaurantName).toLowerCase());

    if (!appearsToBelongToRestaurant) continue;

    if (fields["Is Active"]) {
      staleTrendUpdates.push({
        id: record.id,
        fields: {
          "Is Active": false,
          "Last Calculated At": new Date().toISOString(),
          Notes: `Deactivated by weekly trend refresh for ${restaurantName}. Not enough completed reporting close runs are available for a safe current/prior comparison.`,
        },
      });
    }
  }

  const deactivated = staleTrendUpdates.length
    ? await updateBatches(TABLES.weeklyTrends, staleTrendUpdates)
    : [];

  return send(res, 200, {
    ok: true,
    status: "skipped",
    reason: "Not enough reporting close runs for weekly trend comparison yet.",
    restaurant: restaurantName,
    restaurantId,
    completedReportingCloseRuns: reportingRuns.length,
    currentRuns: currentRuns.length,
    priorRuns: priorRuns.length,
    skippedNonDecisionRuns,
    skippedWrongRestaurantRuns,
    skippedNonCloseRuns,
    deactivatedStaleTrendRows: deactivated.length,
    rejectedRunExamples,
  });
}

    const currentRunIds = new Set(currentRuns.map((run) => run.id));
    const priorRunIds = new Set(priorRuns.map((run) => run.id));

    const currentBucket = new Map();
    const priorBucket = new Map();

    let skippedUnmappedOrIneligible = 0;
    let skippedWrongRestaurant = 0;

    for (const record of dailySales) {
      const fields = record.fields || {};

      if (!hasLinkedId(fields["Restaurant"], restaurantId)) {
        skippedWrongRestaurant++;
        continue;
      }

      const linkedRunIds = getLinkedIds(fields["Run"]);

      const runId = linkedRunIds.find((id) => currentRunIds.has(id) || priorRunIds.has(id));

      if (!runId) continue;

      const menuItemId = getLinkedId(fields["Menu Item"]);

      if (!menuItemId || !menuById.has(menuItemId)) {
        skippedUnmappedOrIneligible++;
        continue;
      }

     const menuItem = menuById.get(menuItemId);
const rawItemName = fields["Item"] || "";
const itemName = menuItem?.itemName || rawItemName;

if (!isAllowedOwnerItemName(itemName)) {
  skippedUnmappedOrIneligible++;
  continue;
}

const sale = {
  recordId: record.id,
  runId,
  itemName,
  rawItemName,
  qty: num(fields["Qty"]),
  revenue: num(fields["Net Sales"]),
  profitFallback: num(fields["Profit"]),
  menuItemId,
};

      if (!sale.itemName || (sale.qty === 0 && sale.revenue === 0)) continue;

      if (currentRunIds.has(runId)) {
        addSale(currentBucket, sale, menuById);
      } else if (priorRunIds.has(runId)) {
        addSale(priorBucket, sale, menuById);
      }
    }

    const allKeys = new Set([...currentBucket.keys(), ...priorBucket.keys()]);
    const trendRows = [];
    const rejectedTrendExamples = [];

    const currentWindowStart = currentRuns[currentRuns.length - 1].runDate;
    const currentWindowEnd = currentRuns[0].runDate;
    const priorWindowStart = priorRuns[priorRuns.length - 1].runDate;
    const priorWindowEnd = priorRuns[0].runDate;

    for (const key of allKeys) {
      const current = currentBucket.get(key) || {
        itemName: priorBucket.get(key)?.itemName || key,
        menuItemId: priorBucket.get(key)?.menuItemId || "",
        qty: 0,
        revenue: 0,
        profit: 0,
        runIds: new Set(),
      };

      const prior = priorBucket.get(key) || {
        itemName: current.itemName,
        menuItemId: current.menuItemId,
        qty: 0,
        revenue: 0,
        profit: 0,
        runIds: new Set(),
      };

      const currentQty = num(current.qty);
      const priorQty = num(prior.qty);
      const currentRevenue = money(current.revenue);
      const priorRevenue = money(prior.revenue);
      const currentProfit = money(current.profit);
      const priorProfit = money(prior.profit);
      const currentMargin = safeRatio(currentProfit, currentRevenue);
      const priorMargin = safeRatio(priorProfit, priorRevenue);

      const trend = classifyTrend({
        currentQty,
        priorQty,
        currentRevenue,
        priorRevenue,
        currentProfit,
        priorProfit,
        currentMargin,
        priorMargin,
      });

     if (!trend.active) {
  if (rejectedTrendExamples.length < 12) {
    rejectedTrendExamples.push({
      item: current.itemName || prior.itemName || key,
      direction: trend.direction,
      strength: trend.strength,
      confidence: trend.confidence,
      priority: trend.priority,
      qty: `${currentQty} vs ${priorQty}`,
      qtyChange: trend.qtyChange,
      revenueChange: money(trend.revenueChange),
      profitChange: money(trend.profitChange),
      currentRevenue,
      priorRevenue,
      currentProfit,
      priorProfit,
    });
  }

  continue;
}

      const itemName = current.itemName || prior.itemName;
      const trendName = `${restaurantName} — ${itemName} — ${trend.direction} — ${currentWindowEnd}`;

      trendRows.push({
        trendName,
        fields: {
          "Trend Name": trendName,
          Restaurant: [restaurantId],
          ...(current.menuItemId || prior.menuItemId
            ? { "Menu Item": [current.menuItemId || prior.menuItemId] }
            : {}),
          "Item Name": itemName,
          "Trend Window Start": currentWindowStart,
          "Trend Window End": currentWindowEnd,
          "Prior Window Start": priorWindowStart,
          "Prior Window End": priorWindowEnd,
          "Current Runs": currentRuns.length,
          "Prior Runs": priorRuns.length,
          "Current Qty": currentQty,
          "Prior Qty": priorQty,
          "Qty Change": trend.qtyChange,
          "Qty Change Percent": trend.qtyChangePct,
          "Current Revenue": currentRevenue,
          "Prior Revenue": priorRevenue,
          "Revenue Change": money(trend.revenueChange),
          "Revenue Change Percent": trend.revenueChangePct,
          "Current Profit": currentProfit,
          "Prior Profit": priorProfit,
          "Profit Change": money(trend.profitChange),
          "Profit Change Percent": trend.profitChangePct,
          "Current Margin": currentMargin,
          "Prior Margin": priorMargin,
          "Margin Change": trend.marginChange,
          "Trend Direction": trend.direction,
          "Trend Strength": trend.strength,
          Confidence: trend.confidence,
          "Owner Summary": buildOwnerSummary(
            itemName,
            trend,
            currentQty,
            priorQty,
            currentRevenue,
            priorRevenue,
            currentProfit,
            priorProfit
          ),
          "Recommended Action": buildRecommendedAction(
            itemName,
            trend,
            currentMargin
          ),
          "Is Active": true,
          "Display Priority": trend.priority,
          "Last Calculated At": new Date().toISOString(),
          "Source Run IDs": [
            "Current:",
            ...currentRuns.map((run) => run.runId),
            "",
            "Prior:",
            ...priorRuns.map((run) => run.runId),
          ].join("\n"),
          Notes: `Tenant-safe weekly trend for ${restaurantName}. Uses clean completed POS dinner/close reporting runs only. Current window ${currentWindowStart} to ${currentWindowEnd}; prior window ${priorWindowStart} to ${priorWindowEnd}. Qty ${currentQty} vs ${priorQty}; revenue ${money(
            trend.revenueChange
          )}; profit ${money(trend.profitChange)}; qty pct ${formatPctShort(
            trend.qtyChangePct
          )}. Decision Eligible required.`,
        },
      });
    }

    trendRows.sort((a, b) => b.fields["Display Priority"] - a.fields["Display Priority"]);

    const existingByName = new Map();

    for (const record of existingTrends) {
      const fields = record.fields || {};
      const trendName = fields["Trend Name"];

      if (!trendName) continue;
      if (!hasLinkedId(fields["Restaurant"], restaurantId)) continue;

      existingByName.set(trendName, record.id);
    }

    const activeNames = new Set(trendRows.map((row) => row.trendName));

    const updates = [];
    const creates = [];

    for (const row of trendRows) {
      const existingId = existingByName.get(row.trendName);

      if (existingId) {
        updates.push({
          id: existingId,
          fields: row.fields,
        });
      } else {
        creates.push({
          fields: row.fields,
        });
      }
    }

    for (const record of existingTrends) {
  const fields = record.fields || {};
  const trendName = fields["Trend Name"] || "";
  const linkedToRestaurant = hasLinkedId(fields["Restaurant"], restaurantId);
  const hasNoRestaurantLink = getLinkedIds(fields["Restaurant"]).length === 0;

  const appearsToBelongToRestaurant =
    linkedToRestaurant ||
    hasNoRestaurantLink ||
    String(trendName).toLowerCase().includes(String(restaurantName).toLowerCase());

  if (!appearsToBelongToRestaurant) continue;

  if (fields["Is Active"] && trendName && !activeNames.has(trendName)) {
    updates.push({
      id: record.id,
      fields: {
        "Is Active": false,
        "Last Calculated At": new Date().toISOString(),
        Notes: `Deactivated by tenant-safe weekly trend refresh for ${restaurantName}. Row was not part of the current active Decision Eligible trend set.`,
      },
    });
  }
}

    const updated = updates.length
      ? await updateBatches(TABLES.weeklyTrends, updates)
      : [];

    const created = creates.length
      ? await createBatches(TABLES.weeklyTrends, creates)
      : [];

    return send(res, 200, {
      ok: true,
      table: TABLES.weeklyTrends,
      restaurant: restaurantName,
      restaurantId,
      completedReportingCloseRuns: reportingRuns.length,
      currentRuns: currentRuns.map((run) => run.runId),
      priorRuns: priorRuns.map((run) => run.runId),
      currentRunGate: currentRuns.map((run) => ({
        runId: run.runId,
        runStatus: run.runStatus,
        useForDecisionLayer: run.useForDecisionLayer,
        isLatestDecisionRun: run.isLatestDecisionRun,
        serviceType: run.serviceType,
      })),
      priorRunGate: priorRuns.map((run) => ({
        runId: run.runId,
        runStatus: run.runStatus,
        useForDecisionLayer: run.useForDecisionLayer,
        isLatestDecisionRun: run.isLatestDecisionRun,
        serviceType: run.serviceType,
      })),
      skippedNonDecisionRuns,
      skippedWrongRestaurantRuns,
      skippedNonCloseRuns,
      decisionEligibleMenuItems: menuById.size,
      scannedDailySales: dailySales.length,
      skippedWrongRestaurant,
      skippedUnmappedOrIneligible,
      activeTrendRows: trendRows.length,
      created: created.length,
      updated: updated.length,
      rejectedTrendExamples,
      topExamples: trendRows.slice(0, 8).map((row) => ({
        item: row.fields["Item Name"],
        direction: row.fields["Trend Direction"],
        strength: row.fields["Trend Strength"],
        confidence: row.fields.Confidence,
        priority: row.fields["Display Priority"],
        qty: `${row.fields["Current Qty"]} vs ${row.fields["Prior Qty"]}`,
        revenueChange: row.fields["Revenue Change"],
        profitChange: row.fields["Profit Change"],
      })),
    });
  } catch (error) {
    console.error("refresh-weekly-item-trends error", error);

    return send(res, 500, {
      ok: false,
      error: error.message || "Failed to refresh weekly item trends",
    });
  }
};
