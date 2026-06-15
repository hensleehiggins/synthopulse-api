import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Eye,
  Loader2,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  ThumbsDown,
} from "lucide-react";

const REVIEW_API = "https://project-1csz2.vercel.app/api/stock-count-review";
const COUNT_INTAKE_URL = "https://www.synthopulse.ai/count";

function numberOrDash(value) {
  if (value === null || value === undefined || value === "") return "-";

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "-";

  return Number.isInteger(numberValue)
    ? numberValue.toLocaleString("en-US")
    : numberValue.toLocaleString("en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      });
}

function isNumericOnly(value) {
  return String(value || "").trim() !== "" && Number.isFinite(Number(value));
}

function formatCountDisplay(line) {
  const quantity = numberOrDash(line.quantity);
  const unit = String(line.unit || "").trim();

  if (!unit) {
    return {
      value: quantity,
      note: "No unit entered",
    };
  }

  if (isNumericOnly(unit)) {
    return {
      value: `${quantity} counted`,
      note: `Unit needs label: ${unit}`,
    };
  }

  return {
    value: `${quantity} ${unit}`,
    note: `Unit: ${unit}`,
  };
}

function openCountIntake() {
  window.open(COUNT_INTAKE_URL, "_blank", "noopener,noreferrer");
}

function pillStyles(tone) {
  if (tone === "approved") {
    return {
      color: "#047857",
      bg: "rgba(16,185,129,0.10)",
      border: "rgba(16,185,129,0.18)",
    };
  }

  if (tone === "reject") {
    return {
      color: "#B91C1C",
      bg: "rgba(239,68,68,0.09)",
      border: "rgba(239,68,68,0.16)",
    };
  }

  if (tone === "photo") {
    return {
      color: "#0891B2",
      bg: "rgba(34,211,238,0.09)",
      border: "rgba(34,211,238,0.16)",
    };
  }

  return {
    color: "#475569",
    bg: "rgba(100,116,139,0.08)",
    border: "rgba(100,116,139,0.14)",
  };
}

function StatusPill({ children, tone = "neutral" }) {
  const styles = pillStyles(tone);

  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold"
      style={{
        color: styles.color,
        background: styles.bg,
        borderColor: styles.border,
      }}
    >
      {children}
    </span>
  );
}

export default function StockCountReviewQueue() {
  const [lines, setLines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActingId, setIsActingId] = useState("");
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const lastReturnRefreshAt = useRef(0);

  const pendingLines = useMemo(() => {
    return Array.isArray(lines) ? lines : [];
  }, [lines]);

  async function loadReviewQueue({ quiet = false } = {}) {
    if (!quiet) {
      setIsLoading(true);
    }

    setError("");

    try {
      const response = await fetch(`${REVIEW_API}?t=${Date.now()}`);
      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Stock count review queue could not be loaded.");
      }

      setLines(Array.isArray(data.lines) ? data.lines : []);
      setLastUpdated(
        new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })
      );
    } catch (loadError) {
      if (!quiet) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load stock count review queue."
        );
      } else {
        console.warn("Quiet stock count review refresh failed:", loadError);
      }
    } finally {
      if (!quiet) {
        setIsLoading(false);
      }
    }
  }

  async function actOnLine(lineId, action) {
    setIsActingId(lineId);
    setError("");

    try {
      const response = await fetch(REVIEW_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordId: lineId,
          action,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "KitchenPulse could not update this count.");
      }

      setLines((current) => current.filter((line) => line.id !== lineId));
      setLastUpdated(
        new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Unable to update stock count."
      );
    } finally {
      setIsActingId("");
    }
  }

  useEffect(() => {
    loadReviewQueue();
  }, []);

  useEffect(() => {
    function refreshWhenReturning() {
      if (document.visibilityState === "hidden") return;

      const now = Date.now();

      if (now - lastReturnRefreshAt.current < 5000) return;

      lastReturnRefreshAt.current = now;
      loadReviewQueue({ quiet: true });
    }

    window.addEventListener("focus", refreshWhenReturning);
    document.addEventListener("visibilitychange", refreshWhenReturning);

    return () => {
      window.removeEventListener("focus", refreshWhenReturning);
      document.removeEventListener("visibilitychange", refreshWhenReturning);
    };
  }, []);

  return (
    <div className="container py-4">
      <div className="content mx-auto max-w-6xl">
        <section
          className="relative overflow-hidden rounded-3xl border p-5 shadow-xl md:p-6"
          style={{
            background:
              "radial-gradient(circle at 12% 8%, rgba(34,211,238,0.065), transparent 30%), radial-gradient(circle at 82% 12%, rgba(99,102,241,0.045), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(248,250,252,0.94) 55%, rgba(241,245,249,0.86) 100%)",
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
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </span>
                  Count review queue
                </div>

                <h2 className="text-2xl font-heading font-semibold tracking-tight">
                  Submit and approve stock counts
                </h2>

                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  Staff counts enter here before they affect ordering. Approved counts become
                  trusted reorder signals; rejected counts stay out of Order Intelligence.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={openCountIntake}
                  className="inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm transition hover:bg-white"
                  style={{
                    color: "#FFFFFF",
                    background:
                      "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(8,145,178,0.92))",
                    borderColor: "rgba(15,23,42,0.12)",
                    boxShadow:
                      "0 12px 24px rgba(8,145,178,0.18), inset 0 1px 0 rgba(255,255,255,0.18)",
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Submit count
                </button>

                <button
                  type="button"
                  onClick={() => loadReviewQueue()}
                  disabled={isLoading}
                  className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-sm transition hover:bg-white disabled:opacity-60"
                  style={{
                    color: "#334155",
                    background:
                      "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
                    borderColor: "rgba(15,23,42,0.08)",
                  }}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-700" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 text-cyan-700" />
                  )}
                  Refresh
                </button>
              </div>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-4">
              <SummaryCard
                icon={ExternalLink}
                label="Count intake"
                value="Open"
                note="Launch mobile count page"
                actionLabel="Submit count"
                onAction={openCountIntake}
                featured
              />

              <SummaryCard
                icon={ClipboardCheck}
                label="Pending counts"
                value={pendingLines.length}
                note="Waiting for review"
              />

              <SummaryCard
                icon={PackageCheck}
                label="Approval rule"
                value="Manual"
                note="Counts do not affect ordering until approved"
              />

              <SummaryCard
                icon={CheckCircle2}
                label="Last refresh"
                value={lastUpdated || "-"}
                note="Refreshes when this tab is active again"
              />
            </div>

            {error && (
              <div
                className="mb-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm leading-relaxed"
                style={{
                  color: "#B91C1C",
                  background: "rgba(239,68,68,0.08)",
                  borderColor: "rgba(239,68,68,0.16)",
                }}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{error}</div>
              </div>
            )}

            <div
              className="overflow-hidden rounded-3xl border shadow-sm"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))",
                borderColor: "rgba(15,23,42,0.08)",
                boxShadow:
                  "0 10px 24px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.82)",
              }}
            >
              {isLoading ? (
                <div className="flex min-h-[220px] items-center justify-center p-8">
                  <div className="text-center">
                    <Loader2 className="mx-auto h-7 w-7 animate-spin text-cyan-700" />
                    <div className="mt-3 text-sm font-semibold text-slate-900">
                      Loading count review queue...
                    </div>
                  </div>
                </div>
              ) : pendingLines.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center p-8">
                  <div className="max-w-md text-center">
                    <div
                      className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border"
                      style={{
                        color: "#047857",
                        background: "rgba(16,185,129,0.10)",
                        borderColor: "rgba(16,185,129,0.18)",
                      }}
                    >
                      <CheckCircle2 className="h-7 w-7" />
                    </div>

                    <div className="mt-3 text-base font-semibold text-slate-950">
                      No counts waiting for review
                    </div>

                    <div className="mt-1 text-sm leading-relaxed text-slate-500">
                      New submissions from the stock count page will appear here before
                      they are trusted by Order Intelligence.
                    </div>

                    <button
                      type="button"
                      onClick={openCountIntake}
                      className="mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm transition hover:bg-white"
                      style={{
                        color: "#0891B2",
                        background: "rgba(255,255,255,0.86)",
                        borderColor: "rgba(34,211,238,0.18)",
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Submit new count
                    </button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-200/80">
                  {pendingLines.map((line) => (
                    <ReviewRow
                      key={line.id}
                      line={line}
                      isActing={isActingId === line.id}
                      onApprove={() => actOnLine(line.id, "approve")}
                      onReject={() => actOnLine(line.id, "reject")}
                    />
                  ))}
                </div>
              )}
            </div>

            <div
              className="mt-4 rounded-2xl border px-4 py-3 text-sm leading-relaxed text-muted-foreground shadow-sm"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.76))",
                borderColor: "rgba(15,23,42,0.08)",
              }}
            >
              <span className="font-semibold text-foreground">Operator read:</span>{" "}
              Count first, approve second. Only approved counts become live reorder
              pressure inside Order Intelligence.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  note,
  actionLabel = "",
  onAction,
  featured = false,
}) {
  return (
    <div
      className="rounded-2xl border px-4 py-3 shadow-sm"
      style={{
        background: featured
          ? "linear-gradient(145deg, rgba(236,254,255,0.88), rgba(255,255,255,0.86))"
          : "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.72))",
        borderColor: featured ? "rgba(34,211,238,0.18)" : "rgba(15,23,42,0.08)",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border"
          style={{
            color: "#0891B2",
            background: "rgba(34,211,238,0.08)",
            borderColor: "rgba(34,211,238,0.15)",
          }}
        >
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {label}
          </div>

          <div className="mt-1 text-base font-semibold text-slate-950">
            {value}
          </div>

          <div className="mt-1 text-xs leading-relaxed text-slate-500">
            {note}
          </div>

          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-sm transition hover:bg-white"
              style={{
                color: "#0891B2",
                background: "rgba(255,255,255,0.80)",
                borderColor: "rgba(34,211,238,0.18)",
              }}
            >
              <ExternalLink className="h-3 w-3" />
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ line, isActing, onApprove, onReject }) {
  const countDisplay = formatCountDisplay(line);

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1.1fr_0.9fr_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold text-slate-950">
            {line.itemName || line.countLineName || "Unnamed count"}
          </div>

          <StatusPill>{line.reviewState || "Submitted"}</StatusPill>

          {line.hasPhoto && <StatusPill tone="photo">Photo</StatusPill>}
        </div>

        <div className="mt-1 text-xs leading-relaxed text-slate-500">
          {line.storageArea || "No area"} • counted by{" "}
          {line.counterName || "unknown"} • {line.countTimeText || "time unknown"}
        </div>

        {line.notes && (
          <div className="mt-2 line-clamp-2 whitespace-pre-line text-xs leading-relaxed text-slate-600">
            {line.notes}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div
          className="rounded-2xl border px-3 py-2"
          style={{
            background: "rgba(248,250,252,0.74)",
            borderColor: "rgba(15,23,42,0.08)",
          }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Count
          </div>

          <div className="mt-1 text-sm font-semibold text-slate-950">
            {countDisplay.value}
          </div>

          <div className="mt-1 text-[11px] leading-relaxed text-slate-500">
            {countDisplay.note}
          </div>
        </div>

        <div
          className="rounded-2xl border px-3 py-2"
          style={{
            background: "rgba(248,250,252,0.74)",
            borderColor: "rgba(15,23,42,0.08)",
          }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Source
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-950">
            Stock count
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end">
        {line.photoUrl && (
          <button
            type="button"
            onClick={() => window.open(line.photoUrl, "_blank", "noopener,noreferrer")}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-sm transition hover:bg-white"
            style={{
              color: "#0891B2",
              background: "rgba(255,255,255,0.82)",
              borderColor: "rgba(34,211,238,0.16)",
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            Photo
          </button>
        )}

        <button
          type="button"
          onClick={onReject}
          disabled={isActing}
          className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-sm transition hover:bg-white disabled:opacity-60"
          style={{
            color: "#B91C1C",
            background: "rgba(255,255,255,0.82)",
            borderColor: "rgba(239,68,68,0.18)",
          }}
        >
          {isActing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ThumbsDown className="h-3.5 w-3.5" />
          )}
          Reject
        </button>

        <button
          type="button"
          onClick={onApprove}
          disabled={isActing}
          className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-sm transition hover:bg-white disabled:opacity-60"
          style={{
            color: "#047857",
            background: "rgba(255,255,255,0.82)",
            borderColor: "rgba(16,185,129,0.18)",
          }}
        >
          {isActing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          Approve
        </button>
      </div>
    </div>
  );
}
