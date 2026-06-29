/********************************************************************
 * SynthoPulse Billing Command Center API v1.0
 * Route: api/billing-command-center.js
 *
 * Stripe remains the payment and invoice system of record.
 * This endpoint mirrors internal billing operations in Airtable.
 *
 * Required Vercel env:
 * AIRTABLE_BASE_ID, AIRTABLE_PAT (or AIRTABLE_TOKEN/API_KEY),
 * BILLING_ADMIN_SECRET
 ********************************************************************/

const crypto = require("crypto");

const BASE_ID = process.env.AIRTABLE_BASE_ID || "appD303evZM2SlvMR";
const TOKEN =
  process.env.AIRTABLE_PAT ||
  process.env.AIRTABLE_API_KEY ||
  process.env.AIRTABLE_TOKEN;
const ADMIN_SECRET = process.env.BILLING_ADMIN_SECRET;

const TABLES = {
  restaurants: "Restaurants",
  profiles: "Billing Profiles",
  invoices: "Billing Invoices",
};

const FIELDS = {
  restaurants: ["Restaurant Name", "Restaurant ID", "Status"],
  profiles: [
    "Billing Profile Name",
    "Restaurant",
    "Billing Status",
    "Plan Name",
    "Monthly Rate",
    "Billing Cycle",
    "Billing Day",
    "Payment Terms Days",
    "Billing Contact Name",
    "Billing Contact Email",
    "Stripe Customer ID",
    "Stripe Customer URL",
    "Default Collection Method",
    "Preferred Payment Method",
    "Next Invoice Date",
    "Contract / Commercial Notes",
    "Internal Notes",
    "Active",
  ],
  invoices: [
    "Invoice Name",
    "Restaurant",
    "Billing Profile",
    "Invoice Status",
    "Invoice Number",
    "Stripe Invoice ID",
    "Stripe Hosted Invoice URL",
    "Stripe Dashboard URL",
    "Service Period Start",
    "Service Period End",
    "Issued At",
    "Due Date",
    "Paid At",
    "Amount Due",
    "Amount Paid",
    "Currency",
    "Collection Method",
    "Payment Method",
    "Follow-Up Status",
    "Next Follow-Up Date",
    "Last Follow-Up At",
    "Invoice Notes",
    "Internal Notes",
    "Stripe Sync Status",
    "Last Stripe Sync At",
  ],
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-billing-secret"
  );
}

function reply(res, status, payload) {
  cors(res);
  return res.status(status).json(payload);
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function number(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function select(value) {
  return value && typeof value === "object" && "name" in value
    ? clean(value.name)
    : clean(value);
}

function firstLink(value) {
  return Array.isArray(value) && value[0] ? clean(value[0]) : "";
}

function field(record, name) {
  return record?.fields?.[name];
}

function text(record, name) {
  return clean(field(record, name));
}

function numeric(record, name) {
  return number(field(record, name));
}

function selected(record, name) {
  return select(field(record, name));
}

function sameSecret(actual, expected) {
  const left = Buffer.from(String(actual || ""));
  const right = Buffer.from(String(expected || ""));
  return (
    left.length > 0 &&
    right.length > 0 &&
    left.length === right.length &&
    crypto.timingSafeEqual(left, right)
  );
}

function requireAdmin(req) {
  if (!ADMIN_SECRET) {
    throw new Error("Missing BILLING_ADMIN_SECRET in Vercel.");
  }

  if (!sameSecret(req.headers["x-billing-secret"], ADMIN_SECRET)) {
    const error = new Error("Billing Command Center access denied.");
    error.statusCode = 401;
    throw error;
  }
}

function urlFor(table, params = new URLSearchParams()) {
  return `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}?${params.toString()}`;
}

async function airtable(url, options = {}) {
  if (!TOKEN) throw new Error("Missing Airtable token in Vercel.");

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Airtable ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function allRecords(table, fields) {
  const records = [];
  let offset = "";

  do {
    const params = new URLSearchParams();
    params.set("pageSize", "100");
    fields.forEach((name) => params.append("fields[]", name));
    if (offset) params.set("offset", offset);

    const result = await airtable(urlFor(table, params));
    records.push(...(result.records || []));
    offset = result.offset || "";
  } while (offset);

  return records;
}

async function createRecord(table, fields) {
  const result = await airtable(
    `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`,
    {
      method: "POST",
      body: JSON.stringify({ records: [{ fields }], typecast: true }),
    }
  );
  return result.records?.[0];
}

async function updateRecord(table, recordId, fields) {
  return airtable(
    `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}/${recordId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ fields, typecast: true }),
    }
  );
}

function restaurantDto(record) {
  return {
    id: record.id,
    name: text(record, "Restaurant Name") || "Unnamed restaurant",
    restaurantId: text(record, "Restaurant ID"),
    status: selected(record, "Status"),
  };
}

function profileDto(record, restaurants) {
  const restaurantId = firstLink(field(record, "Restaurant"));
  const restaurant = restaurants.get(restaurantId);

  return {
    id: record.id,
    name: text(record, "Billing Profile Name"),
    restaurantId,
    restaurantName: restaurant?.name || "Unlinked restaurant",
    billingStatus: selected(record, "Billing Status") || "Onboarding",
    planName: text(record, "Plan Name"),
    monthlyRate: numeric(record, "Monthly Rate"),
    billingCycle: selected(record, "Billing Cycle") || "Monthly",
    billingDay: numeric(record, "Billing Day"),
    paymentTermsDays: numeric(record, "Payment Terms Days"),
    billingContactName: text(record, "Billing Contact Name"),
    billingContactEmail: text(record, "Billing Contact Email"),
    stripeCustomerId: text(record, "Stripe Customer ID"),
    stripeCustomerUrl: text(record, "Stripe Customer URL"),
    defaultCollectionMethod: selected(record, "Default Collection Method") || "Send Invoice",
    preferredPaymentMethod: selected(record, "Preferred Payment Method") || "Unknown",
    nextInvoiceDate: text(record, "Next Invoice Date"),
    commercialNotes: text(record, "Contract / Commercial Notes"),
    internalNotes: text(record, "Internal Notes"),
    active: field(record, "Active") === true,
  };
}

function invoiceDto(record, profiles, restaurants) {
  const profileId = firstLink(field(record, "Billing Profile"));
  const restaurantId = firstLink(field(record, "Restaurant"));
  const profile = profiles.get(profileId);
  const restaurant = restaurants.get(restaurantId);
  const amountDue = numeric(record, "Amount Due");
  const amountPaid = numeric(record, "Amount Paid");

  return {
    id: record.id,
    name: text(record, "Invoice Name"),
    profileId,
    profileName: profile?.name || "Billing profile",
    restaurantId,
    restaurantName: restaurant?.name || profile?.restaurantName || "Unlinked restaurant",
    invoiceStatus: selected(record, "Invoice Status") || "Draft",
    invoiceNumber: text(record, "Invoice Number") || "SYN-DRAFT",
    stripeInvoiceId: text(record, "Stripe Invoice ID"),
    stripeHostedInvoiceUrl: text(record, "Stripe Hosted Invoice URL"),
    stripeDashboardUrl: text(record, "Stripe Dashboard URL"),
    servicePeriodStart: text(record, "Service Period Start"),
    servicePeriodEnd: text(record, "Service Period End"),
    issuedAt: text(record, "Issued At"),
    dueDate: text(record, "Due Date"),
    paidAt: text(record, "Paid At"),
    amountDue,
    amountPaid,
    balanceDue: Math.max(amountDue - amountPaid, 0),
    currency: text(record, "Currency") || "USD",
    collectionMethod: selected(record, "Collection Method") || "Send Invoice",
    paymentMethod: selected(record, "Payment Method") || "Unknown",
    followUpStatus: selected(record, "Follow-Up Status") || "None Needed",
    nextFollowUpDate: text(record, "Next Follow-Up Date"),
    lastFollowUpAt: text(record, "Last Follow-Up At"),
    invoiceNotes: text(record, "Invoice Notes"),
    internalNotes: text(record, "Internal Notes"),
    stripeSyncStatus: selected(record, "Stripe Sync Status") || "Manual",
  };
}

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function summary(profiles, invoices) {
  const active = profiles.filter(
    (profile) => profile.active && profile.billingStatus === "Active"
  );
  const mrr = active.reduce(
    (sum, profile) => sum + (profile.billingCycle === "Monthly" ? profile.monthlyRate : 0),
    0
  );
  const open = invoices.filter((invoice) =>
    ["Draft", "Scheduled", "Sent", "Past Due"].includes(invoice.invoiceStatus)
  );
  const outstanding = open.reduce((sum, invoice) => sum + invoice.balanceDue, 0);
  const overdue = invoices.filter(
    (invoice) =>
      invoice.invoiceStatus === "Past Due" ||
      (invoice.invoiceStatus === "Sent" && invoice.dueDate && invoice.dueDate.slice(0, 10) < todayKey())
  );
  const followUps = invoices.filter(
    (invoice) =>
      !["Paid", "Void"].includes(invoice.invoiceStatus) &&
      invoice.followUpStatus !== "None Needed" &&
      invoice.nextFollowUpDate &&
      invoice.nextFollowUpDate.slice(0, 10) <= todayKey()
  );
  const next = [...active]
    .filter((profile) => profile.nextInvoiceDate)
    .sort((a, b) => a.nextInvoiceDate.localeCompare(b.nextInvoiceDate))[0];

  return {
    activeCustomerCount: active.length,
    monthlyRecurringRevenue: Number(mrr.toFixed(2)),
    outstanding: Number(outstanding.toFixed(2)),
    overdueCount: overdue.length,
    followUpsDueCount: followUps.length,
    nextInvoiceDate: next?.nextInvoiceDate || "",
    nextInvoiceCustomer: next?.restaurantName || "",
  };
}

async function loadCenter() {
  const [restaurantRows, profileRows, invoiceRows] = await Promise.all([
    allRecords(TABLES.restaurants, FIELDS.restaurants),
    allRecords(TABLES.profiles, FIELDS.profiles),
    allRecords(TABLES.invoices, FIELDS.invoices),
  ]);

  const restaurants = restaurantRows.map(restaurantDto).sort((a, b) => a.name.localeCompare(b.name));
  const restaurantMap = new Map(restaurants.map((record) => [record.id, record]));
  const profiles = profileRows
    .map((record) => profileDto(record, restaurantMap))
    .sort((a, b) => a.restaurantName.localeCompare(b.restaurantName));
  const profileMap = new Map(profiles.map((record) => [record.id, record]));
  const invoices = invoiceRows
    .map((record) => invoiceDto(record, profileMap, restaurantMap))
    .sort((a, b) => `${a.invoiceStatus}-${a.dueDate}`.localeCompare(`${b.invoiceStatus}-${b.dueDate}`));

  return { restaurants, profiles, invoices, summary: summary(profiles, invoices) };
}

function profileFields(input) {
  if (!clean(input.restaurantId)) throw new Error("Choose a restaurant.");
  if (!clean(input.name)) throw new Error("Billing profile name is required.");

  return {
    "Billing Profile Name": clean(input.name),
    Restaurant: [clean(input.restaurantId)],
    "Billing Status": clean(input.billingStatus) || "Active",
    "Plan Name": clean(input.planName),
    "Monthly Rate": number(input.monthlyRate),
    "Billing Cycle": clean(input.billingCycle) || "Monthly",
    "Billing Day": Math.max(1, Math.min(31, Math.round(number(input.billingDay) || 1))),
    "Payment Terms Days": Math.max(0, Math.min(120, Math.round(number(input.paymentTermsDays) || 7))),
    "Billing Contact Name": clean(input.billingContactName),
    "Billing Contact Email": clean(input.billingContactEmail),
    "Stripe Customer ID": clean(input.stripeCustomerId),
    "Stripe Customer URL": clean(input.stripeCustomerUrl),
    "Default Collection Method": clean(input.defaultCollectionMethod) || "Send Invoice",
    "Preferred Payment Method": clean(input.preferredPaymentMethod) || "Unknown",
    "Next Invoice Date": clean(input.nextInvoiceDate) || null,
    "Contract / Commercial Notes": clean(input.commercialNotes),
    "Internal Notes": clean(input.internalNotes),
    Active: input.active !== false,
  };
}

function invoiceFields(input) {
  if (!clean(input.profileId) || !clean(input.restaurantId)) {
    throw new Error("Choose a billing profile before recording an invoice.");
  }
  if (!clean(input.name)) throw new Error("Invoice name is required.");
  if (number(input.amountDue) <= 0) throw new Error("Amount due must be greater than zero.");

  return {
    "Invoice Name": clean(input.name),
    Restaurant: [clean(input.restaurantId)],
    "Billing Profile": [clean(input.profileId)],
    "Invoice Status": clean(input.invoiceStatus) || "Draft",
    "Invoice Number": clean(input.invoiceNumber) || "SYN-DRAFT",
    "Stripe Invoice ID": clean(input.stripeInvoiceId),
    "Stripe Hosted Invoice URL": clean(input.stripeHostedInvoiceUrl),
    "Stripe Dashboard URL": clean(input.stripeDashboardUrl),
    "Service Period Start": clean(input.servicePeriodStart) || null,
    "Service Period End": clean(input.servicePeriodEnd) || null,
    "Due Date": clean(input.dueDate) || null,
    "Amount Due": number(input.amountDue),
    "Amount Paid": number(input.amountPaid),
    Currency: clean(input.currency) || "USD",
    "Collection Method": clean(input.collectionMethod) || "Send Invoice",
    "Payment Method": clean(input.paymentMethod) || "Unknown",
    "Follow-Up Status": clean(input.followUpStatus) || "None Needed",
    "Next Follow-Up Date": clean(input.nextFollowUpDate) || null,
    "Invoice Notes": clean(input.invoiceNotes),
    "Internal Notes": clean(input.internalNotes),
    "Stripe Sync Status": "Manual",
  };
}

function invoiceUpdateFields(input) {
  const fields = {};
  const textFields = {
    invoiceNumber: "Invoice Number",
    stripeInvoiceId: "Stripe Invoice ID",
    stripeHostedInvoiceUrl: "Stripe Hosted Invoice URL",
    stripeDashboardUrl: "Stripe Dashboard URL",
    internalNotes: "Internal Notes",
  };
  const selectFields = {
    invoiceStatus: "Invoice Status",
    followUpStatus: "Follow-Up Status",
    paymentMethod: "Payment Method",
  };
  Object.entries(textFields).forEach(([key, name]) => {
    if (Object.prototype.hasOwnProperty.call(input, key)) fields[name] = clean(input[key]);
  });
  Object.entries(selectFields).forEach(([key, name]) => {
    if (Object.prototype.hasOwnProperty.call(input, key)) fields[name] = clean(input[key]);
  });
  if (Object.prototype.hasOwnProperty.call(input, "nextFollowUpDate")) {
    fields["Next Follow-Up Date"] = clean(input.nextFollowUpDate) || null;
  }
  if (Object.prototype.hasOwnProperty.call(input, "lastFollowUpAt")) {
    fields["Last Follow-Up At"] = clean(input.lastFollowUpAt) || null;
  }
  return fields;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    requireAdmin(req);

    if (req.method === "GET") {
      return reply(res, 200, { ok: true, ...(await loadCenter()) });
    }

    if (req.method !== "POST") {
      return reply(res, 405, { ok: false, error: "Method not allowed" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    if (body.action === "create_profile") {
      await createRecord(TABLES.profiles, profileFields(body.profile || {}));
      return reply(res, 200, {
        ok: true,
        message: "Billing profile created.",
        ...(await loadCenter()),
      });
    }

    if (body.action === "create_invoice") {
      await createRecord(TABLES.invoices, invoiceFields(body.invoice || {}));
      return reply(res, 200, {
        ok: true,
        message: "Invoice mirror recorded. Stripe remains the source of truth.",
        ...(await loadCenter()),
      });
    }

    if (body.action === "update_invoice") {
      const invoiceId = clean(body.invoiceId);
      if (!invoiceId) throw new Error("Missing invoiceId.");
      const fields = invoiceUpdateFields(body.invoice || {});
      if (!Object.keys(fields).length) throw new Error("No supported update fields supplied.");
      await updateRecord(TABLES.invoices, invoiceId, fields);
      return reply(res, 200, {
        ok: true,
        message: "Invoice tracker updated.",
        ...(await loadCenter()),
      });
    }

    return reply(res, 400, { ok: false, error: "Unknown billing action." });
  } catch (error) {
    console.error("billing-command-center error:", error);
    return reply(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Billing Command Center failed.",
    });
  }
}
