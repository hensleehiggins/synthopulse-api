import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const BOARD_API_URL = "https://project-1csz2.vercel.app/api/tripleseat-board";
const LEADS_API_URL = "https://project-1csz2.vercel.app/api/tripleseat-leads-board";

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "$0";

  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function plural(value, singular, pluralText) {
  return Number(value) === 1 ? singular : pluralText;
}

function parseDateLabel(label) {
  if (!label || typeof label !== "string") return null;

  const clean = label.trim();

  const match = clean.match(
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})(?:,\s*(\d{1,2}):(\d{2})\s*(AM|PM))?/i
  );

  if (!match) return null;

  const monthMap = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    sept: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  const now = new Date();
  const month = monthMap[match[1].toLowerCase()];
  const day = Number(match[2]);

  let hour = match[3] ? Number(match[3]) : 23;
  const minute = match[4] ? Number(match[4]) : 59;
  const ampm = match[5] ? match[5].toUpperCase() : "";

  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  let parsed = new Date(now.getFullYear(), month, day, hour, minute, 0, 0);

  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(now.getDate() - 14);

  if (parsed < fourteenDaysAgo) {
    parsed = new Date(now.getFullYear() + 1, month, day, hour, minute, 0, 0);
  }

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function eventStartTime(event) {
  const labelDate = parseDateLabel(event?.dateLabel);
  if (labelDate) return labelDate;

  const raw =
    event?.startDateTime ||
    event?.eventDateIso ||
    event?.eventDate ||
    event?.start ||
    event?.date;

  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function isRealNextEvent(event) {
  const start = eventStartTime(event);

  if (!start) return false;

  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return start.getTime() >= tomorrow.getTime();
}

function sortByStartTime(a, b) {
  const aStart = eventStartTime(a)?.getTime() || Number.MAX_SAFE_INTEGER;
  const bStart = eventStartTime(b)?.getTime() || Number.MAX_SAFE_INTEGER;
  return aStart - bStart;
}

function KitchenPulseLockup() {
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
        AI FOR RESTAURANT OPERATORS
      </div>
    </div>
  );
}

function buildHero({ board, leads }) {
  const stats = board?.stats || {};

  const decisionDrivers = (board?.decisionDrivers || [])
    .filter(isRealNextEvent)
    .sort(sortByStartTime);

  const upcomingBookedDemand = (board?.upcomingBookedDemand || [])
    .filter(isRealNextEvent)
    .sort(sortByStartTime);

  const needsReview = (board?.needsReview || [])
    .filter(isRealNextEvent)
    .sort(sortByStartTime);

  const hotLeads = leads?.hotLeads || [];
  const leadStats = leads?.stats || {};

  const topDriver = decisionDrivers[0];
  const topUpcoming = upcomingBookedDemand[0];
  const topReview = needsReview[0];
  const topLead = hotLeads[0];

  if (topDriver) {
    return {
      headline: "Private-event pressure is active.",
      subheadline: `${topDriver.eventName} is the next booked-demand signal. KitchenPulse is watching timing, room impact, guest count, and service pressure before it hits the floor.`,
      pill1: "Tripleseat intake live",
      pill2: `${stats.decisionDrivers || decisionDrivers.length} decision ${plural(
        stats.decisionDrivers || decisionDrivers.length,
        "driver",
        "drivers"
      )}`,
      pill3: `${stats.confirmedPrivateEvents || "—"} confirmed events`,
      signalLabel: "NEXT SERVICE SIGNAL",
      signalValue: topDriver.eventName,
      signalBody: `${topDriver.dateLabel || "Date pending"}${
        topDriver.venueArea ? ` • ${topDriver.venueArea}` : ""
      }${topDriver.guestCount ? ` • ${topDriver.guestCount} guests` : ""}`,
      buttonText: "Review Demand Signals →",
    };
  }

  if (topUpcoming) {
    return {
      headline: "Booked demand is on the calendar.",
      subheadline: `${topUpcoming.eventName} is the next visible private-event demand signal. KitchenPulse is keeping upcoming booked events in view before they affect staffing, prep, pacing, or room planning.`,
      pill1: "Tripleseat intake live",
      pill2: `${stats.confirmedPrivateEvents || "—"} confirmed events`,
      pill3: "Booked-demand watch",
      signalLabel: "NEXT BOOKED EVENT",
      signalValue: topUpcoming.eventName,
      signalBody: `${topUpcoming.dateLabel || "Date pending"}${
        topUpcoming.venueArea ? ` • ${topUpcoming.venueArea}` : ""
      }${topUpcoming.guestCount ? ` • ${topUpcoming.guestCount} guests` : ""}`,
      buttonText: "Review Booked Demand →",
    };
  }

  if (topLead) {
    return {
      headline: "Private-event leads need attention.",
      subheadline: `KitchenPulse is tracking ${money(
        leadStats.openValue
      )} in open lead value, including ${
        leadStats.hotLeads || hotLeads.length
      } hot ${plural(
        leadStats.hotLeads || hotLeads.length,
        "lead",
        "leads"
      )} that could become future room, staffing, and prep demand.`,
      pill1: "Tripleseat leads live",
      pill2: `${leadStats.openLeads || "—"} open leads`,
      pill3: `${money(leadStats.openValue)} open value`,
      signalLabel: "TOP LEAD WATCH",
      signalValue: topLead.leadName || "Private event lead",
      signalBody: `${
        topLead.guestCount ? `${topLead.guestCount} guests` : "Guest count pending"
      }${topLead.dateLabel ? ` • ${topLead.dateLabel}` : ""}${
        topLead.estimatedValue ? ` • ${money(topLead.estimatedValue)} potential` : ""
      }`,
      buttonText: "Review Lead Pipeline →",
    };
  }

  if (topReview) {
    return {
      headline: "Private-event review is pending.",
      subheadline: `${topReview.eventName} needs coordinator visibility before it becomes a stronger demand signal. This keeps possible event pressure from getting lost before service planning starts.`,
      pill1: "Tripleseat intake live",
      pill2: `${stats.needsReview || needsReview.length} review ${plural(
        stats.needsReview || needsReview.length,
        "item",
        "items"
      )}`,
      pill3: "Coordinator watch",
      signalLabel: "NEEDS REVIEW",
      signalValue: topReview.eventName,
      signalBody: `${topReview.dateLabel || "Date pending"}${
        topReview.venueArea ? ` • ${topReview.venueArea}` : ""
      }${topReview.guestCount ? ` • ${topReview.guestCount} guests` : ""}`,
      buttonText: "Review Intake →",
    };
  }

  return {
    headline: "Private Events & Booked Demand",
    subheadline:
      "Track confirmed Tripleseat events, revenue signals, and private-event leads before they change prep, staffing, pacing, or demand pressure.",
    pill1: "Tripleseat intake live",
    pill2: "Private event pressure",
    pill3: "Decision-ready",
    signalLabel: "BOOKED DEMAND",
    signalValue: "Private-event pipeline is live.",
    signalBody:
      "KitchenPulse is watching booked events, lead activity, and review items from Tripleseat.",
    buttonText: "Review Booked Demand →",
  };
}

export default function Block() {
  const [hero, setHero] = useState(() => buildHero({ board: null, leads: null }));

  useEffect(() => {
    let mounted = true;

    async function loadHero() {
      try {
        const [boardRes, leadsRes] = await Promise.allSettled([
          fetch(BOARD_API_URL).then((res) => res.json()),
          fetch(LEADS_API_URL).then((res) => res.json()),
        ]);

        const board =
          boardRes.status === "fulfilled" && boardRes.value?.ok ? boardRes.value : null;

        const leads =
          leadsRes.status === "fulfilled" && leadsRes.value?.ok ? leadsRes.value : null;

        if (mounted) {
          setHero(buildHero({ board, leads }));
        }
      } catch {
        if (mounted) {
          setHero(buildHero({ board: null, leads: null }));
        }
      }
    }

    loadHero();

    return () => {
      mounted = false;
    };
  }, []);

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
                  <KitchenPulseLockup />
                </div>
              </div>

              <h1
                className="font-semibold tracking-[-0.035em] max-w-3xl"
                style={{
                  color: "#F8FAFC",
                  fontSize: "clamp(34px, 4.25vw, 58px)",
                  lineHeight: "1.02",
                  textShadow: "0 1px 18px rgba(0,0,0,0.28)",
                }}
              >
                {hero.headline}
              </h1>

              <p
                className="mt-4 max-w-2xl"
                style={{
                  color: "rgba(226,232,240,0.84)",
                  fontSize: "clamp(14px, 1.4vw, 19px)",
                  lineHeight: "1.6",
                }}
              >
                {hero.subheadline}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs md:text-sm font-medium"
                  style={{
                    color: "#E0F2FE",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{
                      background: "#22C55E",
                      boxShadow: "0 0 12px rgba(34,197,94,0.75)",
                    }}
                  />
                  {hero.pill1}
                </span>

                <span
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-xs md:text-sm font-medium"
                  style={{
                    color: "#67E8F9",
                    background: "rgba(34,211,238,0.08)",
                    border: "1px solid rgba(34,211,238,0.16)",
                  }}
                >
                  {hero.pill2}
                </span>

                <span
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-xs md:text-sm font-medium"
                  style={{
                    color: "#C7D2FE",
                    background: "rgba(99,102,241,0.12)",
                    border: "1px solid rgba(99,102,241,0.20)",
                  }}
                >
                  {hero.pill3}
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
                  {hero.signalLabel}
                </div>

                <div
                  className="mt-3 font-semibold"
                  style={{
                    color: "#F8FAFC",
                    fontSize: "clamp(22px, 2vw, 30px)",
                    lineHeight: "1.15",
                  }}
                >
                  {hero.signalValue}
                </div>

                <div
                  className="mt-3"
                  style={{
                    color: "rgba(226,232,240,0.78)",
                    fontSize: "14px",
                    lineHeight: "1.5",
                  }}
                >
                  {hero.signalBody}
                </div>

                <div className="mt-5">
                  <Button
                    type="button"
                    className="w-full font-semibold"
                    style={{
                      background:
                        "linear-gradient(135deg, #06B6D4 0%, #168FC3 55%, #2563EB 100%)",
                      color: "#fff",
                      boxShadow: "0 9px 22px rgba(34,211,238,.26)",
                      border: "1px solid rgba(255,255,255,0.14)",
                    }}
                    onClick={() => {
                      const el = document.getElementById("tripleseat-board");
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    {hero.buttonText}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
