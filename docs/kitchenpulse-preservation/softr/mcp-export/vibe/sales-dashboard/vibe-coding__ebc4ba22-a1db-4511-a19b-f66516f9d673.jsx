import { useRecords, q } from "@/lib/datasource";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  CircleDollarSign,
  Eye,
  Info,
  ShieldAlert,
  TrendingDown,
} from "lucide-react";

const select = q.select({
  item: "Item",
  movementType: "Movement Type",
  movementCategory: "Movement Category (Static)",
  impactLevel: "Impact Level",
  notes: "Notes",
  priorityScore: "Priority Score",

  currentQty: "Current Qty",
  previousQty: "Previous Qty",
  currentRevenue: "Current Revenue",
  previousRevenue: "Previous Revenue",
  qtyChange: "Qty Change",
  revenueChange: "Revenue Change",

  effectiveUnitCost: "Effective Unit Cost",
  currentProfit: "Current Profit",
  previousProfit: "Previous Profit",
  profitChange: "Profit Change",
  currentMarginPercent: "Current Margin Percent",
  previousMarginPercent: "Previous Margin Percent",
  marginChangePercent: "Margin Change Percent",

  currentRunId: "Current Run ID",
  isLatestMovementText: "Is Latest Movement Text",
});

const MATERIALITY = {
  minPreviousQty: 3,
  minQtyDrop: 2,
  minRevenueDrop: 75,
  minProfitDrop: 50,
  minCurrentRevenueForNegativeProfit: 25,
  lowActivityCurrentQty: 10,
  lowActivityCurrentRevenue: 450,
  lowActivityZeroDropCount: 3,
};

const KP_TONES = {
  neutral: {
    color: "#475569",
    bg: "rgba(100,116,139,0.08)",
    border: "rgba(100,116,139,0.16)",
    glow: "rgba(100,116,139,0.08)",
    rail: "#94A3B8",
  },
  calm: {
    color: "#2563EB",
    bg: "rgba(59,130,246,0.09)",
    border: "rgba(59,130,246,0.20)",
    glow: "rgba(59,130,246,0.10)",
    rail: "#60A5FA",
  },
  info: {
    color: "#0891B2",
    bg: "rgba(34,211,238,0.09)",
    border: "rgba(34,211,238,0.20)",
    glow: "rgba(34,211,238,0.10)",
    rail: "#22D3EE",
  },
  watch: {
    color: "#D97706",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.28)",
    glow: "rgba(245,158,11,0.14)",
    rail: "#F59E0B",
  },
  pressure: {
    color: "#EA580C",
    bg: "rgba(249,115,22,0.13)",
    border: "rgba(249,115,22,0.32)",
    glow: "rgba(249,115,22,0.18)",
    rail: "#EA580C",
  },
  clear: {
    color: "#0F766E",
    bg: "rgba(20,184,166,0.08)",
    border: "rgba(20,184,166,0.18)",
    glow: "rgba(20,184,166,0.10)",
    rail: "#14B8A6",
  },
};

function fieldText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";

  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (!v) return "";
        if (typeof v === "string") return v;
        if (typeof v === "number") return String(v);
        if (typeof v === "object" && "label" in v) return String(v.label);
        if (typeof v === "object" && "name" in v) return String(v.name);
        if (typeof v === "object" && "foreignRowDisplayName" in v) {
          return String(v.foreignRowDisplayName);
        }
        return String(v);
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    if ("label" in value) return String(value.label);
    if ("name" in value) return String(value.name);
    if ("foreignRowDisplayName" in value) {
      return String(value.foreignRowDisplayName);
    }
  }

  return String(value);
}

function fieldNumber(value) {
  if (Array.isArray(value)) return Number(value[0] || 0);
  if (typeof value === "number" && !Number.isNaN(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,%]/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatCurrency(value) {
  const safe = Number.isFinite(value) ? value : 0;

  return safe.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatSignedNumber(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}`;
}

function formatSignedCurrency(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatCurrency(value)}`;
}

function avgSalePrice(revenue, qty) {
  if (!Number.isFinite(revenue) || !Number.isFinite(qty) || qty <= 0) return 0;
  return revenue / qty;
}

function normalizePercent(value) {
  const safe = Number.isFinite(value) ? value : 0;

  if (Math.abs(safe) > 1) return safe / 100;

  return safe;
}

function formatPercent(value) {
  const normalized = normalizePercent(value);
  return `${(normalized * 100).toFixed(1)}%`;
}

function formatSignedPercent(value) {
  const normalized = normalizePercent(value);
  const sign = normalized > 0 ? "+" : "";
  return `${sign}${(normalized * 100).toFixed(1)} pts`;
}

function signedTone(value) {
  if (value > 0) return KP_TONES.info;
  if (value < 0) return KP_TONES.pressure;
  return KP_TONES.neutral;
}

function softSignedTone(value) {
  if (value > 0) return KP_TONES.info;
  if (value < 0) return KP_TONES.watch;
  return KP_TONES.neutral;
}

function getMovementNumbers(item) {
  const currentQty = fieldNumber(item.fields.currentQty);
  const previousQty = fieldNumber(item.fields.previousQty);
  const currentRevenue = fieldNumber(item.fields.currentRevenue);
  const previousRevenue = fieldNumber(item.fields.previousRevenue);
  const qtyChange = fieldNumber(item.fields.qtyChange);
  const revenueChange = fieldNumber(item.fields.revenueChange);
  const currentProfit = fieldNumber(item.fields.currentProfit);
  const previousProfit = fieldNumber(item.fields.previousProfit);
  const profitChange = fieldNumber(item.fields.profitChange);
  const currentMarginPercent = normalizePercent(
    fieldNumber(item.fields.currentMarginPercent)
  );
  const previousMarginPercent = normalizePercent(
    fieldNumber(item.fields.previousMarginPercent)
  );
  const marginChangePercent = normalizePercent(
    fieldNumber(item.fields.marginChangePercent)
  );

  return {
    currentQty,
    previousQty,
    currentRevenue,
    previousRevenue,
    qtyChange,
    revenueChange,
    currentProfit,
    previousProfit,
    profitChange,
    currentMarginPercent,
    previousMarginPercent,
    marginChangePercent,
    qtyDrop: previousQty - currentQty,
    revenueDrop:
      revenueChange < 0
        ? Math.abs(revenueChange)
        : Math.max(0, previousRevenue - currentRevenue),
    profitDrop: profitChange < 0 ? Math.abs(profitChange) : 0,
    hasCurrentSales: currentQty > 0 && currentRevenue > 0,
    hasNoCurrentSales: currentQty <= 0 || currentRevenue <= 0,
  };
}

function getActivityContext(rawItems) {
  const totals = rawItems.reduce(
    (acc, item) => {
      const n = getMovementNumbers(item);

      acc.currentQty += n.currentQty;
      acc.previousQty += n.previousQty;
      acc.currentRevenue += n.currentRevenue;
      acc.previousRevenue += n.previousRevenue;

      if (n.hasNoCurrentSales && n.previousQty > 0) {
        acc.zeroSaleDrops += 1;
      }

      return acc;
    },
    {
      currentQty: 0,
      previousQty: 0,
      currentRevenue: 0,
      previousRevenue: 0,
      zeroSaleDrops: 0,
    }
  );

const hasMultipleZeroSaleDrops =
  totals.zeroSaleDrops >= MATERIALITY.lowActivityZeroDropCount;

const isSmallMovementSlice =
  totals.currentQty <= MATERIALITY.lowActivityCurrentQty &&
  totals.currentRevenue <= MATERIALITY.lowActivityCurrentRevenue;

const lowActivityMode =
  hasMultipleZeroSaleDrops &&
  isSmallMovementSlice;

  return {
    ...totals,
    lowActivityMode,
  };
}

function isTinyRunToRunNoise(item) {
  const n = getMovementNumbers(item);

  return (
    n.previousQty < MATERIALITY.minPreviousQty &&
    n.currentQty <= 1 &&
    n.revenueDrop < MATERIALITY.minRevenueDrop &&
    n.profitDrop < MATERIALITY.minProfitDrop
  );
}

function hasMaterialQtyDrop(item) {
  const n = getMovementNumbers(item);

  return (
    n.previousQty >= MATERIALITY.minPreviousQty &&
    n.qtyDrop >= MATERIALITY.minQtyDrop
  );
}

function hasMaterialRevenueDrop(item) {
  const n = getMovementNumbers(item);
  return n.revenueDrop >= MATERIALITY.minRevenueDrop;
}

function hasMaterialProfitDrop(item) {
  const n = getMovementNumbers(item);
  return n.profitDrop >= MATERIALITY.minProfitDrop;
}

function hasMeaningfulNegativeProfit(item) {
  const n = getMovementNumbers(item);

  return (
    n.currentProfit < 0 &&
    n.currentRevenue >= MATERIALITY.minCurrentRevenueForNegativeProfit
  );
}

function hasMaterialNegativeMovement(item) {
  return (
    hasMaterialQtyDrop(item) ||
    hasMaterialRevenueDrop(item) ||
    hasMaterialProfitDrop(item) ||
    hasMeaningfulNegativeProfit(item)
  );
}

function shouldShowMovementAlert(item, activityContext) {
  const movementType = fieldText(item.fields.movementType).toLowerCase();
  const n = getMovementNumbers(item);

  if (isTinyRunToRunNoise(item)) return false;

  if (activityContext.lowActivityMode) {
    if (n.hasNoCurrentSales) {
      return (
        n.previousQty >= MATERIALITY.minPreviousQty &&
        (n.revenueDrop >= MATERIALITY.minRevenueDrop ||
          n.profitDrop >= MATERIALITY.minProfitDrop)
      );
    }

    if (hasMeaningfulNegativeProfit(item)) return true;
    if (hasMaterialProfitDrop(item)) return true;
    if (hasMaterialRevenueDrop(item) && n.previousQty >= MATERIALITY.minPreviousQty) {
      return true;
    }

    return false;
  }

  if (movementType.includes("new low")) {
    return hasMaterialNegativeMovement(item);
  }

  if (
  movementType.includes("dropped from top") ||
  movementType.includes("dropped to low") ||
  movementType.includes("declining")
) {
  return hasMaterialNegativeMovement(item);
}

if (
  movementType.includes("rising") ||
  movementType.includes("new top")
) {
  return (
    n.currentQty > 0 &&
    n.currentRevenue >= 25 &&
    (n.revenueChange > 50 || n.profitChange > 25 || n.qtyChange > 0)
  );
}

return false;
}

function getSignalMode(item, activityContext) {
  const n = getMovementNumbers(item);

  if (activityContext.lowActivityMode && n.hasNoCurrentSales) {
    return "low-activity-no-sale";
  }

  if (n.hasNoCurrentSales) {
    return "no-sale";
  }

  if (hasMeaningfulNegativeProfit(item)) {
    return "actual-margin-risk";
  }

  if (activityContext.lowActivityMode) {
    return "low-activity-watch";
  }

  return "normal";
}

function getMovementStyle(item, activityContext) {
  const movementType = fieldText(item.fields.movementType).toLowerCase();
  const impactLevel = fieldText(item.fields.impactLevel).toLowerCase();
  const n = getMovementNumbers(item);
  const signalMode = getSignalMode(item, activityContext);

  if (signalMode === "low-activity-no-sale" || signalMode === "no-sale") {
    return {
      label: "Demand watch",
      tone: KP_TONES.watch,
      headline: "No sales this run, not a margin failure.",
      action:
        "Treat this as directional demand movement. Recheck after the next normal dinner service before changing pricing, prep, or menu placement.",
      Icon: Eye,
    };
  }

  if (signalMode === "actual-margin-risk") {
    return {
      label: "Margin check",
      tone: KP_TONES.pressure,
      headline: "This item sold, but margin needs a real check.",
      action:
        "Review the unit cost, sale price, comps, and any discounting before treating this as a menu issue.",
      Icon: ShieldAlert,
    };
  }

  if (movementType.includes("dropped from top")) {
    return {
      label: "Momentum watch",
      tone: n.profitChange < 0 ? KP_TONES.watch : KP_TONES.neutral,
      headline: "Former top performer slowed versus the prior run.",
      action:
        "Check visibility, server confidence, and whether the run was simply light before treating this as demand weakness.",
      Icon: ArrowDownRight,
    };
  }

  if (movementType.includes("dropped to low")) {
    return {
      label: "Low-seller watch",
      tone: KP_TONES.pressure,
      headline: "Moved into low-seller territory.",
      action:
        "Review whether service volume, placement, prep, or guest mix explains the drop before making a menu call.",
      Icon: TrendingDown,
    };
  }

  if (movementType.includes("new low")) {
    return {
      label: "New low watch",
      tone: KP_TONES.pressure,
      headline: "New low-seller signal appeared.",
      action:
        "Use this as a manager check, not an emergency. Watch whether the pattern repeats across a stronger service.",
      Icon: AlertTriangle,
    };
  }

if (movementType.includes("declining")) {
  return {
    label: impactLevel.includes("high") ? "High watch" : "Softening",
    tone: n.profitChange < 0 ? KP_TONES.watch : KP_TONES.pressure,
    headline: "Momentum softened versus the prior run.",
    action:
      "Watch whether this repeats. If the item is normally reliable, check service flow and guest mix before reacting.",
    Icon: TrendingDown,
  };
}

if (movementType.includes("new top")) {
  return {
    label: "Breakout item",
    tone: KP_TONES.info,
    headline: "New top-seller signal appeared.",
    action:
      "Protect prep and visibility while momentum is strong. This is an opportunity signal, not a problem.",
    Icon: Activity,
  };
}

if (movementType.includes("rising")) {
  return {
    label: "Demand lift",
    tone: KP_TONES.info,
    headline: "Item gained traction versus the prior comparable run.",
    action:
      "Watch stock, prep, and server visibility. If this repeats, consider featuring it more intentionally.",
    Icon: Activity,
  };
}

return {
  label: "Movement signal",
  tone: KP_TONES.neutral,
  headline: "Movement changed versus the prior run.",
  action: "Review the item context before making an operational change.",
  Icon: CircleDollarSign,
};
}

function getOwnerSummary(items, activityContext) {
  if (items.length === 0) {
    if (activityContext.lowActivityMode) {
      return "Latest movement looks light and directional. KitchenPulse is not flagging a major owner-level issue from this run.";
    }

    return "No major margin or movement risks are currently flagged from the latest dinner run.";
  }

  const totalProfitChange = items.reduce(
    (sum, item) => sum + fieldNumber(item.fields.profitChange),
    0
  );

  const noSaleItems = items.filter((item) => getMovementNumbers(item).hasNoCurrentSales)
    .length;

  const actualMarginRiskItems = items.filter((item) =>
    hasMeaningfulNegativeProfit(item)
  ).length;

  const demandWatchItems = items.length - actualMarginRiskItems;

  if (activityContext.lowActivityMode) {
    return `Low-activity run detected. ${items.length} item${items.length === 1 ? "" : "s"
      } are shown as directional watch signals, not margin failures. Recheck these after the next normal dinner service.`;
  }

  if (actualMarginRiskItems > 0) {
    return `${actualMarginRiskItems} item${actualMarginRiskItems === 1 ? "" : "s"
      } sold with margin worth checking. Start with actual margin issues before chasing demand movement.`;
  }

  if (noSaleItems > 0) {
    return `${noSaleItems} former mover${noSaleItems === 1 ? "" : "s"
      } had no current sales. Treat this as demand watch unless it repeats on a stronger service.`;
  }

  if (totalProfitChange < 0) {
    return `${items.length} item${items.length === 1 ? "" : "s"
      } moved backward versus the prior run by ${formatCurrency(
        Math.abs(totalProfitChange)
      )}. This is a prior-run gap, not necessarily lost money.`;
  }

 if (demandWatchItems > 0) {
  const positiveSignals = items.filter((item) => {
    const movementType = fieldText(item.fields.movementType).toLowerCase();
    return movementType.includes("rising") || movementType.includes("new top");
  }).length;

  if (positiveSignals > 0) {
    return `${positiveSignals} opportunity signal${positiveSignals === 1 ? "" : "s"
      } surfaced from the latest dinner run. Protect prep, stock, and visibility before chasing problems.`;
  }

  return `${demandWatchItems} demand watch signal${demandWatchItems === 1 ? "" : "s"
    } surfaced. Review visibility and service context before making menu changes.`;
}

  return "Movement risk is present, but not extreme. Use this as an owner-level scan before digging into What Changed.";
}

function getTotalPriorGap(items) {
  return items.reduce((sum, item) => {
    const n = getMovementNumbers(item);
    return sum + Math.min(0, n.profitChange);
  }, 0);
}

function SignalBadge({ children, tone, icon }) {
  const Icon = icon;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{
        color: tone.color,
        background: tone.bg,
        borderColor: tone.border,
      }}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}

function MetricBox({ label, value, detail, tone = "neutral" }) {
  const toneMap = {
    neutral: KP_TONES.neutral,
    good: KP_TONES.info,
    warn: KP_TONES.watch,
    bad: KP_TONES.pressure,
  };

  const meta = toneMap[tone] || toneMap.neutral;

  return (
    <div
      className="relative overflow-hidden rounded-xl border px-3 py-2 shadow-sm"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.74))",
        borderColor: meta.border,
        boxShadow:
          "0 8px 18px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.78)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-16 w-16 rounded-full blur-2xl"
        style={{ background: meta.glow }}
      />

      <div className="relative z-10 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>

      <div className="relative z-10 mt-1 text-lg font-bold" style={{ color: meta.color }}>
        {value}
      </div>

      <div className="relative z-10 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function SummaryTile({ label, value, helper, tone, icon }) {
  const Icon = icon;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 shadow-sm"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.74))",
        borderColor: tone.border,
        boxShadow:
          "0 10px 24px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.78)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl"
        style={{ background: tone.glow }}
      />

      <div className="relative z-10 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-3xl font-bold" style={{ color: tone.color }}>
            {value}
          </div>
        </div>

        {Icon ? (
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border"
            style={{
              color: tone.color,
              background: tone.bg,
              borderColor: tone.border,
            }}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>

      <div className="relative z-10 mt-1 text-xs leading-relaxed text-muted-foreground">
        {helper}
      </div>
    </div>
  );
}

function RiskCard({ item, index, activityContext }) {
  const itemName = fieldText(item.fields.item) || "Unnamed item";
  const movementType = fieldText(item.fields.movementType);
  const impactLevel = fieldText(item.fields.impactLevel);
  const notes = fieldText(item.fields.notes);

  const n = getMovementNumbers(item);

  const currentAvgSale = avgSalePrice(n.currentRevenue, n.currentQty);
  const previousAvgSale = avgSalePrice(n.previousRevenue, n.previousQty);
  const avgSaleChange = currentAvgSale - previousAvgSale;

  const effectiveUnitCost = fieldNumber(item.fields.effectiveUnitCost);
  const hasUsableCost = effectiveUnitCost > 0;
  const hasCurrentSales = n.hasCurrentSales;
  const noCurrentSales = n.hasNoCurrentSales;

  const style = getMovementStyle(item, activityContext);
  const Icon = style.Icon;
  const tone = style.tone;
  const topPriority = index === 0;

  const profitChipLabel = noCurrentSales ? "Prior-run gap" : "Profit vs prior run";
  const profitChipTone = activityContext.lowActivityMode
    ? softSignedTone(n.profitChange)
    : signedTone(n.profitChange);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-5 shadow-sm"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.97), rgba(248,250,252,0.76))",
        borderColor: tone.border,
        boxShadow:
          topPriority
            ? "0 14px 32px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.78)"
            : "0 10px 24px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.78)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1"
        style={{ background: tone.rail }}
      />

      <div
        className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full blur-3xl"
        style={{ background: tone.glow }}
      />

      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border"
              style={{
                color: tone.color,
                background: tone.bg,
                borderColor: tone.border,
              }}
            >
              <Icon className="h-4 w-4" />
            </span>

            <h3 className="text-lg font-semibold leading-tight text-foreground">
              {itemName}
            </h3>

            <SignalBadge tone={tone}>{style.label}</SignalBadge>

            {movementType ? (
              <Badge variant="outline" className="border bg-background/80 text-muted-foreground">
                {movementType}
              </Badge>
            ) : null}

            {impactLevel && !noCurrentSales ? (
              <Badge variant="secondary">{impactLevel} impact</Badge>
            ) : null}

            {topPriority ? (
              <SignalBadge tone={KP_TONES.neutral}>Owner check first</SignalBadge>
            ) : null}

            {!hasUsableCost ? (
              <SignalBadge tone={KP_TONES.watch}>Cost needs review</SignalBadge>
            ) : null}

            {activityContext.lowActivityMode ? (
              <SignalBadge tone={KP_TONES.calm}>Low-activity context</SignalBadge>
            ) : null}
          </div>

          <div className="text-base font-semibold text-foreground">
            {style.headline}
          </div>

          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {style.action}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <SignalBadge tone={profitChipTone}>
              {profitChipLabel}: {formatSignedCurrency(n.profitChange)}
            </SignalBadge>

            <SignalBadge tone={KP_TONES.neutral}>
              {hasUsableCost
                ? `Unit cost estimate: ${formatCurrency(effectiveUnitCost)}`
                : "Unit cost: needs review"}
            </SignalBadge>

            {hasCurrentSales ? (
              <SignalBadge tone={signedTone(n.marginChangePercent)}>
                Margin vs prior: {formatSignedPercent(n.marginChangePercent)}
              </SignalBadge>
            ) : (
              <SignalBadge tone={KP_TONES.neutral}>
                Margin: not measured, no current sales
              </SignalBadge>
            )}

            {hasCurrentSales ? (
              <SignalBadge tone={signedTone(avgSaleChange)}>
                Avg sale: {formatCurrency(currentAvgSale)} vs{" "}
                {formatCurrency(previousAvgSale)}
              </SignalBadge>
            ) : (
              <SignalBadge tone={KP_TONES.neutral}>
                Avg sale: no current sale
              </SignalBadge>
            )}
          </div>

          {notes ? (
            <p
              className="mt-3 max-w-3xl rounded-xl border px-3 py-2 text-sm leading-relaxed text-muted-foreground"
              style={{
                background: "rgba(248,250,252,0.74)",
                borderColor: "rgba(15,23,42,0.08)",
              }}
            >
              {notes}
            </p>
          ) : null}
        </div>

        <div className="grid min-w-[260px] grid-cols-2 gap-2">
          {hasCurrentSales ? (
            <MetricBox
              label="Gross profit"
              value={formatCurrency(n.currentProfit)}
              detail={`${formatSignedCurrency(n.profitChange)} vs ${formatCurrency(
                n.previousProfit
              )}`}
              tone={n.currentProfit < 0 ? "bad" : "neutral"}
            />
          ) : (
            <MetricBox
              label="Current sales"
              value="No sales"
              detail={`Prior profit ${formatCurrency(n.previousProfit)}`}
              tone="warn"
            />
          )}

          {hasCurrentSales ? (
            <MetricBox
              label="Margin"
              value={formatPercent(n.currentMarginPercent)}
              detail={`${formatSignedPercent(n.marginChangePercent)} vs ${formatPercent(
                n.previousMarginPercent
              )}`}
              tone={n.marginChangePercent < 0 ? "warn" : "good"}
            />
          ) : (
            <MetricBox
              label="Margin"
              value="Not measured"
              detail="No current sale"
              tone="neutral"
            />
          )}

          <MetricBox
            label="Qty"
            value={String(n.currentQty)}
            detail={`${formatSignedNumber(n.qtyChange)} vs ${n.previousQty}`}
            tone={n.qtyChange < 0 ? "warn" : "neutral"}
          />

          <MetricBox
            label="Revenue"
            value={formatCurrency(n.currentRevenue)}
            detail={`${formatSignedCurrency(n.revenueChange)} vs ${formatCurrency(
              n.previousRevenue
            )}`}
            tone={n.revenueChange < 0 ? "warn" : "neutral"}
          />
        </div>
      </div>
    </div>
  );
}

export default function Block() {
  const { data, status } = useRecords({
    select,
    where: q.and(
      q.text("isLatestMovementText").is("true"),
      q.or(
  q.text("movementType").is("Declining"),
  q.text("movementType").is("Dropped from Top"),
  q.text("movementType").is("New Low"),
  q.text("movementType").is("Dropped to Low"),
  q.text("movementType").is("Rising"),
  q.text("movementType").is("New Top")
)
    ),
    orderBy: [q.desc("priorityScore"), q.desc("currentQty")],
    count: 25,
  });

  const rawItems = data?.pages.flatMap((page) => page.items) || [];
  const activityContext = getActivityContext(rawItems);

  const items = rawItems
    .filter((item) => shouldShowMovementAlert(item, activityContext))
    .slice(0, 5);

  const ownerSummary = getOwnerSummary(items, activityContext);

 const totalPriorGap = getTotalPriorGap(items);
const actualMarginRiskItems = items.filter((item) =>
  hasMeaningfulNegativeProfit(item)
).length;
const demandWatchItems = items.length - actualMarginRiskItems;

const opportunityItems = items.filter((item) => {
  const movementType = fieldText(item.fields.movementType).toLowerCase();
  return movementType.includes("rising") || movementType.includes("new top");
}).length;

const watchSummaryHelper =
  opportunityItems > 0
    ? `${opportunityItems} opportunity signal${opportunityItems === 1 ? "" : "s"}, ${actualMarginRiskItems} margin check.`
    : `${demandWatchItems} demand watch, ${actualMarginRiskItems} margin check.`;

return (
    <div className="container py-8">
      <div className="content max-w-5xl mx-auto">
        <section
          className="relative overflow-hidden rounded-3xl border p-5 shadow-sm"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(248,250,252,0.94) 58%, rgba(241,245,249,0.86) 100%)",
            borderColor: "rgba(15,23,42,0.08)",
            boxShadow:
              "0 14px 34px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.82)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full blur-3xl"
            style={{ background: "rgba(148,163,184,0.08)" }}
          />

          <div className="relative z-10">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: activityContext.lowActivityMode
                        ? KP_TONES.calm.rail
                        : KP_TONES.watch.rail,
                      boxShadow: activityContext.lowActivityMode
                        ? "0 0 10px rgba(96,165,250,0.45)"
                        : "0 0 10px rgba(245,158,11,0.45)",
                    }}
                  />
                  Owner movement scan
                </div>

                <h2 className="text-2xl font-heading font-semibold tracking-tight">
                  Margin & Movement Watch
                </h2>

                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  A practical scan of items that may need attention. Slow-service zeroes are treated as demand watch signals, not margin failures.
                </p>
              </div>

              <div
                className="rounded-full border px-3 py-2 text-xs font-semibold text-muted-foreground"
                style={{
                  background: "rgba(255,255,255,0.72)",
                  borderColor: "rgba(15,23,42,0.08)",
                }}
              >
                Latest dinner movement
              </div>
            </div>

            {activityContext.lowActivityMode ? (
              <div
                className="mb-5 rounded-2xl border px-4 py-3 text-sm leading-relaxed"
                style={{
                  color: "#1D4ED8",
                  background:
                    "linear-gradient(145deg, rgba(239,246,255,0.78), rgba(255,255,255,0.88))",
                  borderColor: "rgba(59,130,246,0.20)",
                }}
              >
                <div className="flex gap-3">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <span className="font-semibold">Low-activity context:</span>{" "}
                    this run looks light, so KitchenPulse is softening zero-sale signals. Treat them as items to watch after the next normal dinner service, not as immediate menu or margin problems.
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mb-5 grid gap-3 md:grid-cols-[1.3fr_0.7fr]">
              <div
                className="rounded-2xl border p-4 text-sm leading-relaxed text-muted-foreground shadow-sm"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(248,250,252,0.72))",
                  borderColor: "rgba(15,23,42,0.08)",
                  boxShadow:
                    "0 10px 24px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.78)",
                }}
              >
                <span className="font-semibold text-foreground">Owner read:</span>{" "}
                {ownerSummary}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryTile
                  label="Signals shown"
                  value={String(items.length)}
                  helper={watchSummaryHelper}
                  tone={items.length > 0 ? KP_TONES.watch : KP_TONES.neutral}
                  icon={Eye}
                />

                <SummaryTile
                  label="Prior-run gap"
                  value={formatSignedCurrency(totalPriorGap)}
                  helper="Comparison gap, not actual money lost."
                  tone={activityContext.lowActivityMode ? softSignedTone(totalPriorGap) : signedTone(totalPriorGap)}
                  icon={ArrowDownRight}
                />
              </div>
            </div>

            {status === "pending" && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-2xl border bg-background/80 p-5 shadow-sm"
                  >
                    <div className="mb-3 h-5 w-48 animate-pulse rounded bg-muted" />
                    <div className="mb-2 h-4 w-full animate-pulse rounded bg-muted" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            )}

            {status === "error" && (
              <div
                className="rounded-2xl border px-5 py-4 text-sm"
                style={{
                  color: "#EA580C",
                  background: "rgba(249,115,22,0.10)",
                  borderColor: "rgba(249,115,22,0.28)",
                }}
              >
                Error loading movement watch items.
              </div>
            )}

            {status === "success" && items.length === 0 && (
              <div
                className="rounded-2xl border px-5 py-8 text-center shadow-sm"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(248,250,252,0.72))",
                  borderColor: "rgba(15,23,42,0.08)",
                  boxShadow:
                    "0 10px 24px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.78)",
                }}
              >
                <div
                  className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border"
                  style={{
                    color: KP_TONES.clear.color,
                    background: KP_TONES.clear.bg,
                    borderColor: KP_TONES.clear.border,
                  }}
                >
                  <Activity className="h-5 w-5" />
                </div>

                <div className="text-base font-semibold text-foreground">
                  No major owner-level movement issues flagged.
                </div>

                <div className="mt-1 text-sm text-muted-foreground">
                  Latest dinner movement does not currently show a high-priority margin or demand watch item.
                </div>
              </div>
            )}

            {status === "success" && items.length > 0 && (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <RiskCard
                    key={item.id}
                    item={item}
                    index={index}
                    activityContext={activityContext}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
