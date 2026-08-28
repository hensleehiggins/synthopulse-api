import { useEffect, useState } from "react";
import { useTextSetting } from "@/lib/editable-settings";

const LATEST_BRIEF_API = "https://project-1csz2.vercel.app/api/latest-brief";
const HOME_ALERT_API = "https://project-1csz2.vercel.app/api/home-alert";

function cleanTimeContextLabel(value) {
  const text = String(value || "").trim();
  const lower = text.toLowerCase();

  if (!text) return "";

  if (
    lower.includes("late") ||
    lower.includes("reset") ||
    lower.includes("stale") ||
    lower.includes("old")
  ) {
    return "Latest completed service";
  }

  return text;
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

function PulseWatermark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute hidden md:block"
      style={{
        right: "-72px",
        bottom: "-74px",
        width: "430px",
        height: "300px",
        opacity: 0.62,
      }}
    >
      <div
        className="absolute rounded-full"
        style={{
          right: "46px",
          bottom: "34px",
          width: "210px",
          height: "210px",
          border: "20px solid rgba(34,211,238,0.18)",
          borderRightColor: "rgba(34,211,238,0.08)",
          borderBottomColor: "rgba(255,255,255,0.10)",
          transform: "rotate(-18deg)",
          filter: "blur(0.2px)",
        }}
      />

      <div
        className="absolute"
        style={{
          left: "-22px",
          right: "-20px",
          bottom: "120px",
          height: "4px",
          borderRadius: 999,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.16) 18%, rgba(34,211,238,0.58) 64%, rgba(255,255,255,0.72) 72%, rgba(34,211,238,0.22) 100%)",
          boxShadow:
            "0 0 20px rgba(34,211,238,0.34), 0 0 48px rgba(34,211,238,0.22)",
        }}
      />

      <div
        className="absolute"
        style={{
          right: "126px",
          bottom: "84px",
          width: "86px",
          height: "86px",
          borderLeft: "13px solid rgba(34,211,238,0.56)",
          borderTop: "13px solid rgba(34,211,238,0.56)",
          transform: "skewX(-14deg) rotate(45deg)",
          borderRadius: 5,
          filter: "drop-shadow(0 0 18px rgba(34,211,238,0.45))",
        }}
      />

      <div
        className="absolute rounded-full"
        style={{
          right: "104px",
          bottom: "112px",
          width: "13px",
          height: "13px",
          background: "#F8FAFC",
          boxShadow:
            "0 0 18px rgba(255,255,255,0.95), 0 0 34px rgba(34,211,238,0.75)",
        }}
      />

      <div
        className="absolute rounded-full"
        style={{
          right: "-70px",
          bottom: "28px",
          width: "380px",
          height: "190px",
          borderTop: "2px solid rgba(34,211,238,0.18)",
          transform: "rotate(-12deg)",
        }}
      />
    </div>
  );
}

export default function Block(props) {
  const [liveHero, setLiveHero] = useState({});
  const [homeAlert, setHomeAlert] = useState(null);
  const [showBriefModal, setShowBriefModal] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${LATEST_BRIEF_API}?v=${Date.now()}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (data?.ok) {
          setLiveHero({
            formattedBrief: data.formattedBrief || "",
            decisionDisplay: data.decisionDisplay || "",
            actionCallout: data.actionCallout || "",
            whyFull: data.whyFull || "",
            recordId: data.recordId || "",
            headline: data.headline || "",
            subheadline: "",
            cardValue: data.cardValue || "",
            cardPriority: data.priority || "",
            timeContext: data.timeContext || "",
          });
        }
      } catch (err) {
        console.error("KitchenPulse latest brief fetch failed", err);
      }

      try {
        const alertRes = await fetch(`${HOME_ALERT_API}?v=${Date.now()}`, {
          cache: "no-store",
        });
        const alertData = await alertRes.json();

        if (alertData?.ok && alertData?.show) {
          setHomeAlert(alertData);
        } else {
          setHomeAlert(null);
        }
      } catch (err) {
        console.error("KitchenPulse home alert fetch failed", err);
        setHomeAlert(null);
      }

      const heroBtn = document.getElementById("kp-hero-brief-btn");

      if (heroBtn) {
        heroBtn.style.cursor = "pointer";
      }
    }, 500);

    return () => clearTimeout(timer);
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
    initialValue: "Today’s Decision",
  });

  const fallbackSignalLabel = useTextSetting({
    name: "fallback-signal-label",
    label: "Fallback signal label",
    initialValue: "TODAY'S CALL",
  });

  const fallbackSignalValue = useTextSetting({
    name: "fallback-signal-value",
    label: "Fallback signal value",
    initialValue: "Latest brief loading",
  });

  const fallbackPriorityLabel = useTextSetting({
    name: "fallback-priority-label",
    label: "Fallback priority label",
    initialValue: "Priority",
  });

  const fallbackPriorityValue = useTextSetting({
    name: "fallback-priority-value",
    label: "Fallback priority value",
    initialValue: "Medium",
  });

  const eyebrow = props?.eyebrow || eyebrowFallback;
  const headline = liveHero.headline || props?.heroHeadline || fallbackHeadline;

  const subheadline =
    props?.heroSubheadline ||
    "Operator guidance based on the most recent completed sales run.";

  const pill1 = props?.heroPill1 || "Latest completed service";
  const pill2 = props?.heroPill2 || "Operator AI live";
  const pill3 = cleanTimeContextLabel(liveHero.timeContext || props?.heroPill3 || "");

  const signalLabel = props?.signalLabel || fallbackSignalLabel;

  const signalValue =
    liveHero.cardValue || props?.heroCardValue || fallbackSignalValue;

  const priorityLabel = props?.priorityLabel || fallbackPriorityLabel;

  const priorityValue =
    liveHero.cardPriority || props?.heroCardPriority || fallbackPriorityValue;

  const priorityText = String(priorityValue || "").toLowerCase();

  const briefText = liveHero.formattedBrief || "";

  const getBriefSection = (startLabel, endLabels = []) => {
    if (!briefText) return "";

    const start = briefText.indexOf(startLabel);
    if (start === -1) return "";

    const afterStart = briefText.slice(start + startLabel.length).trim();

    let endIndex = afterStart.length;

    endLabels.forEach((label) => {
      const idx = afterStart.indexOf(label);
      if (idx !== -1 && idx < endIndex) endIndex = idx;
    });

    return afterStart.slice(0, endIndex).trim();
  };

  const whyNow = getBriefSection("WHY NOW", [
    "WHAT'S HAPPENING",
    "UPCOMING EVENT WATCH",
    "BIGGEST OPPORTUNITY",
    "BIGGEST RISK",
    "WHY THIS DECISION",
    "WHAT TO DO RIGHT NOW",
  ]);

  const whatsHappening = getBriefSection("WHAT'S HAPPENING", [
    "UPCOMING EVENT WATCH",
    "BIGGEST OPPORTUNITY",
    "BIGGEST RISK",
    "WHY THIS DECISION",
    "WHAT TO DO RIGHT NOW",
  ]);

  const eventWatch = getBriefSection("UPCOMING EVENT WATCH", [
    "BIGGEST OPPORTUNITY",
    "BIGGEST RISK",
    "WHY THIS DECISION",
    "WHAT TO DO RIGHT NOW",
  ]);

  const biggestOpportunity = getBriefSection("BIGGEST OPPORTUNITY", [
    "BIGGEST RISK",
    "WHY THIS DECISION",
    "WHAT TO DO RIGHT NOW",
  ]);

  const biggestRisk = getBriefSection("BIGGEST RISK", [
    "WHY THIS DECISION",
    "WHAT TO DO RIGHT NOW",
  ]);

  const whyDecision = getBriefSection("WHY THIS DECISION", [
    "WHAT TO DO RIGHT NOW",
  ]);

  const whatToDo = getBriefSection("WHAT TO DO RIGHT NOW", []);

  const cleanBriefLine = (line) => {
    return String(line || "")
      .replace(/^[-•]\s*/, "")
      .replace(/^[🎯💡🧠📊🔥⚠️✅🚀🧩🌤️]+\s*/u, "")
      .trim();
  };

  const splitBriefLines = (text) => {
    return String(text || "")
      .split(/\n/g)
      .map(cleanBriefLine)
      .filter(Boolean);
  };

  const splitBullets = (text) => {
    return String(text || "")
      .split(/\n|•/g)
      .map(cleanBriefLine)
      .filter(Boolean);
  };

  const renderBulletList = (text) => {
    const lines = splitBullets(text);

    if (!lines.length) return null;

    return (
      <ul className="mt-3 space-y-2">
        {lines.map((line, index) => (
          <li key={index} className="flex gap-2 text-sm leading-6 text-slate-700">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    );
  };

  const renderParagraphStack = (text) => {
    const lines = splitBriefLines(text);

    if (!lines.length) return null;

    return (
      <div className="mt-3 space-y-2">
        {lines.map((line, index) => (
          <p key={index} className="text-sm leading-6 text-slate-700">
            {line}
          </p>
        ))}
      </div>
    );
  };

  const renderSignalLine = (text) => {
    const lines = splitBullets(text);
    const firstLine = lines[0] || "";

    if (!firstLine) return null;

    return (
      <div className="mt-3 text-sm leading-6 text-slate-700">
        {firstLine}
      </div>
    );
  };

  const renderEventWatch = (text) => {
    const rawLines = splitBriefLines(text);

    if (!rawLines.length) return null;

    const intro = rawLines.find((line) => {
      const lower = line.toLowerCase();
      return lower.includes("upcoming") || lower.includes("may affect");
    });

    const eventLines = rawLines.filter((line) => {
      return (
        line.includes("Draw:") ||
        line.includes("Traffic:") ||
        line.includes("Confidence:") ||
        line.includes("•")
      );
    });

    const fallbackEvents = rawLines.filter((line) => line !== intro).slice(0, 3);
    const events = eventLines.length ? eventLines : fallbackEvents;

    const remaining = rawLines.filter(
      (line) => line !== intro && !events.includes(line)
    );

    return (
      <div className="mt-3 space-y-3">
        {intro ? (
          <p className="text-sm leading-6 text-slate-700">{intro}</p>
        ) : null}

        <div className="grid gap-2">
          {events.slice(0, 4).map((line, index) => (
            <div
              key={index}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-5 text-slate-700"
            >
              {line}
            </div>
          ))}
        </div>

        {remaining.slice(0, 2).map((line, index) => (
          <p key={index} className="text-sm leading-6 text-slate-600">
            {line}
          </p>
        ))}
      </div>
    );
  };

  const priorityStyle = priorityText.includes("high")
    ? {
        color: "#991B1B",
        background: "#FEE2E2",
        border: "1px solid #FCA5A5",
      }
    : priorityText.includes("low")
    ? {
        color: "#166534",
        background: "#DCFCE7",
        border: "1px solid #86EFAC",
      }
    : {
        color: "#9A3412",
        background: "#FFEDD5",
        border: "1px solid #FDBA74",
      };

  const holidayPillText =
    homeAlert?.title ||
    homeAlert?.eventName ||
    homeAlert?.dateLabel ||
    "";

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
          <div className="grid grid-cols-1 gap-8 lg:gap-10 lg:grid-cols-[1.35fr_0.85fr]">
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

                {pill3 ? (
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
                ) : null}

                {holidayPillText ? (
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium md:text-sm"
                    style={{
                      color: "#FED7AA",
                      background: "rgba(245,158,11,0.14)",
                      border: "1px solid rgba(245,158,11,0.24)",
                    }}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{
                        background: "#F59E0B",
                        boxShadow: "0 0 12px rgba(245,158,11,0.65)",
                      }}
                    />
                    {holidayPillText}
                  </span>
                ) : null}
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
                  className="mt-5 flex items-center justify-between rounded-xl px-4 py-3"
                  style={{
                    background: "rgba(15,23,42,0.62)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <span
                    style={{
                      color: "rgba(226,232,240,0.74)",
                      fontSize: "14px",
                    }}
                  >
                    {priorityLabel}
                  </span>

                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold"
                    style={priorityStyle}
                  >
                    {priorityValue}
                  </span>
                </div>

                <div
                  className="mt-4"
                  style={{
                    position: "relative",
                    zIndex: 99999,
                    pointerEvents: "auto",
                  }}
                >
                  <a
                    id="kp-hero-brief-btn"
                    href="javascript:void(0)"
                    onClick={(e) => {
                      e.preventDefault();

                      if (!liveHero?.formattedBrief && !liveHero?.decisionDisplay) {
                        alert("Brief not ready yet. Refresh and try again.");
                        return;
                      }

                      setShowBriefModal(true);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow =
                        "0 12px 28px rgba(34,211,238,.34)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow =
                        "0 9px 22px rgba(34,211,238,.26)";
                    }}
                    className="w-full rounded-xl px-4 py-2.5 font-semibold"
                    style={{
                      display: "block",
                      textAlign: "center",
                      background:
                        "linear-gradient(135deg, #06B6D4 0%, #168FC3 55%, #2563EB 100%)",
                      color: "#fff",
                      boxShadow: "0 9px 22px rgba(34,211,238,.26)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      cursor: "pointer",
                      position: "relative",
                      zIndex: 99999,
                      pointerEvents: "auto",
                      textDecoration: "none",
                      transition: "all 0.18s ease",
                    }}
                  >
                    Review Brief →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showBriefModal ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
          style={{ background: "rgba(15,23,42,0.68)" }}
        >
          <div
            className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl"
            style={{ maxHeight: "86vh", overflow: "hidden" }}
          >
            <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
              <div>
                <div
                  className="text-xs font-bold uppercase tracking-[0.14em]"
                  style={{ color: "#0891B2" }}
                >
                  Today’s Brief
                </div>

                <h2 className="mt-1 text-xl font-semibold leading-tight text-slate-900 md:text-2xl">
                  {liveHero.cardValue || "Latest Brief"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {cleanTimeContextLabel(liveHero.timeContext) ||
                    "Based on latest completed service"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowBriefModal(false)}
                className="rounded-full px-3 py-1 text-lg"
                style={{ background: "#F1F5F9" }}
              >
                ×
              </button>
            </div>

            <div
              className="px-6 py-5"
              style={{ maxHeight: "68vh", overflowY: "auto" }}
            >
              <div className="mb-4 flex items-center gap-2">
                <span
                  className="rounded-full px-3 py-1 text-sm font-semibold"
                  style={priorityStyle}
                >
                  {liveHero.cardPriority || "Priority"}
                </span>

                {liveHero.timeContext ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                    {cleanTimeContextLabel(liveHero.timeContext)}
                  </span>
                ) : null}
              </div>

              {!liveHero.formattedBrief ? (
                <div className="text-sm text-slate-500">
                  Loading latest brief...
                </div>
              ) : (
                <div className="grid gap-4">
                  {whatToDo ? (
                    <div className="rounded-xl border border-cyan-100 bg-cyan-50/70 p-4 shadow-md">
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">
                        What to do right now
                      </div>
                      {renderBulletList(whatToDo)}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {biggestRisk ? (
                      <div className="rounded-xl border border-red-100 bg-red-50/60 p-4 shadow-md">
                        <div className="text-xs font-bold uppercase tracking-[0.14em] text-red-600">
                          Biggest risk
                        </div>
                        {renderSignalLine(biggestRisk)}
                      </div>
                    ) : null}

                    {biggestOpportunity ? (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-md">
                        <div className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                          Biggest opportunity
                        </div>
                        {renderSignalLine(biggestOpportunity)}
                      </div>
                    ) : null}
                  </div>

                  {eventWatch ? (
                    <div className="rounded-xl border bg-white p-4 shadow-md">
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                        Upcoming event watch
                      </div>
                      {renderEventWatch(eventWatch)}
                    </div>
                  ) : null}

                  {whyDecision ? (
                    <div className="rounded-xl border bg-white p-4 shadow-md">
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                        Why this decision
                      </div>
                      {renderParagraphStack(whyDecision)}
                    </div>
                  ) : null}

                  {whyNow ? (
                    <div className="rounded-xl border bg-white p-4 shadow-md">
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                        Why now
                      </div>
                      {renderParagraphStack(whyNow)}
                    </div>
                  ) : null}

                  {whatsHappening ? (
                    <div className="rounded-xl border bg-white p-4 shadow-md">
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                        What’s happening
                      </div>
                      {renderParagraphStack(whatsHappening)}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
