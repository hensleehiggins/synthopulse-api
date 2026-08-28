import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  PackageSearch,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const API_BASE = "https://project-1csz2.vercel.app";

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;

  if (Array.isArray(value)) {
    return numberOrNull(value[0]);
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const numberValue = numberOrNull(value);

    if (numberValue !== null) {
      return numberValue;
    }
  }

  return null;
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

function signedMoney(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "";

  const absolute = Math.abs(numberValue).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (numberValue > 0) return `+${absolute}`;
  if (numberValue < 0) return `-${absolute}`;
  return "$0.00";
}

function percentChangeText(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "";

  const normalized = Math.abs(numberValue) > 1 ? numberValue / 100 : numberValue;

  return normalized.toLocaleString("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "always",
  });
}

function dateText(value) {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function seenText(item) {
  if (!item.lastSeenDate) return "No receipt date";

  if (item.lastSeenDaysAgo === 0) return "Seen today";
  if (item.lastSeenDaysAgo === 1) return "Seen yesterday";
  if (Number.isFinite(Number(item.lastSeenDaysAgo))) {
    return `${item.lastSeenDaysAgo} days ago`;
  }

  return dateText(item.lastSeenDate);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b))
  );
}

function normalizeSupplierName(value) {
  const raw = String(value || "").trim();
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (
    compact.includes("SYSCO") ||
    compact.includes("SYCSO") ||
    compact.includes("SYSCOATLANTA") ||
    compact.includes("SYCSOATLANTA")
  ) {
    return "Sysco Atlanta LLC";
  }

  return raw;
}

function hasCurrentCost(item) {
  return (
    item?.currentCost !== null &&
    item?.currentCost !== undefined &&
    Number.isFinite(Number(item.currentCost))
  );
}

function toneStyles(tone = "neutral") {
  if (tone === "pressure" || tone === "up") {
    return {
      color: "#B45309",
      bg: "rgba(245,158,11,0.07)",
      border: "rgba(245,158,11,0.14)",
      glow: "rgba(245,158,11,0.04)",
      icon: TrendingUp,
    };
  }

  if (tone === "relief" || tone === "down") {
    return {
      color: "#0F766E",
      bg: "rgba(20,184,166,0.07)",
      border: "rgba(20,184,166,0.13)",
      glow: "rgba(20,184,166,0.04)",
      icon: TrendingDown,
    };
  }

  if (tone === "flat" || tone === "current") {
    return {
      color: "#64748B",
      bg: "rgba(100,116,139,0.07)",
      border: "rgba(100,116,139,0.12)",
      glow: "rgba(100,116,139,0.035)",
      icon: CheckCircle2,
    };
  }

  if (tone === "missing" || tone === "watch") {
    return {
      color: "#D97706",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.16)",
      glow: "rgba(245,158,11,0.045)",
      icon: AlertTriangle,
    };
  }

  if (tone === "priced") {
    return {
      color: "#0F766E",
      bg: "rgba(20,184,166,0.07)",
      border: "rgba(20,184,166,0.13)",
      glow: "rgba(20,184,166,0.04)",
      icon: CheckCircle2,
    };
  }

  return {
    color: "#0891B2",
    bg: "rgba(34,211,238,0.08)",
    border: "rgba(34,211,238,0.14)",
    glow: "rgba(34,211,238,0.045)",
    icon: ClipboardList,
  };
}

function getCategoryTone(category) {
  const value = String(category || "").toLowerCase();

  if (value.includes("produce")) return toneStyles("relief");
  if (value.includes("dairy")) return toneStyles("neutral");
  if (value.includes("seafood")) return toneStyles("neutral");
  if (value.includes("beverage")) return toneStyles("flat");
  if (value.includes("dry")) return toneStyles("watch");

  return toneStyles("flat");
}

function getPriorCost(item) {
  const movement = item?.movement || {};

  return firstFiniteNumber(
    item.previousCost,
    item.priorCost,
    item.lastCost,
    item.previousUnitCost,
    item.priorUnitCost,
    item.previousPrice,
    item.priorPrice,
    item.comparisonCost,
    item.compareCost,
    item.baselineCost,
    movement.previousCost,
    movement.priorCost,
    movement.comparisonCost
  );
}

function getChangeAmount(item) {
  const movement = item?.movement || {};

  const explicitChange = firstFiniteNumber(
    item.changeAmount,
    item.latestChangeAmount,
    item.costChangeAmount,
    item.costChangeDollars,
    item.dollarChange,
    item.changeDollars,
    movement.changeAmount,
    movement.dollarChange
  );

  if (explicitChange !== null) {
    return explicitChange;
  }

  const current = firstFiniteNumber(item.currentCost, item.price, item.unitPrice);
  const prior = getPriorCost(item);

  if (current === null || prior === null) {
    return null;
  }

  return current - prior;
}

function getChangePercent(item) {
  const movement = item?.movement || {};

  const explicitPercent = firstFiniteNumber(
    item.changePercent,
    item.latestChangePercent,
    item.costChangePercent,
    item.percentChange,
    movement.changePercent,
    movement.percentChange
  );

  if (explicitPercent !== null) {
    return Math.abs(explicitPercent) > 1 ? explicitPercent / 100 : explicitPercent;
  }

  const prior = getPriorCost(item);
  const changeAmount = getChangeAmount(item);

  if (prior === null || prior === 0 || changeAmount === null) {
    return null;
  }

  return changeAmount / prior;
}

function getMovementDirection(item) {
  const movement = item?.movement || {};
  const rawDirection = String(
    item.movementDirection ||
    item.latestMovementDirection ||
    item.costMovementDirection ||
    item.direction ||
    movement.direction ||
    ""
  ).toLowerCase();

  if (
    rawDirection.includes("up") ||
    rawDirection.includes("increase") ||
    rawDirection.includes("higher") ||
    rawDirection.includes("rising") ||
    rawDirection.includes("pressure")
  ) {
    return "up";
  }

  if (
    rawDirection.includes("down") ||
    rawDirection.includes("decrease") ||
    rawDirection.includes("lower") ||
    rawDirection.includes("falling") ||
    rawDirection.includes("relief")
  ) {
    return "down";
  }

  if (
    rawDirection.includes("flat") ||
    rawDirection.includes("same") ||
    rawDirection.includes("unchanged") ||
    rawDirection.includes("current")
  ) {
    return "flat";
  }

  const changeAmount = getChangeAmount(item);

  if (changeAmount === null) {
    return hasCurrentCost(item) ? "baseline" : "missing";
  }

  if (Math.abs(changeAmount) < 0.005) {
    return "flat";
  }

  return changeAmount > 0 ? "up" : "down";
}

function getMovementLabel(direction) {
  if (direction === "up") return "Up";
  if (direction === "down") return "Down";
  if (direction === "flat") return "Flat";
  if (direction === "missing") return "Needs price";
  return "No prior";
}

function getMovementDetail(item) {
  const direction = getMovementDirection(item);

  if (direction === "baseline") {
    return "First tracked price";
  }

  if (direction === "missing") {
    return "No current cost";
  }

  if (direction === "flat") {
    return "No change";
  }

  const changeAmount = getChangeAmount(item);
  const changePercent = getChangePercent(item);

  const parts = [];

  if (changeAmount !== null) {
    parts.push(signedMoney(changeAmount));
  }

  if (changePercent !== null) {
    parts.push(percentChangeText(changePercent));
  }

  return parts.join(" / ") || "Movement detected";
}

function getMovementRank(item) {
  const direction = getMovementDirection(item);

  if (direction === "up") return 1;
  if (direction === "down") return 2;
  if (direction === "flat") return 3;
  if (direction === "baseline") return 4;
  if (direction === "missing") return 5;

  return 6;
}

function MovementSplitValue({ up, down }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span style={{ color: toneStyles("pressure").color }}>{up} up</span>
      <span className="text-slate-400">/</span>
      <span style={{ color: toneStyles("relief").color }}>{down} down</span>
    </span>
  );
}

function MovementBadge({ item }) {
  const direction = getMovementDirection(item);
  const styles =
    direction === "baseline"
      ? toneStyles("neutral")
      : direction === "missing"
        ? toneStyles("missing")
        : toneStyles(direction);

  return (
    <span
      className="inline-flex min-w-[96px] flex-col rounded-2xl border px-3 py-1.5 text-[11px] font-semibold leading-tight"
      style={{
        color: styles.color,
        background: styles.bg,
        borderColor: styles.border,
      }}
    >
      <span>{getMovementLabel(direction)}</span>
      <span className="mt-0.5 font-medium opacity-80">
        {getMovementDetail(item)}
      </span>
    </span>
  );
}

export default function VendorCostLedger() {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState("");
  const [movementFilter, setMovementFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadLedger() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API_BASE}/api/cost-source-items`);
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Vendor cost ledger could not be loaded.");
        }

        if (cancelled) return;

        setItems(Array.isArray(payload.items) ? payload.items : []);
        setCounts(payload.counts || null);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || "Vendor cost ledger could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLedger();

    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedItems = useMemo(() => {
    return items.map((item) => ({
      ...item,
      normalizedSupplier: normalizeSupplierName(item.supplier),
    }));
  }, [items]);

  const vendors = useMemo(
    () => uniqueSorted(normalizedItems.map((item) => item.normalizedSupplier)),
    [normalizedItems]
  );

  const categories = useMemo(
    () => uniqueSorted(normalizedItems.map((item) => item.category)),
    [normalizedItems]
  );

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return normalizedItems
      .filter((item) => {
        const direction = getMovementDirection(item);

        if (vendor && item.normalizedSupplier !== vendor) return false;
        if (category && item.category !== category) return false;
        if (movementFilter && direction !== movementFilter) return false;

        if (!needle) return true;

        const haystack = [
          item.itemName,
          item.normalizedSupplier,
          item.category,
          item.unit,
          item.sku,
          getMovementLabel(direction),
          getMovementDetail(item),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(needle);
      })
      .sort((a, b) => {
        if (movementFilter) {
          const aChange = Math.abs(Number(getChangeAmount(a) || 0));
          const bChange = Math.abs(Number(getChangeAmount(b) || 0));

          if (bChange !== aChange) return bChange - aChange;

          return String(a.itemName || "").localeCompare(String(b.itemName || ""));
        }

        const aRank = getMovementRank(a);
        const bRank = getMovementRank(b);

        if (aRank !== bRank) return aRank - bRank;

        const aDate = String(a.lastSeenDate || "");
        const bDate = String(b.lastSeenDate || "");

        if (aDate !== bDate) return bDate.localeCompare(aDate);

        const aCost = Number(a.currentCost || 0);
        const bCost = Number(b.currentCost || 0);

        if (aCost !== bCost) return bCost - aCost;

        return String(a.itemName || "").localeCompare(String(b.itemName || ""));
      });
  }, [normalizedItems, search, vendor, category, movementFilter]);

  const movementCounts = useMemo(() => {
    return normalizedItems.reduce(
      (acc, item) => {
        const direction = getMovementDirection(item);

        if (direction === "up") acc.up += 1;
        if (direction === "down") acc.down += 1;
        if (direction === "flat") acc.flat += 1;
        if (direction === "baseline") acc.baseline += 1;
        if (direction === "missing") acc.missing += 1;

        return acc;
      },
      { up: 0, down: 0, flat: 0, baseline: 0, missing: 0 }
    );
  }, [normalizedItems]);

  const ownerRead = useMemo(() => {
    if (loading) return "Loading the owner price book from approved receipt data.";
    if (error) return "Vendor Cost Ledger is blocked from loading. Check the cost-source-items API before trusting this section.";
    if (!normalizedItems.length) return "No vendor cost items are currently tracked. Approved receipt lines will seed this ledger after review.";

    const pricedItems = counts?.pricedItems ?? normalizedItems.filter(hasCurrentCost).length;
    const totalItems = counts?.totalItems ?? normalizedItems.length;
    const vendorCount = counts?.vendors ?? vendors.length;

    if (movementCounts.up > 0 || movementCounts.down > 0) {
      return `${pricedItems} tracked vendor prices are baseline-ready across ${vendorCount} vendor${vendorCount === 1 ? "" : "s"}. Latest movement shows ${movementCounts.up} up and ${movementCounts.down} down.`;
    }

    if (pricedItems === totalItems) {
      return `${pricedItems} tracked vendor prices are currently baseline-ready across ${vendorCount} vendor${vendorCount === 1 ? "" : "s"}. Use this as the live owner price book before cost movement becomes active.`;
    }

    return `${pricedItems} of ${totalItems} vendor items have usable current prices. Items without price should stay out of movement logic until cleaned up.`;
  }, [loading, error, normalizedItems, counts, vendors, movementCounts]);

  return (
    <div className="container py-4">
      <div className="content mx-auto max-w-6xl">
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
                  Owner price book
                </div>

                <h2 className="text-2xl font-heading font-semibold tracking-tight">
                  Vendor Cost Ledger
                </h2>

                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  Current tracked vendor prices from approved receipt data. Use this as
                  the owner&apos;s live cost book for food, beverage, and vendor pricing.
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
                Cost Source Items
              </div>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Tracked items"
                value={counts?.totalItems ?? "-"}
                note="Current vendor price book"
                tone="neutral"
                icon={ClipboardList}
              />

              <MetricCard
                label="Priced items"
                value={counts?.pricedItems ?? "-"}
                note="Ready for baseline tracking"
                tone="priced"
                icon={CheckCircle2}
              />

              <MetricCard
  label="Price movement"
  value={
    <MovementSplitValue
      up={movementCounts.up}
      down={movementCounts.down}
    />
  }
  note="Latest tracked cost direction"
  tone={movementCounts.up > movementCounts.down ? "pressure" : "relief"}
  icon={movementCounts.up > movementCounts.down ? TrendingUp : TrendingDown}
/>

              <MetricCard
                label="Receipt-backed"
                value={normalizedItems.filter((item) => item.sourceLineCount > 0).length}
                note="Ledger items backed by approved receipt lines"
                tone="watch"
                icon={CircleDollarSign}
              />
            </div>

            <div
              className="mb-4 rounded-2xl border px-4 py-3 text-sm leading-relaxed text-muted-foreground shadow-sm"
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

            <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search item, vendor, category, SKU, or movement..."
                  className="h-11 w-full rounded-2xl border bg-white/80 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-200"
                  style={{ borderColor: "rgba(15,23,42,0.10)" }}
                />
              </div>

              <select
                value={vendor}
                onChange={(event) => setVendor(event.target.value)}
                className="h-11 rounded-2xl border bg-white/80 px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-2 focus:ring-cyan-200"
                style={{ borderColor: "rgba(15,23,42,0.10)" }}
              >
                <option value="">All vendors</option>
                {vendors.map((vendorName) => (
                  <option key={vendorName} value={vendorName}>
                    {vendorName}
                  </option>
                ))}
              </select>

              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-11 rounded-2xl border bg-white/80 px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-2 focus:ring-cyan-200"
                style={{ borderColor: "rgba(15,23,42,0.10)" }}
              >
                <option value="">All categories</option>
                {categories.map((categoryName) => (
                  <option key={categoryName} value={categoryName}>
                    {categoryName}
                  </option>
                ))}
              </select>

              <select
                value={movementFilter}
                onChange={(event) => setMovementFilter(event.target.value)}
                className="h-11 rounded-2xl border bg-white/80 px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-2 focus:ring-cyan-200"
                style={{ borderColor: "rgba(15,23,42,0.10)" }}
              >
                <option value="">All movement</option>
                <option value="up">Cost up</option>
                <option value="down">Cost down</option>
                <option value="flat">Flat</option>
                <option value="baseline">No prior</option>
                <option value="missing">Needs price</option>
              </select>
            </div>

            {loading ? (
              <StateBox text="Loading tracked vendor prices..." icon={RefreshCw} spin />
            ) : error ? (
              <StateBox tone="error" text={error} icon={AlertTriangle} />
            ) : filteredItems.length === 0 ? (
              <StateBox text="No matching vendor cost items found." icon={PackageSearch} />
            ) : (
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
                <div className="max-h-[620px] overflow-auto">
                  <table className="w-full min-w-[1000px] border-collapse">
                    <thead
                      className="sticky top-0 z-10 backdrop-blur"
                      style={{
                        background:
                          "linear-gradient(145deg, rgba(248,250,252,0.96), rgba(241,245,249,0.92))",
                      }}
                    >
                      <tr>
                        <TableHead className="w-[30%]">Item</TableHead>
<TableHead className="w-[15%]">Vendor</TableHead>
<TableHead className="w-[12%]">Current Cost</TableHead>
<TableHead className="w-[9%]">Unit</TableHead>
<TableHead className="w-[12%]">Category</TableHead>
<TableHead className="w-[12%]">Movement</TableHead>
<TableHead className="w-[10%]">Last Seen</TableHead>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredItems.map((item) => {
  const categoryTone = getCategoryTone(item.category);

  return (
                          <tr
                            key={item.id}
                            className="border-t border-slate-200/70 transition hover:bg-slate-50/80"
                          >
                            <td className="px-4 py-4 align-middle">
                              <div
                                className="truncate text-sm font-semibold text-slate-950"
                                title={item.itemName}
                              >
                                {item.itemName || "Unnamed cost item"}
                              </div>

                              {item.sku ? (
                                <div className="mt-1 text-xs font-medium text-slate-500">
                                  SKU {item.sku}
                                </div>
                              ) : null}
                            </td>

                            <td className="px-4 py-4 text-sm font-medium text-slate-600">
                              {item.normalizedSupplier || "Unknown vendor"}
                            </td>

                            <td className="px-4 py-4">
                              <span className="text-base font-semibold tracking-tight text-slate-950">
                                {money(item.currentCost)}
                              </span>
                            </td>

                            <td className="px-4 py-4 text-sm text-slate-600">
                              {item.unit || "-"}
                            </td>

                            <td className="px-4 py-4">
                              <span
                                className="inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                                style={{
                                  color: categoryTone.color,
                                  background: categoryTone.bg,
                                  borderColor: categoryTone.border,
                                }}
                              >
                                {item.category || "Other"}
                              </span>
                            </td>

                            <td className="px-4 py-4">
                              <MovementBadge item={item} />
                            </td>

                            <td className="px-4 py-4">
                              <div className="text-sm font-semibold text-slate-800">
                                {dateText(item.lastSeenDate)}
                              </div>
                              <div className="mt-1 text-xs font-medium text-slate-500">
                                {seenText(item)}
                              </div>
                            </td>

                            
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, note, tone = "neutral", icon: Icon }) {
  const selected = toneStyles(tone);
  const CardIcon = Icon || selected.icon || CircleDollarSign;

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
        style={{ background: selected.border }}
      />

      <div
        className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl"
        style={{ background: selected.glow }}
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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
          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border shadow-sm"
          style={{
            color: selected.color,
            background: selected.bg,
            borderColor: selected.border,
          }}
        >
          <CardIcon className="h-4 w-4" />
        </span>
      </div>

      <div className="relative z-10 mt-2 truncate text-xs leading-relaxed text-muted-foreground" title={note}>
        {note}
      </div>
    </div>
  );
}

function TableHead({ children, className = "" }) {
  return (
    <th
      className={[
        "border-b border-slate-200/80 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500",
        className,
      ].join(" ")}
    >
      {children}
    </th>
  );
}

function StateBox({ text, tone = "default", icon: Icon = PackageSearch, spin = false }) {
  const styles = tone === "error" ? toneStyles("missing") : toneStyles("neutral");

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
