const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;

const legacyAccountKeys = (user) => {
  const values = [user?.email?.address, user?.email, user?.id];
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))];
};

export const collectLegacyEntitlementReceipts = ({ storage, user, unlockedArticles = {} }) => {
  if (!storage || !user) return [];
  const receipts = [];
  const seenHashes = new Set();

  for (const accountKey of legacyAccountKeys(user)) {
    let stored;
    try {
      stored = JSON.parse(storage.getItem(`papercut_unlocked_articles_${accountKey}`) || '{}');
    } catch (_error) {
      continue;
    }

    for (const [articleId, value] of Object.entries(stored || {})) {
      if (unlockedArticles[articleId]) continue;
      const txHash = typeof value === 'string' ? value : value?.txHash;
      if (!TX_HASH_PATTERN.test(String(txHash || '')) || seenHashes.has(txHash.toLowerCase())) continue;
      seenHashes.add(txHash.toLowerCase());
      receipts.push({ articleId, txHash });
    }
  }

  return receipts.slice(0, 25);
};
