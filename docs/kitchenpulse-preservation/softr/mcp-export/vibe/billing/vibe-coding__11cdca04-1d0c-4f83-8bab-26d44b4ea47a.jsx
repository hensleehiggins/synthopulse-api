import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BadgeDollarSign,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  FilePlus2,
  HandCoins,
  Loader2,
  Mail,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  X,
} from "lucide-react";

const BILLING_API = "https://project-1csz2.vercel.app/api/billing-command-center";
const SECRET_STORAGE_KEY = "[REDACTED]";

// Must exactly match BILLING_ADMIN_SECRET in Vercel.
// Never put a Stripe secret key here.
const TEMP_BILLING_ADMIN_SECRET = "[REDACTED]";

const EMPTY_PROFILE = {
  name: "",
  restaurantId: "",
  billingStatus: "Active",
  planName: "KitchenPulse Operator Platform — Pilot Partner Rate",
  monthlyRate: "200",
  billingCycle: "Monthly",
  billingDay: "1",
  paymentTermsDays: "7",
  billingContactName: "",
  billingContactEmail: "",
  stripeCustomerId: "",
  stripeCustomerUrl: "",
  defaultCollectionMethod: "Send Invoice",
  preferredPaymentMethod: "Unknown",
  nextInvoiceDate: "",
  commercialNotes: "",
  internalNotes: "",
  active: true,
};

const EMPTY_INVOICE = {
  name: "",
  profileId: "",
  restaurantId: "",
  invoiceStatus: "Draft",
  invoiceNumber: "SYN-DRAFT",
  stripeInvoiceId: "",
  stripeHostedInvoiceUrl: "",
  stripeDashboardUrl: "",
  servicePeriodStart: "",
  servicePeriodEnd: "",
  dueDate: "",
  amountDue: "200",
  amountPaid: "0",
  currency: "USD",
  collectionMethod: "Send Invoice",
  paymentMethod: "Unknown",
  followUpStatus: "None Needed",
  nextFollowUpDate: "",
  invoiceNotes: "",
  internalNotes: "",
};

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dateLabel(value) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function plusDays(days) {
  const date = new Date(`${today()}T12:00:00`);
  date.setDate(date.getDate() + Number(days || 7));
  return date.toISOString().slice(0, 10);
}

function tone(value) {
  const key = String(value || "").toLowerCase();
  if (["paid", "active", "none needed"].includes(key)) return ["#047857", "rgba(16,185,129,0.10)", "rgba(16,185,129,0.18)"];
  if (key.includes("past due") || key.includes("follow up today") || key.includes("escalated")) return ["#B45309", "rgba(245,158,11,0.10)", "rgba(245,158,11,0.18)"];
  if (["sent", "scheduled"].includes(key)) return ["#0E7490", "rgba(34,211,238,0.10)", "rgba(34,211,238,0.18)"];
  return ["#475569", "rgba(100,116,139,0.08)", "rgba(100,116,139,0.14)"];
}

function Pill({ children }) {
  const [color, background, border] = tone(children);
  return <span className="inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={{ color, background, borderColor: border }}>{children || "Unknown"}</span>;
}

function Notice({ error, children }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm leading-relaxed" style={{ color: error ? "#B91C1C" : "#047857", background: error ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.09)", borderColor: error ? "rgba(239,68,68,0.16)" : "rgba(16,185,129,0.18)" }}>
      {error ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
      <div>{children}</div>
    </div>
  );
}

function Metric({ label, value, note, icon: Icon, featured }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border p-3 shadow-sm" style={{ background: featured ? "linear-gradient(145deg, rgba(236,254,255,0.90), rgba(255,255,255,0.86))" : "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))", borderColor: featured ? "rgba(34,211,238,0.20)" : "rgba(15,23,42,0.08)", boxShadow: "0 8px 20px rgba(15,23,42,0.052), inset 0 1px 0 rgba(255,255,255,0.82)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
          <div className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{value}</div>
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border shadow-sm" style={{ color: "#0891B2", background: "rgba(34,211,238,0.08)", borderColor: "rgba(34,211,238,0.15)" }}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="mt-1.5 truncate text-xs leading-relaxed text-muted-foreground">{note}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, placeholder }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}{required ? " *" : ""}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} className="mt-1 h-11 w-full rounded-2xl border bg-white/80 px-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-200" style={{ borderColor: "rgba(15,23,42,0.10)" }} />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-2xl border bg-white/80 px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-2 focus:ring-cyan-200" style={{ borderColor: "rgba(15,23,42,0.10)" }}>
        {options.map((option) => <option key={option.value || option} value={option.value || option}>{option.label || option}</option>)}
      </select>
    </label>
  );
}

function Panel({ title, icon: Icon, action, children }) {
  return (
    <div className="overflow-hidden rounded-3xl border shadow-sm" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))", borderColor: "rgba(15,23,42,0.08)", boxShadow: "0 10px 24px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.82)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "rgba(15,23,42,0.07)" }}>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Icon className="h-4 w-4 text-cyan-700" />{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ icon: Icon, title, text }) {
  return <div className="flex min-h-[220px] items-center justify-center p-8"><div className="max-w-md text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border" style={{ color: "#0891B2", background: "rgba(34,211,238,0.08)", borderColor: "rgba(34,211,238,0.16)" }}><Icon className="h-7 w-7" /></div><div className="mt-3 text-base font-semibold text-slate-950">{title}</div><div className="mt-1 text-sm leading-relaxed text-slate-500">{text}</div></div></div>;
}

export default function BillingCommandCenter() {
  const [secretDraft, setSecretDraft] = useState("");
  const [secret, setSecret] = useState("");
  const [center, setCenter] = useState({ restaurants: [], profiles: [], invoices: [], summary: null });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE);
  const [invoiceForm, setInvoiceForm] = useState(EMPTY_INVOICE);

useEffect(() => {
  const keyToUse = TEMP_BILLING_ADMIN_SECRET || "";

  window.sessionStorage.setItem(SECRET_STORAGE_KEY, keyToUse);
  setSecret(keyToUse);
  setSecretDraft(keyToUse);
  setError("");
}, []);

  useEffect(() => { if (secret) load(); }, [secret]);

  const profileMap = useMemo(() => new Map(center.profiles.map((profile) => [profile.id, profile])), [center.profiles]);
  const summary = center.summary || { activeCustomerCount: 0, monthlyRecurringRevenue: 0, outstanding: 0, overdueCount: 0, followUpsDueCount: 0, nextInvoiceDate: "", nextInvoiceCustomer: "" };

  async function api(path = "", options = {}) {
    const response = await fetch(`${BILLING_API}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", "x-billing-secret": secret, ...(options.headers || {}) },
    });
    const body = await response.json();
    if (!response.ok || !body?.ok) throw new Error(body?.error || "Billing request failed.");
    return body;
  }

  function install(body) {
    setCenter({ restaurants: body.restaurants || [], profiles: body.profiles || [], invoices: body.invoices || [], summary: body.summary || null });
  }

  async function load() {
    if (!secret) return;
    setLoading(true); setError("");
    try { const body = await api(`?t=${Date.now()}`); install(body); setMessage("Billing data refreshed from Airtable."); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "Unable to load billing data."); }
    finally { setLoading(false); }
  }

  function unlock() {
    const candidate = secretDraft.trim();
    if (!candidate) { setError("Paste BILLING_ADMIN_SECRET first."); return; }
    window.sessionStorage.setItem(SECRET_STORAGE_KEY, candidate);
    setSecret(candidate); setError(""); setMessage("Owner billing session unlocked.");
  }

  function clearSession() {
    window.sessionStorage.removeItem(SECRET_STORAGE_KEY);
    setSecret(""); setSecretDraft(""); setCenter({ restaurants: [], profiles: [], invoices: [], summary: null }); setMessage(""); setError("");
  }

  async function createProfile(event) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const body = await api("", { method: "POST", body: JSON.stringify({ action: "create_profile", profile: { ...profileForm, monthlyRate: Number(profileForm.monthlyRate || 0), billingDay: Number(profileForm.billingDay || 1), paymentTermsDays: Number(profileForm.paymentTermsDays || 7) } }) });
      install(body); setProfileForm(EMPTY_PROFILE); setShowProfile(false); setMessage(body.message || "Billing profile created.");
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Unable to create profile."); }
    finally { setSaving(false); }
  }

  async function createInvoice(event) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const body = await api("", { method: "POST", body: JSON.stringify({ action: "create_invoice", invoice: { ...invoiceForm, amountDue: Number(invoiceForm.amountDue || 0), amountPaid: Number(invoiceForm.amountPaid || 0) } }) });
      install(body); setInvoiceForm(EMPTY_INVOICE); setShowInvoice(false); setMessage(body.message || "Invoice mirror recorded.");
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Unable to record invoice."); }
    finally { setSaving(false); }
  }

  async function flagFollowUp(invoice) {
    setSaving(true); setError("");
    try {
      const body = await api("", { method: "POST", body: JSON.stringify({ action: "update_invoice", invoiceId: invoice.id, invoice: { followUpStatus: "Follow Up Today", nextFollowUpDate: today(), lastFollowUpAt: new Date().toISOString() } }) });
      install(body); setMessage(`Follow-up marked for ${invoice.restaurantName}.`);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Unable to update follow-up."); }
    finally { setSaving(false); }
  }

  function selectProfile(profileId) {
    const profile = profileMap.get(profileId);
    setInvoiceForm((current) => ({ ...current, profileId, restaurantId: profile?.restaurantId || "", amountDue: String(profile?.monthlyRate || current.amountDue || "200"), collectionMethod: profile?.defaultCollectionMethod || "Send Invoice", paymentMethod: profile?.preferredPaymentMethod || "Unknown", name: profile ? `${profile.restaurantName} — ${profile.planName || "KitchenPulse service"}` : current.name, dueDate: current.dueDate || plusDays(profile?.paymentTermsDays || 7) }));
  }

  return (
    <div className="container py-4"><div className="content mx-auto max-w-7xl"><section className="relative overflow-hidden rounded-3xl border p-4 shadow-xl md:p-5" style={{ background: "radial-gradient(circle at 12% 8%, rgba(34,211,238,0.065), transparent 30%), radial-gradient(circle at 82% 12%, rgba(59,130,246,0.045), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(248,250,252,0.94) 55%, rgba(241,245,249,0.86) 100%)", borderColor: "rgba(15,23,42,0.08)", boxShadow: "0 14px 34px rgba(15,23,42,0.075), inset 0 1px 0 rgba(255,255,255,0.82)" }}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.055]" style={{ backgroundImage: "linear-gradient(rgba(15,23,42,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.10) 1px, transparent 1px)", backgroundSize: "34px 34px" }} />
      <div className="relative z-10">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"><span className="inline-flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.72)", color: "#0891B2", border: "1px solid rgba(15,23,42,0.08)" }}><BadgeDollarSign className="h-3.5 w-3.5" /></span>Commercial operations</div><h2 className="text-2xl font-heading font-semibold tracking-tight">Run billing without losing the thread</h2><p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">Track Stripe invoice posture, recurring revenue, and follow-up work. Stripe handles payment collection. This page keeps the operating picture in one place.</p></div><div className="flex flex-wrap gap-2 lg:justify-end"><button type="button" onClick={load} disabled={loading || !secret} className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-sm transition hover:bg-white disabled:opacity-60" style={{ color: "#334155", background: "linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.76))", borderColor: "rgba(15,23,42,0.08)" }}>{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-700" /> : <RefreshCw className="h-3.5 w-3.5 text-cyan-700" />}Refresh</button><button type="button" onClick={() => setShowInvoice((value) => !value)} disabled={!secret} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold text-white shadow-sm transition disabled:opacity-60" style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(8,145,178,0.92))", borderColor: "rgba(15,23,42,0.12)" }}><FilePlus2 className="h-3.5 w-3.5" />Record Stripe invoice</button></div></div>

        {!secret && <div className="mb-4 rounded-3xl border p-4 shadow-sm" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))", borderColor: "rgba(15,23,42,0.08)" }}><div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end"><label className="block"><span className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-cyan-700" />Billing admin secret</span><input type="password" value={secretDraft} onChange={(event) => setSecretDraft(event.target.value)} placeholder="Paste BILLING_ADMIN_SECRET" className="h-11 w-full rounded-2xl border bg-white/80 px-4 text-sm font-semibold text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-200" style={{ borderColor: "rgba(15,23,42,0.10)" }} /><div className="mt-1 text-xs leading-relaxed text-slate-500">Stored only for this browser session. It is separate from all Stripe credentials.</div></label><button type="button" onClick={unlock} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold text-white shadow-sm transition" style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(8,145,178,0.92))", borderColor: "rgba(15,23,42,0.12)" }}><ShieldCheck className="h-4 w-4" />Unlock</button></div></div>}
        {secret && <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm shadow-sm" style={{ background: "linear-gradient(145deg, rgba(240,253,250,0.88), rgba(255,255,255,0.78))", borderColor: "rgba(20,184,166,0.16)" }}><div className="flex items-center gap-2 font-semibold text-teal-800"><CheckCircle2 className="h-4 w-4" />Owner billing session unlocked</div><button type="button" onClick={clearSession} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:bg-white" style={{ color: "#475569", background: "rgba(255,255,255,0.80)", borderColor: "rgba(100,116,139,0.16)" }}><X className="h-3.5 w-3.5" />Clear session</button></div>}
        {message && <Notice>{message}</Notice>}
        {error && <Notice error>{error}</Notice>}

        {secret && <>
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Monthly recurring" value={money(summary.monthlyRecurringRevenue)} note={`${summary.activeCustomerCount || 0} active billing profile${summary.activeCustomerCount === 1 ? "" : "s"}`} icon={CircleDollarSign} featured /><Metric label="Outstanding" value={money(summary.outstanding)} note="Open invoice balance" icon={ReceiptText} /><Metric label="Overdue" value={summary.overdueCount || 0} note="Invoices needing attention" icon={AlertCircle} /><Metric label="Follow-ups due" value={summary.followUpsDueCount || 0} note="Internal collection queue" icon={HandCoins} /><Metric label="Next invoice" value={summary.nextInvoiceDate ? dateLabel(summary.nextInvoiceDate) : "—"} note={summary.nextInvoiceCustomer || "No active billing date"} icon={CalendarClock} /></div>

          {showProfile && <form onSubmit={createProfile} className="mb-4 rounded-3xl border p-4 shadow-sm md:p-5" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))", borderColor: "rgba(15,23,42,0.08)" }}><div className="mb-4 flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Building2 className="h-4 w-4 text-cyan-700" />New billing profile</div><div className="mt-1 text-xs text-slate-500">This creates internal commercial context only. It does not create a Stripe customer.</div></div><button type="button" onClick={() => setShowProfile(false)} className="rounded-full border p-2 text-slate-500" style={{ borderColor: "rgba(15,23,42,0.08)" }}><X className="h-4 w-4" /></button></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><Field label="Profile name" value={profileForm.name} onChange={(value) => setProfileForm({ ...profileForm, name: value })} placeholder="Chloe's Steakhouse — KitchenPulse" required /><Select label="Restaurant" value={profileForm.restaurantId} onChange={(value) => setProfileForm({ ...profileForm, restaurantId: value })} options={[{ value: "", label: "Choose restaurant" }, ...center.restaurants.map((restaurant) => ({ value: restaurant.id, label: restaurant.name }))]} /><Field label="Plan name" value={profileForm.planName} onChange={(value) => setProfileForm({ ...profileForm, planName: value })} required /><Field label="Monthly rate" type="number" value={profileForm.monthlyRate} onChange={(value) => setProfileForm({ ...profileForm, monthlyRate: value })} required /><Select label="Billing cycle" value={profileForm.billingCycle} onChange={(value) => setProfileForm({ ...profileForm, billingCycle: value })} options={["Monthly", "Quarterly", "Annual", "One-Time"]} /><Field label="Billing day" type="number" value={profileForm.billingDay} onChange={(value) => setProfileForm({ ...profileForm, billingDay: value })} /><Field label="Payment terms" type="number" value={profileForm.paymentTermsDays} onChange={(value) => setProfileForm({ ...profileForm, paymentTermsDays: value })} /><Field label="Billing email" type="email" value={profileForm.billingContactEmail} onChange={(value) => setProfileForm({ ...profileForm, billingContactEmail: value })} /><Field label="Stripe customer ID" value={profileForm.stripeCustomerId} onChange={(value) => setProfileForm({ ...profileForm, stripeCustomerId: value })} placeholder="cus_..." /><Field label="Next invoice date" type="date" value={profileForm.nextInvoiceDate} onChange={(value) => setProfileForm({ ...profileForm, nextInvoiceDate: value })} /><Select label="Collection method" value={profileForm.defaultCollectionMethod} onChange={(value) => setProfileForm({ ...profileForm, defaultCollectionMethod: value })} options={["Send Invoice", "Autocharge", "Manual"]} /></div><label className="mt-4 block"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Commercial notes</span><textarea value={profileForm.commercialNotes} onChange={(event) => setProfileForm({ ...profileForm, commercialNotes: event.target.value })} rows={3} placeholder="Pilot rate, scope notes, agreement context, or renewal assumptions." className="mt-1 w-full rounded-2xl border bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-cyan-200" style={{ borderColor: "rgba(15,23,42,0.10)" }} /></label><button type="submit" disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60" style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(8,145,178,0.92))", borderColor: "rgba(15,23,42,0.12)" }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create billing profile</button></form>}

          {showInvoice && <form onSubmit={createInvoice} className="mb-4 rounded-3xl border p-4 shadow-sm md:p-5" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.78))", borderColor: "rgba(15,23,42,0.08)" }}><div className="mb-4 flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><FilePlus2 className="h-4 w-4 text-cyan-700" />Record Stripe invoice</div><div className="mt-1 text-xs text-slate-500">Mirror one real Stripe invoice here for operational tracking. This does not create a second invoice.</div></div><button type="button" onClick={() => setShowInvoice(false)} className="rounded-full border p-2 text-slate-500" style={{ borderColor: "rgba(15,23,42,0.08)" }}><X className="h-4 w-4" /></button></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><Select label="Billing profile" value={invoiceForm.profileId} onChange={selectProfile} options={[{ value: "", label: "Choose billing profile" }, ...center.profiles.map((profile) => ({ value: profile.id, label: `${profile.restaurantName} — ${profile.planName || "Billing profile"}` }))]} /><Field label="Invoice name" value={invoiceForm.name} onChange={(value) => setInvoiceForm({ ...invoiceForm, name: value })} placeholder="Chloe's Steakhouse — July 2026" required /><Select label="Stripe invoice status" value={invoiceForm.invoiceStatus} onChange={(value) => setInvoiceForm({ ...invoiceForm, invoiceStatus: value })} options={["Draft", "Scheduled", "Sent", "Paid", "Past Due", "Void"]} /><Field label="Invoice number" value={invoiceForm.invoiceNumber} onChange={(value) => setInvoiceForm({ ...invoiceForm, invoiceNumber: value })} /><Field label="Stripe invoice ID" value={invoiceForm.stripeInvoiceId} onChange={(value) => setInvoiceForm({ ...invoiceForm, stripeInvoiceId: value })} placeholder="in_..." /><Field label="Amount due" type="number" value={invoiceForm.amountDue} onChange={(value) => setInvoiceForm({ ...invoiceForm, amountDue: value })} required /><Field label="Service starts" type="date" value={invoiceForm.servicePeriodStart} onChange={(value) => setInvoiceForm({ ...invoiceForm, servicePeriodStart: value })} /><Field label="Service ends" type="date" value={invoiceForm.servicePeriodEnd} onChange={(value) => setInvoiceForm({ ...invoiceForm, servicePeriodEnd: value })} /><Field label="Due date" type="date" value={invoiceForm.dueDate} onChange={(value) => setInvoiceForm({ ...invoiceForm, dueDate: value })} /><Field label="Hosted invoice URL" value={invoiceForm.stripeHostedInvoiceUrl} onChange={(value) => setInvoiceForm({ ...invoiceForm, stripeHostedInvoiceUrl: value })} placeholder="https://invoice.stripe.com/..." /><Field label="Stripe dashboard URL" value={invoiceForm.stripeDashboardUrl} onChange={(value) => setInvoiceForm({ ...invoiceForm, stripeDashboardUrl: value })} placeholder="https://dashboard.stripe.com/..." /><Select label="Follow-up posture" value={invoiceForm.followUpStatus} onChange={(value) => setInvoiceForm({ ...invoiceForm, followUpStatus: value })} options={["None Needed", "Follow Up Soon", "Follow Up Today", "Payment Plan", "Escalated"]} /></div><label className="mt-4 block"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Internal notes</span><textarea value={invoiceForm.internalNotes} onChange={(event) => setInvoiceForm({ ...invoiceForm, internalNotes: event.target.value })} rows={3} placeholder="Example: Draft invoice prepared in Stripe. Send only after Stripe activation is clear." className="mt-1 w-full rounded-2xl border bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-cyan-200" style={{ borderColor: "rgba(15,23,42,0.10)" }} /></label><button type="submit" disabled={saving || !invoiceForm.profileId} className="mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60" style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(8,145,178,0.92))", borderColor: "rgba(15,23,42,0.12)" }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}Record invoice mirror</button></form>}

          <div className="mb-4 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
            <Panel title="Billing profiles" icon={Building2} action={<button type="button" onClick={() => setShowProfile((value) => !value)} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold text-cyan-800" style={{ background: "rgba(236,254,255,0.75)", borderColor: "rgba(34,211,238,0.18)" }}><Plus className="h-3.5 w-3.5" />Add profile</button>}>
              {loading ? <Empty icon={Loader2} title="Loading profiles..." text="Reading billing profiles from Airtable." /> : center.profiles.length === 0 ? <Empty icon={Building2} title="No billing profiles yet" text="Add Chloe's first, then mirror the Stripe draft." /> : <div className="divide-y divide-slate-200/80">{center.profiles.map((profile) => <div key={profile.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-sm font-semibold text-slate-950">{profile.restaurantName}</div><div className="mt-1 text-xs text-slate-500">{profile.planName || "No plan name"}</div></div><Pill>{profile.billingStatus}</Pill></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl border p-2.5" style={{ borderColor: "rgba(15,23,42,0.07)", background: "rgba(248,250,252,0.75)" }}><div className="text-slate-500">Monthly rate</div><div className="mt-1 font-semibold text-slate-900">{money(profile.monthlyRate)}</div></div><div className="rounded-xl border p-2.5" style={{ borderColor: "rgba(15,23,42,0.07)", background: "rgba(248,250,252,0.75)" }}><div className="text-slate-500">Next invoice</div><div className="mt-1 font-semibold text-slate-900">{dateLabel(profile.nextInvoiceDate)}</div></div></div><div className="mt-3 flex flex-wrap gap-1.5"><Pill>{profile.billingCycle}</Pill><Pill>{profile.defaultCollectionMethod}</Pill><Pill>{profile.preferredPaymentMethod}</Pill></div>{profile.billingContactEmail && <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><Mail className="h-3.5 w-3.5 text-cyan-700" />{profile.billingContactEmail}</div>}</div>)}</div>}
            </Panel>
            <Panel title="Invoice and follow-up queue" icon={ReceiptText}>
              {loading ? <Empty icon={Loader2} title="Loading invoices..." text="Reading the internal Stripe invoice mirror." /> : center.invoices.length === 0 ? <Empty icon={ReceiptText} title="No invoice mirrors yet" text="Create Chloe's Stripe draft first, then record it here once." /> : <div className="max-h-[640px] divide-y divide-slate-200/80 overflow-y-auto">{center.invoices.map((invoice) => <div key={invoice.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><div className="text-sm font-semibold text-slate-950">{invoice.restaurantName}</div><div className="mt-1 text-xs text-slate-500">{invoice.invoiceNumber} · {invoice.name || "Invoice mirror"}</div></div><div className="flex flex-wrap gap-1.5"><Pill>{invoice.invoiceStatus}</Pill><Pill>{invoice.followUpStatus}</Pill></div></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><div className="rounded-xl border p-2.5" style={{ borderColor: "rgba(15,23,42,0.07)", background: "rgba(248,250,252,0.75)" }}><div className="text-slate-500">Due</div><div className="mt-1 font-semibold text-slate-900">{money(invoice.amountDue)}</div></div><div className="rounded-xl border p-2.5" style={{ borderColor: "rgba(15,23,42,0.07)", background: "rgba(248,250,252,0.75)" }}><div className="text-slate-500">Balance</div><div className="mt-1 font-semibold text-slate-900">{money(invoice.balanceDue)}</div></div><div className="rounded-xl border p-2.5" style={{ borderColor: "rgba(15,23,42,0.07)", background: "rgba(248,250,252,0.75)" }}><div className="text-slate-500">Payment due</div><div className="mt-1 font-semibold text-slate-900">{dateLabel(invoice.dueDate)}</div></div><div className="rounded-xl border p-2.5" style={{ borderColor: "rgba(15,23,42,0.07)", background: "rgba(248,250,252,0.75)" }}><div className="text-slate-500">Stripe sync</div><div className="mt-1 font-semibold text-slate-900">{invoice.stripeSyncStatus}</div></div></div><div className="mt-3 flex flex-wrap gap-2">{invoice.stripeHostedInvoiceUrl && <a href={invoice.stripeHostedInvoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold text-cyan-800" style={{ background: "rgba(236,254,255,0.75)", borderColor: "rgba(34,211,238,0.18)" }}>Open payment page<ArrowUpRight className="h-3.5 w-3.5" /></a>}{invoice.stripeDashboardUrl && <a href={invoice.stripeDashboardUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold text-slate-700" style={{ background: "rgba(255,255,255,0.80)", borderColor: "rgba(15,23,42,0.09)" }}>Open Stripe<ArrowUpRight className="h-3.5 w-3.5" /></a>}{!["Paid", "Void"].includes(invoice.invoiceStatus) && <button type="button" disabled={saving} onClick={() => flagFollowUp(invoice)} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-60" style={{ background: "rgba(255,251,235,0.85)", borderColor: "rgba(245,158,11,0.18)" }}><UserRoundCheck className="h-3.5 w-3.5" />Mark follow-up</button>}</div>{invoice.internalNotes && <div className="mt-3 rounded-xl border px-3 py-2 text-xs leading-relaxed text-slate-600" style={{ background: "rgba(248,250,252,0.72)", borderColor: "rgba(15,23,42,0.07)" }}>{invoice.internalNotes}</div>}</div>)}</div>}
            </Panel>
          </div>
          <div className="rounded-2xl border px-4 py-3 text-xs leading-relaxed text-slate-500" style={{ background: "rgba(248,250,252,0.78)", borderColor: "rgba(15,23,42,0.08)" }}><span className="font-semibold text-slate-800">Source-of-truth rule:</span> Stripe creates, sends, collects, and records payments. This command center mirrors the operating state so follow-ups and recurring work do not vanish into dashboard tabs. Payment status should be synced from Stripe later, not guessed here.</div>
        </>}
      </div>
    </section></div></div>
  );
}
