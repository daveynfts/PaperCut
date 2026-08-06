import assert from 'node:assert/strict';
import test from 'node:test';

import { getBackendBaseUrl } from './runtimeConfig.js';

test('production API calls stay on the mounted PaperCut origin', () => {
  assert.equal(getBackendBaseUrl({
    configuredUrl: 'https://paper-cut-apce.vercel.app',
    location: { origin: 'https://daveynfts.com', hostname: 'daveynfts.com' },
  }), 'https://daveynfts.com/papercut');
});

test('local development respects the configured backend URL', () => {
  assert.equal(getBackendBaseUrl({
    configuredUrl: 'http://localhost:4100/',
    location: { origin: 'http://localhost:5173', hostname: 'localhost' },
  }), 'http://localhost:4100');
});

test('local development has a safe local fallback', () => {
  assert.equal(getBackendBaseUrl({
    location: { origin: 'http://127.0.0.1:5173', hostname: '127.0.0.1' },
  }), 'http://localhost:4000');
});
