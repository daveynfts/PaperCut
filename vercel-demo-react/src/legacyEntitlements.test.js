import assert from 'node:assert/strict';
import test from 'node:test';

import { collectLegacyEntitlementReceipts } from './legacyEntitlements.js';

const firstHash = `0x${'ab'.repeat(32)}`;
const secondHash = `0x${'cd'.repeat(32)}`;

const storageWith = (entries) => ({
  getItem(key) {
    return entries[key] ?? null;
  },
});

test('collects valid legacy receipts for the signed-in email and Privy identity', () => {
  const storage = storageWith({
    'papercut_unlocked_articles_reader@example.com': JSON.stringify({
      0: { txHash: firstHash },
      1: { txHash: 'not-a-transaction-hash' },
    }),
    'papercut_unlocked_articles_did:privy:reader': JSON.stringify({
      2: secondHash,
      3: { txHash: firstHash },
    }),
  });

  assert.deepEqual(collectLegacyEntitlementReceipts({
    storage,
    user: { id: 'did:privy:reader', email: { address: 'reader@example.com' } },
    unlockedArticles: { 2: { txHash: secondHash } },
  }), [{ articleId: '0', txHash: firstHash }]);
});

test('ignores malformed legacy browser data', () => {
  assert.deepEqual(collectLegacyEntitlementReceipts({
    storage: storageWith({ 'papercut_unlocked_articles_reader@example.com': '{broken' }),
    user: { email: { address: 'reader@example.com' } },
  }), []);
});
