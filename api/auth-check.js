/********************************************************************
 * KitchenPulse API - Auth Check
 *
 * Purpose:
 * - Safe smoke-test endpoint for the shared KitchenPulse auth layer.
 * - Verifies Clerk token.
 * - Finds matching Operator Users record in Airtable.
 * - Confirms tenant, role, and mobile/portal access.
 *
 * Does NOT:
 * - Create receipts
 * - Submit counts
 * - Update order rules
 * - Touch operational data
 ********************************************************************/

const { requireKitchenPulseUser } = require("./_auth");

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "method_not_allowed",
      message: "Use GET or POST for auth-check.",
    });
  }

  try {
    const auth = await requireKitchenPulseUser(req, res, {
      source: "mobile",
      minimumRole: "Staff",
      touchLastLogin: true,
    });

    if (!auth) {
      return;
    }

    return res.status(200).json({
      ok: true,
      message: "KitchenPulse auth check passed.",
      user: {
        email: auth.email,
        role: auth.role,
        restaurantName: auth.restaurantName,
        restaurantRecordId: auth.restaurantRecordId,
        operatorUserRecordId: auth.operatorUser?.recordId,
        mobileAccess: auth.operatorUser?.mobileAccess,
        portalAccess: auth.operatorUser?.portalAccess,
      },
      auth: {
        clerkUserId: auth.clerkUserId,
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "auth_check_failed",
      message: error instanceof Error ? error.message : "Auth check failed.",
    });
  }
};
