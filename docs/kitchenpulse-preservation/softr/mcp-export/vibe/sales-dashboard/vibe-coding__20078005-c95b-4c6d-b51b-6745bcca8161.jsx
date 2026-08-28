import { useRecords, q } from "@/lib/datasource";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Utensils,
  Activity,
  CalendarDays,
  ShieldCheck,
  Clock,
  Sparkles,
  Circle,
} from "lucide-react";

const select = q.select({
  metricName: "Metric Name",
  metricValue: "Metric Value",
  metricNumber: "Metric Number",
  metricType: "Metric Type",
  displayOrder: "Display Order",
  sourceRunId: "Source Run ID",
  isLatest: "Is Latest",
  metricDate: "Metric Date",
  notes: "Notes",
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

function fieldNumberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const text = fieldText(value);
  if (!text.trim()) return null;

  const cleaned = text
    .replace(/[$,%]/g, "")
    .replace(/,/g, "")
    .trim();

  if (!cleaned) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function fieldBool(value) {
  if (typeof value === "boolean") return value;
  const text = fieldText(value).toLowerCase();
  return text === "true" || text === "yes" || text === "1";
}

function fieldDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function metricNumberFromFields({
  metricName,
  metricType,
  metricNumber,
  metricValue,
}) {
  const directNumber = fieldNumberOrNull(metricNumber);

  if (directNumber !== null) {
    return normalizeMetricNumber(
      metricName,
      metricType,
      directNumber,
      fieldText(metricValue)
    );
  }

  const parsedValue = fieldNumberOrNull(metricValue);
  if (parsedValue === null) return null;

  return normalizeMetricNumber(
    metricName,
    metricType,
    parsedValue,
    fieldText(metricValue)
  );
}

function normalizeMetricNumber(metricName, metricType, value, originalValueText) {
  const label = `${metricName} ${metricType}`.toLowerCase();

  if (
    label.includes("percent") ||
    label.includes("margin") ||
    originalValueText.includes("%")
  ) {
    return value > 1 ? value / 100 : value;
  }

  return value;
}

function isValidPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function formatCurrency(value) {
  const safe = Number.isFinite(value) ? value : 0;

  return safe.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatCurrencyMaybe(value) {
  if (!isValidPositiveNumber(value)) return "Updating…";
  return formatCurrency(value);
}

function formatCurrencyForMonth(value, runCount) {
  if (!isValidPositiveNumber(value)) {
    return runCount > 0 ? "Waiting…" : "No data yet";
  }

  return formatCurrency(value);
}

function formatPercentForMonth(value, runCount) {
  if (!isValidPositiveNumber(value)) {
    return runCount > 0 ? "Waiting…" : "No data yet";
  }

  return formatPercent(value);
}

function formatCompactCurrency(value) {
  if (!isValidPositiveNumber(value)) return "Updating…";

  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }

  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }

  return formatCurrency(value);
}

function formatPercent(value) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${(safe * 100).toFixed(1)}%`;
}

function formatPercentMaybe(value) {
  if (!isValidPositiveNumber(value)) return "Updating…";
  return formatPercent(value);
}

function formatDelta(value, type = "currency") {
  if (value === null || !Number.isFinite(value)) return "Updating…";

  const sign = value > 0 ? "+" : "";

  if (type === "percent") return `${sign}${(value * 100).toFixed(1)} pts`;
  if (type === "number") return `${sign}${value.toLocaleString()}`;

  return `${sign}${formatCurrency(value)}`;
}

function monthLabel(date) {
  return date.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function isCurrentPosRun(sourceRunId) {
  const text = String(sourceRunId || "").toLowerCase();

  if (!text.startsWith("pos-")) return false;
  if (text.includes("test")) return false;
  if (text.includes("fake")) return false;
  if (text.includes("sample")) return false;
  if (text.includes("partial")) return false;

  return true;
}

function isComparableDinnerRun(sourceRunId) {
  const text = String(sourceRunId || "").toLowerCase();

  if (!isCurrentPosRun(sourceRunId)) return false;
  if (!text.includes("-close-")) return false;

  return true;
}

function marginTone(margin) {
  if (!isValidPositiveNumber(margin)) {
    return {
      label: "Syncing metrics",
      color: "#64748B",
      bg: "rgba(100,116,139,0.09)",
      border: "rgba(100,116,139,0.18)",
      glow: "rgba(100,116,139,0.10)",
      valueColor: "#64748B",
      rail: "#94A3B8",
    };
  }

  if (margin >= 0.65) {
    return {
      label: "Healthy margin",
      color: "#0891B2",
      bg: "rgba(34,211,238,0.10)",
      border: "rgba(34,211,238,0.22)",
      glow: "rgba(34,211,238,0.13)",
      valueColor: "#0891B2",
      rail: "#22D3EE",
    };
  }

  if (margin >= 0.5) {
    return {
      label: "Margin watch",
      color: "#D97706",
      bg: "rgba(245,158,11,0.12)",
      border: "rgba(245,158,11,0.30)",
      glow: "rgba(245,158,11,0.16)",
      valueColor: "#B45309",
      rail: "#F59E0B",
    };
  }

  return {
    label: "Margin pressure",
    color: "#EA580C",
    bg: "rgba(249,115,22,0.14)",
    border: "rgba(249,115,22,0.36)",
    glow: "rgba(249,115,22,0.22)",
    valueColor: "#EA580C",
    rail: "#EA580C",
  };
}

function deltaTone(value) {
  if (value === null || !Number.isFinite(value)) {
    return {
      color: "#64748B",
      bg: "rgba(100,116,139,0.09)",
      border: "rgba(100,116,139,0.18)",
      glow: "rgba(100,116,139,0.10)",
      icon: Activity,
    };
  }

  if (value > 0) {
    return {
      color: "#0891B2",
      bg: "rgba(34,211,238,0.10)",
      border: "rgba(34,211,238,0.22)",
      glow: "rgba(34,211,238,0.13)",
      icon: TrendingUp,
    };
  }

  if (value < 0) {
    return {
      color: "#EA580C",
      bg: "rgba(249,115,22,0.13)",
      border: "rgba(249,115,22,0.30)",
      glow: "rgba(249,115,22,0.18)",
      icon: TrendingDown,
    };
  }

  return {
    color: "#64748B",
    bg: "rgba(100,116,139,0.09)",
    border: "rgba(100,116,139,0.18)",
    glow: "rgba(100,116,139,0.10)",
    icon: Activity,
  };
}

function getMetric(metrics, name) {
  const target = String(name || "").trim().toLowerCase();

  function clean(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isWantedMetric(row) {
    const metricName = clean(row.metricName);
    const metricType = clean(row.metricType);

    if (target === "revenue") {
      return (
        metricName === "revenue" ||
        metricName === "latest revenue" ||
        metricType === "revenue"
      );
    }

    if (target === "profit") {
      return (
        metricName === "profit" ||
        metricName === "latest profit" ||
        metricName === "workbook profit" ||
        metricName === "workbook-adjusted profit" ||
        metricType === "profit"
      );
    }

    if (target === "margin") {
      return (
        metricName === "margin" ||
        metricName === "latest margin" ||
        metricType === "margin"
      );
    }

    if (target === "top item") {
      return (
        metricName === "top item" ||
        metricName === "recent top item" ||
        metricName === "top seller" ||
        metricType === "top item"
      );
    }

    return metricName === target;
  }

  const matches = metrics.filter(isWantedMetric);

  if (!matches.length) return null;

  return matches.sort((a, b) => {
    const aUseful = isValidPositiveNumber(a.metricNumber) ? 1 : 0;
    const bUseful = isValidPositiveNumber(b.metricNumber) ? 1 : 0;

    if (aUseful !== bUseful) return bUseful - aUseful;

    const aLatest = a.isLatest ? 1 : 0;
    const bLatest = b.isLatest ? 1 : 0;

    if (aLatest !== bLatest) return bLatest - aLatest;

    const aTime = a.metricDate ? a.metricDate.getTime() : 0;
    const bTime = b.metricDate ? b.metricDate.getTime() : 0;

    return bTime - aTime;
  })[0];
}

function isRealTopItem(value) {
  const text = String(value || "").trim();

  if (!text) return false;
  if (text === "—") return false;
  if (text === "0") return false;
  if (text.toLowerCase() === "updating") return false;

  return true;
}

function buildRunSummary(metrics, sourceRunId) {
  const rows = metrics.filter((m) => m.sourceRunId === sourceRunId);

  const revenueMetric = getMetric(rows, "Revenue");
  const profitMetric = getMetric(rows, "Profit");
  const marginMetric = getMetric(rows, "Margin");
  const topItemMetric = getMetric(rows, "Top Item");

  let revenue = revenueMetric?.metricNumber ?? null;
  let profit = profitMetric?.metricNumber ?? null;
  let margin = marginMetric?.metricNumber ?? null;
  let hasDerivedValue = false;

  if (
    !isValidPositiveNumber(revenue) &&
    isValidPositiveNumber(profit) &&
    isValidPositiveNumber(margin)
  ) {
    revenue = profit / margin;
    hasDerivedValue = true;
  }

  if (
    !isValidPositiveNumber(profit) &&
    isValidPositiveNumber(revenue) &&
    isValidPositiveNumber(margin)
  ) {
    profit = revenue * margin;
    hasDerivedValue = true;
  }

  if (
    !isValidPositiveNumber(margin) &&
    isValidPositiveNumber(revenue) &&
    isValidPositiveNumber(profit)
  ) {
    margin = profit / revenue;
    hasDerivedValue = true;
  }

  if (
    isValidPositiveNumber(profit) &&
    isValidPositiveNumber(margin) &&
    !isValidPositiveNumber(revenue)
  ) {
    revenue = null;
  }

  if (
    isValidPositiveNumber(revenue) &&
    isValidPositiveNumber(margin) &&
    !isValidPositiveNumber(profit)
  ) {
    profit = null;
  }

  if (
    isValidPositiveNumber(revenue) &&
    isValidPositiveNumber(profit) &&
    !isValidPositiveNumber(margin)
  ) {
    margin = null;
  }

  const metricDate =
    rows
      .map((row) => row.metricDate)
      .filter(Boolean)
      .sort((a, b) => b.getTime() - a.getTime())[0] || null;

  const topItem = topItemMetric?.metricValue || "—";

  const isFinancialComplete =
    Boolean(metricDate) &&
    isValidPositiveNumber(revenue) &&
    isValidPositiveNumber(profit) &&
    isValidPositiveNumber(margin);

  const isComplete = isFinancialComplete;

  return {
    sourceRunId,
    rows,
    revenue,
    profit,
    margin,
    topItem,
    metricDate,
    isComplete,
    isFinancialComplete,
    hasDerivedValue,
  };
}

function sortSummariesNewestFirst(a, b) {
  const aTime = a.metricDate ? a.metricDate.getTime() : 0;
  const bTime = b.metricDate ? b.metricDate.getTime() : 0;

  return bTime - aTime;
}

function getLatestTopItem(metrics, latestRunId, latestDateKey) {
  const validTopItems = metrics.filter(
    (m) => m.metricName === "Top Item" && isRealTopItem(m.metricValue)
  );

  const exactRunMatch = validTopItems.find((m) => m.sourceRunId === latestRunId);

  if (exactRunMatch) return exactRunMatch.metricValue;

  const sameDateMatch = validTopItems
    .filter((m) => {
      if (!latestDateKey || !m.metricDate) return false;
      if (!isComparableDinnerRun(m.sourceRunId)) return false;

      const rowDateKey = m.metricDate.toISOString().slice(0, 10);
      return rowDateKey === latestDateKey;
    })
    .sort((a, b) => {
      const aLatest = a.isLatest ? 1 : 0;
      const bLatest = b.isLatest ? 1 : 0;

      if (aLatest !== bLatest) return bLatest - aLatest;

      const aNumber = a.metricNumber || 0;
      const bNumber = b.metricNumber || 0;

      if (aNumber !== bNumber) return bNumber - aNumber;

      const aTime = a.metricDate ? a.metricDate.getTime() : 0;
      const bTime = b.metricDate ? b.metricDate.getTime() : 0;

      return bTime - aTime;
    })[0];

  if (sameDateMatch) return sameDateMatch.metricValue;

  const latestReportingTopItem = validTopItems
    .filter((m) => m.isLatest && isComparableDinnerRun(m.sourceRunId))
    .sort((a, b) => {
      const aTime = a.metricDate ? a.metricDate.getTime() : 0;
      const bTime = b.metricDate ? b.metricDate.getTime() : 0;
      return bTime - aTime;
    })[0];

  if (latestReportingTopItem) return latestReportingTopItem.metricValue;

  const mostRecentReportingTopItem = validTopItems
    .filter((m) => isComparableDinnerRun(m.sourceRunId))
    .sort((a, b) => {
      const aTime = a.metricDate ? a.metricDate.getTime() : 0;
      const bTime = b.metricDate ? b.metricDate.getTime() : 0;
      return bTime - aTime;
    })[0];

  return mostRecentReportingTopItem?.metricValue || "—";
}

function StatusPill({ label, tone, icon }) {
  const Icon = icon || Circle;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
      style={{
        color: tone.color,
        background: tone.bg,
        borderColor: tone.border,
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function StatCard({ icon, label, value, helper, tone }) {
  const Icon = icon;
  const meta = tone || deltaTone(null);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 shadow-sm"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.74))",
        borderColor: meta.border,
        boxShadow:
          "0 10px 24px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.78)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl"
        style={{ background: meta.glow }}
      />

      <div className="relative z-10 mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border"
          style={{
            color: meta.color,
            background: meta.bg,
            borderColor: meta.border,
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span>{label}</span>
      </div>

      <div
        className="relative z-10 text-2xl font-bold leading-tight"
        style={{ color: meta.color }}
      >
        {value || "Updating…"}
      </div>

      {helper ? (
        <div className="relative z-10 mt-1 text-xs leading-relaxed text-muted-foreground">
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function ComparisonCard({ label, value, delta, deltaValue }) {
  const tone = deltaTone(deltaValue);
  const Icon = tone.icon;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 shadow-sm"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(248,250,252,0.72))",
        borderColor: tone.border,
        boxShadow:
          "0 10px 24px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.78)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl"
        style={{ background: tone.glow }}
      />

      <div className="relative z-10 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>

      <div className="relative z-10 mt-1 text-xl font-bold text-foreground">
        {value}
      </div>

      <div
        className="relative z-10 mt-1 flex items-center gap-1 text-xs font-semibold"
        style={{ color: tone.color }}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{delta} vs prior dinner</span>
      </div>
    </div>
  );
}

function getOwnerRead({
  latestRevenue,
  latestProfit,
  latestMargin,
  priorRevenue,
  priorProfit,
  priorMargin,
  mtdRevenue,
  mtdMargin,
  mtdRuns,
  isShowingFallbackRun,
}) {
  if (
    !isValidPositiveNumber(latestRevenue) ||
    !isValidPositiveNumber(latestProfit) ||
    !isValidPositiveNumber(latestMargin)
  ) {
    return "Latest dinner metrics are still syncing. KitchenPulse is waiting for a complete POS metric set before showing owner-facing numbers.";
  }

  if (isShowingFallbackRun) {
    return "Newest POS metrics are still syncing, so KitchenPulse is showing the last verified dinner run instead of displaying partial data.";
  }

  const revenueDelta = isValidPositiveNumber(priorRevenue)
    ? latestRevenue - priorRevenue
    : null;

  const profitDelta = isValidPositiveNumber(priorProfit)
    ? latestProfit - priorProfit
    : null;

  const marginDelta = isValidPositiveNumber(priorMargin)
    ? latestMargin - priorMargin
    : null;

  if (
    revenueDelta !== null &&
    profitDelta !== null &&
    revenueDelta > 0 &&
    profitDelta > 0 &&
    latestMargin >= 0.6
  ) {
    return "Strong owner read: latest dinner improved revenue and workbook-adjusted profit while holding a healthy margin. Review movement only to understand what drove the lift.";
  }

  if (
    revenueDelta !== null &&
    marginDelta !== null &&
    revenueDelta > 0 &&
    marginDelta < -0.03
  ) {
    return "Revenue improved, but margin softened. Look for mix shift, comp/discount pressure, or lower-margin items carrying the night.";
  }

  if (revenueDelta !== null && revenueDelta < 0 && latestMargin >= 0.6) {
    return "Revenue softened versus the prior dinner, but margin is still healthy. This may be normal demand variance unless it repeats across comparable services.";
  }

  if (latestMargin < 0.5) {
    return "Margin is the issue to watch. Before chasing revenue, check whether sales mix or cost assumptions are pulling profit down.";
  }

  return `Latest dinner is readable, but not extreme. Month-to-date is at ${formatCompactCurrency(
    mtdRevenue
  )} revenue across ${mtdRuns} reporting runs with ${formatPercentMaybe(
    mtdMargin
  )} blended margin.`;
}

export default function Block() {
  const { data, status } = useRecords({
    select,
    count: 5000,
  });

  if (status === "pending") {
    return (
      <div className="container py-6">
        <div className="content">
          <div
            className="rounded-3xl border p-6 shadow-sm"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.76))",
              borderColor: "rgba(15,23,42,0.08)",
            }}
          >
            <div className="h-48 rounded-2xl bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="container py-6">
        <div className="content">
          <div
            className="rounded-3xl border p-6 text-sm text-muted-foreground shadow-sm"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.76))",
              borderColor: "rgba(15,23,42,0.08)",
            }}
          >
            Unable to load dashboard metrics.
          </div>
        </div>
      </div>
    );
  }

  const items = data?.pages?.flatMap((page) => page.items) || [];

  const metrics = items
    .map((item) => {
      const metricName = fieldText(item.fields.metricName);
      const metricType = fieldText(item.fields.metricType);
      const metricValue = fieldText(item.fields.metricValue);

      return {
        id: item.id,
        metricName,
        metricValue,
        metricNumber: metricNumberFromFields({
          metricName,
          metricType,
          metricNumber: item.fields.metricNumber,
          metricValue: item.fields.metricValue,
        }),
        metricType,
        displayOrder: fieldNumberOrNull(item.fields.displayOrder),
        sourceRunId: fieldText(item.fields.sourceRunId),
        isLatest: fieldBool(item.fields.isLatest),
        metricDate: fieldDate(item.fields.metricDate),
        notes: fieldText(item.fields.notes),
      };
    })
    .filter((m) => m.sourceRunId);

  if (metrics.length === 0) {
    return (
      <div className="container py-6">
        <div className="content">
          <div
            className="rounded-3xl border p-6 text-sm text-muted-foreground shadow-sm"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.76))",
              borderColor: "rgba(15,23,42,0.08)",
            }}
          >
            No dashboard metrics found yet.
          </div>
        </div>
      </div>
    );
  }

  const currentPosMetrics = metrics.filter((m) => isCurrentPosRun(m.sourceRunId));

  const comparableDinnerMetrics = metrics.filter((m) =>
    isComparableDinnerRun(m.sourceRunId)
  );

  const allRunIds = Array.from(
    new Set(comparableDinnerMetrics.map((m) => m.sourceRunId).filter(Boolean))
  );

  const allRunSummaries = allRunIds
    .map((runId) => buildRunSummary(metrics, runId))
    .filter((summary) => summary.metricDate)
    .sort(sortSummariesNewestFirst);

  const latestAvailableRun = allRunSummaries[0] || null;

  const latestFlaggedRunIds = Array.from(
    new Set(
      comparableDinnerMetrics
        .filter((m) => m.isLatest)
        .map((m) => m.sourceRunId)
        .filter(Boolean)
    )
  );

  const latestFlaggedSummaries = latestFlaggedRunIds
    .map((runId) => buildRunSummary(metrics, runId))
    .filter((summary) => summary.metricDate && summary.isFinancialComplete)
    .sort(sortSummariesNewestFirst);

  const latestFlaggedSummary = latestFlaggedSummaries[0] || null;

  const completeRunSummaries = allRunSummaries
    .filter((summary) => summary.isComplete)
    .sort(sortSummariesNewestFirst);

  const latestSummary =
    latestFlaggedSummary ||
    completeRunSummaries[0] ||
    latestAvailableRun ||
    buildRunSummary(metrics, "");

  const newestCompleteRun = completeRunSummaries[0] || null;

  const isShowingFallbackRun =
    Boolean(latestFlaggedSummary) &&
    Boolean(newestCompleteRun) &&
    latestFlaggedSummary.sourceRunId !== newestCompleteRun.sourceRunId;

  const latestDateKey = latestSummary.metricDate
    ? latestSummary.metricDate.toISOString().slice(0, 10)
    : "";

  const latestTopItem = isRealTopItem(latestSummary.topItem)
    ? latestSummary.topItem
    : getLatestTopItem(metrics, latestSummary.sourceRunId, latestDateKey);

  const priorSummary =
    completeRunSummaries.find((summary) => {
      if (summary.sourceRunId === latestSummary.sourceRunId) return false;
      if (!summary.metricDate || !latestSummary.metricDate) return false;

      const summaryDateKey = summary.metricDate.toISOString().slice(0, 10);
      const latestKey = latestSummary.metricDate.toISOString().slice(0, 10);

      return summaryDateKey < latestKey;
    }) || null;

  const latestTone = marginTone(latestSummary.margin);
  const now = new Date();

  const monthMetrics = currentPosMetrics.filter((m) => {
    if (!m.metricDate) return false;

    return (
      m.metricDate.getMonth() === now.getMonth() &&
      m.metricDate.getFullYear() === now.getFullYear()
    );
  });

  const monthDinnerMetrics = comparableDinnerMetrics.filter((m) => {
    if (!m.metricDate) return false;

    return (
      m.metricDate.getMonth() === now.getMonth() &&
      m.metricDate.getFullYear() === now.getFullYear()
    );
  });

  function pickLatestMetricPerRun(rows, metricName) {
    const byRun = new Map();

    for (const row of rows) {
      if (row.metricName !== metricName) continue;
      if (!row.sourceRunId) continue;

      const existing = byRun.get(row.sourceRunId);

      const rowTime = row.metricDate ? row.metricDate.getTime() : 0;
      const existingTime = existing?.metricDate ? existing.metricDate.getTime() : 0;

      if (!existing || rowTime >= existingTime) {
        byRun.set(row.sourceRunId, row);
      }
    }

    return Array.from(byRun.values());
  }

  const monthRevenueRows = pickLatestMetricPerRun(monthMetrics, "Revenue");

  const mtdRunIds = Array.from(
    new Set(monthRevenueRows.map((row) => row.sourceRunId).filter(Boolean))
  );

  const monthRunSummaries = mtdRunIds
    .map((runId) => buildRunSummary(metrics, runId))
    .filter((summary) => summary.isFinancialComplete);

  const monthDinnerRevenueRows = pickLatestMetricPerRun(
    monthDinnerMetrics,
    "Revenue"
  );

  const monthDinnerRunIds = Array.from(
    new Set(monthDinnerRevenueRows.map((row) => row.sourceRunId).filter(Boolean))
  );

  const monthDinnerRunSummaries = monthDinnerRunIds
    .map((runId) => buildRunSummary(metrics, runId))
    .filter((summary) => summary.isFinancialComplete);

  const mtdRevenue = monthRunSummaries.reduce(
    (sum, run) => sum + (run.revenue || 0),
    0
  );

  const mtdProfit = monthRunSummaries.reduce(
    (sum, run) => sum + (run.profit || 0),
    0
  );

  const mtdMargin =
    mtdRevenue > 0 && mtdProfit > 0 ? mtdProfit / mtdRevenue : null;

  const monthTone = marginTone(mtdMargin);

  const revenueDelta =
    priorSummary &&
      isValidPositiveNumber(latestSummary.revenue) &&
      isValidPositiveNumber(priorSummary.revenue)
      ? latestSummary.revenue - priorSummary.revenue
      : null;

  const profitDelta =
    priorSummary &&
      isValidPositiveNumber(latestSummary.profit) &&
      isValidPositiveNumber(priorSummary.profit)
      ? latestSummary.profit - priorSummary.profit
      : null;

  const marginDelta =
    priorSummary &&
      isValidPositiveNumber(latestSummary.margin) &&
      isValidPositiveNumber(priorSummary.margin)
      ? latestSummary.margin - priorSummary.margin
      : null;

  const ownerRead = getOwnerRead({
    latestRevenue: latestSummary.revenue,
    latestProfit: latestSummary.profit,
    latestMargin: latestSummary.margin,
    priorRevenue: priorSummary?.revenue || null,
    priorProfit: priorSummary?.profit || null,
    priorMargin: priorSummary?.margin || null,
    mtdRevenue,
    mtdProfit,
    mtdMargin,
    mtdRuns: monthRunSummaries.length,
    isShowingFallbackRun,
  });

  const statusTone = isShowingFallbackRun
    ? {
      label: "Latest verified run",
      color: "#D97706",
      bg: "rgba(245,158,11,0.12)",
      border: "rgba(245,158,11,0.30)",
      glow: "rgba(245,158,11,0.16)",
      icon: Clock,
    }
    : latestSummary.isComplete
      ? {
        label: "Verified run",
        color: "#0891B2",
        bg: "rgba(34,211,238,0.10)",
        border: "rgba(34,211,238,0.22)",
        glow: "rgba(34,211,238,0.13)",
        icon: ShieldCheck,
      }
      : {
        label: "Syncing metrics",
        color: "#64748B",
        bg: "rgba(100,116,139,0.09)",
        border: "rgba(100,116,139,0.18)",
        glow: "rgba(100,116,139,0.10)",
        icon: Clock,
      };

  const revenueTone = deltaTone(revenueDelta);
  const profitTone = deltaTone(profitDelta);

  return (
    <div className="container py-6">
      <div className="content space-y-5">
        <section
          className="relative overflow-hidden rounded-3xl border p-5 shadow-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 58%, rgba(241,245,249,0.88) 100%)",
            borderColor: "rgba(15,23,42,0.08)",
            boxShadow:
              "0 18px 45px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.82)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
            style={{
              background: latestTone.rail,
              opacity: 0.55,
            }}
          />

          <div
            className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full blur-3xl"
            style={{ background: "rgba(148,163,184,0.08)" }}
          />

          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(15,23,42,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.10) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          <div className="relative z-10 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                label="Latest dinner run"
                tone={{
                  color: "#0891B2",
                  bg: "rgba(34,211,238,0.10)",
                  border: "rgba(34,211,238,0.22)",
                }}
                icon={CalendarDays}
              />

              <StatusPill label={latestTone.label} tone={latestTone} icon={Percent} />

              <StatusPill
                label="Owner view"
                tone={{
                  color: "#475569",
                  bg: "rgba(100,116,139,0.08)",
                  border: "rgba(100,116,139,0.16)",
                }}
                icon={Sparkles}
              />

              <StatusPill
                label={statusTone.label}
                tone={statusTone}
                icon={statusTone.icon}
              />
            </div>

            {isShowingFallbackRun ? (
              <div
                className="rounded-2xl border px-4 py-3 text-sm leading-relaxed"
                style={{
                  color: "#B45309",
                  background: "rgba(245,158,11,0.12)",
                  borderColor: "rgba(245,158,11,0.30)",
                }}
              >
                Newest POS metrics are still syncing. KitchenPulse is showing the most recent verified dinner run instead of displaying partial numbers.
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">
                  Latest Dinner Performance
                </h2>

                <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
                  The latest verified dinner run produced{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrencyMaybe(latestSummary.revenue)}
                  </span>{" "}
                  in revenue,{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrencyMaybe(latestSummary.profit)}
                  </span>{" "}
                  in workbook-adjusted profit, and a{" "}
                  <span
                    className="font-semibold"
                    style={{ color: latestTone.valueColor }}
                  >
                    {formatPercentMaybe(latestSummary.margin)}
                  </span>{" "}
                  margin.
                </p>
              </div>

              <div
                className="relative overflow-hidden rounded-2xl border p-4 shadow-sm"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(248,250,252,0.72))",
                  borderColor: latestTone.border,
                  boxShadow:
                    "0 10px 24px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.78)",
                }}
              >
                <div
                  className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl"
                  style={{ background: latestTone.glow }}
                />

                <div className="relative z-10 mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Owner read
                </div>

                <div className="relative z-10 text-sm leading-relaxed text-muted-foreground">
                  {ownerRead}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                icon={DollarSign}
                label="Revenue"
                value={formatCurrencyMaybe(latestSummary.revenue)}
                helper={
                  priorSummary
                    ? `${formatDelta(revenueDelta)} vs prior dinner`
                    : latestSummary.isComplete
                      ? "Latest verified dinner run"
                      : "Waiting for complete POS metrics"
                }
                tone={revenueTone}
              />

              <StatCard
                icon={TrendingUp}
                label="Profit"
                value={formatCurrencyMaybe(latestSummary.profit)}
                helper={
                  priorSummary
                    ? `${formatDelta(profitDelta)} vs prior dinner`
                    : latestSummary.isComplete
                      ? "Workbook-adjusted profit"
                      : "Waiting for complete POS metrics"
                }
                tone={profitTone}
              />

              <StatCard
                icon={Percent}
                label="Margin"
                value={formatPercentMaybe(latestSummary.margin)}
                helper={
                  priorSummary
                    ? `${formatDelta(marginDelta, "percent")} vs prior dinner`
                    : latestSummary.isComplete
                      ? "Blended dinner margin"
                      : "Waiting for complete POS metrics"
                }
                tone={latestTone}
              />

              <StatCard
                icon={Utensils}
                label="Recent Top Item"
                value={isRealTopItem(latestTopItem) ? latestTopItem : "Updating…"}
                helper="Latest verified item signal"
                tone={{
                  color: "#0F766E",
                  bg: "rgba(20,184,166,0.09)",
                  border: "rgba(20,184,166,0.20)",
                  glow: "rgba(20,184,166,0.12)",
                }}
              />
            </div>

            {priorSummary ? (
              <div className="grid gap-3 md:grid-cols-3">
                <ComparisonCard
                  label="Revenue change"
                  value={formatCurrencyMaybe(latestSummary.revenue)}
                  delta={formatDelta(revenueDelta)}
                  deltaValue={revenueDelta}
                />

                <ComparisonCard
                  label="Profit change"
                  value={formatCurrencyMaybe(latestSummary.profit)}
                  delta={formatDelta(profitDelta)}
                  deltaValue={profitDelta}
                />

                <ComparisonCard
                  label="Margin change"
                  value={formatPercentMaybe(latestSummary.margin)}
                  delta={formatDelta(marginDelta, "percent")}
                  deltaValue={marginDelta}
                />
              </div>
            ) : null}

            <div
              className="rounded-2xl border px-4 py-3 text-sm leading-relaxed text-muted-foreground shadow-sm"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(248,250,252,0.72))",
                borderColor: "rgba(15,23,42,0.08)",
              }}
            >
              <span className="font-semibold text-foreground">How to use this:</span>{" "}
              Owners should use this page for revenue, workbook-adjusted profit, margin, and month-to-date health. Use What Changed for the item-level explanation behind the movement.
            </div>
          </div>
        </section>

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

          <div className="relative z-10 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill label="Month so far" tone={monthTone} icon={CalendarDays} />

              <StatusPill
                label={monthLabel(now)}
                tone={{
                  color: "#475569",
                  bg: "rgba(100,116,139,0.08)",
                  border: "rgba(100,116,139,0.16)",
                }}
                icon={Clock}
              />

              <StatusPill
                label={`${monthRunSummaries.length} verified POS runs`}
                tone={{
                  color: "#0891B2",
                  bg: "rgba(34,211,238,0.10)",
                  border: "rgba(34,211,238,0.22)",
                }}
                icon={ShieldCheck}
              />

              <StatusPill
  label={`${monthDinnerRunSummaries.length} comparison runs`}
  tone={{
    color: "#2563EB",
    bg: "rgba(59,130,246,0.10)",
    border: "rgba(59,130,246,0.22)",
  }}
  icon={Activity}
/>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <h3 className="text-2xl font-semibold tracking-tight">
                    Month-to-Date Sales Pulse
                  </h3>
                </div>

                <p className="text-sm leading-relaxed text-muted-foreground">
                  So far this month across{" "}
                  <span className="font-semibold text-foreground">
                    {monthRunSummaries.length}
                  </span>{" "}
                  captured POS sales runs, Chloe&apos;s has generated{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrencyForMonth(mtdRevenue, monthRunSummaries.length)}
                  </span>{" "}
                  in revenue,{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrencyForMonth(mtdProfit, monthRunSummaries.length)}
                  </span>{" "}
                  in workbook-adjusted profit, and a{" "}
                  <span
                    className="font-semibold"
                    style={{ color: monthTone.valueColor }}
                  >
                    {formatPercentForMonth(mtdMargin, monthRunSummaries.length)}
                  </span>{" "}
                  blended margin. Detailed movement comparisons are still based on{" "}
<span className="font-semibold text-foreground">
  {monthDinnerRunSummaries.length}
</span>{" "}
comparable close runs, while this month-to-date total includes every verified full POS run.
                </p>
              </div>

              <div
                className="relative overflow-hidden rounded-2xl border p-4 shadow-sm"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(248,250,252,0.72))",
                  borderColor: monthTone.border,
                  boxShadow:
                    "0 10px 24px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.78)",
                }}
              >
                <div
                  className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl"
                  style={{ background: monthTone.glow }}
                />

                <div className="relative z-10 mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Owner takeaway
                </div>

                <div className="relative z-10 text-sm leading-relaxed text-muted-foreground">
                  {!isValidPositiveNumber(mtdMargin)
                    ? monthRunSummaries.length > 0
                      ? "Month-to-date metrics are waiting for a complete verified POS sales set."
                      : "Month-to-date metrics will populate after the first verified POS sales run of the month."
                    : mtdMargin >= 0.65
                      ? "Month-to-date margin is strong. The owner should watch whether revenue pace continues while keeping the same profit quality."
                      : mtdMargin >= 0.5
                        ? "Month-to-date margin is acceptable but worth watching. Review item mix and margin leaks before assuming sales growth is healthy."
                        : "Month-to-date margin is under pressure. Focus on profit quality before chasing more volume."}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                icon={DollarSign}
                label="MTD Revenue"
                value={formatCurrencyForMonth(mtdRevenue, monthRunSummaries.length)}
                helper="All captured POS sales runs"
                tone={{
                  color: "#0891B2",
                  bg: "rgba(34,211,238,0.10)",
                  border: "rgba(34,211,238,0.22)",
                  glow: "rgba(34,211,238,0.13)",
                }}
              />

              <StatCard
                icon={TrendingUp}
                label="MTD Profit"
                value={formatCurrencyForMonth(mtdProfit, monthRunSummaries.length)}
                helper="Workbook-adjusted operating contribution"
                tone={{
                  color: "#2563EB",
                  bg: "rgba(59,130,246,0.10)",
                  border: "rgba(59,130,246,0.22)",
                  glow: "rgba(59,130,246,0.13)",
                }}
              />

              <StatCard
                icon={Percent}
                label="MTD Margin"
                value={formatPercentForMonth(mtdMargin, monthRunSummaries.length)}
                helper="Blended margin"
                tone={monthTone}
              />

              <StatCard
  icon={Activity}
  label="POS Runs"
  value={String(monthRunSummaries.length)}
  helper="Every verified full POS run this month"
  tone={{
    color: "#0F766E",
    bg: "rgba(20,184,166,0.09)",
    border: "rgba(20,184,166,0.20)",
    glow: "rgba(20,184,166,0.12)",
  }}
/>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
