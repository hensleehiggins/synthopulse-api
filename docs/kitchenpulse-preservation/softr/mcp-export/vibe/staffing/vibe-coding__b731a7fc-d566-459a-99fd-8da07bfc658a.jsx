import { useEffect, useMemo, useState } from "react";
import { useTextSetting } from "@/lib/editable-settings";

const STAFFING_API_URL = "https://project-1csz2.vercel.app/api/staffing-board";
const RELIABILITY_API_URL =
  "https://project-1csz2.vercel.app/api/staff-reliability-signals";

function numberOrZero(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function plural(value, singular, pluralText) {
  return value === 1 ? singular : pluralText;
}

function firstNames(signals) {
  const names = [];

  for (const signal of signals || []) {
    if (signal?.employeeName && !names.includes(signal.employeeName)) {
      names.push(signal.employeeName);
    }
  }

  if (!names.length) return "";

  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;

  return `${names[0]}, ${names[1]}, and ${names.length - 2} more`;
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
  const [staffingData, setStaffingData] = useState(null);
  const [reliabilityData, setReliabilityData] = useState(null);
  const [status, setStatus] = useState("loading");

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
    initialValue: "Staffing & Floor Coverage",
  });

  const fallbackSubheadline = useTextSetting({
    name: "fallback-subheadline",
    label: "Fallback subheadline",
    initialValue:
      "See who is scheduled, where coverage is thin, and what staffing risks may affect service.",
  });

  useEffect(() => {
    let mounted = true;

    async function loadHeroSignal() {
      try {
        setStatus("loading");

        const [staffingRes, reliabilityRes] = await Promise.allSettled([
          fetch(STAFFING_API_URL),
          fetch(RELIABILITY_API_URL),
        ]);

        if (!mounted) return;

        if (staffingRes.status === "fulfilled") {
          const staffingJson = await staffingRes.value.json();
          if (staffingRes.value.ok && staffingJson?.ok) {
            setStaffingData(staffingJson);
          }
        }

        if (reliabilityRes.status === "fulfilled") {
          const reliabilityJson = await reliabilityRes.value.json();
          if (reliabilityRes.value.ok && reliabilityJson?.ok) {
            setReliabilityData(reliabilityJson);
          }
        }

        setStatus("success");
      } catch (err) {
        if (mounted) {
          setStatus("error");
        }
      }
    }

    loadHeroSignal();

    return () => {
      mounted = false;
    };
  }, []);

  const derived = useMemo(() => {
    const stats = staffingData?.stats || {};
    const todayShifts = staffingData?.todayShifts || [];
    const coverageWarnings = staffingData?.coverageWarnings || [];
    const activeByDepartment = staffingData?.activeByDepartment || {};

    const activeSignals = reliabilityData?.activeSignals || [];
    const realActiveSignals = activeSignals.filter((signal) => !signal.isDemo);

    const todayCount = numberOrZero(stats.todayStaffCount || todayShifts.length);
    const coverageGapCount = numberOrZero(coverageWarnings.length);
    const reliabilityCount = numberOrZero(
      reliabilityData?.realActiveCount ?? realActiveSignals.length
    );

    const managerCount =
      numberOrZero(activeByDepartment.Management) ||
      todayShifts.filter((shift) => shift.isManager).length;

    const bohCount = numberOrZero(activeByDepartment.BOH);
    const fohCount = numberOrZero(activeByDepartment.FOH);
    const barCount = numberOrZero(activeByDepartment.Bar);

    if (status === "loading") {
      return {
        signalLabel: "LIVE STAFFING SIGNAL",
        signalValue: "Checking today’s floor coverage…",
        detail:
          "KitchenPulse is reading schedule, coverage, and staff reliability signals.",
        pill1: "Connecteam-ready",
        pill2: "Syncing floor data",
        pill3: "Staffing-aware",
        statA: "—",
        statALabel: "On today",
        statB: "—",
        statBLabel: "Coverage gaps",
        statC: "—",
        statCLabel: "Reliability watch",
        cueLabel: "Operator cue",
        cueText: "Loading the latest staffing signal.",
      };
    }

    if (reliabilityCount > 0) {
      const names = firstNames(realActiveSignals);

      return {
        signalLabel: "ATTENDANCE RISK",
        signalValue: `${reliabilityCount} ${plural(
          reliabilityCount,
          "staff reliability signal is",
          "staff reliability signals are"
        )} active.`,
        detail: names
          ? `${names} should be reviewed before relying on coverage for service.`
          : "Review reliability watch before assuming coverage is safe.",
        pill1: "Connecteam-ready",
        pill2: `${todayCount} on today`,
        pill3: `${reliabilityCount} reliability watch`,
        statA: todayCount,
        statALabel: "On today",
        statB: coverageGapCount,
        statBLabel: "Coverage gaps",
        statC: reliabilityCount,
        statCLabel: "Reliability watch",
        cueLabel: "Operator cue",
        cueText:
          "Confirm attendance and backup coverage before the rush, especially for roles already thin on the floor.",
      };
    }

    if (coverageGapCount > 0) {
      return {
        signalLabel: "COVERAGE GAP",
        signalValue: `${coverageGapCount} ${plural(
          coverageGapCount,
          "coverage gap needs",
          "coverage gaps need"
        )} attention.`,
        detail:
          "Review BOH, manager, bar, and support coverage before service pressure builds.",
        pill1: "Connecteam-ready",
        pill2: `${todayCount} on today`,
        pill3: `${coverageGapCount} coverage gaps`,
        statA: todayCount,
        statALabel: "On today",
        statB: coverageGapCount,
        statBLabel: "Coverage gaps",
        statC: managerCount,
        statCLabel: "Managers",
        cueLabel: "Operator cue",
        cueText:
          "Coverage is the priority. Confirm who is actually on property and where backup is needed.",
      };
    }

    if (todayCount > 0) {
      return {
        signalLabel: "TODAY’S FLOOR",
        signalValue: `${todayCount} ${plural(
          todayCount,
          "person is",
          "people are"
        )} scheduled today.`,
        detail: `Current read: ${fohCount} FOH, ${bohCount} BOH, ${barCount} bar, ${managerCount} manager coverage.`,
        pill1: "Connecteam-ready",
        pill2: "Floor coverage",
        pill3: "Staffing-aware",
        statA: todayCount,
        statALabel: "On today",
        statB: coverageGapCount,
        statBLabel: "Coverage gaps",
        statC: reliabilityCount,
        statCLabel: "Reliability watch",
        cueLabel: "Operator cue",
        cueText:
          "No active reliability watch is showing. Use the floor board to confirm coverage before service.",
      };
    }

    return {
      signalLabel: "STAFFING SYNC",
      signalValue: "Staffing data is waiting for the next schedule signal.",
      detail:
        "KitchenPulse is ready to read coverage once Connecteam shifts are available.",
      pill1: "Connecteam-ready",
      pill2: "Floor coverage",
      pill3: "Staffing-aware",
      statA: 0,
      statALabel: "On today",
      statB: 0,
      statBLabel: "Coverage gaps",
      statC: 0,
      statCLabel: "Reliability watch",
      cueLabel: "Operator cue",
      cueText:
        "No active staffing signal is available yet. Check again after the next schedule sync.",
    };
  }, [staffingData, reliabilityData, status]);

  const eyebrow = props?.eyebrow || eyebrowFallback;
  const headline = props?.heroHeadline || fallbackHeadline;
  const subheadline = props?.heroSubheadline || fallbackSubheadline;

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
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.28fr_0.92fr] lg:gap-10">
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
                  {derived.pill1}
                </span>

                <span
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium md:text-sm"
                  style={{
                    color: "#67E8F9",
                    background: "rgba(34,211,238,0.08)",
                    border: "1px solid rgba(34,211,238,0.16)",
                  }}
                >
                  {derived.pill2}
                </span>

                <span
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium md:text-sm"
                  style={{
                    color: "#C7D2FE",
                    background: "rgba(99,102,241,0.12)",
                    border: "1px solid rgba(99,102,241,0.20)",
                  }}
                >
                  {derived.pill3}
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
                  {derived.signalLabel}
                </div>

                <div
                  className="mt-3 font-semibold"
                  style={{
                    color: "#F8FAFC",
                    fontSize: "clamp(22px, 2vw, 31px)",
                    lineHeight: "1.15",
                  }}
                >
                  {derived.signalValue}
                </div>

                <div
                  className="mt-3"
                  style={{
                    color: "rgba(226,232,240,0.78)",
                    fontSize: "14px",
                    lineHeight: "1.5",
                  }}
                >
                  {derived.detail}
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div
                    className="rounded-2xl px-3 py-3 text-center"
                    style={{
                      background: "rgba(14,165,233,0.10)",
                      border: "1px solid rgba(125,211,252,0.16)",
                    }}
                  >
                    <div className="text-xl font-bold text-sky-100">
                      {derived.statA}
                    </div>
                    <div className="mt-0.5 text-[10px] text-sky-200/80">
                      {derived.statALabel}
                    </div>
                  </div>

                  <div
                    className="rounded-2xl px-3 py-3 text-center"
                    style={{
                      background: "rgba(245,158,11,0.10)",
                      border: "1px solid rgba(252,211,77,0.16)",
                    }}
                  >
                    <div className="text-xl font-bold text-amber-100">
                      {derived.statB}
                    </div>
                    <div className="mt-0.5 text-[10px] text-amber-100/80">
                      {derived.statBLabel}
                    </div>
                  </div>

                  <div
                    className="rounded-2xl px-3 py-3 text-center"
                    style={{
                      background: "rgba(168,85,247,0.12)",
                      border: "1px solid rgba(216,180,254,0.18)",
                    }}
                  >
                    <div className="text-xl font-bold text-purple-100">
                      {derived.statC}
                    </div>
                    <div className="mt-0.5 text-[10px] text-purple-100/80">
                      {derived.statCLabel}
                    </div>
                  </div>
                </div>

                <div
                  className="mt-5 rounded-2xl px-4 py-3"
                  style={{
                    background: "rgba(15,23,42,0.45)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      color: "#93C5FD",
                      fontSize: "10px",
                      fontWeight: 800,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                    }}
                  >
                    {derived.cueLabel}
                  </div>

                  <div
                    className="mt-1"
                    style={{
                      color: "rgba(226,232,240,0.84)",
                      fontSize: "13px",
                      lineHeight: "1.45",
                    }}
                  >
                    {derived.cueText}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div> 
      </div>
    </div>
  );
}
