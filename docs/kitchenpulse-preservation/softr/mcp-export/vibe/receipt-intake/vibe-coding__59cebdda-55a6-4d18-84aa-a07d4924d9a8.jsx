import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

const RECEIPT_API = "https://project-1csz2.vercel.app/api/receipt-intake";

function StatusPill({ children, tone = "default", icon: Icon }) {
  const styles =
    tone === "safe"
      ? {
          color: "#0F766E",
          bg: "rgba(20,184,166,0.07)",
          border: "rgba(20,184,166,0.13)",
        }
      : tone === "review"
        ? {
            color: "#0891B2",
            bg: "rgba(34,211,238,0.08)",
            border: "rgba(34,211,238,0.14)",
          }
        : {
            color: "#475569",
            bg: "rgba(100,116,139,0.07)",
            border: "rgba(100,116,139,0.12)",
          };

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

function InfoCard({ icon: Icon, title, text, tone = "default" }) {
  const styles =
    tone === "safe"
      ? {
          color: "#0F766E",
          bg: "rgba(20,184,166,0.07)",
          border: "rgba(20,184,166,0.13)",
          glow: "rgba(20,184,166,0.04)",
        }
      : tone === "file"
        ? {
            color: "#2563EB",
            bg: "rgba(59,130,246,0.08)",
            border: "rgba(59,130,246,0.14)",
            glow: "rgba(59,130,246,0.045)",
          }
        : {
            color: "#0891B2",
            bg: "rgba(34,211,238,0.08)",
            border: "rgba(34,211,238,0.14)",
            glow: "rgba(34,211,238,0.045)",
          };

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

      <div className="relative z-10 flex items-start gap-3">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border"
          style={{
            color: styles.color,
            background: styles.bg,
            borderColor: styles.border,
          }}
        >
          <Icon className="h-4 w-4" />
        </span>

        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {text}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Block() {
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [receiptName, setReceiptName] = useState("");
  const [vendor, setVendor] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [notes, setNotes] = useState("");
  const [fileName, setFileName] = useState("");
  const [submittedFileName, setSubmittedFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [showOptional, setShowOptional] = useState(false);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

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
    setSubmittedFileName("");
    setStatus("");
    setStatusType("");
    setIsSubmitted(false);
  }

  function openCameraInput() {
    cameraInputRef.current?.click();
  }

  function openFileInput() {
    fileInputRef.current?.click();
  }

  function generateFallbackName() {
    const now = new Date();
    const date = now.toLocaleDateString();
    const time = now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    return `Receipt Upload — ${date} ${time}`;
  }

  function resetReceiptForm() {
    setReceiptName("");
    setVendor("");
    setReceiptDate("");
    setNotes("");
    setSelectedFile(null);
    setFileName("");
    setSubmittedFileName("");
    setShowOptional(false);
    setStatus("");
    setStatusType("");
    setIsSubmitted(false);
    setIsSubmitting(false);

    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleStageReceipt() {
    if (!selectedFile) {
      setStatus("Add a receipt photo, PDF, or file first.");
      setStatusType("error");
      return;
    }

    const finalReceiptName = receiptName.trim() || generateFallbackName();

    setIsSubmitting(true);
    setStatus("Submitting receipt...");
    setStatusType("success");

    try {
      const formData = new FormData();

      formData.append("receiptFile", selectedFile);
      formData.append("receiptName", finalReceiptName);
      formData.append("vendor", vendor);
      formData.append("receiptDate", receiptDate);
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
          `Receipt intake API returned a non-JSON response. Status: ${response.status}. Check that /api/receipt-intake exists on the deployed Vercel project.`
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

      setSubmittedFileName(selectedFile.name);
      setIsSubmitted(true);
      setStatus("");
      setStatusType("");
      window.dispatchEvent(new Event("kitchenpulse:receipts-updated"));

      window.setTimeout(() => {
        window.dispatchEvent(new Event("kitchenpulse:receipts-updated"));
      }, 1200);

      setReceiptName("");
      setVendor("");
      setReceiptDate("");
      setNotes("");
      setSelectedFile(null);
      setFileName("");
      setShowOptional(false);
      setIsSubmitting(false);

      if (cameraInputRef.current) {
        cameraInputRef.current.value = "";
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Receipt intake request failed:", error);

      setStatus(
        `KitchenPulse could not reach the receipt intake API. Browser/network error: ${
          error?.message || "Unknown error"
        }`
      );
      setStatusType("error");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container py-4">
      <div className="content mx-auto max-w-5xl space-y-4">
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
                    Receipt Intake
                  </div>

                  <StatusPill tone="safe" icon={ShieldCheck}>
                    Owner intake
                  </StatusPill>

                  <StatusPill tone="review" icon={FileText}>
                    Review first
                  </StatusPill>
                </div>

                <h2 className="text-2xl font-heading font-semibold tracking-tight">
                  Submit a Receipt
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Take a photo or upload a receipt, then submit it for review.
                  KitchenPulse will read the vendor, date, total, and line items
                  later. Nothing updates costs or inventory until approved.
                </p>
              </div>

              <div
                className="rounded-2xl border px-4 py-3 text-sm shadow-sm md:max-w-xs"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
                  borderColor: "rgba(15,23,42,0.08)",
                }}
              >
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-teal-700" />
                  <div>
                    <div className="font-semibold text-foreground">Safe staging</div>
                    <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Nothing updates costs or inventory until approved.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="overflow-hidden rounded-3xl border border-dashed shadow-sm"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.72))",
                borderColor: "rgba(15,23,42,0.12)",
                boxShadow:
                  "0 10px 24px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.84)",
              }}
            >
              {isSubmitted ? (
                <div className="p-6 text-center md:p-10">
                  <div
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white shadow-md"
                    style={{
                      background:
                        "linear-gradient(135deg, #0F766E 0%, #0891B2 100%)",
                      boxShadow: "0 14px 28px rgba(15,118,110,0.20)",
                    }}
                  >
                    <CheckCircle2 className="h-8 w-8" />
                  </div>

                  <div className="mt-5 text-xl font-semibold">
                    Receipt submitted for review
                  </div>

                  <div className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    KitchenPulse saved this receipt for review. Nothing updates
                    costs or inventory until approved.
                  </div>

                  {submittedFileName && (
                    <div
                      className="mx-auto mt-3 inline-flex max-w-xl items-center rounded-full border px-3 py-1 text-xs font-semibold"
                      style={{
                        color: "#0F766E",
                        background: "rgba(20,184,166,0.07)",
                        borderColor: "rgba(20,184,166,0.13)",
                      }}
                    >
                      {submittedFileName}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={resetReceiptForm}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    <Upload className="h-4 w-4" />
                    Submit another receipt
                  </button>
                </div>
              ) : (
                <div className="p-6 text-center md:p-10">
                  <div
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white shadow-md"
                    style={{
                      background: selectedFile
                        ? "linear-gradient(135deg, #0F766E 0%, #0891B2 100%)"
                        : "linear-gradient(135deg, #04111F 0%, #0F172A 100%)",
                      boxShadow: selectedFile
                        ? "0 14px 28px rgba(15,118,110,0.20)"
                        : "0 14px 28px rgba(2,8,23,0.18)",
                    }}
                  >
                    {selectedFile ? (
                      <CheckCircle2 className="h-8 w-8" />
                    ) : (
                      <Camera className="h-8 w-8" />
                    )}
                  </div>

                  <div className="mt-5 text-xl font-semibold">
                    {selectedFile
                      ? "Receipt ready to submit"
                      : "Take photo or upload receipt"}
                  </div>

                  <div className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    {selectedFile ? (
                      <>
                        <div className="font-medium text-foreground">
                          {fileName}
                        </div>
                        <div className="mt-2">
                          Click Submit Receipt below to send it for review.
                        </div>
                      </>
                    ) : (
                      "Use a phone camera, photo library, PDF, or file upload. No typing required unless KitchenPulse needs help reading it."
                    )}
                  </div>

                  <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={openCameraInput}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                    >
                      <Camera className="h-4 w-4" />
                      Take photo
                    </button>

                    <button
                      type="button"
                      onClick={openFileInput}
                      className="inline-flex items-center justify-center gap-2 rounded-full border bg-white/80 px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-slate-50"
                      style={{ borderColor: "rgba(15,23,42,0.10)" }}
                    >
                      <Upload className="h-4 w-4" />
                      Choose receipt file
                    </button>
                  </div>

                  <div className="mx-auto mt-3 max-w-xl text-xs text-muted-foreground">
                    On mobile, Take photo opens the camera. Choose receipt file
                    opens photos, PDFs, or files.
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
              )}
            </div>

            {!isSubmitted && (
              <>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowOptional(!showOptional)}
                    className="inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-slate-50"
                    style={{ borderColor: "rgba(15,23,42,0.10)" }}
                  >
                    {showOptional ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    {showOptional
                      ? "Hide optional details"
                      : "Add optional details"}
                  </button>

                  {showOptional && (
                    <div
                      className="mt-4 rounded-2xl border p-4 shadow-sm"
                      style={{
                        background:
                          "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))",
                        borderColor: "rgba(15,23,42,0.08)",
                      }}
                    >
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Receipt / Invoice Name
                          </label>
                          <input
                            value={receiptName}
                            onChange={(event) =>
                              setReceiptName(event.target.value)
                            }
                            placeholder="Optional — KitchenPulse can generate this"
                            className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Vendor
                          </label>
                          <input
                            value={vendor}
                            onChange={(event) => setVendor(event.target.value)}
                            placeholder="Optional — Sysco, liquor delivery, etc."
                            className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Receipt Date
                          </label>
                          <input
                            type="date"
                            value={receiptDate}
                            onChange={(event) =>
                              setReceiptDate(event.target.value)
                            }
                            className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Notes
                          </label>
                          <input
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            placeholder="Optional — anything the owner should know"
                            className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <button
                    type="button"
                    onClick={handleStageReceipt}
                    disabled={!selectedFile || isSubmitting}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition ${
                      selectedFile && !isSubmitting
                        ? "bg-teal-700 hover:bg-teal-800 shadow-md shadow-teal-900/15"
                        : "cursor-not-allowed bg-slate-400"
                    }`}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    {isSubmitting ? "Submitting..." : "Submit Receipt"}
                  </button>

                  <div className="text-xs text-muted-foreground">
                    Required: receipt photo or file. Everything else can be read later.
                  </div>
                </div>
              </>
            )}

            {status && (
              <div
                className="mt-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm"
                style={{
                  color: statusType === "error" ? "#B91C1C" : "#0F766E",
                  background:
                    statusType === "error"
                      ? "rgba(254,242,242,0.88)"
                      : "rgba(20,184,166,0.07)",
                  borderColor:
                    statusType === "error"
                      ? "rgba(254,202,202,0.90)"
                      : "rgba(20,184,166,0.13)",
                }}
              >
                {statusType === "error" ? (
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4" />
                )}
                <div>{status}</div>
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-3">
          <InfoCard
            icon={Camera}
            title="Simple capture"
            text="Staff only need to add a photo or file."
            tone="default"
          />

          <InfoCard
            icon={FileText}
            title="AI-readable"
            text="Vendor, date, totals, and lines can be parsed after upload."
            tone="file"
          />

          <InfoCard
            icon={ShieldCheck}
            title="Review required"
            text="Unclear receipts get questions before approval."
            tone="safe"
          />
        </div>
      </div>
    </div>
  );
}
