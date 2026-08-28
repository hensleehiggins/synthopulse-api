import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Link2,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

const COST_PROPOSALS_API =
  "https://project-1csz2.vercel.app/api/receipt-cost-proposals";

function toneStyles(tone = "neutral") {
  if (tone === "review" || tone === "pending") {
    return {
      color: "#D97706",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.16)",
      glow: "rgba(245,158,11,0.045)",
    };
  }

  if (tone === "approved" || tone === "ready") {
    return {
      color: "#0F766E",
      bg: "rgba(20,184,166,0.07)",
      border: "rgba(20,184,166,0.13)",
      glow: "rgba(20,184,166,0.04)",
    };
  }

  if (tone === "tracked" || tone === "applied") {
    return {
      color: "#2563EB",
      bg: "rgba(59,130,246,0.08)",
      border: "rgba(59,130,246,0.14)",
      glow: "rgba(59,130,246,0.045)",
    };
  }

  if (tone === "blocked" || tone === "rejected" || tone === "error") {
    return {
      color: "#B91C1C",
      bg: "rgba(254,242,242,0.88)",
      border: "rgba(254,202,202,0.90)",
      glow: "rgba(239,68,68,0.055)",
    };
  }

  if (tone === "current" || tone === "muted") {
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

function statusTone(status) {
  if (status === "Applied") return "tracked";
  if (status === "Approved") return "approved";
  if (status === "Rejected") return "rejected";
  return "review";
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
    tone === "primary"
      ? `${base} bg-slate-900 text-white hover:bg-slate-800`
      : tone === "success"
        ? `${base} bg-teal-700 text-white hover:bg-teal-800`
        : tone === "danger"
          ? `${base} bg-red-600 text-white hover:bg-red-700`
          : tone === "warning"
            ? `${base} border bg-amber-50 text-amber-800 hover:bg-amber-100`
            : `${base} border bg-white/80 text-slate-700 hover:bg-slate-50`;

  const style =
    tone === "soft"
      ? { borderColor: "rgba(15,23,42,0.10)" }
      : tone === "warning"
        ? { borderColor: "rgba(245,158,11,0.20)" }
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

function ValueCard({ label, value, helper, changeText, changeClass }) {
  return (
    <div
      className="rounded-2xl border p-4 shadow-sm"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
        borderColor: "rgba(15,23,42,0.08)",
      }}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>

      <div className="mt-1 text-2xl font-semibold">{value}</div>

      {changeText ? (
        <div className={`mt-1 text-xs font-semibold ${changeClass}`}>
          {changeText}
        </div>
      ) : (
        <div className="mt-1 text-xs text-muted-foreground">
          {helper}
        </div>
      )}
    </div>
  );
}

export default function Block() {
  const [proposals, setProposals] = useState([]);
  const [counts, setCounts] = useState({
    total: 0,
    needsReview: 0,
    approved: 0,
    rejected: 0,
    applied: 0,
    blocked: 0,
    alreadyCurrent: 0,
  });
  const [hiddenDuplicateCount, setHiddenDuplicateCount] = useState(0);
  const [notesById, setNotesById] = useState({});
  const [selectedMatchById, setSelectedMatchById] = useState({});
  const [busyId, setBusyId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
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

  function percent(value) {
    if (value === null || typeof value === "undefined" || value === "") {
      return "—";
    }

    const numberValue = Number(value);

    if (Number.isNaN(numberValue)) return "—";

    return numberValue.toLocaleString("en-US", {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  function notifyCostSignalsUpdated() {
    window.dispatchEvent(
      new Event("kitchenpulse:receipt-cost-proposals-updated")
    );
  }

  function trustedVendorSuggestions(proposal) {
    return Array.isArray(proposal?.matchSuggestions)
      ? proposal.matchSuggestions.filter(
          (suggestion) => suggestion.targetType !== "inventory"
        )
      : [];
  }

  function getCleanSignalName(proposal) {
    const suggestionName =
      trustedVendorSuggestions(proposal)?.[0]?.name || "";

    if (proposal.hasMatch && suggestionName) {
      return suggestionName;
    }

    const reason = String(proposal.proposalReason || "");
    const matchedReason = reason.match(/matched to ([^.]+)\./i);

    if (proposal.hasMatch && matchedReason?.[1]) {
      return matchedReason[1].trim();
    }

    return (
      proposal.friendlyParsedItemName ||
      proposal.parsedItemName ||
      proposal.proposalName ||
      "Cost signal"
    );
  }

  function getChangeClass(value) {
    if (value === null || typeof value === "undefined") {
      return "text-muted-foreground";
    }

    const numberValue = Number(value);

    if (Number.isNaN(numberValue)) return "text-muted-foreground";
    if (numberValue > 0) return "text-red-700";
    if (numberValue < 0) return "text-teal-700";
    return "text-muted-foreground";
  }

  function getProposalTone(proposal) {
    if (proposal.alreadyCurrent) return "current";
    if (proposal.proposalStatus === "Applied") return "tracked";
    if (proposal.proposalStatus === "Rejected") return "rejected";
    if (!proposal.hasMatch) return "review";
    if (proposal.canApply) return "approved";
    if (proposal.proposalStatus === "Approved") return "approved";
    return "neutral";
  }

  function matchValue(suggestion) {
    if (!suggestion) return "";

    return `${suggestion.targetType}|${suggestion.recordId}`;
  }

  function parseMatchValue(value) {
    const [targetType, targetRecordId] = String(value || "").split("|");

    return {
      targetType,
      targetRecordId,
    };
  }

  function getSelectedSuggestion(proposal) {
    const value = selectedMatchById[proposal.id] || "";
    const { targetType, targetRecordId } = parseMatchValue(value);

    return trustedVendorSuggestions(proposal).find(
      (suggestion) =>
        suggestion.targetType === targetType &&
        suggestion.recordId === targetRecordId
    );
  }

  async function loadProposals({ quiet = false } = {}) {
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
      const response = await fetch(COST_PROPOSALS_API, {
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
        console.error("Cost proposals returned non-JSON:", text);
        throw new Error("Cost signals returned a non-JSON response.");
      }

      if (!response.ok || !data?.ok) {
        console.error("Cost proposals API error:", data);
        throw new Error(data?.error || "Could not load cost signals.");
      }

      const nextProposals = Array.isArray(data.proposals)
        ? data.proposals
        : [];

      setProposals(nextProposals);
      setHiddenDuplicateCount(Number(data.hiddenDuplicateCount || 0));
      setCounts(
        data.counts || {
          total: nextProposals.length,
          needsReview: 0,
          approved: 0,
          rejected: 0,
          applied: 0,
          blocked: 0,
          alreadyCurrent: 0,
        }
      );

      setSelectedMatchById((current) => {
        const next = { ...current };

        for (const proposal of nextProposals) {
          const suggestions = trustedVendorSuggestions(proposal);
          const firstSuggestion = suggestions[0] || null;

          if (!proposal.hasMatch && firstSuggestion) {
            const currentValue = next[proposal.id] || "";
            const selected = suggestions.find(
              (suggestion) => matchValue(suggestion) === currentValue
            );

            if (!selected) {
              next[proposal.id] = matchValue(firstSuggestion);
            }
          }
        }

        return next;
      });
    } catch (requestError) {
      console.error("Cost proposals request failed:", requestError);
      setProposals([]);
      setError(
        requestError?.message ||
          "Cost signals could not be loaded. Refresh this section or check Airtable."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  async function generateProposals() {
    setIsGenerating(true);
    setError("");
    setMessage("");

    try {
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
        console.error("Generate proposals returned non-JSON:", text);
        throw new Error("Cost signal generation returned a non-JSON response.");
      }

      if (!response.ok || !data?.ok) {
        console.error("Generate proposals failed:", data);
        throw new Error(data?.error || "Could not generate cost signals.");
      }

      setMessage(
        data.message ||
          `Generated ${data.createdCount || 0} cost signal records.`
      );

      notifyCostSignalsUpdated();
      await loadProposals({ quiet: true });
    } catch (requestError) {
      console.error("Generate proposals request failed:", requestError);
      setError(
        requestError?.message ||
          "Could not generate cost signals. Try again or check Airtable."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function submitProposalAction(proposal, action) {
    setBusyId(proposal.id);
    setError("");
    setMessage("");

    const notes = notesById[proposal.id] || "";

    async function postProposalAction(nextAction) {
      const response = await fetch(COST_PROPOSALS_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          recordId: proposal.id,
          action: nextAction,
          notes,
        }),
      });

      const text = await response.text();

      let data = null;

      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("Proposal action returned non-JSON:", text);
        throw new Error("Cost signal action returned a non-JSON response.");
      }

      if (!response.ok || !data?.ok) {
        console.error("Proposal action failed:", data);
        throw new Error(data?.error || "Could not update this cost signal.");
      }

      return data;
    }

    try {
      let data = null;

      if (action === "approve_and_apply") {
        if (!proposal.hasMatch) {
          throw new Error(
            "Match this receipt line to a tracked vendor item before tracking the signal."
          );
        }

        if (proposal.proposalStatus === "Needs Review") {
          await postProposalAction("approve");
        }

        data = await postProposalAction("apply");

        setMessage(
          data.message ||
            "Cost signal approved, tracked, and Cost Movement created."
        );
      } else {
        data = await postProposalAction(action);
        setMessage(data.message || "Cost signal updated.");
      }

      setNotesById((current) => ({
        ...current,
        [proposal.id]: "",
      }));

      notifyCostSignalsUpdated();
      await loadProposals({ quiet: true });
    } catch (requestError) {
      console.error("Proposal update failed:", requestError);
      setError(
        requestError?.message ||
          "Could not update this cost signal. Try again or check Airtable."
      );
    } finally {
      setBusyId("");
    }
  }

  async function submitMatch(proposal) {
    const selectedValue = selectedMatchById[proposal.id] || "";
    const { targetType, targetRecordId } = parseMatchValue(selectedValue);

    if (!targetType || !targetRecordId) {
      setError("Choose a tracked vendor item before saving.");
      return;
    }

    setBusyId(proposal.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(COST_PROPOSALS_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "set_match",
          proposalId: proposal.id,
          targetType,
          targetRecordId,
        }),
      });

      const text = await response.text();

      let data = null;

      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("Set match returned non-JSON:", text);
        throw new Error("Set match returned a non-JSON response.");
      }

      if (!response.ok || !data?.ok) {
        console.error("Set match failed:", data);
        throw new Error(data?.error || "Could not save this match.");
      }

      setMessage(
        data.message ||
          "Match saved. Cost impact checked. No POS pricing has been changed."
      );

      notifyCostSignalsUpdated();
      await loadProposals({ quiet: true });
    } catch (requestError) {
      console.error("Set match request failed:", requestError);
      setError(
        requestError?.message ||
          "Could not save this match. Try again or check Airtable."
      );
    } finally {
      setBusyId("");
    }
  }

  async function createTrackedVendorItem(proposal, { forceCreate = false } = {}) {
    setBusyId(proposal.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(COST_PROPOSALS_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "create_cost_source_item",
          proposalId: proposal.id,
          forceCreate,
        }),
      });

      const text = await response.text();

      let data = null;

      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("Create tracked vendor item returned non-JSON:", text);
        throw new Error(
          "Create tracked vendor item returned a non-JSON response."
        );
      }

      if (response.status === 409 && data?.action === "possible_duplicate") {
        throw new Error(
          "KitchenPulse found a possible existing tracked vendor item. Review the suggested match before creating a new one."
        );
      }

      if (!response.ok || !data?.ok) {
        console.error("Create tracked vendor item failed:", data);
        throw new Error(
          data?.error || "Could not create this tracked vendor item."
        );
      }

      setMessage(
        data.message ||
          "Tracked vendor item created and linked. Review the cost signal before tracking movement."
      );

      notifyCostSignalsUpdated();
      await loadProposals({ quiet: true });
    } catch (requestError) {
      console.error("Create tracked vendor item request failed:", requestError);
      setError(
        requestError?.message ||
          "Could not create this tracked vendor item. Try again or check Airtable."
      );
    } finally {
      setBusyId("");
    }
  }

  const visibleProposals = useMemo(() => {
    let next = proposals;

    if (statusFilter === "active") {
      next = next.filter(
        (proposal) =>
          !proposal.alreadyCurrent &&
          (proposal.proposalStatus === "Needs Review" ||
            proposal.proposalStatus === "Approved")
      );
    } else if (statusFilter === "alreadyCurrent") {
      next = next.filter((proposal) => proposal.alreadyCurrent);
    } else if (statusFilter === "Needs Review") {
      next = next.filter(
        (proposal) =>
          proposal.proposalStatus === "Needs Review" &&
          !proposal.alreadyCurrent
      );
    } else if (statusFilter === "Approved") {
      next = next.filter(
        (proposal) =>
          proposal.proposalStatus === "Approved" &&
          !proposal.alreadyCurrent
      );
    } else if (statusFilter !== "all") {
      next = next.filter(
        (proposal) => proposal.proposalStatus === statusFilter
      );
    }

    return [...next].sort((a, b) => {
      const rank = {
        Approved: 1,
        "Needs Review": 2,
        Applied: 3,
        Rejected: 4,
      };

      if (a.alreadyCurrent !== b.alreadyCurrent) {
        return a.alreadyCurrent ? 1 : -1;
      }

      const aRank = rank[a.proposalStatus] || 99;
      const bRank = rank[b.proposalStatus] || 99;

      if (aRank !== bRank) return aRank - bRank;

      return String(getCleanSignalName(a)).localeCompare(
        String(getCleanSignalName(b))
      );
    });
  }, [proposals, statusFilter]);

  useEffect(() => {
    loadProposals();

    const handleProposalRefresh = () => {
      loadProposals({ quiet: true });
    };

    const handleFocus = () => {
      loadProposals({ quiet: true });
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadProposals({ quiet: true });
      }
    };

    window.addEventListener(
      "kitchenpulse:receipt-cost-proposals-updated",
      handleProposalRefresh
    );
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener(
        "kitchenpulse:receipt-cost-proposals-updated",
        handleProposalRefresh
      );
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const activeCount = counts.needsReview + counts.approved;
  const noActiveWork =
    !isLoading && statusFilter === "active" && visibleProposals.length === 0;

  return (
    <div className="container py-4">
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
                    Cost Signals
                  </div>

                  <StatusPill tone="approved" icon={CircleDollarSign}>
                    Cost signals
                  </StatusPill>

                  <StatusPill tone="neutral" icon={ShieldCheck}>
                    Final approval gate
                  </StatusPill>

                  {hiddenDuplicateCount > 0 && (
                    <StatusPill tone="muted">
                      {hiddenDuplicateCount} stale hidden
                    </StatusPill>
                  )}
                </div>

                <h2 className="text-2xl font-heading font-semibold tracking-tight">
                  Cost Signals Review
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Review approved receipt lines before KitchenPulse uses them to detect vendor cost movement, margin pressure, and affected menu items.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <ActionButton
                  tone="success"
                  icon={Sparkles}
                  onClick={generateProposals}
                  disabled={
                    isLoading ||
                    isRefreshing ||
                    isGenerating ||
                    Boolean(busyId)
                  }
                >
                  {isGenerating ? "Checking lines..." : "Find cost changes"}
                </ActionButton>

                <ActionButton
                  tone="soft"
                  icon={RefreshCw}
                  onClick={() => loadProposals({ quiet: true })}
                  disabled={isLoading || isRefreshing || Boolean(busyId)}
                >
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </ActionButton>
              </div>
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-6">
              <CountCard label="Active" value={activeCount} tone="neutral" />
              <CountCard label="Review" value={counts.needsReview} tone="review" />
              <CountCard label="Approved" value={counts.approved} tone="approved" />
              <CountCard label="Tracked" value={counts.applied} tone="tracked" />
              <CountCard label="Blocked" value={counts.blocked} tone="blocked" />
              <CountCard label="Current" value={counts.alreadyCurrent || 0} tone="current" />
            </div>

            <div
              className="mb-5 rounded-2xl border p-4 shadow-sm"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))",
                borderColor: "rgba(15,23,42,0.08)",
              }}
            >
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                View cost signals
              </label>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="mt-2 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
              >
                <option value="active">Active review</option>
                <option value="Needs Review">Needs review</option>
                <option value="Approved">Approved, ready to track</option>
                <option value="Applied">Tracked</option>
                <option value="alreadyCurrent">Already current</option>
                <option value="Rejected">Rejected</option>
                <option value="all">All visible signals</option>
              </select>

              {hiddenDuplicateCount > 0 && (
                <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {hiddenDuplicateCount} older duplicate cost signal
                  {hiddenDuplicateCount === 1 ? "" : "s"} hidden from this owner-facing view.
                </div>
              )}
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
                  Loading cost signals
                </div>

                <div className="mt-2 text-sm text-muted-foreground">
                  Checking approved receipt lines for vendor cost movement.
                </div>
              </div>
            ) : visibleProposals.length === 0 ? (
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
                      "linear-gradient(135deg, #0F766E 0%, #0891B2 100%)",
                    boxShadow: "0 14px 28px rgba(15,118,110,0.20)",
                  }}
                >
                  <ClipboardCheck className="h-7 w-7" />
                </div>

                <div className="mt-4 text-lg font-semibold">
                  {noActiveWork
                    ? "No cost signals need review"
                    : "No cost signals in this view"}
                </div>

                <div className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                  {noActiveWork
                    ? `${counts.applied || 0} cost signal${
                        counts.applied === 1 ? " has" : "s have"
                      } already been tracked. ${
                        hiddenDuplicateCount > 0
                          ? `${hiddenDuplicateCount} stale duplicate signal${
                              hiddenDuplicateCount === 1 ? " is" : "s are"
                            } hidden from this view.`
                          : ""
                      }`
                    : "Approve parsed receipt lines first, then click Find cost changes to create cost movement signals."}
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {visibleProposals.map((proposal) => {
                  const isBusy = busyId === proposal.id;
                  const hasMatch = Boolean(proposal.hasMatch);
                  const suggestions = trustedVendorSuggestions(proposal);
                  const selectedSuggestion = getSelectedSuggestion(proposal);
                  const isActionable =
                    !proposal.alreadyCurrent &&
                    proposal.proposalStatus !== "Applied" &&
                    proposal.proposalStatus !== "Rejected";
                  const proposalTone = getProposalTone(proposal);
                  const proposalStyle = toneStyles(proposalTone);

                  return (
                    <div
                      key={proposal.id}
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
                        style={{ background: proposalStyle.color }}
                      />

                      <div
                        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
                        style={{ background: proposalStyle.glow }}
                      />

                      <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-base font-semibold">
                              {getCleanSignalName(proposal)}
                            </div>

                            {!proposal.alreadyCurrent && (
                              <StatusPill tone={statusTone(proposal.proposalStatus)}>
                                {proposal.proposalStatus || "Needs Review"}
                              </StatusPill>
                            )}

                            {proposal.alreadyCurrent && (
                              <StatusPill tone="current">
                                Already current
                              </StatusPill>
                            )}

                            {!hasMatch && !proposal.alreadyCurrent && (
                              <StatusPill tone="blocked" icon={Lock}>
                                Needs match
                              </StatusPill>
                            )}

                            {proposal.canApply && (
                              <StatusPill tone="approved" icon={ShieldCheck}>
                                Ready to track
                              </StatusPill>
                            )}
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
                            <ValueCard
                              label="Tracked cost"
                              value={money(proposal.currentCost)}
                              helper="Current cost KitchenPulse is tracking"
                            />

                            <div className="hidden justify-center md:flex">
                              <div
                                className="flex h-10 w-10 items-center justify-center rounded-full border shadow-sm"
                                style={{
                                  background:
                                    "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
                                  borderColor: "rgba(15,23,42,0.08)",
                                }}
                              >
                                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                              </div>
                            </div>

                            <ValueCard
                              label="Receipt cost"
                              value={money(proposal.proposedCost)}
                              changeText={
                                proposal.alreadyCurrent
                                  ? "No new signal needed"
                                  : `Change: ${percent(proposal.changePercent)}`
                              }
                              changeClass={getChangeClass(proposal.changePercent)}
                            />
                          </div>

                          <div className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                            <div className="flex items-center gap-2">
                              <CircleDollarSign className="h-4 w-4 text-teal-700" />
                              <span>{proposal.vendor || "Vendor not entered"}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              {hasMatch ? (
                                <ShieldCheck className="h-4 w-4 text-teal-700" />
                              ) : (
                                <Lock className="h-4 w-4 text-amber-700" />
                              )}
                              <span>
                                {hasMatch
                                  ? "Matched to tracked vendor item"
                                  : "Blocked until matched"}
                              </span>
                            </div>
                          </div>

                          {proposal.alreadyCurrent && (
                            <div className="mt-4">
                              <Notice tone="current">
                                <div>
                                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide">
                                    Already current
                                  </div>
                                  KitchenPulse is already tracking this cost. No new cost signal is needed.
                                </div>
                              </Notice>
                            </div>
                          )}

                          {!hasMatch &&
                            proposal.proposalStatus !== "Rejected" &&
                            proposal.proposalStatus !== "Applied" &&
                            !proposal.alreadyCurrent && (
                              <div
                                className="mt-4 rounded-2xl border p-4"
                                style={{
                                  background:
                                    "linear-gradient(145deg, rgba(255,251,235,0.64), rgba(255,255,255,0.90))",
                                  borderColor: "rgba(245,158,11,0.18)",
                                }}
                              >
                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
                                  <Link2 className="h-4 w-4" />
                                  Match this receipt line
                                </div>

                                {suggestions.length > 0 ? (
                                  <>
                                    <div
                                      className="rounded-2xl border p-3 shadow-sm"
                                      style={{
                                        background:
                                          "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(248,250,252,0.76))",
                                        borderColor: "rgba(245,158,11,0.20)",
                                      }}
                                    >
                                      <div className="mb-2 flex items-center justify-between gap-2">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                                          Choose the tracked vendor item this receipt line belongs to
                                        </div>

                                        <StatusPill tone="review">
                                          Click to choose
                                        </StatusPill>
                                      </div>

                                      <select
                                        value={selectedMatchById[proposal.id] || ""}
                                        onChange={(event) =>
                                          setSelectedMatchById((current) => ({
                                            ...current,
                                            [proposal.id]: event.target.value,
                                          }))
                                        }
                                        className="w-full cursor-pointer rounded-xl border bg-white/90 px-3 py-3 text-sm font-semibold text-slate-900 outline-none transition hover:bg-amber-50 focus:ring-2 focus:ring-amber-200"
                                        style={{
                                          borderColor: "rgba(245,158,11,0.26)",
                                        }}
                                      >
                                        {suggestions.map((suggestion) => (
                                          <option
                                            key={`${suggestion.targetType}-${suggestion.recordId}`}
                                            value={matchValue(suggestion)}
                                          >
                                            {suggestion.name} · Tracked vendor item · Tracked {money(suggestion.currentCost)} · Score {suggestion.score}
                                          </option>
                                        ))}
                                      </select>

                                      <div className="mt-2 text-xs leading-relaxed text-amber-800">
                                        Pick the trusted item KitchenPulse should compare this receipt line against. This does not update POS pricing.
                                      </div>
                                    </div>

                                    {selectedSuggestion && (
                                      <div
                                        className="mt-3 rounded-xl border px-3 py-2 text-xs text-muted-foreground"
                                        style={{
                                          background:
                                            "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
                                          borderColor: "rgba(15,23,42,0.08)",
                                        }}
                                      >
                                        <div className="font-semibold text-foreground">
                                          {selectedSuggestion.reason}
                                        </div>
                                        <div className="mt-1">
                                          Vendor:{" "}
                                          {selectedSuggestion.supplier ||
                                            "Not listed"}{" "}
                                          · Tracked cost:{" "}
                                          {money(selectedSuggestion.currentCost)}
                                        </div>
                                      </div>
                                    )}

                                    <ActionButton
                                      tone="primary"
                                      icon={Link2}
                                      onClick={() => submitMatch(proposal)}
                                      disabled={isBusy}
                                    >
                                      {isBusy ? "Checking cost..." : "Use this match"}
                                    </ActionButton>

                                    <div
                                      className="mt-3 rounded-2xl border px-3 py-3"
                                      style={{
                                        background:
                                          "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
                                        borderColor: "rgba(15,23,42,0.08)",
                                      }}
                                    >
                                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                                        Not the same item?
                                      </div>

                                      <div className="mt-1 text-xs leading-5 text-muted-foreground">
                                        Use this when the suggestion is close but not actually the same vendor item.
                                        KitchenPulse will create a separate tracked vendor item from this receipt line.
                                      </div>

                                      <div className="mt-3">
                                        <ActionButton
                                          tone="soft"
                                          icon={Sparkles}
                                          onClick={() =>
                                            createTrackedVendorItem(proposal, {
                                              forceCreate: true,
                                            })
                                          }
                                          disabled={isBusy}
                                        >
                                          {isBusy
                                            ? "Creating item..."
                                            : "Create separate tracked item"}
                                        </ActionButton>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div
                                    className="rounded-2xl border p-4 shadow-sm"
                                    style={{
                                      background:
                                        "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(248,250,252,0.76))",
                                      borderColor: "rgba(245,158,11,0.20)",
                                    }}
                                  >
                                    <div className="text-sm font-semibold text-slate-950">
                                      No trusted match found
                                    </div>

                                    <div className="mt-2 text-sm leading-6 text-muted-foreground">
                                      This receipt line does not match an existing tracked vendor item yet. Create it once, then future receipts can match automatically.
                                    </div>

                                    <div className="mt-4">
                                      <ActionButton
                                        tone="primary"
                                        icon={Sparkles}
                                        onClick={() =>
                                          createTrackedVendorItem(proposal)
                                        }
                                        disabled={isBusy}
                                      >
                                        {isBusy
                                          ? "Creating item..."
                                          : "Create tracked vendor item"}
                                      </ActionButton>
                                    </div>

                                    <div
                                      className="mt-3 rounded-xl border px-3 py-2 text-xs text-amber-800"
                                      style={{
                                        background: "rgba(245,158,11,0.08)",
                                        borderColor: "rgba(245,158,11,0.16)",
                                      }}
                                    >
                                      This creates a trusted vendor-cost item from the reviewed receipt line. It does not update POS pricing.
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                          {proposal.proposalReason && (
                            <div
                              className="mt-4 rounded-2xl border px-4 py-3 text-sm text-muted-foreground"
                              style={{
                                background:
                                  "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.70))",
                                borderColor: "rgba(15,23,42,0.08)",
                              }}
                            >
                              <div className="mb-1 text-xs font-semibold uppercase tracking-wide">
                                Why this surfaced
                              </div>
                              {proposal.proposalReason}
                            </div>
                          )}

                          {isActionable && (
                            <div className="mt-4">
                              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Review note optional
                              </label>
                              <input
                                value={notesById[proposal.id] || ""}
                                onChange={(event) =>
                                  setNotesById((current) => ({
                                    ...current,
                                    [proposal.id]: event.target.value,
                                  }))
                                }
                                placeholder="Example: Confirmed against vendor receipt"
                                className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col gap-2 md:min-w-[210px]">
                          {proposal.proposalStatus === "Needs Review" &&
                            !proposal.alreadyCurrent && (
                              <>
                                <ActionButton
                                  tone="success"
                                  icon={CircleDollarSign}
                                  onClick={() =>
                                    submitProposalAction(
                                      proposal,
                                      "approve_and_apply"
                                    )
                                  }
                                  disabled={isBusy || !proposal.canApprove}
                                >
                                  {isBusy
                                    ? "Tracking..."
                                    : "Approve + track cost"}
                                </ActionButton>

                                <ActionButton
                                  tone="danger"
                                  icon={XCircle}
                                  onClick={() =>
                                    submitProposalAction(proposal, "reject")
                                  }
                                  disabled={isBusy}
                                >
                                  Reject signal
                                </ActionButton>
                              </>
                            )}

                          {proposal.proposalStatus === "Approved" &&
                            !proposal.alreadyCurrent && (
                              <>
                                <ActionButton
                                  tone="primary"
                                  icon={CircleDollarSign}
                                  onClick={() =>
                                    submitProposalAction(
                                      proposal,
                                      "approve_and_apply"
                                    )
                                  }
                                  disabled={isBusy || !proposal.canApply}
                                >
                                  {isBusy ? "Tracking..." : "Track cost signal"}
                                </ActionButton>

                                <ActionButton
                                  tone="soft"
                                  icon={RotateCcw}
                                  onClick={() =>
                                    submitProposalAction(
                                      proposal,
                                      "return_to_review"
                                    )
                                  }
                                  disabled={isBusy}
                                >
                                  Return to review
                                </ActionButton>
                              </>
                            )}

                          {proposal.proposalStatus === "Approved" &&
                            !proposal.alreadyCurrent && (
                              <>
                                <ActionButton
                                  tone="primary"
                                  icon={CircleDollarSign}
                                  onClick={() =>
                                    submitProposalAction(proposal, "apply")
                                  }
                                  disabled={isBusy || !proposal.canApply}
                                >
                                  {isBusy ? "Tracking..." : "Track cost signal"}
                                </ActionButton>

                                <ActionButton
                                  tone="soft"
                                  icon={RotateCcw}
                                  onClick={() =>
                                    submitProposalAction(
                                      proposal,
                                      "return_to_review"
                                    )
                                  }
                                  disabled={isBusy}
                                >
                                  Return to review
                                </ActionButton>
                              </>
                            )}

                          {proposal.proposalStatus === "Rejected" && (
                            <ActionButton
                              tone="soft"
                              icon={RotateCcw}
                              onClick={() =>
                                submitProposalAction(
                                  proposal,
                                  "return_to_review"
                                )
                              }
                              disabled={isBusy}
                            >
                              Return to review
                            </ActionButton>
                          )}

                          {proposal.proposalStatus === "Applied" && (
                            <Notice tone="tracked">
                              Tracked as KitchenPulse cost movement.
                            </Notice>
                          )}

                          {proposal.alreadyCurrent && (
                            <Notice tone="current">
                              No new signal needed.
                            </Notice>
                          )}

                          {!hasMatch &&
                            proposal.proposalStatus !== "Rejected" &&
                            !proposal.alreadyCurrent && (
                              <Notice tone="review" icon={Lock}>
                                Match this receipt line to a tracked vendor item before approval.
                              </Notice>
                            )}
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
