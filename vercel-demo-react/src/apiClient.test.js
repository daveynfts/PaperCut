import assert from 'node:assert/strict';
import test from 'node:test';

import { canRetryRequest, resilientAuthFetch } from './apiClient.js';

const noSleep = async () => {};

test('retries safe requests after network and transient HTTP failures', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError('temporary network failure');
    if (calls === 2) return new Response('busy', { status: 503 });
    return new Response('{"ok":true}', { status: 200 });
  };

  const response = await resilientAuthFetch('/api/articles', {}, {
    fetchImpl,
    retryDelays: [0, 0],
    sleep: noSleep,
  });

  assert.equal(response.status, 200);
  assert.equal(calls, 3);
});

test('does not replay a state-changing request after a transient failure', async () => {
  let calls = 0;
  const response = await resilientAuthFetch('/api/articles/unlock', { method: 'POST' }, {
    fetchImpl: async () => {
      calls += 1;
      return new Response('busy', { status: 503 });
    },
    retryDelays: [0, 0],
    sleep: noSleep,
  });

  assert.equal(canRetryRequest('/api/articles/unlock', { method: 'POST' }), false);
  assert.equal(response.status, 503);
  assert.equal(calls, 1);
});

test('recovers once from a stale identity token without replaying an accepted request', async () => {
  const seenHeaders = [];
  const response = await resilientAuthFetch('/api/user/wallet', { method: 'POST' }, {
    authenticated: true,
    identityToken: 'stale-identity-token',
    getAccessToken: async () => 'valid-access-token',
    fetchImpl: async (_url, options) => {
      seenHeaders.push(options.headers);
      return new Response('{}', { status: seenHeaders.length === 1 ? 401 : 200 });
    },
    retryDelays: [0, 0],
    sleep: noSleep,
  });

  assert.equal(response.status, 200);
  assert.equal(seenHeaders.length, 2);
  assert.equal(seenHeaders[0].get('X-Privy-Identity-Token'), 'stale-identity-token');
  assert.equal(seenHeaders[1].get('X-Privy-Identity-Token'), null);
  assert.equal(seenHeaders[1].get('Authorization'), 'Bearer valid-access-token');
});
