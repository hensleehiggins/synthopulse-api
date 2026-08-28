import { useMemo, useState } from "react";
import { useRecords, q } from "@/lib/datasource";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  LineChart,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const PRESSURE_LIMIT = 3;
const RELIEF_LIMIT = 3;
const LOG_LIMIT = 8;
const SEARCH_LOG_LIMIT = 20;

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
  latestReceiptDate: "Latest Receipt Date",
  isLatest: "Is Latest",
  showOnWhatChanged: "Show on What Changed",
  showOnHome: "Show on Home",
  decisionEligible: "Decision Eligible",
  marginPressure: "Margin Pressure",
  suggestedAction: "Suggested Action",
  formattedCostBrief: "Formatted Cost Brief",
  relatedMenuItems: "Related Menu Items",
  relatedMenuComponents: "Related Menu Components",
  sourceCostProposal: "Source Cost Proposal",
  receiptLine: "Receipt Line",
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
        return String(v);
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    if ("name" in value) return String(value.name);
    if ("label" in value) return String(value.label);
  }

  return String(value);
}

function fieldNumber(value) {
  if (Array.isArray(value)) {
    return Number(value[0] || 0);
  }

  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
}

function normalizePercentValue(value) {
  const num = fieldNumber(value);

  if (!num && num !== 0) return null;

  if (Math.abs(num) > 1) {
    return num / 100;
  }

  return num;
}

function money(value) {
  const num = fieldNumber(value);

  if (value === null || value === undefined || value === "") return "-";

  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function percent(value) {
  const num = normalizePercentValue(value);

  if (num === null) return "-";

  return num.toLocaleString("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function dateText(value) {
  const raw = fieldText(value);
  if (!raw) return "-";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getItemName(item) {
  const fields = item.fields || {};

  return (
    fieldText(fields.costItemName) ||
    fieldText(fields.vendorLineName) ||
    fieldText(fields.movementName) ||
    "Tracked cost item"
  );
}

function getVendor(item) {
  return fieldText(item.fields?.vendor) || "Vendor not entered";
}

function normalizeItemFamilyName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\d+(\.\d+)?\s*(qt|quart|quarts|lb|lbs|pound|pounds|oz|ounce|ounces|ct|count|cs|case|cases|gal|gallon|gallons|portion|portions|pc|pcs|piece|pieces|ea|each)\b/g, " ")
    .replace(/\b\d+\s*[x×]\s*\d+(\.\d+)?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|and|or|of|fresh|frozen|bulk|case|pack|pkg)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMovementGroupKey(item) {
  const vendor = getVendor(item).toLowerCase().trim();
  const name = normalizeItemFamilyName(getItemName(item));

  return `${vendor}|${name || getItemName(item).toLowerCase().trim()}`;
}

function dedupeMovementFamilies(items) {
  const seen = new Set();
  const next = [];

  for (const item of items) {
    const key = getMovementGroupKey(item);

    if (seen.has(key)) continue;

    seen.add(key);
    next.push(item);
  }

  return next;
}

function getDirection(item) {
  const direction = fieldText(item.fields?.direction);
  const changePercent = getChangePercent(item);

  if (direction) return direction;
  if (changePercent > 0) return "Increase";
  if (changePercent < 0) return "Decrease";
  return "Flat";
}

function getSeverity(item) {
  return fieldText(item.fields?.severity) || "Watch";
}

function getChangePercent(item) {
  return normalizePercentValue(item.fields?.costChangePercent) || 0;
}

function getChangeAmount(item) {
  return fieldNumber(item.fields?.costChangeAmount);
}

function getBrief(item) {
  const fields = item.fields || {};

  return (
    fieldText(fields.formattedCostBrief) ||
    fieldText(fields.marginPressure) ||
    "Cost movement has been tracked from approved receipt data."
  );
}

function getAction(item) {
  const action = fieldText(item.fields?.suggestedAction);

  if (action) return action;

  const direction = getDirection(item);

  if (direction === "Increase") {
    return "Review margin, portioning, pricing, or vendor terms before pushing affected items harder.";
  }

  if (direction === "Decrease") {
    return "Consider whether the lower cost creates room for a feature, better margin, or vendor benchmark.";
  }

  return "Keep tracking this item and compare against the next approved receipt.";
}

function severityRank(item) {
  const severity = getSeverity(item);

  if (severity === "High") return 4;
  if (severity === "Medium") return 3;
  if (severity === "Low") return 2;
  return 1;
}

function toneStyles(tone = "neutral") {
  if (tone === "pressure") {
    return {
      label: "Cost pressure",
      color: "#B45309",
      bg: "rgba(245,158,11,0.07)",
      border: "rgba(245,158,11,0.14)",
      glow: "rgba(245,158,11,0.04)",
      icon: TrendingUp,
    };
  }

  if (tone === "relief") {
    return {
      label: "Cost relief",
      color: "#0F766E",
      bg: "rgba(20,184,166,0.07)",
      border: "rgba(20,184,166,0.13)",
      glow: "rgba(20,184,166,0.04)",
      icon: TrendingDown,
    };
  }

  if (tone === "priority") {
    return {
      label: "Priority watch",
      color: "#D97706",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.16)",
      glow: "rgba(245,158,11,0.045)",
      icon: ShieldCheck,
    };
  }

  if (tone === "tracked") {
    return {
      label: "Cost tracked",
      color: "#2563EB",
      bg: "rgba(59,130,246,0.08)",
      border: "rgba(59,130,246,0.14)",
      glow: "rgba(59,130,246,0.045)",
      icon: CheckCircle2,
    };
  }

  return {
    label: "Active signals",
    color: "#0891B2",
    bg: "rgba(34,211,238,0.08)",
    border: "rgba(34,211,238,0.14)",
    glow: "rgba(34,211,238,0.045)",
    icon: ClipboardList,
  };
}

function getTone(item) {
  const direction = getDirection(item);

  if (direction === "Increase") return toneStyles("pressure");
  if (direction === "Decrease") return toneStyles("relief");

  return toneStyles("tracked");
}

function SummaryCard({ label, value, subtext, icon: Icon, tone = "neutral" }) {
  const styles = toneStyles(tone);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 shadow-sm"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))",
        borderColor: "rgba(15,23,42,0.08)",
        boxShadow:
          "0 10px 24px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.82)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: styles.border }}
      />

      <div
        className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl"
        style={{ background: styles.glow }}
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </div>

          <div
            className="mt-1 text-2xl font-semibold tracking-tight"
            style={{ color: styles.color }}
          >
            {value}
          </div>
        </div>

        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border shadow-sm"
          style={{
            color: styles.color,
            background: styles.bg,
            borderColor: styles.border,
          }}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <div className="relative z-10 mt-2 text-xs leading-relaxed text-muted-foreground">
        {subtext}
      </div>
    </div>
  );
}

function StatusPill({ children, tone = "neutral", icon: Icon }) {
  const styles = toneStyles(tone);

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
      style={{
        color: styles.color,
        background: styles.bg,
        borderColor: styles.border,
      }}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}

function MovementCard({ item, compact = false }) {
  const fields = item.fields || {};
  const tone = getTone(item);
  const ToneIcon = tone.icon;
  const name = getItemName(item);
  const vendor = getVendor(item);
  const severity = getSeverity(item);
  const relatedMenuItems = fieldText(fields.relatedMenuItems);
  const signalDate = fields.signalDate || fields.latestReceiptDate;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:shadow-md"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.76))",
        borderColor: "rgba(15,23,42,0.08)",
        boxShadow:
          "0 10px 24px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.84)",
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
        <div className="min-w-0">
          <div className="text-base font-semibold leading-tight text-foreground">
            {name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{vendor}</span>
            <span>•</span>
            <span>{dateText(signalDate)}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusPill
            tone={getDirection(item) === "Increase" ? "pressure" : getDirection(item) === "Decrease" ? "relief" : "tracked"}
            icon={ToneIcon}
          >
            {tone.label}
          </StatusPill>

          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
              borderColor: "rgba(15,23,42,0.08)",
            }}
          >
            {severity}
          </span>
        </div>
      </div>

      <p className="relative z-10 text-sm leading-relaxed text-muted-foreground">
        {getBrief(item)}
      </p>

      {!compact && (
        <div
          className="relative z-10 mt-3 rounded-2xl border p-3 text-sm leading-relaxed text-muted-foreground"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
            borderColor: "rgba(15,23,42,0.08)",
          }}
        >
          <span className="font-semibold text-foreground">Suggested action:</span>{" "}
          {getAction(item)}
        </div>
      )}

      {relatedMenuItems && !compact && (
        <div
          className="relative z-10 mt-3 rounded-2xl border p-3 text-xs text-muted-foreground"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
            borderColor: "rgba(15,23,42,0.08)",
          }}
        >
          <span className="font-semibold text-foreground">Menu impact:</span>{" "}
          {relatedMenuItems}
        </div>
      )}

      <div className="relative z-10 mt-4 grid grid-cols-4 gap-3 border-t border-slate-200/70 pt-3 text-sm">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Prior
          </div>
          <div className="mt-1 font-semibold text-foreground">
            {money(fields.previousCost)}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Latest
          </div>
          <div className="mt-1 font-semibold text-foreground">
            {money(fields.latestCost)}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Change
          </div>
          <div className="mt-1 font-semibold" style={{ color: tone.color }}>
            {percent(fields.costChangePercent)}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Dollars
          </div>
          <div className="mt-1 font-semibold" style={{ color: tone.color }}>
            {money(getChangeAmount(item))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, message, icon }) {
  return (
    <div
      className="rounded-3xl border border-dashed p-6 text-center shadow-sm"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.72))",
        borderColor: "rgba(15,23,42,0.12)",
      }}
    >
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border text-muted-foreground"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))",
          borderColor: "rgba(15,23,42,0.08)",
        }}
      >
        {icon}
      </div>

      <div className="mt-3 text-base font-semibold text-foreground">
        {title}
      </div>

      <div className="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
        {message}
      </div>
    </div>
  );
}

function SectionPanel({ title, subtitle, tone, icon: Icon, count, children }) {
  const styles = toneStyles(tone);

  return (
    <section
      className="relative overflow-hidden rounded-3xl border p-4 shadow-sm"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))",
        borderColor: "rgba(15,23,42,0.08)",
        boxShadow:
          "0 10px 24px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.82)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: styles.border }}
      />

      <div
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl"
        style={{ background: styles.glow }}
      />

      <div className="relative z-10 mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-2xl border shadow-sm"
              style={{
                color: styles.color,
                background: styles.bg,
                borderColor: styles.border,
              }}
            >
              <Icon className="h-4 w-4" />
            </span>

            <h3 className="text-xl font-heading font-semibold tracking-tight">
              {title}
            </h3>
          </div>

          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        </div>

        <StatusPill tone={tone}>{count}</StatusPill>
      </div>

      <div className="relative z-10 grid gap-3">{children}</div>
    </section>
  );
}

export default function Block() {
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");

  const { data, status } = useRecords({
    select,
    where: q.and(
      q.boolean("isLatest").is(true),
      q.text("reviewStatus").is("seltSxG4Wz7mqLBVw")
    ),
    orderBy: [q.desc("signalDate")],
    count: 100,
  });

  const records = data?.pages.flatMap((page) => page.items) || [];

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const rankDiff = severityRank(b) - severityRank(a);
      if (rankDiff !== 0) return rankDiff;

      const absDiff = Math.abs(getChangePercent(b)) - Math.abs(getChangePercent(a));
      if (absDiff !== 0) return absDiff;

      return String(getItemName(a)).localeCompare(String(getItemName(b)));
    });
  }, [records]);

  const dedupedRecords = useMemo(() => {
    return dedupeMovementFamilies(sortedRecords);
  }, [sortedRecords]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = dedupedRecords.filter((item) => {
      const direction = getDirection(item);
      const severity = getSeverity(item);
      const name = getItemName(item).toLowerCase();
      const vendor = getVendor(item).toLowerCase();

      if (filter === "pressure" && direction !== "Increase") return false;
      if (filter === "relief" && direction !== "Decrease") return false;
      if (filter === "high" && severity !== "High" && severity !== "Medium") {
        return false;
      }

      if (!query) return true;

      return name.includes(query) || vendor.includes(query);
    });

    return filtered.slice(0, query ? SEARCH_LOG_LIMIT : LOG_LIMIT);
  }, [dedupedRecords, filter, search]);

  const pressureItems = useMemo(() => {
    return dedupedRecords
      .filter((item) => getDirection(item) === "Increase")
      .slice(0, PRESSURE_LIMIT);
  }, [dedupedRecords]);

  const reliefItems = useMemo(() => {
    return dedupedRecords
      .filter((item) => getDirection(item) === "Decrease")
      .slice(0, RELIEF_LIMIT);
  }, [dedupedRecords]);

  const counts = useMemo(() => {
    const active = dedupedRecords.length;
    const increases = dedupedRecords.filter(
      (item) => getDirection(item) === "Increase"
    ).length;
    const decreases = dedupedRecords.filter(
      (item) => getDirection(item) === "Decrease"
    ).length;
    const highOrMedium = dedupedRecords.filter((item) =>
      ["High", "Medium"].includes(getSeverity(item))
    ).length;

    return {
      active,
      increases,
      decreases,
      highOrMedium,
    };
  }, [dedupedRecords]);

  const ownerRead = useMemo(() => {
    if (dedupedRecords.length === 0) {
      return "No active vendor cost movement has been tracked yet. Approved receipt signals will appear here once they become Cost Movement rows.";
    }

    if (pressureItems.length > 0) {
      const top = pressureItems[0];
      return `${getItemName(top)} is the first cost pressure item to review. Start there if you are checking margin exposure, vendor pricing, or menu impact.`;
    }

    if (reliefItems.length > 0) {
      const top = reliefItems[0];
      return `${getItemName(top)} is showing cost relief. Check whether that creates margin room or a feature opportunity.`;
    }

    return "Cost Movement is active, but no major directional pressure is showing yet.";
  }, [dedupedRecords, pressureItems, reliefItems]);

  if (status === "pending") {
    return (
      <div className="container py-4">
        <div
          className="content mx-auto max-w-6xl rounded-3xl border p-5 text-sm text-muted-foreground shadow-sm"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.97), rgba(248,250,252,0.82))",
            borderColor: "rgba(15,23,42,0.08)",
          }}
        >
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-cyan-700" />
            Loading Cost Center...
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="container py-4">
        <div className="content mx-auto max-w-6xl rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>
              Cost Center could not load from Cost Movement. Check that Softr has
              access to the Cost Movement table and that the field names match
              this Vibe block.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="content mx-auto max-w-6xl space-y-6">
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

          <div
            className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full blur-3xl"
            style={{ background: "rgba(148,163,184,0.07)" }}
          />

          <div className="relative z-10">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full"
                    style={{
                      background: "rgba(255,255,255,0.72)",
                      color: "#0891B2",
                      border: "1px solid rgba(15,23,42,0.08)",
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  Cost Center
                </div>

                <h2 className="text-2xl font-heading font-semibold tracking-tight">
                  Food Cost Intelligence
                </h2>

                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  Owner-facing view of approved Cost Movement signals from receipt
                  intake. Use this to spot margin pressure, vendor relief, and
                  items that deserve pricing or portion review.
                </p>
              </div>

              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-sm"
                style={{
                  color: "#334155",
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
                  borderColor: "rgba(15,23,42,0.08)",
                }}
              >
                <CircleDollarSign className="h-3.5 w-3.5 text-cyan-700" />
                Cost Movement source
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <SummaryCard
                label="Active signals"
                value={counts.active}
                subtext="Latest cost movements currently visible to operators."
                icon={ClipboardList}
                tone="neutral"
              />

              <SummaryCard
                label="Cost pressure"
                value={counts.increases}
                subtext="Items where the latest receipt cost moved higher."
                icon={TrendingUp}
                tone="pressure"
              />

              <SummaryCard
                label="Cost relief"
                value={counts.decreases}
                subtext="Items where cost moved lower and may create room."
                icon={TrendingDown}
                tone="relief"
              />

              <SummaryCard
                label="Priority watch"
                value={counts.highOrMedium}
                subtext="High or medium severity signals to review first."
                icon={ShieldCheck}
                tone="priority"
              />
            </div>

            <div
              className="mt-4 rounded-2xl border p-4 text-sm leading-relaxed text-muted-foreground shadow-sm"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.76))",
                borderColor: "rgba(15,23,42,0.08)",
                boxShadow:
                  "0 10px 24px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.84)",
              }}
            >
              <span className="font-semibold text-foreground">Owner read:</span>{" "}
              {ownerRead}
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <SectionPanel
            title="Margin Pressure Watch"
            subtitle="Cost increases that may require pricing, portion, vendor, or feature review."
            tone="pressure"
            icon={TrendingUp}
            count={pressureItems.length}
          >
            {pressureItems.length === 0 ? (
              <EmptyState
                title="No active cost pressure"
                message="No current Cost Movement rows are showing vendor cost increases yet."
                icon={<TrendingUp className="h-5 w-5" />}
              />
            ) : (
              pressureItems.map((item) => (
                <MovementCard key={item.id} item={item} compact />
              ))
            )}
          </SectionPanel>

          <SectionPanel
            title="Cost Relief / Opportunity"
            subtitle="Cost decreases that may support margin recovery, features, or vendor benchmarks."
            tone="relief"
            icon={TrendingDown}
            count={reliefItems.length}
          >
            {reliefItems.length === 0 ? (
              <EmptyState
                title="No active cost relief"
                message="Cost decreases will appear here once approved receipt signals create Cost Movement rows."
                icon={<TrendingDown className="h-5 w-5" />}
              />
            ) : (
              reliefItems.map((item) => (
                <MovementCard key={item.id} item={item} compact />
              ))
            )}
          </SectionPanel>
        </section>

        <section
          className="relative overflow-hidden rounded-3xl border p-4 shadow-sm"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))",
            borderColor: "rgba(15,23,42,0.08)",
            boxShadow:
              "0 10px 24px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.82)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-1"
            style={{ background: "rgba(34,211,238,0.14)" }}
          />

          <div
            className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full blur-3xl"
            style={{ background: "rgba(34,211,238,0.045)" }}
          />

          <div className="relative z-10 mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-2xl border shadow-sm"
                  style={{
                    color: "#0891B2",
                    background: "rgba(34,211,238,0.08)",
                    borderColor: "rgba(34,211,238,0.14)",
                  }}
                >
                  <CircleDollarSign className="h-4 w-4" />
                </span>

                <h3 className="text-xl font-heading font-semibold tracking-tight">
                  Active Cost Movement Log
                </h3>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Latest active cost movements from approved receipt signals.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search item or vendor"
                  className="h-10 w-full rounded-full border bg-white/80 pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-cyan-200 sm:w-64"
                  style={{ borderColor: "rgba(15,23,42,0.10)" }}
                />
              </div>

              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="h-10 rounded-full border bg-white/80 px-3 text-sm outline-none transition focus:ring-2 focus:ring-cyan-200"
                style={{ borderColor: "rgba(15,23,42,0.10)" }}
              >
                <option value="active">All active</option>
                <option value="pressure">Cost pressure</option>
                <option value="relief">Cost relief</option>
                <option value="high">High / Medium priority</option>
              </select>
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <EmptyState
              title="No matching cost movement"
              message="Try another filter or track more receipt cost signals from Receipt Intake."
              icon={<LineChart className="h-5 w-5" />}
            />
          ) : (
            <div className="relative z-10 grid gap-3 xl:grid-cols-2">
              {filteredRecords.map((item) => (
                <MovementCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
