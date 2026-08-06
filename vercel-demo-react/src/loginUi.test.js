import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const appSource = fs.readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
const providerSource = fs.readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');

test('sign-in buttons always open the app-owned Privy email dialog', () => {
  assert.doesNotMatch(appSource, /onClick=\{login\}/);
  assert.match(appSource, /const openLogin = useCallback/);
  assert.match(appSource, /setShowSignInModal\(true\)/);
  assert.match(appSource, /sendEmailCode\(\{ email \}\)/);
  assert.match(appSource, /loginWithEmailCode\(\{ code \}\)/);
  assert.match(appSource, /showSignInModal && !authenticated/);
  assert.doesNotMatch(appSource, /INITIALIZING PRIVY/);
});

test('email authentication does not wait for unused wallet connectors', () => {
  assert.match(providerSource, /loginMethods: \['email'\]/);
  assert.match(providerSource, /disableAllExternalWallets: true/);
  assert.match(providerSource, /walletConnect: \{ enabled: false \}/);
  assert.match(providerSource, /ethereum: \{ createOnLogin: 'off' \}/);
});
