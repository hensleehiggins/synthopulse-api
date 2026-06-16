const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appD303evZM2SlvMR";
const OPERATOR_USERS_TABLE_ID = "tblonO1fBQNB0PhJU";

const DEFAULT_RESTAURANT_NAME =
  process.env.KITCHENPULSE_DEFAULT_RESTAURANT_NAME || "Chloe's";
const DEFAULT_RESTAURANT_RECORD_ID =
  process.env.KITCHENPULSE_DEFAULT_RESTAURANT_RECORD_ID || "recn2LoRESKN33zHW";

const FIELD = {
  email: "fldJp94NeNRKnS23b",
  displayName: "fldpsasdMGgSa9FDm",
  authProviderUserId: "fldtP3EVMJDBIyml8",
  authProvider: "fldUEecqzcQC2WtGD",
  restaurantName: "flduqtAU8z5JNDYoF",
  restaurantAirtableRecordId: "fldH6iS8hwxKXjjIL",
  role: "fldXKROtZ9cgkwdOR",
  accessStatus: "fldTDjECLgqfnJekT",
  mobileAccess: "fldiSdCIh3l1YCSVm",
  portalAccess: "fldCXoESj5LEH2bP0",
  lastLoginAt: "fldVEJC6mI29yZoFe",
  notes: "fldAHuxgHyQF9DCG3",

  sendClerkInvite: "fld6Hs406Qxsebf1A",
  inviteStatus: "fldYYjjgAC1gzQnLg",
  clerkInvitationId: "fldGrZtClTZo4RmCX",
  inviteSentAt: "fldywY9PtSmHmC7xE",
  inviteLastError: "fldDfHbhdQQ4MtNxs",
  inviteReadySummary: "fld0sXZnocU6O7DZa",
};

const INVITE_STATUS = {
  NOT_INVITED: "Not Invited",
  READY: "Ready to Invite",
  SENT: "Invite Sent",
  LINKED: "Accepted / Linked",
  ERROR: "Error",
  DISABLED: "Disabled",
};

function getAirtableToken() {
  return (
    process.env.AIRTABLE_TOKEN ||
    process.env.AIRTABLE_API_KEY ||
    process.env.AIRTABLE_PAT ||
    process.env.KITCHENPULSE_AIRTABLE_TOKEN ||
    ""
  );
}

function getAutomationSecret() {
  return process.env.KITCHENPULSE_AUTOMATION_SECRET || "";
}

function getClerkSecretKey() {
  return process.env.CLERK_SECRET_KEY || "";
}

function getInviteRedirectUrl() {
  return process.env.CLERK_INVITE_REDIRECT_URL || "";
}

function getAllowedOrigin(origin) {
  const allowed = new Set([
    "https://portal.synthopulse.ai",
    "https://www.synthopulse.ai",
    "https://synthopulse.ai",
    "http://localhost:3000",
    "http://localhost:5173",
  ]);

  if (origin && allowed.has(origin)) return origin;

  return "https://portal.synthopulse.ai";
}

function setCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", getAllowedOrigin(req.headers.origin));
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-kitchenpulse-secret"
  );
}

function sendJson(req, res, status, payload) {
  setCors(req, res);
  return res.status(status).json(payload);
}

async function readJsonSafe(response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanText(value) {
  return String(value || "").trim();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function asSelectName(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.name) return value.name;
  return String(value);
}

function getSecretFromRequest(req) {
  return (
    req.headers["x-kitchenpulse-secret"] ||
    req.headers["X-KitchenPulse-Secret"] ||
    req.query?.secret ||
    req.body?.automationSecret ||
    ""
  );
}

function validateSecret(req) {
  const expected = getAutomationSecret();
  const received = String(getSecretFromRequest(req) || "");

  if (!expected) {
    return {
      ok: false,
      status: 500,
      error: "missing_automation_secret",
      message: "KITCHENPULSE_AUTOMATION_SECRET is not set in Vercel.",
    };
  }

  if (!received || received !== expected) {
    return {
      ok: false,
      status: 401,
      error: "unauthorized",
      message: "Missing or invalid admin key.",
    };
  }

  return { ok: true };
}

function assertEnv({ needClerk = false } = {}) {
  const missing = [];

  if (!getAirtableToken()) missing.push("AIRTABLE_TOKEN or AIRTABLE_API_KEY");
  if (needClerk && !getClerkSecretKey()) missing.push("CLERK_SECRET_KEY");

  if (missing.length) {
    return {
      ok: false,
      status: 500,
      error: "missing_env",
      message: `Missing required Vercel env var(s): ${missing.join(", ")}`,
    };
  }

  return { ok: true };
}

function escapeFormulaString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function airtableUrl(path = "") {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${OPERATOR_USERS_TABLE_ID}${path}`;
}

async function airtableFetch(path, options = {}) {
  const response = await fetch(airtableUrl(path), {
    ...options,
    headers: {
      Authorization: `Bearer ${getAirtableToken()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await readJsonSafe(response);

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.error ||
      data?.message ||
      `Airtable request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data;
}

function sanitizeOperator(record) {
  const fields = record?.fields || {};

  return {
    id: record?.id || "",
    email: normalizeEmail(fields[FIELD.email]),
    displayName: fields[FIELD.displayName] || "",
    authProviderUserId: fields[FIELD.authProviderUserId] || "",
    authProvider: asSelectName(fields[FIELD.authProvider]),
    restaurantName: fields[FIELD.restaurantName] || "",
    restaurantAirtableRecordId: fields[FIELD.restaurantAirtableRecordId] || "",
    role: asSelectName(fields[FIELD.role]),
    accessStatus: asSelectName(fields[FIELD.accessStatus]),
    mobileAccess: Boolean(fields[FIELD.mobileAccess]),
    portalAccess: Boolean(fields[FIELD.portalAccess]),
    lastLoginAt: fields[FIELD.lastLoginAt] || "",
    notes: fields[FIELD.notes] || "",
    inviteStatus: asSelectName(fields[FIELD.inviteStatus]),
    clerkInvitationId: fields[FIELD.clerkInvitationId] || "",
    inviteSentAt: fields[FIELD.inviteSentAt] || "",
    inviteLastError: fields[FIELD.inviteLastError] || "",
    inviteReadySummary: fields[FIELD.inviteReadySummary] || "",
  };
}

async function findOperatorByEmail(email) {
  const formula = `LOWER({Email}) = "${escapeFormulaString(email)}"`;
  const params = new URLSearchParams();

  params.set("maxRecords", "1");
  params.set("filterByFormula", formula);

  [
    FIELD.email,
    FIELD.displayName,
    FIELD.role,
    FIELD.accessStatus,
    FIELD.mobileAccess,
    FIELD.portalAccess,
    FIELD.authProviderUserId,
    FIELD.inviteStatus,
    FIELD.inviteSentAt,
    FIELD.inviteLastError,
  ].forEach((fieldId) => params.append("fields[]", fieldId));

  const data = await airtableFetch(`?${params.toString()}`);
  const record = data?.records?.[0];

  return record ? sanitizeOperator(record) : null;
}

async function listOperators() {
  const params = new URLSearchParams();

  params.set("maxRecords", "50");
  params.set(
    "filterByFormula",
    `{Restaurant Airtable Record ID} = "${escapeFormulaString(
      DEFAULT_RESTAURANT_RECORD_ID
    )}"`
  );

  [
    FIELD.email,
    FIELD.displayName,
    FIELD.authProviderUserId,
    FIELD.authProvider,
    FIELD.restaurantName,
    FIELD.restaurantAirtableRecordId,
    FIELD.role,
    FIELD.accessStatus,
    FIELD.mobileAccess,
    FIELD.portalAccess,
    FIELD.lastLoginAt,
    FIELD.notes,
    FIELD.inviteStatus,
    FIELD.clerkInvitationId,
    FIELD.inviteSentAt,
    FIELD.inviteLastError,
    FIELD.inviteReadySummary,
  ].forEach((fieldId) => params.append("fields[]", fieldId));

  const data = await airtableFetch(`?${params.toString()}`);

  return (data.records || [])
    .map((record) => sanitizeOperator(record))
    .sort((a, b) => {
      const aLinked = a.authProviderUserId ? 1 : 0;
      const bLinked = b.authProviderUserId ? 1 : 0;

      if (aLinked !== bLinked) return aLinked - bLinked;

      return String(a.displayName || a.email).localeCompare(
        String(b.displayName || b.email)
      );
    });
}

async function createOperatorRecord(input) {
  const nowNote = input.notes
    ? input.notes
    : `Created from KitchenPulse Operator Accounts page on ${new Date().toISOString()}.`;

  const fields = {
    [FIELD.email]: input.email,
    [FIELD.displayName]: input.displayName,
    [FIELD.authProvider]: "Clerk",
    [FIELD.restaurantName]: DEFAULT_RESTAURANT_NAME,
    [FIELD.restaurantAirtableRecordId]: DEFAULT_RESTAURANT_RECORD_ID,
    [FIELD.role]: input.role,
    [FIELD.accessStatus]: "Active",
    [FIELD.mobileAccess]: Boolean(input.mobileAccess),
    [FIELD.portalAccess]: Boolean(input.portalAccess),
    [FIELD.notes]: nowNote,
    [FIELD.sendClerkInvite]: Boolean(input.sendInvite),
    [FIELD.inviteStatus]: input.sendInvite
      ? INVITE_STATUS.READY
      : INVITE_STATUS.NOT_INVITED,
    [FIELD.inviteLastError]: "",
  };

  const data = await airtableFetch("", {
    method: "POST",
    body: JSON.stringify({
      records: [{ fields }],
      typecast: true,
    }),
  });

  return data?.records?.[0];
}

async function updateOperatorRecord(recordId, fields) {
  const data = await airtableFetch(`/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields,
      typecast: true,
    }),
  });

  return data;
}

function compactClerkError(data) {
  if (!data) return "Unknown Clerk error.";

  const firstError = Array.isArray(data.errors) ? data.errors[0] : null;

  return (
    firstError?.long_message ||
    firstError?.message ||
    firstError?.code ||
    data.message ||
    data.error ||
    data.raw ||
    "Unknown Clerk error."
  );
}

function isExistingInviteOrUserError(message) {
  const text = String(message || "").toLowerCase();

  return (
    text.includes("already") ||
    text.includes("exists") ||
    text.includes("duplicate") ||
    text.includes("invited")
  );
}

async function createClerkInvitation(operator) {
  const redirectUrl = getInviteRedirectUrl();

  const body = {
    email_address: operator.email,
    notify: true,
    ignore_existing: true,
    expires_in_days: 30,
    public_metadata: {
      kitchenpulse_operator_user_record_id: operator.id,
      restaurant_airtable_record_id: operator.restaurantAirtableRecordId,
      restaurant_name: operator.restaurantName || DEFAULT_RESTAURANT_NAME,
      role: operator.role || "",
      mobile_access: operator.mobileAccess,
      portal_access: operator.portalAccess,
    },
  };

  if (redirectUrl) {
    body.redirect_url = redirectUrl;
  }

  const response = await fetch("https://api.clerk.com/v1/invitations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getClerkSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await readJsonSafe(response);

  if (!response.ok) {
    const message = compactClerkError(data);

    if (isExistingInviteOrUserError(message)) {
      return {
        ok: true,
        alreadyExists: true,
        invitation: null,
        clerkMessage: message,
      };
    }

    const error = new Error(message);
    error.clerkPayload = data;
    throw error;
  }

  return {
    ok: true,
    alreadyExists: false,
    invitation: data,
    clerkMessage: "",
  };
}

function validateCreateInput(body = {}) {
  const email = normalizeEmail(body.email);
  const displayName = cleanText(body.displayName);
  const role = cleanText(body.role || "Staff");
  const mobileAccess = Boolean(body.mobileAccess);
  const portalAccess = Boolean(body.portalAccess);
  const notes = cleanText(body.notes);
  const sendInvite = body.sendInvite !== false;

  if (!displayName) {
    return {
      ok: false,
      message: "Display name is required.",
    };
  }

  if (!email || !isValidEmail(email)) {
    return {
      ok: false,
      message: "A valid email address is required.",
    };
  }

  if (!role) {
    return {
      ok: false,
      message: "Role is required.",
    };
  }

  if (!mobileAccess && !portalAccess) {
    return {
      ok: false,
      message: "Choose Mobile Access, Portal Access, or both.",
    };
  }

  return {
    ok: true,
    value: {
      email,
      displayName,
      role,
      mobileAccess,
      portalAccess,
      notes,
      sendInvite,
    },
  };
}

async function handleGet(req, res) {
  const auth = validateSecret(req);
  if (!auth.ok) {
    return sendJson(req, res, auth.status, {
      ok: false,
      error: auth.error,
      message: auth.message,
    });
  }

  const env = assertEnv();
  if (!env.ok) {
    return sendJson(req, res, env.status, {
      ok: false,
      error: env.error,
      message: env.message,
    });
  }

  try {
    const operators = await listOperators();

    return sendJson(req, res, 200, {
      ok: true,
      restaurantName: DEFAULT_RESTAURANT_NAME,
      restaurantAirtableRecordId: DEFAULT_RESTAURANT_RECORD_ID,
      count: operators.length,
      operators,
    });
  } catch (error) {
    return sendJson(req, res, 500, {
      ok: false,
      error: "list_failed",
      message:
        error instanceof Error
          ? error.message
          : "Unable to load operator accounts.",
    });
  }
}

async function handlePost(req, res) {
  const auth = validateSecret(req);
  if (!auth.ok) {
    return sendJson(req, res, auth.status, {
      ok: false,
      error: auth.error,
      message: auth.message,
    });
  }

  const input = validateCreateInput(req.body || {});
  if (!input.ok) {
    return sendJson(req, res, 400, {
      ok: false,
      error: "invalid_operator_input",
      message: input.message,
    });
  }

  const env = assertEnv({ needClerk: input.value.sendInvite });
  if (!env.ok) {
    return sendJson(req, res, env.status, {
      ok: false,
      error: env.error,
      message: env.message,
    });
  }

  let createdRecord = null;
  let operator = null;

  try {
    const existing = await findOperatorByEmail(input.value.email);

    if (existing) {
      return sendJson(req, res, 409, {
        ok: false,
        error: "operator_exists",
        message:
          "An Operator Users row already exists for this email. Use the existing row or change the email.",
        operator: existing,
      });
    }

    createdRecord = await createOperatorRecord(input.value);
    operator = sanitizeOperator(createdRecord);

    if (!input.value.sendInvite) {
      return sendJson(req, res, 200, {
        ok: true,
        status: "operator_created",
        message: "Operator account created. Clerk invite was not sent.",
        operator,
      });
    }

    const clerkResult = await createClerkInvitation(operator);

    const invitationId =
      clerkResult.invitation?.id ||
      clerkResult.invitation?.invitation_id ||
      "";

    const nowIso = new Date().toISOString();

    await updateOperatorRecord(operator.id, {
      [FIELD.sendClerkInvite]: false,
      [FIELD.inviteStatus]: INVITE_STATUS.SENT,
      [FIELD.clerkInvitationId]: invitationId,
      [FIELD.inviteSentAt]: nowIso,
      [FIELD.inviteLastError]: clerkResult.alreadyExists
        ? `Clerk says this email already exists or was already invited. User can sign in with the app. Detail: ${clerkResult.clerkMessage}`
        : "",
    });

    return sendJson(req, res, 200, {
      ok: true,
      status: clerkResult.alreadyExists
        ? "existing_clerk_identity"
        : "operator_created_and_invited",
      message: clerkResult.alreadyExists
        ? "Operator account created. Clerk says this email already exists or was already invited, so the user can sign in."
        : "Operator account created and Clerk invite sent.",
      operator: {
        ...operator,
        inviteStatus: INVITE_STATUS.SENT,
        clerkInvitationId: invitationId,
        inviteSentAt: nowIso,
      },
      invitationId,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to create operator account.";

    if (operator?.id) {
      try {
        await updateOperatorRecord(operator.id, {
          [FIELD.sendClerkInvite]: false,
          [FIELD.inviteStatus]: INVITE_STATUS.ERROR,
          [FIELD.inviteLastError]: message,
        });
      } catch (updateError) {
        console.error("Failed to write operator account error to Airtable", updateError);
      }
    }

    console.error("operator-account failed", {
      message,
      createdRecordId: createdRecord?.id || null,
      error,
    });

    return sendJson(req, res, 500, {
      ok: false,
      error: "operator_account_failed",
      message,
    });
  }
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return handleGet(req, res);
  }

  if (req.method === "POST") {
    return handlePost(req, res);
  }

  return sendJson(req, res, 405, {
    ok: false,
    error: "method_not_allowed",
    message: "Use GET to list operators or POST to create an operator account.",
  });
}
