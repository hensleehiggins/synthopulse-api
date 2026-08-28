import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit3,
  Eye,
  Loader2,
  PackageCheck,
  PackagePlus,
  PackageSearch,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Truck,
  X,
} from "lucide-react";

const API_BASE = "https://project-1csz2.vercel.app";
const ORDER_INTELLIGENCE_API = `${API_BASE}/api/order-intelligence`;
const ORDER_RULE_SETUP_API = `${API_BASE}/api/order-rule-setup`;

function numberOrDash(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "-";

  if (Array.isArray(value)) {
    return numberOrDash(value[0], suffix);
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "-";

  const formatted = Number.isInteger(numberValue)
    ? numberValue.toLocaleString("en-US")
    : numberValue.toLocaleString("en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });

  return `${formatted}${suffix}`;
}

function money(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "-";

  return numberValue.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateText(value) {
  if (!value) return "-";

  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function seenText(item) {
  const daysAgo = Number(item?.receipt?.lastSeenDaysAgo);

  if (Number.isFinite(daysAgo)) {
    if (daysAgo === 0) return "Seen today";
    if (daysAgo === 1) return "Seen yesterday";
    return `${daysAgo} days ago`;
  }

  if (item?.receipt?.lastSeenDate) {
    return dateText(item.receipt.lastSeenDate);
  }

  return "No receipt signal";
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toneStyles(tone = "neutral") {
  if (tone === "critical") {
    return {
      color: "#B45309",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.16)",
      glow: "rgba(245,158,11,0.055)",
      icon: AlertTriangle,
    };
  }

  if (tone === "order_soon") {
    return {
      color: "#0891B2",
      bg: "rgba(34,211,238,0.09)",
      border: "rgba(34,211,238,0.16)",
      glow: "rgba(34,211,238,0.055)",
      icon: Truck,
    };
  }

  if (tone === "watch") {
    return {
      color: "#D97706",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.15)",
      glow: "rgba(245,158,11,0.045)",
      icon: Eye,
    };
  }

  if (tone === "stable") {
    return {
      color: "#0F766E",
      bg: "rgba(20,184,166,0.08)",
      border: "rgba(20,184,166,0.15)",
      glow: "rgba(20,184,166,0.05)",
      icon: CheckCircle2,
    };
  }

  if (tone === "needs_count") {
    return {
      color: "#7C3AED",
      bg: "rgba(124,58,237,0.08)",
      border: "rgba(124,58,237,0.15)",
      glow: "rgba(124,58,237,0.045)",
      icon: PackageSearch,
    };
  }

  if (tone === "needs_setup") {
    return {
      color: "#64748B",
      bg: "rgba(100,116,139,0.07)",
      border: "rgba(100,116,139,0.13)",
      glow: "rgba(100,116,139,0.04)",
      icon: ClipboardList,
    };
  }

  if (tone === "count_seed") {
    return {
      color: "#6D28D9",
      bg: "rgba(124,58,237,0.08)",
      border: "rgba(124,58,237,0.16)",
      glow: "rgba(124,58,237,0.045)",
      icon: PackagePlus,
    };
  }

  if (tone === "receipt") {
    return {
      color: "#0891B2",
      bg: "rgba(34,211,238,0.08)",
      border: "rgba(34,211,238,0.14)",
      glow: "rgba(34,211,238,0.045)",
      icon: ClipboardList,
    };
  }

  if (tone === "approval") {
    return {
      color: "#4F46E5",
      bg: "rgba(99,102,241,0.09)",
      border: "rgba(99,102,241,0.17)",
      glow: "rgba(99,102,241,0.05)",
      icon: ShieldCheck,
    };
  }

  return {
    color: "#475569",
    bg: "rgba(100,116,139,0.07)",
    border: "rgba(100,116,139,0.13)",
    glow: "rgba(100,116,139,0.04)",
    icon: ClipboardList,
  };
}

function statusTone(item) {
  return normalizeStatus(item?.status || "neutral");
}

function statusLabel(item) {
  return item?.statusLabel || "Unknown";
}

function recommendationTone(item) {
  const type = String(item?.recommendationType || "").toLowerCase();

  if (type.includes("critical")) return "critical";
  if (type.includes("pressure")) return "order_soon";
  if (type.includes("normal")) return "stable";
  if (type.includes("count")) return "count_seed";
  if (type.includes("setup") || type.includes("seed")) return "needs_setup";

  return statusTone(item);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b))
  );
}

function uniquePreserveOrder(values) {
  return [...new Set(values.filter(Boolean))];
}

function getVendor(item) {
  return item?.receipt?.vendor || item?.orderRules?.preferredVendor || "No vendor yet";
}

function getCategory(item) {
  return item?.receipt?.category || "Uncategorized";
}

function getCostText(item) {
  const receipt = item?.receipt || {};

  if (receipt.unitCost !== null && receipt.unitCost !== undefined) {
    return money(receipt.unitCost);
  }

  if (receipt.lineTotal !== null && receipt.lineTotal !== undefined) {
    return money(receipt.lineTotal);
  }

  return "-";
}

function getUnitText(item) {
  const receipt = item?.receipt || {};
  const orderRules = item?.orderRules || {};
  const parts = [];

  if (receipt.unit) parts.push(receipt.unit);
  if (receipt.packageSize) parts.push(receipt.packageSize);

  if (!parts.length && orderRules.vendorOrderUnit) parts.push(orderRules.vendorOrderUnit);
  if (!parts.length && orderRules.countUnit) parts.push(orderRules.countUnit);

  return parts.join(" / ") || "-";
}

function confidenceTone(confidence) {
  const value = String(confidence || "").toLowerCase();

  if (value.includes("high")) return "stable";
  if (value.includes("medium")) return "order_soon";
  if (value.includes("low")) return "watch";

  return "needs_setup";
}

function getOwnerRead(payload, loading, error) {
  if (loading) return "Loading live reorder pressure from current PAR and receipt-backed item data.";
  if (error) return "Order Intelligence is blocked from loading. Check the order-intelligence API route before trusting this section.";

  return (
    payload?.ownerRead ||
    "Order Intelligence is waiting for enough item data to make useful reorder calls."
  );
}

function isSeedItem(item) {
  const type = String(item?.recommendationType || "").toLowerCase();
  const id = String(item?.id || "");

  return (
    type.includes("count seed") ||
    type.includes("receipt seed") ||
    id.startsWith("stock-count-") ||
    id.startsWith("receipt-")
  );
}

function isEditableOrderRule(item) {
  const id = String(item?.id || "");
  return /^rec[A-Za-z0-9]{14}$/.test(id) && !isSeedItem(item);
}

function canCreateOrderRule(item) {
  return isSeedItem(item);
}

function canEditOrderRule(item) {
  return isEditableOrderRule(item);
}

function getSetupSourceType(item) {
  const type = String(item?.recommendationType || "").toLowerCase();
  const id = String(item?.id || "");

  if (type.includes("count seed") || id.startsWith("stock-count-")) {
    return "count_seed";
  }

  if (type.includes("receipt seed") || id.startsWith("receipt-")) {
    return "receipt_seed";
  }

  if (isEditableOrderRule(item)) {
    return "par_row";
  }

  return "manual";
}

function textValue(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function buildInitialSetupForm(item) {
  const mode = canEditOrderRule(item) ? "edit" : "create";
  const sourceType = getSetupSourceType(item);
  const orderRules = item?.orderRules || {};
  const stockCount = item?.stockCount || {};
  const receipt = item?.receipt || {};

  return {
    mode,
    recordId: mode === "edit" ? item?.id || "" : "",
    sourceType,
    sourceItemId: item?.id || "",
    sourceRecordId: stockCount?.id || receipt?.id || item?.id || "",
    itemName: item?.itemName || "",
    currentStock: textValue(item?.currentStock),
    countUnit: stockCount?.unit || orderRules.countUnit || receipt.unit || "",
    storageArea: stockCount?.storageArea || orderRules.storageArea || "",
    targetStock: textValue(item?.parTarget),
    reorderPoint: textValue(item?.reorderPoint),
    estimatedDailyUsage: textValue(item?.estimatedDailyUsage),
    preferredVendor: receipt.vendor || orderRules.preferredVendor || "",
    vendorItemName: orderRules.vendorItemName || receipt.itemName || item?.itemName || "",
    orderVendorSku: orderRules.orderVendorSku || "",
    vendorOrderUnit: orderRules.vendorOrderUnit || receipt.unit || "",
    packSize: orderRules.packSize || receipt.packageSize || "",
    unitConversionNotes: orderRules.unitConversionNotes || "",
    notes: "",
    criticalItem: Boolean(orderRules.criticalItem),
    emergencyRunRisk: Boolean(orderRules.emergencyRunRisk),
    eventSensitive: Boolean(orderRules.eventSensitive),
  };
}

function getLastCountText(item) {
  if (item?.stockCount?.countTimeText) return item.stockCount.countTimeText;

  if (item?.lastChecked) {
    const formatted = dateText(item.lastChecked);
    return formatted === "-" ? item.lastChecked : formatted;
  }

  return "No count";
}

function getMatchNote(item) {
  return item?.stockCountMatchNotes || item?.receiptMatchNotes || "";
}

function getVisibleSignals(item) {
  return Array.isArray(item?.signals) ? item.signals.slice(0, 4) : [];
}

function getExtraSignalCount(item) {
  const signals = Array.isArray(item?.signals) ? item.signals : [];
  return Math.max(0, signals.length - 4);
}

function vendorTone(item) {
  const vendor = getVendor(item).toLowerCase();
  if (vendor.includes("no vendor")) return "needs_setup";
  if (item?.receipt) return "receipt";
  return "approval";
}

function hasNumber(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function isNoVendor(item) {
  return getVendor(item).toLowerCase().includes("no vendor");
}

function getSetupIssues(item) {
  const issues = [];
  const orderRules = item?.orderRules || {};
  const receipt = item?.receipt || {};
  const stockCount = item?.stockCount || {};

  if (canCreateOrderRule(item)) {
    issues.push("Create order rule");
  }

  if (!hasNumber(item?.parTarget)) {
    issues.push("Target stock");
  }

  if (!hasNumber(item?.reorderPoint)) {
    issues.push("Reorder point");
  }

  if (!hasText(orderRules.countUnit) && !hasText(stockCount.unit) && !hasText(receipt.unit)) {
    issues.push("Count unit");
  }

  if (isNoVendor(item)) {
    issues.push("Vendor");
  }

  if (!hasText(orderRules.vendorOrderUnit) && !hasText(receipt.unit)) {
    issues.push("Order unit");
  }

  if (!hasText(orderRules.packSize) && !hasText(receipt.packageSize)) {
    issues.push("Pack size");
  }

  if (!hasText(orderRules.unitConversionNotes) && !hasText(orderRules.packSize) && !hasText(receipt.packageSize)) {
    issues.push("Conversion note");
  }

  return uniquePreserveOrder(issues);
}

function setupPriorityScore(item) {
  const issues = getSetupIssues(item);
  let score = issues.length * 10;

  if (canCreateOrderRule(item)) score += 100;
  if (String(item?.recommendationType || "").toLowerCase().includes("count seed")) score += 25;
  if (String(item?.recommendationType || "").toLowerCase().includes("receipt seed")) score += 18;
  if (!hasNumber(item?.parTarget)) score += 16;
  if (!hasNumber(item?.reorderPoint)) score += 16;
  if (isNoVendor(item)) score += 8;
  if (item?.receipt) score += 4;
  if (item?.stockCount) score += 6;

  return score;
}

function getSetupQueueLabel(item) {
  const type = String(item?.recommendationType || "").toLowerCase();
  const id = String(item?.id || "");

  if (type.includes("count seed") || id.startsWith("stock-count-")) {
    return "Count seed";
  }

  if (type.includes("receipt seed") || id.startsWith("receipt-")) {
    return "Receipt seed";
  }

  if (!hasNumber(item?.parTarget) || !hasNumber(item?.reorderPoint)) {
    return "Rule math";
  }

  if (isNoVendor(item)) {
    return "Vendor gap";
  }

  return "Setup gap";
}

function getSetupQueueNote(item) {
  const label = getSetupQueueLabel(item);

  if (label === "Count seed") {
    return "Approved count exists, but it needs a real order rule before reorder math is trusted.";
  }

  if (label === "Receipt seed") {
    return "Vendor receipt context exists, but target stock and reorder rules still need setup.";
  }

  if (label === "Rule math") {
    return "Existing rule needs target stock and reorder point filled in.";
  }

  if (label === "Vendor gap") {
    return "Stock rule exists, but vendor/order-unit context is incomplete.";
  }

  return "Setup information is incomplete.";
}

export default function OrderIntelligenceBoard() {
  const [payload, setPayload] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [error, setError] = useState("");
  const [setupError, setSetupError] = useState("");
  const [setupSuccess, setSetupSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [signalFilter, setSignalFilter] = useState("");
const [setupItem, setSetupItem] = useState(null);
const [setupForm, setSetupForm] = useState(null);
const [showAllSetupGaps, setShowAllSetupGaps] = useState(false);
const lastReturnRefreshAt = useRef(0);

async function loadBoard({ quiet = false } = {}) {
  try {
    if (!quiet) {
      setLoading(true);
    }

    setError("");

      const response = await fetch(`${ORDER_INTELLIGENCE_API}?t=${Date.now()}`);
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Order Intelligence could not be loaded.");
      }

      setPayload(data);
      setItems(Array.isArray(data.items) ? data.items : []);
} catch (err) {
  if (!quiet) {
    setError(err?.message || "Order Intelligence could not be loaded.");
    setPayload(null);
    setItems([]);
  } else {
    console.warn("Quiet Order Intelligence refresh failed:", err);
  }
} finally {
  if (!quiet) {
    setLoading(false);
  }
}
  }

  function openSetupModal(item) {
    setSetupItem(item);
    setSetupForm(buildInitialSetupForm(item));
    setSetupError("");
    setSetupSuccess("");
  }

  function closeSetupModal() {
    if (isSavingRule) return;

    setSetupItem(null);
    setSetupForm(null);
    setSetupError("");
  }

  function updateSetupField(field, value) {
    setSetupForm((current) => ({
      ...(current || {}),
      [field]: value,
    }));
  }

  async function submitOrderRule(event) {
    event.preventDefault();

    if (!setupForm?.itemName) {
      setSetupError("Item name is required.");
      return;
    }

    if (!setupForm?.targetStock) {
      setSetupError("Target stock is required for setup.");
      return;
    }

    if (!setupForm?.reorderPoint) {
      setSetupError("Reorder point is required for setup.");
      return;
    }

    if (setupForm.mode === "edit" && !setupForm.recordId) {
      setSetupError("Order rule record id is missing.");
      return;
    }

    setIsSavingRule(true);
    setSetupError("");
    setSetupSuccess("");

    try {
      const method = setupForm.mode === "edit" ? "PATCH" : "POST";

      const response = await fetch(ORDER_RULE_SETUP_API, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordId: setupForm.recordId,
          sourceType: setupForm.sourceType,
          sourceItemId: setupForm.sourceItemId,
          sourceRecordId: setupForm.sourceRecordId,
          itemName: setupForm.itemName,
          currentStock: setupForm.currentStock,
          countUnit: setupForm.countUnit,
          storageArea: setupForm.storageArea,
          targetStock: setupForm.targetStock,
          reorderPoint: setupForm.reorderPoint,
          estimatedDailyUsage: setupForm.estimatedDailyUsage,
          preferredVendor: setupForm.preferredVendor,
          vendorItemName: setupForm.vendorItemName,
          orderVendorSku: setupForm.orderVendorSku,
          vendorOrderUnit: setupForm.vendorOrderUnit,
          packSize: setupForm.packSize,
          unitConversionNotes: setupForm.unitConversionNotes,
          notes: setupForm.notes,
          criticalItem: setupForm.criticalItem,
          emergencyRunRisk: setupForm.emergencyRunRisk,
          eventSensitive: setupForm.eventSensitive,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Order rule could not be saved.");
      }

      setSetupSuccess(
      setupForm.mode === "edit"
    ? "Order rule updated. Refreshing board..."
    : "Order rule created. Refreshing board..."
);

setShowAllSetupGaps(false);
await loadBoard({ quiet: true });

      window.setTimeout(() => {
        setSetupItem(null);
        setSetupForm(null);
        setSetupSuccess("");
      }, 700);
    } catch (saveError) {
      setSetupError(
        saveError instanceof Error ? saveError.message : "Order rule could not be saved."
      );
    } finally {
      setIsSavingRule(false);
    }
  }

  useEffect(() => {
    loadBoard();
  }, []);
  useEffect(() => {
  function refreshWhenReturning() {
    if (document.visibilityState === "hidden") return;

    const now = Date.now();

    if (now - lastReturnRefreshAt.current < 5000) return;

    lastReturnRefreshAt.current = now;
    loadBoard({ quiet: true });
  }

  window.addEventListener("focus", refreshWhenReturning);
  document.addEventListener("visibilitychange", refreshWhenReturning);

  return () => {
    window.removeEventListener("focus", refreshWhenReturning);
    document.removeEventListener("visibilitychange", refreshWhenReturning);
  };
}, []);

  const counts = payload?.counts || {};

  const vendors = useMemo(
    () => uniqueSorted(items.map((item) => getVendor(item))),
    [items]
  );

  const signalOptions = useMemo(
    () => uniqueSorted(items.flatMap((item) => item.signals || [])),
    [items]
  );

  const setupQueueRows = useMemo(() => {
    return items
      .map((item) => ({
        item,
        issues: getSetupIssues(item),
        score: setupPriorityScore(item),
      }))
      .filter((row) => row.issues.length > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return String(a.item.itemName || "").localeCompare(String(b.item.itemName || ""));
      });
  }, [items]);

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return items
      .filter((item) => {
        if (statusFilter && normalizeStatus(item.status) !== statusFilter) return false;
        if (vendorFilter && getVendor(item) !== vendorFilter) return false;
        if (signalFilter && !(item.signals || []).includes(signalFilter)) return false;

        if (!needle) return true;

        const haystack = [
          item.itemName,
          item.statusLabel,
          item.recommendationType,
          getVendor(item),
          getCategory(item),
          getUnitText(item),
          item.reason,
          item.stockCountMatchNotes,
          item.receiptMatchNotes,
          ...(item.signals || []),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(needle);
      })
      .sort((a, b) => {
        const priorityDiff = Number(b.priority || 0) - Number(a.priority || 0);
        if (priorityDiff !== 0) return priorityDiff;

        return String(a.itemName || "").localeCompare(String(b.itemName || ""));
      });
  }, [items, search, statusFilter, vendorFilter, signalFilter]);

  const ownerRead = getOwnerRead(payload, loading, error);

  return (
    <div className="container py-4">
      <div className="content mx-auto max-w-7xl">
        <section
          className="relative overflow-hidden rounded-3xl border p-4 shadow-xl md:p-5"
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
            style={{ background: "rgba(34,211,238,0.10)" }}
          />

          <div className="relative z-10">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
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
                  Live reorder pressure
                </div>

                <h2 className="text-2xl font-heading font-semibold tracking-tight">
                  Order Intelligence Board
                </h2>

                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  Live reorder guidance from PAR records, approved receipt lines, vendor
                  context, demand signals, and approved stock counts. Create or edit order
                  rules directly from the board.
                </p>
              </div>

              <button
                type="button"
                onClick={loadBoard}
                className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-sm transition hover:bg-white"
                style={{
                  color: "#334155",
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
                  borderColor: "rgba(15,23,42,0.08)",
                }}
              >
                <RefreshCw className={`h-3.5 w-3.5 text-cyan-700 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard label="Critical" value={counts.criticalItems ?? "-"} note="At or below reorder pressure" tone="critical" icon={AlertTriangle} />
              <MetricCard label="Order soon" value={counts.orderSoonItems ?? "-"} note="Below target but not yet critical" tone="order_soon" icon={Truck} />
              <MetricCard label="Count seeds" value={counts.stockCountSeedItems ?? "-"} note="Approved counts needing rules" tone="count_seed" icon={PackagePlus} />
              <MetricCard label="Receipt-backed items" value={counts.receiptBackedItems ?? "-"} note="Unique items with approved vendor context" tone="receipt" icon={ClipboardList} />
              <MetricCard label="Needs setup" value={counts.needsSetupItems ?? "-"} note="Items missing order rules" tone="needs_setup" icon={PackageSearch} />
            </div>

            <div
              className="mb-3 rounded-2xl border px-4 py-3 text-sm leading-relaxed text-muted-foreground shadow-sm"
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

            {setupSuccess && (
              <div
                className="mb-3 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm leading-relaxed"
                style={{
                  color: "#047857",
                  background: "rgba(16,185,129,0.09)",
                  borderColor: "rgba(16,185,129,0.18)",
                }}
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{setupSuccess}</div>
              </div>
            )}

            {!loading && !error && (
              <SetupQueuePanel
  rows={setupQueueRows}
  showAll={showAllSetupGaps}
  onToggleShowAll={() => setShowAllSetupGaps((current) => !current)}
  onAction={openSetupModal}
/>
            )}

            <div className="mb-3 grid grid-cols-1 gap-2 lg:grid-cols-[1.25fr_0.7fr_0.7fr_0.7fr]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search item, vendor, signal, reason, or category..."
                  className="h-10 w-full rounded-2xl border bg-white/80 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-200"
                  style={{ borderColor: "rgba(15,23,42,0.10)" }}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 rounded-2xl border bg-white/80 px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-2 focus:ring-cyan-200"
                style={{ borderColor: "rgba(15,23,42,0.10)" }}
              >
                <option value="">All statuses</option>
                <option value="critical">Critical</option>
                <option value="order_soon">Order soon</option>
                <option value="watch">Watch</option>
                <option value="needs_count">Needs count</option>
                <option value="needs_setup">Needs setup</option>
                <option value="stable">Stable</option>
              </select>

              <select
                value={vendorFilter}
                onChange={(event) => setVendorFilter(event.target.value)}
                className="h-10 rounded-2xl border bg-white/80 px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-2 focus:ring-cyan-200"
                style={{ borderColor: "rgba(15,23,42,0.10)" }}
              >
                <option value="">All vendors</option>
                {vendors.map((vendor) => (
                  <option key={vendor} value={vendor}>{vendor}</option>
                ))}
              </select>

              <select
                value={signalFilter}
                onChange={(event) => setSignalFilter(event.target.value)}
                className="h-10 rounded-2xl border bg-white/80 px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-2 focus:ring-cyan-200"
                style={{ borderColor: "rgba(15,23,42,0.10)" }}
              >
                <option value="">All signals</option>
                {signalOptions.map((signal) => (
                  <option key={signal} value={signal}>{signal}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <StateBox text="Loading Order Intelligence..." icon={RefreshCw} spin />
            ) : error ? (
              <StateBox tone="error" text={error} icon={AlertTriangle} />
            ) : filteredItems.length === 0 ? (
              <StateBox text="No matching order intelligence items found." icon={PackageSearch} />
            ) : (
              <div className="space-y-2.5">
                {filteredItems.map((item) => (
                  <OrderItemCard
                    key={item.id}
                    item={item}
                    onAction={() => openSetupModal(item)}
                  />
                ))}
              </div>
            )}

            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <DataQualityCard label="PAR rows" value={counts.totalParRows ?? "-"} note={`${counts.blankParRows ?? "-"} blank or incomplete rows detected`} tone="needs_setup" />
              <DataQualityCard label="Approved receipt lines" value={counts.approvedReceiptLines ?? "-"} note="Used as vendor/package/cost context" tone="receipt" />
              <DataQualityCard label="Approved counts" value={counts.approvedStockCountLines ?? "-"} note={`${counts.stockCountSeedItems ?? "-"} waiting for order rules`} tone="count_seed" />
            </div>
          </div>
        </section>
      </div>

      {setupItem && setupForm && (
        <OrderRuleSetupModal
          item={setupItem}
          form={setupForm}
          error={setupError}
          success={setupSuccess}
          isSaving={isSavingRule}
          onClose={closeSetupModal}
          onSubmit={submitOrderRule}
          onChange={updateSetupField}
        />
      )}
    </div>
  );
}

function SetupQueuePanel({ rows, showAll, onToggleShowAll, onAction }) {
  const visibleRows = showAll ? rows : rows.slice(0, 8);
  const countSeeds = rows.filter((row) => getSetupQueueLabel(row.item) === "Count seed").length;
  const receiptSeeds = rows.filter((row) => getSetupQueueLabel(row.item) === "Receipt seed").length;
  const mathGaps = rows.filter((row) => row.issues.includes("Target stock") || row.issues.includes("Reorder point")).length;
  const hasHiddenRows = rows.length > 8;

  if (!rows.length) {
    return (
      <div
        className="mb-3 rounded-2xl border px-4 py-3 shadow-sm"
        style={{
          background:
            "linear-gradient(145deg, rgba(240,253,250,0.88), rgba(255,255,255,0.78))",
          borderColor: "rgba(20,184,166,0.16)",
        }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-teal-800">
          <CheckCircle2 className="h-4 w-4" />
          Setup queue is clear
        </div>
        <div className="mt-1 text-xs leading-relaxed text-slate-500">
          No obvious setup gaps are currently blocking the Order Intelligence board.
        </div>
      </div>
    );
  }

  return (
    <div
      className="mb-3 overflow-hidden rounded-2xl border shadow-sm"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))",
        borderColor: "rgba(15,23,42,0.08)",
        boxShadow:
          "0 10px 24px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.84)",
      }}
    >
      <div
        className="border-b px-4 py-3"
        style={{ borderColor: "rgba(15,23,42,0.07)" }}
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <PackageSearch className="h-4 w-4 text-cyan-700" />
              Order Intelligence Setup Queue
            </div>

            <div className="mt-1 text-xs leading-relaxed text-slate-500">
              Setup gaps blocking trusted order recommendations. Use this while turning the chef&apos;s paper process into durable order rules.
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <QueueStat label="Open" value={rows.length} tone="needs_setup" />
            <QueueStat label="Count seeds" value={countSeeds} tone="count_seed" />
            <QueueStat label="Receipt seeds" value={receiptSeeds} tone="receipt" />
            <QueueStat label="Math gaps" value={mathGaps} tone="critical" />

            {hasHiddenRows && (
              <button
                type="button"
                onClick={onToggleShowAll}
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm transition hover:bg-white"
                style={{
                  color: "#0891B2",
                  background: "rgba(236,254,255,0.82)",
                  borderColor: "rgba(34,211,238,0.18)",
                }}
              >
                {showAll ? "Show less" : `Show all ${rows.length}`}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={`grid gap-2 p-3 ${showAll ? "max-h-[620px] overflow-y-auto pr-2" : ""}`}>
        {visibleRows.map((row) => (
          <SetupQueueRow
            key={row.item.id}
            item={row.item}
            issues={row.issues}
            onAction={() => onAction(row.item)}
          />
        ))}

        {hasHiddenRows && !showAll && (
          <div className="flex flex-col gap-2 px-2 pb-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing the top {visibleRows.length} setup blockers from {rows.length} open setup gaps.
            </span>

            <button
              type="button"
              onClick={onToggleShowAll}
              className="inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm transition hover:bg-white"
              style={{
                color: "#0891B2",
                background: "rgba(255,255,255,0.82)",
                borderColor: "rgba(34,211,238,0.18)",
              }}
            >
              Show all setup gaps
            </button>
          </div>
        )}

        {hasHiddenRows && showAll && (
          <div className="flex flex-col gap-2 px-2 pb-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing all {rows.length} open setup gaps.
            </span>

            <button
              type="button"
              onClick={onToggleShowAll}
              className="inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm transition hover:bg-white"
              style={{
                color: "#475569",
                background: "rgba(255,255,255,0.82)",
                borderColor: "rgba(100,116,139,0.18)",
              }}
            >
              Show less
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function QueueStat({ label, value, tone }) {
  const selected = toneStyles(tone);

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
      style={{
        color: selected.color,
        background: selected.bg,
        borderColor: selected.border,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </span>
  );
}

function SetupQueueRow({ item, issues, onAction }) {
  const label = getSetupQueueLabel(item);
  const note = getSetupQueueNote(item);
  const tone = label === "Count seed" ? "count_seed" : label === "Receipt seed" ? "receipt" : label === "Rule math" ? "critical" : "needs_setup";
  const selected = toneStyles(tone);
  const Icon = selected.icon || PackageSearch;
  const showCreateButton = canCreateOrderRule(item);
  const showEditButton = canEditOrderRule(item);

  return (
    <div
      className="grid gap-2 rounded-2xl border px-3 py-3 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.3fr)_auto] lg:items-center"
      style={{
        background: "rgba(255,255,255,0.72)",
        borderColor: "rgba(15,23,42,0.075)",
      }}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border"
          style={{
            color: selected.color,
            background: selected.bg,
            borderColor: selected.border,
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-950" title={item.itemName || "Unnamed item"}>
            {item.itemName || "Unnamed item"}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <StatusMiniPill
              label={label}
              color={selected.color}
              bg={selected.bg}
              border={selected.border}
            />
            <StatusMiniPill
              label={getVendor(item)}
              color="#475569"
              bg="rgba(100,116,139,0.055)"
              border="rgba(100,116,139,0.12)"
            />
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap gap-1.5">
          {issues.slice(0, 6).map((issue) => (
            <span
              key={issue}
              className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
              style={{
                color: "#475569",
                background: "rgba(248,250,252,0.90)",
                borderColor: "rgba(100,116,139,0.14)",
              }}
            >
              Missing: {issue}
            </span>
          ))}
        </div>

        <div className="mt-1.5 truncate text-xs leading-relaxed text-slate-500" title={note}>
          {note}
        </div>
      </div>

      {(showCreateButton || showEditButton) && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold shadow-sm transition hover:bg-white"
          style={{
            color: showEditButton ? "#475569" : "#0891B2",
            background: showEditButton
              ? "rgba(255,255,255,0.84)"
              : "linear-gradient(145deg, rgba(236,254,255,0.96), rgba(255,255,255,0.80))",
            borderColor: showEditButton
              ? "rgba(100,116,139,0.18)"
              : "rgba(34,211,238,0.22)",
          }}
        >
          {showEditButton ? (
            <Edit3 className="h-3.5 w-3.5" />
          ) : (
            <Settings2 className="h-3.5 w-3.5" />
          )}
          {showEditButton ? "Edit rule" : "Create rule"}
        </button>
      )}
    </div>
  );
}

function OrderItemCard({ item, onAction }) {
  const statusStyles = toneStyles(statusTone(item));
  const recommendationStyles = toneStyles(recommendationTone(item));
  const confidenceStyles = toneStyles(confidenceTone(item.confidence));
  const vendorStyles = toneStyles(vendorTone(item));
  const StatusIcon = statusStyles.icon || PackageCheck;
  const VendorIcon = vendorStyles.icon || ClipboardList;
  const showCreateButton = canCreateOrderRule(item);
  const showEditButton = canEditOrderRule(item);
  const matchNote = getMatchNote(item);
  const visibleSignals = getVisibleSignals(item);
  const extraSignalCount = getExtraSignalCount(item);

  return (
    <article
      className="relative overflow-hidden rounded-2xl border p-3 shadow-sm transition hover:shadow-md md:p-3.5"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(248,250,252,0.86))",
        borderColor: statusStyles.border,
        boxShadow:
          "0 8px 20px rgba(15,23,42,0.052), inset 0 1px 0 rgba(255,255,255,0.84)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1"
        style={{ background: statusStyles.border }}
      />

      <div
        className="pointer-events-none absolute -right-10 -top-12 h-24 w-24 rounded-full blur-2xl"
        style={{ background: statusStyles.glow }}
      />

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.03fr)_minmax(0,1.35fr)] lg:items-stretch">
        <div className="min-w-0 rounded-2xl border px-3 py-3"
          style={{
            background: "rgba(255,255,255,0.70)",
            borderColor: "rgba(15,23,42,0.065)",
          }}
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border"
              style={{
                color: statusStyles.color,
                background: statusStyles.bg,
                borderColor: statusStyles.border,
              }}
            >
              <StatusIcon className="h-4 w-4" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold tracking-tight text-slate-950" title={item.itemName || "Unnamed item"}>
                {item.itemName || "Unnamed item"}
              </div>

              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <StatusMiniPill
                  label={statusLabel(item)}
                  color={statusStyles.color}
                  bg={statusStyles.bg}
                  border={statusStyles.border}
                />

                <StatusMiniPill
                  label={item.recommendationType || "Recommendation"}
                  color={recommendationStyles.color}
                  bg={recommendationStyles.bg}
                  border={recommendationStyles.border}
                />
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {visibleSignals.map((signal) => (
              <SignalPill key={signal} signal={signal} />
            ))}

            {extraSignalCount > 0 && (
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  color: "#475569",
                  background: "rgba(100,116,139,0.055)",
                  borderColor: "rgba(100,116,139,0.12)",
                }}
              >
                +{extraSignalCount}
              </span>
            )}
          </div>

          {(showCreateButton || showEditButton) && (
            <button
              type="button"
              onClick={onAction}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold shadow-sm transition hover:bg-white"
              style={{
                color: showEditButton ? "#475569" : "#0891B2",
                background: showEditButton
                  ? "rgba(255,255,255,0.84)"
                  : "linear-gradient(145deg, rgba(236,254,255,0.96), rgba(255,255,255,0.80))",
                borderColor: showEditButton
                  ? "rgba(100,116,139,0.18)"
                  : "rgba(34,211,238,0.22)",
              }}
            >
              {showEditButton ? (
                <Edit3 className="h-3.5 w-3.5" />
              ) : (
                <Settings2 className="h-3.5 w-3.5" />
              )}
              {showEditButton ? "Edit rule" : "Create rule"}
            </button>
          )}
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2">
          <CompactMetric
            label="Stock"
            value={numberOrDash(item.currentStock)}
            note={item.stockSource || "Source unknown"}
          />

          <CompactMetric
            label="Target"
            value={numberOrDash(item.parTarget)}
            note={`Reorder ${numberOrDash(item.reorderPoint)}`}
          />

          <CompactMetric
            label="Suggested"
            value={
              item.suggestedOrderQty !== null && item.suggestedOrderQty !== undefined
                ? numberOrDash(item.suggestedOrderQty)
                : "-"
            }
            note={`Days left ${numberOrDash(item.daysOfStockLeft)}`}
          />

          <CompactMetric
            label="Last count"
            value={
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{getLastCountText(item)}</span>
              </span>
            }
            note={`${item.confidence || "Low"} confidence`}
            color={confidenceStyles.color}
          />
        </div>

        <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <div
            className="min-w-0 rounded-2xl border px-3 py-3"
            style={{
              background: vendorStyles.bg,
              borderColor: vendorStyles.border,
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
                style={{
                  color: vendorStyles.color,
                  background: "rgba(255,255,255,0.70)",
                  borderColor: vendorStyles.border,
                }}
              >
                <VendorIcon className="h-3.5 w-3.5" />
              </span>

              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Vendor signal
                </div>
                <div className="truncate text-sm font-semibold text-slate-950" title={getVendor(item)}>
                  {getVendor(item)}
                </div>
              </div>
            </div>

            <div className="mt-2 grid gap-1 text-xs leading-relaxed text-slate-600">
              <div className="truncate" title={`${getCostText(item)} · ${getUnitText(item)}`}>
                {getCostText(item)} · {getUnitText(item)}
              </div>
              <div className="truncate" title={seenText(item)}>
                {seenText(item)}
              </div>
            </div>

            <span
              className="mt-2 inline-flex max-w-full rounded-full border px-2 py-0.5 text-[10px] font-semibold"
              style={{
                color: "#64748B",
                background: "rgba(255,255,255,0.58)",
                borderColor: "rgba(100,116,139,0.14)",
              }}
              title={getCategory(item)}
            >
              <span className="truncate">{getCategory(item)}</span>
            </span>
          </div>

          <div
            className="min-w-0 rounded-2xl border px-3 py-3"
            style={{
              background: "rgba(255,255,255,0.72)",
              borderColor: "rgba(15,23,42,0.075)",
            }}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Why
              </div>

              <StatusMiniPill
                label={`${item.confidence || "Low"} confidence`}
                color={confidenceStyles.color}
                bg={confidenceStyles.bg}
                border={confidenceStyles.border}
              />
            </div>

            <div
              className="text-xs leading-relaxed text-slate-600"
              title={item.reason || "No recommendation reason available yet."}
            >
              {item.reason || "No recommendation reason available yet."}
            </div>

            {matchNote && (
              <div
                className="mt-2 rounded-xl border px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-500"
                style={{
                  background: "rgba(248,250,252,0.82)",
                  borderColor: "rgba(15,23,42,0.07)",
                }}
                title={matchNote}
              >
                {matchNote}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function StatusMiniPill({ label, color, bg, border }) {
  return (
    <span
      className="inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold"
      style={{ color, background: bg, borderColor: border }}
    >
      {label}
    </span>
  );
}

function SignalPill({ signal }) {
  const isCountSeed = signal === "Count Seed";
  const isApproved = signal.toLowerCase().includes("approved");
  const isReceipt = signal.toLowerCase().includes("receipt");

  let color = "#475569";
  let background = "rgba(100,116,139,0.055)";
  let borderColor = "rgba(100,116,139,0.12)";

  if (isCountSeed) {
    color = "#6D28D9";
    background = "rgba(124,58,237,0.08)";
    borderColor = "rgba(124,58,237,0.16)";
  } else if (isApproved) {
    color = "#4F46E5";
    background = "rgba(99,102,241,0.08)";
    borderColor = "rgba(99,102,241,0.15)";
  } else if (isReceipt) {
    color = "#0891B2";
    background = "rgba(34,211,238,0.08)";
    borderColor = "rgba(34,211,238,0.14)";
  }

  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={{ color, background, borderColor }}
      title={signal}
    >
      {signal}
    </span>
  );
}

function CompactMetric({ label, value, note, color = "#0F172A" }) {
  return (
    <div
      className="min-w-0 rounded-2xl border px-3 py-2.5"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.90), rgba(248,250,252,0.74))",
        borderColor: "rgba(15,23,42,0.075)",
      }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>

      <div
        className="mt-0.5 truncate text-base font-semibold tracking-tight"
        style={{ color }}
      >
        {value}
      </div>

      <div className="mt-0.5 truncate text-[11px] leading-relaxed text-slate-500" title={note}>
        {note}
      </div>
    </div>
  );
}

function OrderRuleSetupModal({ item, form, error, success, isSaving, onClose, onSubmit, onChange }) {
  const isEdit = form.mode === "edit";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-auto p-4"
      style={{ background: "rgba(15,23,42,0.48)" }}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-3xl border shadow-2xl"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
          borderColor: "rgba(15,23,42,0.12)",
        }}
      >
        <div className="border-b px-5 py-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {isEdit ? (
                  <Edit3 className="h-4 w-4 text-cyan-700" />
                ) : (
                  <PackagePlus className="h-4 w-4 text-cyan-700" />
                )}
                {isEdit ? "Edit order rule" : "Order rule setup"}
              </div>

              <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                {isEdit ? "Edit rule for" : "Create rule for"} {item?.itemName || "item"}
              </h3>

              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                Update the stock rules KitchenPulse uses for reorder guidance. This does not create or send a vendor order.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border transition hover:bg-white disabled:opacity-60"
              style={{
                color: "#475569",
                background: "rgba(255,255,255,0.78)",
                borderColor: "rgba(15,23,42,0.10)",
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="p-5">
          {error && (
            <div
              className="mb-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm leading-relaxed"
              style={{
                color: "#B91C1C",
                background: "rgba(239,68,68,0.08)",
                borderColor: "rgba(239,68,68,0.16)",
              }}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {success && (
            <div
              className="mb-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm leading-relaxed"
              style={{
                color: "#047857",
                background: "rgba(16,185,129,0.09)",
                borderColor: "rgba(16,185,129,0.18)",
              }}
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{success}</div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <SetupField label="Order item name" value={form.itemName} onChange={(value) => onChange("itemName", value)} required />
            <SetupField label="Current stock" value={form.currentStock} onChange={(value) => onChange("currentStock", value)} type="number" />
            <SetupField label="Count unit" value={form.countUnit} onChange={(value) => onChange("countUnit", value)} placeholder="loaves, cases, each, lb..." />
            <SetupField label="Storage area" value={form.storageArea} onChange={(value) => onChange("storageArea", value)} placeholder="Dry Storage, Walk-in, Bar..." />
            <SetupField label="Target stock" value={form.targetStock} onChange={(value) => onChange("targetStock", value)} type="number" required />
            <SetupField label="Reorder point" value={form.reorderPoint} onChange={(value) => onChange("reorderPoint", value)} type="number" required />
            <SetupField label="Estimated daily usage" value={form.estimatedDailyUsage} onChange={(value) => onChange("estimatedDailyUsage", value)} type="number" />
            <SetupField label="Preferred vendor" value={form.preferredVendor} onChange={(value) => onChange("preferredVendor", value)} placeholder="Sysco, Royal Food Service..." />
            <SetupField label="Vendor item name" value={form.vendorItemName} onChange={(value) => onChange("vendorItemName", value)} />
            <SetupField label="Vendor SKU" value={form.orderVendorSku} onChange={(value) => onChange("orderVendorSku", value)} />
            <SetupField label="Vendor order unit" value={form.vendorOrderUnit} onChange={(value) => onChange("vendorOrderUnit", value)} placeholder="case, bag, box, each..." />
            <SetupField label="Pack size" value={form.packSize} onChange={(value) => onChange("packSize", value)} placeholder="24 ct, 10 lb case, 12 x 750ml..." />
          </div>

          <div className="mt-4">
            <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Conversion notes
            </label>
            <textarea
              value={form.unitConversionNotes}
              onChange={(event) => onChange("unitConversionNotes", event.target.value)}
              placeholder="Example: 1 case = 24 loaves. Count partial cases as loaves."
              rows={3}
              className="mt-1 w-full rounded-2xl border bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-200"
              style={{ borderColor: "rgba(15,23,42,0.10)" }}
            />
          </div>

          <div className="mt-4">
            <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Setup notes
            </label>
            <textarea
              value={form.notes}
              onChange={(event) => onChange("notes", event.target.value)}
              placeholder="Internal setup note, vendor note, or manager reminder."
              rows={2}
              className="mt-1 w-full rounded-2xl border bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-200"
              style={{ borderColor: "rgba(15,23,42,0.10)" }}
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <SetupCheckbox label="Critical item" checked={form.criticalItem} onChange={(checked) => onChange("criticalItem", checked)} />
            <SetupCheckbox label="Emergency run risk" checked={form.emergencyRunRisk} onChange={(checked) => onChange("emergencyRunRisk", checked)} />
            <SetupCheckbox label="Event sensitive" checked={form.eventSensitive} onChange={(checked) => onChange("eventSensitive", checked)} />
          </div>

          <div
            className="mt-5 rounded-2xl border px-4 py-3 text-sm leading-relaxed text-slate-500"
            style={{
              background: "rgba(248,250,252,0.78)",
              borderColor: "rgba(15,23,42,0.08)",
            }}
          >
            <span className="font-semibold text-slate-800">Safety rule:</span>{" "}
            This saves ordering rules only. It does not create, draft, or send a vendor order.
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-white disabled:opacity-60"
              style={{
                color: "#475569",
                background: "rgba(255,255,255,0.82)",
                borderColor: "rgba(15,23,42,0.10)",
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60"
              style={{
                background:
                  "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(8,145,178,0.92))",
                borderColor: "rgba(15,23,42,0.12)",
                boxShadow:
                  "0 12px 24px rgba(8,145,178,0.18), inset 0 1px 0 rgba(255,255,255,0.18)",
              }}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEdit ? "Save rule changes" : "Create order rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SetupField({ label, value, onChange, type = "text", placeholder = "", required = false }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1 h-11 w-full rounded-2xl border bg-white/80 px-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-200"
        style={{ borderColor: "rgba(15,23,42,0.10)" }}
      />
    </label>
  );
}

function SetupCheckbox({ label, checked, onChange }) {
  return (
    <label
      className="flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
      style={{
        background: "rgba(255,255,255,0.78)",
        borderColor: "rgba(15,23,42,0.08)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300"
      />
      {label}
    </label>
  );
}

function MetricCard({ label, value, note, tone = "neutral", icon }) {
  const selected = toneStyles(tone);
  const CardIcon = icon || selected.icon || ClipboardList;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-3 shadow-sm"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))",
        borderColor: "rgba(15,23,42,0.08)",
        boxShadow:
          "0 8px 20px rgba(15,23,42,0.052), inset 0 1px 0 rgba(255,255,255,0.82)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: selected.border }}
      />

      <div
        className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl"
        style={{ background: selected.glow }}
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </div>

          <div
            className="mt-1 text-2xl font-semibold tracking-tight"
            style={{ color: selected.color }}
          >
            {value}
          </div>
        </div>

        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border shadow-sm"
          style={{
            color: selected.color,
            background: selected.bg,
            borderColor: selected.border,
          }}
        >
          <CardIcon className="h-4 w-4" />
        </span>
      </div>

      <div
        className="relative z-10 mt-1.5 truncate text-xs leading-relaxed text-muted-foreground"
        title={note}
      >
        {note}
      </div>
    </div>
  );
}

function DataQualityCard({ label, value, note, tone = "neutral" }) {
  const selected = toneStyles(tone);

  return (
    <div
      className="rounded-2xl border px-4 py-3 text-sm shadow-sm"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.72))",
        borderColor: "rgba(15,23,42,0.08)",
      }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>

      <div
        className="mt-1 text-xl font-semibold tracking-tight"
        style={{ color: selected.color }}
      >
        {value}
      </div>

      <div className="mt-1 text-xs leading-relaxed text-slate-500">{note}</div>
    </div>
  );
}

function StateBox({ text, tone = "default", icon: Icon = PackageSearch, spin = false }) {
  const styles = tone === "error" ? toneStyles("critical") : toneStyles("receipt");

  return (
    <div
      className="rounded-3xl border border-dashed px-6 py-10 text-center text-sm font-semibold shadow-sm"
      style={{
        color: tone === "error" ? "#B91C1C" : "#64748B",
        background:
          tone === "error"
            ? "rgba(254,242,242,0.88)"
            : "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.72))",
        borderColor:
          tone === "error" ? "rgba(254,202,202,0.90)" : "rgba(15,23,42,0.12)",
      }}
    >
      <div
        className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border"
        style={{
          color: styles.color,
          background: styles.bg,
          borderColor: styles.border,
        }}
      >
        <Icon className={`h-5 w-5 ${spin ? "animate-spin" : ""}`} />
      </div>

      {text}
    </div>
  );
}
