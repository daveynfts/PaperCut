import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const appSource = fs.readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
const providerSource = fs.readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
const vercelConfig = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('sign-in buttons always open the app-owned Privy email dialog', () => {
  assert.doesNotMatch(appSource, /onClick=\{login\}/);
  assert.match(appSource, /const openLogin = useCallback/);
  assert.match(appSource, /setShowSignInModal\(true\)/);
  assert.match(appSource, /sendCode: sendEmailCode/);
  assert.match(appSource, /loginWithEmailCode\(\{ code \}\)/);
  assert.match(appSource, /sendEmailCodeWithSessionRecovery/);
  assert.match(appSource, /showSignInModal && !authenticated/);
  assert.doesNotMatch(appSource, /INITIALIZING PRIVY/);
});

test('email and external-wallet authentication are both available', () => {
  assert.match(providerSource, /loginMethods: \['email', 'wallet'\]/);
  assert.doesNotMatch(providerSource, /disableAllExternalWallets: true/);
  assert.match(providerSource, /ethereum: \{ createOnLogin: 'off' \}/);
  assert.match(appSource, /CONNECT CRYPTO WALLET/);
  assert.match(appSource, /const handleWalletSignIn = async/);
  assert.match(appSource, /searchParams\.set\("walletLogin", "1"\)/);
  assert.match(appSource, /login\(\{ loginMethods: \["wallet"\] \}\)/);
});

test('production Privy traffic uses the same-origin auth proxy', () => {
  assert.match(providerSource, /new URL\('\/papercut\/api\/privy', window\.location\.origin\)/);
  assert.match(providerSource, /apiUrl=\{PRIVY_API_URL\}/);
  assert.deepEqual(vercelConfig.rewrites[0], {
    source: '/papercut/api/privy/:path*',
    destination: 'https://auth.privy.io/:path*',
  });
  assert.deepEqual(vercelConfig.rewrites[1], {
    source: '/api/privy/:path*',
    destination: 'https://auth.privy.io/:path*',
  });
});
