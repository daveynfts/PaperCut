import assert from 'node:assert/strict';
import test from 'node:test';

import {
  initialReaderLifecycle,
  pendingPaymentOperations,
  readerLifecycleReducer,
  WALLET_PHASE,
} from './readerLifecycle.js';

test('wallet remains usable in degraded balance mode', () => {
  const state = readerLifecycleReducer(initialReaderLifecycle, {
    type: 'WALLET_READY',
    degraded: true,
    message: 'Balance refresh unavailable',
  });
  assert.equal(state.walletPhase, WALLET_PHASE.DEGRADED);
  assert.equal(state.walletMessage, 'Balance refresh unavailable');
});

test('pending payment is retained until the server confirms it', () => {
  let state = readerLifecycleReducer(initialReaderLifecycle, {
    type: 'PAYMENT_UPDATE',
    operation: { transactionId: 'tx-1', status: 'PENDING' },
  });
  assert.equal(pendingPaymentOperations(state).length, 1);

  state = readerLifecycleReducer(state, {
    type: 'PAYMENT_UPDATE',
    operation: { transactionId: 'tx-1', status: 'COMPLETE' },
  });
  assert.equal(pendingPaymentOperations(state).length, 0);
  assert.equal(state.operations['tx-1'].pending, false);
});
