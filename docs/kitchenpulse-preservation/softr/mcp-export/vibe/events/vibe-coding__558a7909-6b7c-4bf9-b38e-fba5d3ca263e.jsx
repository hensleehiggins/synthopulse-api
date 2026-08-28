import { useState } from "react";
import { useTextSetting } from "@/lib/editable-settings";
import { Button } from "@/components/ui/button";

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
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventName, setEventName] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [venueArea, setVenueArea] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  const eyebrowFallback = useTextSetting({
    name: "eyebrow",
    label: "Fallback eyebrow",
    initialValue: "KitchenPulse",
  });

  const brandDescriptor = useTextSetting({
    name: "brand-descriptor",
    label: "Brand descriptor",
    initialValue: "AI for restaurant operators",
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

  const eyebrow = props?.eyebrow || eyebrowFallback;
  const headline = props?.heroHeadline || fallbackHeadline;
  const subheadline = props?.heroSubheadline || fallbackSubheadline;

  const pill1 = props?.heroPill1 || "Event signals live";
  const pill2 = props?.heroPill2 || "Traffic aware";
  const pill3 = props?.heroPill3 || "Demand pressure";

  const signalLabel = props?.signalLabel || fallbackSignalLabel;
  const signalValue = props?.heroCardValue || fallbackSignalValue;

  function resetForm() {
    setEventName("");
    setStartDateTime("");
    setVenueArea("");
    setSubmitMessage("");
  }

  function closeForm() {
    setShowEventForm(false);
    resetForm();
  }

  async function submitEvent() {
    if (!eventName || !startDateTime || !venueArea) {
      setSubmitMessage("Event name, start date/time, and venue are required.");
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage("");

    const submittedEvent = {
      eventName,
      startDateTime,
      venueArea,
    };

    try {
      const res = await fetch(
        "https://project-1csz2.vercel.app/api/create-local-event",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submittedEvent),
        }
      );

      const data = await res.json();

      if (!data?.ok) {
        throw new Error(data?.error || "Event could not be created.");
      }

      const createdEventForPage =
        data.event || {
          id: data.recordId || data.id || `temp-${Date.now()}`,
          recordId: data.recordId || data.id || `temp-${Date.now()}`,
          eventName: submittedEvent.eventName,
          description: submittedEvent.eventName,
          startDateTime: submittedEvent.startDateTime,
          endDateTime: data.endDateTime || "",
          displayDate: submittedEvent.startDateTime,
          venueArea: submittedEvent.venueArea,
          type: "Event",
          source: "Manual",
          sourceType: "Manual",
          showOnServicePressure: true,
          active: true,
          activeEvent: true,
          decisionDriving: true,
          trafficEffect: "Very High",
          confidence: "Very High",
          estimatedDraw: "Very High",
          eventWeight: 10,
        };

      window.dispatchEvent(
        new CustomEvent("kp:service-pressure-event-created", {
          detail: createdEventForPage,
        })
      );

      setSubmitMessage("Event added.");
      resetForm();
      setShowEventForm(false);
    } catch (err) {
      setSubmitMessage(err.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

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
              "radial-gradient(circle at 16% 18%, rgba(34,211,238,0.23), transparent 28%), radial-gradient(circle at 76% 14%, rgba(14,165,233,0.20), transparent 26%), radial-gradient(circle at 82% 84%, rgba(34,211,238,0.20), transparent 34%)",
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

        <div className="relative z-10 px-6 py-7 md:px-10 md:py-10 lg:px-12 lg:py-12">
          <div className="grid grid-cols-1 gap-8 lg:gap-10 lg:grid-cols-[1.35fr_0.85fr]">
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
                className="font-semibold tracking-[-0.035em] max-w-3xl"
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
                  fontSize: "clamp(14px, 1.4vw, 19px)",
                  lineHeight: "1.6",
                }}
              >
                {subheadline}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs md:text-sm font-medium"
                  style={{
                    color: "#E0F2FE",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{
                      background: "#22C55E",
                      boxShadow: "0 0 12px rgba(34,197,94,0.75)",
                    }}
                  />
                  {pill1}
                </span>

                <span
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-xs md:text-sm font-medium"
                  style={{
                    color: "#67E8F9",
                    background: "rgba(34,211,238,0.08)",
                    border: "1px solid rgba(34,211,238,0.16)",
                  }}
                >
                  {pill2}
                </span>

                <span
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-xs md:text-sm font-medium"
                  style={{
                    color: "#C7D2FE",
                    background: "rgba(99,102,241,0.12)",
                    border: "1px solid rgba(99,102,241,0.20)",
                  }}
                >
                  {pill3}
                </span>
              </div>
            </div>

            <div className="min-w-0">
              <div
                className="rounded-[24px] p-5 md:p-6"
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
                  {signalLabel}
                </div>

                <div
                  className="mt-3 font-semibold"
                  style={{
                    color: "#F8FAFC",
                    fontSize: "clamp(22px, 2vw, 30px)",
                    lineHeight: "1.15",
                  }}
                >
                  {signalValue}
                </div>

                <div
                  className="mt-3"
                  style={{
                    color: "rgba(226,232,240,0.78)",
                    fontSize: "14px",
                    lineHeight: "1.5",
                  }}
                >
                  Surface the local events driving traffic, timing, and demand
                  pressure on today’s service window.
                </div>

                <div className="mt-5">
                  <Button
                    type="button"
                    onClick={() => {
                      setSubmitMessage("");
                      setShowEventForm(true);
                    }}
                    className="w-full font-semibold"
                    style={{
                      background:
                        "linear-gradient(135deg, #06B6D4 0%, #168FC3 55%, #2563EB 100%)",
                      color: "#fff",
                      boxShadow: "0 9px 22px rgba(34,211,238,.26)",
                      border: "1px solid rgba(255,255,255,0.14)",
                    }}
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
                <div
                  className="text-xs font-bold tracking-[0.14em] uppercase"
                  style={{ color: "#0891B2" }}
                >
                  Local Event
                </div>
                <h2 className="mt-1 text-xl font-semibold">Add Local Event</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add a local event directly into demand pressure.
                </p>
              </div>

              <button type="button" onClick={closeForm}>
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
              <div className="mt-3 text-sm text-slate-600">
                {submitMessage}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg px-4 py-2 text-sm font-semibold"
                style={{ background: "#F1F5F9" }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={submitEvent}
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
