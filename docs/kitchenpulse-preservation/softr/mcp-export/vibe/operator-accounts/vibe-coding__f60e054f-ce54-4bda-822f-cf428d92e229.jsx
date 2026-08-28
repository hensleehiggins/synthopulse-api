import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  MailPlus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";

const ACCOUNT_API = "https://project-1csz2.vercel.app/api/operator-account";
const SECRET_STORAGE_KEY = "kp_operator_account_admin_key";
const TEMP_ADMIN_KEY = "kp_auto4359786142537896gfdbgfd";

const EMPTY_FORM = {
  displayName: "",
  email: "",
  role: "Manager",
  mobileAccess: true,
  portalAccess: false,
  sendInvite: true,
  notes: "",
};

const ROLE_OPTIONS = [
  {
    label: "Admin",
    value: "Admin",
  },
  {
    label: "Owner",
    value: "Owner",
  },
  {
    label: "Manager / Chef",
    value: "Manager",
  },
  {
    label: "Operator / Staff",
    value: "Operator",
  },
];

function statusTone(status, linked) {
  if (linked) {
    return {
      color: "#047857",
      bg: "rgba(16,185,129,0.10)",
      border: "rgba(16,185,129,0.18)",
      label: "Linked",
    };
  }

  if (status === "Invite Sent") {
    return {
      color: "#0891B2",
      bg: "rgba(34,211,238,0.09)",
      border: "rgba(34,211,238,0.16)",
      label: "Invite sent",
    };
  }

  if (status === "Error") {
    return {
      color: "#B91C1C",
      bg: "rgba(239,68,68,0.09)",
      border: "rgba(239,68,68,0.16)",
      label: "Error",
    };
  }

  if (status === "Ready to Invite") {
    return {
      color: "#D97706",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.15)",
      label: "Ready",
    };
  }

  return {
    color: "#475569",
    bg: "rgba(100,116,139,0.08)",
    border: "rgba(100,116,139,0.14)",
    label: status || "Not invited",
  };
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export default function OperatorAccountForm() {
  const [adminKey, setAdminKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [operators, setOperators] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

 // useEffect(() => {
 //   const saved = window.sessionStorage.getItem(SECRET_STORAGE_KEY) || //"";
 //   setAdminKey(saved);
  //  setKeyDraft(saved);
  //}, []);

useEffect(() => {
  const keyToUse = TEMP_ADMIN_KEY || "";

  window.sessionStorage.setItem(SECRET_STORAGE_KEY, keyToUse);
  setAdminKey(keyToUse);
  setKeyDraft(keyToUse);
  setMessage("Demo admin key loaded. Operator accounts should load automatically.");
  setError("");
}, []);

useEffect(() => {
  if (adminKey) {
    loadOperators({ quiet: false });
  }
}, [adminKey]);

  const counts = useMemo(() => {
    const total = operators.length;
    const linked = operators.filter((operator) => operator.authProviderUserId).length;
    const inviteSent = operators.filter(
      (operator) => !operator.authProviderUserId && operator.inviteStatus === "Invite Sent"
    ).length;
    const errors = operators.filter((operator) => operator.inviteStatus === "Error").length;

    return {
      total,
      linked,
      inviteSent,
      errors,
    };
  }, [operators]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function saveAdminKey() {
    const cleaned = keyDraft.trim();

    if (!cleaned) {
      setError("Paste the admin key before creating accounts.");
      return;
    }

    window.sessionStorage.setItem(SECRET_STORAGE_KEY, cleaned);
    setAdminKey(cleaned);
    setMessage("Admin access unlocked for this browser session.");
    setError("");
  }

  function clearAdminKey() {
    window.sessionStorage.removeItem(SECRET_STORAGE_KEY);
    setAdminKey("");
    setKeyDraft("");
    setOperators([]);
    setMessage("");
    setError("");
  }

  async function loadOperators({ quiet = false } = {}) {
    if (!adminKey) {
      setError("Unlock the page with the admin key first.");
      return;
    }

    if (!quiet) {
      setIsLoading(true);
      setMessage("");
      setError("");
    }

    try {
      const response = await fetch(`${ACCOUNT_API}?t=${Date.now()}`, {
        method: "GET",
        headers: {
          "x-kitchenpulse-secret": adminKey,
        },
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || data?.error || "Unable to load operator accounts.");
      }

      setOperators(Array.isArray(data.operators) ? data.operators : []);

      if (!quiet) {
        setMessage(`Loaded ${data.count || 0} operator account${data.count === 1 ? "" : "s"}.`);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load operator accounts."
      );
    } finally {
      if (!quiet) {
        setIsLoading(false);
      }
    }
  }

  async function submitOperator(event) {
    event.preventDefault();

    if (!adminKey) {
      setError("Unlock the page with the admin key first.");
      return;
    }

    const cleanEmail = form.email.trim().toLowerCase();
    const cleanName = form.displayName.trim();

    if (!cleanName) {
      setError("Display name is required.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (!form.mobileAccess && !form.portalAccess) {
      setError("Choose Mobile Access, Portal Access, or both.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(ACCOUNT_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-kitchenpulse-secret": adminKey,
        },
        body: JSON.stringify({
          displayName: cleanName,
          email: cleanEmail,
          role: form.role,
          mobileAccess: form.mobileAccess,
          portalAccess: form.portalAccess,
          sendInvite: form.sendInvite,
          notes: form.notes,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || data?.error || "Unable to create operator account.");
      }

      setMessage(data.message || "Operator account created.");
      setForm(EMPTY_FORM);
      await loadOperators({ quiet: true });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create operator account."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

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
                    <UserPlus className="h-3.5 w-3.5" />
                  </span>
                  Add operator
                </div>

                <h2 className="text-2xl font-heading font-semibold tracking-tight">
                  Create a KitchenPulse account
                </h2>

                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  This creates the Operator Users access row, sends the Clerk invite,
                  and lets the mobile app link the account on first login.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={() => loadOperators()}
                  disabled={isLoading || !adminKey}
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
                  Refresh accounts
                </button>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Restaurant"
                value="Chloe's"
                note="Default tenant for new accounts"
                icon={ShieldCheck}
                featured
              />
              <MetricCard
                label="Operators"
                value={counts.total}
                note="Operator Users rows"
                icon={Users}
              />
              <MetricCard
                label="Linked"
                value={counts.linked}
                note="Signed in and connected to Clerk"
                icon={UserCheck}
              />
              <MetricCard
                label="Invites out"
                value={counts.inviteSent}
                note="Waiting on first login"
                icon={MailPlus}
              />
            </div>

            {!adminKey && (
              <div
                className="mb-4 rounded-3xl border p-4 shadow-sm"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))",
                  borderColor: "rgba(15,23,42,0.08)",
                  boxShadow:
                    "0 10px 24px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.82)",
                }}
              >
                <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                  <label className="block">
                    <span className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      <KeyRound className="h-3.5 w-3.5 text-cyan-700" />
                      Admin key
                    </span>
                    <input
                      type="password"
                      value={keyDraft}
                      onChange={(event) => setKeyDraft(event.target.value)}
                      placeholder="Paste KITCHENPULSE_AUTOMATION_SECRET"
                      className="h-11 w-full rounded-2xl border bg-white/80 px-4 text-sm font-semibold text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-200"
                      style={{ borderColor: "rgba(15,23,42,0.10)" }}
                    />
                    <div className="mt-1 text-xs leading-relaxed text-slate-500">
                      Stored only for this browser session. This keeps the Vercel account
                      creation endpoint locked until unified Clerk portal login is ready.
                    </div>
                  </label>

                  <button
                    type="button"
                    onClick={saveAdminKey}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold text-white shadow-sm transition"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(8,145,178,0.92))",
                      borderColor: "rgba(15,23,42,0.12)",
                      boxShadow:
                        "0 12px 24px rgba(8,145,178,0.18), inset 0 1px 0 rgba(255,255,255,0.18)",
                    }}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Unlock
                  </button>
                </div>
              </div>
            )}

            {adminKey && (
              <div
                className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm shadow-sm"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(240,253,250,0.88), rgba(255,255,255,0.78))",
                  borderColor: "rgba(20,184,166,0.16)",
                }}
              >
                <div className="flex items-center gap-2 font-semibold text-teal-800">
                  <CheckCircle2 className="h-4 w-4" />
                  Admin session unlocked
                </div>

                <button
                  type="button"
                  onClick={clearAdminKey}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:bg-white"
                  style={{
                    color: "#475569",
                    background: "rgba(255,255,255,0.80)",
                    borderColor: "rgba(100,116,139,0.16)",
                  }}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Clear key
                </button>
              </div>
            )}

            {message && (
              <Notice tone="success" icon={CheckCircle2}>
                {message}
              </Notice>
            )}

            {error && (
              <Notice tone="error" icon={AlertCircle}>
                {error}
              </Notice>
            )}

            <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
              <form
                onSubmit={submitOperator}
                className="rounded-3xl border p-4 shadow-sm md:p-5"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))",
                  borderColor: "rgba(15,23,42,0.08)",
                  boxShadow:
                    "0 10px 24px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.82)",
                }}
              >
                <div className="mb-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <UserPlus className="h-4 w-4 text-cyan-700" />
                    New operator
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-500">
                    Chloe&apos;s access is filled automatically. The Clerk user ID stays
                    blank until first login.
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    label="Display name"
                    value={form.displayName}
                    onChange={(value) => updateField("displayName", value)}
                    placeholder="Chef, manager, owner, or operator name"
                    required
                  />

                  <FormField
                    label="Email"
                    value={form.email}
                    onChange={(value) => updateField("email", value)}
                    placeholder="operator@example.com"
                    type="email"
                    required
                  />

                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Role
                    </span>
                    <select
                      value={form.role}
                      onChange={(event) => updateField("role", event.target.value)}
                      className="mt-1 h-11 w-full rounded-2xl border bg-white/80 px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-2 focus:ring-cyan-200"
                      style={{ borderColor: "rgba(15,23,42,0.10)" }}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>

                    <div className="mt-1 text-xs leading-relaxed text-slate-500">
                      Chef uses Manager permissions so it lands in the existing Softr access group.
                    </div>
                  </label>

                  <div>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Restaurant
                    </span>
                    <div
                      className="mt-1 flex h-11 items-center rounded-2xl border bg-white/70 px-4 text-sm font-semibold text-slate-700 shadow-sm"
                      style={{ borderColor: "rgba(15,23,42,0.08)" }}
                    >
                      Chloe&apos;s
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <ToggleField
                    label="Mobile Access"
                    note="Allow app login"
                    checked={form.mobileAccess}
                    onChange={(checked) => updateField("mobileAccess", checked)}
                    icon={Smartphone}
                  />

                  <ToggleField
                    label="Portal Access"
                    note="Future portal login"
                    checked={form.portalAccess}
                    onChange={(checked) => updateField("portalAccess", checked)}
                    icon={ShieldCheck}
                  />

                  <ToggleField
                    label="Send Invite"
                    note="Email from Clerk"
                    checked={form.sendInvite}
                    onChange={(checked) => updateField("sendInvite", checked)}
                    icon={MailPlus}
                  />
                </div>

                <label className="mt-4 block">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Notes
                  </span>
                  <textarea
                    value={form.notes}
                    onChange={(event) => updateField("notes", event.target.value)}
                    placeholder="Optional internal note, onboarding context, or permission reason."
                    rows={3}
                    className="mt-1 w-full rounded-2xl border bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-200"
                    style={{ borderColor: "rgba(15,23,42,0.10)" }}
                  />
                </label>

                <div
                  className="mt-4 rounded-2xl border px-4 py-3 text-xs leading-relaxed text-slate-500"
                  style={{
                    background: "rgba(248,250,252,0.78)",
                    borderColor: "rgba(15,23,42,0.08)",
                  }}
                >
                  <span className="font-semibold text-slate-800">Access rule:</span>{" "}
                  Unknown users stay locked out. Creating this account gives the email
                  permission to sign in for Chloe&apos;s.
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !adminKey}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(8,145,178,0.92))",
                    borderColor: "rgba(15,23,42,0.12)",
                    boxShadow:
                      "0 12px 24px rgba(8,145,178,0.18), inset 0 1px 0 rgba(255,255,255,0.18)",
                  }}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MailPlus className="h-4 w-4" />
                  )}
                  Create account and send invite
                </button>
              </form>

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
                <div
                  className="border-b px-4 py-3"
                  style={{ borderColor: "rgba(15,23,42,0.07)" }}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <Users className="h-4 w-4 text-cyan-700" />
                    Current operator accounts
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-500">
                    Shows Chloe&apos;s operator access rows and invite status.
                  </div>
                </div>

                {!adminKey ? (
                  <StateBox
                    icon={KeyRound}
                    title="Unlock to view accounts"
                    text="Paste the admin key above to load operator accounts."
                  />
                ) : isLoading ? (
                  <StateBox
                    icon={Loader2}
                    spinning
                    title="Loading operators..."
                    text="Checking Operator Users and invite status."
                  />
                ) : operators.length === 0 ? (
                  <StateBox
                    icon={UserPlus}
                    title="No operators loaded"
                    text="Create an operator or refresh the account list."
                  />
                ) : (
                  <div className="max-h-[590px] divide-y divide-slate-200/80 overflow-y-auto">
                    {operators.map((operator) => (
                      <OperatorRow key={operator.id} operator={operator} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  required = false,
}) {
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

function ToggleField({ label, note, checked, onChange, icon: Icon }) {
  return (
    <label
      className="flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm"
      style={{
        background: checked
          ? "linear-gradient(145deg, rgba(236,254,255,0.90), rgba(255,255,255,0.82))"
          : "rgba(255,255,255,0.78)",
        borderColor: checked ? "rgba(34,211,238,0.20)" : "rgba(15,23,42,0.08)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-300"
      />

      <div className="min-w-0">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
          <Icon className="h-3.5 w-3.5 text-cyan-700" />
          {label}
        </div>
        <div className="mt-0.5 text-xs leading-relaxed text-slate-500">
          {note}
        </div>
      </div>
    </label>
  );
}

function MetricCard({ label, value, note, icon: Icon, featured = false }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-3 shadow-sm"
      style={{
        background: featured
          ? "linear-gradient(145deg, rgba(236,254,255,0.88), rgba(255,255,255,0.86))"
          : "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))",
        borderColor: featured ? "rgba(34,211,238,0.18)" : "rgba(15,23,42,0.08)",
        boxShadow:
          "0 8px 20px rgba(15,23,42,0.052), inset 0 1px 0 rgba(255,255,255,0.82)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </div>

          <div className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
            {value}
          </div>
        </div>

        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border shadow-sm"
          style={{
            color: "#0891B2",
            background: "rgba(34,211,238,0.08)",
            borderColor: "rgba(34,211,238,0.15)",
          }}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-1.5 truncate text-xs leading-relaxed text-muted-foreground">
        {note}
      </div>
    </div>
  );
}

function Notice({ children, tone, icon: Icon }) {
  const isError = tone === "error";

  return (
    <div
      className="mb-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm leading-relaxed"
      style={{
        color: isError ? "#B91C1C" : "#047857",
        background: isError ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.09)",
        borderColor: isError ? "rgba(239,68,68,0.16)" : "rgba(16,185,129,0.18)",
      }}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function StatusPill({ operator }) {
  const tone = statusTone(operator.inviteStatus, operator.authProviderUserId);

  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold"
      style={{
        color: tone.color,
        background: tone.bg,
        borderColor: tone.border,
      }}
    >
      {tone.label}
    </span>
  );
}

function AccessPill({ children, active }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={{
        color: active ? "#047857" : "#64748B",
        background: active ? "rgba(16,185,129,0.08)" : "rgba(100,116,139,0.06)",
        borderColor: active ? "rgba(16,185,129,0.16)" : "rgba(100,116,139,0.14)",
      }}
    >
      {children}
    </span>
  );
}

function OperatorRow({ operator }) {
  return (
    <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="truncate text-sm font-semibold text-slate-950">
            {operator.displayName || operator.email || "Unnamed operator"}
          </div>
          <StatusPill operator={operator} />
        </div>

        <div className="mt-1 text-xs leading-relaxed text-slate-500">
          {operator.email || "No email"} • {operator.role || "No role"} •{" "}
          {operator.accessStatus || "No status"}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <AccessPill active={operator.mobileAccess}>Mobile</AccessPill>
          <AccessPill active={operator.portalAccess}>Portal</AccessPill>
          {operator.inviteSentAt && (
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              <Clock className="h-3 w-3" />
              {formatDateTime(operator.inviteSentAt)}
            </span>
          )}
        </div>

        {operator.inviteLastError && (
          <div className="mt-2 line-clamp-2 rounded-xl border px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-800"
            style={{
              background: "rgba(245,158,11,0.07)",
              borderColor: "rgba(245,158,11,0.14)",
            }}
          >
            {operator.inviteLastError}
          </div>
        )}
      </div>

      <div className="text-xs leading-relaxed text-slate-500 lg:text-right">
        <div className="font-semibold text-slate-700">
          {operator.authProviderUserId ? "Clerk linked" : "Waiting for login"}
        </div>
        <div>{operator.lastLoginAt ? formatDateTime(operator.lastLoginAt) : "No login yet"}</div>
      </div>
    </div>
  );
}

function StateBox({ icon: Icon, title, text, spinning = false }) {
  return (
    <div className="flex min-h-[260px] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border"
          style={{
            color: "#0891B2",
            background: "rgba(34,211,238,0.08)",
            borderColor: "rgba(34,211,238,0.16)",
          }}
        >
          <Icon className={`h-7 w-7 ${spinning ? "animate-spin" : ""}`} />
        </div>

        <div className="mt-3 text-base font-semibold text-slate-950">
          {title}
        </div>

        <div className="mt-1 text-sm leading-relaxed text-slate-500">
          {text}
        </div>
      </div>
    </div>
  );
}
