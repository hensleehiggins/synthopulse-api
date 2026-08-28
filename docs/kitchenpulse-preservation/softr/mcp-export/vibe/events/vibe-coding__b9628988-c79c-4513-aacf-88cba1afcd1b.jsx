import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  MapPin,
  Radio,
  TrendingUp,
} from "lucide-react";

function getEventStart(event) {
  const raw =
    event?.start ||
    event?.startTime ||
    event?.startDateTime ||
    event?.startsAt ||
    event?.eventStart ||
    event?.date ||
    event?.eventDate ||
    event?.startDate ||
    event?.["Start Time"] ||
    event?.["Start DateTime"] ||
    event?.["Event Date"] ||
    event?.["Event Sort Date"] ||
    null;

  if (!raw) return null;

  if (typeof raw === "string" || raw instanceof Date || typeof raw === "number") {
    return raw;
  }

  if (typeof raw === "object") {
    return (
      raw.dateTime ||
      raw.datetime ||
      raw.date ||
      raw.start ||
      raw.value ||
      raw.iso ||
      null
    );
  }

  return null;
}

function toEventDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localDayKey(date) {
  if (!date || Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isSameLocalDay(a, b) {
  return localDayKey(a) && localDayKey(a) === localDayKey(b);
}

function isTodayOrFutureEvent(event, now) {
  if (!event?.start || Number.isNaN(event.start.getTime())) return false;

  return isSameLocalDay(event.start, now) || event.start >= now;
}

function isDecisionDriver(event) {
  return (
    event.decisionDriving === true ||
    String(event.decisionDriving).toLowerCase() === "true"
  );
}

function getPressureWeight(event) {
  return Number(event.eventWeight || event.priorityScore || 0);
}

function levelPalette(level) {
  const styles = {
    "very-high": {
      label: "Very High",
      dot: "#EA580C",
      bg: "linear-gradient(145deg, rgba(255,247,237,0.96), rgba(255,255,255,0.92))",
      border: "rgba(249,115,22,0.34)",
      text: "#EA580C",
      soft: "rgba(249,115,22,0.13)",
      glow: "rgba(249,115,22,0.18)",
      action: "Act now",
    },
    high: {
      label: "High",
      dot: "#D97706",
      bg: "linear-gradient(145deg, rgba(255,251,235,0.96), rgba(255,255,255,0.92))",
      border: "rgba(245,158,11,0.30)",
      text: "#B45309",
      soft: "rgba(245,158,11,0.12)",
      glow: "rgba(245,158,11,0.15)",
      action: "Plan around",
    },
    medium: {
      label: "Medium",
      dot: "#2563EB",
      bg: "linear-gradient(145deg, rgba(239,246,255,0.96), rgba(255,255,255,0.92))",
      border: "rgba(59,130,246,0.24)",
      text: "#2563EB",
      soft: "rgba(59,130,246,0.10)",
      glow: "rgba(59,130,246,0.13)",
      action: "Watch timing",
    },
    low: {
      label: "Low",
      dot: "#0891B2",
      bg: "linear-gradient(145deg, rgba(236,254,255,0.96), rgba(255,255,255,0.92))",
      border: "rgba(34,211,238,0.22)",
      text: "#0891B2",
      soft: "rgba(34,211,238,0.10)",
      glow: "rgba(34,211,238,0.13)",
      action: "Awareness",
    },
  };

  return styles[level] || styles.low;
}

function StatCard({ label, value, tone = "cyan", icon }) {
  const Icon = icon || CalendarDays;

  const palette =
    tone === "pressure"
      ? {
          color: "#D97706",
          bg: "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(255,247,237,0.72))",
          border: "rgba(245,158,11,0.24)",
          glow: "rgba(245,158,11,0.14)",
        }
      : tone === "blue"
        ? {
            color: "#2563EB",
            bg: "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(239,246,255,0.72))",
            border: "rgba(59,130,246,0.22)",
            glow: "rgba(59,130,246,0.13)",
          }
        : {
            color: "#0891B2",
            bg: "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(236,254,255,0.72))",
            border: "rgba(34,211,238,0.22)",
            glow: "rgba(34,211,238,0.13)",
          };

  return (
    <div
      className="relative overflow-hidden rounded-[22px] border px-4 py-3 text-center shadow-sm"
      style={{
        background: palette.bg,
        borderColor: palette.border,
        boxShadow:
          "0 10px 24px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.78)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl"
        style={{ background: palette.glow }}
      />

      <div className="relative z-10 mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full border"
        style={{
          color: palette.color,
          background: "rgba(255,255,255,0.72)",
          borderColor: palette.border,
        }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      <div className="relative z-10 text-2xl font-semibold text-slate-950">
        {value}
      </div>
      <div className="relative z-10 text-xs font-semibold uppercase tracking-[0.10em] text-slate-500">
        {label}
      </div>
    </div>
  );
}

export default function Block() {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    async function loadEvents() {
      try {
        const res = await fetch(
          "https://project-1csz2.vercel.app/api/events-timeline?restaurantId=recn2LoRESKN33zHW"
        );
        const data = await res.json();

        if (!data?.ok) throw new Error(data?.error || "Could not load events");

        let mergedEvents = data.events || [];

        try {
          const alertRes = await fetch(
            "https://project-1csz2.vercel.app/api/home-alert?restaurantId=recn2LoRESKN33zHW"
          );
          const alertData = await alertRes.json();

          if (alertData?.ok && alertData?.show) {
            const alreadyIncluded = mergedEvents.some((event) => {
              const existingId = String(
                event.externalEventId || event.id || ""
              ).toLowerCase();
              const alertId = String(alertData.externalEventId || "").toLowerCase();

              return alertId && existingId === alertId;
            });

            if (!alreadyIncluded) {
              mergedEvents = [
                ...mergedEvents,
                {
                  id:
                    alertData.recordId ||
                    alertData.externalEventId ||
                    "home-holiday-alert",
                  externalEventId: alertData.externalEventId,
                  name: alertData.eventName || "Holiday demand reminder",
                  venue: "Holiday demand signal",
                  source: alertData.source || "KitchenPulse",
                  start:
                    alertData.date ||
                    alertData.startDateTime ||
                    new Date().toISOString(),
                  eventDate:
                    alertData.date ||
                    alertData.startDateTime ||
                    new Date().toISOString(),
                  trafficEffect: alertData.pressure || "High",
                  estimatedDraw: alertData.pressure || "High",
                  confidence: "Very High",
                  eventWeight: 10,
                  decisionDriving: true,
                  type: "Holiday",
                  eventSummary: alertData.summary || "",
                },
              ];
            }
          }
        } catch (alertErr) {
          console.warn("KitchenPulse home alert timeline merge skipped", alertErr);
        }

        setEvents(mergedEvents);
        setStatus("ready");
      } catch (err) {
        console.error("KitchenPulse events timeline failed", err);
        setStatus("error");
      }
    }

    loadEvents();
  }, []);

  const parsedEvents = useMemo(() => {
    return events
      .map((event) => {
        const rawStart = getEventStart(event);
        const start = toEventDate(rawStart);

        return {
          ...event,
          start,
        };
      })
      .filter((event) => {
        if (!event.start) return false;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return event.start >= today;
      })
      .map((event) => {
        const start = event.start;

        const dateLabel = start.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

        const timeLabel = start.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        });

        const isDecisionDriving = isDecisionDriver(event);
        const weight = getPressureWeight(event);

        const impact = String(
          event.trafficEffect ||
            event.estimatedDraw ||
            event.confidence ||
            ""
        ).toLowerCase();

        const level =
          isDecisionDriving && weight >= 8
            ? "high"
            : isDecisionDriving && weight >= 7
              ? "high"
              : weight >= 9
                ? "very-high"
                : weight >= 7
                  ? "high"
                  : impact.includes("very high")
                    ? "very-high"
                    : impact.includes("high")
                      ? "high"
                      : impact.includes("medium")
                        ? "medium"
                        : "low";

        return {
          ...event,
          start,
          dateLabel,
          timeLabel,
          level,
        };
      })
      .sort((a, b) => a.start - b.start);
  }, [events]);

  const todayCount = parsedEvents.filter((event) => {
    const now = new Date();
    return isSameLocalDay(event.start, now);
  }).length;

  const highCount = parsedEvents.filter((event) =>
    ["very-high", "high"].includes(event.level)
  ).length;

  const now = new Date();

  const pressureEligibleEvents = parsedEvents
    .filter((event) => isTodayOrFutureEvent(event, now))
    .sort((a, b) => {
      const aToday = isSameLocalDay(a.start, now) ? 1 : 0;
      const bToday = isSameLocalDay(b.start, now) ? 1 : 0;

      if (aToday !== bToday) return bToday - aToday;

      const aDecision = isDecisionDriver(a) ? 1 : 0;
      const bDecision = isDecisionDriver(b) ? 1 : 0;

      if (aDecision !== bDecision) return bDecision - aDecision;

      const aWeight = getPressureWeight(a);
      const bWeight = getPressureWeight(b);

      if (aWeight !== bWeight) return bWeight - aWeight;

      const aHigh = ["very-high", "high"].includes(a.level) ? 1 : 0;
      const bHigh = ["very-high", "high"].includes(b.level) ? 1 : 0;

      if (aHigh !== bHigh) return bHigh - aHigh;

      return a.start - b.start;
    });

  const nextHigh =
    pressureEligibleEvents.find((event) => isDecisionDriver(event)) ||
    pressureEligibleEvents.find((event) =>
      ["very-high", "high"].includes(event.level)
    ) ||
    pressureEligibleEvents[0];

  const grouped = parsedEvents.reduce((acc, event) => {
    const key = event.dateLabel;
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {});

  const levelStyles = {
    "very-high": levelPalette("very-high"),
    high: levelPalette("high"),
    medium: levelPalette("medium"),
    low: levelPalette("low"),
  };

  return (
    <div className="container py-8">
      <div
        className="overflow-hidden rounded-[32px] border shadow-[0_20px_48px_rgba(15,23,42,0.10)]"
        style={{
          background:
            "radial-gradient(circle at 12% 8%, rgba(34,211,238,0.12), transparent 28%), radial-gradient(circle at 88% 10%, rgba(59,130,246,0.11), transparent 30%), linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.94) 52%, rgba(226,232,240,0.80) 100%)",
          borderColor: "rgba(15,23,42,0.08)",
          boxShadow:
            "0 18px 45px rgba(15,23,42,0.09), inset 0 1px 0 rgba(255,255,255,0.82)",
        }}
      >
        <div
          className="border-b px-6 py-6 md:px-8"
          style={{
            background:
              "linear-gradient(135deg, rgba(236,254,255,0.86), rgba(255,255,255,0.96) 48%, rgba(239,246,255,0.88))",
            borderColor: "rgba(15,23,42,0.08)",
          }}
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: "#22D3EE",
                    boxShadow: "0 0 12px #22D3EE",
                  }}
                />
                Demand Timeline
              </div>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
                Service Pressure Timeline
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                View upcoming local events by timing, draw, and likely floor impact.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label="Tracked"
                value={parsedEvents.length}
                tone="cyan"
                icon={CalendarDays}
              />

              <StatCard
                label="Today"
                value={todayCount}
                tone="blue"
                icon={Radio}
              />

              <StatCard
                label="Peak window"
                value={highCount}
                tone="pressure"
                icon={TrendingUp}
              />
            </div>
          </div>
        </div>

        {status === "loading" ? (
          <div className="p-8 text-sm text-slate-500">Loading timeline...</div>
        ) : status === "error" ? (
          <div className="p-8 text-sm text-orange-700">
            Could not load events timeline.
          </div>
        ) : (
          <div className="grid gap-0 lg:grid-cols-[0.8fr_1.2fr]">
            <div
              className="border-b p-6 md:p-8 lg:border-b-0 lg:border-r"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.88), rgba(248,250,252,0.76))",
                borderColor: "rgba(15,23,42,0.08)",
              }}
            >
              <div
                className="relative overflow-hidden rounded-[24px] border p-5 shadow-[0_12px_28px_rgba(15,23,42,0.07)]"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.76))",
                  borderColor: "rgba(34,211,238,0.18)",
                  boxShadow:
                    "0 12px 28px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.78)",
                }}
              >
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
                  style={{ background: "rgba(34,211,238,0.12)" }}
                />

                <div className="relative z-10 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  Next pressure point
                </div>

                {nextHigh ? (
                  <>
                    <div className="relative z-10 mt-3 text-xl font-semibold text-slate-950">
                      {nextHigh.name}
                    </div>

                    <div className="relative z-10 mt-2 text-sm text-slate-500">
                      {nextHigh.dateLabel} · {nextHigh.timeLabel}
                    </div>

                    <div className="relative z-10 mt-1 text-sm text-slate-500">
                      {nextHigh.venue || "Venue TBD"}
                    </div>

                    <div
                      className="relative z-10 mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold"
                      style={{
                        color: levelStyles[nextHigh.level].text,
                        background: levelStyles[nextHigh.level].soft,
                        borderColor: levelStyles[nextHigh.level].border,
                      }}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          background: levelStyles[nextHigh.level].dot,
                          boxShadow: `0 0 12px ${levelStyles[nextHigh.level].dot}`,
                        }}
                      />
                      {isDecisionDriver(nextHigh)
                        ? "Booked demand pressure"
                        : `${levelStyles[nextHigh.level].label} impact`}
                    </div>
                  </>
                ) : (
                  <div className="relative z-10 mt-3 text-sm text-slate-500">
                    No high-pressure events currently detected.
                  </div>
                )}
              </div>

              <div
                className="mt-5 rounded-[24px] border p-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(239,246,255,0.58))",
                  borderColor: "rgba(59,130,246,0.16)",
                }}
              >
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  Legend
                </div>

                <div className="mt-4 grid gap-2">
                  {Object.entries(levelStyles).map(([key, style]) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            background: style.dot,
                            boxShadow: `0 0 10px ${style.dot}`,
                          }}
                        />
                        {style.label}
                      </span>

                      <span className="text-slate-400">{style.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="p-6 md:p-8"
              style={{
                background:
                  "linear-gradient(180deg, rgba(248,250,252,0.70), rgba(255,255,255,0.88), rgba(236,254,255,0.22))",
              }}
            >
              <div className="grid gap-5">
                {Object.entries(grouped).length === 0 ? (
                  <div
                    className="rounded-[24px] border p-8 text-center shadow-[0_12px_28px_rgba(15,23,42,0.07)]"
                    style={{
                      background:
                        "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.76))",
                      borderColor: "rgba(15,23,42,0.08)",
                    }}
                  >
                    <div className="text-sm font-semibold text-slate-700">
                      No upcoming pressure timeline events found.
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      Events may still appear in the Service Pressure Board if they are in review, not decision-driving, or outside the timeline filter.
                    </div>
                  </div>
                ) : (
                  Object.entries(grouped).map(([date, dayEvents]) => (
                    <div
                      key={date}
                      className="rounded-[24px] border p-5 shadow-[0_12px_28px_rgba(15,23,42,0.07)]"
                      style={{
                        background:
                          "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.76))",
                        borderColor: "rgba(15,23,42,0.08)",
                        boxShadow:
                          "0 12px 28px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.78)",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold uppercase tracking-[0.12em] text-slate-500">
                          {date}
                        </div>

                        <div className="rounded-full border border-cyan-100 bg-cyan-50/70 px-2.5 py-1 text-xs font-semibold text-cyan-700">
                          {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3">
                        {dayEvents.map((event) => {
                          const style = levelStyles[event.level];
                          const decisionDriver = isDecisionDriver(event);

                          const isHighPressure =
                            Number(event.eventWeight || 0) >= 8 && !decisionDriver;

                          const localText = `${event.source || ""} ${event.venue || ""} ${event.name || ""}`.toLowerCase();

                          const isLocalEvent =
                            localText.includes("manual") ||
                            localText.includes("local") ||
                            localText.includes("winder") ||
                            localText.includes("chloe") ||
                            localText.includes("speakeasy") ||
                            localText.includes("jackson plaza");

                          return (
                            <div
                              key={event.id}
                              className="relative overflow-hidden rounded-[18px] border p-4 shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md"
                              style={{
                                background: style.bg,
                                borderColor: style.border,
                                boxShadow:
                                  "0 8px 20px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.70)",
                              }}
                            >
                              <div
                                className="pointer-events-none absolute inset-y-0 left-0 w-1"
                                style={{ background: style.dot }}
                              />

                              <div
                                className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
                                style={{ background: style.glow }}
                              />

                              <div className="relative z-10 flex items-start justify-between gap-4">
                                <div>
                                  <div className="text-sm font-semibold text-slate-950">
                                    {event.name}
                                  </div>

                                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="h-3.5 w-3.5" />
                                      {event.timeLabel}
                                    </span>

                                    <span className="inline-flex items-center gap-1">
                                      <MapPin className="h-3.5 w-3.5" />
                                      {event.venue || "Venue TBD"}
                                    </span>
                                  </div>

                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {decisionDriver ? (
                                      <div
                                        className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                                        style={{
                                          background: "rgba(249,115,22,0.13)",
                                          color: "#EA580C",
                                          border: "1px solid rgba(249,115,22,0.24)",
                                        }}
                                      >
                                        Operational impact
                                      </div>
                                    ) : isHighPressure ? (
                                      <div
                                        className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                                        style={{
                                          background: "rgba(245,158,11,0.12)",
                                          color: "#B45309",
                                          border: "1px solid rgba(245,158,11,0.24)",
                                        }}
                                      >
                                        Peak demand window
                                      </div>
                                    ) : null}

                                    {isLocalEvent ? (
                                      <div
                                        className="inline-flex rounded-full px-2 py-[2px] text-[10px] font-semibold"
                                        style={{
                                          background: "rgba(34,211,238,0.10)",
                                          color: "#0891B2",
                                          border: "1px solid rgba(34,211,238,0.20)",
                                        }}
                                      >
                                        Nearby driver
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
