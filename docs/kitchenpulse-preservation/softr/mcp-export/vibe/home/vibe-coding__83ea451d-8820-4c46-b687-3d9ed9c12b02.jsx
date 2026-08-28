import { useEffect, useState } from "react";

const SHIFT_WATCH_API = "https://project-1csz2.vercel.app/api/shift-watch";

function toneClass(tone) {
  const normalized = String(tone || "").toLowerCase();

  if (normalized.includes("critical") || normalized.includes("hot")) {
    return "bg-red-50 text-red-700 border-red-200";
  }

  if (normalized.includes("high") || normalized.includes("spicy")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (normalized.includes("watch") || normalized.includes("warm")) {
    return "bg-cyan-50 text-cyan-700 border-cyan-200";
  }

  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function cardStyle(tone, index) {
  const normalized = String(tone || "").toLowerCase();

  if (normalized.includes("critical") || normalized.includes("hot")) {
    return {
      rail: "#EF4444",
      glow: "rgba(239,68,68,0.14)",
      iconBg: "rgba(239,68,68,0.12)",
      iconColor: "#DC2626",
      borderColor: "rgba(239,68,68,0.18)",
    };
  }

  if (normalized.includes("high") || normalized.includes("spicy")) {
    return {
      rail: "#F59E0B",
      glow: "rgba(245,158,11,0.14)",
      iconBg: "rgba(245,158,11,0.12)",
      iconColor: "#D97706",
      borderColor: "rgba(245,158,11,0.18)",
    };
  }

  if (normalized.includes("watch") || normalized.includes("warm")) {
    return {
      rail: "#06B6D4",
      glow: "rgba(34,211,238,0.14)",
      iconBg: "rgba(34,211,238,0.12)",
      iconColor: "#0891B2",
      borderColor: "rgba(34,211,238,0.18)",
    };
  }

  const fallback = [
    {
      rail: "#22C55E",
      glow: "rgba(34,197,94,0.12)",
      iconBg: "rgba(34,197,94,0.12)",
      iconColor: "#16A34A",
      borderColor: "rgba(34,197,94,0.18)",
    },
    {
      rail: "#06B6D4",
      glow: "rgba(34,211,238,0.12)",
      iconBg: "rgba(34,211,238,0.12)",
      iconColor: "#0891B2",
      borderColor: "rgba(34,211,238,0.18)",
    },
    {
      rail: "#6366F1",
      glow: "rgba(99,102,241,0.12)",
      iconBg: "rgba(99,102,241,0.12)",
      iconColor: "#4F46E5",
      borderColor: "rgba(99,102,241,0.18)",
    },
    {
      rail: "#14B8A6",
      glow: "rgba(20,184,166,0.12)",
      iconBg: "rgba(20,184,166,0.12)",
      iconColor: "#0F766E",
      borderColor: "rgba(20,184,166,0.18)",
    },
  ];

  return fallback[index % fallback.length];
}

function WatchCard({ eyebrow, title, meta, body, tone, icon, index }) {
  const style = cardStyle(tone, index);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.74))",
        borderColor: style.borderColor,
        boxShadow:
          "0 9px 22px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.82)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: style.rail }}
      />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl opacity-70"
        style={{ background: style.glow }}
      />

      <div className="relative z-10 mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-base shadow-sm"
            style={{
              background: style.iconBg,
              color: style.iconColor,
              border: `1px solid ${style.borderColor}`,
            }}
          >
            {icon}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </div>
        </div>
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm ${toneClass(
            tone
          )}`}
        >
          {tone}
        </span>
      </div>

      <div className="relative z-10 space-y-1.5">
        <div className="text-base font-semibold leading-snug text-foreground">
          {title}
        </div>
        {meta ? (
          <div className="text-xs font-medium text-muted-foreground">{meta}</div>
        ) : null}
        <div className="pt-1 text-sm leading-relaxed text-muted-foreground">
          {body}
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
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
          <div className="text-sm text-muted-foreground">Loading shift watch...</div>
        </section>
      </div>
    </div>
  );
}

export default function Block() {
  const [watch, setWatch] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  async function loadWatch() {
    setStatus("loading");
    setError("");

    try {
      const response = await fetch(`${SHIFT_WATCH_API}?v=${Date.now()}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || `Shift Watch returned ${response.status}`);
      }

      setWatch(payload);
      setStatus("ready");
    } catch (err) {
      setWatch(null);
      setError(err?.message || "Shift Watch could not load.");
      setStatus("error");
    }
  }

  useEffect(() => {
    loadWatch();
  }, []);

  if (status === "loading") return <LoadingState />;

  if (status === "error") {
    return (
      <div className="container py-4">
        <div className="content">
          <section className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <div className="font-semibold text-red-800">Shift Watch could not load</div>
            <div className="mt-1 text-sm text-red-700">{error}</div>
            <button
              type="button"
              onClick={loadWatch}
              className="mt-3 rounded-full bg-red-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
            >
              Try again
            </button>
          </section>
        </div>
      </div>
    );
  }

  const local = watch?.localPressure || {};
  const booked = watch?.bookedDemand || {};
  const coverage = watch?.coverage || {};
  const spice = watch?.shiftSpice || {};

  return (
    <div className="container py-4">
      <div className="content">
        <section
          className="relative overflow-hidden rounded-3xl border p-5 shadow-xl"
          style={{
            background:
              "radial-gradient(circle at 12% 8%, rgba(34,211,238,0.08), transparent 30%), radial-gradient(circle at 86% 16%, rgba(59,130,246,0.06), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(248,250,252,0.94) 55%, rgba(241,245,249,0.86) 100%)",
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

          <div className="relative z-10">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
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
                    ⚡
                  </span>
                  Operator quick glance
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-heading font-semibold tracking-tight">
                    Tonight’s Shift Watch
                  </h2>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClass(
                      spice.tone
                    )}`}
                  >
                    {String(spice.meta || "Overall spice level: Mild").replace(
                      "Overall spice level: ",
                      ""
                    )}
                  </span>
                </div>

                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Local pressure, booked demand, staffing coverage, and shift spice level before the floor gets surprised.
                </p>
              </div>

              <button
                type="button"
                onClick={loadWatch}
                className="rounded-full border px-3 py-2 text-xs font-semibold shadow-sm transition hover:bg-white"
                style={{
                  color: "#334155",
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
                  borderColor: "rgba(15,23,42,0.08)",
                }}
              >
                Refresh scan
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <WatchCard
                eyebrow="Local pressure"
                icon="📍"
                tone={local.tone || "Clear"}
                title={local.title || "Outside pressure clear"}
                meta={local.meta || "No outside surge in today’s service window"}
                body={local.body || "Outside pressure looks clear."}
                index={0}
              />

              <WatchCard
                eyebrow="Booked demand"
                icon="🍽️"
                tone={booked.tone || "Quiet"}
                title={booked.title || "No private event pressure"}
                meta={booked.meta || "No booked demand in today’s service window"}
                body={booked.body || "No active private event is currently driving Shift Watch."}
                index={1}
              />

              <WatchCard
                eyebrow="Coverage watch"
                icon="👥"
                tone={coverage.tone || "Watch"}
                title={coverage.title || "Coverage needs review"}
                meta={coverage.meta || "Manager check recommended"}
                body={coverage.body || "Confirm service coverage before the floor gets busy."}
                index={2}
              />

              <WatchCard
                eyebrow="Shift spice level"
                icon="🌶️"
                tone={spice.tone || "Clear"}
                title={spice.title || "Mild shift expected"}
                meta={spice.meta || "Overall spice level: Mild"}
                body={spice.body || "Normal pre-service scan."}
                index={3}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

