import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const appSource = fs.readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');

test('sign-in buttons use the guarded login handler', () => {
  assert.doesNotMatch(appSource, /onClick=\{login\}/);
  assert.match(appSource, /const openLogin = useCallback/);
  assert.match(appSource, /if \(!ready\)/);
  assert.match(appSource, /if \(authenticated \|\| isLoginModalOpen\) return/);
});
