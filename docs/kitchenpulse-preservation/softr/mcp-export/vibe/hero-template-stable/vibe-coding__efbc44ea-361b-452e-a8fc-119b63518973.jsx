import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/user";
import { useImageSetting, useTextSetting } from "@/lib/editable-settings";

export default function Block(props) {
  const user = useCurrentUser();
  const [liveHero, setLiveHero] = useState({});

  useEffect(() => {
    const timer = setTimeout(() => {
      const buttons = Array.from(document.querySelectorAll("a, button"));

      const openButton = buttons.find((el) => {
        const text = (el.innerText || "").trim().toLowerCase();
        if (el.id === "kp-open-brief-btn") return false;
        return text === "open";
      });

      if (!openButton) return;

      let row = openButton;
      for (let i = 0; i < 8 && row; i++) {
        const rowText = row.innerText || "";
        if (
          rowText.includes("Protect margin") ||
          rowText.includes("Review") ||
          rowText.includes("MEDIUM") ||
          rowText.includes("HIGH") ||
          rowText.includes("Dinner live") ||
          rowText.includes("Pre-dinner")
        ) {
          break;
        }
        row = row.parentElement;
      }

      const lines = (row?.innerText || "")
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean)
        .filter((x) => x.toLowerCase() !== "open");

      setLiveHero({
        headline: lines[0] || "",
        subheadline: lines[1] || "",
        cardValue: lines[1] || "",
        cardPriority: lines[3] || "",
        timeContext: lines[2] || "",
      });
      const heroBtn = document.getElementById("kp-hero-brief-btn");

if (heroBtn) {
  heroBtn.onclick = () => {
    const buttons = Array.from(document.querySelectorAll("a, button"));

    const openButton = buttons.find((el) => {
      const text = (el.innerText || "").trim().toLowerCase();
      return text === "open";
    });

    if (!openButton) {
      alert("Latest brief not ready. Refresh and try again.");
      return;
    }

    openButton.click();
  };
}
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  const avatar = useImageSetting({
    name: "avatar",
    label: "Fallback avatar",
    initialValue: {
      src: "https://assets.softr-files.com/assets/blocks/v5/mock-images/avatar/avatar-08.jpg",
    },
  });

  const eyebrowFallback = useTextSetting({
    name: "eyebrow",
    label: "Fallback eyebrow",
    initialValue: "KitchenPulse",
  });

  const fallbackHeadline = useTextSetting({
    name: "fallback-headline",
    label: "Fallback headline",
    initialValue: "Today’s Decision",
  });

  const fallbackSubheadline = useTextSetting({
    name: "fallback-subheadline",
    label: "Fallback subheadline",
    initialValue: "Focus on what moves revenue before service slips.",
  });

  const fallbackSignalLabel = useTextSetting({
    name: "fallback-signal-label",
    label: "Fallback signal label",
    initialValue: "TODAY'S CALL",
  });

  const fallbackSignalValue = useTextSetting({
    name: "fallback-signal-value",
    label: "Fallback signal value",
    initialValue: "Feature Ribeye Steak (14oz)",
  });

  const fallbackPriorityLabel = useTextSetting({
    name: "fallback-priority-label",
    label: "Fallback priority label",
    initialValue: "Priority",
  });

  const fallbackPriorityValue = useTextSetting({
    name: "fallback-priority-value",
    label: "Fallback priority value",
    initialValue: "Medium",
  });

  const eyebrow = props?.eyebrow || eyebrowFallback;
  const headline = liveHero.headline || props?.heroHeadline || fallbackHeadline;
  const subheadline =
  props?.heroSubheadline || "Operator guidance, updated from the latest brief.";

  const pill1 = props?.heroPill1 || "Live brief ready";
  const pill2 = props?.heroPill2 || "Operator AI live";
  const pill3 = liveHero.timeContext || props?.heroPill3 || "";

  const signalLabel = props?.signalLabel || fallbackSignalLabel;
  const signalValue =
    liveHero.cardValue || props?.heroCardValue || fallbackSignalValue;
  const priorityLabel = props?.priorityLabel || fallbackPriorityLabel;
  const priorityValue =
    liveHero.cardPriority || props?.heroCardPriority || fallbackPriorityValue;

  const priorityText = String(priorityValue || "").toLowerCase();
const openLatestBrief = () => {
  const buttons = Array.from(document.querySelectorAll("a, button"));

  const openButton = buttons.find((el) => {
    if (el.id === "kp-hero-brief-btn") return false;
    if (el.id === "kp-open-brief-btn") return false;

    const text = (el.innerText || "").trim().toLowerCase();
    return text === "open";
  });

  if (!openButton) {
    alert("Latest brief not ready. Refresh and try again.");
    return;
  }

  openButton.click();
};
  const priorityStyle = priorityText.includes("high")
    ? {
        color: "#FCA5A5",
        background: "rgba(239,68,68,0.18)",
        border: "1px solid rgba(239,68,68,0.25)",
      }
    : priorityText.includes("low")
    ? {
        color: "#86EFAC",
        background: "rgba(34,197,94,0.18)",
        border: "1px solid rgba(34,197,94,0.25)",
      }
    : {
        color: "#FED7AA",
        background: "rgba(249,115,22,0.14)",
        border: "1px solid rgba(249,115,22,0.22)",
      };

  return (
    <div className="container relative overflow-hidden py-6 md:py-8 lg:py-10">
      <div
        className="relative overflow-hidden rounded-[28px] border shadow-2xl"
        style={{
          background:
            "linear-gradient(135deg, #07111F 0%, #0B1324 44%, #101936 100%)",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 14% 20%, rgba(34,211,238,0.22), transparent 28%), radial-gradient(circle at 78% 18%, rgba(99,102,241,0.20), transparent 24%), radial-gradient(circle at 68% 78%, rgba(56,189,248,0.10), transparent 30%)",
          }}
        />

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "38px 38px",
            opacity: 0.18,
          }}
        />

        <div className="relative z-10 px-6 py-7 md:px-10 md:py-10 lg:px-12 lg:py-12">
          <div className="grid gap-8 lg:gap-10" style={{ gridTemplateColumns: "1.35fr 0.85fr" }}>
            <div className="min-w-0">
              <div className="flex items-center gap-4 mb-5">
                <img
                  src={user && user.avatar ? user.avatar : avatar.src}
                  alt="User avatar"
                  className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border shadow-lg"
                  style={{ borderColor: "rgba(255,255,255,0.16)" }}
                />
                <div className="min-w-0">
                  <div className="text-sm md:text-[15px] font-semibold tracking-wide" style={{ color: "#67E8F9" }}>
                    {eyebrow}
                  </div>
                  <div className="text-xs md:text-sm mt-1" style={{ color: "rgba(226,232,240,0.72)" }}>
                    Welcome back, {user && user.firstName ? user.firstName : "there"}
                  </div>
                </div>
              </div>

              <h1
                className="font-semibold tracking-[-0.03em] max-w-3xl"
                style={{
                  color: "#F8FAFC",
                  fontSize: "clamp(30px, 3.3vw, 48px)",
                  lineHeight: "1.02",
                }}
              >
                {headline}
              </h1>

              <p
                className="mt-4 max-w-2xl"
                style={{
                  color: "rgba(226,232,240,0.84)",
                  fontSize: "clamp(14px, 1.4vw, 19px)",
                  lineHeight: "1.6",
                }}
              >
                {subheadline}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs md:text-sm font-medium" style={{
                  color: "#E0F2FE",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}>
                  <span className="inline-block w-2 h-2 rounded-full" style={{
                    background: "#22C55E",
                    boxShadow: "0 0 12px rgba(34,197,94,0.75)",
                  }} />
                  {pill1}
                </span>

                <span className="inline-flex items-center rounded-full px-3 py-1.5 text-xs md:text-sm font-medium" style={{
                  color: "#67E8F9",
                  background: "rgba(34,211,238,0.08)",
                  border: "1px solid rgba(34,211,238,0.16)",
                }}>
                  {pill2}
                </span>

                {pill3 ? (
                  <span className="inline-flex items-center rounded-full px-3 py-1.5 text-xs md:text-sm font-medium" style={{
                    color: "#C7D2FE",
                    background: "rgba(99,102,241,0.12)",
                    border: "1px solid rgba(99,102,241,0.20)",
                  }}>
                    {pill3}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="min-w-0">
              <div
                className="rounded-[22px] p-5 md:p-6"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  backdropFilter: "blur(10px)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              >
                <div style={{
                  color: "#67E8F9",
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}>
                  {signalLabel}
                </div>

                <div className="mt-3 font-semibold" style={{
                  color: "#F8FAFC",
                  fontSize: "clamp(22px, 2vw, 30px)",
                  lineHeight: "1.15",
                }}>
                  {signalValue}
                </div>

                

                <div className="mt-5 rounded-xl px-4 py-3 flex items-center justify-between" style={{
                  background: "rgba(15,23,42,0.62)",
                }}>
                  <span style={{
                    color: "rgba(226,232,240,0.74)",
                    fontSize: "14px",
                  }}>
                    {priorityLabel}
                  </span>

                  <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold" style={priorityStyle}>
                    {priorityValue}
                  </span>
                </div>
                <div className="mt-4">
  <button
                    id="kp-hero-brief-btn"
                    onClick={openLatestBrief}
    onMouseEnter={(e) => {
  e.currentTarget.style.transform = "translateY(-1px)";
}}
onMouseLeave={(e) => {
  e.currentTarget.style.transform = "translateY(0)";
}}
    className="w-full rounded-lg px-4 py-2.5 font-semibold"
    style={{
  background: "linear-gradient(135deg, #1da1d2, #0ea5e9)",
  color: "#fff",
  boxShadow: "0 10px 28px rgba(14,165,233,.35)",
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
  letterSpacing: ".02em"
}}
  >
    Review Brief →
  </button>
</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
