import { useEffect, useState } from "react";
import { useRecords, q } from "@/lib/datasource";
import {
  Clock,
  MapPin,
  TrendingUp,
  Radio,
  CalendarDays,
} from "lucide-react";

const select = q.select({
  displayDate: "Display Date",
  type: "Type",
  description: "Description",
  eventName: "Event Name",
  eventDisplayDate: "Event Display Date",
  estimatedDraw: "Estimated Draw",
  trafficEffect: "Traffic Effect",
  startDateTime: "Start DateTime",
  endDateTime: "End DateTime",
  needsReview: "Needs Review",
  venueArea: "Venue / Area",
  source: "Source",
  sourceType: "Source Type",
  showOnServicePressure: "Show on Service Pressure",
  decisionDriving: "Decision Driving Event",
  eventWeight: "Event Weight",
  impactStrength: "Impact Strength",
  active: "Active",
  eventBoardColumn: "Event Board Column",
  eventSortDate: "Event Sort Date",
});

function fieldText(value) {
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
        if (typeof v === "object" && "label" in v) return String(v.label);
        if (typeof v === "object" && "name" in v) return String(v.name);
        if (typeof v === "object" && "foreignRowDisplayName" in v) {
          return String(v.foreignRowDisplayName);
        }
        return String(v);
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    if ("label" in value) return String(value.label);
    if ("name" in value) return String(value.name);
    if ("foreignRowDisplayName" in value) {
      return String(value.foreignRowDisplayName);
    }
  }

  return String(value);
}

function fieldBool(value) {
  if (typeof value === "boolean") return value;
  const text = fieldText(value).toLowerCase();
  return text === "true" || text === "yes" || text === "1" || text === "checked";
}

function toEasternDateParts(value) {
  if (!value) return null;

  const text = fieldText(value);
  if (!text) return null;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value || "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    key: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

function easternTodayKey() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function isTodayEvent(item) {
  const fields = item.fields || {};
  const today = easternTodayKey();

  const startKey = toEasternDateParts(fields.startDateTime)?.key || "";
  const endKey = toEasternDateParts(fields.endDateTime)?.key || "";

  return startKey === today || endKey === today;
}

function getStartTimeMs(item) {
  const raw =
    fieldText(item?.fields?.startDateTime) ||
    fieldText(item?.fields?.eventSortDate) ||
    fieldText(item?.fields?.displayDate);

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? Number.MAX_SAFE_INTEGER : parsed.getTime();
}

function toLocalInputValue(value) {
  const text = fieldText(value);
  if (!text) return "";

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(" ", "T");
}

function formatDateTime(dateStr) {
  const text = fieldText(dateStr);
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);

    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function getEventName(item) {
  const fields = item.fields || {};
  return fieldText(fields.eventName) || fieldText(fields.description) || "Unnamed event";
}

function getDrawLabel(draw) {
  return fieldText(draw);
}

function isHighDraw(draw) {
  const label = getDrawLabel(draw).toLowerCase();
  return label.includes("very high") || label.includes("high");
}

function getSignalTone(draw) {
  const label = getDrawLabel(draw).toLowerCase();

  if (label.includes("very")) {
    return {
      rail: "#EA580C",
      soft: "rgba(249,115,22,0.13)",
      border: "rgba(249,115,22,0.30)",
      text: "#EA580C",
      glow: "rgba(249,115,22,0.18)",
      label: "Very High",
    };
  }

  if (label.includes("high")) {
    return {
      rail: "#D97706",
      soft: "rgba(245,158,11,0.12)",
      border: "rgba(245,158,11,0.26)",
      text: "#B45309",
      glow: "rgba(245,158,11,0.15)",
      label: "High",
    };
  }

  if (label.includes("medium")) {
    return {
      rail: "#2563EB",
      soft: "rgba(59,130,246,0.10)",
      border: "rgba(59,130,246,0.22)",
      text: "#2563EB",
      glow: "rgba(59,130,246,0.13)",
      label: "Medium",
    };
  }

  return {
    rail: "#0891B2",
    soft: "rgba(34,211,238,0.10)",
    border: "rgba(34,211,238,0.22)",
    text: "#0891B2",
    glow: "rgba(34,211,238,0.13)",
    label: getDrawLabel(draw) || "Low",
  };
}

function isOperationalNote(item) {
  const fields = item.fields || {};

  const name = fieldText(fields.eventName).toLowerCase();
  const description = fieldText(fields.description).toLowerCase();
  const sourceType = fieldText(fields.sourceType).toLowerCase();
  const source = fieldText(fields.source).toLowerCase();

  const textBlob = `${name} ${description} ${sourceType} ${source}`;

  const noteLanguage =
    textBlob.includes("deposit follow") ||
    textBlob.includes("follow-up") ||
    textBlob.includes("follow up") ||
    textBlob.includes("required") ||
    textBlob.includes("missing") ||
    textBlob.includes("needs review") ||
    textBlob.includes("review required") ||
    textBlob.includes("task") ||
    textBlob.includes("todo") ||
    textBlob.includes("to-do") ||
    textBlob.includes("note") ||
    textBlob.includes("menu finalization") ||
    textBlob.includes("menu finalize") ||
    textBlob.includes("finalization pending") ||
    textBlob.includes("pending") ||
    textBlob.includes("chef table");

  const hasRealVenue = Boolean(fieldText(fields.venueArea));
  const hasRealStart = Boolean(fields.startDateTime);

  return (
    noteLanguage &&
    (!hasRealVenue ||
      !hasRealStart ||
      name.includes("follow") ||
      name.includes("required") ||
      name.includes("pending") ||
      name.includes("finalization"))
  );
}

function isServicePressureCandidate(item) {
  const fields = item.fields || {};
  const type = fieldText(fields.type).toLowerCase();

  if (type !== "event" && type !== "holiday") return false;
  if (fields.active !== undefined && !fieldBool(fields.active)) return false;

  if (item.__forceServicePressure) return true;
  if (!isTodayEvent(item)) return false;

  const manuallyFlagged = fieldBool(fields.showOnServicePressure);
  const decisionDriving = fieldBool(fields.decisionDriving);
  const eventWeight = Number(fields.eventWeight || 0);
  const impactStrength = Number(fields.impactStrength || 0);
  const highDraw = isHighDraw(fields.estimatedDraw);

  return (
    manuallyFlagged ||
    decisionDriving ||
    eventWeight >= 7 ||
    impactStrength >= 7 ||
    highDraw
  );
}

function makeLocalCreatedItem(detail) {
  return {
    id: detail.id || detail.recordId || `temp-${Date.now()}`,
    __forceServicePressure: true,
    fields: {
      displayDate: detail.displayDate || detail.startDateTime,
      type: detail.type || "Event",
      description: detail.description || detail.eventName || "New event",
      eventName: detail.eventName || detail.description || "New event",
      estimatedDraw: detail.estimatedDraw || "Very High",
      trafficEffect: detail.trafficEffect || "Heavy",
      startDateTime: detail.startDateTime || detail.displayDate || "",
      endDateTime: detail.endDateTime || "",
      venueArea: detail.venueArea || "",
      showOnServicePressure: true,
      decisionDriving: true,
      eventWeight: detail.eventWeight || 10,
      active: true,
    },
  };
}

function SectionHeader({ eyebrow, title, body, count, tone = "cyan" }) {
  const palette =
    tone === "orange"
      ? {
          bg: "linear-gradient(135deg, rgba(255,247,237,0.88), rgba(255,255,255,0.96) 56%, rgba(239,246,255,0.64))",
          border: "rgba(245,158,11,0.24)",
          eyebrow: "#D97706",
          dot: "#F59E0B",
        }
      : tone === "blue"
        ? {
            bg: "linear-gradient(135deg, rgba(239,246,255,0.92), rgba(255,255,255,0.96) 55%, rgba(236,254,255,0.62))",
            border: "rgba(59,130,246,0.20)",
            eyebrow: "#2563EB",
            dot: "#22D3EE",
          }
        : {
            bg: "linear-gradient(135deg, rgba(236,254,255,0.92), rgba(255,255,255,0.96) 55%, rgba(239,246,255,0.62))",
            border: "rgba(34,211,238,0.20)",
            eyebrow: "#0891B2",
            dot: "#22D3EE",
          };

  return (
    <div
      className="rounded-[22px] px-4 py-4"
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        boxShadow:
          "0 10px 24px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.78)",
      }}
    >
      <div
        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em]"
        style={{ color: palette.eyebrow }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{
            background: palette.dot,
            boxShadow: `0 0 12px ${palette.dot}`,
          }}
        />
        {eyebrow}
      </div>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-semibold leading-tight text-slate-950">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {body}
          </p>
        </div>

        <div
          className="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold"
          style={{
            background: "rgba(255,255,255,0.72)",
            borderColor: palette.border,
            color: "#334155",
          }}
        >
          {count}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, body, tone = "cyan" }) {
  const Icon = icon;

  const colors =
    tone === "orange"
      ? { bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" }
      : tone === "blue"
        ? { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" }
        : { bg: "#ECFEFF", color: "#0891B2", border: "#A5F3FC" };

  return (
    <div
      className="rounded-[24px] border border-dashed px-5 py-7 text-center"
      style={{
        background: `linear-gradient(135deg, ${colors.bg}, #FFFFFF)`,
        borderColor: colors.border,
        boxShadow: "inset 0 1px 12px rgba(15,23,42,0.03)",
      }}
    >
      <div
        className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full"
        style={{
          background: colors.bg,
          color: colors.color,
        }}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-slate-500">{body}</div>
    </div>
  );
}

export default function Block() {
  const [editingItem, setEditingItem] = useState(null);
  const [editMode, setEditMode] = useState("review");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editedOverrides, setEditedOverrides] = useState({});
  const [createdEvents, setCreatedEvents] = useState([]);
  const [editForm, setEditForm] = useState({
    eventName: "",
    startDateTime: "",
    venueArea: "",
    estimatedDraw: "",
    trafficEffect: "",
  });

  useEffect(() => {
    function handleCreatedEvent(event) {
      const detail = event?.detail;
      if (!detail) return;

      const createdItem = makeLocalCreatedItem(detail);

      setCreatedEvents((prev) => {
        const exists = prev.some((item) => item.id === createdItem.id);
        if (exists) return prev;

        return [createdItem, ...prev];
      });
    }

    window.addEventListener(
      "kp:service-pressure-event-created",
      handleCreatedEvent
    );

    return () => {
      window.removeEventListener(
        "kp:service-pressure-event-created",
        handleCreatedEvent
      );
    };
  }, []);

  const activeTodayQuery = useRecords({
    select,
    orderBy: q.desc("startDateTime"),
    count: 1000,
  });

  const upcomingQuery = useRecords({
    select,
    where: q.text("eventBoardColumn").is("Upcoming Impact"),
    orderBy: q.asc("eventSortDate"),
    count: 3,
  });

  const airtableTodayItems =
    activeTodayQuery.data?.pages.flatMap((p) => p.items) ?? [];

  const allTodayItems = [
    ...createdEvents,
    ...airtableTodayItems.filter(
      (item) => !createdEvents.some((created) => created.id === item.id)
    ),
  ];

  const activeTodayItems = allTodayItems
    .map((item) => ({
      ...item,
      fields: { ...item.fields, ...(editedOverrides[item.id] || {}) },
    }))
    .filter(isServicePressureCandidate)
    .sort((a, b) => getStartTimeMs(a) - getStartTimeMs(b))
    .slice(0, 4);

  const upcomingRawItems =
    upcomingQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const upcomingItems = upcomingRawItems
    .filter((item) => !isOperationalNote(item))
    .slice(0, 4);

  function openEdit(item, mode = "review") {
    const fields = { ...item.fields, ...(editedOverrides[item.id] || {}) };

    setEditingItem(item);
    setEditMode(mode);
    setEditForm({
      eventName: fieldText(fields.eventName) || fieldText(fields.description) || "",
      startDateTime: toLocalInputValue(fields.startDateTime),
      venueArea: fieldText(fields.venueArea),
      estimatedDraw:
        typeof fields.estimatedDraw === "object"
          ? fields.estimatedDraw?.label || ""
          : fieldText(fields.estimatedDraw),
      trafficEffect:
        typeof fields.trafficEffect === "object"
          ? fields.trafficEffect?.label || ""
          : fieldText(fields.trafficEffect),
    });
  }

  async function saveEdit() {
    if (!editingItem?.id) return;

    setSavingEdit(true);

    try {
      const payload = {
        recordId: editingItem.id,
        eventName: editForm.eventName,
        startDateTime: editForm.startDateTime,
        venueArea: editForm.venueArea,
      };

      if (editMode === "pressure") {
        payload.estimatedDraw = editForm.estimatedDraw;
        payload.trafficEffect = editForm.trafficEffect;
      }

      const res = await fetch("https://project-1csz2.vercel.app/api/update-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.ok) {
        alert(`Edit failed: ${data.error || "Unknown error"}`);
        setSavingEdit(false);
        return;
      }

      setEditedOverrides((prev) => ({
        ...prev,
        [editingItem.id]: {
          eventName: editForm.eventName,
          description: editForm.eventName,
          startDateTime: editForm.startDateTime,
          displayDate: editForm.startDateTime,
          venueArea: editForm.venueArea,
          estimatedDraw: editForm.estimatedDraw,
          trafficEffect: editForm.trafficEffect,
          showOnServicePressure: true,
        },
      }));

      setEditingItem(null);
      setSavingEdit(false);
    } catch (err) {
      console.error("Edit failed", err);
      alert("Edit failed. Check Vercel logs.");
      setSavingEdit(false);
    }
  }

  function PressureCard({ item }) {
    const fields = item.fields || {};
    const startTime = formatDateTime(fields.startDateTime);
    const eventName = getEventName(item);
    const venueArea = fieldText(fields.venueArea);
    const drawLabel = getDrawLabel(fields.estimatedDraw);
    const tone = getSignalTone(fields.estimatedDraw);

    return (
      <div
        className="relative overflow-hidden rounded-[22px] border p-4 shadow-[0_10px_24px_rgba(15,23,42,0.07)]"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.97), rgba(248,250,252,0.76))",
          borderColor: tone.border,
          borderLeft: `4px solid ${tone.rail}`,
          boxShadow:
            "0 10px 24px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.78)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
          style={{ background: tone.glow }}
        />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <h4 className="text-sm font-bold leading-tight text-slate-950">
            {eventName}
          </h4>

          <span
            className="rounded-full px-2 py-1 text-[10px] font-semibold"
            style={{
              background: tone.soft,
              color: tone.text,
              border: `1px solid ${tone.border}`,
            }}
          >
            Today
          </span>
        </div>

        {startTime ? (
          <div className="relative z-10 mt-3 flex items-center gap-1.5 text-xs text-slate-600">
            <Clock className="h-3.5 w-3.5" />
            <span>{startTime}</span>
          </div>
        ) : null}

        {venueArea ? (
          <div className="relative z-10 mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin className="h-3.5 w-3.5" />
            <span>{venueArea}</span>
          </div>
        ) : null}

        {drawLabel ? (
          <div className="relative z-10 mt-3 border-t border-slate-100 pt-3">
            <span
              className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold"
              style={{
                background: tone.soft,
                color: tone.text,
                border: `1px solid ${tone.border}`,
              }}
            >
              {drawLabel} draw
            </span>
          </div>
        ) : null}

        <div className="relative z-10 mt-3 text-[11px] leading-relaxed text-slate-500">
          Expected to affect today&apos;s service window.
        </div>

        <div className="relative z-10 mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => openEdit(item, "pressure")}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  function UpcomingCard({ item }) {
    const fields = item.fields || {};
    const eventName = getEventName(item);
    const rawDate =
      fields.startDateTime ||
      fields.eventDisplayDate ||
      fields.eventSortDate ||
      null;

    const displayDate = rawDate ? formatDateTime(String(rawDate)) : null;
    const venueArea = fieldText(fields.venueArea);
    const drawLabel = getDrawLabel(fields.estimatedDraw);
    const tone = getSignalTone(fields.estimatedDraw);

    return (
      <div
        className="relative overflow-hidden rounded-[22px] border p-4 shadow-[0_10px_24px_rgba(59,130,246,0.07)]"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.97), rgba(248,250,252,0.76))",
          borderColor: tone.border,
          borderLeft: `4px solid ${tone.rail}`,
          boxShadow:
            "0 10px 24px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.78)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
          style={{ background: tone.glow }}
        />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <h4 className="text-sm font-bold leading-tight text-slate-950">
            {eventName}
          </h4>

          {drawLabel ? (
            <span
              className="rounded-full px-2 py-1 text-[10px] font-semibold"
              style={{
                background: tone.soft,
                color: tone.text,
                border: `1px solid ${tone.border}`,
              }}
            >
              {drawLabel}
            </span>
          ) : null}
        </div>

        {displayDate ? (
          <div className="relative z-10 mt-3 flex items-center gap-1.5 text-xs text-slate-600">
            <Clock className="h-3.5 w-3.5" />
            <span>{displayDate}</span>
          </div>
        ) : null}

        {venueArea ? (
          <div className="relative z-10 mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin className="h-3.5 w-3.5" />
            <span>{venueArea}</span>
          </div>
        ) : null}

        <div className="relative z-10 mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Expected demand impact</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container relative overflow-hidden py-6 md:py-8 lg:py-10">
      <div
        className="overflow-hidden rounded-[30px] border shadow-[0_22px_60px_rgba(15,23,42,0.10)]"
        style={{
          background:
            "radial-gradient(circle at 12% 8%, rgba(34,211,238,0.12), transparent 28%), radial-gradient(circle at 88% 10%, rgba(59,130,246,0.11), transparent 30%), linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.94) 52%, rgba(226,232,240,0.80) 100%)",
          borderColor: "rgba(15,23,42,0.08)",
          boxShadow:
            "0 18px 45px rgba(15,23,42,0.09), inset 0 1px 0 rgba(255,255,255,0.82)",
        }}
      >
        <div
          className="border-b px-5 py-5 md:px-7"
          style={{
            background:
              "linear-gradient(135deg, rgba(236,254,255,0.86), rgba(255,255,255,0.96) 48%, rgba(239,246,255,0.88))",
            borderColor: "rgba(15,23,42,0.08)",
          }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-700">
                Demand Command Center
              </div>

              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-slate-950 md:text-3xl">
                Service Pressure Board
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Watch today&apos;s active service pressure and keep the next planning window connected to prep, staffing, and floor timing.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div
                className="rounded-2xl border px-4 py-3 text-center shadow-sm"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(255,247,237,0.72))",
                  borderColor: "rgba(245,158,11,0.24)",
                  boxShadow:
                    "0 10px 24px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.78)",
                }}
              >
                <div className="text-lg font-bold text-slate-950">
                  {activeTodayItems.length}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Today
                </div>
              </div>

              <div
                className="rounded-2xl border px-4 py-3 text-center shadow-sm"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(239,246,255,0.72))",
                  borderColor: "rgba(59,130,246,0.22)",
                  boxShadow:
                    "0 10px 24px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.78)",
                }}
              >
                <div className="text-lg font-bold text-slate-950">
                  {upcomingItems.length}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Upcoming
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr] lg:gap-6">
            <section
              className="rounded-[28px] border p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(255,247,237,0.46) 45%, rgba(248,250,252,0.78))",
                borderColor: "rgba(245,158,11,0.18)",
              }}
            >
              <SectionHeader
                eyebrow="Live Service Signal"
                title="Today’s Service Pressure"
                body="Events intentionally flagged to affect today’s service window."
                count={`${activeTodayItems.length} ${
                  activeTodayItems.length === 1 ? "event" : "events"
                }`}
                tone="orange"
              />

              <div className="mt-5 space-y-3">
                {activeTodayQuery.status === "pending" &&
                activeTodayItems.length === 0 ? (
                  <div className="text-sm text-slate-500">Loading...</div>
                ) : null}

                {activeTodayQuery.status === "error" &&
                activeTodayItems.length === 0 ? (
                  <div className="text-sm text-red-600">Error loading data</div>
                ) : null}

                {activeTodayQuery.status === "success" &&
                activeTodayItems.length === 0 ? (
                  <EmptyState
                    icon={Radio}
                    title="No active pressure today"
                    body="Upcoming demand signals are listed to the right."
                    tone="orange"
                  />
                ) : null}

                {activeTodayItems.map((item) => (
                  <PressureCard key={item.id} item={item} />
                ))}
              </div>
            </section>

            <section
              className="rounded-[28px] border p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(239,246,255,0.54) 45%, rgba(236,254,255,0.42))",
                borderColor: "rgba(34,211,238,0.16)",
              }}
            >
              <SectionHeader
                eyebrow="Planning Window"
                title="Upcoming Impact"
                body="Events worth planning around."
                count={`Showing ${upcomingItems.length}`}
                tone="blue"
              />

              <div className="mt-5 space-y-3">
                {upcomingQuery.status === "pending" ? (
                  <div className="text-sm text-slate-500">Loading...</div>
                ) : null}

                {upcomingQuery.status === "success" &&
                upcomingItems.length === 0 ? (
                  <EmptyState
                    icon={CalendarDays}
                    title="No upcoming impact events"
                    body="Nothing in the current planning window."
                    tone="blue"
                  />
                ) : null}

                {upcomingItems.map((item) => (
                  <UpcomingCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      {editingItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-950">
                Edit Event
              </h3>
              <p className="text-xs text-slate-500">
                Update the event details and KitchenPulse will refresh the board view.
              </p>
            </div>

            <div className="space-y-3">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Event name"
                value={editForm.eventName}
                onChange={(e) =>
                  setEditForm({ ...editForm, eventName: e.target.value })
                }
              />

              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                type="datetime-local"
                value={editForm.startDateTime}
                onChange={(e) =>
                  setEditForm({ ...editForm, startDateTime: e.target.value })
                }
              />

              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Venue / Area"
                value={editForm.venueArea}
                onChange={(e) =>
                  setEditForm({ ...editForm, venueArea: e.target.value })
                }
              />

              {editMode === "pressure" ? (
                <>
                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="Estimated Draw"
                    value={editForm.estimatedDraw}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        estimatedDraw: e.target.value,
                      })
                    }
                  />

                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="Traffic Effect"
                    value={editForm.trafficEffect}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        trafficEffect: e.target.value,
                      })
                    }
                  />
                </>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-md border px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveEdit}
                disabled={savingEdit}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {savingEdit ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
