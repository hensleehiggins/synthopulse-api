/********************************************************************
 * KitchenPulse API Auth Helper v1
 *
 * Purpose:
 * - Verifies Clerk session tokens sent from the mobile app / future portal.
 * - Looks up the signed-in user in Airtable "Operator Users".
 * - Enforces account status, role, mobile/portal access, and tenant scope.
 *
 * Current tenant strategy:
 * - Operator Users is the KitchenPulse access registry.
 * - Restaurant Airtable Record ID should eventually be filled per user.
 * - Until then, this helper can fall back to AIRTABLE_CHLOES_RESTAURANT_ID
 *   or KITCHENPULSE_DEFAULT_RESTAURANT_ID.
 *
 * Required env before protected endpoints are enabled:
 * - AIRTABLE_BASE_ID
 * - AIRTABLE_PAT or AIRTABLE_TOKEN
 * - CLERK_SECRET_KEY
 *
 * Optional env:
 * - CLERK_JWT_KEY
 * - AIRTABLE_OPERATOR_USERS_TABLE
 * - KITCHENPULSE_DEFAULT_RESTAURANT_ID
 * - AIRTABLE_CHLOES_RESTAURANT_ID
 ********************************************************************/

const Airtable = require("airtable");

const OPERATOR_USERS_TABLE =
  process.env.AIRTABLE_OPERATOR_USERS_TABLE || "Operator Users";

const ROLE_RANK = {
  "READ ONLY": 0,
  STAFF: 1,
  MANAGER: 2,
  OWNER: 3,
  ADMIN: 4,
};

let cachedBase = null;
let cachedVerifyToken = null;

function getAirtableBase() {
  if (cachedBase) {
    return cachedBase;
  }

  const apiKey = process.env.AIRTABLE_PAT || process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey) {
    throw new Error("Missing AIRTABLE_PAT or AIRTABLE_TOKEN.");
  }

  if (!baseId) {
    throw new Error("Missing AIRTABLE_BASE_ID.");
  }

  cachedBase = new Airtable({ apiKey }).base(baseId);
  return cachedBase;
}

async function getVerifyToken() {
  if (cachedVerifyToken) {
    return cachedVerifyToken;
  }

  const clerkBackend = await import("@clerk/backend");
  cachedVerifyToken = clerkBackend.verifyToken;

  if (!cachedVerifyToken) {
    throw new Error("Could not load verifyToken from @clerk/backend.");
  }

  return cachedVerifyToken;
}

function sendJson(res, statusCode, body) {
  res.status(statusCode).json(body);
}

function getHeader(req, name) {
  const target = String(name || "").toLowerCase();
  const headers = req.headers || {};

  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === target) {
      return Array.isArray(value) ? value[0] : value;
    }
  }

  return "";
}

function getBearerToken(req) {
  const authorization = String(getHeader(req, "authorization") || "").trim();

  if (!authorization) {
    return "";
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function airtableFormulaString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeSelect(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "object" && value.name) {
    return String(value.name).trim();
  }

  return String(value).trim();
}

function normalizeAccessRole(value) {
  const raw = normalizeSelect(value);

  const normalized = raw
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";

  if (normalized === "ADMIN") return "Admin";
  if (normalized === "OWNER") return "Owner";

  // Permission aliases. Chef is a job title, but it should use Manager access.
  if (
    normalized === "MANAGER" ||
    normalized === "GM" ||
    normalized === "GENERAL MANAGER" ||
    normalized === "CHEF" ||
    normalized === "KITCHEN MANAGER" ||
    normalized.includes("CHEF")
  ) {
    return "Manager";
  }

  if (
    normalized === "STAFF" ||
    normalized === "OPERATOR" ||
    normalized === "REVIEWER"
  ) {
    return "Staff";
  }

  if (normalized === "READ ONLY" || normalized === "READONLY") {
    return "Read Only";
  }

  return raw;
}

function normalizeRole(value) {
  return normalizeAccessRole(value).toUpperCase();
}

function boolField(value) {
  return value === true;
}

function roleMeetsMinimum(role, minimumRole) {
  const userRank = ROLE_RANK[normalizeRole(role)] ?? -1;
  const minimumRank = ROLE_RANK[normalizeRole(minimumRole)] ?? 999;

  return userRank >= minimumRank;
}

function roleIsAllowed(role, allowedRoles) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return true;
  }

  const normalizedRole = normalizeRole(role);

  return allowedRoles.some(
    (allowedRole) => normalizeRole(allowedRole) === normalizedRole
  );
}

function extractEmailFromVerifiedToken(verifiedToken) {
  return (
    normalizeEmail(verifiedToken?.email) ||
    normalizeEmail(verifiedToken?.email_address) ||
    normalizeEmail(verifiedToken?.primary_email_address) ||
    normalizeEmail(verifiedToken?.claims?.email) ||
    normalizeEmail(verifiedToken?.claims?.email_address) ||
    ""
  );
}

async function fetchClerkUserEmail(clerkUserId) {
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!secretKey || !clerkUserId) {
    return "";
  }

  const response = await fetch(
    `https://api.clerk.com/v1/users/${encodeURIComponent(clerkUserId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    return "";
  }

  const user = await response.json();

  const primaryEmailId = user?.primary_email_address_id;
  const emailAddresses = Array.isArray(user?.email_addresses)
    ? user.email_addresses
    : [];

  const primaryEmail = emailAddresses.find(
    (entry) => entry?.id && entry.id === primaryEmailId
  );

  return (
    normalizeEmail(primaryEmail?.email_address) ||
    normalizeEmail(emailAddresses[0]?.email_address) ||
    ""
  );
}

async function verifyClerkRequest(req) {
  const token = getBearerToken(req);

  if (!token) {
    return {
      ok: false,
      statusCode: 401,
      error: "missing_auth_token",
      message: "Sign in is required.",
    };
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  const jwtKey = process.env.CLERK_JWT_KEY;

  if (!secretKey && !jwtKey) {
    return {
      ok: false,
      statusCode: 500,
      error: "auth_not_configured",
      message: "KitchenPulse auth is not configured.",
    };
  }

  try {
    const verifyToken = await getVerifyToken();

    const verifyOptions = {};

    if (jwtKey) {
      verifyOptions.jwtKey = jwtKey;
    }

    if (secretKey) {
      verifyOptions.secretKey = secretKey;
    }

    const verifiedToken = await verifyToken(token, verifyOptions);
    const clerkUserId = normalizeText(verifiedToken?.sub);

    if (!clerkUserId) {
      return {
        ok: false,
        statusCode: 401,
        error: "invalid_auth_token",
        message: "The sign-in token is missing a user ID.",
      };
    }

    let email = extractEmailFromVerifiedToken(verifiedToken);

    if (!email) {
      email = await fetchClerkUserEmail(clerkUserId);
    }

    return {
      ok: true,
      clerkUserId,
      email,
      verifiedToken,
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 401,
      error: "invalid_auth_token",
      message: "The sign-in token could not be verified.",
      detail: error instanceof Error ? error.message : String(error || ""),
    };
  }
}

function buildOperatorUserFormula({ clerkUserId, email }) {
  const clauses = [];

  if (clerkUserId) {
    clauses.push(
      `{Auth Provider User ID}='${airtableFormulaString(clerkUserId)}'`
    );
  }

  if (email) {
    clauses.push(`LOWER({Email})='${airtableFormulaString(email)}'`);
  }

  if (clauses.length === 0) {
    return "FALSE()";
  }

  if (clauses.length === 1) {
    return clauses[0];
  }

  return `OR(${clauses.join(",")})`;
}

async function findOperatorUser({ clerkUserId, email }) {
  const base = getAirtableBase();
  const formula = buildOperatorUserFormula({ clerkUserId, email });

  const records = await base(OPERATOR_USERS_TABLE)
    .select({
      maxRecords: 10,
      filterByFormula: formula,
      fields: [
        "Email",
        "Display Name",
        "Auth Provider User ID",
        "Auth Provider",
        "Restaurant Name",
        "Restaurant Airtable Record ID",
        "Role",
        "Access Status",
        "Mobile Access",
        "Portal Access",
        "Last Login At",
        "Notes",
      ],
    })
    .firstPage();

  if (!records.length) {
    return null;
  }

  const exactAuthMatch = records.find(
    (record) =>
      normalizeText(record.get("Auth Provider User ID")) &&
      normalizeText(record.get("Auth Provider User ID")) === clerkUserId
  );

  const exactEmailMatch = records.find(
    (record) => normalizeEmail(record.get("Email")) === email
  );

  return exactAuthMatch || exactEmailMatch || records[0];
}

async function maybeBackfillOperatorUser(record, clerkUserId) {
  const existingAuthId = normalizeText(record.get("Auth Provider User ID"));

  if (existingAuthId || !clerkUserId) {
    return;
  }

  await getAirtableBase()(OPERATOR_USERS_TABLE).update(record.id, {
    "Auth Provider User ID": clerkUserId,
  });
}

async function maybeTouchLastLogin(record, shouldTouch) {
  if (!shouldTouch) {
    return;
  }

  await getAirtableBase()(OPERATOR_USERS_TABLE).update(record.id, {
    "Last Login At": new Date().toISOString(),
  });
}

function serializeOperatorUser(record) {
  const fields = record.fields || {};

  const restaurantRecordId =
    normalizeText(fields["Restaurant Airtable Record ID"]) ||
    normalizeText(process.env.KITCHENPULSE_DEFAULT_RESTAURANT_ID) ||
    normalizeText(process.env.AIRTABLE_CHLOES_RESTAURANT_ID);

  return {
    recordId: record.id,
    email: normalizeEmail(fields.Email),
    displayName: normalizeText(fields["Display Name"]),
    authProviderUserId: normalizeText(fields["Auth Provider User ID"]),
    authProvider: normalizeSelect(fields["Auth Provider"]),
    restaurantName: normalizeText(fields["Restaurant Name"]),
    restaurantRecordId,
    role: normalizeAccessRole(fields.Role),
    accessStatus: normalizeSelect(fields["Access Status"]),
    mobileAccess: boolField(fields["Mobile Access"]),
    portalAccess: boolField(fields["Portal Access"]),
  };
}

/**
 * Authenticate a KitchenPulse request.
 *
 * options:
 * - source: "mobile" | "portal" | "api"
 * - minimumRole: "Staff" | "Manager" | "Owner" | "Admin"
 * - allowedRoles: array of exact role names
 * - touchLastLogin: boolean
 */
async function authenticateKitchenPulseUser(req, options = {}) {
  const source = normalizeText(options.source || "mobile").toLowerCase();

  const clerkAuth = await verifyClerkRequest(req);

  if (!clerkAuth.ok) {
    return clerkAuth;
  }

  const email = normalizeEmail(clerkAuth.email);
  const clerkUserId = normalizeText(clerkAuth.clerkUserId);

  if (!email && !clerkUserId) {
    return {
      ok: false,
      statusCode: 401,
      error: "missing_user_identity",
      message: "KitchenPulse could not identify the signed-in user.",
    };
  }

  const operatorRecord = await findOperatorUser({
    clerkUserId,
    email,
  });

  if (!operatorRecord) {
    return {
      ok: false,
      statusCode: 403,
      error: "operator_user_not_found",
      message: "This account is not authorized for KitchenPulse.",
      clerkUserId,
      email,
    };
  }

  await maybeBackfillOperatorUser(operatorRecord, clerkUserId);
  await maybeTouchLastLogin(operatorRecord, options.touchLastLogin === true);

  const operatorUser = serializeOperatorUser(operatorRecord);

  if (normalizeSelect(operatorUser.accessStatus) !== "Active") {
    return {
      ok: false,
      statusCode: 403,
      error: "operator_user_inactive",
      message: "This KitchenPulse account is not active.",
      operatorUser,
    };
  }

  if (source === "mobile" && operatorUser.mobileAccess !== true) {
    return {
      ok: false,
      statusCode: 403,
      error: "mobile_access_denied",
      message: "This account does not have mobile app access.",
      operatorUser,
    };
  }

  if (source === "portal" && operatorUser.portalAccess !== true) {
    return {
      ok: false,
      statusCode: 403,
      error: "portal_access_denied",
      message: "This account does not have portal access.",
      operatorUser,
    };
  }

  if (
    options.minimumRole &&
    !roleMeetsMinimum(operatorUser.role, options.minimumRole)
  ) {
    return {
      ok: false,
      statusCode: 403,
      error: "role_denied",
      message: "This account does not have permission for that action.",
      requiredRole: options.minimumRole,
      operatorUser,
    };
  }

  if (
    Array.isArray(options.allowedRoles) &&
    options.allowedRoles.length > 0 &&
    !roleIsAllowed(operatorUser.role, options.allowedRoles)
  ) {
    return {
      ok: false,
      statusCode: 403,
      error: "role_denied",
      message: "This account does not have permission for that action.",
      allowedRoles: options.allowedRoles,
      operatorUser,
    };
  }

  if (!operatorUser.restaurantRecordId) {
    return {
      ok: false,
      statusCode: 403,
      error: "restaurant_not_configured",
      message: "This account is not assigned to a restaurant.",
      operatorUser,
    };
  }

  return {
    ok: true,
    clerkUserId,
    email: operatorUser.email || email,
    role: operatorUser.role,
    restaurantName: operatorUser.restaurantName,
    restaurantRecordId: operatorUser.restaurantRecordId,
    operatorUser,
    verifiedToken: clerkAuth.verifiedToken,
  };
}

async function requireKitchenPulseUser(req, res, options = {}) {
  const auth = await authenticateKitchenPulseUser(req, options);

  if (!auth.ok) {
    sendJson(res, auth.statusCode || 401, {
      ok: false,
      error: auth.error || "unauthorized",
      message: auth.message || "KitchenPulse authorization failed.",
    });

    return null;
  }

  return auth;
}

module.exports = {
  ROLE_RANK,
  authenticateKitchenPulseUser,
  requireKitchenPulseUser,
  sendJson,
  getBearerToken,
};
