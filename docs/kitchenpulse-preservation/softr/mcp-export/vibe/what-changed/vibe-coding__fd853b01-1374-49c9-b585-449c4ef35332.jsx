import { useTextSetting } from "@/lib/editable-settings";
import { useRecords, q } from "@/lib/datasource";

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
  isLatest: "Is Latest Movement",
});

function fieldText(value: any) {
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

function fieldNumber(value: any) {
  if (Array.isArray(value)) return Number(value[0] || 0);
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
}

function movementLabel(item: any) {
  return fieldText(item?.fields?.movementType);
}

function isRiskSignal(item: any) {
  const type = movementLabel(item);
  return (
    type.includes("Dropped from Top") ||
    type.includes("Dropped to Low") ||
    type.includes("New Low") ||
    type.includes("Declining")
  );
}

function isRecoverySignal(item: any) {
  const type = movementLabel(item);
  return type.includes("Recovered") && !type.includes("Recovered to Top");
}

function isStrongRecovery(item: any) {
  const fields = item.fields || {};
  const qtyChange = fieldNumber(fields.qtyChange);
  const revenueChange = fieldNumber(fields.revenueChange);
  const currentRevenue = fieldNumber(fields.currentRevenue);

  return qtyChange >= 5 || revenueChange >= 100 || currentRevenue >= 150;
}

function isLeanSignal(item: any) {
  const type = movementLabel(item);

  if (type.includes("New Top")) return true;
  if (type.includes("Rising")) return true;
  if (type.includes("Recovered to Top")) return true;
  if (type.includes("Recovered")) return isStrongRecovery(item);

  return false;
}

function getDynamicMovementHero(
  items: any[],
  fallbackSignalValue: string,
  fallbackPriorityValue: string
) {
  const riskItems = items.filter(isRiskSignal);
  const leanItems = items.filter(isLeanSignal);
  const recoveryItems = items.filter(
    (item) => isRecoverySignal(item) && !isStrongRecovery(item)
  );

  const topRisk = riskItems[0];
  const topLean = leanItems[0];
  const topRecovery = recoveryItems[0];

  const riskName = fieldText(topRisk?.fields?.item);
  const leanName = fieldText(topLean?.fields?.item);
  const recoveryName = fieldText(topRecovery?.fields?.item);

  if (!items.length) {
    return {
      signalLabel: "MOVEMENT SIGNAL",
      signalValue: fallbackSignalValue,
      signalBody:
        "Latest movement signals from the current service window, compared against the right baseline.",
      priorityLabel: "Signal view",
      priorityValue: fallbackPriorityValue,
      pill1: "Movement live",
      pill2: "Risks + recoveries",
      pill3: "Dinner comparison",
    };
  }

  if (leanItems.length > riskItems.length && leanItems.length >= 3) {
    return {
      signalLabel: "MOMENTUM SIGNAL",
      signalValue: leanName
        ? `${leanName} is leading usable momentum.`
        : "Usable momentum is stronger than risk this run.",
      signalBody: `${leanItems.length} lean-in signals are stronger than ${riskItems.length} watch signals. Support the clean movers, but confirm mixed items first.`,
      priorityLabel: "Focus",
      priorityValue: "Lean in",
      pill1: "Movement live",
      pill2: `${leanItems.length} lean in`,
      pill3: `${riskItems.length} watch`,
    };
  }

  if (riskItems.length > leanItems.length && riskItems.length >= 3) {
    return {
      signalLabel: "CONFIRMATION SIGNAL",
      signalValue: riskName
        ? `${riskName} needs the first check.`
        : "Mixed movement needs the first check.",
      signalBody: `${riskItems.length} watch signals are outweighing clean momentum. Verify the story before changing the play.`,
      priorityLabel: "Focus",
      priorityValue: "Confirm first",
      pill1: "Movement live",
      pill2: `${riskItems.length} watch`,
      pill3: `${leanItems.length} lean in`,
    };
  }

  if (recoveryItems.length >= 3 && recoveryItems.length >= leanItems.length) {
    return {
      signalLabel: "RECOVERY SIGNAL",
      signalValue: recoveryName
        ? `${recoveryName} is showing early recovery.`
        : "Several items are quietly recovering.",
      signalBody: `${recoveryItems.length} recovery-watch signals are present. Let them prove themselves one more run before pushing hard.`,
      priorityLabel: "Focus",
      priorityValue: "Recovery watch",
      pill1: "Movement live",
      pill2: `${recoveryItems.length} recovering`,
      pill3: "Confirm next run",
    };
  }

  if (leanName) {
    return {
      signalLabel: "MOVEMENT SIGNAL",
      signalValue: `${leanName} is the cleanest movement signal.`,
      signalBody: `This run has ${leanItems.length} lean-in signals, ${riskItems.length} watch signals, and ${recoveryItems.length} recovery-watch signals. Start with the strongest mover, then confirm the mixed items.`,
      priorityLabel: "Focus",
      priorityValue: "Comparable run",
      pill1: "Movement live",
      pill2: `${leanItems.length} lean in`,
      pill3: `${riskItems.length} watch`,
    };
  }

  return {
    signalLabel: "MOVEMENT SIGNAL",
    signalValue: fallbackSignalValue,
    signalBody:
      "Latest movement signals from the current service window, compared against the right baseline.",
    priorityLabel: "Signal view",
    priorityValue: fallbackPriorityValue,
    pill1: "Movement live",
    pill2: "Risks + recoveries",
    pill3: "Dinner comparison",
  };
}

function KitchenPulseLockup({ brandDescriptor }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline">
        <span
          className="text-[27px] font-black tracking-[-0.055em] md:text-[34px]"
          style={{
            color: "#F8FAFC",
            textShadow: "0 1px 16px rgba(0,0,0,0.28)",
          }}
        >
          Kitchen
        </span>

        <span
          className="text-[27px] font-black tracking-[-0.055em] md:text-[34px]"
          style={{
            color: "#22D3EE",
            textShadow: "0 0 18px rgba(34,211,238,0.32)",
          }}
        >
          Pulse
        </span>
      </div>

      <div
        className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.34em] md:text-[11px]"
        style={{
          color: "rgba(226,232,240,0.68)",
        }}
      >
        {brandDescriptor}
      </div>
    </div>
  );
}

export default function Block(props) {
  const { data: movementData, status: movementStatus } = useRecords({
    select,
    where: q.boolean("isLatest").is(true),
    orderBy: [q.desc("impactLevel"), q.desc("currentQty")],
    count: 60,
  });

  const eyebrowFallback = useTextSetting({
    name: "eyebrow",
    label: "Fallback eyebrow",
    initialValue: "KitchenPulse",
  });

  const brandDescriptor = useTextSetting({
    name: "brand-descriptor",
    label: "Brand descriptor",
    initialValue: "AI for restaurant operators",
  });

  const fallbackHeadline = useTextSetting({
    name: "fallback-headline",
    label: "Fallback headline",
    initialValue: "What Changed This Run",
  });

  const fallbackSubheadline = useTextSetting({
    name: "fallback-subheadline",
    label: "Fallback subheadline",
    initialValue:
      "Track new risks, recoveries, and momentum shifts from the latest service window.",
  });

  const fallbackSignalLabel = useTextSetting({
    name: "fallback-signal-label",
    label: "Fallback signal label",
    initialValue: "MOVEMENT SIGNAL",
  });

  const fallbackSignalValue = useTextSetting({
    name: "fallback-signal-value",
    label: "Fallback signal value",
    initialValue: "Where momentum is shifting.",
  });

  const fallbackPriorityLabel = useTextSetting({
    name: "fallback-priority-label",
    label: "Fallback priority label",
    initialValue: "Signal view",
  });

  const fallbackPriorityValue = useTextSetting({
    name: "fallback-priority-value",
    label: "Fallback priority value",
    initialValue: "Comparable run",
  });

  const eyebrow = props?.eyebrow || eyebrowFallback;
  const headline = props?.heroHeadline || fallbackHeadline;
  const subheadline = props?.heroSubheadline || fallbackSubheadline;

  const movementItems = movementData?.pages.flatMap((p) => p.items) || [];

  const dynamicHero = getDynamicMovementHero(
    movementItems,
    props?.heroCardValue || fallbackSignalValue,
    props?.heroCardPriority || fallbackPriorityValue
  );

  const signalLabel = props?.signalLabel || dynamicHero.signalLabel;
  const signalValue =
    movementStatus === "pending"
      ? "Loading latest movement signal..."
      : dynamicHero.signalValue;

  const signalBody = dynamicHero.signalBody;
  const priorityLabel =
    props?.priorityLabel || fallbackPriorityLabel || dynamicHero.priorityLabel;
  const priorityValue = dynamicHero.priorityValue;
  const compactPriorityValue =
    String(priorityValue).toLowerCase().includes("latest comparable run")
      ? "Comparable run"
      : priorityValue;

  const pill1 = props?.heroPill1 || dynamicHero.pill1;
  const pill2 = props?.heroPill2 || dynamicHero.pill2;
  const pill3 = props?.heroPill3 || dynamicHero.pill3;

  return (
    <div className="container relative overflow-hidden py-6 md:py-8 lg:py-10">
      <div
        className="relative overflow-hidden rounded-[30px] border shadow-2xl"
        style={{
          background:
            "linear-gradient(135deg, #03101C 0%, #071827 42%, #0B1324 72%, #101936 100%)",
          borderColor: "rgba(103,232,249,0.14)",
          boxShadow:
            "0 26px 70px rgba(2,8,23,0.42), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 16% 18%, rgba(34,211,238,0.23), transparent 28%), radial-gradient(circle at 76% 14%, rgba(14,165,233,0.20), transparent 26%), radial-gradient(circle at 82% 84%, rgba(34,211,238,0.20), transparent 34%)",
          }}
        />

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
            backgroundSize: "38px 38px",
            opacity: 0.15,
          }}
        />

        <div className="relative z-10 px-6 py-7 md:px-10 md:py-10 lg:px-12 lg:py-12">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-center lg:gap-10">
            <div className="min-w-0">
              <div className="mb-7">
                <div
                  className="inline-flex items-center rounded-[22px] px-4 py-3 md:px-5 md:py-4"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow:
                      "0 12px 30px rgba(2,8,23,0.18), inset 0 1px 0 rgba(255,255,255,0.04)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <KitchenPulseLockup brandDescriptor={brandDescriptor} />
                </div>
              </div>

              <h1
                className="max-w-3xl font-semibold tracking-[-0.035em]"
                style={{
                  color: "#F8FAFC",
                  fontSize: "clamp(34px, 4.25vw, 58px)",
                  lineHeight: "1.02",
                  textShadow: "0 1px 18px rgba(0,0,0,0.28)",
                }}
              >
                {headline}
              </h1>

              <p
                className="mt-4 max-w-2xl"
                style={{
                  color: "rgba(226,232,240,0.84)",
                  fontSize: "clamp(14px, 1.4vw, 19px)",
                  lineHeight: "1.6",
                }}
              >
                {subheadline}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium md:text-sm"
                  style={{
                    color: "#E0F2FE",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{
                      background: "#22C55E",
                      boxShadow: "0 0 12px rgba(34,197,94,0.75)",
                    }}
                  />
                  {pill1}
                </span>

                <span
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium md:text-sm"
                  style={{
                    color: "#67E8F9",
                    background: "rgba(34,211,238,0.08)",
                    border: "1px solid rgba(34,211,238,0.16)",
                  }}
                >
                  {pill2}
                </span>

                <span
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium md:text-sm"
                  style={{
                    color: "#C7D2FE",
                    background: "rgba(99,102,241,0.12)",
                    border: "1px solid rgba(99,102,241,0.20)",
                  }}
                >
                  {pill3}
                </span>
              </div>
            </div>

            <div className="min-w-0">
              <div
                className="rounded-[24px] p-5 md:p-6"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.085), rgba(255,255,255,0.045))",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(12px)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 38px rgba(2,8,23,0.22)",
                }}
              >
                <div
                  style={{
                    color: "#67E8F9",
                    fontSize: "12px",
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  {signalLabel}
                </div>

                <div
                  className="mt-3 font-semibold"
                  style={{
                    color: "#F8FAFC",
                    fontSize: "clamp(22px, 2vw, 30px)",
                    lineHeight: "1.15",
                  }}
                >
                  {signalValue}
                </div>

                <div
                  className="mt-3"
                  style={{
                    color: "rgba(226,232,240,0.78)",
                    fontSize: "14px",
                    lineHeight: "1.5",
                  }}
                >
                  {signalBody}
                </div>

                <div
                  className="mt-5 flex items-center justify-between gap-2 rounded-xl px-3 py-3"
                  style={{
                    background: "rgba(15,23,42,0.62)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <span
                    className="min-w-0 shrink text-sm"
                    style={{
                      color: "rgba(226,232,240,0.74)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {priorityLabel}
                  </span>

                  <span
                    className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold md:text-xs"
                    style={{
                      color: "#FDE68A",
                      background: "rgba(245,158,11,0.14)",
                      border: "1px solid rgba(245,158,11,0.28)",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {compactPriorityValue}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
