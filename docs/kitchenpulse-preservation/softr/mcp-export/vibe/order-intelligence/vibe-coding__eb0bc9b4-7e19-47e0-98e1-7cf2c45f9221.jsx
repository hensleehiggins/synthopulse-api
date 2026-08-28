import { useEffect, useState } from "react";
import { useTextSetting } from "@/lib/editable-settings";
import {
  AlertTriangle,
  ClipboardCheck,
  PackageCheck,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";

function KitchenPulseLockup({ brandDescriptor }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline">
        <span
          className="text-[27px] font-black tracking-[-0.055em] md:text-[34px]"
          style={{
            color: "#F8FAFC",
            textShadow: "0 1px 16px rgba(0,0,0,0.28)",
          }}
        >
          Kitchen
        </span>

        <span
          className="text-[27px] font-black tracking-[-0.055em] md:text-[34px]"
          style={{
            color: "#22D3EE",
            textShadow: "0 0 18px rgba(34,211,238,0.32)",
          }}
        >
          Pulse
        </span>
      </div>

      <div
        className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.34em] md:text-[11px]"
        style={{
          color: "rgba(226,232,240,0.68)",
        }}
      >
        {brandDescriptor}
      </div>
    </div>
  );
}

export default function Block(props) {
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const checkSize = () => {
      const realPhoneWidth = Math.min(
        window.innerWidth || 9999,
        window.screen?.width || 9999
      );

      setIsPhone(realPhoneWidth < 768);
    };

    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  const brandDescriptor = useTextSetting({
    name: "brand-descriptor",
    label: "Brand descriptor",
    initialValue: "AI for restaurant operators",
  });

  const headlineFallback = useTextSetting({
    name: "headline",
    label: "Headline",
    initialValue: "Order Intelligence",
  });

  const subheadlineFallback = useTextSetting({
    name: "subheadline",
    label: "Subheadline",
    initialValue:
      "Know what to order, what can wait, and what is likely to squeeze service before the rush hits. KitchenPulse turns PAR, receipts, sales movement, weather, events, and vendor rhythm into owner-ready reorder guidance.",
  });

  const headline = props?.headline || headlineFallback;
  const subheadline = props?.subheadline || subheadlineFallback;

  return (
    <div className="container relative overflow-hidden py-6 md:py-8 lg:py-10">
      <div
        className="relative overflow-hidden rounded-[30px] border shadow-2xl"
        style={{
          background:
            "linear-gradient(135deg, #03101C 0%, #071827 42%, #0B1324 72%, #101936 100%)",
          borderColor: "rgba(103,232,249,0.14)",
          boxShadow:
            "0 26px 70px rgba(2,8,23,0.42), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 16% 18%, rgba(34,211,238,0.23), transparent 28%), radial-gradient(circle at 76% 14%, rgba(14,165,233,0.20), transparent 26%), radial-gradient(circle at 82% 84%, rgba(34,197,94,0.10), transparent 34%)",
          }}
        />

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
            backgroundSize: "38px 38px",
            opacity: 0.15,
          }}
        />

        <div className="relative z-10 px-6 py-7 md:px-9 md:py-8 lg:px-11 lg:py-9">
          <div
            className="grid items-start gap-6 lg:gap-8"
            style={{
              gridTemplateColumns: isPhone ? "1fr" : "1.45fr 0.82fr",
            }}
          >
            <div className="min-w-0">
              <div className="mb-7">
                <div
                  className="inline-flex items-center rounded-[22px] px-4 py-3 md:px-5 md:py-4"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow:
                      "0 12px 30px rgba(2,8,23,0.18), inset 0 1px 0 rgba(255,255,255,0.04)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <KitchenPulseLockup brandDescriptor={brandDescriptor} />
                </div>
              </div>

              <h1
                className="max-w-3xl font-semibold tracking-[-0.035em]"
                style={{
                  color: "#F8FAFC",
                  fontSize: "clamp(34px, 4.25vw, 58px)",
                  lineHeight: "1.02",
                  textShadow: "0 1px 18px rgba(0,0,0,0.28)",
                }}
              >
                {headline}
              </h1>

              <p
                className="mt-4 max-w-2xl"
                style={{
                  color: "rgba(226,232,240,0.84)",
                  fontSize: "clamp(14px, 1.35vw, 18px)",
                  lineHeight: "1.55",
                }}
              >
                {subheadline}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium md:text-sm"
                  style={{
                    color: "#E0F2FE",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{
                      background: "#22C55E",
                      boxShadow: "0 0 12px rgba(34,197,94,0.75)",
                    }}
                  />
                  PAR-aware ordering
                </span>

                <span
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium md:text-sm"
                  style={{
                    color: "#67E8F9",
                    background: "rgba(34,211,238,0.08)",
                    border: "1px solid rgba(34,211,238,0.16)",
                  }}
                >
                  Receipt-backed stock signals
                </span>

                <span
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium md:text-sm"
                  style={{
                    color: "#C7D2FE",
                    background: "rgba(99,102,241,0.12)",
                    border: "1px solid rgba(99,102,241,0.20)",
                  }}
                >
                  Event and trend pressure
                </span>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div
                  className="rounded-2xl p-3.5"
                  style={{
                    background: "rgba(255,255,255,0.055)",
                    border: "1px solid rgba(255,255,255,0.09)",
                  }}
                >
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: "#67E8F9" }}
                  >
                    Watch
                  </div>
                  <div
                    className="mt-2 text-sm font-semibold"
                    style={{ color: "#F8FAFC" }}
                  >
                    Stock pressure
                  </div>
                  <div
                    className="mt-1 text-xs leading-5"
                    style={{ color: "rgba(226,232,240,0.66)" }}
                  >
                    See what is below target, near reorder, or missing a fresh count.
                  </div>
                </div>

                <div
                  className="rounded-2xl p-3.5"
                  style={{
                    background: "rgba(255,255,255,0.055)",
                    border: "1px solid rgba(255,255,255,0.09)",
                  }}
                >
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: "#A5B4FC" }}
                  >
                    Understand
                  </div>
                  <div
                    className="mt-2 text-sm font-semibold"
                    style={{ color: "#F8FAFC" }}
                  >
                    Demand signals
                  </div>
                  <div
                    className="mt-1 text-xs leading-5"
                    style={{ color: "rgba(226,232,240,0.66)" }}
                  >
                    Connect ordering to sales movement, weather, events, and menu usage.
                  </div>
                </div>

                <div
                  className="rounded-2xl p-3.5"
                  style={{
                    background: "rgba(255,255,255,0.055)",
                    border: "1px solid rgba(255,255,255,0.09)",
                  }}
                >
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: "#FDBA74" }}
                  >
                    Act
                  </div>
                  <div
                    className="mt-2 text-sm font-semibold"
                    style={{ color: "#F8FAFC" }}
                  >
                    Order guidance
                  </div>
                  <div
                    className="mt-1 text-xs leading-5"
                    style={{ color: "rgba(226,232,240,0.66)" }}
                  >
                    Stage normal PAR orders, critical needs, and owner-approved drafts.
                  </div>
                </div>
              </div>

              <div
                className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
                style={{
                  color: "rgba(226,232,240,0.76)",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Sparkles className="h-3.5 w-3.5" style={{ color: "#C7D2FE" }} />
                Built for future owner-approved AI ordering
              </div>
            </div>

            <div className="min-w-0">
              <div
                className="break-words rounded-[24px] p-4 md:p-5"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.085), rgba(255,255,255,0.045))",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(12px)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 38px rgba(2,8,23,0.22)",
                }}
              >
                <div
                  style={{
                    color: "#67E8F9",
                    fontSize: "12px",
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  ORDER SIGNAL
                </div>

                <div
                  className="mt-3 font-semibold break-words"
                  style={{
                    color: "#F8FAFC",
                    fontSize: "clamp(20px, 1.8vw, 27px)",
                    lineHeight: "1.14",
                    wordBreak: "break-word",
                  }}
                >
                  Turn PAR into a daily ordering decision.
                </div>

                <div
                  className="mt-3"
                  style={{
                    color: "rgba(226,232,240,0.78)",
                    fontSize: "13px",
                    lineHeight: "1.5",
                  }}
                >
                  KitchenPulse compares current stock, target PAR, vendor rhythm,
                  receipt-backed cost, menu movement, weather, and event pressure so
                  operators can see what to order before service gets squeezed.
                </div>

                <div className="mt-4 grid gap-2.5">
                  <div
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                    style={{ background: "rgba(15,23,42,0.62)" }}
                  >
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: "#FDBA74" }}
                    />
                    <div className="min-w-0">
                      <div
                        className="text-sm font-semibold"
                        style={{ color: "#F8FAFC" }}
                      >
                        Critical needs
                      </div>
                      <div
                        className="mt-0.5 text-xs"
                        style={{ color: "rgba(226,232,240,0.66)" }}
                      >
                        Flag items likely to trigger emergency store runs.
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                    style={{ background: "rgba(15,23,42,0.62)" }}
                  >
                    <PackageSearch
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: "#67E8F9" }}
                    />
                    <div className="min-w-0">
                      <div
                        className="text-sm font-semibold"
                        style={{ color: "#F8FAFC" }}
                      >
                        Normal PAR
                      </div>
                      <div
                        className="mt-0.5 text-xs"
                        style={{ color: "rgba(226,232,240,0.66)" }}
                      >
                        Keep routine stock levels aligned with actual usage.
                      </div>
                    </div>
                  </div>

                  <div
                    className="mt-0.5 flex items-center justify-between gap-2 rounded-xl px-3 py-2.5"
                    style={{ background: "rgba(15,23,42,0.78)" }}
                  >
                    <span
                      className="min-w-0 shrink text-sm"
                      style={{
                        color: "rgba(226,232,240,0.74)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Current mode
                    </span>

                    <span
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold md:text-xs"
                      style={{
                        color: "#FED7AA",
                        background: "rgba(249,115,22,0.14)",
                        border: "1px solid rgba(249,115,22,0.22)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <ClipboardCheck className="h-3 w-3" />
                      Owner review
                    </span>
                  </div>

                  <div
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                    style={{ background: "rgba(15,23,42,0.62)" }}
                  >
                    <Truck
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: "#A5B4FC" }}
                    />
                    <div className="min-w-0">
                      <div
                        className="text-sm font-semibold"
                        style={{ color: "#F8FAFC" }}
                      >
                        Vendor rhythm
                      </div>
                      <div
                        className="mt-0.5 text-xs"
                        style={{ color: "rgba(226,232,240,0.66)" }}
                      >
                        Consider cutoff times, delivery days, and package sizes.
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                    style={{ background: "rgba(15,23,42,0.62)" }}
                  >
                    <ShieldCheck
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: "#22C55E" }}
                    />
                    <div className="min-w-0">
                      <div
                        className="text-sm font-semibold"
                        style={{ color: "#F8FAFC" }}
                      >
                        Approval-backed
                      </div>
                      <div
                        className="mt-0.5 text-xs"
                        style={{ color: "rgba(226,232,240,0.66)" }}
                      >
                        Recommendations can stage drafts without sending orders.
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                    style={{ background: "rgba(15,23,42,0.62)" }}
                  >
                    <PackageCheck
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: "#22D3EE" }}
                    />
                    <div className="min-w-0">
                      <div
                        className="text-sm font-semibold"
                        style={{ color: "#F8FAFC" }}
                      >
                        Future-ready
                      </div>
                      <div
                        className="mt-0.5 text-xs"
                        style={{ color: "rgba(226,232,240,0.66)" }}
                      >
                        Built toward AI-generated vendor orders after owner approval.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div> 
      </div>
    </div>
  );
}
