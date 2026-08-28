import { useRecords, q } from "@/lib/datasource";
import {
  Activity,
  ArrowUpRight,
  Circle,
  Eye,
  RefreshCcw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const select = q.select({
  item: "Item",
  movementType: "Movement Type",
  impactLevel: "Impact Level",
  currentQty: "Current Qty",
  previousQty: "Previous Qty",
  currentRevenue: "Current Revenue",
  previousRevenue: "Previous Revenue",
  qtyChange: "Qty Change",
  revenueChange: "Revenue Change",
  movementCategory: "Movement Category (Static)",
  notes: "Notes",
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

function formatCurrency(value) {
  const num = fieldNumber(value);
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatChange(value) {
  const num = fieldNumber(value);
  if (num === 0) return "0";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toLocaleString()}`;
}

function movementType(item) {
  return fieldText(item?.fields?.movementType);
}

function movementCategory(item) {
  return fieldText(item?.fields?.movementCategory) || "Neutral";
}

function getCategoryTone(category, type) {
  const c = String(category || "").toLowerCase();
  const t = String(type || "").toLowerCase();

  if (
    c.includes("risk") ||
    t.includes("low") ||
    t.includes("dropped") ||
    t.includes("declining")
  ) {
    return {
      label: "Watch",
      color: "#2563EB",
      bg: "rgba(59,130,246,0.10)",
      border: "rgba(59,130,246,0.22)",
      glow: "rgba(59,130,246,0.13)",
      icon: Eye,
    };
  }

  if (c.includes("opportunity") || t.includes("top") || t.includes("rising")) {
    return {
      label: "Lean in",
      color: "#0891B2",
      bg: "rgba(34,211,238,0.10)",
      border: "rgba(34,211,238,0.22)",
      glow: "rgba(34,211,238,0.13)",
      icon: TrendingUp,
    };
  }

  if (t.includes("recover") || t.includes("stable")) {
    return {
      label: "Confirm",
      color: "#0F766E",
      bg: "rgba(20,184,166,0.09)",
      border: "rgba(20,184,166,0.20)",
      glow: "rgba(20,184,166,0.12)",
      icon: RefreshCcw,
    };
  }

  return {
    label: "Monitor",
    color: "#64748B",
    bg: "rgba(100,116,139,0.09)",
    border: "rgba(100,116,139,0.18)",
    glow: "rgba(100,116,139,0.10)",
    icon: Activity,
  };
}

function getDeltaColor(value) {
  const num = fieldNumber(value);

  if (num > 0) return "#0891B2";
  if (num < 0) return "#2563EB";
  return "#64748B";
}

function getInterpretation(type, currentQty, qtyChange, revenueChange) {
  if (type === "Dropped from Top") {
    return "Previously strong, now missing from the top list.";
  }

  if (type === "Dropped to Low") {
    return "Moved into low-seller territory and needs a closer look.";
  }

  if (type === "New Low") {
    if (currentQty > 0 && qtyChange > 0) {
      return "Entered the low list despite some movement. Confirm before reacting.";
    }

    return "New low-seller signal this run.";
  }

  if (type === "Declining") {
    return "Momentum is softening compared with the previous run.";
  }

  if (type === "Rising") {
    return "Demand is gaining traction.";
  }

  if (type === "New Top") {
    return "Breakout item entering the top-seller group.";
  }

  if (type === "Recovered") {
    if (currentQty <= 0 || qtyChange < 0 || revenueChange < 0) {
      return "Recovery label needs confirmation. Numbers are still soft.";
    }

    return "Recovered from prior weakness with usable movement.";
  }

  if (type === "Recovered to Top") {
    return "Strong recovery back into top-seller territory.";
  }

  if (type === "Stable") {
    return "Performance is holding steady.";
  }

  return "Movement detected this run.";
}

function getGuidance(type, category, currentQty, qtyChange, revenueChange) {
  const c = String(category || "").toLowerCase();

  if (c.includes("risk")) {
    if (currentQty > 0 && qtyChange > 0) {
      return "Watch next run before making a move.";
    }

    return "Check whether this repeats before service planning changes.";
  }

  if (c.includes("opportunity")) {
    if (type === "New Top") return "Feature lightly while momentum is hot.";
    if (type === "Rising") return "Protect prep and visibility.";
    return "Lean in only if tonight’s service supports it.";
  }

  if (type.includes("Recovered")) {
    return "Confirm it holds before pushing harder.";
  }

  return "Monitor only.";
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
  const type = movementType(item);
  const category = movementCategory(item).toLowerCase();

  const currentQty = fieldNumber(fields.currentQty);
  const qtyChange = fieldNumber(fields.qtyChange);
  const revenueChange = fieldNumber(fields.revenueChange);

  if (
    (type === "New Top" || type === "Rising" || type === "Recovered to Top") &&
    currentQty > 0
  ) {
    return 100;
  }

  if (type === "Recovered" && qtyChange >= 0 && revenueChange >= 0) return 80;

  if (
    category.includes("risk") &&
    (currentQty <= 0 || qtyChange < 0 || revenueChange < 0)
  ) {
    return 90;
  }

  if (type === "New Low" && currentQty > 0 && qtyChange > 0 && revenueChange > 0) {
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

function SignalPill({ children, tone, icon }) {
  const Icon = icon || tone.icon;

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
      style={{
        color: tone.color,
        background: tone.bg,
        borderColor: tone.border,
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function MovementRow({ item }) {
  const fields = item.fields || {};
  const type = movementType(item);
  const category = movementCategory(item);
  const tone = getCategoryTone(category, type);
  const ToneIcon = tone.icon;

  const currentQty = fieldNumber(fields.currentQty);
  const previousQty = fieldNumber(fields.previousQty);
  const currentRevenue = fieldNumber(fields.currentRevenue);
  const previousRevenue = fieldNumber(fields.previousRevenue);
  const qtyChange = fieldNumber(fields.qtyChange);
  const revenueChange = fieldNumber(fields.revenueChange);

  const interpretation = getInterpretation(type, currentQty, qtyChange, revenueChange);
  const guidance = getGuidance(type, category, currentQty, qtyChange, revenueChange);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:shadow-md"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.97), rgba(248,250,252,0.76))",
        borderColor: tone.border,
        boxShadow:
          "0 10px 24px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.78)",
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

      <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold leading-tight text-foreground">
              {fieldText(fields.item)}
            </h3>

            <span
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
              style={{
                color: tone.color,
                background: tone.bg,
                borderColor: tone.border,
              }}
            >
              <ToneIcon className="h-3.5 w-3.5" />
              {type || tone.label}
            </span>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {interpretation}
          </p>

          <p className="mt-2 text-xs font-medium text-muted-foreground">
            {guidance}
          </p>
        </div>

        <div
          className="grid min-w-[220px] grid-cols-2 gap-3 rounded-xl border p-3 text-sm shadow-sm"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.72))",
            borderColor: "rgba(15,23,42,0.08)",
          }}
        >
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Qty
            </div>
            <div className="mt-1 font-semibold text-foreground">{currentQty}</div>
            <div
              className="text-xs"
              style={{ color: getDeltaColor(qtyChange) }}
            >
              {formatChange(qtyChange)} vs {previousQty}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Revenue
            </div>
            <div className="mt-1 font-semibold text-foreground">
              {formatCurrency(currentRevenue)}
            </div>
            <div
              className="text-xs"
              style={{ color: getDeltaColor(revenueChange) }}
            >
              {formatChange(revenueChange)} vs {formatCurrency(previousRevenue)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Block() {
  const { data, status } = useRecords({
    select,
    where: q.boolean("isLatest").is(true),
    orderBy: q.desc("currentQty"),
    count: 12,
  });

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
            Loading movement deep dive...
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="container py-8">
        <div className="content">
          <div className="rounded-3xl border bg-background p-6 text-sm text-destructive shadow-sm">
            Error loading movement deep dive.
          </div>
        </div>
      </div>
    );
  }

  const rawItems = data?.pages.flatMap((page) => page.items) || [];
  const items = dedupeMovementItems(rawItems);

  if (items.length === 0) {
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
            No additional movement records available.
          </div>
        </div>
      </div>
    );
  }

  const riskCount = items.filter((item) =>
    movementCategory(item).toLowerCase().includes("risk")
  ).length;

  const opportunityCount = items.filter((item) =>
    movementCategory(item).toLowerCase().includes("opportunity")
  ).length;

  const riskTone = getCategoryTone("risk", "");
  const opportunityTone = getCategoryTone("opportunity", "");
  const shownTone = getCategoryTone("neutral", "");

  return (
    <div className="container py-6">
      <div className="content">
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
                  Movement deep dive
                </div>

                <h2 className="text-2xl font-heading font-semibold tracking-tight">
                  Explore the Rest of the Run
                </h2>

                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Secondary movement signals for managers who want to dig deeper after the main briefing.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <SignalPill tone={riskTone} icon={Eye}>
                  {riskCount} watch
                </SignalPill>

                <SignalPill tone={opportunityTone} icon={ArrowUpRight}>
                  {opportunityCount} lean in
                </SignalPill>

                <SignalPill tone={shownTone} icon={Search}>
                  {items.length} shown
                </SignalPill>
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <MovementRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
