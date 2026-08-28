import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  Edit3,
  FileText,
  Loader2,
  Package,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

const RECEIPT_LINES_API =
  "https://project-1csz2.vercel.app/api/receipt-lines";

const COST_PROPOSALS_API =
  "https://project-1csz2.vercel.app/api/receipt-cost-proposals";

const CATEGORY_OPTIONS = [
  "",
  "Produce",
  "Meat",
  "Seafood",
  "Dairy",
  "Dry Goods",
  "Liquor",
  "Beer",
  "Wine",
  "NA Beverage",
  "Supplies",
  "Other",
];

function toneStyles(tone = "neutral") {
  if (tone === "pending") {
    return {
      color: "#0891B2",
      bg: "rgba(34,211,238,0.08)",
      border: "rgba(34,211,238,0.14)",
      glow: "rgba(34,211,238,0.045)",
    };
  }

  if (tone === "review") {
    return {
      color: "#D97706",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.16)",
      glow: "rgba(245,158,11,0.045)",
    };
  }

  if (tone === "approved") {
    return {
      color: "#0F766E",
      bg: "rgba(20,184,166,0.07)",
      border: "rgba(20,184,166,0.13)",
      glow: "rgba(20,184,166,0.04)",
    };
  }

  if (tone === "parsed") {
    return {
      color: "#2563EB",
      bg: "rgba(59,130,246,0.08)",
      border: "rgba(59,130,246,0.14)",
      glow: "rgba(59,130,246,0.045)",
    };
  }

  if (tone === "error") {
    return {
      color: "#B91C1C",
      bg: "rgba(254,242,242,0.88)",
      border: "rgba(254,202,202,0.90)",
      glow: "rgba(239,68,68,0.055)",
    };
  }

  return {
    color: "#64748B",
    bg: "rgba(100,116,139,0.07)",
    border: "rgba(100,116,139,0.12)",
    glow: "rgba(100,116,139,0.035)",
  };
}

function StatusPill({ children, tone = "neutral", icon: Icon }) {
  const styles = toneStyles(tone);

  return (
    <Badge
      className="inline-flex items-center gap-1 border text-[11px] font-semibold hover:bg-transparent"
      style={{
        color: styles.color,
        background: styles.bg,
        borderColor: styles.border,
      }}
    >
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </Badge>
  );
}

function CountCard({ label, value, tone = "neutral" }) {
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

      <div className="relative z-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>

      <div
        className="relative z-10 mt-1 text-2xl font-semibold"
        style={{ color: styles.color }}
      >
        {value}
      </div>
    </div>
  );
}

function Notice({ tone = "neutral", icon: Icon, children }) {
  const styles = toneStyles(tone);

  return (
    <div
      className="flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm"
      style={{
        color: styles.color,
        background: styles.bg,
        borderColor: styles.border,
      }}
    >
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0" /> : null}
      <div>{children}</div>
    </div>
  );
}

function ActionButton({ children, onClick, disabled, tone = "soft", icon: Icon }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60";

  const className =
    tone === "save"
      ? `${base} bg-slate-900 text-white hover:bg-slate-800`
      : tone === "approve"
        ? `${base} bg-teal-700 text-white hover:bg-teal-800`
        : tone === "danger"
          ? `${base} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`
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

export default function Block() {
  const [lines, setLines] = useState([]);
  const [counts, setCounts] = useState({
    total: 0,
    approved: 0,
    needsReview: 0,
    pending: 0,
  });
  const [selectedReceiptId, setSelectedReceiptId] = useState("all");
  const [lineStatusFilter, setLineStatusFilter] = useState("active");
  const [draftsById, setDraftsById] = useState({});
  const [editingId, setEditingId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [confirmRemoveLine, setConfirmRemoveLine] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function money(value) {
    if (value === null || typeof value === "undefined" || value === "") {
      return "—";
    }

    const numberValue = Number(value);

    if (Number.isNaN(numberValue)) return "—";

    return numberValue.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  }

  function numberText(value) {
    if (value === null || typeof value === "undefined" || value === "") {
      return "";
    }

    return String(value);
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function getStatusLabel(line) {
    if (line.approved) return "Approved";
    if (line.needsReview) return "Needs review";
    return "Pending approval";
  }

  function getStatusTone(line) {
    if (line.approved) return "approved";
    if (line.needsReview) return "review";
    return "pending";
  }

  function getConfidenceTone(confidence) {
    const value = String(confidence || "").toLowerCase();

    if (value.includes("high")) return "approved";
    if (value.includes("low")) return "error";
    if (value.includes("medium")) return "review";

    return "neutral";
  }

  function buildDraft(line) {
    return {
      lineItemName: line.lineItemName || "",
      category: line.category || "",
      quantity: numberText(line.quantity),
      unit: line.unit || "",
      packageSize: line.packageSize || "",
      unitCost: numberText(line.unitCost),
      lineTotal: numberText(line.lineTotal),
      rawLineText: line.rawLineText || "",
      notes: line.notes || "",
    };
  }

  function updateDraft(lineId, key, value) {
    setDraftsById((current) => ({
      ...current,
      [lineId]: {
        ...(current[lineId] || {}),
        [key]: value,
      },
    }));
  }

  function beginEdit(line) {
    setEditingId(line.id);
    setDraftsById((current) => ({
      ...current,
      [line.id]: current[line.id] || buildDraft(line),
    }));
    setMessage("");
    setError("");
  }

  function cancelEdit() {
    setEditingId("");
  }

  async function loadLines({ quiet = false } = {}) {
    if (quiet) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError("");

    if (!quiet) {
      setMessage("");
    }

    try {
      const response = await fetch(RECEIPT_LINES_API, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      const text = await response.text();

      let data = null;

      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("Receipt lines returned non-JSON:", text);
        throw new Error("Receipt lines returned a non-JSON response..");
      }

      if (!response.ok || !data?.ok) {
        console.error("Receipt lines API error:", data);
        throw new Error(data?.error || "Could not load parsed receipt lines.");
      }

      const nextLines = Array.isArray(data.lines) ? data.lines : [];

      setLines(nextLines);
      setCounts(
        data.counts || {
          total: nextLines.length,
          approved: 0,
          needsReview: 0,
          pending: 0,
        }
      );

      setDraftsById((current) => {
        const nextDrafts = { ...current };

        for (const line of nextLines) {
          if (!nextDrafts[line.id]) {
            nextDrafts[line.id] = buildDraft(line);
          }
        }

        return nextDrafts;
      });
    } catch (requestError) {
      console.error("Receipt lines request failed:", requestError);
      setLines([]);
      setError(
        requestError?.message ||
          "Parsed receipt lines could not be loaded. Refresh this section or check Airtable."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  async function generatePricingUpdatesAfterApproval() {
    async function runGenerateAttempt() {
      const response = await fetch(COST_PROPOSALS_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "generate",
          force: true,
        }),
      });

      const text = await response.text();

      let data = null;

      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("Auto-generate proposals returned non-JSON:", text);
        throw new Error("Pricing update check returned a non-JSON response.");
      }

      if (!response.ok || !data?.ok) {
        console.error("Auto-generate proposals failed:", data);
        throw new Error(data?.error || "Could not auto-generate pricing updates.");
      }

      return data;
    }

    try {
      let data = await runGenerateAttempt();

      const createdCount = Number(data.createdCount || 0);
      const refreshedCount = Number(data.refreshedCount || 0);

      if (createdCount === 0 && refreshedCount === 0) {
        await wait(1800);
        data = await runGenerateAttempt();
      }

      window.dispatchEvent(
        new CustomEvent("kitchenpulse:receipt-cost-proposals-updated")
      );

      return data;
    } catch (requestError) {
      console.error("Auto pricing update generation failed:", requestError);

      setMessage(
        "Line approved. Pricing updates may need a manual refresh below."
      );

      return null;
    }
  }

  async function submitLineAction(line, action) {
    setBusyId(line.id);
    setError("");
    setMessage("");

    const draft = draftsById[line.id] || buildDraft(line);

    const payload =
      action === "update_line"
        ? {
            recordId: line.id,
            action,
            line: draft,
          }
        : {
            recordId: line.id,
            action,
            notes: draft.notes || "",
          };

    try {
      const response = await fetch(RECEIPT_LINES_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();

      let data = null;

      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("Receipt line action returned non-JSON:", text);
        throw new Error("Receipt line action returned a non-JSON response.");
      }

      if (!response.ok || !data?.ok) {
        console.error("Receipt line action failed:", data);
        throw new Error(data?.error || "Could not update this parsed line.");
      }

      setEditingId("");

      if (action === "approve_line") {
        await wait(1200);
        const proposalResult = await generatePricingUpdatesAfterApproval();

        setMessage(
          proposalResult?.message ||
            data.message ||
            "Parsed line approved. Pricing update review has been refreshed."
        );
      } else {
        setMessage(data.message || "Parsed line updated.");
      }

      await loadLines({ quiet: true });
    } catch (requestError) {
      console.error("Receipt line update failed:", requestError);
      setError(
        requestError?.message ||
          "Could not update this parsed line. Try again or check Airtable."
      );
    } finally {
      setBusyId("");
    }
  }

  const receiptOptions = useMemo(() => {
    const map = new Map();

    for (const line of lines) {
      const receiptId = line.receiptId || "unknown";
      const vendor = line.vendor || "Unknown vendor";
      const label = `${vendor} — ${receiptId.slice(0, 8)}`;

      if (!map.has(receiptId)) {
        map.set(receiptId, {
          id: receiptId,
          label,
          count: 0,
        });
      }

      map.get(receiptId).count += 1;
    }

    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [lines]);

  const visibleLines = useMemo(() => {
    let next = lines;

    if (selectedReceiptId !== "all") {
      next = next.filter((line) => line.receiptId === selectedReceiptId);
    }

    if (lineStatusFilter === "active") {
      next = next.filter((line) => !line.approved);
    } else if (lineStatusFilter === "approved") {
      next = next.filter((line) => line.approved);
    } else if (lineStatusFilter === "needsReview") {
      next = next.filter((line) => line.needsReview && !line.approved);
    } else if (lineStatusFilter === "pending") {
      next = next.filter((line) => !line.needsReview && !line.approved);
    }

    return next;
  }, [lines, selectedReceiptId, lineStatusFilter]);

  useEffect(() => {
    loadLines();

    const handleReceiptLinesUpdated = () => {
      loadLines({ quiet: true });
    };

    const handleFocus = () => {
      loadLines({ quiet: true });
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadLines({ quiet: true });
      }
    };

    window.addEventListener(
      "kitchenpulse:receipt-lines-updated",
      handleReceiptLinesUpdated
    );
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener(
        "kitchenpulse:receipt-lines-updated",
        handleReceiptLinesUpdated
      );
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="container py-4">
          {confirmRemoveLine && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
          style={{ background: "rgba(15,23,42,0.42)" }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl border p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kp-remove-line-title"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(248,250,252,0.94))",
              borderColor: "rgba(15,23,42,0.10)",
              boxShadow:
                "0 24px 70px rgba(15,23,42,0.22), inset 0 1px 0 rgba(255,255,255,0.86)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                style={{
                  color: "#B91C1C",
                  background: "rgba(254,242,242,0.92)",
                  border: "1px solid rgba(254,202,202,0.92)",
                }}
              >
                <Trash2 className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <div
                  id="kp-remove-line-title"
                  className="text-base font-semibold text-slate-900"
                >
                  Remove parsed line?
                </div>

                <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  This only removes the staging line from KitchenPulse and will not affect approved pricing.
                </div>

                {confirmRemoveLine.lineItemName && (
                  <div
                    className="mt-3 rounded-2xl border px-3 py-2 text-sm font-medium text-slate-700"
                    style={{
                      background: "rgba(255,255,255,0.76)",
                      borderColor: "rgba(15,23,42,0.08)",
                    }}
                  >
                    {confirmRemoveLine.lineItemName}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmRemoveLine(null)}
                disabled={Boolean(busyId)}
                className="inline-flex items-center justify-center rounded-full border bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ borderColor: "rgba(15,23,42,0.10)" }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  const lineToRemove = confirmRemoveLine;
                  setConfirmRemoveLine(null);
                  submitLineAction(lineToRemove, "remove_line");
                }}
                disabled={Boolean(busyId)}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                Remove line
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="content mx-auto max-w-5xl">
        <section
          className="relative overflow-hidden rounded-3xl border p-5 shadow-xl md:p-6"
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
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
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
                    Parsed Lines
                  </div>

                  <StatusPill tone="parsed" icon={ClipboardCheck}>
                    Parsed lines
                  </StatusPill>

                  <StatusPill tone="approved" icon={ShieldCheck}>
                    Human approval required
                  </StatusPill>
                </div>

                <h2 className="text-2xl font-heading font-semibold tracking-tight">
                  Parsed Line Review
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Review AI-extracted receipt lines before they can be used for cost tracking or margin analysis.
                </p>
              </div>

              <button
                type="button"
                onClick={() => loadLines({ quiet: true })}
                disabled={isLoading || isRefreshing || Boolean(busyId)}
                className="inline-flex items-center justify-center gap-2 rounded-full border bg-white/80 px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ borderColor: "rgba(15,23,42,0.10)" }}
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    isLoading || isRefreshing ? "animate-spin" : ""
                  }`}
                />
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-4">
              <CountCard label="Parsed lines" value={counts.total} tone="neutral" />
              <CountCard label="Pending" value={counts.pending} tone="pending" />
              <CountCard label="Needs review" value={counts.needsReview} tone="review" />
              <CountCard label="Approved" value={counts.approved} tone="approved" />
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-2">
              <div
                className="rounded-2xl border p-4 shadow-sm"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))",
                  borderColor: "rgba(15,23,42,0.08)",
                }}
              >
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Review queue
                </label>

                <select
                  value={lineStatusFilter}
                  onChange={(event) => setLineStatusFilter(event.target.value)}
                  className="mt-2 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
                >
                  <option value="active">Needs action</option>
                  <option value="needsReview">Needs review only</option>
                  <option value="pending">Pending only</option>
                  <option value="approved">Approved lines</option>
                  <option value="all">All parsed lines</option>
                </select>

                <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Approved lines are hidden from the active review queue but can be reopened here.
                </div>
              </div>

              <div
                className="rounded-2xl border p-4 shadow-sm"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))",
                  borderColor: "rgba(15,23,42,0.08)",
                }}
              >
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Filter by receipt
                </label>

                <select
                  value={selectedReceiptId}
                  onChange={(event) => setSelectedReceiptId(event.target.value)}
                  className="mt-2 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
                >
                  <option value="all">All parsed receipts</option>
                  {receiptOptions.map((receipt) => (
                    <option key={receipt.id} value={receipt.id}>
                      {receipt.label} ({receipt.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {message && (
              <div className="mb-4">
                <Notice tone="approved" icon={CheckCircle2}>
                  {message}
                </Notice>
              </div>
            )}

            {error && (
              <div className="mb-4">
                <Notice tone="error" icon={AlertCircle}>
                  {error}
                </Notice>
              </div>
            )}

            {isLoading ? (
              <div
                className="rounded-3xl border border-dashed p-6 text-center shadow-sm md:p-8"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.72))",
                  borderColor: "rgba(15,23,42,0.12)",
                }}
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-md">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>

                <div className="mt-4 text-lg font-semibold">
                  Loading parsed lines
                </div>

                <div className="mt-2 text-sm text-muted-foreground">
                  Checking AI-extracted receipt lines now.
                </div>
              </div>
            ) : visibleLines.length === 0 ? (
              <div
                className="rounded-3xl border border-dashed p-6 text-center shadow-sm md:p-8"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.72))",
                  borderColor: "rgba(15,23,42,0.12)",
                }}
              >
                <div
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-white shadow-md"
                  style={{
                    background:
                      "linear-gradient(135deg, #2563EB 0%, #0891B2 100%)",
                    boxShadow: "0 14px 28px rgba(37,99,235,0.18)",
                  }}
                >
                  <ClipboardCheck className="h-7 w-7" />
                </div>

                <div className="mt-4 text-lg font-semibold">
                  No parsed lines ready yet
                </div>

                <div className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                  No parsed lines need action right now. Approved lines are hidden from this queue unless you choose Approved lines or All parsed lines above.
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {visibleLines.map((line) => {
                  const draft = draftsById[line.id] || buildDraft(line);
                  const isEditing = editingId === line.id;
                  const isBusy = busyId === line.id;
                  const statusLabel = getStatusLabel(line);
                  const statusTone = getStatusTone(line);
                  const statusStyle = toneStyles(statusTone);

                  return (
                    <div
                      key={line.id}
                      className="relative overflow-hidden rounded-3xl border p-5 shadow-sm"
                      style={{
                        background:
                          "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))",
                        borderColor: "rgba(15,23,42,0.08)",
                        boxShadow:
                          "0 10px 24px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.82)",
                      }}
                    >
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 w-1"
                        style={{ background: statusStyle.color }}
                      />

                      <div
                        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
                        style={{ background: statusStyle.glow }}
                      />

                      <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-base font-semibold">
                              {line.lineItemName || line.lineName || "Parsed line"}
                            </div>

                            <StatusPill tone={statusTone}>
                              {statusLabel}
                            </StatusPill>

                            {line.confidence && (
                              <StatusPill tone={getConfidenceTone(line.confidence)}>
                                {line.confidence} confidence
                              </StatusPill>
                            )}
                          </div>

                          <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-slate-500" />
                              <span>{line.vendor || "Vendor not entered"}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-slate-500" />
                              <span>
                                {line.category || "No category"} ·{" "}
                                {line.quantity ?? "—"} {line.unit || ""}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-teal-700" />
                              <span>
                                Unit {money(line.unitCost)} · Line{" "}
                                {money(line.lineTotal)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-cyan-700" />
                              <span>
                                Package: {line.packageSize || "Not parsed"}
                              </span>
                            </div>
                          </div>

                          {line.rawLineText && !isEditing && (
                            <div
                              className="mt-4 rounded-2xl border px-4 py-3 text-sm text-muted-foreground"
                              style={{
                                background:
                                  "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
                                borderColor: "rgba(15,23,42,0.08)",
                              }}
                            >
                              <div className="mb-1 text-xs font-semibold uppercase tracking-wide">
                                Raw line text
                              </div>
                              {line.rawLineText}
                            </div>
                          )}

                          {isEditing && (
                            <div
                              className="mt-5 grid gap-4 rounded-2xl border p-4"
                              style={{
                                background:
                                  "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
                                borderColor: "rgba(15,23,42,0.08)",
                              }}
                            >
                              <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Line item name
                                  </label>
                                  <input
                                    value={draft.lineItemName}
                                    onChange={(event) =>
                                      updateDraft(
                                        line.id,
                                        "lineItemName",
                                        event.target.value
                                      )
                                    }
                                    className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Category
                                  </label>
                                  <select
                                    value={draft.category}
                                    onChange={(event) =>
                                      updateDraft(
                                        line.id,
                                        "category",
                                        event.target.value
                                      )
                                    }
                                    className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
                                  >
                                    {CATEGORY_OPTIONS.map((category) => (
                                      <option key={category || "blank"} value={category}>
                                        {category || "Choose category"}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Quantity
                                  </label>
                                  <input
                                    value={draft.quantity}
                                    onChange={(event) =>
                                      updateDraft(
                                        line.id,
                                        "quantity",
                                        event.target.value
                                      )
                                    }
                                    inputMode="decimal"
                                    className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Unit
                                  </label>
                                  <input
                                    value={draft.unit}
                                    onChange={(event) =>
                                      updateDraft(line.id, "unit", event.target.value)
                                    }
                                    placeholder="case, lb, each, bottle..."
                                    className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Package size
                                  </label>
                                  <input
                                    value={draft.packageSize}
                                    onChange={(event) =>
                                      updateDraft(
                                        line.id,
                                        "packageSize",
                                        event.target.value
                                      )
                                    }
                                    placeholder="12 x 750ml, 10 lb case..."
                                    className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Unit cost
                                  </label>
                                  <input
                                    value={draft.unitCost}
                                    onChange={(event) =>
                                      updateDraft(
                                        line.id,
                                        "unitCost",
                                        event.target.value
                                      )
                                    }
                                    inputMode="decimal"
                                    className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Line total
                                  </label>
                                  <input
                                    value={draft.lineTotal}
                                    onChange={(event) =>
                                      updateDraft(
                                        line.id,
                                        "lineTotal",
                                        event.target.value
                                      )
                                    }
                                    inputMode="decimal"
                                    className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Notes
                                  </label>
                                  <input
                                    value={draft.notes}
                                    onChange={(event) =>
                                      updateDraft(line.id, "notes", event.target.value)
                                    }
                                    placeholder="Correction note optional"
                                    className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Raw line text
                                </label>
                                <textarea
                                  value={draft.rawLineText}
                                  onChange={(event) =>
                                    updateDraft(
                                      line.id,
                                      "rawLineText",
                                      event.target.value
                                    )
                                  }
                                  rows={3}
                                  className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col gap-2 md:min-w-[190px]">
                          {!isEditing ? (
                            <ActionButton
                              tone="soft"
                              icon={Edit3}
                              onClick={() => beginEdit(line)}
                              disabled={isBusy}
                            >
                              Edit line
                            </ActionButton>
                          ) : (
                            <>
                              <ActionButton
                                tone="save"
                                icon={Save}
                                onClick={() => submitLineAction(line, "update_line")}
                                disabled={isBusy}
                              >
                                {isBusy ? "Saving..." : "Save changes"}
                              </ActionButton>

                              <ActionButton
                                tone="soft"
                                onClick={cancelEdit}
                                disabled={isBusy}
                              >
                                Cancel
                              </ActionButton>
                            </>
                          )}

                          {!line.approved && (
                            <ActionButton
                              tone="approve"
                              icon={CheckCircle2}
                              onClick={() => submitLineAction(line, "approve_line")}
                              disabled={isBusy || isEditing}
                            >
                              {isBusy ? "Working..." : "Approve line"}
                            </ActionButton>
                          )}

                          {!line.needsReview && (
                            <ActionButton
                              tone="soft"
                              icon={RotateCcw}
                              onClick={() => submitLineAction(line, "needs_review")}
                              disabled={isBusy || isEditing}
                            >
                              Return to review
                            </ActionButton>
                          )}

                          <ActionButton
                            tone="danger"
                            icon={Trash2}
                            onClick={() => {
                              setMessage("");
                              setError("");
                              setConfirmRemoveLine(line);
                            }}
                            disabled={isBusy || isEditing}
                          >
                            Remove line
                          </ActionButton>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
