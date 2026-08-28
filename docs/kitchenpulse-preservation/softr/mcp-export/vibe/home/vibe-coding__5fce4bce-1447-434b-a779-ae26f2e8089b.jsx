import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Megaphone,
  RefreshCw,
  Sparkles,
  Utensils,
} from "lucide-react";

const HUDDLE_API = "https://project-1csz2.vercel.app/api/pre-shift-huddle";

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

function getToneClass(tone: string) {
  const t = fieldText(tone).toLowerCase();

  if (t.includes("hot")) return "bg-red-50 text-red-700 border-red-200";
  if (t.includes("spicy")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (t.includes("warm")) return "bg-cyan-50 text-cyan-700 border-cyan-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function getAccentClass(tone: string) {
  const t = fieldText(tone).toLowerCase();

  if (t.includes("hot")) return "border-l-red-500";
  if (t.includes("spicy")) return "border-l-amber-500";
  if (t.includes("warm")) return "border-l-cyan-500";
  return "border-l-emerald-500";
}

function getToneLabel(tone: string) {
  const clean = fieldText(tone).trim();
  return clean || "Steady";
}

function getToneGlow(tone: string) {
  const t = fieldText(tone).toLowerCase();

  if (t.includes("hot")) return "rgba(249,115,22,0.10)";
  if (t.includes("spicy")) return "rgba(245,158,11,0.10)";
  if (t.includes("warm")) return "rgba(59,130,246,0.08)";
  return "rgba(148,163,184,0.07)";
}

function getWatchStyle(index: number) {
  if (index === 0) {
    return {
      iconBg: "rgba(34,211,238,0.08)",
      iconColor: "#0891B2",
      borderColor: "rgba(34,211,238,0.14)",
      glow: "rgba(34,211,238,0.045)",
    };
  }

  if (index === 1) {
    return {
      iconBg: "rgba(245,158,11,0.08)",
      iconColor: "#D97706",
      borderColor: "rgba(245,158,11,0.16)",
      glow: "rgba(245,158,11,0.045)",
    };
  }

  return {
    iconBg: "rgba(59,130,246,0.08)",
    iconColor: "#2563EB",
    borderColor: "rgba(59,130,246,0.14)",
    glow: "rgba(59,130,246,0.045)",
  };
}

function DetailCard({
  label,
  icon,
  index = 0,
  children,
}: {
  label: string;
  icon?: any;
  index?: number;
  children: any;
}) {
  const Icon = icon;
  const style = getWatchStyle(index);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 shadow-sm"
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
        style={{ background: style.borderColor }}
      />

      <div
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
        style={{ background: style.glow }}
      />

      <div className="relative z-10 mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {Icon ? (
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full"
            style={{
              background: style.iconBg,
              color: style.iconColor,
              border: `1px solid ${style.borderColor}`,
            }}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
        {label}
      </div>

      <div className="relative z-10 text-sm leading-relaxed text-foreground">
        {children}
      </div>
    </div>
  );
}

function SignalPill({ children }: { children: any }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm"
      style={{
  color: "#334155",
  background:
    "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
  borderColor: "rgba(15,23,42,0.08)",
}}
    >
      {children}
    </span>
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
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />
            Building a live pre-shift huddle...
          </div>
        </section>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: any }) {
  return (
    <div className="container py-4">
      <div className="content">
        <section className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <div className="font-semibold text-red-800">
                Pre-shift huddle could not load
              </div>
              <div className="mt-1 text-sm text-red-700">
                {error || "KitchenPulse could not reach the huddle endpoint."}
              </div>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-red-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-800"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function Block() {
  const [huddle, setHuddle] = useState<any>(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  async function loadHuddle() {
    setStatus("loading");
    setError("");

    try {
      const response = await fetch(`${HUDDLE_API}?ts=${Date.now()}`);
      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || `Huddle API returned ${response.status}`);
      }

      setHuddle(json);
      setStatus("ready");
    } catch (err: any) {
      setHuddle(null);
      setError(err?.message || "Unknown huddle error.");
      setStatus("error");
    }
  }

  useEffect(() => {
    loadHuddle();
  }, []);

  const tone = getToneLabel(huddle?.tone);

  const watchPoints = useMemo(() => {
    const points = Array.isArray(huddle?.watchPoints)
      ? huddle.watchPoints.map(fieldText).filter(Boolean)
      : [];

    if (points.length) return points.slice(0, 3);

    return [
      "Host/floor: keep communication tight and set expectations early.",
      "Kitchen/bar: protect timing and handoffs before pressure stacks up.",
      "Menu/service: lean into the current KitchenPulse recommendation.",
    ];
  }, [huddle]);

  const signalsUsed = useMemo(() => {
    const signals = Array.isArray(huddle?.signalsUsed)
      ? huddle.signalsUsed.map(fieldText).filter(Boolean)
      : [];

    return signals.length ? signals : ["Latest brief", "Events", "Staffing"];
  }, [huddle]);

  if (status === "loading") return <LoadingState />;

  if (status === "error") {
    return <ErrorState error={error} onRetry={loadHuddle} />;
  }

  return (
    <div className="container py-4">
      <div className="content">
        
          <section
  className="relative overflow-hidden rounded-3xl border p-5 shadow-xl"
  style={{
    background:
      "radial-gradient(circle at 12% 8%, rgba(34,211,238,0.08), transparent 30%), radial-gradient(circle at 82% 12%, rgba(59,130,246,0.06), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(248,250,252,0.94) 55%, rgba(241,245,249,0.86) 100%)",
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
            style={{ background: getToneGlow(tone) }}
          />

          <div className="relative z-10">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
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
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  Live operator read
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-heading font-semibold tracking-tight">
                    Pre-Shift Huddle
                  </h2>

                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getToneClass(
                      tone
                    )}`}
                  >
                    {tone} shift
                  </span>

                  {huddle?.confidence ? (
                    <span
                      className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold"
                      style={{
                        color: "#475569",
                        background: "rgba(255,255,255,0.78)",
                        borderColor: "rgba(15,23,42,0.08)",
                      }}
                    >
                      {fieldText(huddle.confidence)} confidence
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  AI-generated manager read for the shift, grounded in the latest
                  KitchenPulse signals.
                </p>
              </div>

              <div
                className="flex flex-col gap-2 rounded-2xl border px-4 py-3 text-right shadow-sm"
                style={{
                  background:
  "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
borderColor: "rgba(15,23,42,0.08)",
                }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Manager mode
                </div>
                <button
                  type="button"
                  onClick={loadHuddle}
                  className="inline-flex items-center justify-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh read
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div
                className="relative overflow-hidden rounded-2xl border p-4 shadow-md"
                style={{
                  background:
  "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.76))",
borderColor: "rgba(15,23,42,0.08)",
boxShadow:
  "0 10px 24px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.84)",
                }}
              >
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl"
                  style={{ background: "rgba(148,163,184,0.07)" }}
                />

                <div className="relative z-10 mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full"
                    style={{
                      background: "rgba(34,211,238,0.12)",
                      color: "#0891B2",
                      border: "1px solid rgba(34,211,238,0.20)",
                    }}
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                  </span>
                  Manager read
                </div>

                <p className="relative z-10 text-base leading-relaxed text-foreground">
                  {fieldText(huddle?.managerRead) ||
                    "KitchenPulse does not have a manager read available yet."}
                </p>
              </div>

              <div
                className="relative overflow-hidden rounded-2xl border p-4 text-white shadow-lg"
                style={{
                  background:
  "radial-gradient(circle at 15% 10%, rgba(34,211,238,0.12), transparent 34%), linear-gradient(135deg, #04111F 0%, #071827 50%, #0F172A 100%)",
borderColor: "rgba(148,163,184,0.18)",
boxShadow:
  "0 14px 30px rgba(2,8,23,0.20), inset 0 1px 0 rgba(255,255,255,0.08)",
                }}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.055]"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
                    backgroundSize: "30px 30px",
                  }}
                />

                <div className="relative z-10 mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full"
                    style={{
                      background: "rgba(34,211,238,0.13)",
                      color: "#67E8F9",
                      border: "1px solid rgba(34,211,238,0.22)",
                    }}
                  >
                    <Megaphone className="h-3.5 w-3.5" />
                  </span>
                  Say this at lineup
                </div>

                <p className="relative z-10 text-base leading-relaxed text-slate-50">
                  “{fieldText(huddle?.lineupScript) ||
                    "Team, stay sharp, communicate early, and keep the shift moving cleanly."}”
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {watchPoints.map((point: string, index: number) => {
                const labels = ["Host / floor", "Kitchen / bar", "Menu / service"];
                const icons = [CheckCircle2, Utensils, Sparkles];

                return (
                  <DetailCard
                    key={`${point}-${index}`}
                    label={labels[index] || "Watch point"}
                    icon={icons[index] || CheckCircle2}
                    index={index}
                  >
                    {point}
                  </DetailCard>
                );
              })}
            </div>

            <div
              className="mt-4 rounded-2xl border p-4"
              style={{
                background:
  "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
borderColor: "rgba(15,23,42,0.08)",
              }}
            >
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Signals used
              </div>

              <div className="flex flex-wrap gap-2">
                {signalsUsed.map((signal: string) => (
                  <SignalPill key={signal}>{signal}</SignalPill>
                ))}
              </div>

              {huddle?.fallback ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  KitchenPulse used the backup huddle format because the AI read
                  was unavailable.
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
