"use strict";

let privyClientPromise;

function normalizeIdentity(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function getClaimUserId(claims) {
  return claims?.userId || claims?.user_id || claims?.sub || "";
}

function getVerifiedEmail(user) {
  const accounts = user?.linked_accounts || user?.linkedAccounts || [];
  const emailAccount = accounts.find((account) => account?.type === "email" && account?.address);
  return normalizeIdentity(emailAccount?.address);
}

async function getPrivyClient() {
  if (!privyClientPromise) {
    privyClientPromise = (async () => {
      const appId = process.env.PRIVY_APP_ID;
      const appSecret = process.env.PRIVY_APP_SECRET;
      if (!appId || !appSecret) {
        throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET are required for authenticated API routes");
      }

      const { PrivyClient } = await import("@privy-io/node");
      const options = { appId, appSecret };
      if (process.env.PRIVY_JWT_VERIFICATION_KEY) {
        options.jwtVerificationKey = process.env.PRIVY_JWT_VERIFICATION_KEY;
      }
      return new PrivyClient(options);
    })();
  }
  return privyClientPromise;
}

function getTestIdentity(req) {
  if (process.env.NODE_ENV !== "test" || process.env.TEST_AUTH_BYPASS !== "true") return null;
  const email = normalizeIdentity(req.headers["x-test-user-email"]);
  if (!email) return null;
  return {
    userId: `did:privy:test:${email}`,
    email,
    accountKey: email,
  };
}

async function resolveIdentity(req) {
  const testIdentity = getTestIdentity(req);
  if (testIdentity) return testIdentity;

  const accessToken = getBearerToken(req);
  const identityToken = String(req.headers["x-privy-identity-token"] || "").trim();
  if (!accessToken || !identityToken) return null;

  const privy = await getPrivyClient();
  const [claims, user] = await Promise.all([
    privy.utils().auth().verifyAccessToken(accessToken),
    privy.utils().auth().verifyIdentityToken(identityToken),
  ]);

  const claimUserId = getClaimUserId(claims);
  const userId = user?.id || "";
  if (!claimUserId || !userId || claimUserId !== userId) {
    throw new Error("Privy token identities do not match");
  }

  const email = getVerifiedEmail(user);
  return {
    userId,
    email,
    accountKey: email || normalizeIdentity(userId),
  };
}

async function optionalAuth(req, res, next) {
  try {
    req.auth = await resolveIdentity(req);
    next();
  } catch (_error) {
    res.status(401).json({ error: "Invalid or expired authentication token" });
  }
}

async function requireAuth(req, res, next) {
  try {
    req.auth = await resolveIdentity(req);
    if (!req.auth) {
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  } catch (_error) {
    res.status(401).json({ error: "Invalid or expired authentication token" });
  }
}

function getAdminEmails() {
  return new Set(
    String(process.env.ADMIN_EMAILS || "")
      .split(",")
      .map(normalizeIdentity)
      .filter(Boolean)
  );
}

function isAdminIdentity(auth) {
  return Boolean(auth?.email && getAdminEmails().has(auth.email));
}

function requireAdmin(req, res, next) {
  if (!req.auth || !isAdminIdentity(req.auth)) {
    return res.status(403).json({ error: "Administrator access required" });
  }
  next();
}

module.exports = {
  isAdminIdentity,
  normalizeIdentity,
  optionalAuth,
  requireAdmin,
  requireAuth,
};
