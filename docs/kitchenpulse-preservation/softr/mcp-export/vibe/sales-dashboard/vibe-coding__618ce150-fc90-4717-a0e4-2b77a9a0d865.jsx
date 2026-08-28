import { useEffect, useState } from "react";
import { useTextSetting } from "@/lib/editable-settings";
import { useRecords, q } from "@/lib/datasource";

const select = q.select({
  metricName: "Metric Name",
  metricValue: "Metric Value",
  metricNumber: "Metric Number",
  metricType: "Metric Type",
  displayOrder: "Display Order",
  isLatest: "Is Latest",
  sourceRunId: "Source Run ID",
  notes: "Notes",
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

function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function formatPercent(value: number) {
  if (!value) return "";
  const pct = value <= 1 ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

function getMetric(metrics: any[], name: string) {
  const target = name.toLowerCase();

  return metrics.find((item) => {
    const metricName = fieldText(item?.fields?.metricName).toLowerCase();
    return metricName === target;
  });
}

function getDynamicHeroRead(
  metrics: any[],
  fallbackSignalValue: string,
  fallbackPriorityValue: string
) {
  const revenueMetric = getMetric(metrics, "Revenue");
  const profitMetric = getMetric(metrics, "Profit");
  const marginMetric = getMetric(metrics, "Margin");
  const topItemMetric = getMetric(metrics, "Top Item");

  const revenue = fieldNumber(revenueMetric?.fields?.metricNumber);
  const profit = fieldNumber(profitMetric?.fields?.metricNumber);
  const margin = fieldNumber(marginMetric?.fields?.metricNumber);
  const topItem = fieldText(topItemMetric?.fields?.metricValue);

  const marginPct = margin <= 1 ? margin * 100 : margin;

  if (!metrics.length || (!revenue && !profit && !margin && !topItem)) {
    return {
      signalLabel: "PERFORMANCE SIGNAL",
      signalValue: fallbackSignalValue,
      signalBody: "Surface what’s working, what’s leaking, and where to act next.",
      priorityLabel: "Focus",
      priorityValue: fallbackPriorityValue,
      pill1: "Sales view ready",
      pill2: "Margin watch",
      pill3: "Top item focus",
    };
  }

  if (revenue > 0 && profit > 0 && marginPct >= 65) {
    return {
      signalLabel: "PERFORMANCE SIGNAL",
      signalValue: `Healthy run: ${formatCurrency(revenue)} revenue at ${formatPercent(margin)} margin.`,
      signalBody: topItem
        ? `${topItem} is leading the run. Keep visibility high while margin is holding.`
        : "Revenue and margin are both in a healthy range. Keep the floor focused on protecting the mix.",
      priorityLabel: "Focus",
      priorityValue: "Protect margin",
      pill1: "Sales live",
      pill2: "Margin healthy",
      pill3: topItem ? "Top item active" : "Performance focus",
    };
  }

  if (revenue > 0 && profit > 0 && marginPct > 0 && marginPct < 62) {
    return {
      signalLabel: "MARGIN SIGNAL",
      signalValue: `Revenue is live, but margin is softer at ${formatPercent(margin)}.`,
      signalBody: topItem
        ? `${topItem} is leading sales, but the owner read should check mix, discounts, and cost assumptions.`
        : "Sales are moving, but margin needs a closer look before calling the run healthy.",
      priorityLabel: "Focus",
      priorityValue: "Margin watch",
      pill1: "Sales live",
      pill2: "Margin watch",
      pill3: "Owner check",
    };
  }

  if (topItem && revenue > 0) {
    return {
      signalLabel: "TOP ITEM SIGNAL",
      signalValue: `${topItem} is driving the latest dinner run.`,
      signalBody: `${formatCurrency(revenue)} in latest dinner revenue is on the board. Check whether the top item is helping profit, not just volume.`,
      priorityLabel: "Focus",
      priorityValue: "Top item",
      pill1: "Sales live",
      pill2: "Top item focus",
      pill3: marginPct ? `${formatPercent(margin)} margin` : "Margin watch",
    };
  }

  if (revenue > 0 && profit > 0) {
    return {
      signalLabel: "SALES SIGNAL",
      signalValue: `${formatCurrency(revenue)} revenue with ${formatCurrency(profit)} profit.`,
      signalBody:
        "Latest dinner performance is loaded. Use the cards below to confirm whether margin and item mix support the result.",
      priorityLabel: "Focus",
      priorityValue: "Owner read",
      pill1: "Sales live",
      pill2: "Profit loaded",
      pill3: marginPct ? `${formatPercent(margin)} margin` : "Margin watch",
    };
  }

  return {
    signalLabel: "PERFORMANCE SIGNAL",
    signalValue: fallbackSignalValue,
    signalBody: "Surface what’s working, what’s leaking, and where to act next.",
    priorityLabel: "Focus",
    priorityValue: fallbackPriorityValue,
    pill1: "Sales view ready",
    pill2: "Margin watch",
    pill3: "Top item focus",
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
  const [isPhone, setIsPhone] = useState(false);

  const { data: metricsData, status: metricsStatus } = useRecords({
    select,
    where: q.boolean("isLatest").is(true),
    orderBy: q.asc("displayOrder"),
    count: 20,
  });

  useEffect(() => {
    const checkSize = () => {
      const realPhoneWidth = Math.min(
        window.innerWidth || 9999,
        window.screen?.width || 9999
      );

      setIsPhone(realPhoneWidth < 768);
    };

    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

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
    initialValue: "Sales Dashboard",
  });

  const fallbackSubheadline = useTextSetting({
    name: "fallback-subheadline",
    label: "Fallback subheadline",
    initialValue:
      "See what’s moving, what’s leaking margin, and what deserves attention today.",
  });

  const fallbackSignalLabel = useTextSetting({
    name: "fallback-signal-label",
    label: "Fallback signal label",
    initialValue: "PERFORMANCE SIGNAL",
  });

  const fallbackSignalValue = useTextSetting({
    name: "fallback-signal-value",
    label: "Fallback signal value",
    initialValue: "What’s driving performance right now.",
  });

  const fallbackPriorityLabel = useTextSetting({
    name: "fallback-priority-label",
    label: "Fallback priority label",
    initialValue: "Focus",
  });

  const fallbackPriorityValue = useTextSetting({
    name: "fallback-priority-value",
    label: "Fallback priority value",
    initialValue: "Performance",
  });

  const eyebrow = props?.eyebrow || eyebrowFallback;
  const headline = props?.heroHeadline || fallbackHeadline;
  const subheadline = props?.heroSubheadline || fallbackSubheadline;

  const metrics = metricsData?.pages.flatMap((p) => p.items) || [];

  const dynamicHero = getDynamicHeroRead(
    metrics,
    props?.heroCardValue || fallbackSignalValue,
    props?.heroCardPriority || fallbackPriorityValue
  );

  const signalLabel = props?.signalLabel || dynamicHero.signalLabel;
  const signalValue =
    metricsStatus === "pending"
      ? "Loading latest performance signal..."
      : dynamicHero.signalValue;

  const priorityLabel =
    props?.priorityLabel || fallbackPriorityLabel || dynamicHero.priorityLabel;
  const priorityValue = dynamicHero.priorityValue;

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
          <div
            className="grid gap-8 lg:gap-10"
            style={{
              gridTemplateColumns: isPhone ? "1fr" : "1.35fr 0.85fr",
            }}
          >
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
                className="break-words rounded-[24px] p-5 md:p-6"
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
                  className="mt-3 font-semibold break-words"
                  style={{
                    color: "#F8FAFC",
                    fontSize: "clamp(22px, 2vw, 30px)",
                    lineHeight: "1.15",
                    wordBreak: "break-word",
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
                  {dynamicHero.signalBody}
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
                      color: "#FED7AA",
                      background: "rgba(249,115,22,0.14)",
                      border: "1px solid rgba(249,115,22,0.22)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {priorityValue}
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
