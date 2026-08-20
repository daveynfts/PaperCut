import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const appSource = fs.readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');

test('admin SurfAI desk loads and saves protected report configuration', () => {
  assert.match(appSource, /\/api\/admin\/surfai/);
  assert.match(appSource, /handleSurfAIAdminSubmit/);
  assert.match(appSource, /Protected PDF URL/);
  assert.match(appSource, /Protected video URL/);
  assert.match(appSource, /Paid report content · Markdown/);
});

test('reader SurfAI metadata is loaded from the public metadata-only endpoint', () => {
  assert.match(appSource, /\/api\/surfai/);
  assert.match(appSource, /setSurfAIArticle/);
  assert.match(appSource, /return surfAIArticle/);
});
