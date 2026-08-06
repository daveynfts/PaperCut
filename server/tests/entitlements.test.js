"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  findEntitlementByTxHash,
  operationBelongsToUser,
  verifyLegacyCircleTransaction,
} = require("../entitlements");

const txHash = `0x${"ab".repeat(32)}`;
const user = {
  walletId: "wallet-1",
  address: "0x1111111111111111111111111111111111111111",
};
const auth = { accountKey: "reader@example.com", userId: "did:privy:reader" };
const article = { id: "0", price: "0.05" };
const publisherWalletAddress = "0x2222222222222222222222222222222222222222";
const validTransaction = {
  txHash,
  state: "COMPLETE",
  blockchain: "ARC-TESTNET",
  operation: "TRANSFER",
  walletId: user.walletId,
  sourceAddress: user.address,
  destinationAddress: publisherWalletAddress,
  amounts: ["0.05000000"],
};

test("stored payment operations can be matched across stable user identifiers", () => {
  assert.equal(operationBelongsToUser({ accountKey: auth.accountKey }, auth, user), true);
  assert.equal(operationBelongsToUser({ userId: auth.userId }, auth, user), true);
  assert.equal(operationBelongsToUser({ userWalletId: user.walletId }, auth, user), true);
  assert.equal(operationBelongsToUser({ accountKey: "other@example.com" }, auth, user), false);
});

test("legacy Circle receipts require matching chain, wallet, destination, amount, and completion", () => {
  assert.deepEqual(verifyLegacyCircleTransaction({
    transaction: validTransaction,
    txHash,
    user,
    article,
    publisherWalletAddress,
  }), { ok: true, txHash });

  for (const transaction of [
    { ...validTransaction, state: "PENDING" },
    { ...validTransaction, walletId: "other", sourceAddress: "0x3333333333333333333333333333333333333333" },
    { ...validTransaction, destinationAddress: "0x3333333333333333333333333333333333333333" },
    { ...validTransaction, amounts: ["0.04"] },
  ]) {
    assert.equal(verifyLegacyCircleTransaction({
      transaction,
      txHash,
      user,
      article,
      publisherWalletAddress,
    }).ok, false);
  }
});

test("a transaction hash can be detected when already used by an entitlement", () => {
  assert.deepEqual(findEntitlementByTxHash({
    "reader@example.com": { unlockedArticles: { "0": { txHash } } },
  }, txHash), { accountKey: "reader@example.com", articleId: "0" });
});
