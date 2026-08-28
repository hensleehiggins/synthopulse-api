import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

const RECEIPT_REVIEW_API =
  "https://project-1csz2.vercel.app/api/receipt-review";

const RECEIPT_PARSE_API =
  "https://project-1csz2.vercel.app/api/receipt-parse";

function toneStyles(tone = "neutral") {
  if (tone === "pending") {
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

  if (tone === "error" || tone === "rejected") {
    return {
      color: "#B91C1C",
      bg: "rgba(254,242,242,0.88)",
      border: "rgba(254,202,202,0.90)",
      glow: "rgba(239,68,68,0.055)",
    };
  }

  if (tone === "archive") {
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
      <div className="relative z-10 mt-1 text-2xl font-semibold" style={{ color: styles.color }}>
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

function ActionButton({
  children,
  onClick,
  disabled,
  tone = "dark",
  icon: Icon,
  href,
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60";

  const className =
    tone === "success"
      ? `${base} bg-teal-700 text-white hover:bg-teal-800`
      : tone === "danger"
        ? `${base} bg-red-600 text-white hover:bg-red-700`
        : tone === "parse"
          ? `${base} bg-cyan-700 text-white hover:bg-cyan-800`
          : tone === "soft"
            ? `${base} border bg-white/80 text-slate-700 hover:bg-slate-50`
            : `${base} bg-slate-900 text-white hover:bg-slate-800`;

  const style =
    tone === "soft"
      ? { borderColor: "rgba(15,23,42,0.10)" }
      : undefined;

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
      >
        {children}
        {Icon ? <Icon className="h-4 w-4" /> : null}
      </a>
    );
  }

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
  const [receipts, setReceipts] = useState([]);
  const [counts, setCounts] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    parsed: 0,
    error: 0,
    archived: 0,
  });
  const [notesById, setNotesById] = useState({});
  const [busyId, setBusyId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [parseNoticeById, setParseNoticeById] = useState({});
  const [queueMode, setQueueMode] = useState("active");

  function normalizeStatus(value) {
    return String(value || "").trim();
  }

  function isRejected(receipt) {
    return normalizeStatus(receipt?.processingStatus) === "Rejected";
  }

  function isParsed(receipt) {
    return normalizeStatus(receipt?.processingStatus) === "Parsed";
  }

  function isError(receipt) {
    return normalizeStatus(receipt?.processingStatus) === "Error";
  }

  function isStaged(receipt) {
    return normalizeStatus(receipt?.processingStatus) === "Staged";
  }

  function isApprovedStatus(receipt) {
    return normalizeStatus(receipt?.processingStatus) === "Approved";
  }

  function isArchived(receipt) {
    return Boolean(receipt?.archived);
  }

  function canArchive(receipt) {
    if (isArchived(receipt)) return false;
    return isParsed(receipt) || isRejected(receipt) || isError(receipt);
  }

  function isActuallyApproved(receipt) {
    return Boolean(receipt?.approved);
  }

  function needsReview(receipt) {
    return Boolean(receipt?.reviewNeeded);
  }

  function hasApprovalMismatch(receipt) {
    return (
      isApprovedStatus(receipt) &&
      !isActuallyApproved(receipt) &&
      !isRejected(receipt)
    );
  }

  function canApprove(receipt) {
    if (!receipt?.fileUrl) return false;
    if (isParsed(receipt)) return false;
    if (isActuallyApproved(receipt)) return false;
    return !isRejected(receipt) || isRejected(receipt);
  }

  function canReject(receipt) {
    if (!receipt?.fileUrl) return false;
    if (isParsed(receipt)) return false;
    if (isRejected(receipt)) return false;
    return !isActuallyApproved(receipt);
  }

  function canParse(receipt) {
    return (
      Boolean(receipt?.fileUrl) &&
      isActuallyApproved(receipt) &&
      !isRejected(receipt) &&
      !isParsed(receipt) &&
      !isError(receipt)
    );
  }

  function canReturnToReview(receipt) {
    return isActuallyApproved(receipt) || isRejected(receipt) || isParsed(receipt);
  }

  function formatReceiptDate(value) {
    if (!value) return "No date entered";

    const text = String(value).trim();

    const isoDateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (isoDateOnly) {
      const year = Number(isoDateOnly[1]);
      const month = Number(isoDateOnly[2]);
      const day = Number(isoDateOnly[3]);

      return new Date(year, month - 1, day).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    const date = new Date(text);

    if (Number.isNaN(date.getTime())) {
      return text;
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatUploadedAt(value) {
    if (!value) return "Upload time unavailable";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Upload time unavailable";
    }

    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getStatusLabel(receipt) {
    if (hasApprovalMismatch(receipt)) return "Approval mismatch";
    if (isParsed(receipt)) return "Parsed";
    if (isError(receipt)) return "Error";
    if (isActuallyApproved(receipt)) return "Approved";
    if (isRejected(receipt)) return "Rejected";
    if (needsReview(receipt)) return "Review needed";
    if (isStaged(receipt)) return "Review needed";
    return receipt?.processingStatus || "Review needed";
  }

  function getStatusTone(receipt) {
    if (hasApprovalMismatch(receipt)) return "error";
    if (isParsed(receipt)) return "parsed";
    if (isError(receipt)) return "error";
    if (isActuallyApproved(receipt)) return "approved";
    if (isRejected(receipt)) return "rejected";
    return "pending";
  }

  function getParseNoticeText(notice) {
    if (!notice) return "";
    if (typeof notice === "string") return notice;
    return notice.text || "";
  }

  function isImagePreflightBlock(payloadOrError) {
    const errorType = String(payloadOrError?.errorType || "").toLowerCase();
    const noticeMessage = String(
      payloadOrError?.error ||
        payloadOrError?.message ||
        payloadOrError ||
        ""
    ).toLowerCase();

    return (
      errorType === "rotated_or_unreadable_receipt_image" ||
      noticeMessage.includes("receipt image appears rotated") ||
      noticeMessage.includes("re-upload") ||
      noticeMessage.includes("readability is poor")
    );
  }

  function imagePreflightMessage(payloadOrError) {
    const noticeMessage =
      payloadOrError?.error ||
      payloadOrError?.message ||
      "Receipt image needs to be re-uploaded upright before KitchenPulse can parse it safely.";

    return `Image needs re-upload: ${noticeMessage}`;
  }

  function getParseNoticeTone(notice) {
    const tone = typeof notice === "object" ? notice.tone : "";
    const text = getParseNoticeText(notice).toLowerCase();

    if (
      tone === "warning" ||
      text.includes("re-upload") ||
      text.includes("rotated") ||
      text.includes("readability")
    ) {
      return "pending";
    }

    if (tone === "error" || text.includes("failed") || text.includes("could not")) {
      return "error";
    }

    if (tone === "success" || text.includes("parsed successfully")) {
      return "approved";
    }

    return "parsed";
  }

  function getReviewQueue(receiptList, mode = queueMode) {
    return receiptList.filter((receipt) => {
      if (!receipt.fileUrl) return false;

      if (mode === "archived") {
        return isArchived(receipt);
      }

      if (isArchived(receipt)) return false;

      if (isRejected(receipt)) return true;
      if (isParsed(receipt)) return true;
      if (isError(receipt)) return true;
      if (isActuallyApproved(receipt)) return true;
      if (hasApprovalMismatch(receipt)) return true;
      if (needsReview(receipt)) return true;
      if (isStaged(receipt)) return true;

      return false;
    });
  }

  function buildLocalCounts(receiptList) {
    const activeQueue = getReviewQueue(receiptList, "active");

    return {
      total: activeQueue.length,
      pending: activeQueue.filter(
        (receipt) =>
          !isActuallyApproved(receipt) &&
          !isRejected(receipt) &&
          !isParsed(receipt) &&
          !isError(receipt)
      ).length,
      approved: activeQueue.filter(
        (receipt) => isActuallyApproved(receipt) && !isParsed(receipt)
      ).length,
      rejected: activeQueue.filter((receipt) => isRejected(receipt)).length,
      parsed: activeQueue.filter((receipt) => isParsed(receipt)).length,
      error: activeQueue.filter((receipt) => isError(receipt)).length,
      archived: receiptList.filter((receipt) => isArchived(receipt)).length,
    };
  }

  function notifyReceiptWorkflowUpdated() {
    window.dispatchEvent(new Event("kitchenpulse:receipts-updated"));
    window.dispatchEvent(new Event("kitchenpulse:receipt-lines-updated"));
  }

  async function loadReceipts({ quiet = false } = {}) {
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
      const response = await fetch(RECEIPT_REVIEW_API, {
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
        console.error("Receipt review returned non-JSON response:", text);
        throw new Error("Receipt review returned a non-JSON response.");
      }

      if (!response.ok || !data?.ok) {
        console.error("Receipt review API error:", data);
        throw new Error(data?.error || "Could not load receipt queue.");
      }

      const nextReceipts = Array.isArray(data.receipts) ? data.receipts : [];
      const reviewQueue = getReviewQueue(nextReceipts, queueMode);

      setReceipts(reviewQueue);
      setCounts(buildLocalCounts(nextReceipts));
    } catch (requestError) {
      console.error("Receipt queue request failed:", requestError);
      setReceipts([]);
      setCounts({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        parsed: 0,
        error: 0,
        archived: 0,
      });
      setError(
        requestError?.message ||
          "Receipt queue could not be loaded. Refresh this section or check Airtable."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  async function submitReviewAction(receipt, action) {
    const note = notesById[receipt.id] || "";

    setBusyId(receipt.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(RECEIPT_REVIEW_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          recordId: receipt.id,
          action,
          reviewerNote: note,
        }),
      });

      const text = await response.text();

      let data = null;

      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("Receipt review action returned non-JSON:", text);
        throw new Error("Receipt review action returned a non-JSON response.");
      }

      if (!response.ok || !data?.ok) {
        console.error("Receipt review action failed:", data);
        throw new Error(data?.error || "Could not update receipt review.");
      }

      setMessage(data.message || "Receipt review updated.");

      setNotesById((current) => ({
        ...current,
        [receipt.id]: "",
      }));

      notifyReceiptWorkflowUpdated();
      await loadReceipts({ quiet: true });
    } catch (requestError) {
      console.error("Receipt review update failed:", requestError);
      setError(
        requestError?.message ||
          "Could not update this receipt. Try again or check Airtable."
      );
    } finally {
      setBusyId("");
    }
  }

  async function submitApproveAndParseAction(receipt) {
    const note = notesById[receipt.id] || "";

    setBusyId(receipt.id);
    setError("");
    setMessage("");

    setParseNoticeById((current) => ({
      ...current,
      [receipt.id]: "Approving receipt...",
    }));

    try {
      const reviewResponse = await fetch(RECEIPT_REVIEW_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          recordId: receipt.id,
          action: "approve",
          reviewerNote: note,
        }),
      });

      const reviewText = await reviewResponse.text();

      let reviewData = null;

      try {
        reviewData = JSON.parse(reviewText);
      } catch (parseError) {
        console.error("Approve before parse returned non-JSON:", reviewText);
        throw new Error("Receipt approval returned a non-JSON response.");
      }

      if (!reviewResponse.ok || !reviewData?.ok) {
        console.error("Approve before parse failed:", reviewData);
        throw new Error(reviewData?.error || "Could not approve this receipt.");
      }

      setNotesById((current) => ({
        ...current,
        [receipt.id]: "",
      }));

      setParseNoticeById((current) => ({
        ...current,
        [receipt.id]: "Approved. Checking image before parsing...",
      }));

      const parseResponse = await fetch(RECEIPT_PARSE_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          recordId: receipt.id,
        }),
      });

      const parseText = await parseResponse.text();

      let parseData = null;

      try {
        parseData = JSON.parse(parseText);
      } catch (parseError) {
        console.error("Approve and parse returned non-JSON:", parseText);
        throw new Error("Receipt parsing returned a non-JSON response.");
      }

      if (!parseResponse.ok || !parseData?.ok) {
        if (isImagePreflightBlock(parseData)) {
          setMessage("");

          setParseNoticeById((current) => ({
            ...current,
            [receipt.id]: {
              tone: "warning",
              text: imagePreflightMessage(parseData),
            },
          }));

          notifyReceiptWorkflowUpdated();
          await loadReceipts({ quiet: true });
          return;
        }

        if (parseData?.existingLineCount) {
          setMessage("Receipt approved. Existing parsed lines found.");

          setParseNoticeById((current) => ({
            ...current,
            [receipt.id]: `Already parsed: ${parseData.existingLineCount} line record${
              parseData.existingLineCount === 1 ? "" : "s"
            }.`,
          }));

          notifyReceiptWorkflowUpdated();
          await loadReceipts({ quiet: true });
          return;
        }

        throw new Error(
          parseData?.error ||
            "Receipt was approved, but parsing failed. Use Parse receipt to try again."
        );
      }

      setMessage(
        `Receipt approved and parsed. ${parseData.lineCount || 0} line record${
          parseData.lineCount === 1 ? "" : "s"
        } created.`
      );

      setParseNoticeById((current) => ({
        ...current,
        [receipt.id]: {
          tone: "success",
          text: `Parsed successfully: ${parseData.lineCount || 0} line record${
            parseData.lineCount === 1 ? "" : "s"
          } created.`,
        },
      }));

      notifyReceiptWorkflowUpdated();
      await loadReceipts({ quiet: true });
    } catch (requestError) {
      console.error("Approve and parse failed:", requestError);

      if (isImagePreflightBlock(requestError)) {
        setParseNoticeById((current) => ({
          ...current,
          [receipt.id]: {
            tone: "warning",
            text: imagePreflightMessage(requestError),
          },
        }));
      } else {
        setError(
          requestError?.message ||
            "Could not approve and parse this receipt. Try again or check Airtable."
        );
      }

      await loadReceipts({ quiet: true });
    } finally {
      setBusyId("");
    }
  }

  async function submitParseAction(receipt) {
    if (!isActuallyApproved(receipt)) {
      setParseNoticeById((current) => ({
        ...current,
        [receipt.id]:
          "Receipt must be approved before parsing. Approve it in Receipt Review first.",
      }));
      return;
    }

    setBusyId(receipt.id);
    setError("");
    setMessage("");

    setParseNoticeById((current) => ({
      ...current,
      [receipt.id]: "Checking image before parsing...",
    }));

    try {
      const response = await fetch(RECEIPT_PARSE_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          recordId: receipt.id,
        }),
      });

      const text = await response.text();

      let data = null;

      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("Receipt parse returned non-JSON:", text);
        throw new Error("Receipt parse returned a non-JSON response.");
      }

      if (!response.ok || !data?.ok) {
        if (isImagePreflightBlock(data)) {
          setParseNoticeById((current) => ({
            ...current,
            [receipt.id]: {
              tone: "warning",
              text: imagePreflightMessage(data),
            },
          }));

          notifyReceiptWorkflowUpdated();
          await loadReceipts({ quiet: true });
          return;
        }

        if (data?.existingLineCount) {
          setParseNoticeById((current) => ({
            ...current,
            [receipt.id]: `Already parsed: ${data.existingLineCount} line record${
              data.existingLineCount === 1 ? "" : "s"
            }.`,
          }));

          notifyReceiptWorkflowUpdated();
          await loadReceipts({ quiet: true });
          return;
        }

        throw new Error(data?.error || "Could not parse this receipt.");
      }

      setParseNoticeById((current) => ({
        ...current,
        [receipt.id]: {
          tone: "success",
          text: `Parsed successfully: ${data.lineCount || 0} line record${
            data.lineCount === 1 ? "" : "s"
          } created.`,
        },
      }));

      notifyReceiptWorkflowUpdated();
      await loadReceipts({ quiet: true });
    } catch (requestError) {
      console.error("Receipt parse update failed:", requestError);

      setParseNoticeById((current) => ({
        ...current,
        [receipt.id]: {
          tone: isImagePreflightBlock(requestError) ? "warning" : "error",
          text: isImagePreflightBlock(requestError)
            ? imagePreflightMessage(requestError)
            : requestError?.message ||
              "Could not parse this receipt. Check the receipt file or try again.",
        },
      }));
    } finally {
      setBusyId("");
    }
  }

  useEffect(() => {
    loadReceipts();

    const handleReceiptsUpdated = () => {
      loadReceipts({ quiet: true });
    };

    const handleFocus = () => {
      loadReceipts({ quiet: true });
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadReceipts({ quiet: true });
      }
    };

    window.addEventListener(
      "kitchenpulse:receipts-updated",
      handleReceiptsUpdated
    );
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener(
        "kitchenpulse:receipts-updated",
        handleReceiptsUpdated
      );
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [queueMode]);

  const sortedReceipts = useMemo(() => {
    const rankReceipt = (receipt) => {
      if (hasApprovalMismatch(receipt)) return 1;
      if (isError(receipt)) return 2;
      if (!isActuallyApproved(receipt) && !isRejected(receipt)) return 3;
      if (isActuallyApproved(receipt) && !isParsed(receipt)) return 4;
      if (isParsed(receipt)) return 5;
      if (isRejected(receipt)) return 6;
      return 99;
    };

    return [...receipts].sort((a, b) => {
      const rankDiff = rankReceipt(a) - rankReceipt(b);

      if (rankDiff !== 0) return rankDiff;

      const aTime = new Date(a.createdTime || 0).getTime();
      const bTime = new Date(b.createdTime || 0).getTime();

      return bTime - aTime;
    });
  }, [receipts]);

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
                    Receipt Review
                  </div>

                  <StatusPill tone="pending" icon={FileText}>
                    Receipt review
                  </StatusPill>

                  <StatusPill tone="approved" icon={ShieldCheck}>
                    Approval required
                  </StatusPill>
                </div>

                <h2 className="text-2xl font-heading font-semibold tracking-tight">
                  Receipt Queue
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Track uploaded receipts, review details, and manage approval status before KitchenPulse extracts cost data.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div
                  className="inline-flex rounded-full border p-1 shadow-sm"
                  style={{
                    background:
                      "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
                    borderColor: "rgba(15,23,42,0.08)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setQueueMode("active")}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      queueMode === "active"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white/80"
                    }`}
                  >
                    Active queue
                  </button>

                  <button
                    type="button"
                    onClick={() => setQueueMode("archived")}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      queueMode === "archived"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white/80"
                    }`}
                  >
                    Archived ({counts.archived})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => loadReceipts({ quiet: true })}
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
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-6">
              <CountCard label="Total" value={counts.total} tone="neutral" />
              <CountCard label="Pending" value={counts.pending} tone="pending" />
              <CountCard label="Approved" value={counts.approved} tone="approved" />
              <CountCard label="Parsed" value={counts.parsed} tone="parsed" />
              <CountCard label="Rejected" value={counts.rejected} tone="rejected" />
              <CountCard label="Errors" value={counts.error} tone="error" />
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
                  Loading receipt queue
                </div>

                <div className="mt-2 text-sm text-muted-foreground">
                  Checking staged receipts now.
                </div>
              </div>
            ) : sortedReceipts.length === 0 ? (
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
                  <ShieldCheck className="h-7 w-7" />
                </div>

                <div className="mt-4 text-lg font-semibold">
                  {queueMode === "archived" ? "No archived receipts" : "No receipts in the queue"}
                </div>

                <div className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                  {queueMode === "archived"
                    ? "Archived receipts will appear here after they are moved out of the active queue."
                    : "New staged receipts will appear here after upload."}
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {sortedReceipts.map((receipt) => {
                  const statusLabel = getStatusLabel(receipt);
                  const statusTone = getStatusTone(receipt);
                  const statusStyle = toneStyles(statusTone);
                  const vendor = receipt.vendor || "Vendor not entered";
                  const receiptDate = formatReceiptDate(receipt.receiptDate);
                  const uploadedAt = formatUploadedAt(receipt.createdTime);
                  const fileName = receipt.fileName || "Uploaded file";
                  const isBusy = busyId === receipt.id;
                  const mismatch = hasApprovalMismatch(receipt);

                  return (
                    <div
                      key={receipt.id}
                      className="relative overflow-hidden rounded-3xl border p-5 shadow-sm"
                      style={{
                        background: mismatch
                          ? "linear-gradient(145deg, rgba(254,242,242,0.78), rgba(255,255,255,0.92))"
                          : "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))",
                        borderColor: mismatch
                          ? "rgba(254,202,202,0.90)"
                          : "rgba(15,23,42,0.08)",
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
                              {receipt.receiptName || "Receipt upload"}
                            </div>

                            <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
                          </div>

                          <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-slate-500" />
                              <span>{fileName}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Clock3 className="h-4 w-4 text-slate-500" />
                              <span>Uploaded {uploadedAt}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-teal-700" />
                              <span>{vendor}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-slate-500" />
                              <span>Receipt date: {receiptDate}</span>
                            </div>
                          </div>

                          {mismatch && (
                            <div className="mt-4">
                              <Notice tone="error" icon={AlertCircle}>
                                Status says Approved, but the approval checkbox is not set. Approve again before parsing.
                              </Notice>
                            </div>
                          )}

                          {isError(receipt) && (
                            <div className="mt-4">
                              <Notice tone="error" icon={AlertCircle}>
                                This receipt is in Error status. Return it to review, then approve and parse again.
                              </Notice>
                            </div>
                          )}

                          {parseNoticeById[receipt.id] && (
                            <div className="mt-4">
                              <Notice
                                tone={getParseNoticeTone(parseNoticeById[receipt.id])}
                                icon={Info}
                              >
                                {getParseNoticeText(parseNoticeById[receipt.id])}
                              </Notice>
                            </div>
                          )}

                          {!isActuallyApproved(receipt) && !isParsed(receipt) && (
                            <div className="mt-4">
                              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Review note optional
                              </label>
                              <input
                                value={notesById[receipt.id] || ""}
                                onChange={(event) =>
                                  setNotesById((current) => ({
                                    ...current,
                                    [receipt.id]: event.target.value,
                                  }))
                                }
                                placeholder="Example: Approved after visual check, or reject reason"
                                className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
                              />
                            </div>
                          )}

                          {isParsed(receipt) && (
                            <div className="mt-4">
                              <Notice tone="parsed" icon={Info}>
                                Receipt has been parsed. Continue in Parsed Line Review below.
                              </Notice>
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col gap-2 md:min-w-[190px]">
                          {receipt.fileUrl && (
                            <ActionButton
                              href={receipt.fileUrl}
                              tone="dark"
                              icon={ExternalLink}
                            >
                              View file
                            </ActionButton>
                          )}

                          {canApprove(receipt) && (
                            <ActionButton
                              tone="success"
                              icon={CheckCircle2}
                              onClick={() => submitApproveAndParseAction(receipt)}
                              disabled={isBusy}
                            >
                              {isBusy ? "Checking & parsing..." : "Approve & parse"}
                            </ActionButton>
                          )}

                          {canReject(receipt) && (
                            <ActionButton
                              tone="danger"
                              icon={XCircle}
                              onClick={() => submitReviewAction(receipt, "reject")}
                              disabled={isBusy}
                            >
                              Reject
                            </ActionButton>
                          )}

                          {canParse(receipt) && (
                            <ActionButton
                              tone="parse"
                              icon={FileText}
                              onClick={() => submitParseAction(receipt)}
                              disabled={isBusy}
                            >
                              {isBusy ? "Parsing..." : "Parse receipt"}
                            </ActionButton>
                          )}

                          {canReturnToReview(receipt) && (
                            <ActionButton
                              tone="soft"
                              icon={RotateCcw}
                              onClick={() =>
                                submitReviewAction(receipt, "needs_review")
                              }
                              disabled={isBusy}
                            >
                              Return to review
                            </ActionButton>
                          )}

                          {canArchive(receipt) && (
                            <ActionButton
                              tone="soft"
                              icon={FileText}
                              onClick={() => submitReviewAction(receipt, "archive")}
                              disabled={isBusy}
                            >
                              Archive receipt
                            </ActionButton>
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
