import { useRecords, q } from "@/lib/datasource";
import {
  Activity,
  ArrowDownRight,
  CalendarDays,
  DollarSign,
  Info,
  PackageSearch,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const select = q.select({
  trendName: "Trend Name",
  itemName: "Item Name",

  trendWindowStart: "Trend Window Start",
  trendWindowEnd: "Trend Window End",
  priorWindowStart: "Prior Window Start",
  priorWindowEnd: "Prior Window End",

  currentRuns: "Current Runs",
  priorRuns: "Prior Runs",

  currentQty: "Current Qty",
  priorQty: "Prior Qty",
  qtyChange: "Qty Change",
  qtyChangePercent: "Qty Change Percent",

  currentRevenue: "Current Revenue",
  priorRevenue: "Prior Revenue",
  revenueChange: "Revenue Change",
  revenueChangePercent: "Revenue Change Percent",

  currentProfit: "Current Profit",
  priorProfit: "Prior Profit",
  profitChange: "Profit Change",
  profitChangePercent: "Profit Change Percent",

  currentMargin: "Current Margin",
  priorMargin: "Prior Margin",
  marginChange: "Margin Change",

  trendDirection: "Trend Direction",
  trendStrength: "Trend Strength",
  confidence: "Confidence",
  ownerSummary: "Owner Summary",
  recommendedAction: "Recommended Action",
  isActive: "Is Active",
  displayPriority: "Display Priority",
  lastCalculatedAt: "Last Calculated At",
  notes: "Notes",
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
  if (Array.isArray(value)) return Number(value[0] || 0);
  if (typeof value === "number" && !Number.isNaN(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,%]/g, "").replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function fieldBool(value) {
  if (typeof value === "boolean") return value;
  const text = fieldText(value).toLowerCase();
  return text === "true" || text === "yes" || text === "1" || text === "checked";
}

function formatCurrency(value) {
  const safe = Number.isFinite(value) ? value : 0;

  return safe.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatSignedCurrency(value) {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe > 0 ? "+" : "";
  return `${sign}${formatCurrency(safe)}`;
}

function normalizePercent(value) {
  const safe = Number.isFinite(value) ? value : 0;
  if (Math.abs(safe) > 1) return safe / 100;
  return safe;
}

function formatPercent(value) {
  const normalized = normalizePercent(value);
  return `${(normalized * 100).toFixed(0)}%`;
}

function formatSignedPercent(value) {
  const normalized = normalizePercent(value);
  const sign = normalized > 0 ? "+" : "";
  return `${sign}${(normalized * 100).toFixed(0)}%`;
}

function formatDate(value) {
  const text = fieldText(value);
  if (!text) return "";

  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text;

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function signedTone(value) {
  if (value > 0) return KP_TONES.improve;
  if (value < 0) return KP_TONES.pressure;
  return KP_TONES.neutral;
}

function softerSignedTone(value) {
  if (value > 0) return KP_TONES.improve;
  if (value < 0) return KP_TONES.watch;
  return KP_TONES.neutral;
}

function getDirectionMeta(directionRaw, strengthRaw, confidenceRaw) {
  const direction = directionRaw.toLowerCase();
  const strength = strengthRaw.toLowerCase();
  const confidence = confidenceRaw.toLowerCase();

  if (direction.includes("declining")) {
    const strong =
      strength.includes("high") ||
      strength.includes("medium") ||
      confidence.includes("high");

    return {
      label: "Declining",
      tone: strong ? KP_TONES.pressure : KP_TONES.watch,
      Icon: TrendingDown,
    };
  }

  if (direction.includes("softening")) {
    return {
      label: "Softening",
      tone: KP_TONES.watch,
      Icon: Activity,
    };
  }

  if (direction.includes("improving")) {
    return {
      label: "Improving",
      tone: KP_TONES.improve,
      Icon: TrendingUp,
    };
  }

  return {
    label: "Watch",
    tone: KP_TONES.neutral,
    Icon: PackageSearch,
  };
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
    name.includes("cake") ||
    name.includes("brownie") ||
    name.includes("tiramisu")
  ) {
    return "Dessert signal";
  }

  if (
    name.includes("dip") ||
    name.includes("app") ||
    name.includes("riblet") ||
    name.includes("shrimp")
  ) {
    return "Feature / starter";
  }

  return "Menu item";
}

function getDominantDriver({
  qtyChange,
  revenueChange,
  profitChange,
  marginChange,
}) {
  const drivers = [
    { key: "quantity", value: Math.abs(qtyChange) * 35 },
    { key: "revenue", value: Math.abs(revenueChange) },
    { key: "profit", value: Math.abs(profitChange) },
    { key: "margin", value: Math.abs(normalizePercent(marginChange)) * 800 },
  ];

  return drivers.sort((a, b) => b.value - a.value)[0]?.key || "movement";
}

function getTrendInterpretation(item, isPrimary = false) {
  const f = item.fields;

  const itemName = fieldText(f.itemName);
  const role = getItemRole(itemName);
  const direction = fieldText(f.trendDirection).toLowerCase();
  const strength = fieldText(f.trendStrength).toLowerCase();
  const confidence = fieldText(f.confidence).toLowerCase();

  const currentQty = fieldNumber(f.currentQty);
  const priorQty = fieldNumber(f.priorQty);
  const qtyChange = fieldNumber(f.qtyChange);

  const revenueChange = fieldNumber(f.revenueChange);
  const profitChange = fieldNumber(f.profitChange);
  const marginChange = fieldNumber(f.marginChange);

  const absProfit = Math.abs(profitChange);
  const absRevenue = Math.abs(revenueChange);
  const absQty = Math.abs(qtyChange);
  const dominant = getDominantDriver({
    qtyChange,
    revenueChange,
    profitChange,
    marginChange,
  });

  const lowProof =
    confidence.includes("low") ||
    strength.includes("low") ||
    Math.max(currentQty, priorQty) < 8;

  if (direction.includes("improving")) {
    if (profitChange > 0 && revenueChange > 0 && qtyChange > 0) {
      return `${role} is improving across count, revenue, and profit. Support it carefully, but do not overbuild prep until the next window confirms it.`;
    }

    if (qtyChange > 0 && revenueChange <= 0) {
      return `${role} count improved, but dollars did not follow at the same pace. Check check size, modifiers, discounting, or mix before calling this clean demand growth.`;
    }

    if (profitChange > 0 && marginChange > 0) {
      return `${role} is showing better profit quality, not just more movement. This is a useful support signal if service demand backs it up.`;
    }

    return `${role} is moving in the right direction. Treat this as support context, not a guarantee of tonight’s demand.`;
  }

  if (direction.includes("softening")) {
    if (lowProof) {
      return `${role} is softening, but the proof level is still thin. Keep it on watch before changing prep, placement, or server focus.`;
    }

    if (dominant === "quantity") {
      return `${role} is mostly softening on order count. That points more toward demand or visibility than margin structure.`;
    }

    if (dominant === "profit") {
      return `${role} is softening where it matters commercially: profit. Review mix, cost assumptions, and whether the item is still worth pushing.`;
    }

    return `${role} is softer across the compared windows. Review context before treating this as a permanent trend.`;
  }

  if (direction.includes("declining")) {
    if (lowProof && absProfit < 150) {
      return `${role} is declining, but the signal is not strong enough to make a big operational move. Watch it, but do not let it drive the whole plan.`;
    }

    if (qtyChange < 0 && revenueChange < 0 && profitChange < 0) {
      if (role === "Core entrée") {
        return `${role} softness is carrying through count, revenue, and profit. This is worth a real owner check, especially if similar entrées are also slipping.`;
      }

      return `${role} is down across count, revenue, and profit. This looks broader than a single metric wobble, but still needs service-context review.`;
    }

    if (qtyChange < 0 && marginChange >= 0 && profitChange < 0) {
      return `${role} is losing orders while margin quality is mostly holding. This reads more like demand softness than a food-cost leak.`;
    }

    if (profitChange < 0 && marginChange < 0) {
      return `${role} is losing profit and margin at the same time. Check price, cost assumptions, comps, and mix before pushing more volume through it.`;
    }

    if (revenueChange < 0 && qtyChange >= 0) {
      return `${role} count held better than revenue. Check average check, modifier mix, discounts, or item pricing before assuming demand collapsed.`;
    }

    if (absQty <= 3 && absRevenue < 100 && absProfit < 75) {
      return `${role} is down, but the movement is small. Keep it visible as a watch item, not a menu-change trigger.`;
    }

    if (dominant === "profit") {
      return `${role} is mainly showing a profit gap. Prioritize margin math and cost source before changing how the floor sells it.`;
    }

    if (dominant === "revenue") {
      return `${role} is mainly showing a revenue gap. Review demand, check size, and whether the item lost visibility during the window.`;
    }

    return `${role} is showing a meaningful decline across the compared windows. Review day mix and service conditions before changing prep or menu strategy.`;
  }

  return `${role} crossed the trend threshold. Review the numbers and service context before taking action.`;
}

function getPrimaryAction(item) {
  const f = item.fields;

  const itemName = fieldText(f.itemName);
  const role = getItemRole(itemName);
  const direction = fieldText(f.trendDirection).toLowerCase();
  const qtyChange = fieldNumber(f.qtyChange);
  const revenueChange = fieldNumber(f.revenueChange);
  const profitChange = fieldNumber(f.profitChange);
  const marginChange = fieldNumber(f.marginChange);
  const recommendedAction = fieldText(f.recommendedAction);

  if (recommendedAction) return recommendedAction;

  if (direction.includes("improving")) {
    return "Use this as a support signal. Keep visibility high, but wait for another window before treating it as a durable demand shift.";
  }

  if (profitChange < 0 && marginChange < 0) {
    return "Start with margin mechanics: cost source, price, comps, discounts, and portioning. Do not solve this only by pushing more sales.";
  }

  if (qtyChange < 0 && revenueChange < 0 && role === "Core entrée") {
    return "Check whether the decline is clustered around midweek service mix before cutting prep. If it repeats through the weekend, escalate the item conversation.";
  }

  if (qtyChange < 0) {
    return "Review visibility, server confidence, and day-of-week mix. Treat this as a demand review before making menu changes.";
  }

  return "Review before acting. This is a multi-run signal, not an automatic menu or prep change.";
}

function shouldShowTrend(item) {
  const f = item.fields;

  const active = fieldBool(f.isActive);
  const direction = fieldText(f.trendDirection).toLowerCase();
  const confidence = fieldText(f.confidence).toLowerCase();
  const itemName = fieldText(f.itemName).toLowerCase();

  if (!active) return false;

  const currentQty = fieldNumber(f.currentQty);
  const priorQty = fieldNumber(f.priorQty);
  const qtyChange = Math.abs(fieldNumber(f.qtyChange));
  const revenueChange = Math.abs(fieldNumber(f.revenueChange));
  const profitChange = Math.abs(fieldNumber(f.profitChange));
  const priority = fieldNumber(f.displayPriority);

  if (itemName.includes("open food")) return false;
  if (itemName.includes("open bar")) return false;
  if (itemName.includes("misc")) return false;
  if (itemName.includes("discount")) return false;
  if (itemName.includes("gratuity")) return false;
  if (itemName.includes("service charge")) return false;

  if (direction.includes("stable")) return false;
  if (direction.includes("new / insufficient")) return false;

  const hasBaseline = Math.max(currentQty, priorQty) >= 2;
  const hasMovement =
    qtyChange >= 1 ||
    revenueChange >= 50 ||
    profitChange >= 25 ||
    priority >= 20;

  if (!hasBaseline && confidence.includes("insufficient")) return false;

  return hasMovement;
}

function getOwnerRead(items) {
  if (items.length === 0) {
    return "No multi-run item trends are currently strong enough to require owner attention. Smaller movement is still tracked in the latest-run watch sections.";
  }

  const decliningItems = items.filter((item) =>
    fieldText(item.fields.trendDirection).toLowerCase().includes("declining")
  );

  const improvingItems = items.filter((item) =>
    fieldText(item.fields.trendDirection).toLowerCase().includes("improving")
  );

  const coreDeclines = decliningItems.filter(
    (item) => getItemRole(fieldText(item.fields.itemName)) === "Core entrée"
  );

  const totalProfitChange = items.reduce(
    (sum, item) => sum + fieldNumber(item.fields.profitChange),
    0
  );

  const primary = items[0];
  const primaryName = primary ? fieldText(primary.fields.itemName) : "";

  if (coreDeclines.length >= 2 && totalProfitChange < 0) {
    return `Core entrées are carrying most of the downside in this scan. Start with ${primaryName}, then check whether this is day-of-week mix before changing prep or menu strategy.`;
  }

  if (decliningItems.length > 0 && totalProfitChange < 0) {
    return `${decliningItems.length} item${
      decliningItems.length === 1 ? "" : "s"
    } show a meaningful decline across the compared window. Start with ${primaryName}, but treat this as review-first, not automatic proof of a broken item.`;
  }

  if (improvingItems.length > 0 && decliningItems.length === 0) {
    return `${improvingItems.length} item${
      improvingItems.length === 1 ? "" : "s"
    } show improving multi-run movement. Use this as support context, not a guarantee of tonight’s demand.`;
  }

  return `${items.length} multi-run trend signal${
    items.length === 1 ? "" : "s"
  } crossed the owner-review threshold. The cards below separate the primary pattern from supporting evidence.`;
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

function MetricBox({ label, value, detail, tone }) {
  const meta = tone || KP_TONES.neutral;

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

function WindowBadge({ item }) {
  const f = item.fields;
  const currentStart = formatDate(f.trendWindowStart);
  const currentEnd = formatDate(f.trendWindowEnd);
  const priorStart = formatDate(f.priorWindowStart);
  const priorEnd = formatDate(f.priorWindowEnd);

  return (
    <div className="flex flex-wrap gap-2">
      <SignalBadge tone={KP_TONES.neutral} icon={CalendarDays}>
        Current: {currentStart}–{currentEnd}
      </SignalBadge>

      <SignalBadge tone={KP_TONES.neutral}>
        Prior: {priorStart}–{priorEnd}
      </SignalBadge>
    </div>
  );
}

function PrimaryTrendCard({ item }) {
  const f = item.fields;

  const itemName = fieldText(f.itemName) || "Unnamed item";
  const direction = fieldText(f.trendDirection);
  const strength = fieldText(f.trendStrength);
  const confidence = fieldText(f.confidence);

  const currentQty = fieldNumber(f.currentQty);
  const priorQty = fieldNumber(f.priorQty);
  const qtyChange = fieldNumber(f.qtyChange);
  const qtyChangePercent = fieldNumber(f.qtyChangePercent);

  const currentRevenue = fieldNumber(f.currentRevenue);
  const priorRevenue = fieldNumber(f.priorRevenue);
  const revenueChange = fieldNumber(f.revenueChange);

  const currentProfit = fieldNumber(f.currentProfit);
  const priorProfit = fieldNumber(f.priorProfit);
  const profitChange = fieldNumber(f.profitChange);

  const currentMargin = fieldNumber(f.currentMargin);
  const priorMargin = fieldNumber(f.priorMargin);
  const marginChange = fieldNumber(f.marginChange);

  const style = getDirectionMeta(direction, strength, confidence);
  const Icon = style.Icon;
  const tone = style.tone;

  const qtyTone = signedTone(qtyChange);
  const revenueTone = signedTone(revenueChange);
  const profitTone = signedTone(profitChange);
  const marginTone = signedTone(marginChange);

  return (
    <div
      className="relative overflow-hidden rounded-3xl border p-5 shadow-sm"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(248,250,252,0.78))",
        borderColor: tone.border,
        boxShadow:
          "0 14px 32px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.78)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1"
        style={{ background: tone.rail }}
      />

      <div
        className="pointer-events-none absolute -right-14 -top-14 h-32 w-32 rounded-full blur-3xl"
        style={{ background: tone.glow }}
      />

      <div className="relative z-10 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border"
              style={{
                color: tone.color,
                background: tone.bg,
                borderColor: tone.border,
              }}
            >
              <Icon className="h-5 w-5" />
            </span>

            <SignalBadge tone={tone}>Primary pattern</SignalBadge>
            <SignalBadge tone={tone}>{direction || style.label}</SignalBadge>

            {strength ? (
              <SignalBadge tone={KP_TONES.neutral}>{strength} strength</SignalBadge>
            ) : null}

            {confidence ? (
              <SignalBadge tone={KP_TONES.neutral}>{confidence} confidence</SignalBadge>
            ) : null}
          </div>

          <h3 className="text-2xl font-semibold tracking-tight text-foreground">
            {itemName}
          </h3>

          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            {getTrendInterpretation(item, true)}
          </p>

          <div className="mt-4">
            <WindowBadge item={item} />
          </div>

          <div
            className="mt-4 rounded-2xl border px-4 py-3 text-sm leading-relaxed text-muted-foreground"
            style={{
              background: "rgba(248,250,252,0.74)",
              borderColor: "rgba(15,23,42,0.08)",
            }}
          >
            <span className="font-semibold text-foreground">Operator move: </span>
            {getPrimaryAction(item)}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <MetricBox
            label="Qty"
            value={`${currentQty} vs ${priorQty}`}
            detail={`${qtyChange > 0 ? "+" : ""}${qtyChange} / ${formatSignedPercent(
              qtyChangePercent
            )}`}
            tone={qtyTone}
          />

          <MetricBox
            label="Revenue"
            value={formatCurrency(currentRevenue)}
            detail={`${formatSignedCurrency(revenueChange)} vs ${formatCurrency(
              priorRevenue
            )}`}
            tone={revenueTone}
          />

          <MetricBox
            label="Profit"
            value={formatCurrency(currentProfit)}
            detail={`${formatSignedCurrency(profitChange)} vs ${formatCurrency(
              priorProfit
            )}`}
            tone={profitTone}
          />

          <MetricBox
            label="Margin"
            value={formatPercent(currentMargin)}
            detail={`${formatSignedPercent(marginChange)} vs ${formatPercent(
              priorMargin
            )}`}
            tone={marginTone}
          />
        </div>
      </div>
    </div>
  );
}

function SupportingTrendRow({ item }) {
  const f = item.fields;

  const itemName = fieldText(f.itemName) || "Unnamed item";
  const direction = fieldText(f.trendDirection);
  const strength = fieldText(f.trendStrength);
  const confidence = fieldText(f.confidence);

  const currentQty = fieldNumber(f.currentQty);
  const priorQty = fieldNumber(f.priorQty);
  const qtyChange = fieldNumber(f.qtyChange);
  const revenueChange = fieldNumber(f.revenueChange);
  const profitChange = fieldNumber(f.profitChange);
  const marginChange = fieldNumber(f.marginChange);

  const style = getDirectionMeta(direction, strength, confidence);
  const Icon = style.Icon;
  const tone = style.tone;
  const profitTone = softerSignedTone(profitChange);

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
        className="pointer-events-none absolute inset-y-0 left-0 w-1"
        style={{ background: tone.rail, opacity: 0.8 }}
      />

      <div className="relative z-10 grid gap-3 lg:grid-cols-[1fr_260px] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
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

            <h4 className="text-base font-semibold text-foreground">
              {itemName}
            </h4>

            <SignalBadge tone={tone}>{direction || style.label}</SignalBadge>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {getTrendInterpretation(item, false)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MetricBox
            label="Qty"
            value={`${currentQty} vs ${priorQty}`}
            detail={`${qtyChange > 0 ? "+" : ""}${qtyChange}`}
            tone={signedTone(qtyChange)}
          />

          <MetricBox
            label="Profit"
            value={formatSignedCurrency(profitChange)}
            detail={`Revenue ${formatSignedCurrency(revenueChange)}`}
            tone={profitTone}
          />
        </div>
      </div>
    </div>
  );
}

export default function Block() {
  const { data, status } = useRecords({
    select,
    orderBy: [q.desc("displayPriority")],
    count: 100,
  });

  const rawItems = data?.pages.flatMap((page) => page.items) || [];

  const items = rawItems
    .filter(shouldShowTrend)
    .sort(
      (a, b) =>
        fieldNumber(b.fields.displayPriority) -
        fieldNumber(a.fields.displayPriority)
    )
    .slice(0, 5);

  const primaryItem = items[0] || null;
  const supportingItems = items.slice(1);

  const ownerRead = getOwnerRead(items);

  const newestCalculatedAt = rawItems
    .map((item) => fieldText(item.fields.lastCalculatedAt))
    .filter(Boolean)
    .sort()
    .reverse()[0];

  const newestCalculatedDate = newestCalculatedAt
    ? new Date(newestCalculatedAt)
    : null;

  const staleTrendData =
    newestCalculatedDate &&
    !Number.isNaN(newestCalculatedDate.getTime()) &&
    Date.now() - newestCalculatedDate.getTime() > 1000 * 60 * 60 * 36;

  const totalProfitChange = items.reduce(
    (sum, item) => sum + fieldNumber(item.fields.profitChange),
    0
  );

  const decliningCount = items.filter((item) =>
    fieldText(item.fields.trendDirection).toLowerCase().includes("declining")
  ).length;

  const improvingCount = items.filter((item) =>
    fieldText(item.fields.trendDirection).toLowerCase().includes("improving")
  ).length;

  const profitTone = softerSignedTone(totalProfitChange);
  const trendTone = decliningCount > 0 ? KP_TONES.pressure : KP_TONES.info;

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
                      background: trendTone.rail,
                      boxShadow: `0 0 10px ${trendTone.glow}`,
                    }}
                  />
                  Rolling trend watch
                </div>

                <h2 className="text-2xl font-heading font-semibold tracking-tight">
                  Multi-Run Item Trends
                </h2>

                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  A stricter item-level scan comparing the latest reporting dinner-run window against the prior reporting window. This filters one-run noise, but it is not a same-weekday calendar comparison yet.
                </p>
              </div>

              <div className="flex flex-col items-start gap-2 md:items-end">
                <div
                  className="rounded-full border px-3 py-2 text-xs font-semibold text-muted-foreground"
                  style={{
                    background: "rgba(255,255,255,0.72)",
                    borderColor: "rgba(15,23,42,0.08)",
                  }}
                >
                  Last 5 dinner runs vs prior 5
                </div>

                {newestCalculatedAt ? (
                  <div
                    className="rounded-full border px-3 py-1.5 text-xs font-semibold"
                    style={{
                      color: staleTrendData ? KP_TONES.watch.color : KP_TONES.neutral.color,
                      background: staleTrendData
                        ? KP_TONES.watch.bg
                        : "rgba(255,255,255,0.72)",
                      borderColor: staleTrendData
                        ? KP_TONES.watch.border
                        : "rgba(15,23,42,0.08)",
                    }}
                  >
                    {staleTrendData ? "Trend data may be stale · " : "Updated · "}
                    {formatDate(newestCalculatedAt)}
                  </div>
                ) : null}
              </div>
            </div>

            <div
              className="mb-5 rounded-2xl border px-4 py-3 text-sm leading-relaxed"
              style={{
                color: "#475569",
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.88), rgba(248,250,252,0.78))",
                borderColor: "rgba(15,23,42,0.08)",
              }}
            >
              <div className="flex gap-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div>
                  <span className="font-semibold text-foreground">
                    How to read this:
                  </span>{" "}
                  the first card is the primary pattern KitchenPulse would review first. Supporting rows are evidence, not four separate emergencies. Use this as a review signal until the trend builder is upgraded to true week-vs-week comparison.
                </div>
              </div>
            </div>

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
                {ownerRead}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryTile
                  label="Signals shown"
                  value={String(items.length)}
                  helper={`${decliningCount} declining, ${improvingCount} improving.`}
                  tone={items.length > 0 ? trendTone : KP_TONES.neutral}
                  icon={Activity}
                />

                <SummaryTile
                  label="Profit movement"
                  value={formatSignedCurrency(totalProfitChange)}
                  helper="Comparison movement, not actual money lost."
                  tone={profitTone}
                  icon={DollarSign}
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
                Error loading rolling item trends.
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
                  No multi-run item trends need owner attention yet.
                </div>

                <div className="mt-1 text-sm text-muted-foreground">
                  KitchenPulse is waiting for enough calculated item movement to show a useful current-vs-prior pattern.
                </div>
              </div>
            )}

            {status === "success" && items.length > 0 && (
              <div className="space-y-4">
                {primaryItem ? <PrimaryTrendCard item={primaryItem} /> : null}

                {supportingItems.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Supporting signals
                    </div>

                    {supportingItems.map((item) => (
                      <SupportingTrendRow key={item.id} item={item} />
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
