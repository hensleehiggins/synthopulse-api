import { useRecords, q } from "@/lib/datasource";
import { useTextSetting, useLongTextSetting } from "@/lib/editable-settings";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Eye,
  PackageSearch,
  RefreshCcw,
  TrendingDown,
} from "lucide-react";

const select = q.select({
  item: "Item",
  movementType: "Movement Type",
  movementCategory: "Movement Category (Static)",
  notes: "Notes",
  priorityScore: "Priority Score",

  currentQty: "Current Qty",
  previousQty: "Previous Qty",
  currentRevenue: "Current Revenue",
  previousRevenue: "Previous Revenue",
  qtyChange: "Qty Change",
  revenueChange: "Revenue Change",

  currentRunId: "Current Run ID",
  isLatestMovementText: "Is Latest Movement Text",
});

const KP_TONES = {
  neutral: {
    color: "#475569",
    bg: "rgba(100,116,139,0.08)",
    border: "rgba(100,116,139,0.16)",
    glow: "rgba(100,116,139,0.08)",
    rail: "#94A3B8",
  },
  info: {
    color: "#0891B2",
    bg: "rgba(34,211,238,0.09)",
    border: "rgba(34,211,238,0.20)",
    glow: "rgba(34,211,238,0.10)",
    rail: "#22D3EE",
  },
  improve: {
    color: "#0F766E",
    bg: "rgba(20,184,166,0.08)",
    border: "rgba(20,184,166,0.18)",
    glow: "rgba(20,184,166,0.10)",
    rail: "#14B8A6",
  },
  watch: {
    color: "#D97706",
    bg: "rgba(245,158,11,0.11)",
    border: "rgba(245,158,11,0.26)",
    glow: "rgba(245,158,11,0.12)",
    rail: "#F59E0B",
  },
  calm: {
    color: "#2563EB",
    bg: "rgba(59,130,246,0.09)",
    border: "rgba(59,130,246,0.20)",
    glow: "rgba(59,130,246,0.10)",
    rail: "#60A5FA",
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
    if ("foreignRowDisplayName" in value) return String(value.foreignRowDisplayName);
  }

  return String(value);
}

function fieldNumber(value) {
  if (Array.isArray(value)) return Number(value[0] || 0);
  if (typeof value === "number" && !Number.isNaN(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,%]/g, "").replace(/,/g, "").trim());
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
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe > 0 ? "+" : "";
  return `${sign}${safe}`;
}

function formatSignedCurrency(value) {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe > 0 ? "+" : "";
  return `${sign}${formatCurrency(safe)}`;
}

function signedTone(value) {
  if (value > 0) return KP_TONES.improve;
  if (value < 0) return KP_TONES.watch;
  return KP_TONES.neutral;
}

function pickVariant(options, seed = "") {
  if (!options.length) return "";

  const text = String(seed || "");
  let total = 0;

  for (let i = 0; i < text.length; i += 1) {
    total += text.charCodeAt(i);
  }

  return options[total % options.length];
}

function formatRunLabel(runId) {
  const text = fieldText(runId);

  if (!text) return "";

  const dateMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  const typeMatch = text.match(/-(Close|Dinner|Lunch|Brunch|Breakfast|AM|PM)(?:-|$)/i);

  if (!dateMatch && !typeMatch) return text;

  let dateLabel = "";

  if (dateMatch) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);

    const date = new Date(year, month - 1, day);

    dateLabel = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  const runType = typeMatch
    ? typeMatch[1].charAt(0).toUpperCase() + typeMatch[1].slice(1).toLowerCase()
    : "";

  return [dateLabel, runType].filter(Boolean).join(" • ");
}

function getItemRole(itemNameRaw) {
  const name = itemNameRaw.toLowerCase();

  if (
    name.includes("ribeye") ||
    name.includes("filet") ||
    name.includes("steak") ||
    name.includes("short rib") ||
    name.includes("lamb") ||
    name.includes("salmon") ||
    name.includes("pork chop") ||
    name.includes("chicken")
  ) {
    return "Core entrée";
  }

  if (
    name.includes("crab cake") ||
    name.includes("crab") ||
    name.includes("dip") ||
    name.includes("app") ||
    name.includes("riblet") ||
    name.includes("shrimp")
  ) {
    return "Feature / starter";
  }

  if (
    name.includes("salad") ||
    name.includes("side") ||
    name.includes("fries") ||
    name.includes("potato") ||
    name.includes("soup")
  ) {
    return "Attachment item";
  }

  if (
    name.includes("dessert") ||
    name.includes("brownie") ||
    name.includes("tiramisu") ||
    name.includes("chocolate cake") ||
    name.includes("cheesecake") ||
    name.includes("carrot cake") ||
    name.includes("lava cake")
  ) {
    return "Dessert signal";
  }

  return "Menu item";
}

function getMovementMeta(movementTypeRaw) {
  const movementType = String(movementTypeRaw || "").toLowerCase();

  if (movementType.includes("rising")) {
    return {
      label: "Gaining traction",
      tone: KP_TONES.info,
      Icon: ArrowUpRight,
    };
  }

  if (movementType.includes("recovered")) {
    return {
      label: "Recovery watch",
      tone: KP_TONES.improve,
      Icon: RefreshCcw,
    };
  }

  if (movementType.includes("declining")) {
    return {
      label: "Soft watch",
      tone: KP_TONES.watch,
      Icon: TrendingDown,
    };
  }

  if (movementType.includes("stable")) {
    return {
      label: "Holding steady",
      tone: KP_TONES.neutral,
      Icon: CheckCircle2,
    };
  }

  return {
    label: "Monitor",
    tone: KP_TONES.neutral,
    Icon: PackageSearch,
  };
}

function getOperatorLine(item, index) {
  const fields = item.fields || {};

  const itemName = fieldText(fields.item);
  const movementType = fieldText(fields.movementType).toLowerCase();
  const role = getItemRole(itemName);

  const currentQty = fieldNumber(fields.currentQty);
  const previousQty = fieldNumber(fields.previousQty);
  const currentRevenue = fieldNumber(fields.currentRevenue);
  const previousRevenue = fieldNumber(fields.previousRevenue);
  const qtyChange = fieldNumber(fields.qtyChange);
  const revenueChange = fieldNumber(fields.revenueChange);

  const seed = `${itemName}-${movementType}-${currentQty}-${previousQty}-${index}`;

  if (movementType.includes("rising")) {
    if (qtyChange > 0 && revenueChange > 0 && currentQty >= 3) {
      return `${role} is gaining usable traction, but it does not need the headline treatment yet. Keep it visible and confirm repeat demand.`;
    }

    if (qtyChange > 0 && revenueChange <= 0) {
      return `${role} count is improving, but revenue is not following cleanly. Watch check quality, modifiers, or discounting before calling it a full win.`;
    }

    return pickVariant(
      [
        `${role} is moving in the right direction. Keep it visible without overbuilding the plan around it.`,
        `${role} has a positive signal, but it still needs another service to prove durability.`,
        `${role} is showing some lift. Treat this as support context, not a push mandate.`,
      ],
      seed
    );
  }

  if (movementType.includes("recovered")) {
    if (currentQty > previousQty && revenueChange > 0) {
      return `${role} recovered with enough movement to notice. Let it prove one more run before actively featuring it.`;
    }

    if (currentQty <= previousQty) {
      return `${role} has a recovery label, but the numbers are still modest. Keep it on watch rather than pushing it.`;
    }

    return pickVariant(
      [
        `${role} moved out of prior weakness. Good sign, but not enough for a bigger play yet.`,
        `${role} is stabilizing after a weak spot. Monitor before changing prep or floor focus.`,
        `${role} bounced back enough to watch, not enough to declare a trend.`,
      ],
      seed
    );
  }

  if (movementType.includes("declining")) {
    if (currentQty <= 1 && previousQty <= 2) {
      return `${role} is soft, but volume is thin. This belongs in peripheral watch, not the owner-risk lane.`;
    }

    if (qtyChange < 0 && revenueChange < 0) {
      return `${role} is easing down across count and revenue. Check visibility and service context if it repeats.`;
    }

    return pickVariant(
      [
        `${role} is cooling slightly. Confirm whether the softness repeats before adjusting the plan.`,
        `${role} deserves a quick glance, but it is not urgent enough for the margin-risk lane.`,
        `${role} is a mild watch item. Keep an eye on server confidence and placement.`,
      ],
      seed
    );
  }

  if (movementType.includes("stable")) {
    if (currentQty > 0 && Math.abs(qtyChange) <= 1) {
      return `${role} is holding steady. Useful context, not an action item.`;
    }

    return pickVariant(
      [
        `${role} is staying in its lane compared with the prior run.`,
        `${role} is stable enough to leave alone for now.`,
        `${role} does not need attention unless it changes in the next service window.`,
      ],
      seed
    );
  }

  return `${role} belongs on the watch list, not the panic list. Review again after the next service window.`;
}

function getOwnerRead(items) {
  if (items.length === 0) {
    return "No secondary watch items need attention from the latest movement run. The page can end cleanly here.";
  }

  const rising = items.filter((item) =>
    fieldText(item.fields.movementType).toLowerCase().includes("rising")
  ).length;

  const recovered = items.filter((item) =>
    fieldText(item.fields.movementType).toLowerCase().includes("recovered")
  ).length;

  const declining = items.filter((item) =>
    fieldText(item.fields.movementType).toLowerCase().includes("declining")
  ).length;

  if (declining > 0 && rising + recovered > declining) {
    return "Secondary watch is mixed but not alarming. A few items are soft, while more are stabilizing or gaining traction.";
  }

  if (declining > 0) {
    return "A few secondary items are softening, but nothing here is strong enough to override the main margin or trend sections.";
  }

  if (rising + recovered > 0) {
    return "This watch list is mostly constructive. These are support signals to keep visible, not items that need a major operational change.";
  }

  return "Secondary items are mostly stable. Use this as peripheral context after reviewing the higher-priority sales and movement sections.";
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

function WatchItemCard({ item, index }) {
  const fields = item.fields || {};

  const itemName = fieldText(fields.item) || "Unnamed item";
  const movementType = fieldText(fields.movementType);
  const notes = fieldText(fields.notes);
  const currentQty = fieldNumber(fields.currentQty);
  const previousQty = fieldNumber(fields.previousQty);
  const currentRevenue = fieldNumber(fields.currentRevenue);
  const previousRevenue = fieldNumber(fields.previousRevenue);
  const qtyChange = fieldNumber(fields.qtyChange);
  const revenueChange = fieldNumber(fields.revenueChange);
  const currentRunLabel = formatRunLabel(fields.currentRunId);

  const meta = getMovementMeta(movementType);
  const Icon = meta.Icon;
  const tone = meta.tone;

  const qtyTone = signedTone(qtyChange);
  const revenueTone = signedTone(revenueChange);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 shadow-sm"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.97), rgba(248,250,252,0.76))",
        borderColor: tone.border,
        boxShadow:
          index === 0
            ? "0 12px 28px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.78)"
            : "0 9px 22px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.78)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1"
        style={{ background: tone.rail, opacity: index === 0 ? 0.9 : 0.65 }}
      />

      <div
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
        style={{ background: tone.glow }}
      />

      <div className="relative z-10 grid gap-3 md:grid-cols-[1fr_220px] md:items-center">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
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

            <h3 className="text-base font-semibold leading-tight text-foreground">
              {itemName}
            </h3>

            <SignalBadge tone={tone}>{meta.label}</SignalBadge>

            {index === 0 ? (
              <SignalBadge tone={KP_TONES.neutral} icon={Eye}>
                Monitor first
              </SignalBadge>
            ) : null}
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {getOperatorLine(item, index)}
          </p>

          {notes ? (
            <p
              className="mt-2 rounded-xl border px-3 py-2 text-xs leading-relaxed text-muted-foreground"
              style={{
                background: "rgba(248,250,252,0.72)",
                borderColor: "rgba(15,23,42,0.08)",
              }}
            >
              {notes}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {movementType ? (
              <SignalBadge tone={KP_TONES.neutral}>{movementType}</SignalBadge>
            ) : null}

            {currentRunLabel ? (
              <SignalBadge tone={KP_TONES.neutral} icon={CalendarDays}>
                {currentRunLabel}
              </SignalBadge>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div
            className="rounded-xl border px-3 py-2"
            style={{
              background: "rgba(255,255,255,0.72)",
              borderColor: qtyTone.border,
            }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Qty
            </div>
            <div className="mt-1 text-lg font-bold" style={{ color: qtyTone.color }}>
              {currentQty}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatSignedNumber(qtyChange)} vs {previousQty}
            </div>
          </div>

          <div
            className="rounded-xl border px-3 py-2"
            style={{
              background: "rgba(255,255,255,0.72)",
              borderColor: revenueTone.border,
            }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Revenue
            </div>
            <div className="mt-1 text-lg font-bold" style={{ color: revenueTone.color }}>
              {formatCurrency(currentRevenue)}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatSignedCurrency(revenueChange)} vs {formatCurrency(previousRevenue)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Block() {
  const title = useTextSetting({
    name: "title",
    label: "Title",
    initialValue: "Watch Closely",
  });

  const subtitle = useLongTextSetting({
    name: "subtitle",
    label: "Subtitle",
    initialValue:
      "Secondary items worth monitoring after the higher-priority sales, margin, and trend sections.",
  });

  const { data, status } = useRecords({
    select,
    where: q.and(
      q.text("isLatestMovementText").is("true"),
      q.or(
        q.text("movementType").is("Stable"),
        q.text("movementType").is("Rising"),
        q.text("movementType").is("Recovered"),
        q.text("movementType").is("Declining")
      )
    ),
    orderBy: [q.desc("priorityScore"), q.desc("currentQty")],
    count: 5,
  });

  const items = data?.pages.flatMap((page) => page.items) || [];
  const ownerRead = getOwnerRead(items);

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
                      background: KP_TONES.info.rail,
                      boxShadow: "0 0 10px rgba(34,211,238,0.35)",
                    }}
                  />
                  Secondary watch
                </div>

                <h2 className="text-2xl font-heading font-semibold tracking-tight">
                  {title}
                </h2>

                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {subtitle}
                </p>
              </div>

              <div
                className="rounded-full border px-3 py-2 text-xs font-semibold text-muted-foreground"
                style={{
                  background: "rgba(255,255,255,0.72)",
                  borderColor: "rgba(15,23,42,0.08)",
                }}
              >
                Latest movement context
              </div>
            </div>

            <div
              className="mb-5 rounded-2xl border p-4 text-sm leading-relaxed text-muted-foreground shadow-sm"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(248,250,252,0.72))",
                borderColor: "rgba(15,23,42,0.08)",
                boxShadow:
                  "0 10px 24px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.78)",
              }}
            >
              <span className="font-semibold text-foreground">Owner read:</span>{" "}
              {ownerRead}
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
                Error loading secondary watch items.
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
                    color: KP_TONES.info.color,
                    background: KP_TONES.info.bg,
                    borderColor: KP_TONES.info.border,
                  }}
                >
                  <Activity className="h-5 w-5" />
                </div>

                <div className="text-base font-semibold text-foreground">
                  No secondary watch items need attention.
                </div>

                <div className="mt-1 text-sm text-muted-foreground">
                  Current items are either already handled above, too small to surface, or quiet enough to leave alone.
                </div>
              </div>
            )}

            {status === "success" && items.length > 0 && (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <WatchItemCard key={item.id} item={item} index={index} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
