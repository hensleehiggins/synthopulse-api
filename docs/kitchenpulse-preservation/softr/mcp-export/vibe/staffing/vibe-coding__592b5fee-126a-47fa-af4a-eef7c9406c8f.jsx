import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Siren,
  Gauge,
  CalendarDays,
  Clock,
  ShieldCheck,
  Users,
  Utensils,
  Martini,
  ChefHat,
  BriefcaseBusiness,
} from "lucide-react";

const API_URL = "https://project-1csz2.vercel.app/api/staffing-board";
const RELIABILITY_API_URL =
  "https://project-1csz2.vercel.app/api/staff-reliability-signals";

function valueOrDash(value) {
  if (value === 0) return "0";
  return value || "—";
}

function statusTone(status) {
  const clean = String(status || "").toLowerCase();

  if (["cancelled", "canceled", "callout", "called out", "no show", "no-show"].includes(clean)) {
    return "bg-red-100 text-red-700 border-red-200 hover:bg-red-100";
  }

  if (["published", "scheduled"].includes(clean)) {
    return "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100";
  }

  if (["updated", "changed"].includes(clean)) {
    return "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100";
  }

  if (["completed"].includes(clean)) {
    return "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100";
  }

  return "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100";
}

function departmentIcon(department) {
  const clean = String(department || "").toLowerCase();

  if (clean === "foh") return Users;
  if (clean === "boh") return ChefHat;
  if (clean === "bar") return Martini;
  if (clean === "management") return BriefcaseBusiness;
  if (clean === "support") return Utensils;

  return Users;
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function reliabilityDisplayTitle(signal) {
  if (signal.isDemo) {
    return signal.signalName || "Demo Reliability Signal";
  }

  const employee = signal.employeeName || "Staff Member";
  const rawType = signal.signalType || "Reliability";
  const type = String(rawType).toLowerCase();
  const displayType = titleCase(rawType);
  const severity = String(signal.severity || "").toLowerCase();

  if (severity.includes("critical")) {
    return `${employee} — Critical ${displayType} Risk`;
  }

  if (severity.includes("high")) {
    return `${employee} — Repeat ${displayType} Risk`;
  }

  if (severity.includes("watch") || severity.includes("medium")) {
    return `${employee} — ${displayType} Watch`;
  }

  return `${employee} — Reliability Signal`;
}

function severityRank(signal) {
  const clean = String(signal?.severity || "").toLowerCase();

  if (clean.includes("critical")) return 5;
  if (clean.includes("high")) return 4;
  if (clean.includes("medium")) return 3;
  if (clean.includes("watch")) return 2;
  if (clean.includes("low")) return 1;

  return 0;
}

function signalTime(signal) {
  const raw = signal?.generatedAt || signal?.signalDate || "";
  const parsed = new Date(raw).getTime();

  return Number.isFinite(parsed) ? parsed : 0;
}

function reliabilityPersonKey(signal) {
  return String(
    signal?.externalEmployeeId ||
      signal?.employeeName ||
      signal?.signalName ||
      signal?.id ||
      ""
  )
    .trim()
    .toLowerCase();
}

function pickHighestReliabilitySignals(signals) {
  const byPerson = new Map();

  for (const signal of signals || []) {
    const key = reliabilityPersonKey(signal);

    if (!key) continue;

    const existing = byPerson.get(key);

    if (!existing) {
      byPerson.set(key, signal);
      continue;
    }

    const currentRank = severityRank(signal);
    const existingRank = severityRank(existing);

    if (currentRank > existingRank) {
      byPerson.set(key, signal);
      continue;
    }

    if (currentRank === existingRank && signalTime(signal) > signalTime(existing)) {
      byPerson.set(key, signal);
    }
  }

  return Array.from(byPerson.values()).sort((a, b) => {
    const rankDiff = severityRank(b) - severityRank(a);

    if (rankDiff !== 0) return rankDiff;

    return signalTime(b) - signalTime(a);
  });
}

function reliabilityTone(severity, isDemo) {
  const clean = String(severity || "").toLowerCase();

  if (isDemo) {
    return {
      shell:
        "border-l-purple-500 bg-gradient-to-br from-white via-purple-50/40 to-fuchsia-50/40 shadow-[0_14px_30px_rgba(168,85,247,0.13)]",
      badge: "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100",
      icon: "bg-purple-100 text-purple-700",
    };
  }

  if (clean.includes("critical") || clean.includes("high")) {
    return {
      shell:
        "border-l-red-500 bg-gradient-to-br from-white via-red-50/35 to-orange-50/35 shadow-[0_14px_30px_rgba(239,68,68,0.13)]",
      badge: "bg-red-100 text-red-700 border-red-200 hover:bg-red-100",
      icon: "bg-red-100 text-red-700",
    };
  }

  if (clean.includes("watch") || clean.includes("medium")) {
    return {
      shell:
        "border-l-amber-400 bg-gradient-to-br from-white via-amber-50/35 to-yellow-50/35 shadow-[0_14px_30px_rgba(245,158,11,0.12)]",
      badge: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100",
      icon: "bg-amber-100 text-amber-700",
    };
  }

  return {
    shell:
      "border-l-sky-400 bg-gradient-to-br from-white via-sky-50/30 to-cyan-50/30 shadow-[0_14px_30px_rgba(14,165,233,0.10)]",
    badge: "bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100",
    icon: "bg-sky-100 text-sky-700",
  };
}

function EmptyState({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-500">
      {text}
    </div>
  );
}

function DepartmentStat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-sky-50/20 to-cyan-50/20 px-4 py-3 shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xl font-bold text-slate-950">{valueOrDash(value)}</div>
          <div className="text-[11px] text-slate-500">{label}</div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-600">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function ShiftCard({ shift }) {
  const hasRisk =
    shift.isCoverageRisk ||
    ["cancelled", "canceled", "callout", "called out", "no show", "no-show"].includes(
      String(shift.shiftStatus || "").toLowerCase()
    );

  const border = hasRisk
    ? "border-l-4 border-l-red-500"
    : shift.isManager
      ? "border-l-4 border-l-emerald-500"
      : "border-l-4 border-l-sky-400";

  const DepartmentIcon = departmentIcon(shift.department);

  return (
    <Card
      className={`${border} bg-gradient-to-br from-white via-sky-50/20 to-cyan-50/20 shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-lg`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="font-bold text-[15px] leading-tight text-slate-950">
              {shift.employeeName || shift.shiftName || "Unnamed shift"}
            </h4>

            <div className="mt-1 text-xs text-slate-500">
              {shift.role || "Scheduled shift"}
              {shift.locationStation ? ` · ${shift.locationStation}` : ""}
            </div>
          </div>

          {shift.shiftStatus ? (
            <Badge className={statusTone(shift.shiftStatus)}>
              {shift.shiftStatus}
            </Badge>
          ) : (
            <Badge variant="outline">Scheduled</Badge>
          )}
        </div>

        <div className="mt-3 space-y-1.5 text-xs text-slate-600">
          {shift.timeLabel ? (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>{shift.timeLabel}</span>
            </div>
          ) : null}

          {shift.dateLabel ? (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{shift.dateLabel}</span>
            </div>
          ) : null}

          {shift.department ? (
            <div className="flex items-center gap-1.5">
              <DepartmentIcon className="h-3.5 w-3.5" />
              <span>{shift.department}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {shift.scheduledHours ? (
            <Badge variant="secondary" className="text-[10px]">
              {shift.scheduledHours} hrs
            </Badge>
          ) : null}

          {shift.source ? (
            <Badge variant="secondary" className="text-[10px]">
              {shift.source}
            </Badge>
          ) : null}

          {shift.isManager ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px]">
              Manager coverage
            </Badge>
          ) : null}

          {shift.isCoverageRisk ? (
            <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-[10px]">
              Coverage risk
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function WarningCard({ warning }) {
  const severe = String(warning.severity || "").toLowerCase() === "high";

  return (
    <Card
      className={`border-l-4 transition-all hover:-translate-y-[1px] hover:shadow-lg ${
        severe
          ? "border-l-red-500 bg-gradient-to-br from-white via-red-50/35 to-orange-50/30 shadow-[0_12px_26px_rgba(239,68,68,0.10)]"
          : "border-l-amber-400 bg-gradient-to-br from-white via-amber-50/35 to-yellow-50/30 shadow-[0_12px_26px_rgba(245,158,11,0.10)]"
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              severe ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            <AlertCircle className="h-4 w-4" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-bold text-[14px] leading-tight text-slate-950">
                {warning.title || "Coverage gap"}
              </h4>

              {warning.severity ? (
                <Badge
                  className={
                    severe
                      ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-100"
                      : "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100"
                  }
                >
                  {warning.severity}
                </Badge>
              ) : null}
            </div>

            {warning.detail ? (
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                {warning.detail}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReliabilitySignalCard({ signal }) {
  const tone = reliabilityTone(signal.severity, signal.isDemo);

  return (
    <Card
      className={`border-l-4 transition-all hover:-translate-y-[1px] hover:shadow-lg ${tone.shell}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone.icon}`}
          >
            {signal.isDemo ? (
              <Gauge className="h-4 w-4" />
            ) : (
              <Siren className="h-4 w-4" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-bold text-[14px] leading-tight text-slate-950">
                {reliabilityDisplayTitle(signal)}
              </h4>

              <Badge className={`${tone.badge} text-[10px]`}>
                {signal.isDemo ? "Demo signal" : signal.severity || "Watch"}
              </Badge>
            </div>

            {signal.summary ? (
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                {signal.summary}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {signal.employeeName ? (
                <Badge variant="secondary" className="text-[10px]">
                  {signal.employeeName}
                </Badge>
              ) : null}

              {signal.signalType ? (
                <Badge variant="secondary" className="text-[10px]">
                  {signal.signalType}
                </Badge>
              ) : null}

              {signal.signalDateLabel ? (
                <Badge variant="secondary" className="text-[10px]">
                  {signal.signalDateLabel}
                </Badge>
              ) : null}

              {signal.watchWindowDays ? (
                <Badge variant="secondary" className="text-[10px]">
                  {signal.watchWindowDays}-day watch
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionShell({ eyebrow, title, description, icon: Icon, tone = "sky", children }) {
  const toneClass =
    tone === "amber"
      ? {
          shell:
            "border-amber-100 bg-gradient-to-br from-white via-amber-50/30 to-orange-50/30 shadow-[0_14px_30px_rgba(245,158,11,0.08)]",
          header:
            "border-amber-200 bg-gradient-to-br from-white via-amber-50/80 to-white shadow-[0_12px_26px_rgba(245,158,11,0.10)]",
          rail: "bg-amber-400",
          eyebrow: "text-amber-700",
          icon: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
        }
      : tone === "purple"
        ? {
            shell:
              "border-purple-100 bg-gradient-to-br from-white via-purple-50/25 to-fuchsia-50/25 shadow-[0_14px_30px_rgba(168,85,247,0.08)]",
            header:
              "border-purple-200 bg-gradient-to-br from-white via-purple-50/75 to-white shadow-[0_12px_26px_rgba(168,85,247,0.10)]",
            rail: "bg-purple-500",
            eyebrow: "text-purple-700",
            icon: "bg-purple-100 text-purple-700 ring-1 ring-purple-200",
          }
        : {
            shell:
              "border-sky-100 bg-gradient-to-br from-white via-sky-50/25 to-cyan-50/25 shadow-[0_14px_30px_rgba(14,165,233,0.08)]",
            header:
              "border-sky-200 bg-gradient-to-br from-white via-sky-50/80 to-white shadow-[0_12px_26px_rgba(14,165,233,0.10)]",
            rail: "bg-sky-400",
            eyebrow: "text-sky-700",
            icon: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
          };

  return (
    <section className={`rounded-[26px] border p-4 ${toneClass.shell}`}>
      <div className={`relative mb-4 overflow-hidden rounded-[22px] border px-4 py-4 ${toneClass.header}`}>
        <div
          aria-hidden="true"
          className={`absolute bottom-0 left-0 top-0 w-1 ${toneClass.rail}`}
        />

        <div className="flex items-start gap-3 pl-1">
          {Icon ? (
            <div
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneClass.icon}`}
            >
              <Icon className="h-4.5 w-4.5" />
            </div>
          ) : null}

          <div className="min-w-0">
            {eyebrow ? (
              <div className={`text-[10px] font-extrabold uppercase tracking-[0.18em] ${toneClass.eyebrow}`}>
                {eyebrow}
              </div>
            ) : null}

            <h3 className="mt-1.5 text-[17px] font-extrabold leading-tight tracking-[-0.015em] text-slate-950">
              {title}
            </h3>

            {description ? (
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {children}
    </section>
  );
}

function buildDemoCoverageWarnings(todayShifts, coverageWarnings) {
  const riskyShifts = todayShifts.filter((shift) => {
    const status = String(shift.shiftStatus || "").toLowerCase();

    return (
      shift.isCoverageRisk ||
      ["cancelled", "canceled", "callout", "called out", "no show", "no-show"].includes(status)
    );
  });

  const personRiskWarnings = riskyShifts.map((shift) => {
    const status = String(shift.shiftStatus || "").toLowerCase();
    const isSevereStatus = ["cancelled", "canceled", "callout", "called out", "no show", "no-show"].includes(status);

    return {
      id: `staff-risk-${shift.id || shift.externalShiftId || shift.employeeName}`,
      severity: isSevereStatus ? "High" : "Medium",
      title: `${shift.employeeName || shift.shiftName || "A scheduled employee"} is a coverage risk`,
      detail:
        shift.syncNotes ||
        `${shift.role || "Scheduled staff"} coverage may need attention before service. Confirm attendance, backup coverage, and handoff plan.`,
    };
  });

  const hasDemoStaff = todayShifts.some((shift) =>
    String(shift.externalShiftId || shift.shiftName || shift.employeeName || "")
      .toLowerCase()
      .includes("demo")
  );

  const demoFallbackWarnings =
    !coverageWarnings.length && hasDemoStaff
      ? [
          {
            id: "demo-manager-warning",
            severity: "High",
            title: "Manager coverage starts late",
            detail:
              "Demo signal: manager coverage does not begin until later in the dinner window. Use manager judgment and floor read before the rush.",
          },
          {
            id: "demo-bar-boh-warning",
            severity: "Medium",
            title: "Bar / BOH coverage may be thin",
            detail:
              "Demo signal: bar and kitchen coverage are intentionally light for today. Watch pacing, handoffs, and guest communication.",
          },
        ]
      : [];

  return [...personRiskWarnings, ...coverageWarnings, ...demoFallbackWarnings];
}

export default function Block() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [reliabilityData, setReliabilityData] = useState(null);
  const [reliabilityStatus, setReliabilityStatus] = useState("loading");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setStatus("loading");
        setReliabilityStatus("loading");

        const res = await fetch(API_URL);
        const json = await res.json();

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Could not load staffing board.");
        }

        if (mounted) {
          setData(json);
          setStatus("success");
        }

        try {
          const reliabilityRes = await fetch(RELIABILITY_API_URL);
          const reliabilityJson = await reliabilityRes.json();

          if (mounted) {
            if (reliabilityRes.ok && reliabilityJson.ok) {
              setReliabilityData(reliabilityJson);
              setReliabilityStatus("success");
            } else {
              setReliabilityStatus("error");
            }
          }
        } catch (reliabilityErr) {
          if (mounted) {
            setReliabilityStatus("error");
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || "Could not load staffing board.");
          setStatus("error");
          setReliabilityStatus("error");
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const stats = data?.stats || {};
  const todayShifts = data?.todayShifts || [];
  const upcomingShifts = data?.upcomingShifts || [];
  const apiCoverageWarnings = data?.coverageWarnings || [];
  const coverageWarnings = buildDemoCoverageWarnings(todayShifts, apiCoverageWarnings);
  const activeByDepartment = data?.activeByDepartment || {};
  const managersToday = todayShifts.filter((shift) => shift.isManager);

    const rawReliabilitySignals =
    reliabilityData?.activeSignals?.length ? reliabilityData.activeSignals : [];

  const reliabilitySignals = pickHighestReliabilitySignals(rawReliabilitySignals).slice(
    0,
    5
  );

  const realActiveReliabilityCount = reliabilitySignals.filter(
    (signal) => !signal.isDemo
  ).length;

  return (
    <div id="staffing-board" className="container py-6 md:py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-bold tracking-[0.14em] uppercase text-cyan-700">
            Staffing Board
          </div>

          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            Today’s Floor
          </h2>

          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Track who is scheduled, where coverage is thin, and which staffing risks may affect service.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-white to-sky-50 px-4 py-3 text-center shadow-sm">
            <div className="text-xl font-bold text-slate-950">
              {valueOrDash(stats.todayStaffCount)}
            </div>
            <div className="text-[11px] text-slate-500">On today</div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-white to-amber-50 px-4 py-3 text-center shadow-sm">
            <div className="text-xl font-bold text-amber-800">
              {valueOrDash(coverageWarnings.length)}
            </div>
            <div className="text-[11px] text-amber-700">Coverage gaps</div>
          </div>

          <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-white to-purple-50 px-4 py-3 text-center shadow-sm">
            <div className="text-xl font-bold text-purple-800">
              {valueOrDash(realActiveReliabilityCount || 0)}
            </div>
            <div className="text-[11px] text-purple-700">Reliability watch</div>
          </div>
        </div>
      </div>

      {status === "loading" ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading staffing coverage...
        </div>
      ) : null}

      {status === "error" ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {status === "success" ? (
        <div className="space-y-6">
          <section className="rounded-[28px] border border-sky-100 bg-gradient-to-br from-white via-sky-50/25 to-cyan-50/25 p-5 shadow-[0_16px_34px_rgba(14,165,233,0.07)]">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <ShieldCheck className="h-4 w-4" />
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-sky-700">
                  Floor Coverage
                </div>

                <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
                  Department Coverage
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Quick read on active coverage by department for the current service window.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <DepartmentStat
                label="FOH"
                value={activeByDepartment.FOH || 0}
                icon={Users}
              />
              <DepartmentStat
                label="BOH"
                value={activeByDepartment.BOH || 0}
                icon={ChefHat}
              />
              <DepartmentStat
                label="Bar"
                value={activeByDepartment.Bar || 0}
                icon={Martini}
              />
              <DepartmentStat
                label="Management"
                value={activeByDepartment.Management || managersToday.length || 0}
                icon={BriefcaseBusiness}
              />
              <DepartmentStat
                label="Support"
                value={activeByDepartment.Support || 0}
                icon={Utensils}
              />
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/80 to-purple-50/35 p-5 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs font-bold tracking-[0.14em] uppercase text-purple-700">
                  Staff Reliability Watch
                </div>

                <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
                  Attendance Risk Monitor
                </h3>

                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Flags repeat callouts, no-shows, and late changes before they become a service coverage problem.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-center shadow-sm">
                  <div className="text-xl font-bold text-purple-800">
                    {valueOrDash(reliabilitySignals.length || 0)}
                  </div>
                  <div className="text-[11px] text-purple-700">Active watch</div>
                </div>

                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-center shadow-sm">
                  <div className="text-xl font-bold text-rose-800">
                    {valueOrDash(realActiveReliabilityCount || 0)}
                  </div>
                  <div className="text-[11px] text-rose-700">Real signals</div>
                </div>
              </div>
            </div>

            {reliabilityStatus === "loading" ? (
              <EmptyState text="Loading staff reliability signals..." />
            ) : reliabilityStatus === "error" ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">
                Staff reliability signals are not available yet.
              </div>
            ) : reliabilitySignals.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {reliabilitySignals.map((signal) => (
                  <ReliabilitySignalCard key={signal.id} signal={signal} />
                ))}
              </div>
            ) : (
              <EmptyState text="No active staff reliability signals yet." />
            )}
          </section>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <SectionShell
              eyebrow="Needs Action"
              title="Coverage Gaps"
              description="Staffing gaps that may need a backup plan before the next rush."
              icon={AlertCircle}
              tone="amber"
            >
              <div className="space-y-3">
                {coverageWarnings.length ? (
                  coverageWarnings.map((warning) => (
                    <WarningCard key={warning.id} warning={warning} />
                  ))
                ) : (
                  <EmptyState text="No active coverage gaps found for today." />
                )}
              </div>
            </SectionShell>

            <SectionShell
              eyebrow="Current Floor"
              title="On the Floor Today"
              description="Current service-window shifts and active department coverage."
              icon={Users}
              tone="sky"
            >
              <div className="space-y-3">
                {todayShifts.length ? (
                  todayShifts.map((shift) => (
                    <ShiftCard key={shift.id} shift={shift} />
                  ))
                ) : (
                  <EmptyState text="No staff shifts found for today yet." />
                )}
              </div>
            </SectionShell>

            <SectionShell
              eyebrow="Planning Window"
              title="Upcoming Coverage"
              description="Upcoming shifts to review for coverage, role balance, and reliability risk."
              icon={CalendarDays}
              tone="purple"
            >
              <div className="space-y-3">
                {upcomingShifts.length ? (
                  upcomingShifts.map((shift) => (
                    <ShiftCard key={shift.id} shift={shift} />
                  ))
                ) : (
                  <EmptyState text="No upcoming shifts found yet." />
                )}
              </div>
            </SectionShell>
          </div>
        </div>
      ) : null}
    </div>
  );
}
