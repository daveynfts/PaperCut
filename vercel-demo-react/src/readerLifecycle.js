export const WALLET_PHASE = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  DEGRADED: 'degraded',
  ERROR: 'error',
});

export const initialReaderLifecycle = Object.freeze({
  walletPhase: WALLET_PHASE.IDLE,
  walletMessage: '',
  balanceSyncedAt: null,
  operations: {},
});

const normalizeOperation = (operation) => ({
  ...operation,
  pending: ['INITIATED', 'PENDING'].includes(operation?.status),
});

export function readerLifecycleReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return { ...initialReaderLifecycle, operations: {} };
    case 'WALLET_LOADING':
      return { ...state, walletPhase: WALLET_PHASE.LOADING, walletMessage: '' };
    case 'WALLET_READY':
      return {
        ...state,
        walletPhase: action.degraded ? WALLET_PHASE.DEGRADED : WALLET_PHASE.READY,
        walletMessage: action.message || '',
        balanceSyncedAt: action.balanceSyncedAt || state.balanceSyncedAt,
      };
    case 'WALLET_ERROR':
      return { ...state, walletPhase: WALLET_PHASE.ERROR, walletMessage: action.message || 'Wallet unavailable.' };
    case 'HYDRATE_OPERATIONS': {
      const operations = { ...state.operations };
      for (const operation of action.operations || []) {
        if (operation?.transactionId) operations[operation.transactionId] = normalizeOperation(operation);
      }
      return { ...state, operations };
    }
    case 'PAYMENT_UPDATE':
      if (!action.operation?.transactionId) return state;
      return {
        ...state,
        operations: {
          ...state.operations,
          [action.operation.transactionId]: normalizeOperation({
            ...state.operations[action.operation.transactionId],
            ...action.operation,
          }),
        },
      };
    default:
      return state;
  }
}

export const pendingPaymentOperations = (state) => Object.values(state.operations)
  .filter((operation) => operation.pending);
