import { useRecords, q } from "@/lib/datasource";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Eye,
  RefreshCcw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const select = q.select({
  item: "Item",
  movementType: "Movement Type",
  movementCategory: "Movement Category (Static)",
  impactLevel: "Impact Level",
  currentQty: "Current Qty",
  previousQty: "Previous Qty",
  currentRevenue: "Current Revenue",
  previousRevenue: "Previous Revenue",
  qtyChange: "Qty Change",
  revenueChange: "Revenue Change",
  currentRun: "Current Run ID",
  previousRun: "Previous Run ID",
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

function movementType(item) {
  return fieldText(item?.fields?.movementType);
}

function movementCategory(item) {
  return fieldText(item?.fields?.movementCategory);
}

function getTone(kind) {
  const k = String(kind || "").toLowerCase();

  if (
    k.includes("risk") ||
    k.includes("watch") ||
    k.includes("declin") ||
    k.includes("low") ||
    k.includes("dropped")
  ) {
    return {
      label: "Watch",
      color: "#2563EB",
      bg: "rgba(59,130,246,0.08)",
      border: "rgba(59,130,246,0.14)",
      glow: "rgba(59,130,246,0.045)",
      icon: Eye,
    };
  }

  if (
    k.includes("opportunity") ||
    k.includes("lean") ||
    k.includes("rising") ||
    k.includes("top")
  ) {
    return {
      label: "Lean in",
      color: "#0891B2",
      bg: "rgba(34,211,238,0.08)",
      border: "rgba(34,211,238,0.14)",
      glow: "rgba(34,211,238,0.045)",
      icon: TrendingUp,
    };
  }

  if (k.includes("recover") || k.includes("confirm")) {
    return {
      label: "Confirm",
      color: "#0F766E",
      bg: "rgba(20,184,166,0.07)",
      border: "rgba(20,184,166,0.13)",
      glow: "rgba(20,184,166,0.04)",
      icon: RefreshCcw,
    };
  }

  return {
    label: "Signal",
    color: "#64748B",
    bg: "rgba(100,116,139,0.07)",
    border: "rgba(100,116,139,0.12)",
    glow: "rgba(100,116,139,0.035)",
    icon: Activity,
  };
}

function getTopMover(items) {
  let best = null;
  let bestScore = -Infinity;

  for (const item of items) {
    const fields = item.fields || {};
    const qtyChange = Math.abs(fieldNumber(fields.qtyChange));
    const revenueChange = Math.abs(fieldNumber(fields.revenueChange));
    const score = qtyChange * 1000 + revenueChange;

    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }

  return best;
}

function getManagerRead({ riskCount, opportunityCount, recoveryCount }) {
  if (riskCount > opportunityCount) {
    return "This run has more watch signals than clean opportunities. Start with the watch lane, then confirm whether the shift context explains the movement before changing the plan.";
  }

  if (opportunityCount > riskCount) {
    return "This run is showing more usable momentum than risk. Lean in where the signal is clean, but keep the read tied to today’s actual service pattern.";
  }

  if (recoveryCount > 0) {
    return "This run is balanced. Recovery signals are present, but they should be treated as confirmation points before being called a trend.";
  }

  return "Use this as a movement scan, not a menu rewrite. The goal is to see what changed, what deserves attention, and what is safe to keep watching.";
}

function SignalPill({ children, tone = "neutral", icon }) {
  const meta = getTone(tone);
  const Icon = icon || meta.icon;

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm"
      style={{
        color: meta.color,
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
        borderColor: meta.border,
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function ContextCard({ label, value, helper, tone = "neutral", icon }) {
  const meta = getTone(tone);
  const Icon = icon || meta.icon;

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
        style={{ background: meta.border }}
      />

      <div
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
        style={{ background: meta.glow }}
      />

      <div className="relative z-10 mb-3 flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
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

      <div className="relative z-10 text-lg font-semibold leading-tight text-foreground">
        {value}
      </div>

      <div className="relative z-10 mt-1 text-xs leading-relaxed text-muted-foreground">
        {helper}
      </div>
    </div>
  );
}

export default function Block() {
  const { data, status } = useRecords({
    select,
    where: q.boolean("isLatest").is(true),
    orderBy: q.desc("currentQty"),
    count: 100,
  });

  if (status === "pending") {
    return (
      <div className="container py-4">
        <div className="content">
          <section
            className="rounded-3xl border p-5 shadow-sm"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.97), rgba(248,250,252,0.82))",
              borderColor: "rgba(15,23,42,0.08)",
            }}
          >
            <div className="text-sm text-muted-foreground">
              Loading movement context...
            </div>
          </section>
        </div>
      </div>
    );
  }

  const items = data?.pages.flatMap((page) => page.items) || [];

  if (items.length === 0) {
    return (
      <div className="container py-4">
        <div className="content">
          <section
            className="rounded-3xl border p-5 shadow-sm"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.97), rgba(248,250,252,0.82))",
              borderColor: "rgba(15,23,42,0.08)",
            }}
          >
            <div className="text-sm text-muted-foreground">
              No latest movement context found.
            </div>
          </section>
        </div>
      </div>
    );
  }

  const currentRunLabel = "Latest Dinner Service";
  const previousRunLabel = "Previous Dinner Service";
  const comparisonLabel = "Dinner service comparison";

  const riskItems = items.filter((item) => {
    const type = movementType(item).toLowerCase();
    const category = movementCategory(item).toLowerCase();

    return (
      category.includes("risk") ||
      type.includes("low") ||
      type.includes("dropped") ||
      type.includes("declining")
    );
  });

  const opportunityItems = items.filter((item) => {
    const type = movementType(item).toLowerCase();
    const category = movementCategory(item).toLowerCase();

    return (
      category.includes("opportunity") ||
      type.includes("rising") ||
      type.includes("top")
    );
  });

  const recoveryItems = items.filter((item) => {
    const type = movementType(item).toLowerCase();
    return type.includes("recover");
  });

  const topMover = getTopMover(items);
  const topMoverName = fieldText(topMover?.fields?.item) || "No standout mover";

  const managerRead = getManagerRead({
    riskCount: riskItems.length,
    opportunityCount: opportunityItems.length,
    recoveryCount: recoveryItems.length,
  });

  const netRead =
    riskItems.length > opportunityItems.length
      ? "Watch-heavy run"
      : opportunityItems.length > riskItems.length
        ? "Momentum-favored run"
        : "Balanced movement read";

  return (
    <div className="container py-4">
      <div className="content">
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
                  Comparison context
                </div>

                <h2 className="text-2xl font-heading font-semibold tracking-tight text-foreground">
                  How to Read This Run
                </h2>

                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Movement is most useful when the comparison is fair. This view compares the latest service against the previous comparable run, then separates watch signals from usable momentum.
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
                <Circle
                  className="h-2 w-2 fill-current"
                  style={{ color: "#22D3EE" }}
                />
                {comparisonLabel}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <ContextCard
                label="Current view"
                value={currentRunLabel}
                helper="Current dinner run being evaluated"
                tone="confirm"
                icon={Activity}
              />

              <ContextCard
                label="Baseline"
                value={previousRunLabel}
                helper="Previous dinner run used for comparison"
                tone="neutral"
                icon={RefreshCcw}
              />

              <ContextCard
                label="Primary mover"
                value={topMoverName}
                helper="Largest quantity or revenue movement in this comparison"
                tone="lean"
                icon={Target}
              />

              <ContextCard
                label="Signal mix"
                value={`${riskItems.length} watch / ${opportunityItems.length} lean`}
                helper={`${recoveryItems.length} recovery-watch signal${
                  recoveryItems.length === 1 ? "" : "s"
                } also present`}
                tone={riskItems.length > opportunityItems.length ? "watch" : "lean"}
                icon={
                  riskItems.length > opportunityItems.length
                    ? TrendingDown
                    : TrendingUp
                }
              />
            </div>

            <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1.35fr_0.65fr]">
              <div
  className="relative self-start overflow-hidden rounded-2xl border p-4 shadow-md"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.76))",
                  borderColor: "rgba(15,23,42,0.08)",
                  boxShadow:
                    "0 10px 24px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.84)",
                }}
              >
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl"
                  style={{ background: "rgba(148,163,184,0.07)" }}
                />

                <div className="relative z-10 mb-2 flex items-center gap-2">
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border"
                    style={{
                      color: "#0891B2",
                      background: "rgba(34,211,238,0.12)",
                      borderColor: "rgba(34,211,238,0.20)",
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </span>

                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Manager read
                    </div>
                    <div className="text-base font-semibold text-foreground">
                      {netRead}
                    </div>
                  </div>
                </div>

                <p className="relative z-10 text-sm leading-relaxed text-muted-foreground">
                  {managerRead}
                </p>
              </div>

              <div
                className="rounded-2xl border p-4 shadow-sm"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
                  borderColor: "rgba(15,23,42,0.08)",
                  boxShadow:
                    "0 12px 28px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.78)",
                }}
              >
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Signal lanes
                </div>

                <div className="flex flex-wrap gap-2">
                  <SignalPill tone="watch" icon={Eye}>
                    {riskItems.length} watch closely
                  </SignalPill>

                  <SignalPill tone="lean" icon={ArrowUpRight}>
                    {opportunityItems.length} lean into
                  </SignalPill>

                  <SignalPill tone="recover" icon={CheckCircle2}>
                    {recoveryItems.length} recovery watch
                  </SignalPill>
                </div>

                <div
                  className="mt-4 rounded-xl border px-3 py-2 text-xs leading-relaxed text-muted-foreground"
                  style={{
                    background:
                      "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
                    borderColor: "rgba(15,23,42,0.08)",
                  }}
                >
                  Treat this as a clean read of movement, not a panic meter. The next cards show which items deserve confirmation, support, or patience.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
