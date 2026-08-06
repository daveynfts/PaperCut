"use strict";

const { parseExternalUsdcBalance, parseUsdc } = require("./money");

function normalizeAddress(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeTxHash(value) {
  const hash = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^0x[a-f0-9]{64}$/.test(hash) ? hash : "";
}

function operationBelongsToUser(operation, auth, user) {
  if (!operation || !auth || !user) return false;
  return Boolean(operation.accountKey === auth.accountKey ||
    operation.userId === auth.userId ||
    (operation.userWalletId && operation.userWalletId === user.walletId));
}

function entitlementTxHash(value) {
  if (typeof value === "string") return normalizeTxHash(value);
  return normalizeTxHash(value?.txHash);
}

function findEntitlementByTxHash(users, txHash) {
  const normalizedHash = normalizeTxHash(txHash);
  if (!normalizedHash) return null;
  for (const [accountKey, user] of Object.entries(users || {})) {
    for (const [articleId, entitlement] of Object.entries(user?.unlockedArticles || {})) {
      if (entitlementTxHash(entitlement) === normalizedHash) return { accountKey, articleId };
    }
  }
  return null;
}

function verifyLegacyCircleTransaction({ transaction, txHash, user, article, publisherWalletAddress }) {
  const expectedHash = normalizeTxHash(txHash);
  if (!expectedHash || normalizeTxHash(transaction?.txHash) !== expectedHash) {
    return { ok: false, reason: "Transaction hash was not confirmed by Circle" };
  }
  if (transaction.state !== "COMPLETE") {
    return { ok: false, reason: "Transaction is not complete" };
  }
  if (transaction.blockchain && transaction.blockchain !== "ARC-TESTNET") {
    return { ok: false, reason: "Transaction is not on Arc Testnet" };
  }
  if (transaction.operation && transaction.operation !== "TRANSFER") {
    return { ok: false, reason: "Transaction is not a transfer" };
  }

  const walletMatches = transaction.walletId === user?.walletId ||
    normalizeAddress(transaction.sourceAddress) === normalizeAddress(user?.address);
  if (!walletMatches) return { ok: false, reason: "Transaction source does not match this wallet" };

  if (normalizeAddress(transaction.destinationAddress) !== normalizeAddress(publisherWalletAddress)) {
    return { ok: false, reason: "Transaction destination does not match the PaperCut publisher wallet" };
  }

  const expectedAmount = parseUsdc(article?.price, { max: null });
  const amountMatches = (transaction.amounts || []).some((amount) => {
    try {
      return parseExternalUsdcBalance(amount) === expectedAmount;
    } catch (_error) {
      return false;
    }
  });
  if (!amountMatches) return { ok: false, reason: "Transaction amount does not match the article price" };

  return { ok: true, txHash: expectedHash };
}

module.exports = {
  entitlementTxHash,
  findEntitlementByTxHash,
  normalizeTxHash,
  operationBelongsToUser,
  verifyLegacyCircleTransaction,
};
