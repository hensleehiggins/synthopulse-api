import { useMemo } from "react";
import { useRecords, q } from "@/lib/datasource";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleDollarSign,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const MATERIAL_COST_INCREASE = 0.08;
const select = q.select({
  movementName: "Movement Name",
  vendor: "Vendor",
  costItemName: "Cost Item Name",
  vendorLineName: "Vendor Line Name",
  previousCost: "Previous Cost",
  latestCost: "Latest Cost",
  costChangeAmount: "Cost Change $",
  costChangePercent: "Cost Change %",
  direction: "Direction",
  severity: "Severity",
  reviewStatus: "Review Status",
  signalDate: "Signal Date",
  isLatest: "Is Latest",
  showOnWhatChanged: "Show on What Changed",
  showOnHome: "Show on Home",
  decisionEligible: "Decision Eligible",
  marginPressure: "Margin Pressure",
  suggestedAction: "Suggested Action",
  formattedCostBrief: "Formatted Cost Brief",
  relatedMenuItems: "Related Menu Items",
});

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
        if (typeof v === "object" && "name" in v) return String(v.name);
        if (typeof v === "object" && "label" in v) return String(v.label);
        if (typeof v === "object" && "foreignRowDisplayName" in v) {
          return String(v.foreignRowDisplayName);
        }
        return String(v);
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    if ("name" in value) return String(value.name);
    if ("label" in value) return String(value.label);
    if ("foreignRowDisplayName" in value) return String(value.foreignRowDisplayName);
  }

  return String(value);
}

function fieldNumber(value) {
  const raw = Array.isArray(value) ? value[0] : value;

  if (typeof raw === "number") return raw;

  const cleaned = String(raw || "")
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .trim();

  const num = Number(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

function money(value) {
  const num = fieldNumber(value);

  if (!num && num !== 0) return "—";

  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function normalizePercentValue(value) {
  const num = fieldNumber(value);

  if (!num && num !== 0) return null;

  if (Math.abs(num) > 1) {
    return num / 100;
  }

  return num;
}

function percent(value) {
  const num = normalizePercentValue(value);

  if (num === null) return "—";

  return num.toLocaleString("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function getDirection(item) {
  return fieldText(item?.fields?.direction);
}

function getChangePercent(item) {
  const fields = item?.fields || {};

  const previousCost = fieldNumber(fields.previousCost);
  const latestCost = fieldNumber(fields.latestCost);

  if (previousCost > 0 && latestCost > 0) {
    return (latestCost - previousCost) / previousCost;
  }

  return normalizePercentValue(fields.costChangePercent) || 0;
}

function getSignalName(item) {
  const fields = item.fields || {};

  return (
    fieldText(fields.costItemName) ||
    fieldText(fields.vendorLineName) ||
    fieldText(fields.movementName) ||
    "Tracked cost item"
  );
}

function getSeverity(item) {
  return fieldText(item?.fields?.severity) || "Watch";
}

function getTone(item) {
  const direction = getDirection(item);
  const changePercent = getChangePercent(item);

if (direction === "Increase" || changePercent > 0) {
  const severity = getSeverity(item).toLowerCase();
  const isMaterialIncrease =
    changePercent >= MATERIAL_COST_INCREASE || severity.includes("high");

  if (isMaterialIncrease) {
    return {
      label: "Cost pressure",
      icon: TrendingUp,
      color: "#EA580C",
      bg: "rgba(249,115,22,0.14)",
      border: "rgba(249,115,22,0.36)",
      glow: "rgba(249,115,22,0.22)",
      text: "#EA580C",
    };
  }

  return {
    label: "Cost up",
    icon: TrendingUp,
    color: "#D97706",
    bg: "rgba(245,158,11,0.13)",
    border: "rgba(245,158,11,0.32)",
    glow: "rgba(245,158,11,0.20)",
    text: "#D97706",
  };
}

  if (direction === "Decrease" || changePercent < 0) {
    return {
      label: "Cost decreased",
      icon: TrendingDown,
      color: "#0891B2",
      bg: "rgba(34,211,238,0.10)",
      border: "rgba(34,211,238,0.22)",
      glow: "rgba(34,211,238,0.14)",
      text: "#0891B2",
    };
  }

  return {
    label: "Cost tracked",
    icon: CheckCircle2,
    color: "#0F766E",
    bg: "rgba(20,184,166,0.09)",
    border: "rgba(20,184,166,0.20)",
    glow: "rgba(20,184,166,0.12)",
    text: "#0F766E",
  };
}

function getOperatorLine(item) {
  const fields = item.fields || {};
  const formattedBrief = fieldText(fields.formattedCostBrief);
  const marginPressure = fieldText(fields.marginPressure);
  const suggestedAction = fieldText(fields.suggestedAction);

  if (formattedBrief) return formattedBrief;

  if (marginPressure && suggestedAction) {
    return `${marginPressure} ${suggestedAction}`;
  }

  if (marginPressure) return marginPressure;

  const itemName = getSignalName(item);
  const vendor = fieldText(fields.vendor) || "the latest vendor receipt";
  const changePercent = getChangePercent(item);

  if (changePercent >= 0.08) {
    return `${itemName} is moving up in cost from ${vendor}. Review margin, portioning, vendor price, or menu price before pushing affected items harder.`;
  }

  if (changePercent > 0) {
    return `${itemName} is showing cost pressure from ${vendor}. Watch this if the ingredient supports a high-volume menu item.`;
  }

  if (changePercent < 0) {
    return `${itemName} moved down in cost from ${vendor}. This may create margin room or support a feature if demand is there.`;
  }

  return `${itemName} was tracked from approved receipt data. No major movement is showing from this signal yet.`;
}

function SummaryPill({ label, value, tone = "neutral", icon }) {
  const styles =
  tone === "pressureHigh"
  ? {
      color: "#EA580C",
      bg: "rgba(249,115,22,0.14)",
      border: "rgba(249,115,22,0.36)",
      glow: "rgba(249,115,22,0.22)",
    }
  : tone === "pressure"
    ? {
        color: "#D97706",
        bg: "rgba(245,158,11,0.13)",
        border: "rgba(245,158,11,0.32)",
        glow: "rgba(245,158,11,0.20)",
      }
      : tone === "relief"
        ? {
            color: "#0891B2",
            bg: "rgba(34,211,238,0.10)",
            border: "rgba(34,211,238,0.22)",
            glow: "rgba(34,211,238,0.14)",
          }
        : tone === "watch"
          ? {
              color: "#0F766E",
              bg: "rgba(20,184,166,0.09)",
              border: "rgba(20,184,166,0.20)",
              glow: "rgba(20,184,166,0.12)",
            }
          : {
              color: "#475569",
              bg: "rgba(100,116,139,0.09)",
              border: "rgba(100,116,139,0.18)",
              glow: "rgba(100,116,139,0.10)",
            };

  const Icon = icon || CircleDollarSign;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border px-4 py-3 shadow-sm"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.74))",
        borderColor: styles.border,
        boxShadow:
          "0 9px 22px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.78)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl"
        style={{ background: styles.glow }}
      />

      <div className="relative z-10 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            {value}
          </div>
        </div>

        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border"
          style={{
            color: styles.color,
            background: styles.bg,
            borderColor: styles.border,
          }}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function CostSignalCard({ item }) {
  const fields = item.fields || {};
  const tone = getTone(item);
  const Icon = tone.icon;
  const itemName = getSignalName(item);
  const vendor = fieldText(fields.vendor) || "Vendor not entered";
  const severity = getSeverity(item);
  const relatedMenuItems = fieldText(fields.relatedMenuItems);
  const recalculatedChangePercent = getChangePercent(item);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:shadow-md"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.97), rgba(248,250,252,0.76))",
        borderColor: tone.border,
        boxShadow:
          "0 10px 24px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.78)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1"
        style={{ background: tone.color }}
      />

      <div
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
        style={{ background: tone.glow }}
      />

      <div className="relative z-10 mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold leading-tight text-foreground">
            {itemName}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{vendor}</div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
            style={{
              color: tone.color,
              background: tone.bg,
              borderColor: tone.border,
            }}
          >
            <Icon className="h-3.5 w-3.5" />
            {tone.label}
          </span>

          <span className="rounded-full border bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {severity}
          </span>
        </div>
      </div>

      <p className="relative z-10 mb-4 text-sm leading-relaxed text-muted-foreground">
        {getOperatorLine(item)}
      </p>

      {relatedMenuItems && (
        <div className="relative z-10 mb-4 rounded-xl border bg-white/70 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Menu impact:</span>{" "}
          {relatedMenuItems}
        </div>
      )}

      <div className="relative z-10 grid grid-cols-3 gap-3 border-t border-slate-200/70 pt-3 text-sm">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Prior
          </div>
          <div className="mt-1 font-semibold text-foreground">
            {money(fields.previousCost)}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Latest
          </div>
          <div className="mt-1 font-semibold text-foreground">
            {money(fields.latestCost)}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Change
          </div>
          <div className="mt-1 font-semibold" style={{ color: tone.text }}>
            {percent(recalculatedChangePercent)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Block() {
  const { data, status, error } = useRecords({
    select,
    where: q.and(
      q.boolean("isLatest").is(true),
      q.boolean("showOnWhatChanged").is(true),
      q.text("reviewStatus").is("seltSxG4Wz7mqLBVw")
    ),
    orderBy: [q.desc("severity"), q.desc("costChangePercent")],
    count: 5,
  });

  const signals = data?.pages.flatMap((page) => page.items) || [];

  const sortedSignals = useMemo(() => {
    return [...signals].sort((a, b) => {
      const aAbs = Math.abs(getChangePercent(a));
      const bAbs = Math.abs(getChangePercent(b));

      if (bAbs !== aAbs) return bAbs - aAbs;

      return String(getSignalName(a)).localeCompare(String(getSignalName(b)));
    });
  }, [signals]);

  const counts = useMemo(() => {
    const increasedItems = sortedSignals.filter((item) => getChangePercent(item) > 0);

const hasMaterialIncrease = increasedItems.some((item) => {
  const severity = getSeverity(item).toLowerCase();
  return (
    getChangePercent(item) >= MATERIAL_COST_INCREASE ||
    severity.includes("high")
  );
});

return {
  tracked: sortedSignals.length,
  increased: increasedItems.length,
  decreased: sortedSignals.filter((item) => getChangePercent(item) < 0).length,
  homeWatch: sortedSignals.filter((item) => item.fields?.showOnHome === true).length,
  hasMaterialIncrease,
};
  }, [sortedSignals]);

  const topSignal = sortedSignals[0]
    ? getSignalName(sortedSignals[0])
    : "No cost pressure detected";

  if (status === "pending") {
    return (
      <div className="container py-8">
        <div className="content">
          <div
            className="rounded-3xl border p-6 text-sm text-muted-foreground shadow-sm"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.76))",
              borderColor: "rgba(15,23,42,0.08)",
            }}
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading Cost Watch...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="container py-8">
        <div className="content">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div>
                Cost Watch could not load from Cost Movement. Check that the
                Cost Movement table is available to Softr and that field names
                match the Vibe block.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="content space-y-6">
        <section
  className="relative overflow-hidden rounded-3xl border p-5 shadow-xl"
  style={{
    background:
      "radial-gradient(circle at 12% 8%, rgba(34,211,238,0.065), transparent 30%), radial-gradient(circle at 82% 12%, rgba(59,130,246,0.045), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(248,250,252,0.94) 55%, rgba(241,245,249,0.86) 100%)",
    borderColor: "rgba(15,23,42,0.08)",
    boxShadow:
      "0 14px 34px rgba(15,23,42,0.075), inset 0 1px 0 rgba(255,255,255,0.82)",
  }}
>
          <div
  className="pointer-events-none absolute inset-0 opacity-[0.055]"
  style={{
    backgroundImage:
      "linear-gradient(rgba(15,23,42,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.10) 1px, transparent 1px)",
    backgroundSize: "34px 34px",
  }}
/>

          <div className="relative z-10">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border"
                    style={{
                      color: "#0891B2",
                      background: "rgba(34,211,238,0.10)",
                      borderColor: "rgba(34,211,238,0.22)",
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  Cost Watch
                </div>

                <h2 className="text-2xl font-heading font-semibold tracking-tight">
                  Vendor Cost Movement
                </h2>

                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Active cost movement signals from approved receipts that may affect margin, pricing, portioning, or vendor conversations.
                </p>
              </div>

              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-sm"
                style={{
                  color: "#475569",
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
                  borderColor: "rgba(15,23,42,0.09)",
                }}
              >
                <Circle className="h-2 w-2 fill-current" style={{ color: "#22D3EE" }} />
                Cost Movement source
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <SummaryPill
                label="Active signals"
                value={counts.tracked}
                tone="neutral"
                icon={CircleDollarSign}
              />

              <SummaryPill
  label="Cost increases"
  value={counts.increased}
  tone={counts.hasMaterialIncrease ? "pressureHigh" : "pressure"}
  icon={TrendingUp}
/>

              <SummaryPill
                label="Cost decreases"
                value={counts.decreased}
                tone="relief"
                icon={TrendingDown}
              />

              <SummaryPill
                label="Home watch"
                value={counts.homeWatch}
                tone="watch"
                icon={ShieldCheck}
              />
            </div>

            <div
              className="mt-4 rounded-2xl border p-4 text-sm leading-relaxed text-muted-foreground shadow-sm"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(248,250,252,0.74))",
                borderColor: "rgba(15,23,42,0.08)",
                boxShadow:
                  "0 10px 24px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.78)",
              }}
            >
              <span className="font-semibold text-foreground">Owner read:</span>{" "}
              {sortedSignals.length > 0 ? (
                <>
                  Start with{" "}
                  <span className="font-semibold text-foreground">
                    {topSignal}
                  </span>{" "}
                  if you need to understand current vendor cost pressure from approved receipts.
                </>
              ) : (
                <>
                  No active vendor cost movement has been tracked from approved receipts yet.
                </>
              )}
            </div>
          </div>
        </section>

        {sortedSignals.length === 0 ? (
          <section
            className="rounded-3xl border p-5 shadow-sm"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(239,246,255,0.58))",
              borderColor: "rgba(59,130,246,0.18)",
            }}
          >
            <div className="rounded-2xl border border-dashed bg-white/70 p-5 text-sm text-muted-foreground">
              No active Cost Watch items yet. Track a cost signal from Receipt Intake and it will appear here when Cost Movement is marked latest and visible.
            </div>
          </section>
        ) : (
          <section
            className="relative overflow-hidden rounded-3xl border p-4 shadow-sm"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
              borderColor: "rgba(34,211,238,0.16)",
              boxShadow:
                "0 12px 30px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.80)",
            }}
          >
            <div
              className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full blur-3xl"
              style={{ background: "rgba(34,211,238,0.12)" }}
            />

            <div className="relative z-10 mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-2xl border shadow-sm"
                    style={{
                      color: "#0891B2",
                      background: "rgba(34,211,238,0.10)",
                      borderColor: "rgba(34,211,238,0.22)",
                    }}
                  >
                    <CircleDollarSign className="h-4 w-4" />
                  </div>

                  <h2 className="text-xl font-heading font-semibold tracking-tight">
                    Cost Movement Signals
                  </h2>
                </div>

                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Current vendor cost changes that may affect margin, pricing, portioning, or vendor conversations.
                </p>
              </div>

              <span
                className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  color: "#0891B2",
                  background: "rgba(34,211,238,0.10)",
                  borderColor: "rgba(34,211,238,0.22)",
                }}
              >
                {sortedSignals.length}
              </span>
            </div>

            <div className="relative z-10 grid gap-3 xl:grid-cols-2">
              {sortedSignals.map((item) => (
                <CostSignalCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
