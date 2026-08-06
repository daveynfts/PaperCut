import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isRecoverablePrivySessionError,
  sendEmailCodeWithSessionRecovery,
} from './privyAuthRecovery.js';

test('recognizes a failed Privy session refresh', () => {
  const error = new Error('[POST] "https://auth.privy.io/api/v1/sessions": <no response> Failed to fetch');
  assert.equal(isRecoverablePrivySessionError(error), true);
  assert.equal(isRecoverablePrivySessionError(new Error('Invalid email address')), false);
});

test('clears a stale session and retries the OTP request once', async () => {
  const calls = [];
  const sendCode = async ({ email }) => {
    calls.push(['send', email]);
    if (calls.length === 1) {
      throw new Error('[POST] "https://auth.privy.io/api/v1/sessions": <no response> Failed to fetch');
    }
  };
  const clearSession = async () => calls.push(['clear']);

  await sendEmailCodeWithSessionRecovery({
    email: 'reader@example.com',
    sendCode,
    clearSession,
  });

  assert.deepEqual(calls, [
    ['send', 'reader@example.com'],
    ['clear'],
    ['send', 'reader@example.com'],
  ]);
});

test('does not clear the session for a validation error', async () => {
  let cleared = false;
  await assert.rejects(
    sendEmailCodeWithSessionRecovery({
      email: 'reader@example.com',
      sendCode: async () => { throw new Error('Invalid email address'); },
      clearSession: async () => { cleared = true; },
    }),
    /Invalid email address/,
  );
  assert.equal(cleared, false);
});
