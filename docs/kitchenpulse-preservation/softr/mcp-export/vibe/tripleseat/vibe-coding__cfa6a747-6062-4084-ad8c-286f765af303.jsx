import { Badge } from "@/components/ui/badge";
import { useRecords, q } from "@/lib/datasource";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  DollarSign,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

const select = q.select({
  eventName: "Event Name",
  startDateTime: "Start DateTime",
  endDateTime: "End DateTime",
  venueArea: "Venue / Area",
  roomSpace: "Room / Space",
  status: "Status",
  tripleseatStatus: "Tripleseat Status",
  guestCount: "Guest Count",
  estimatedRevenue: "Estimated Revenue",
  revenueStatus: "Revenue Status",
  needsReview: "Needs Review",
  promoteToDecision: "Promote to Decision",
  source: "Source",
  sourceEventId: "Source Event ID",
  notes: "Notes",
  contactAccount: "Contact / Account",
  eventType: "Event Type / Meal Period",
});

type EventRow = {
  id: string;
  eventName: string;
  startDateTime: Date | null;
  endDateTime: Date | null;
  venueArea: string;
  roomSpace: string;
  status: string;
  tripleseatStatus: string;
  guestCount: number | null;
  estimatedRevenue: number | null;
  revenueStatus: string;
  needsReview: boolean;
  promoteToDecision: boolean;
  source: string;
  sourceEventId: string;
  notes: string;
  contactAccount: string;
  eventType: string;
};

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
        if (typeof v === "object" && "foreignRowDisplayName" in v) {
          return String(v.foreignRowDisplayName);
        }
        return String(v);
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    if ("name" in value) return String(value.name);
    if ("label" in value) return String(value.label);
    if ("foreignRowDisplayName" in value) return String(value.foreignRowDisplayName);
  }

  return String(value);
}

function fieldNumberOrNull(value: any) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const text = fieldText(value);
  if (!text.trim()) return null;

  const cleaned = text.replace(/[$,%]/g, "").replace(/,/g, "").trim();
  if (!cleaned) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function fieldBool(value: any) {
  if (typeof value === "boolean") return value;
  const text = fieldText(value).toLowerCase();
  return text === "true" || text === "yes" || text === "1";
}

function fieldDate(value: any) {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function isValidMoney(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function formatCurrency(value: number | null, options = {}) {
  const { zeroLabel = "$0", emptyLabel = "Updating…" } = options;

  if (value === 0) return zeroLabel;

  if (!isValidMoney(value)) return emptyLabel;

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatDateTime(date: Date | null) {
  if (!date) return "Date pending";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function cleanOperatorNote(value: string) {
  if (!value) return "";

  return value
    .replace(/^demo:\s*/i, "")
    .replace(/\bdemo:\s*/gi, "")
    .replace(/\bdemo\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function daysUntil(date: Date | null) {
  if (!date) return null;

  const now = new Date();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const diff = start.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function isFutureOrToday(date: Date | null) {
  const d = daysUntil(date);
  return d !== null && d >= 0;
}

function isTripleseat(row: EventRow) {
  return row.source.toLowerCase().includes("tripleseat") || Boolean(row.sourceEventId);
}

function isIgnored(row: EventRow) {
  const status = `${row.status} ${row.tripleseatStatus}`.toLowerCase();
  return (
    status.includes("ignored") ||
    status.includes("cancel") ||
    status.includes("lost") ||
    status.includes("closed")
  );
}

function isDefinite(row: EventRow) {
  return row.tripleseatStatus.toLowerCase().includes("definite");
}

function isTentativeOrProspect(row: EventRow) {
  const status = row.tripleseatStatus.toLowerCase();
  return status.includes("tentative") || status.includes("prospect");
}

function isDecisionDriver(row: EventRow) {
  return row.promoteToDecision || row.guestCount >= 50;
}

function sumMoney(rows: EventRow[]) {
  return rows.reduce((sum, row) => sum + (row.estimatedRevenue || 0), 0);
}

function sortSoonestFirst(a: EventRow, b: EventRow) {
  const aTime = a.startDateTime ? a.startDateTime.getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.startDateTime ? b.startDateTime.getTime() : Number.MAX_SAFE_INTEGER;
  return aTime - bTime;
}

function revenueTone(value: number | null) {
  if (!isValidMoney(value)) {
    return {
      label: "Revenue syncing",
      color: "#64748B",
      bg: "rgba(100,116,139,0.07)",
      border: "rgba(100,116,139,0.12)",
      glow: "rgba(100,116,139,0.035)",
      valueClass: "text-muted-foreground",
    };
  }

  if (value >= 10000) {
    return {
      label: "Strong booked value",
      color: "#0F766E",
      bg: "rgba(20,184,166,0.07)",
      border: "rgba(20,184,166,0.13)",
      glow: "rgba(20,184,166,0.04)",
      valueClass: "text-teal-700",
    };
  }

  if (value >= 4000) {
    return {
      label: "Meaningful pipeline",
      color: "#B45309",
      bg: "rgba(245,158,11,0.07)",
      border: "rgba(245,158,11,0.14)",
      glow: "rgba(245,158,11,0.04)",
      valueClass: "text-amber-700",
    };
  }

  return {
    label: "Light booked value",
    color: "#0891B2",
    bg: "rgba(34,211,238,0.08)",
    border: "rgba(34,211,238,0.14)",
    glow: "rgba(34,211,238,0.045)",
    valueClass: "text-cyan-700",
  };
}

function getPanelTone(tone = "default") {
  if (tone === "driver") {
    return {
      color: "#B45309",
      bg: "rgba(245,158,11,0.07)",
      border: "rgba(245,158,11,0.14)",
      glow: "rgba(245,158,11,0.04)",
      icon: TrendingUp,
    };
  }

  if (tone === "review") {
    return {
      color: "#D97706",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.16)",
      glow: "rgba(245,158,11,0.045)",
      icon: AlertTriangle,
    };
  }

  if (tone === "money") {
    return {
      color: "#0F766E",
      bg: "rgba(20,184,166,0.07)",
      border: "rgba(20,184,166,0.13)",
      glow: "rgba(20,184,166,0.04)",
      icon: DollarSign,
    };
  }

  return {
    color: "#0891B2",
    bg: "rgba(34,211,238,0.08)",
    border: "rgba(34,211,238,0.14)",
    glow: "rgba(34,211,238,0.045)",
    icon: CalendarDays,
  };
}

function KPBadge({ children, tone = "default", icon: Icon }: any) {
  const meta = getPanelTone(tone);

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

function StatCard({
  icon: Icon,
  label,
  value,
  helper,
  valueClass = "",
  tone = "default",
}: {
  icon: any;
  label: string;
  value: string;
  helper?: string;
  valueClass?: string;
  tone?: "default" | "driver" | "review" | "money";
}) {
  const meta = getPanelTone(tone);

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

      <div className="relative z-10 mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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

      <div className={`relative z-10 text-2xl font-semibold leading-tight ${valueClass}`}>
        {value}
      </div>

      {helper ? (
        <div className="relative z-10 mt-1 text-xs leading-relaxed text-muted-foreground">
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function EventMoneyCard({
  row,
  tone = "default",
}: {
  row: EventRow;
  tone?: "default" | "driver" | "review";
}) {
  const d = daysUntil(row.startDateTime);
  const room = row.roomSpace || row.venueArea || "Room pending";
  const meta = getPanelTone(tone);

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
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {row.eventName || "Unnamed Tripleseat event"}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
              {formatDateTime(row.startDateTime)}
            </span>

            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              {room}
            </span>

            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              {row.guestCount || "?"} guests
            </span>
          </div>
        </div>

        <Badge
          className="shrink-0 border text-[11px] font-semibold hover:bg-transparent"
          style={{
            color: meta.color,
            background: meta.bg,
            borderColor: meta.border,
          }}
        >
          {row.tripleseatStatus || row.status || "Review"}
        </Badge>
      </div>

      <div className="relative z-10 mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Estimated value
          </div>

          <div className="text-xl font-semibold text-foreground">
            {formatCurrency(row.estimatedRevenue)}
          </div>
        </div>

        <div className="text-right text-xs text-muted-foreground">
          {d === null
            ? "Timing pending"
            : d === 0
              ? "Today"
              : d === 1
                ? "Tomorrow"
                : `${d} days out`}
        </div>
      </div>

      {cleanOperatorNote(row.notes) ? (
        <div
          className="relative z-10 mt-3 rounded-xl border px-3 py-2 text-xs leading-relaxed text-muted-foreground"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
            borderColor: "rgba(15,23,42,0.08)",
          }}
        >
          <div className="mb-1 font-semibold uppercase tracking-[0.12em] text-foreground">
            Current status
          </div>

          <div className="whitespace-normal break-words">
            {cleanOperatorNote(row.notes)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionPanel({
  title,
  subtitle,
  tone,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  tone: "default" | "driver" | "review";
  icon: any;
  children: any;
}) {
  const meta = getPanelTone(tone);
  const Icon = icon;

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

          <h3 className="text-xl font-heading font-semibold tracking-tight">
            {title}
          </h3>
        </div>

        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      </div>

      <div className="relative z-10 space-y-3">{children}</div>
    </section>
  );
}

function EmptyState({ children }: { children: any }) {
  return (
    <div
      className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.90), rgba(248,250,252,0.70))",
        borderColor: "rgba(15,23,42,0.10)",
      }}
    >
      {children}
    </div>
  );
}

export default function Block() {
  const { data, status } = useRecords({
    select,
    count: 500,
  });

  if (status === "pending") {
    return (
      <div className="container py-4">
        <div className="content">
          <div
            className="rounded-3xl border p-5 text-sm text-muted-foreground shadow-sm"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.97), rgba(248,250,252,0.82))",
              borderColor: "rgba(15,23,42,0.08)",
            }}
          >
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />
              Loading Tripleseat revenue pipeline...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="container py-4">
        <div className="content">
          <div className="rounded-3xl border bg-background p-5 text-sm text-destructive shadow-sm">
            Unable to load Tripleseat revenue pipeline.
          </div>
        </div>
      </div>
    );
  }

  const items = data?.pages?.flatMap((page) => page.items) || [];

  const rows: EventRow[] = items
    .map((item) => ({
      id: item.id,
      eventName: fieldText(item.fields.eventName),
      startDateTime: fieldDate(item.fields.startDateTime),
      endDateTime: fieldDate(item.fields.endDateTime),
      venueArea: fieldText(item.fields.venueArea),
      roomSpace: fieldText(item.fields.roomSpace),
      status: fieldText(item.fields.status),
      tripleseatStatus: fieldText(item.fields.tripleseatStatus),
      guestCount: fieldNumberOrNull(item.fields.guestCount),
      estimatedRevenue: fieldNumberOrNull(item.fields.estimatedRevenue),
      revenueStatus: fieldText(item.fields.revenueStatus),
      needsReview: fieldBool(item.fields.needsReview),
      promoteToDecision: fieldBool(item.fields.promoteToDecision),
      source: fieldText(item.fields.source),
      sourceEventId: fieldText(item.fields.sourceEventId),
      notes: fieldText(item.fields.notes),
      contactAccount: fieldText(item.fields.contactAccount),
      eventType: fieldText(item.fields.eventType),
    }))
    .filter((row) => isTripleseat(row))
    .filter((row) => !isIgnored(row))
    .filter((row) => isFutureOrToday(row.startDateTime))
    .sort(sortSoonestFirst);

  const bookedRows = rows.filter((row) => isDefinite(row));
  const driverRows = bookedRows.filter((row) => isDecisionDriver(row));
  const reviewRows = rows.filter((row) => row.needsReview || isTentativeOrProspect(row));
  const potentialRows = rows.filter((row) => isTentativeOrProspect(row) || row.needsReview);

  const bookedValue = sumMoney(bookedRows);
  const driverValue = sumMoney(driverRows);
  const potentialValue = sumMoney(potentialRows);
  const reviewValue = sumMoney(reviewRows);

  const totalVisiblePipeline = bookedValue + potentialValue;
  const tone = revenueTone(bookedValue);

  const topBooked = bookedRows.slice(0, 3);
  const topReview = reviewRows.slice(0, 3);
  const topDrivers = driverRows.slice(0, 3);

  const nextBooked = bookedRows[0] || null;

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
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
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
                  Tripleseat revenue pulse
                </div>

                <h2 className="text-3xl font-heading font-semibold tracking-tight">
                  Private Event Revenue Pipeline
                </h2>

                <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted-foreground">
                  KitchenPulse is tracking{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(bookedValue)}
                  </span>{" "}
                  in definite Tripleseat event value and{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(potentialValue, { zeroLabel: "$0" })}
                  </span>{" "}
                  in review / potential value. Use this as a forward-looking planning signal until deposits and payments are wired directly.
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
                  <KPBadge tone="default" icon={CalendarDays}>
                    Private events
                  </KPBadge>

                  <KPBadge tone="default">
                    {rows.length} future records
                  </KPBadge>

                  <KPBadge tone="money" icon={ShieldCheck}>
                    Estimates only
                  </KPBadge>
                </div>

                <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Operator read
                </div>

                <div className="text-sm leading-relaxed text-muted-foreground">
                  {driverRows.length > 0
                    ? `${driverRows.length} booked event${driverRows.length === 1 ? "" : "s"} are large enough to affect prep, pacing, or staffing. Keep those connected to the decision layer.`
                    : potentialRows.length > 0
                      ? "No major confirmed pressure yet, but there is review-stage event value worth watching for staffing and room planning."
                      : "No meaningful private-event revenue pressure is visible right now."}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                icon={DollarSign}
                label="Booked Value"
                value={formatCurrency(bookedValue)}
                helper={`${bookedRows.length} definite future event${bookedRows.length === 1 ? "" : "s"}`}
                valueClass={tone.valueClass}
                tone="money"
              />

              <StatCard
                icon={TrendingUp}
                label="Decision Value"
                value={formatCurrency(driverValue)}
                helper={`${driverRows.length} event${driverRows.length === 1 ? "" : "s"} affecting service decisions`}
                valueClass={driverValue > 0 ? "text-amber-700" : "text-muted-foreground"}
                tone="driver"
              />

              <StatCard
                icon={AlertTriangle}
                label="Review Value"
                value={formatCurrency(reviewValue, { zeroLabel: "$0" })}
                helper={
                  reviewValue > 0
                    ? "May need deposit, menu, confirmation, or coordinator follow-up"
                    : "No review-stage private-event value is visible right now"
                }
                valueClass={reviewValue > 0 ? "text-amber-700" : "text-muted-foreground"}
                tone="review"
              />

              <StatCard
                icon={Clock}
                label="Total Pipeline"
                value={formatCurrency(totalVisiblePipeline)}
                helper="Booked + review/potential estimate"
                tone="default"
              />
            </div>

            {nextBooked ? (
              <div
                className="mt-4 rounded-2xl border px-4 py-3 text-sm leading-relaxed text-muted-foreground shadow-sm"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.76))",
                  borderColor: "rgba(15,23,42,0.08)",
                  boxShadow:
                    "0 10px 24px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.84)",
                }}
              >
                <span className="font-semibold text-foreground">Next booked event:</span>{" "}
                {nextBooked.eventName} on {formatDateTime(nextBooked.startDateTime)} with{" "}
                {nextBooked.guestCount || "unknown"} guests in{" "}
                {nextBooked.roomSpace || nextBooked.venueArea || "room pending"}.
              </div>
            ) : null}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-3">
          <SectionPanel
            title="Revenue Decision Drivers"
            subtitle="The events most likely to change prep, staffing, pacing, or manager attention."
            tone="driver"
            icon={TrendingUp}
          >
            {topDrivers.length > 0 ? (
              topDrivers.map((row) => (
                <EventMoneyCard key={row.id} row={row} tone="driver" />
              ))
            ) : (
              <EmptyState>
                No revenue-driving private events are currently above the decision threshold.
              </EmptyState>
            )}
          </SectionPanel>

          <SectionPanel
            title="Current Booked Value"
            subtitle="Definite future events from Tripleseat, including the current status note for quick follow-up."
            tone="default"
            icon={CheckCircle2}
          >
            {topBooked.length > 0 ? (
              topBooked.map((row) => (
                <EventMoneyCard key={row.id} row={row} tone="default" />
              ))
            ) : (
              <EmptyState>
                No definite future Tripleseat revenue is visible yet.
              </EmptyState>
            )}
          </SectionPanel>

          <SectionPanel
            title="Review / Potential Value"
            subtitle="Events that may need deposit, menu, final confirmation, customer response, or coordinator follow-up."
            tone="review"
            icon={AlertTriangle}
          >
            {topReview.length > 0 ? (
              topReview.map((row) => (
                <EventMoneyCard key={row.id} row={row} tone="review" />
              ))
            ) : (
              <EmptyState>
                No review-stage private-event value is visible right now.
              </EmptyState>
            )}
          </SectionPanel>
        </div>
      </div>
    </div>
  );
}
