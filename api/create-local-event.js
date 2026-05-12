import { useState } from "react";
import { useCurrentUser } from "@/lib/user";
import { useImageSetting, useTextSetting } from "@/lib/editable-settings";
import { Button } from "@/components/ui/button";

export default function Block(props) {
  const user = useCurrentUser();
  const [showEventForm, setShowEventForm] = useState(false);
const [eventName, setEventName] = useState("");
const [startDateTime, setStartDateTime] = useState("");
const [venueArea, setVenueArea] = useState("");
const [isSubmitting, setIsSubmitting] = useState(false);
const [submitMessage, setSubmitMessage] = useState("");

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
    initialValue: "Local Events & Demand Pressure",
  });

  const fallbackSubheadline = useTextSetting({
    name: "fallback-subheadline",
    label: "Fallback subheadline",
    initialValue:
      "Track events, weather, and local traffic that may change today’s service pattern.",
  });

  const fallbackSignalLabel = useTextSetting({
    name: "fallback-signal-label",
    label: "Fallback signal label",
    initialValue: "DEMAND DRIVERS",
  });

  const fallbackSignalValue = useTextSetting({
    name: "fallback-signal-value",
    label: "Fallback signal value",
    initialValue: "What’s shaping demand today.",
  });

  const fallbackPriorityLabel = useTextSetting({
    name: "fallback-priority-label",
    label: "Fallback priority label",
    initialValue: "Status",
  });

  const fallbackPriorityValue = useTextSetting({
    name: "fallback-priority-value",
    label: "Fallback priority value",
    initialValue: "Live Watch",
  });
  

  

  const eyebrow = props?.eyebrow || eyebrowFallback;
  const headline = props?.heroHeadline || fallbackHeadline;
  const subheadline = props?.heroSubheadline || fallbackSubheadline;

  const pill1 = props?.heroPill1 || "Event signals live";
  const pill2 = props?.heroPill2 || "Traffic aware";
  const pill3 = props?.heroPill3 || "Demand pressure";

  const signalLabel = props?.signalLabel || fallbackSignalLabel;
  const signalValue = props?.heroCardValue || fallbackSignalValue;
  const priorityLabel = props?.priorityLabel || fallbackPriorityLabel;
  const priorityValue = props?.heroCardPriority || fallbackPriorityValue;

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
          <div className="grid grid-cols-1 gap-8 lg:gap-10 lg:grid-cols-[1.35fr_0.85fr]">
            <div className="min-w-0">
              <div className="flex items-center gap-4 mb-5">
                <img
                  src={user && user.avatar ? user.avatar : avatar.src}
                  alt="User avatar"
                  className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border shadow-lg"
                  style={{ borderColor: "rgba(255,255,255,0.16)" }}
                />
                <div>
                  <div className="text-sm md:text-[15px] font-semibold tracking-wide" style={{ color: "#67E8F9" }}>
                    {eyebrow}
                  </div>
                  <div className="text-xs md:text-sm mt-1" style={{ color: "rgba(226,232,240,0.72)" }}>
                    Welcome back, {user && user.firstName ? user.firstName : "there"}
                  </div>
                </div>
              </div>

              <h1 className="font-semibold tracking-[-0.03em] max-w-3xl" style={{ color: "#F8FAFC", fontSize: "clamp(32px, 4vw, 54px)", lineHeight: "1.02" }}>
                {headline}
              </h1>

              <p className="mt-4 max-w-2xl" style={{ color: "rgba(226,232,240,0.84)", fontSize: "clamp(14px, 1.4vw, 19px)", lineHeight: "1.6" }}>
                {subheadline}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs md:text-sm font-medium" style={{ color: "#E0F2FE", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}>
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#22C55E", boxShadow: "0 0 12px rgba(34,197,94,0.75)" }} />
                  {pill1}
                </span>
                <span className="inline-flex items-center rounded-full px-3 py-1.5 text-xs md:text-sm font-medium" style={{ color: "#67E8F9", background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.16)" }}>
                  {pill2}
                </span>
                <span className="inline-flex items-center rounded-full px-3 py-1.5 text-xs md:text-sm font-medium" style={{ color: "#C7D2FE", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.20)" }}>
                  {pill3}
                </span>
              </div>
            </div>

            <div className="min-w-0">
              <div className="rounded-[22px] p-5 md:p-6" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", backdropFilter: "blur(10px)" }}>
                <div style={{ color: "#67E8F9", fontSize: "12px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                  {signalLabel}
                </div>
                <div className="mt-3 font-semibold" style={{ color: "#F8FAFC", fontSize: "clamp(22px, 2vw, 30px)", lineHeight: "1.15" }}>
                  {signalValue}
                </div>
                <div className="mt-3" style={{ color: "rgba(226,232,240,0.78)", fontSize: "14px", lineHeight: "1.5" }}>
                  Surface the local events driving traffic, timing, and demand pressure on today’s service window.
                </div>
                <div className="mt-5">
                  <Button
  type="button"
  onClick={() => setShowEventForm(true)}
  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
>
  + Add Local Event
</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
            {showEventForm ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
          style={{ background: "rgba(15,23,42,0.62)" }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold tracking-[0.14em] uppercase" style={{ color: "#0891B2" }}>
                  Local Event
                </div>
                <h2 className="mt-1 text-xl font-semibold">Add Local Event</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add a local event directly into demand pressure.
                </p>
              </div>

              <button type="button" onClick={() => setShowEventForm(false)}>
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <input
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
                placeholder="Event name"
              />

              <input
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />

              <input
                value={venueArea}
                onChange={(e) => setVenueArea(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
                placeholder="Venue / Area"
              />
            </div>

            {submitMessage ? (
              <div className="mt-3 text-sm text-slate-600">{submitMessage}</div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEventForm(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold"
                style={{ background: "#F1F5F9" }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  if (!eventName || !startDateTime || !venueArea) {
                    setSubmitMessage("Event name, start date/time, and venue are required.");
                    return;
                  }

                  setIsSubmitting(true);
                  setSubmitMessage("");

                  try {
                    const res = await fetch("https://project-1csz2.vercel.app/api/create-local-event", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        eventName,
                        startDateTime,
                        venueArea,
                      }),
                    });

                    const data = await res.json();

                    if (!data?.ok) throw new Error(data?.error || "Event could not be created.");

                    setSubmitMessage("Event added.");
                    setTimeout(() => window.location.reload(), 700);
                  } catch (err) {
                    setSubmitMessage(err.message || "Something went wrong.");
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ background: "#168FC3" }}
              >
                {isSubmitting ? "Adding..." : "Add Event"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
    
