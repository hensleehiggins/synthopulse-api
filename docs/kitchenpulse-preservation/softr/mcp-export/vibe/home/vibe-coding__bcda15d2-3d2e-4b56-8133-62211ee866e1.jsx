import { useMemo } from "react";
import { useRecords, q } from "@/lib/datasource";

const select = q.select({
  eventName: "Event Name",
  eventSummary: "Event Summary",
  description: "Description",
  estimatedDraw: "Estimated Draw",
  eventPressureLabel: "Event Pressure Label",
  displayDate: "Display Date",
  forecastDate: "Forecast Date",
  date: "Date",
  startDateTime: "Start DateTime",
  priorityScore: "Priority Score",
  homeAlertWindow: "Home Alert Window",
  showOnHomeAlert: "Show on Home Alert",
  active: "Active",
  restaurant: "Restaurant",
  type: "Type",
});

function fieldText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
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
    if ("value" in value) return String(value.value);
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function fieldBool(value) {
  if (value === true) return true;
  const text = fieldText(value).toLowerCase();
  return text === "true" || text === "yes" || text === "checked";
}

function eventDate(fields) {
  return (
    fields.displayDate ||
    fields.forecastDate ||
    fields.date ||
    fields.startDateTime ||
    null
  );
}

function asDate(value) {
  if (!value) return null;

  const raw =
    typeof value === "object"
      ? fieldText(value)
      : value;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(start, end) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(end) - startOfDay(start)) / msPerDay);
}

function dateLabel(fields) {
  const parsed = asDate(eventDate(fields));
  if (!parsed) return "";

  const diff = daysBetween(new Date(), parsed);

  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff > 1) return `in ${diff} days`;

  return "";
}

function buildTitle(fields) {
  const name = fieldText(fields.eventName) || "Demand alert";
  const label = dateLabel(fields).toLowerCase();

  if (label === "today") return `${name} is today`;
  if (label === "tomorrow") return `${name} tomorrow`;
  if (label.startsWith("in ")) return `${name} ${label}`;

  return `${name} demand reminder`;
}

function fallbackSummary(eventName) {
  const name = fieldText(eventName).toLowerCase();

  if (name.includes("mother")) {
    return "Major restaurant-demand holiday. Expect family groups, premium entrées, desserts, wine/cocktails, and staffing pressure.";
  }

  if (name.includes("valentine")) {
    return "Major steakhouse demand signal. Watch reservations, two-tops, premium entrées, wine/cocktails, desserts, and pacing.";
  }

  if (name.includes("new year")) {
    return "Major celebration demand signal. Watch premium item prep, beverage staffing, desserts, and late-service pacing.";
  }

  if (name.includes("father")) {
    return "Restaurant-demand holiday. Expect family groups, premium entrées, cocktails, dessert attach, and staffing pressure.";
  }

  if (name.includes("easter")) {
    return "Family celebration holiday. Watch hours, reservation pace, patio/weather fit, and dessert demand.";
  }

  return "Important demand signal coming up. Watch reservations, staffing coverage, premium items, and service pacing.";
}

function isUsableAlert(item) {
  const fields = item.fields || {};

  const windowText = fieldText(fields.homeAlertWindow).toLowerCase();
  const typeText = fieldText(fields.type).toLowerCase();

  const active = fieldBool(fields.active);
  const showOnHome = fieldBool(fields.showOnHomeAlert);

  // Softr source filters should already do this, but this protects the block
  // if the editor preview sends extra records.
  if (windowText && windowText !== "show") return false;
  if (typeText && typeText !== "holiday") return false;
  if (!active) return false;
  if (!showOnHome) return false;

  return Boolean(fieldText(fields.eventName) || fieldText(fields.description));
}

function pickBestAlert(items) {
  return [...items]
    .filter(isUsableAlert)
    .sort((a, b) => {
      const aDate = asDate(eventDate(a.fields || {}));
      const bDate = asDate(eventDate(b.fields || {}));

      if (aDate && bDate) {
        const dateDiff = aDate.getTime() - bDate.getTime();
        if (dateDiff !== 0) return dateDiff;
      }

      const aPriority = Number((a.fields || {}).priorityScore || 0);
      const bPriority = Number((b.fields || {}).priorityScore || 0);

      return bPriority - aPriority;
    })[0];
}

export default function Block() {
  const { data, status } = useRecords({
    select,
    count: 20,
  });

  const items = data?.pages.flatMap((page) => page.items) || [];

  const alert = useMemo(() => {
    return pickBestAlert(items);
  }, [items]);

  if (status === "loading") {
    return <div className="kp-holiday-alert-empty" />;
  }

  if (!alert) {
    return <div className="kp-holiday-alert-empty" />;
  }

  const fields = alert.fields || {};

  const eventName = fieldText(fields.eventName);
  const title = buildTitle(fields);
  const summary =
    fieldText(fields.eventSummary) ||
    fieldText(fields.description) ||
    fallbackSummary(eventName);

  const pressure =
    fieldText(fields.eventPressureLabel) ||
    fieldText(fields.estimatedDraw) ||
    "Demand pressure";

  return (
    <div className="kp-holiday-alert-wrap">
      <style>{`
        .kp-holiday-alert-wrap {
          width: 100%;
          margin: 14px 0 22px;
        }

        .kp-holiday-alert {
          width: 100%;
          border: 1px solid rgba(245, 158, 11, 0.28);
          background:
            radial-gradient(circle at top left, rgba(245, 158, 11, 0.13), transparent 34%),
            linear-gradient(135deg, #fffaf0 0%, #ffffff 62%, #f8fbff 100%);
          border-radius: 18px;
          box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
          padding: 15px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .kp-holiday-alert-left {
          display: flex;
          align-items: center;
          gap: 13px;
          min-width: 0;
        }

        .kp-holiday-alert-icon {
          width: 38px;
          height: 38px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(245, 158, 11, 0.16);
          border: 1px solid rgba(245, 158, 11, 0.28);
          flex: 0 0 auto;
          font-size: 18px;
        }

        .kp-holiday-alert-copy {
          min-width: 0;
        }

        .kp-holiday-alert-kicker {
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 800;
          color: #a16207;
          margin-bottom: 3px;
        }

        .kp-holiday-alert-title {
          font-size: 17px;
          line-height: 1.18;
          font-weight: 850;
          color: #111827;
          margin: 0;
        }

        .kp-holiday-alert-summary {
          font-size: 13px;
          line-height: 1.45;
          color: #4b5563;
          margin: 5px 0 0;
          max-width: 880px;
        }

        .kp-holiday-alert-right {
          display: flex;
          align-items: center;
          gap: 9px;
          flex: 0 0 auto;
        }

        .kp-holiday-pill {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          line-height: 1;
          font-weight: 800;
          border: 1px solid rgba(245, 158, 11, 0.26);
          background: rgba(255, 247, 237, 0.9);
          color: #92400e;
          white-space: nowrap;
        }

        .kp-holiday-alert-empty {
          display: none;
        }

        @media (max-width: 760px) {
          .kp-holiday-alert-wrap {
            margin: 12px 0 18px;
          }

          .kp-holiday-alert {
            align-items: flex-start;
            flex-direction: column;
            gap: 12px;
            padding: 14px;
          }

          .kp-holiday-alert-left {
            align-items: flex-start;
          }

          .kp-holiday-alert-icon {
            width: 34px;
            height: 34px;
            font-size: 16px;
          }

          .kp-holiday-alert-title {
            font-size: 15px;
          }

          .kp-holiday-alert-summary {
            font-size: 12.5px;
          }

          .kp-holiday-alert-right {
            width: 100%;
            justify-content: flex-start;
          }
        }
      `}</style>

      <section className="kp-holiday-alert" aria-label="Holiday demand alert">
        <div className="kp-holiday-alert-left">
          <div className="kp-holiday-alert-icon" aria-hidden="true">
            ⚠️
          </div>

          <div className="kp-holiday-alert-copy">
            <div className="kp-holiday-alert-kicker">Don’t miss this</div>
            <h3 className="kp-holiday-alert-title">{title}</h3>
            <p className="kp-holiday-alert-summary">{summary}</p>
          </div>
        </div>

        <div className="kp-holiday-alert-right">
          <span className="kp-holiday-pill">{pressure}</span>
        </div>
      </section>
    </div>
  );
}
