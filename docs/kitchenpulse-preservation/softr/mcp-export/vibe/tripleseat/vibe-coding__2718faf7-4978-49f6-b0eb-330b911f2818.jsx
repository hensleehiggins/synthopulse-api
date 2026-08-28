import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  Flame,
  Loader2,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";

const API_URL = "https://project-1csz2.vercel.app/api/tripleseat-leads-board";

function formatCurrency(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "$0";

  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function valueOrDash(value) {
  return value || "—";
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function cleanLeadLabel(value) {
  const text = String(value || "").trim().toLowerCase();

  if (!text) return "Lead";
  if (text.includes("hot")) return "Hot Lead";
  if (text.includes("follow")) return "Follow-Up";
  if (text.includes("stale")) return "Stale Follow-Up";
  if (text.includes("waiting")) return "Waiting on Customer";
  if (text.includes("deposit")) return "Needs Deposit";
  if (text.includes("menu")) return "Needs Menu";
  if (text.includes("confirm")) return "Needs Confirmation";
  if (text.includes("prospect")) return "Prospect";
  if (text.includes("tentative")) return "Tentative";
  if (text.includes("potential")) return "Potential Demand";
  if (text.includes("converted")) return "Converted";
  if (text.includes("turned")) return "Turned Down";

  return titleCase(text);
}

function cleanLeadText(value) {
  return String(value || "")
    .replace(/^demo:\s*/i, "")
    .replace(/\bdemo:\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getLeadNextStep(lead) {
  const text = `${lead.label || ""} ${lead.reason || ""} ${lead.eventDescription || ""} ${lead.additionalInformation || ""} ${lead.leadNote || ""}`.toLowerCase();

  if (text.includes("waiting on customer") || text.includes("waiting on client")) {
    return "Waiting on Customer";
  }

  if (text.includes("proposal sent") || text.includes("sent proposal")) {
    return "Waiting on Customer";
  }

  if (text.includes("deposit")) return "Needs Deposit";
  if (text.includes("menu")) return "Needs Menu";
  if (text.includes("confirm")) return "Needs Confirmation";

  if (
    text.includes("follow up") ||
    text.includes("follow-up") ||
    text.includes("stale")
  ) {
    return "Coordinator Follow-Up";
  }

  return cleanLeadLabel(lead.label || "Needs Review");
}

function getLeadTone(tone = "default") {
  if (tone === "hot") {
    return {
      label: "Hot Lead",
      color: "#EA580C",
      bg: "rgba(249,115,22,0.08)",
      border: "rgba(249,115,22,0.16)",
      glow: "rgba(249,115,22,0.045)",
      icon: Flame,
    };
  }

  if (tone === "follow") {
    return {
      label: "Follow-Up",
      color: "#D97706",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.16)",
      glow: "rgba(245,158,11,0.045)",
      icon: AlertTriangle,
    };
  }

  if (tone === "converted") {
    return {
      label: "Converted",
      color: "#0F766E",
      bg: "rgba(20,184,166,0.07)",
      border: "rgba(20,184,166,0.13)",
      glow: "rgba(20,184,166,0.04)",
      icon: CheckCircle2,
    };
  }

  if (tone === "money") {
    return {
      label: "Open Value",
      color: "#0F766E",
      bg: "rgba(20,184,166,0.07)",
      border: "rgba(20,184,166,0.13)",
      glow: "rgba(20,184,166,0.04)",
      icon: DollarSign,
    };
  }

  return {
    label: "Potential Demand",
    color: "#0891B2",
    bg: "rgba(34,211,238,0.08)",
    border: "rgba(34,211,238,0.14)",
    glow: "rgba(34,211,238,0.045)",
    icon: TrendingUp,
  };
}

function KPBadge({ children, tone = "default", icon: Icon }) {
  const meta = getLeadTone(tone);

  return (
    <Badge
      className="inline-flex items-center gap-1 border text-[11px] font-semibold hover:bg-transparent"
      style={{
        color: meta.color,
        background: meta.bg,
        borderColor: meta.border,
      }}
    >
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </Badge>
  );
}

function LeadCard({ lead, tone = "default" }) {
  const meta = getLeadTone(tone);
  const ToneIcon = meta.icon;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:shadow-md"
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

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-[15px] font-semibold leading-tight text-slate-950">
            {lead.leadName || "Unnamed lead"}
          </h4>

          {lead.company && lead.company !== lead.leadName ? (
            <div className="mt-1 text-xs text-slate-500">
              {lead.company}
            </div>
          ) : null}
        </div>

        <Badge
          className="inline-flex shrink-0 items-center gap-1 border text-[11px] font-semibold hover:bg-transparent"
          style={{
            color: meta.color,
            background: meta.bg,
            borderColor: meta.border,
          }}
        >
          <ToneIcon className="h-3 w-3" />
          {cleanLeadLabel(lead.label)}
        </Badge>
      </div>

      <div
        className="relative z-10 mt-3 rounded-xl border px-3 py-2"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
          borderColor: "rgba(15,23,42,0.08)",
        }}
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Next step
        </div>
        <div className="mt-0.5 text-sm font-semibold text-slate-950">
          {getLeadNextStep(lead)}
        </div>
      </div>

      <div className="relative z-10 mt-3 space-y-1.5 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
          <span>{lead.dateLabel || "Date pending"}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-slate-400" />
          <span>
            {lead.guestCount
              ? `${lead.guestCount} guests`
              : "Guest count pending"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <UserRound className="h-3.5 w-3.5 text-slate-400" />
          <span>{lead.ownerName || "Owner pending"}</span>
        </div>
      </div>

      <div className="relative z-10 mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Potential value
          </div>
          <div className="text-xl font-semibold text-slate-950">
            {formatCurrency(lead.estimatedValue)}
          </div>
        </div>

        <div className="text-right text-xs text-slate-500">
          {typeof lead.daysUntil === "number"
            ? lead.daysUntil === 0
              ? "Today"
              : lead.daysUntil === 1
                ? "Tomorrow"
                : `${lead.daysUntil} days out`
            : "Timing open"}
        </div>
      </div>

      {lead.reason ? (
        <p className="relative z-10 mt-3 text-xs leading-relaxed text-slate-600">
          {cleanLeadText(lead.reason)}
        </p>
      ) : null}

      {lead.eventDescription ? (
        <div
          className="relative z-10 mt-3 rounded-xl border px-3 py-2 text-xs leading-relaxed text-slate-600"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
            borderColor: "rgba(15,23,42,0.08)",
          }}
        >
          <div className="mb-1 font-semibold uppercase tracking-[0.12em] text-slate-700">
            Event type
          </div>
          <div className="whitespace-normal break-words">
            {cleanLeadText(lead.eventDescription)}
          </div>
        </div>
      ) : null}

      {lead.leadNote ? (
        <div
          className="relative z-10 mt-3 rounded-xl border px-3 py-2 text-xs leading-relaxed text-slate-700"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
            borderColor: "rgba(245,158,11,0.14)",
          }}
        >
          <div className="mb-1 font-semibold uppercase tracking-[0.12em] text-amber-800">
            Lead note
          </div>
          <div className="whitespace-normal break-words">
            {cleanLeadText(lead.leadNote)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, helper, valueClass = "", tone = "default" }) {
  const meta = getLeadTone(tone);

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
        style={{ background: meta.border }}
      />

      <div
        className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl"
        style={{ background: meta.glow }}
      />

      <div className="relative z-10 mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border"
          style={{
            color: meta.color,
            background: meta.bg,
            borderColor: meta.border,
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span>{label}</span>
      </div>

      <div className={`relative z-10 text-2xl font-semibold leading-tight text-slate-950 ${valueClass}`}>
        {value}
      </div>

      {helper ? (
        <div className="relative z-10 mt-1 text-xs leading-relaxed text-slate-500">
          {helper}
        </div>
      ) : null}
    </div>
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

function SectionPanel({ title, subtitle, tone, icon, children }) {
  const meta = getLeadTone(tone);
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

      <div className="relative z-10 mb-4">
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
          throw new Error(json.error || "Could not load Tripleseat lead pipeline.");
        }

        if (mounted) {
          setData(json);
          setStatus("success");
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || "Could not load Tripleseat lead pipeline.");
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
  const hotLeads = data?.hotLeads || [];
  const followUpWatch = data?.followUpWatch || [];
  const potentialDemand = data?.potentialDemand || [];

  return (
    <div className="container py-4">
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
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
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
                  Tripleseat lead pulse
                </div>

                <h2 className="text-3xl font-heading font-semibold tracking-tight text-slate-950">
                  Private Event Lead Pipeline
                </h2>

                <p className="mt-2 max-w-3xl text-base leading-relaxed text-slate-500">
                  Track open Tripleseat leads before they become booked demand. KitchenPulse is watching{" "}
                  <span className="font-semibold text-slate-950">
                    {formatCurrency(stats.openValue)}
                  </span>{" "}
                  in open lead value, with{" "}
                  <span className="font-semibold text-slate-950">
                    {valueOrDash(stats.hotLeads)}
                  </span>{" "}
                  hot lead{stats.hotLeads === 1 ? "" : "s"} and{" "}
                  <span className="font-semibold text-slate-950">
                    {valueOrDash(stats.followUpWatch)}
                  </span>{" "}
                  follow-up watch item{stats.followUpWatch === 1 ? "" : "s"}.
                </p>
              </div>

              <div
                className="flex flex-col gap-2 rounded-2xl border px-4 py-3 text-left shadow-sm md:max-w-sm"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
                  borderColor: "rgba(15,23,42,0.08)",
                }}
              >
                <div className="flex flex-wrap gap-2">
                  <KPBadge tone="default" icon={TrendingUp}>
                    Private event leads
                  </KPBadge>

                  <KPBadge tone="default">
                    {valueOrDash(stats.openLeads)} open
                  </KPBadge>

                  <KPBadge tone="money" icon={DollarSign}>
                    {formatCurrency(stats.openValue)}
                  </KPBadge>
                </div>

                <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Operator read
                </div>

                <div className="text-sm leading-relaxed text-slate-600">
                  {stats.hotLeads > 0
                    ? `${stats.hotLeads} lead${stats.hotLeads === 1 ? "" : "s"} look worth attention based on guest count, timing, or follow-up urgency.`
                    : stats.openLeads > 0
                      ? "Open lead activity is visible, but nothing is currently above the hot-lead threshold."
                      : "No open private-event leads are currently visible."}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                icon={DollarSign}
                label="Open Value"
                value={formatCurrency(stats.openValue)}
                helper={`${valueOrDash(stats.openLeads)} open lead${stats.openLeads === 1 ? "" : "s"}`}
                valueClass="text-teal-700"
                tone="money"
              />

              <StatCard
                icon={Flame}
                label="Hot Leads"
                value={String(stats.hotLeads || 0)}
                helper={formatCurrency(stats.hotValue)}
                valueClass={stats.hotLeads > 0 ? "text-orange-700" : "text-slate-500"}
                tone="hot"
              />

              <StatCard
                icon={Clock}
                label="Follow-Up Watch"
                value={String(stats.followUpWatch || 0)}
                helper={formatCurrency(stats.followUpValue)}
                valueClass={stats.followUpWatch > 0 ? "text-amber-700" : "text-slate-500"}
                tone="follow"
              />

              <StatCard
                icon={CheckCircle2}
                label="Converted"
                value={String(stats.convertedLeads || 0)}
                helper="Tripleseat converted leads"
                valueClass="text-teal-700"
                tone="converted"
              />
            </div>
          </div>
        </section>

        {status === "loading" ? (
          <div
            className="rounded-3xl border p-5 text-sm text-slate-500 shadow-sm"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.97), rgba(248,250,252,0.82))",
              borderColor: "rgba(15,23,42,0.08)",
            }}
          >
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />
              Loading Tripleseat leads...
            </div>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <span>{error}</span>
            </div>
          </div>
        ) : null}

        {status === "success" ? (
          <div className="grid gap-5 lg:grid-cols-3">
            <SectionPanel
              title="Hot Leads"
              subtitle="Higher-priority leads based on guest count, event type, timing, or follow-up urgency."
              tone="hot"
              icon={Flame}
            >
              {hotLeads.length > 0 ? (
                hotLeads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} tone="hot" />
                ))
              ) : (
                <EmptyState text="No hot leads are currently above the attention threshold." />
              )}
            </SectionPanel>

            <SectionPanel
              title="Follow-Up Watch"
              subtitle="Leads that may need a nudge, missing details, customer response, or coordinator attention."
              tone="follow"
              icon={AlertTriangle}
            >
              {followUpWatch.length > 0 ? (
                followUpWatch.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} tone="follow" />
                ))
              ) : (
                <EmptyState text="No lead follow-up risks are currently visible." />
              )}
            </SectionPanel>

            <SectionPanel
              title="Potential Demand"
              subtitle="Open leads that could affect future room planning, staffing, or prep if converted."
              tone="default"
              icon={TrendingUp}
            >
              {potentialDemand.length > 0 ? (
                potentialDemand.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} />
                ))
              ) : (
                <EmptyState text="All open leads are already surfaced in Hot Leads or Follow-Up Watch." />
              )}
            </SectionPanel>
          </div>
        ) : null}
      </div>
    </div>
  );
}
