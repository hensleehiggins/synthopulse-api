const Airtable = require("airtable");

const base = new Airtable({
  apiKey: process.env.AIRTABLE_PAT,
}).base(process.env.AIRTABLE_BASE_ID);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function send(res, status, body) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  res.status(status).json(body);
}

function text(value) {
  if (!value) return "";

  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.name) return item.name;
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }

  if (value?.name) return value.name;

  return String(value);
}

function bool(value) {
  return value === true;
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function dateKey(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDateLabel(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function isFutureOrToday(value) {
  if (!value) return true;

  const key = dateKey(value);
  if (!key) return true;

  return key >= todayKey();
}

function isToday(value) {
  if (!value) return false;

  const key = dateKey(value);
  if (!key) return false;

  return key === todayKey();
}

function shiftRecord(record) {
  const fields = record.fields || {};

  const start = fields["Start DateTime"];
  const end = fields["End DateTime"];
  const shiftDate = fields["Shift Date"] || start;

  const startLabel = formatTime(start);
  const endLabel = formatTime(end);
  const timeLabel =
    startLabel && endLabel
      ? `${startLabel} – ${endLabel}`
      : startLabel || endLabel || "";

  return {
    id: record.id,
    shiftName: text(fields["Shift Name"]) || "Unnamed shift",
    source: text(fields["Source"]),
    externalShiftId: text(fields["External Shift ID"]),
    employeeName: text(fields["Employee Name"]),
    externalEmployeeId: text(fields["External Employee ID"]),
    role: text(fields["Role"]),
    department: text(fields["Department"]),
    shiftDate: toIso(shiftDate),
    startDateTime: toIso(start),
    endDateTime: toIso(end),
    dateLabel: formatDateLabel(shiftDate),
    timeLabel,
    scheduledHours: number(fields["Scheduled Hours"]),
    shiftStatus: text(fields["Shift Status"]),
    restaurant: text(fields["Restaurant"]),
    locationStation: text(fields["Location / Station"]),
    isManager: bool(fields["Is Manager"]),
    isCoverageRisk: bool(fields["Is Coverage Risk"]),
    lastSyncedAt: toIso(fields["Last Synced At"]),
    syncNotes: text(fields["Sync Notes"]),
  };
}

async function getAllRecords(tableName, options = {}) {
  const records = [];

  await base(tableName)
    .select(options)
    .eachPage((page, fetchNextPage) => {
      records.push(...page);
      fetchNextPage();
    });

  return records;
}

function countByDepartment(shifts) {
  const counts = {
    FOH: 0,
    BOH: 0,
    Bar: 0,
    Management: 0,
    Support: 0,
    Other: 0,
  };

  shifts.forEach((shift) => {
    const department = shift.department || "Other";
    if (counts[department] === undefined) counts.Other += 1;
    else counts[department] += 1;
  });

  return counts;
}

function buildCoverageWarnings(todayShifts) {
  const warnings = [];
  const counts = countByDepartment(todayShifts);

  const activeShifts = todayShifts.filter((shift) => {
    const status = String(shift.shiftStatus || "").toLowerCase();
    return !["cancelled", "callout", "no show"].includes(status);
  });

  const activeCounts = countByDepartment(activeShifts);

  const riskShifts = todayShifts.filter((shift) => shift.isCoverageRisk);

  riskShifts.forEach((shift) => {
    warnings.push({
      id: `risk-${shift.id}`,
      type: "Coverage Risk",
      severity: "High",
      title: `${shift.employeeName || shift.shiftName} flagged as coverage risk`,
      detail:
        shift.syncNotes ||
        `${shift.role || "Shift"} ${shift.timeLabel ? `(${shift.timeLabel})` : ""} needs attention.`,
      shiftId: shift.id,
    });
  });

  todayShifts
    .filter((shift) => {
      const status = String(shift.shiftStatus || "").toLowerCase();
      return ["cancelled", "callout", "no show"].includes(status);
    })
    .forEach((shift) => {
      warnings.push({
        id: `status-${shift.id}`,
        type: "Shift Status",
        severity: "High",
        title: `${shift.shiftStatus} — ${shift.employeeName || shift.shiftName}`,
        detail: `${shift.role || "Shift"} ${shift.timeLabel ? `scheduled ${shift.timeLabel}` : "needs coverage review"}.`,
        shiftId: shift.id,
      });
    });

  if (todayShifts.length > 0 && activeCounts.FOH === 0) {
    warnings.push({
      id: "no-foh",
      type: "Department Coverage",
      severity: "Medium",
      title: "No active FOH shifts found today",
      detail: "KitchenPulse does not see FOH coverage in Staff Shifts for today.",
    });
  }

  if (todayShifts.length > 0 && activeCounts.BOH === 0) {
    warnings.push({
      id: "no-boh",
      type: "Department Coverage",
      severity: "Medium",
      title: "No active BOH shifts found today",
      detail: "KitchenPulse does not see BOH coverage in Staff Shifts for today.",
    });
  }

  if (todayShifts.length > 0 && activeCounts.Management === 0) {
    warnings.push({
      id: "no-manager",
      type: "Manager Coverage",
      severity: "Medium",
      title: "No manager shift marked today",
      detail: "No Staff Shifts record is marked as manager coverage for today.",
    });
  }

  return warnings.slice(0, 10);
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return send(res, 200, { ok: true });
  }

  if (req.method !== "GET") {
    return send(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const records = await getAllRecords("Staff Shifts", {
      fields: [
        "Shift Name",
        "Source",
        "External Shift ID",
        "Employee Name",
        "External Employee ID",
        "Role",
        "Department",
        "Shift Date",
        "Start DateTime",
        "End DateTime",
        "Scheduled Hours",
        "Shift Status",
        "Restaurant",
        "Location / Station",
        "Is Manager",
        "Is Coverage Risk",
        "Last Synced At",
        "Sync Notes",
      ],
    });

    const shifts = records
      .map(shiftRecord)
      .filter((shift) => isFutureOrToday(shift.shiftDate || shift.startDateTime))
      .sort((a, b) => {
        const aTime = new Date(a.startDateTime || a.shiftDate || 0).getTime();
        const bTime = new Date(b.startDateTime || b.shiftDate || 0).getTime();
        return aTime - bTime;
      });

    const todayShifts = shifts.filter((shift) =>
      isToday(shift.shiftDate || shift.startDateTime)
    );

    const upcomingShifts = shifts
      .filter((shift) => !isToday(shift.shiftDate || shift.startDateTime))
      .slice(0, 20);

    const activeTodayShifts = todayShifts.filter((shift) => {
      const status = String(shift.shiftStatus || "").toLowerCase();
      return !["cancelled", "callout", "no show"].includes(status);
    });

    const byDepartment = countByDepartment(todayShifts);
    const activeByDepartment = countByDepartment(activeTodayShifts);
    const coverageWarnings = buildCoverageWarnings(todayShifts);

    const stats = {
      todayStaffCount: activeTodayShifts.length,
      totalTodayShifts: todayShifts.length,
      fohCount: activeByDepartment.FOH,
      bohCount: activeByDepartment.BOH,
      barCount: activeByDepartment.Bar,
      managementCount: activeByDepartment.Management,
      supportCount: activeByDepartment.Support,
      coverageWarnings: coverageWarnings.length,
      upcomingShifts: upcomingShifts.length,
    };

    return send(res, 200, {
      ok: true,
      stats,
      byDepartment,
      activeByDepartment,
      coverageWarnings,
      todayShifts,
      upcomingShifts,
      shifts,
    });
  } catch (error) {
    console.error("staffing-board error", error);

    return send(res, 500, {
      ok: false,
      error: error.message || "Failed to load staffing board",
    });
  }
};
