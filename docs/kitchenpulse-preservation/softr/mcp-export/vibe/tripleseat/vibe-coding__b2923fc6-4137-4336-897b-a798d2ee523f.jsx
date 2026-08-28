import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CalendarDays,
  Circle,
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

const API_URL = "https://project-1csz2.vercel.app/api/tripleseat-board";

function valueOrDash(value) {
  return value || "—";
}

function getToneMeta(tone = "default") {
  if (tone === "driver") {
    return {
      label: "Driver",
      color: "#B45309",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.16)",
      glow: "rgba(245,158,11,0.045)",
      icon: TrendingUp,
    };
  }

  if (tone === "review") {
    return {
      label: "Review",
      color: "#D97706",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.16)",
      glow: "rgba(245,158,11,0.045)",
      icon: AlertCircle,
    };
  }

  return {
    label: "Booked",
    color: "#0891B2",
    bg: "rgba(34,211,238,0.08)",
    border: "rgba(34,211,238,0.14)",
    glow: "rgba(34,211,238,0.045)",
    icon: CalendarDays,
  };
}

function EventCard({ event, tone = "default" }) {
  const meta = getToneMeta(tone);
  const BadgeIcon = meta.icon;

  return (
    <Card
      className="relative overflow-hidden rounded-2xl border shadow-sm transition hover:shadow-md"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.76))",
        borderColor: "rgba(15,23,42,0.08)",
        boxShadow:
          "0 10px 24px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.84)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1"
        style={{ background: meta.color }}
      />

      <div
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
        style={{ background: meta.glow }}
      />

      <CardContent className="relative z-10 p-4">
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-semibold text-[15px] leading-tight text-slate-950">
            {event.eventName || "Unnamed private event"}
          </h4>

          {event.decisionDrivingEvent ? (
            <Badge
              className="inline-flex items-center gap-1 border text-[11px] font-semibold hover:bg-transparent"
              style={{
                color: getToneMeta("driver").color,
                background: getToneMeta("driver").bg,
                borderColor: getToneMeta("driver").border,
              }}
            >
              <TrendingUp className="h-3 w-3" />
              Driver
            </Badge>
          ) : event.needsReview ? (
            <Badge
              className="inline-flex items-center gap-1 border text-[11px] font-semibold hover:bg-transparent"
              style={{
                color: getToneMeta("review").color,
                background: getToneMeta("review").bg,
                borderColor: getToneMeta("review").border,
              }}
            >
              <AlertCircle className="h-3 w-3" />
              Review
            </Badge>
          ) : (
            <Badge
              className="inline-flex items-center gap-1 border text-[11px] font-semibold hover:bg-transparent"
              style={{
                color: getToneMeta("default").color,
                background: getToneMeta("default").bg,
                borderColor: getToneMeta("default").border,
              }}
            >
              <BadgeIcon className="h-3 w-3" />
              Booked
            </Badge>
          )}
        </div>

        <div className="mt-3 space-y-1.5 text-xs text-slate-600">
          {event.dateLabel ? (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>{event.dateLabel}</span>
            </div>
          ) : null}

          {event.venueArea ? (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              <span>{event.venueArea}</span>
            </div>
          ) : null}

          {event.guestCount ? (
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span>{event.guestCount} guests</span>
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {event.tripleseatStatus ? (
            <Badge
              className="border text-[10px] font-semibold hover:bg-transparent"
              style={{
                color: "#475569",
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
                borderColor: "rgba(15,23,42,0.08)",
              }}
            >
              {event.tripleseatStatus}
            </Badge>
          ) : null}

          {event.estimatedDraw ? (
            <Badge
              className="border text-[10px] font-semibold hover:bg-transparent"
              style={{
                color: "#475569",
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
                borderColor: "rgba(15,23,42,0.08)",
              }}
            >
              {event.estimatedDraw} draw
            </Badge>
          ) : null}

          {event.eventWeight ? (
            <Badge
              className="border text-[10px] font-semibold hover:bg-transparent"
              style={{
                color: "#475569",
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
                borderColor: "rgba(15,23,42,0.08)",
              }}
            >
              Weight {event.eventWeight}/10
            </Badge>
          ) : event.suggestedEventWeight ? (
            <Badge
              className="border text-[10px] font-semibold hover:bg-transparent"
              style={{
                color: "#475569",
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
                borderColor: "rgba(15,23,42,0.08)",
              }}
            >
              Suggested {event.suggestedEventWeight}/10
            </Badge>
          ) : null}
        </div>

        {event.decisionNote || event.eventSummary ? (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            {event.decisionNote || event.eventSummary}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }) {
  return (
    <div
      className="rounded-2xl border border-dashed p-5 text-sm text-slate-500"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.90), rgba(248,250,252,0.70))",
        borderColor: "rgba(15,23,42,0.10)",
      }}
    >
      {text}
    </div>
  );
}

function StatCard({ label, value, tone = "default" }) {
  const meta = getToneMeta(tone);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border px-4 py-3 text-center shadow-sm"
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

      <div className="text-xl font-semibold text-slate-950">{valueOrDash(value)}</div>
      <div className="mt-0.5 text-[11px] font-medium text-slate-500">{label}</div>
    </div>
  );
}

function SectionPanel({ title, subtitle, tone, icon, count, children }) {
  const meta = getToneMeta(tone);
  const Icon = icon || meta.icon;

  return (
    <section
      className="relative overflow-hidden rounded-3xl border p-4 shadow-sm"
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
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl"
        style={{ background: meta.glow }}
      />

      <div className="relative z-10 mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-2xl border shadow-sm"
              style={{
                color: meta.color,
                background: meta.bg,
                borderColor: meta.border,
              }}
            >
              <Icon className="h-4 w-4" />
            </div>

            <h3 className="text-xl font-heading font-semibold tracking-tight text-slate-950">
              {title}
            </h3>
          </div>

          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            {subtitle}
          </p>
        </div>

        <span
          className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
          style={{
            color: meta.color,
            background: meta.bg,
            borderColor: meta.border,
          }}
        >
          {count}
        </span>
      </div>

      <div className="relative z-10 space-y-3">{children}</div>
    </section>
  );
}

export default function Block() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setStatus("loading");
        const res = await fetch(API_URL);
        const json = await res.json();

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Could not load Tripleseat board.");
        }

        if (mounted) {
          setData(json);
          setStatus("success");
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || "Could not load Tripleseat board.");
          setStatus("error");
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const stats = data?.stats || {};

  const needsReviewAll = data?.needsReview || [];
  const decisionDriversAll = data?.decisionDrivers || [];
  const upcomingBookedDemandAll = data?.upcomingBookedDemand || [];
  const activeTodayAll = data?.activeToday || [];

  const needsReview = needsReviewAll.slice(0, 3);
  const decisionDrivers = decisionDriversAll.slice(0, 3);
  const activeToday = activeTodayAll.slice(0, 1);

  const upcomingBookedDemand = upcomingBookedDemandAll
    .filter((event) => !activeToday.some((active) => active.id === event.id))
    .slice(0, activeToday.length ? 2 : 3);

  return (
    <div id="tripleseat-board" className="container py-4">
      <div className="content space-y-6">
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

          <div
            className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full blur-3xl"
            style={{ background: "rgba(148,163,184,0.07)" }}
          />

          <div className="relative z-10">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
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
                  Private Event Board
                </div>

                <h2 className="text-2xl font-heading font-semibold tracking-tight text-slate-950">
                  Booked Demand Pipeline
                </h2>

                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
                  Track Tripleseat intake, confirmed private events, and decision-driving demand pressure.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <StatCard
                  label="Confirmed"
                  value={stats.confirmedPrivateEvents}
                  tone="default"
                />
                <StatCard
                  label="Drivers"
                  value={stats.decisionDrivers}
                  tone="driver"
                />
                <StatCard
                  label="Review"
                  value={stats.needsReview}
                  tone="review"
                />
              </div>
            </div>

            {status === "loading" ? (
              <div
                className="rounded-2xl border p-4 text-sm text-slate-500 shadow-sm"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.76))",
                  borderColor: "rgba(15,23,42,0.08)",
                }}
              >
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />
                  Loading Tripleseat demand...
                </div>
              </div>
            ) : null}

            {status === "error" ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  <span>{error}</span>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {status === "success" ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <SectionPanel
              title="Needs Review"
              subtitle="Tripleseat intake records that need a quick human check before they influence guidance."
              tone="review"
              icon={AlertCircle}
              count={needsReviewAll.length}
            >
              {needsReview.length ? (
                needsReview.map((event) => (
                  <EventCard key={event.id} event={event} tone="review" />
                ))
              ) : (
                <EmptyState text="No Tripleseat intake records need review." />
              )}
            </SectionPanel>

            <SectionPanel
              title="Decision Drivers"
              subtitle="Confirmed private events currently strong enough to shape the operating read."
              tone="driver"
              icon={TrendingUp}
              count={decisionDriversAll.length}
            >
              {decisionDrivers.length ? (
                decisionDrivers.map((event) => (
                  <EventCard key={event.id} event={event} tone="driver" />
                ))
              ) : (
                <EmptyState text="No confirmed private events are currently driving decisions." />
              )}
            </SectionPanel>

            <SectionPanel
              title="Upcoming Booked Demand"
              subtitle="Confirmed demand ahead, including active events when they are already in play."
              tone="default"
              icon={CalendarDays}
              count={activeTodayAll.length + upcomingBookedDemandAll.length}
            >
              {activeToday.length
                ? activeToday.map((event) => (
                    <EventCard key={event.id} event={event} tone="driver" />
                  ))
                : null}

              {upcomingBookedDemand.length
                ? upcomingBookedDemand.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))
                : activeToday.length
                  ? null
                  : (
                    <EmptyState text="No upcoming Tripleseat private events found yet." />
                  )}
            </SectionPanel>
          </div>
        ) : null}
      </div>
    </div>
  );
}
