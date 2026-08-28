import { useMemo, useState } from "react";
import { useRecords, q } from "@/lib/datasource";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  EyeOff,
  Link2,
  Loader2,
  Lock,
  PackageSearch,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";

const RECEIPT_COST_PROPOSALS_API =
  "https://project-1csz2.vercel.app/api/receipt-cost-proposals";

const select = q.select({
  proposalName: "Proposal Name",
  receiptLine: "Receipt Line",
  matchedInventoryItem: "Matched Inventory Item",
  matchedCostSourceItem: "Matched Cost Source Item",
  vendor: "Vendor",
  parsedItemName: "Parsed Item Name",
  currentCost: "Current Cost",
  proposedCost: "Proposed Cost",
  changePercent: "Change Percent",
  proposalStatus: "Proposal Status",
  approved: "Approved",
  applied: "Applied",
  proposalReason: "Proposal Reason",
  notes: "Notes",
  alreadyCurrent: "Already Current",
  staleDuplicate: "Stale Duplicate",
  duplicateHidden: "Duplicate Hidden",
  currentSignal: "Current Signal",
  hiddenFromReview: "Hidden From Review",
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

function fieldNumber(value) {
  if (Array.isArray(value)) return Number(value[0] || 0);

  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
}

function normalizePercentValue(value) {
  const num = fieldNumber(value);

  if (!num && num !== 0) return null;

  if (Math.abs(num) > 1) return num / 100;

  return num;
}

function money(value) {
  if (value === null || value === undefined || value === "") return "-";

  const num = fieldNumber(value);

  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function percent(value) {
  const num = normalizePercentValue(value);

  if (num === null) return "-";

  return num.toLocaleString("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function hasLinkedValue(value) {
  return Array.isArray(value) && value.length > 0;
}

function getStatus(item) {
  return fieldText(item.fields?.proposalStatus) || "Needs Review";
}

function getItemName(item) {
  const fields = item.fields || {};

  return (
    fieldText(fields.parsedItemName) ||
    fieldText(fields.proposalName) ||
    "Unmatched receipt item"
  );
}

function getVendor(item) {
  return fieldText(item.fields?.vendor) || "Vendor not entered";
}

function isMatched(item) {
  const fields = item.fields || {};

  return (
    hasLinkedValue(fields.matchedInventoryItem) ||
    hasLinkedValue(fields.matchedCostSourceItem)
  );
}

function isTruthyField(value) {
  if (value === true) return true;
  if (value === 1) return true;

  const text = fieldText(value).trim().toLowerCase();

  return ["true", "yes", "approved", "applied", "tracked"].includes(text);
}

function isFinalizedStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();

  return [
    "approved",
    "applied",
    "tracked",
    "rejected",
    "blocked",
    "current",
  ].includes(normalized);
}

function isHiddenOrCurrentProposal(item) {
  const fields = item.fields || {};
  const status = getStatus(item).trim().toLowerCase();
  const reason = fieldText(fields.proposalReason).toLowerCase();
  const notes = fieldText(fields.notes).toLowerCase();

  if (isTruthyField(fields.alreadyCurrent)) return true;
  if (isTruthyField(fields.staleDuplicate)) return true;
  if (isTruthyField(fields.duplicateHidden)) return true;
  if (isTruthyField(fields.currentSignal)) return true;
  if (isTruthyField(fields.hiddenFromReview)) return true;

  if (status === "current") return true;
  if (status === "duplicate") return true;
  if (status === "stale") return true;
  if (status === "hidden") return true;

  if (reason.includes("already current")) return true;
  if (reason.includes("stale duplicate")) return true;
  if (reason.includes("duplicate signal")) return true;
  if (reason.includes("older duplicate")) return true;

  if (notes.includes("already current")) return true;
  if (notes.includes("stale duplicate")) return true;
  if (notes.includes("duplicate signal")) return true;
  if (notes.includes("older duplicate")) return true;

  return false;
}

function isHiddenDuplicateProposal(item) {
  const fields = item.fields || {};
  const status = getStatus(item).trim().toLowerCase();
  const reason = fieldText(fields.proposalReason).toLowerCase();
  const notes = fieldText(fields.notes).toLowerCase();

  if (isFinalizedStatus(status)) return false;

  if (isTruthyField(fields.staleDuplicate)) return true;
  if (isTruthyField(fields.duplicateHidden)) return true;

  if (status === "duplicate") return true;
  if (status === "stale") return true;
  if (status === "hidden") return true;

  if (reason.includes("stale duplicate")) return true;
  if (reason.includes("duplicate signal")) return true;
  if (reason.includes("older duplicate")) return true;

  if (notes.includes("stale duplicate")) return true;
  if (notes.includes("duplicate signal")) return true;
  if (notes.includes("older duplicate")) return true;

  return false;
}

function hasMeaningfulCostChange(item) {
  const fields = item.fields || {};

  const current = fieldNumber(fields.currentCost);
  const proposed = fieldNumber(fields.proposedCost);
  const percentChange = normalizePercentValue(fields.changePercent);

  if (!proposed) return false;

  if (current && Math.abs(proposed - current) >= 0.01) {
    return true;
  }

  if (percentChange !== null && Math.abs(percentChange) >= 0.001) {
    return true;
  }

  return false;
}

function isNeedsMatchProposal(item) {
  const fields = item.fields || {};
  const reason = fieldText(fields.proposalReason).toLowerCase();
  const notes = fieldText(fields.notes).toLowerCase();
  const status = getStatus(item).trim();
  const proposed = fieldNumber(fields.proposedCost);

  if (status !== "Needs Review") return false;
  if (isMatched(item)) return false;
  if (!proposed) return false;

  return (
    reason.includes("needs match") ||
    reason.includes("not matched") ||
    reason.includes("match this line") ||
    reason.includes("before tracking") ||
    notes.includes("needs match") ||
    notes.includes("not matched") ||
    notes.includes("match this line") ||
    notes.includes("before tracking")
  );
}

function isActionableReviewProposal(item) {
  const fields = item.fields || {};
  const status = getStatus(item).trim();

  if (status !== "Needs Review") return false;
  if (isFinalizedStatus(status)) return false;
  if (isHiddenOrCurrentProposal(item)) return false;
  if (isTruthyField(fields.approved)) return false;
  if (isTruthyField(fields.applied)) return false;

  if (isMatched(item)) {
    return hasMeaningfulCostChange(item);
  }

  return isNeedsMatchProposal(item);
}

function isBlocked(item) {
  return isActionableReviewProposal(item) && !isMatched(item);
}

function isMatchedReview(item) {
  return isActionableReviewProposal(item) && isMatched(item);
}

function getReason(item) {
  const reason = fieldText(item.fields?.proposalReason);
  if (reason) return reason;

  return "This approved receipt line is ready for cost signal review, but it needs to be linked to an Inventory Item or Cost Source Item before KitchenPulse can track movement.";
}

function getSetupType(item) {
  const name = getItemName(item).toLowerCase();

  if (
    name.includes("salmon") ||
    name.includes("shrimp") ||
    name.includes("ribeye") ||
    name.includes("chicken") ||
    name.includes("wing") ||
    name.includes("cheese") ||
    name.includes("cream") ||
    name.includes("potato") ||
    name.includes("fries") ||
    name.includes("romaine") ||
    name.includes("dressing")
  ) {
    return "Likely cost item";
  }

  return "Needs review";
}

function getRecommendedNextStep(item) {
  const name = getItemName(item);

  return `Create or choose the matching Inventory Item / Cost Source Item for ${name}, then return to Receipt Intake and link the signal.`;
}

function toneStyles(tone = "neutral") {
  if (tone === "link" || tone === "setup") {
    return {
      color: "#D97706",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.16)",
      glow: "rgba(245,158,11,0.045)",
    };
  }

  if (tone === "matched" || tone === "review") {
    return {
      color: "#2563EB",
      bg: "rgba(59,130,246,0.08)",
      border: "rgba(59,130,246,0.14)",
      glow: "rgba(59,130,246,0.045)",
    };
  }

  if (tone === "success") {
    return {
      color: "#0F766E",
      bg: "rgba(20,184,166,0.07)",
      border: "rgba(20,184,166,0.13)",
      glow: "rgba(20,184,166,0.04)",
    };
  }

  if (tone === "danger" || tone === "error") {
    return {
      color: "#B91C1C",
      bg: "rgba(254,242,242,0.88)",
      border: "rgba(254,202,202,0.90)",
      glow: "rgba(239,68,68,0.055)",
    };
  }

  if (tone === "hidden" || tone === "cleanup") {
    return {
      color: "#64748B",
      bg: "rgba(100,116,139,0.07)",
      border: "rgba(100,116,139,0.12)",
      glow: "rgba(100,116,139,0.035)",
    };
  }

  return {
    color: "#0891B2",
    bg: "rgba(34,211,238,0.08)",
    border: "rgba(34,211,238,0.14)",
    glow: "rgba(34,211,238,0.045)",
  };
}

function StatusPill({ children, tone = "neutral", icon: Icon }) {
  const styles = toneStyles(tone);

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
      style={{
        color: styles.color,
        background: styles.bg,
        borderColor: styles.border,
      }}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}

function Notice({ tone = "neutral", icon: Icon, children }) {
  const styles = toneStyles(tone);

  return (
    <div
      className="rounded-2xl border px-4 py-3 text-sm font-semibold"
      style={{
        color: styles.color,
        background: styles.bg,
        borderColor: styles.border,
      }}
    >
      <div className="flex items-start gap-2">
        {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0" /> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

function ActionButton({ children, onClick, disabled, tone = "soft", icon: Icon }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60";

  const className =
    tone === "danger"
      ? `${base} bg-red-600 text-white hover:bg-red-700`
      : tone === "primary"
        ? `${base} bg-slate-900 text-white hover:bg-slate-800`
        : `${base} border bg-white/80 text-slate-700 hover:bg-slate-50`;

  const style =
    tone === "soft"
      ? { borderColor: "rgba(15,23,42,0.10)" }
      : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={style}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

function CostMiniGrid({ fields, changeTone = "neutral" }) {
  const styles = toneStyles(changeTone);

  return (
    <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-200/70 pt-3 text-sm">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Current
        </div>
        <div className="mt-1 font-semibold text-foreground">
          {money(fields.currentCost)}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Receipt
        </div>
        <div className="mt-1 font-semibold text-foreground">
          {money(fields.proposedCost)}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Change
        </div>
        <div className="mt-1 font-semibold" style={{ color: styles.color }}>
          {percent(fields.changePercent)}
        </div>
      </div>
    </div>
  );
}

function SetupCard({ item, isBusy, onReject }) {
  const fields = item.fields || {};
  const itemName = getItemName(item);
  const vendor = getVendor(item);
  const setupType = getSetupType(item);
  const styles = toneStyles("link");

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
        style={{ background: styles.color }}
      />

      <div
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
        style={{ background: styles.glow }}
      />

      <div className="relative z-10 mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold leading-tight text-foreground">
            {itemName}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{vendor}</div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusPill tone="link" icon={Link2}>
            Needs link
          </StatusPill>

          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
              borderColor: "rgba(15,23,42,0.08)",
            }}
          >
            {setupType}
          </span>
        </div>
      </div>

      <p className="relative z-10 text-sm leading-relaxed text-muted-foreground">
        {getReason(item)}
      </p>

      <div
        className="relative z-10 mt-3 rounded-2xl border p-3 text-sm leading-relaxed"
        style={{
          color: "#92400E",
          background: "rgba(245,158,11,0.08)",
          borderColor: "rgba(245,158,11,0.16)",
        }}
      >
        <span className="font-semibold">Next step:</span>{" "}
        {getRecommendedNextStep(item)}
      </div>

      <CostMiniGrid fields={fields} changeTone="link" />

      <div className="relative z-10 mt-4">
        <ActionButton
          tone="danger"
          icon={Trash2}
          onClick={() => onReject(item)}
          disabled={isBusy}
        >
          {isBusy ? "Rejecting signal..." : "Reject setup signal"}
        </ActionButton>
      </div>
    </div>
  );
}

function ReviewCard({ item }) {
  const fields = item.fields || {};
  const itemName = getItemName(item);
  const vendor = getVendor(item);
  const styles = toneStyles("matched");

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
        style={{ background: styles.color }}
      />

      <div
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
        style={{ background: styles.glow }}
      />

      <div className="relative z-10 mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold leading-tight text-foreground">
            {itemName}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{vendor}</div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusPill tone="matched" icon={ShieldAlert}>
            Matched review
          </StatusPill>

          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
              borderColor: "rgba(15,23,42,0.08)",
            }}
          >
            Ready to approve
          </span>
        </div>
      </div>

      <p className="relative z-10 text-sm leading-relaxed text-muted-foreground">
        {getReason(item)}
      </p>

      <div
        className="relative z-10 mt-3 rounded-2xl border p-3 text-sm leading-relaxed"
        style={{
          color: "#1D4ED8",
          background: "rgba(59,130,246,0.08)",
          borderColor: "rgba(59,130,246,0.14)",
        }}
      >
        <span className="font-semibold">Next step:</span>{" "}
        Review this matched cost signal in Receipt Intake. If the match and cost look right, approve the signal so it can become Cost Movement.
      </div>

      <CostMiniGrid fields={fields} changeTone="matched" />
    </div>
  );
}

function HiddenDuplicateCard({ item, isBusy, onReject }) {
  const fields = item.fields || {};
  const itemName = getItemName(item);
  const vendor = getVendor(item);
  const styles = toneStyles("hidden");

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:shadow-md"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
        borderColor: "rgba(15,23,42,0.08)",
        boxShadow:
          "0 10px 24px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.84)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1"
        style={{ background: styles.color }}
      />

      <div
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
        style={{ background: styles.glow }}
      />

      <div className="relative z-10 mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold leading-tight text-slate-900">
            {itemName}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{vendor}</div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusPill tone="hidden" icon={EyeOff}>
            Hidden duplicate
          </StatusPill>

          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
              borderColor: "rgba(15,23,42,0.08)",
            }}
          >
            Cleanup
          </span>
        </div>
      </div>

      <p className="relative z-10 text-sm leading-relaxed text-muted-foreground">
        This is an older duplicate signal that KitchenPulse hid from the owner-facing review queue because a newer/current signal already exists.
      </p>

      <div
        className="relative z-10 mt-3 rounded-2xl border p-3 text-sm leading-relaxed text-slate-700"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
          borderColor: "rgba(15,23,42,0.08)",
        }}
      >
        <span className="font-semibold">Cleanup action:</span>{" "}
        Reject this duplicate to remove it from stale/hidden counts. This does not delete receipt history.
      </div>

      <CostMiniGrid fields={fields} changeTone="hidden" />

      <div className="relative z-10 mt-4">
        <ActionButton
          tone="danger"
          icon={Trash2}
          onClick={() => onReject(item)}
          disabled={isBusy}
        >
          {isBusy ? "Rejecting duplicate..." : "Reject duplicate"}
        </ActionButton>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, subtext, icon: Icon, tone = "neutral" }) {
  const styles = toneStyles(tone);

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
        style={{ background: styles.border }}
      />

      <div
        className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl"
        style={{ background: styles.glow }}
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </div>

          <div
            className="mt-1 text-2xl font-semibold tracking-tight"
            style={{ color: styles.color }}
          >
            {value}
          </div>
        </div>

        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border shadow-sm"
          style={{
            color: styles.color,
            background: styles.bg,
            borderColor: styles.border,
          }}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <div className="relative z-10 mt-2 text-xs leading-relaxed text-muted-foreground">
        {subtext}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-3xl border border-dashed p-6 text-center shadow-sm"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.72))",
        borderColor: "rgba(15,23,42,0.12)",
      }}
    >
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border text-muted-foreground"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))",
          borderColor: "rgba(15,23,42,0.08)",
        }}
      >
        <PackageSearch className="h-5 w-5" />
      </div>

      <div className="mt-3 text-base font-semibold text-foreground">
        No cost links need setup
      </div>

      <div className="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
        Receipt cost signals that need matching will appear here. When this is empty,
        approved receipt lines are either matched, already tracked, rejected, or current.
      </div>
    </div>
  );
}

function SectionGroup({ label, tone, children }) {
  const styles = toneStyles(tone);

  return (
    <div>
      <div
        className="mb-3 text-xs font-semibold uppercase tracking-[0.16em]"
        style={{ color: styles.color }}
      >
        {label}
      </div>

      <div className="grid gap-3 xl:grid-cols-2">{children}</div>
    </div>
  );
}

export default function Block() {
  const [search, setSearch] = useState("");
  const [busyDuplicateId, setBusyDuplicateId] = useState("");
  const [cleanedDuplicateIds, setCleanedDuplicateIds] = useState([]);
  const [cleanupMessage, setCleanupMessage] = useState("");
  const [cleanupError, setCleanupError] = useState("");

  const { data, status } = useRecords({
    select,
    orderBy: [q.desc("proposedCost")],
    count: 250,
  });

  const records = data?.pages.flatMap((page) => page.items) || [];

  const visibleRecords = useMemo(() => {
    return records.filter((item) => !cleanedDuplicateIds.includes(item.id));
  }, [records, cleanedDuplicateIds]);

  async function rejectHiddenDuplicate(item) {
    setBusyDuplicateId(item.id);
    setCleanupMessage("");
    setCleanupError("");

    try {
      const response = await fetch(RECEIPT_COST_PROPOSALS_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          recordId: item.id,
          action: "reject",
          reviewerNote:
            "Rejected from Cost Center setup cleanup. This signal should not become active Cost Movement.",
        }),
      });

      const text = await response.text();

      let data = null;

      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("Reject duplicate returned non-JSON:", text);
        throw new Error("Cost signal cleanup returned a non-JSON response.");
      }

      if (!response.ok || !data?.ok) {
        console.error("Reject duplicate failed:", data);
        throw new Error(data?.error || "Could not reject this duplicate signal.");
      }

      setCleanedDuplicateIds((current) => [...new Set([...current, item.id])]);
      setCleanupMessage(`${getItemName(item)} signal rejected.`);
      window.dispatchEvent(new Event("kitchenpulse:cost-signals-updated"));
    } catch (requestError) {
      console.error("Reject setup signal failed:", requestError);
      setCleanupError(
        requestError?.message ||
          "Could not reject this setup signal. Check the cost proposal API."
      );
    } finally {
      setBusyDuplicateId("");
    }
  }

  const blockedRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return visibleRecords
      .filter((item) => isBlocked(item))
      .filter((item) => {
        if (!query) return true;

        return (
          getItemName(item).toLowerCase().includes(query) ||
          getVendor(item).toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const aCost = fieldNumber(a.fields?.proposedCost);
        const bCost = fieldNumber(b.fields?.proposedCost);

        if (bCost !== aCost) return bCost - aCost;

        return getItemName(a).localeCompare(getItemName(b));
      });
  }, [visibleRecords, search]);

  const matchedReviewRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return visibleRecords
      .filter((item) => isMatchedReview(item))
      .filter((item) => {
        if (!query) return true;

        return (
          getItemName(item).toLowerCase().includes(query) ||
          getVendor(item).toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const aCost = fieldNumber(a.fields?.proposedCost);
        const bCost = fieldNumber(b.fields?.proposedCost);

        if (bCost !== aCost) return bCost - aCost;

        return getItemName(a).localeCompare(getItemName(b));
      });
  }, [visibleRecords, search]);

  const hiddenDuplicateRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return visibleRecords
      .filter((item) => isHiddenDuplicateProposal(item))
      .filter((item) => {
        if (!query) return true;

        return (
          getItemName(item).toLowerCase().includes(query) ||
          getVendor(item).toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const aCost = fieldNumber(a.fields?.proposedCost);
        const bCost = fieldNumber(b.fields?.proposedCost);

        if (bCost !== aCost) return bCost - aCost;

        return getItemName(a).localeCompare(getItemName(b));
      });
  }, [visibleRecords, search]);

  const counts = useMemo(() => {
    const actionableRecords = visibleRecords.filter((item) =>
      isActionableReviewProposal(item)
    );

    const needsLink = actionableRecords.filter((item) =>
      isBlocked(item)
    ).length;

    const matchedReview = actionableRecords.filter((item) =>
      isMatchedReview(item)
    ).length;

    const totalReview = actionableRecords.length;

    const hiddenDuplicates = visibleRecords.filter((item) =>
      isHiddenDuplicateProposal(item)
    ).length;

    return {
      needsLink,
      matchedReview,
      totalReview,
      hiddenDuplicates,
    };
  }, [visibleRecords]);

  const ownerRead = useMemo(() => {
    if (counts.needsLink === 0 && counts.matchedReview > 0) {
      return `${counts.matchedReview} matched cost signal${
        counts.matchedReview === 1 ? " is" : "s are"
      } ready for approval. Review ${
        counts.matchedReview === 1 ? "it" : "these"
      } in Receipt Intake to turn ${
        counts.matchedReview === 1 ? "it" : "them"
      } into active Cost Movement.`;
    }

    if (counts.needsLink === 0) {
      return "No setup blockers are currently preventing receipt cost signals from becoming Cost Movement intelligence.";
    }

    const first = visibleRecords.find((item) => isBlocked(item));

    return `${getItemName(first)} needs a KitchenPulse cost link before it can be tracked. Start there if you want more receipt lines flowing into Cost Movement.`;
  }, [visibleRecords, counts.needsLink, counts.matchedReview]);

  if (status === "pending") {
    return (
      <div className="container py-4">
        <div
          className="content mx-auto max-w-6xl rounded-3xl border p-5 text-sm text-muted-foreground shadow-sm"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.97), rgba(248,250,252,0.82))",
            borderColor: "rgba(15,23,42,0.08)",
          }}
        >
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-cyan-700" />
            Loading Cost Links...
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="container py-4">
        <div className="content mx-auto max-w-6xl rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>
              Cost Links could not load from Receipt Cost Proposals. Check that
              Softr has access to the Receipt Cost Proposals table and that the
              field names match this Vibe block.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="content mx-auto max-w-6xl space-y-5">
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
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
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
                  Setup Watch
                </div>

                <h2 className="text-2xl font-heading font-semibold tracking-tight">
                  Cost Links Needing Setup
                </h2>

                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  Approved receipt lines can only become Cost Movement signals once
                  they are matched to a KitchenPulse Inventory Item or Cost Source
                  Item. This section shows what still needs linking.
                </p>
              </div>

              <div
                className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-sm"
                style={{
                  color: "#334155",
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
                  borderColor: "rgba(15,23,42,0.08)",
                }}
              >
                <CircleDollarSign className="h-3.5 w-3.5 text-cyan-700" />
                Receipt Cost Proposals source
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <SummaryCard
                label="Needs links"
                value={counts.needsLink}
                subtext="Signals blocked until a KitchenPulse item is matched."
                icon={Link2}
                tone="link"
              />

              <SummaryCard
                label="Matched review"
                value={counts.matchedReview}
                subtext="Needs Review signals that already have an item match."
                icon={ShieldAlert}
                tone="matched"
              />

              <SummaryCard
                label="Review pool"
                value={counts.totalReview}
                subtext="Actionable cost signals still awaiting setup or approval."
                icon={ClipboardList}
                tone="neutral"
              />

              <SummaryCard
                label="Hidden duplicates"
                value={counts.hiddenDuplicates}
                subtext="Older duplicate signals hidden from normal review."
                icon={EyeOff}
                tone="hidden"
              />
            </div>

            <div
              className="mt-4 rounded-2xl border p-4 text-sm leading-relaxed text-muted-foreground shadow-sm"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.76))",
                borderColor: "rgba(15,23,42,0.08)",
                boxShadow:
                  "0 10px 24px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.84)",
              }}
            >
              <span className="font-semibold text-foreground">Owner read:</span>{" "}
              {ownerRead}
            </div>
          </div>
        </section>

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
            style={{ background: "rgba(34,211,238,0.14)" }}
          />

          <div
            className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full blur-3xl"
            style={{ background: "rgba(34,211,238,0.045)" }}
          />

          <div className="relative z-10 mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-2xl border shadow-sm"
                  style={{
                    color: "#D97706",
                    background: "rgba(245,158,11,0.08)",
                    borderColor: "rgba(245,158,11,0.16)",
                  }}
                >
                  <Wrench className="h-4 w-4" />
                </span>

                <h3 className="text-xl font-heading font-semibold tracking-tight">
                  Cost Signals Awaiting Review
                </h3>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Matched receipt cost signals that need approval, plus any vendor lines still missing a KitchenPulse cost link.
              </p>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search item or vendor"
                className="h-10 w-full rounded-full border bg-white/80 pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-cyan-200 sm:w-72"
                style={{ borderColor: "rgba(15,23,42,0.10)" }}
              />
            </div>
          </div>

          {cleanupMessage && (
            <div className="relative z-10 mb-4">
              <Notice tone="success" icon={CheckCircle2}>
                {cleanupMessage}
              </Notice>
            </div>
          )}

          {cleanupError && (
            <div className="relative z-10 mb-4">
              <Notice tone="error" icon={AlertTriangle}>
                {cleanupError}
              </Notice>
            </div>
          )}

          {blockedRecords.length === 0 &&
          matchedReviewRecords.length === 0 &&
          hiddenDuplicateRecords.length === 0 ? (
            <div className="relative z-10">
              <EmptyState />
            </div>
          ) : (
            <div className="relative z-10 space-y-5">
              {blockedRecords.length > 0 && (
                <SectionGroup label="Needs link before review" tone="link">
                  {blockedRecords.map((item) => (
                    <SetupCard
                      key={item.id}
                      item={item}
                      isBusy={busyDuplicateId === item.id}
                      onReject={rejectHiddenDuplicate}
                    />
                  ))}
                </SectionGroup>
              )}

              {matchedReviewRecords.length > 0 && (
                <SectionGroup label="Matched and ready for review" tone="matched">
                  {matchedReviewRecords.map((item) => (
                    <ReviewCard key={item.id} item={item} />
                  ))}
                </SectionGroup>
              )}

              {hiddenDuplicateRecords.length > 0 && (
                <div>
                  <div
                    className="mb-3 text-xs font-semibold uppercase tracking-[0.16em]"
                    style={{ color: "#64748B" }}
                  >
                    Hidden duplicate signals
                  </div>

                  <div
                    className="mb-3 rounded-2xl border px-4 py-3 text-sm leading-6 text-slate-600"
                    style={{
                      background:
                        "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
                      borderColor: "rgba(15,23,42,0.08)",
                    }}
                  >
                    These are older duplicate cost signals hidden from normal owner-facing review because a newer/current signal already exists. Reject them here to clear the stale count.
                  </div>

                  <div className="grid gap-3 xl:grid-cols-2">
                    {hiddenDuplicateRecords.map((item) => (
                      <HiddenDuplicateCard
                        key={item.id}
                        item={item}
                        isBusy={busyDuplicateId === item.id}
                        onReject={rejectHiddenDuplicate}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
