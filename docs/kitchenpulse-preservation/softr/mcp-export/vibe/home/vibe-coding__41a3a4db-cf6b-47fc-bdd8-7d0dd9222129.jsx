import { useRecord, useCurrentRecordId, q } from "@/lib/datasource";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Eye,
  Flame,
  Sparkles,
  Target,
} from "lucide-react";

const select = q.select({
  name: "Name",
  heroState: "Hero State",
  heroConfidence: "Hero Confidence",
  heroTimeContext: "Hero Time Context",
  heroHeadline: "Hero Headline",
  heroSubheadline: "Hero Subheadline",
  heroPill1: "Hero Pill 1",
  heroPill2: "Hero Pill 2",
  heroPill3: "Hero Pill 3",
  heroCardLabel: "Hero Card Label",
  heroCardValue: "Hero Card Value",
  heroCardPriority: "Hero Card Priority",
  quickWhy: "Quick - Why",
  quickFirstAction: "Quick - First Action",
  quickIgnoreRisk: "Quick - Ignore Risk",
  quickWatch: "Quick - Watch",
  whyFull: "Why Full",
  summary: "Summary",
});

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

function getStateStyle(heroState = "") {
  const state = String(heroState || "").toUpperCase();

  if (state === "PUSH") {
    return {
      color: "#0891B2",
      border: "rgba(34,211,238,0.28)",
      bg: "rgba(34,211,238,0.12)",
      glow: "rgba(34,211,238,0.18)",
      label: "Push",
      icon: Target,
    };
  }

  if (state === "PROTECT") {
    return {
      color: "#2563EB",
      border: "rgba(59,130,246,0.26)",
      bg: "rgba(59,130,246,0.11)",
      glow: "rgba(59,130,246,0.16)",
      label: "Protect",
      icon: ClipboardCheck,
    };
  }

  if (state === "RECOVER") {
    return {
      color: "#0F766E",
      border: "rgba(20,184,166,0.26)",
      bg: "rgba(20,184,166,0.12)",
      glow: "rgba(20,184,166,0.16)",
      label: "Recover",
      icon: CheckCircle2,
    };
  }

  if (state === "WATCH") {
    return {
      color: "#D97706",
      border: "rgba(245,158,11,0.28)",
      bg: "rgba(245,158,11,0.12)",
      glow: "rgba(245,158,11,0.18)",
      label: "Watch",
      icon: Eye,
    };
  }

  return {
    color: "#64748B",
    border: "rgba(100,116,139,0.22)",
    bg: "rgba(100,116,139,0.10)",
    glow: "rgba(100,116,139,0.12)",
    label: "Decision",
    icon: Sparkles,
  };
}

function getConfidenceStyle(heroConfidence = "") {
  const conf = String(heroConfidence || "").toLowerCase();

  if (conf.includes("high")) {
    return {
      color: "#16A34A",
      bg: "rgba(34,197,94,0.11)",
      border: "rgba(34,197,94,0.22)",
    };
  }

  if (conf.includes("medium")) {
    return {
      color: "#D97706",
      bg: "rgba(245,158,11,0.11)",
      border: "rgba(245,158,11,0.22)",
    };
  }

  if (conf.includes("low")) {
    return {
      color: "#DC2626",
      bg: "rgba(239,68,68,0.11)",
      border: "rgba(239,68,68,0.22)",
    };
  }

  return {
    color: "#64748B",
    bg: "rgba(100,116,139,0.10)",
    border: "rgba(100,116,139,0.18)",
  };
}

function formatText(text = "") {
  const lines = String(text || "").split("\n");

  return lines.map((line, i) => (
    <span key={i}>
      {line}
      {i < lines.length - 1 && <br />}
    </span>
  ));
}

function SignalBadge({ children, styleType = "default" }) {
  const styles =
    styleType === "cyan"
      ? {
          color: "#0E7490",
          background: "rgba(34,211,238,0.10)",
          borderColor: "rgba(34,211,238,0.22)",
        }
      : styleType === "green"
        ? {
            color: "#15803D",
            background: "rgba(34,197,94,0.10)",
            borderColor: "rgba(34,197,94,0.22)",
          }
        : {
            color: "#475569",
            background: "rgba(255,255,255,0.74)",
            borderColor: "rgba(15,23,42,0.08)",
          };

  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold shadow-sm"
      style={styles}
    >
      {children}
    </span>
  );
}

function QuickCard({
  label,
  children,
  icon,
  tone = "neutral",
}) {
  const Icon = icon;

  const styles =
    tone === "danger"
      ? {
          iconBg: "rgba(249,115,22,0.10)",
iconColor: "#EA580C",
borderColor: "rgba(249,115,22,0.20)",
glow: "rgba(249,115,22,0.06)",
labelColor: "#C2410C",
        }
      : tone === "action"
        ? {
            iconBg: "rgba(34,211,238,0.12)",
            iconColor: "#0891B2",
            borderColor: "rgba(34,211,238,0.20)",
            glow: "rgba(34,211,238,0.08)",
            labelColor: "#0E7490",
          }
        : {
            iconBg: "rgba(59,130,246,0.08)",
iconColor: "#2563EB",
borderColor: "rgba(59,130,246,0.14)",
glow: "rgba(59,130,246,0.045)",
labelColor: "#2563EB",
          };

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 shadow-sm"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.76))",
        borderColor: styles.borderColor,
        boxShadow:
          "0 10px 24px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.80)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
        style={{ background: styles.glow }}
      />

      <div className="relative z-10 mb-2 flex items-center gap-2">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full"
          style={{
            background: styles.iconBg,
            color: styles.iconColor,
            border: `1px solid ${styles.borderColor}`,
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>

        <div
          className="text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: styles.labelColor }}
        >
          {label}
        </div>
      </div>

      <div className="relative z-10 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

export default function Block() {
  const recordId = useCurrentRecordId();
  const { data, status } = useRecord({
    recordId,
    select,
  });

  if (status === "pending") {
    return (
      <div className="container py-6">
        <div className="content">
          <section
            className="rounded-3xl border p-5 shadow-sm"
            style={{
              background:
  "linear-gradient(145deg, rgba(255,255,255,0.97), rgba(248,250,252,0.82))",
borderColor: "rgba(15,23,42,0.08)",
            }}
          >
            <div className="text-sm text-muted-foreground">
              Loading latest decision...
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <div className="container py-6">
        <div className="content">
          <section className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <div className="text-sm font-semibold text-red-700">
              Error loading latest decision
            </div>
          </section>
        </div>
      </div>
    );
  }

  const heroState = data.fields.heroState?.label || "";
  const heroConfidence = data.fields.heroConfidence || "";
  const timeContextLabel = cleanTimeContextLabel(data.fields.heroTimeContext);

  const stateStyle = getStateStyle(heroState);
  const confidenceStyle = getConfidenceStyle(heroConfidence);
  const StateIcon = stateStyle.icon;

  const subheadline = String(data.fields.heroSubheadline || "").replace(
    /(^\w|[.!?]\s+\w)/g,
    (c) => c.toUpperCase()
  );

  const hasWhySection = Boolean(data.fields.whyFull || data.fields.summary);

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
                "linear-gradient(rgba(15,23,42,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.12) 1px, transparent 1px)",
              backgroundSize: "34px 34px",
            }}
          />

          <div
            className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full blur-3xl"
            style={{ background: "rgba(148,163,184,0.08)" }}
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
                  Latest Decision
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-heading font-semibold tracking-tight">
                    Owner Call
                  </h2>

                  {heroState && (
                    <span
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm"
                      style={{
                        color: stateStyle.color,
                        background: stateStyle.bg,
                        borderColor: stateStyle.border,
                      }}
                    >
                      <StateIcon className="h-3.5 w-3.5" />
                      {heroState}
                    </span>
                  )}

                  {heroConfidence && (
                    <span
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm"
                      style={{
                        color: confidenceStyle.color,
                        background: confidenceStyle.bg,
                        borderColor: confidenceStyle.border,
                      }}
                    >
                      <Circle className="h-2 w-2 fill-current" />
                      {heroConfidence}
                    </span>
                  )}
                </div>

                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  The current KitchenPulse recommendation, cleaned up for quick owner/operator action.
                </p>
              </div>

              {timeContextLabel && (
                <div
                  className="flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-sm"
                  style={{
                    color: "#0F766E",
background:
  "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
borderColor: "rgba(15,23,42,0.08)",
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: "#14B8A6",
boxShadow: "0 0 10px rgba(20,184,166,0.35)",
                    }}
                  />
                  {timeContextLabel}
                </div>
              )}
            </div>

            <div
              className="relative overflow-hidden rounded-[26px] border p-5 shadow-md"
              style={{
                background:
  "linear-gradient(145deg, rgba(255,255,255,0.97), rgba(248,250,252,0.78))",
borderColor: "rgba(15,23,42,0.08)",
boxShadow:
  "0 12px 28px rgba(15,23,42,0.065), inset 0 1px 0 rgba(255,255,255,0.86)",
              }}
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-1"
style={{ background: stateStyle.color, opacity: 0.72 }}
              />

              <div
                className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full blur-3xl"
                style={{ background: "rgba(148,163,184,0.08)" }}
              />

              <div className="relative z-10">
                {data.fields.heroHeadline && (
                  <h1 className="max-w-4xl text-2xl font-semibold leading-snug tracking-[-0.03em] text-foreground md:text-3xl">
                    {data.fields.heroHeadline}
                  </h1>
                )}

                {subheadline && (
                  <p className="mt-3 max-w-4xl text-base leading-7 text-muted-foreground">
                    {formatText(subheadline)}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {data.fields.heroPill1 && (
                    <SignalBadge styleType="cyan">
                      {data.fields.heroPill1}
                    </SignalBadge>
                  )}

                  {data.fields.heroPill2 && (
                    <SignalBadge>{data.fields.heroPill2}</SignalBadge>
                  )}

                  {data.fields.heroPill3 && (
                    <SignalBadge>{data.fields.heroPill3}</SignalBadge>
                  )}

                  {timeContextLabel && (
                    <SignalBadge styleType="green">
                      {timeContextLabel}
                    </SignalBadge>
                  )}
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {data.fields.quickFirstAction && (
                    <QuickCard label="Do now" icon={Target} tone="action">
                      {formatText(data.fields.quickFirstAction)}
                    </QuickCard>
                  )}

                  {data.fields.quickWhy && (
                    <QuickCard label="Why" icon={Sparkles}>
                      {formatText(data.fields.quickWhy)}
                    </QuickCard>
                  )}

                  {data.fields.quickIgnoreRisk && (
                    <QuickCard label="If ignored" icon={AlertTriangle} tone="danger">
                      {formatText(data.fields.quickIgnoreRisk)}
                    </QuickCard>
                  )}
                </div>

                {(data.fields.heroCardLabel || data.fields.heroCardValue) && (
                  <div
                    className="mt-5 rounded-2xl border p-4"
                    style={{
                      background:
  "radial-gradient(circle at 15% 10%, rgba(34,211,238,0.10), transparent 34%), linear-gradient(135deg, #04111F 0%, #071827 50%, #0F172A 100%)",
borderColor: "rgba(148,163,184,0.18)",
boxShadow:
  "0 14px 30px rgba(2,8,23,0.20), inset 0 1px 0 rgba(255,255,255,0.08)",
                    }}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        {data.fields.heroCardLabel && (
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                            {data.fields.heroCardLabel}
                          </div>
                        )}

                        {data.fields.heroCardValue && (
                          <div className="text-xl font-semibold text-slate-50">
                            {data.fields.heroCardValue}
                          </div>
                        )}
                      </div>

                      {data.fields.heroCardPriority && (
                        <div
                          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                          style={{
                            color: "#FED7AA",
                            background: "rgba(249,115,22,0.13)",
                            borderColor: "rgba(249,115,22,0.24)",
                          }}
                        >
                          <Flame className="h-3.5 w-3.5" />
                          {data.fields.heroCardPriority}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {data.fields.heroPill1 && (
                <SignalBadge>Service: {data.fields.heroPill1}</SignalBadge>
              )}

              {data.fields.heroPill2 && (
                <SignalBadge>Pressure: {data.fields.heroPill2}</SignalBadge>
              )}

              {timeContextLabel && (
                <SignalBadge styleType="green">{timeContextLabel}</SignalBadge>
              )}
            </div>

            {hasWhySection && (
              <div
                className="mt-4 overflow-hidden rounded-2xl border shadow-sm"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.74))",
                  borderColor: "rgba(15,23,42,0.08)",
                  boxShadow:
                    "0 12px 28px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.80)",
                }}
              >
                <div className="border-b px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full"
                      style={{
                        background: "rgba(255,255,255,0.72)",
color: "#0891B2",
border: "1px solid rgba(15,23,42,0.08)",
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </span>

                    <div>
                      <div className="text-lg font-semibold text-foreground">
                        Why this surfaced
                      </div>
                      <div className="text-xs text-muted-foreground">
                        The signal path behind the current recommendation.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 px-5 py-5 text-sm leading-relaxed text-muted-foreground [&_.why-rich-text_p]:mb-3 [&_.why-rich-text_strong]:font-semibold [&_.why-rich-text_strong]:text-foreground [&_.why-rich-text_em]:text-muted-foreground [&_.why-rich-text_em]:italic">
                  {data.fields.whyFull && (
                    <div
                      className="why-rich-text"
                      dangerouslySetInnerHTML={{
                        __html: data.fields.whyFull,
                      }}
                    />
                  )}

                  {data.fields.summary && (
                    <div className="space-y-3 border-t pt-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Brief summary
                      </div>
                      <div>{formatText(data.fields.summary)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
