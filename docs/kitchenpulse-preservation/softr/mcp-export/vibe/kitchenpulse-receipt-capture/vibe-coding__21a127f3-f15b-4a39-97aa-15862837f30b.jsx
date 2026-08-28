import { useRef, useState } from "react";
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

const RECEIPT_API = "https://project-1csz2.vercel.app/api/receipt-intake";

function KitchenPulseLockup({ brandDescriptor = "receipt capture" }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-center">
        <span
          className="text-[31px] font-black tracking-[-0.055em]"
          style={{
            color: "#F8FAFC",
            textShadow: "0 1px 16px rgba(0,0,0,0.28)",
          }}
        >
          Kitchen
        </span>

        <span
          className="text-[31px] font-black tracking-[-0.055em]"
          style={{
            color: "#22D3EE",
            textShadow: "0 0 18px rgba(34,211,238,0.32)",
          }}
        >
          Pulse
        </span>
      </div>

      <div
        className="mt-0.5 text-center text-[10px] font-bold uppercase tracking-[0.34em]"
        style={{
          color: "rgba(226,232,240,0.68)",
        }}
      >
        {brandDescriptor}
      </div>
    </div>
  );
}

export default function Block() {
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  function openCameraInput() {
    cameraInputRef.current?.click();
  }

  function openFileInput() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      setFileName("");
      setStatus("");
      setStatusType("");
      setIsSubmitted(false);
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    setStatus("");
    setStatusType("");
    setIsSubmitted(false);
  }

  function generateReceiptName() {
    const now = new Date();

    const date = now.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const time = now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    return `Mobile Receipt — ${date} ${time}`;
  }

  function resetForm() {
    setSelectedFile(null);
    setFileName("");
    setNotes("");
    setStatus("");
    setStatusType("");
    setIsSubmitting(false);
    setIsSubmitted(false);

    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submitReceipt() {
    if (!selectedFile) {
      setStatus("Take a photo or choose a receipt file first.");
      setStatusType("error");
      return;
    }

    setIsSubmitting(true);
    setStatus("Sending receipt to KitchenPulse...");
    setStatusType("success");

    try {
      const formData = new FormData();

      formData.append("receiptFile", selectedFile);
      formData.append("receiptName", generateReceiptName());
      formData.append("vendor", "");
      formData.append("receiptDate", "");
      formData.append("notes", notes);

      const response = await fetch(RECEIPT_API, {
        method: "POST",
        body: formData,
      });

      const responseText = await response.text();

      let data = null;

      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Receipt intake returned non-JSON response:", responseText);

        setStatus(
          `KitchenPulse received an unexpected response. API status: ${response.status}.`
        );
        setStatusType("error");
        setIsSubmitting(false);
        return;
      }

      if (!response.ok || !data.ok) {
        console.error("Receipt intake error:", data);

        setStatus(
          data?.error ||
            `KitchenPulse could not submit this receipt. API status: ${response.status}.`
        );
        setStatusType("error");
        setIsSubmitting(false);
        return;
      }

      window.dispatchEvent(new Event("kitchenpulse:receipts-updated"));

      window.setTimeout(() => {
        window.dispatchEvent(new Event("kitchenpulse:receipts-updated"));
      }, 1200);

      setStatus("");
      setStatusType("");
      setIsSubmitting(false);
      setIsSubmitted(true);

      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Receipt intake request failed:", error);

      setStatus(
        `KitchenPulse could not reach the receipt intake API. ${
          error?.message || "Please try again."
        }`
      );
      setStatusType("error");
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-[100svh] px-4 py-5"
      style={{
        background:
          "radial-gradient(circle at 18% 10%, rgba(34,211,238,0.18), transparent 28%), radial-gradient(circle at 82% 18%, rgba(99,102,241,0.16), transparent 28%), linear-gradient(135deg, #03101C 0%, #071827 46%, #0B1324 100%)",
      }}
    >
      <div className="mx-auto flex min-h-[calc(100svh-40px)] max-w-md flex-col justify-center">
        <div
          className="rounded-[30px] border p-5 shadow-2xl"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.088), rgba(255,255,255,0.035))",
            borderColor: "rgba(103,232,249,0.16)",
            boxShadow:
              "0 24px 70px rgba(2,8,23,0.48), inset 0 1px 0 rgba(255,255,255,0.07)",
            backdropFilter: "blur(14px)",
          }}
        >
          <div className="mb-6 flex justify-center">
            <div
              className="inline-flex items-center rounded-[22px] px-4 py-3"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025))",
                border: "1px solid rgba(255,255,255,0.09)",
                boxShadow:
                  "0 12px 30px rgba(2,8,23,0.20), inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
            >
              <KitchenPulseLockup />
            </div>
          </div>

          {isSubmitted ? (
            <div className="text-center">
              <div
                className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
                style={{
                  background: "rgba(34,197,94,0.16)",
                  border: "1px solid rgba(34,197,94,0.26)",
                  color: "#22C55E",
                }}
              >
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <h1
                className="mt-5 text-2xl font-bold tracking-[-0.035em]"
                style={{ color: "#F8FAFC" }}
              >
                Receipt sent
              </h1>

              <p
                className="mx-auto mt-2 max-w-xs text-sm leading-6"
                style={{ color: "rgba(226,232,240,0.74)" }}
              >
                KitchenPulse saved this receipt for review. You can close this
                screen or submit another one.
              </p>

              {fileName && (
                <div
                  className="mx-auto mt-4 max-w-full truncate rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{
                    color: "#BBF7D0",
                    background: "rgba(34,197,94,0.12)",
                    border: "1px solid rgba(34,197,94,0.22)",
                  }}
                >
                  {fileName}
                </div>
              )}

              <button
                type="button"
                onClick={resetForm}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-bold text-white shadow-lg transition active:scale-[0.99]"
                style={{
                  background: "#0F172A",
                  boxShadow: "0 14px 30px rgba(2,8,23,0.32)",
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Submit another receipt
              </button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h1
                  className="text-2xl font-bold tracking-[-0.035em]"
                  style={{ color: "#F8FAFC" }}
                >
                  Upload a receipt
                </h1>

                <p
                  className="mx-auto mt-2 max-w-xs text-sm leading-6"
                  style={{ color: "rgba(226,232,240,0.74)" }}
                >
                  Take a photo or choose a receipt file. KitchenPulse will stage
                  it for review.
                </p>
              </div>

              <div
                className="mt-6 rounded-[24px] border p-4 text-center"
                style={{
                  background: "rgba(15,23,42,0.58)",
                  borderColor: selectedFile
                    ? "rgba(34,197,94,0.34)"
                    : "rgba(255,255,255,0.10)",
                }}
              >
                <div
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    background: selectedFile
                      ? "rgba(34,197,94,0.16)"
                      : "rgba(34,211,238,0.12)",
                    border: selectedFile
                      ? "1px solid rgba(34,197,94,0.26)"
                      : "1px solid rgba(34,211,238,0.22)",
                    color: selectedFile ? "#22C55E" : "#67E8F9",
                  }}
                >
                  {selectedFile ? (
                    <CheckCircle2 className="h-8 w-8" />
                  ) : (
                    <Camera className="h-8 w-8" />
                  )}
                </div>

                <div
                  className="mt-4 text-base font-semibold"
                  style={{ color: "#F8FAFC" }}
                >
                  {selectedFile ? "Receipt ready" : "No receipt selected"}
                </div>

                <div
                  className="mx-auto mt-1 max-w-xs text-xs leading-5"
                  style={{ color: "rgba(226,232,240,0.64)" }}
                >
                  {selectedFile
                    ? fileName
                    : "Use the camera for fastest staff entry."}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={openCameraInput}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-bold text-white shadow-lg transition active:scale-[0.99]"
                    style={{
                      background: "linear-gradient(135deg, #0891B2, #0E7490)",
                      boxShadow: "0 14px 30px rgba(8,145,178,0.24)",
                    }}
                  >
                    <Camera className="h-4 w-4" />
                    Take photo
                  </button>

                  <button
                    type="button"
                    onClick={openFileInput}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-bold transition active:scale-[0.99]"
                    style={{
                      color: "#E0F2FE",
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.11)",
                    }}
                  >
                    <Upload className="h-4 w-4" />
                    Choose file
                  </button>
                </div>

                <input
                  ref={cameraInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                />

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                />
              </div>

              <div className="mt-4">
                <label
                  className="text-xs font-bold uppercase tracking-[0.16em]"
                  style={{ color: "rgba(226,232,240,0.58)" }}
                >
                  Optional note
                </label>

                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  placeholder="Example: liquor order, produce delivery, unreadable total..."
                  className="mt-2 w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none"
                  style={{
                    color: "#F8FAFC",
                    background: "rgba(15,23,42,0.62)",
                    borderColor: "rgba(255,255,255,0.11)",
                  }}
                />
              </div>

              <button
                type="button"
                onClick={submitReceipt}
                disabled={!selectedFile || isSubmitting}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-bold text-white shadow-lg transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
                style={{
                  background:
                    selectedFile && !isSubmitting
                      ? "linear-gradient(135deg, #22C55E, #16A34A)"
                      : "rgba(148,163,184,0.56)",
                  boxShadow:
                    selectedFile && !isSubmitting
                      ? "0 14px 30px rgba(34,197,94,0.22)"
                      : "none",
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Submit receipt
                  </>
                )}
              </button>

              {status && (
                <div
                  className="mt-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm leading-5"
                  style={{
                    color: statusType === "error" ? "#FCA5A5" : "#BBF7D0",
                    background:
                      statusType === "error"
                        ? "rgba(127,29,29,0.22)"
                        : "rgba(20,83,45,0.22)",
                    borderColor:
                      statusType === "error"
                        ? "rgba(248,113,113,0.24)"
                        : "rgba(34,197,94,0.24)",
                  }}
                >
                  {statusType === "error" ? (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <div>{status}</div>
                </div>
              )}

              <div
                className="mt-4 text-center text-[11px] leading-5"
                style={{ color: "rgba(226,232,240,0.50)" }}
              >
                Receipts are staged for review before costs or inventory are
                updated.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
