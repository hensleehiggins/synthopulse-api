import { useRecords, q } from "@/lib/datasource";
import {
  ArrowUpRight,
  CheckCircle2,
  Circle,
  RefreshCcw,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

const DISPLAY_LIMIT = 3;

const select = q.select({
  item: "Item",
  movementType: "Movement Type",
  movementCategory: "Movement Category (Static)",
  impactLevel: "Impact Level",
  movementInsight: "Movement Insight",
  currentQty: "Current Qty",
  previousQty: "Previous Qty",
  currentRevenue: "Current Revenue",
  previousRevenue: "Previous Revenue",
  qtyChange: "Qty Change",
  revenueChange: "Revenue Change",
  isLatest: "Is Latest Movement",
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
    if ("foreignRowDisplayName" in value) {
      return String(value.foreignRowDisplayName);
    }
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

function movementLabel(item) {
  return fieldText(item?.fields?.movementType);
}

function formatCurrency(value) {
  const num = fieldNumber(value);
  return `$${num.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

function formatNumber(value) {
  return fieldNumber(value).toLocaleString();
}

function formatChange(value) {
  const num = fieldNumber(value);
  if (num === 0) return "0";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toLocaleString()}`;
}

function getRevenuePerItem(currentRevenue, currentQty) {
  if (!currentQty || currentQty <= 0) return 0;
  return currentRevenue / currentQty;
}

function normalizeItemKey(value) {
  return fieldText(value)
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function movementPriority(item) {
  const fields = item.fields || {};
  const type = movementLabel(item);
  const category = fieldText(fields.movementCategory).toLowerCase();

  const currentQty = fieldNumber(fields.currentQty);
  const qtyChange = fieldNumber(fields.qtyChange);
  const revenueChange = fieldNumber(fields.revenueChange);

  if (
    (type.includes("New Top") ||
      type.includes("Rising") ||
      type.includes("Recovered to Top")) &&
    currentQty > 0
  ) {
    return 100;
  }

  if (type.includes("Recovered") && qtyChange >= 0 && revenueChange >= 0) {
    return 80;
  }

  if (
    category.includes("risk") &&
    (currentQty <= 0 || qtyChange < 0 || revenueChange < 0)
  ) {
    return 90;
  }

  if (
    type.includes("New Low") &&
    currentQty > 0 &&
    qtyChange > 0 &&
    revenueChange > 0
  ) {
    return 20;
  }

  if (category.includes("opportunity")) return 70;
  if (category.includes("risk")) return 60;

  return 10;
}

function dedupeMovementItems(items) {
  const byItem = new Map();

  for (const item of items) {
    const key = normalizeItemKey(item?.fields?.item);
    if (!key) continue;

    const existing = byItem.get(key);

    if (!existing || movementPriority(item) > movementPriority(existing)) {
      byItem.set(key, item);
    }
  }

  return Array.from(byItem.values());
}

function getDisplayedBadge(item, section) {
  const type = movementLabel(item);

  if (section === "risk") {
    if (type.includes("Dropped from Top")) return "Former Top Seller";
    if (type.includes("Dropped to Low")) return "Dropped to Low";
    if (type.includes("New Low")) return "New Low";
    return type || "Needs Review";
  }

  if (section === "opportunity") {
    if (type.includes("New Top")) return "New Top";
    if (type.includes("Recovered to Top")) return "Back in Top";
    if (type.includes("Rising")) return "Rising";
    if (type.includes("Recovered")) return "Strong Recovery";
    return type || "Momentum";
  }

  if (section === "neutral") {
    if (type.includes("Recovered")) return "Early Recovery";
    return type || "Recovery Watch";
  }

  return type;
}

function getToneMeta(section) {
  if (section === "risk") {
    return {
      color: "#2563EB",
      bg: "rgba(59,130,246,0.08)",
      border: "rgba(59,130,246,0.14)",
      soft: "rgba(59,130,246,0.045)",
      glow: "rgba(59,130,246,0.045)",
      label: "Confirm",
      icon: Search,
    };
  }

  if (section === "opportunity") {
    return {
      color: "#0891B2",
      bg: "rgba(34,211,238,0.08)",
      border: "rgba(34,211,238,0.14)",
      soft: "rgba(34,211,238,0.045)",
      glow: "rgba(34,211,238,0.045)",
      label: "Lean in",
      icon: TrendingUp,
    };
  }

  return {
    color: "#0F766E",
    bg: "rgba(20,184,166,0.07)",
    border: "rgba(20,184,166,0.13)",
    soft: "rgba(20,184,166,0.04)",
    glow: "rgba(20,184,166,0.04)",
    label: "Recovery",
    icon: RefreshCcw,
  };
}

function getBadgeStyle(text, section) {
  const lower = String(text || "").toLowerCase();

  if (
    lower.includes("former") ||
    lower.includes("confirm") ||
    lower.includes("review") ||
    lower.includes("low") ||
    lower.includes("dropped") ||
    lower.includes("attention")
  ) {
    return {
      color: "#2563EB",
      bg: "rgba(59,130,246,0.08)",
      border: "rgba(59,130,246,0.14)",
    };
  }

  if (
    lower.includes("top") ||
    lower.includes("rising") ||
    lower.includes("traction") ||
    lower.includes("opportunity") ||
    lower.includes("momentum") ||
    lower.includes("strong")
  ) {
    return {
      color: "#0891B2",
      bg: "rgba(34,211,238,0.08)",
      border: "rgba(34,211,238,0.14)",
    };
  }

  if (
    lower.includes("recover") ||
    lower.includes("stabil") ||
    lower.includes("early")
  ) {
    return {
      color: "#0F766E",
      bg: "rgba(20,184,166,0.07)",
      border: "rgba(20,184,166,0.13)",
    };
  }

  return getToneMeta(section);
}

function getOperatorLine(item, section) {
  const fields = item.fields || {};
  const type = movementLabel(item);
  const currentQty = fieldNumber(fields.currentQty);
  const previousQty = fieldNumber(fields.previousQty);
  const currentRevenue = fieldNumber(fields.currentRevenue);
  const qtyChange = fieldNumber(fields.qtyChange);
  const revenueChange = fieldNumber(fields.revenueChange);
  const revenuePerItem = getRevenuePerItem(currentRevenue, currentQty);

  const qtyImproved = qtyChange > 0;
  const qtyFlat = qtyChange === 0;
  const qtyDown = qtyChange < 0;
  const revenueImproved = revenueChange > 0;
  const revenueDown = revenueChange < 0;
  const smallLift = qtyChange > 0 && qtyChange <= 2;
  const solidLift = qtyChange >= 3;
  const strongLift = qtyChange >= 5 || revenueChange >= 100;
  const meaningfulRevenue = currentRevenue >= 100;
  const highTicketSignal = revenuePerItem >= 35;

  if (section === "risk") {
    if (type.includes("Dropped from Top") && strongLift && meaningfulRevenue) {
      return "Sales bounced back, but not enough to reclaim top-seller status. Confirm whether this is normal mix or reduced visibility.";
    }

    if (type.includes("Dropped from Top") && solidLift) {
      return "Improved from last service, but still slipped out of the top group. Watch whether it regains traction next run.";
    }

    if (type.includes("Dropped from Top") && smallLift) {
      return "Slight lift from last service, but still below its former top-seller position. Treat this as a one-run wobble unless it repeats.";
    }

    if (type.includes("Dropped from Top") && qtyDown) {
      return "Former top seller lost ground this run. Check server confidence, menu placement, or whether demand shifted elsewhere.";
    }

    if (type.includes("Dropped from Top") && highTicketSignal) {
      return "Revenue is still meaningful, but the item did not hold top-seller position. Check whether check quality is masking softer demand.";
    }

    if (type.includes("Dropped from Top")) {
      return "Former top seller did not hold its position this run. Confirm whether this is normal service mix or a real visibility issue.";
    }

    if (type.includes("Dropped to Low")) {
      return "A former stronger performer fell into low-seller territory. Review availability, execution, and server confidence before next service.";
    }

    if (type.includes("New Low") && qtyImproved && revenueImproved) {
      return "Sales improved, but the item still landed near the bottom. Treat this as mixed, not broken, and confirm whether it repeats.";
    }

    if (type.includes("New Low") && currentQty <= 1) {
      return "Very little movement this service. Check availability, placement, or whether this item should influence guidance.";
    }

    if (type.includes("New Low")) {
      return "New low-seller signal. Watch one more comparable service before making a bigger menu or promotion call.";
    }

    if (revenueDown || qtyDown) {
      return "Movement softened this run. Confirm whether this is normal service noise or the start of a real demand issue.";
    }

    return "Mixed movement signal. Confirm the story before acting so the team does not overreact to one service.";
  }

  if (section === "opportunity") {
    if (type.includes("New Top") && strongLift) {
      return "Strong breakout into the top group. Feature it while momentum is hot and make sure prep can support demand.";
    }

    if (type.includes("New Top")) {
      return "Fresh top-seller signal. Keep execution tight and give it visibility while the trend is forming.";
    }

    if (type.includes("Recovered to Top")) {
      return "Recovered all the way back into the top group. Support it tonight, but verify it holds next run.";
    }

    if (type.includes("Rising") && strongLift) {
      return "Demand is building with a real lift. Protect stock, prep, and server confidence so the momentum holds.";
    }

    if (type.includes("Rising") && revenueImproved && !qtyImproved) {
      return "Revenue improved faster than quantity, which may point to better check quality or sales mix. Worth watching closely.";
    }

    if (type.includes("Rising")) {
      return "Positive movement is forming. Lean in if tonight’s service, prep, and floor team can support it.";
    }

    if (type.includes("Recovered") && strongLift) {
      return "Recovery looks strong enough to support. Give it visibility, but avoid over-pushing until it proves consistency.";
    }

    if (type.includes("Recovered") && meaningfulRevenue) {
      return "Revenue came back with enough weight to matter. Support it lightly and confirm the rebound next service.";
    }

    return "Clean positive movement signal. Worth leaning into if it fits tonight’s service plan.";
  }

  if (section === "neutral") {
    if (currentQty <= 0 || qtyDown || revenueDown) {
      return "Recovery label is noisy here. Treat this as a watch item, not a confirmed rebound.";
    }

    if (smallLift && currentRevenue < 75) {
      return "Early rebound, but still thin. Let it prove itself one more run before actively pushing it.";
    }

    if (smallLift) {
      return "Improved slightly from a weak spot. Keep an eye on it, but do not change the play yet.";
    }

    if (solidLift && meaningfulRevenue) {
      return "Recovery is forming with useful movement. Confirm one more comparable run before promoting it harder.";
    }

    if (revenueImproved && !qtyImproved) {
      return "Revenue improved more than count, so mix or check quality may be helping. Watch for another proof point.";
    }

    if (currentQty > previousQty) {
      return "Performance is moving the right direction. Monitor one more run before treating it as real momentum.";
    }

    if (qtyFlat) {
      return "Stable after a weak spot. Not a push signal yet, but worth keeping on the radar.";
    }

    return "Recovery signal is present, but not strong enough to act on yet. Confirm before pushing.";
  }

  return "Movement signal surfaced this run. Review before changing the play.";
}

function MovementMiniCard({ item, section }) {
  const fields = item.fields || {};
  const currentQty = fieldNumber(fields.currentQty);
  const previousQty = fieldNumber(fields.previousQty);
  const currentRevenue = fieldNumber(fields.currentRevenue);
  const qtyChange = fieldNumber(fields.qtyChange);
  const revenueChange = fieldNumber(fields.revenueChange);
  const displayedBadge = getDisplayedBadge(item, section);
  const meta = getToneMeta(section);
  const badgeStyle = getBadgeStyle(displayedBadge, section);

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
        style={{ background: meta.color }}
      />

      <div
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
        style={{ background: meta.glow }}
      />

      <div className="relative z-10 mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold leading-tight text-foreground">
            {fieldText(fields.item)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {currentQty} sold vs {previousQty} last service
          </div>
        </div>

        <span
          className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
          style={{
            color: badgeStyle.color,
            background: badgeStyle.bg,
            borderColor: badgeStyle.border,
          }}
        >
          {displayedBadge || meta.label}
        </span>
      </div>

      <p className="relative z-10 mb-4 text-sm leading-relaxed text-muted-foreground">
        {getOperatorLine(item, section)}
      </p>

      <div className="relative z-10 grid grid-cols-2 gap-3 border-t border-slate-200/70 pt-3 text-sm">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Quantity
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-semibold text-foreground">
              {formatNumber(currentQty)}
            </span>
            <span
              className={
                qtyChange < 0
                  ? "text-xs text-slate-500"
                  : qtyChange > 0
                    ? "text-xs text-cyan-700"
                    : "text-xs text-muted-foreground"
              }
            >
              {formatChange(qtyChange)}
            </span>
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Revenue
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-semibold text-foreground">
              {formatCurrency(currentRevenue)}
            </span>
            <span
              className={
                revenueChange < 0
                  ? "text-xs text-slate-500"
                  : revenueChange > 0
                    ? "text-xs text-cyan-700"
                    : "text-xs text-muted-foreground"
              }
            >
              {formatChange(revenueChange)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChangeSummaryPanel({ items, section, totalCount }) {
  const meta = getToneMeta(section);

  const totalQtyChange = items.reduce((sum, item) => {
    return sum + fieldNumber(item?.fields?.qtyChange);
  }, 0);

  const totalRevenueChange = items.reduce((sum, item) => {
    return sum + fieldNumber(item?.fields?.revenueChange);
  }, 0);

  let biggestChangeItem = null;
  let biggestChangeScore = -Infinity;

  for (const item of items) {
    const fields = item.fields || {};
    const qtyScore = Math.abs(fieldNumber(fields.qtyChange)) * 1000;
    const revenueScore = Math.abs(fieldNumber(fields.revenueChange));
    const score = qtyScore + revenueScore;

    if (score > biggestChangeScore) {
      biggestChangeItem = item;
      biggestChangeScore = score;
    }
  }

  const biggestChangeName =
    fieldText(biggestChangeItem?.fields?.item) || "No standout change";

  const helper =
    section === "risk"
      ? "These are the visible changes behind this confirmation lane. Verify the story before the team reacts."
      : "These are the visible changes behind this momentum lane. Support the signal if tonight’s service can handle it.";

  return (
    <div
      className="relative overflow-hidden rounded-2xl border px-4 py-3 shadow-sm"
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
        style={{ background: meta.color }}
      />

      <div
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
        style={{ background: meta.glow }}
      />

      <div className="relative z-10 mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Changed this run
          </div>
          <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {helper}
          </div>
        </div>

        <span
          className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
          style={{
            color: meta.color,
            background: meta.bg,
            borderColor: meta.border,
          }}
        >
          {items.length} shown / {totalCount} total
        </span>
      </div>

      <div className="relative z-10 grid gap-3 md:grid-cols-3">
        <div
          className="rounded-xl border px-3 py-2"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
            borderColor: meta.border,
          }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Qty change
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground">
            {formatChange(totalQtyChange)}
          </div>
        </div>

        <div
          className="rounded-xl border px-3 py-2"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
            borderColor: meta.border,
          }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Revenue change
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground">
            {formatCurrency(totalRevenueChange)}
          </div>
        </div>

        <div
          className="rounded-xl border px-3 py-2"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
            borderColor: meta.border,
          }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Main mover
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-foreground">
            {biggestChangeName}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionPanel({
  title,
  subtitle,
  items,
  section,
  emptyText,
  totalCount,
}) {
  const meta = getToneMeta(section);
  const Icon = meta.icon;
  const hiddenCount = Math.max(totalCount - items.length, 0);

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
        style={{ background: meta.border }}
      />

      <div
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl"
        style={{ background: meta.glow }}
      />

      <div className="relative z-10 mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-2xl border shadow-sm"
              style={{
                color: meta.color,
                background: meta.bg,
                borderColor: meta.border,
              }}
            >
              <Icon className="h-4 w-4" />
            </div>

            <h2 className="text-xl font-heading font-semibold tracking-tight">
              {title}
            </h2>
          </div>

          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        </div>

        <span
          className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
          style={{
            color: meta.color,
            background: meta.bg,
            borderColor: meta.border,
          }}
        >
          {totalCount}
        </span>
      </div>

      {items.length === 0 ? (
        <div
          className="relative z-10 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.90), rgba(248,250,252,0.70))",
            borderColor: "rgba(15,23,42,0.10)",
          }}
        >
          {emptyText}
        </div>
      ) : (
        <div className="relative z-10 space-y-3">
          {items.map((item) => (
            <MovementMiniCard key={item.id} item={item} section={section} />
          ))}

          {(section === "risk" || section === "opportunity") && (
            <ChangeSummaryPanel
              items={items}
              section={section}
              totalCount={totalCount}
            />
          )}

          {hiddenCount > 0 && (
            <div
              className="flex flex-col gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold sm:flex-row sm:items-center sm:justify-between"
              style={{
                color: meta.color,
                background: meta.bg,
                borderColor: meta.border,
              }}
            >
              <span
                className="inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  color: meta.color,
                  background: "rgba(255,255,255,0.72)",
                  borderColor: meta.border,
                }}
              >
                {items.length} shown / {totalCount} total
              </span>

              <span className="text-[11px] font-medium">
                Use this lane as the first-pass scan.
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SummaryPill({ label, value, section, icon }) {
  const meta = getToneMeta(section);
  const Icon = icon || meta.icon;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border px-4 py-3 shadow-sm"
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
        style={{ background: meta.border }}
      />

      <div
        className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl"
        style={{ background: meta.glow }}
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
            color: meta.color,
            background: meta.bg,
            borderColor: meta.border,
          }}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function RecoveryQuietStrip() {
  const meta = getToneMeta("neutral");

  return (
    <div
      className="mt-5 rounded-3xl border p-4 shadow-sm"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))",
        borderColor: "rgba(15,23,42,0.08)",
        boxShadow:
          "0 10px 24px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.82)",
      }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border"
            style={{
              color: meta.color,
              background: meta.bg,
              borderColor: meta.border,
            }}
          >
            <CheckCircle2 className="h-4 w-4" />
          </span>

          <div>
            <div className="text-sm font-semibold text-foreground">
              Recovery lane quiet
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              No early recovery signals need attention this run. That is a clean status, not missing data.
            </div>
          </div>
        </div>

        <span
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
          style={{
            color: meta.color,
            background: meta.bg,
            borderColor: meta.border,
          }}
        >
          <Circle className="h-2 w-2 fill-current" />
          No recovery watch
        </span>
      </div>
    </div>
  );
}

function isStrongRecovery(item) {
  const fields = item.fields || {};
  const qtyChange = fieldNumber(fields.qtyChange);
  const revenueChange = fieldNumber(fields.revenueChange);
  const currentRevenue = fieldNumber(fields.currentRevenue);

  return qtyChange >= 5 || revenueChange >= 100 || currentRevenue >= 150;
}

export default function Block() {
  const { data, status } = useRecords({
    select,
    where: q.boolean("isLatest").is(true),
    orderBy: [q.desc("impactLevel"), q.desc("currentQty")],
    count: 50,
  });

  const rawItems = data?.pages.flatMap((p) => p.items) || [];
  const allItems = dedupeMovementItems(rawItems);

  const allRiskItems = allItems.filter((item) => {
    const category = fieldText(item?.fields?.movementCategory).toLowerCase();
    return category.includes("risk");
  });

  const rawOpportunityItems = allItems.filter((item) => {
    const category = fieldText(item?.fields?.movementCategory).toLowerCase();
    const fields = item.fields || {};
    const currentQty = fieldNumber(fields.currentQty);
    const qtyChange = fieldNumber(fields.qtyChange);
    const revenueChange = fieldNumber(fields.revenueChange);

    return (
      category.includes("opportunity") &&
      currentQty > 0 &&
      (qtyChange > 0 || revenueChange > 0)
    );
  });

  const rawRecoveryItems = allItems.filter((item) => {
    const type = movementLabel(item);
    const fields = item.fields || {};
    const currentQty = fieldNumber(fields.currentQty);

    return type.includes("Recovered") && currentQty > 0;
  });

  const allLeanIntoItems = rawOpportunityItems.filter((item) => {
    const type = movementLabel(item);

    if (type.includes("New Top")) return true;
    if (type.includes("Rising")) return true;
    if (type.includes("Recovered to Top")) return true;

    if (type.includes("Recovered")) {
      return isStrongRecovery(item);
    }

    return false;
  });

  const leanIntoIds = new Set(allLeanIntoItems.map((item) => item.id));

  const allRecoveryItems = rawRecoveryItems.filter((item) => !leanIntoIds.has(item.id));

  const riskItems = allRiskItems.slice(0, DISPLAY_LIMIT);
  const leanIntoItems = allLeanIntoItems.slice(0, DISPLAY_LIMIT);
  const recoveryItems = allRecoveryItems.slice(0, DISPLAY_LIMIT);

  const isLoading = status === "pending";

  const topOpportunity =
    fieldText(allLeanIntoItems[0]?.fields?.item) || "No clean opportunity yet";

  const topRisk =
    fieldText(allRiskItems[0]?.fields?.item) || "No mixed signal";

  const hasRecovery = allRecoveryItems.length > 0;

  if (isLoading) {
    return (
      <div className="container py-4">
        <div className="content">
          <div
            className="rounded-3xl border p-5 text-sm text-muted-foreground shadow-sm"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.97), rgba(248,250,252,0.82))",
              borderColor: "rgba(15,23,42,0.08)",
            }}
          >
            Loading latest movement briefing...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="content space-y-6">
        <section
          className="relative overflow-hidden rounded-3xl border p-5 shadow-xl"
          style={{
            background:
              "radial-gradient(circle at 12% 8%, rgba(34,211,238,0.08), transparent 30%), radial-gradient(circle at 82% 12%, rgba(59,130,246,0.06), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(248,250,252,0.94) 55%, rgba(241,245,249,0.86) 100%)",
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
                  Movement briefing
                </div>

                <h2 className="text-2xl font-heading font-semibold tracking-tight">
                  This Run at a Glance
                </h2>

                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  What needs confirmation, what is ready to support, and what is quietly recovering.
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
                <Circle className="h-2 w-2 fill-current" style={{ color: "#22D3EE" }} />
                Latest service window
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <SummaryPill
                label="Needs confirmation"
                value={allRiskItems.length}
                section="risk"
                icon={Search}
              />

              <SummaryPill
                label="Lean into"
                value={allLeanIntoItems.length}
                section="opportunity"
                icon={ArrowUpRight}
              />

              <SummaryPill
                label="Recovery watch"
                value={allRecoveryItems.length}
                section="neutral"
                icon={RefreshCcw}
              />

              <SummaryPill
                label="Top mover"
                value={topOpportunity}
                section="opportunity"
                icon={Target}
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
              <span className="font-semibold text-foreground">Manager read:</span>{" "}
              Start with{" "}
              <span className="font-semibold text-foreground">{topRisk}</span>{" "}
              if you need to verify a mixed signal. Lean into{" "}
              <span className="font-semibold text-foreground">{topOpportunity}</span>{" "}
              if tonight’s service supports it.
            </div>
          </div>
        </section>

        <div className={hasRecovery ? "grid gap-5 xl:grid-cols-3" : "grid gap-5 xl:grid-cols-2"}>
          <SectionPanel
            title="Needs Confirmation"
            subtitle="Mixed movement signals that deserve a quick check before the team reacts."
            section="risk"
            items={riskItems}
            totalCount={allRiskItems.length}
            emptyText="No mixed movement signals need confirmation this run."
          />

          <SectionPanel
            title="Lean Into"
            subtitle="Clean opportunity signals with enough momentum to support tonight."
            section="opportunity"
            items={leanIntoItems}
            totalCount={allLeanIntoItems.length}
            emptyText="No clean momentum signals surfaced this run."
          />

          {hasRecovery && (
            <SectionPanel
              title="Recovery Watch"
              subtitle="Items improving from a weak spot. Confirm one more run before pushing."
              section="neutral"
              items={recoveryItems}
              totalCount={allRecoveryItems.length}
              emptyText="No early recovery signals need watching this run."
            />
          )}
        </div>

        {!hasRecovery && <RecoveryQuietStrip />}
      </div>
    </div>
  );
}
