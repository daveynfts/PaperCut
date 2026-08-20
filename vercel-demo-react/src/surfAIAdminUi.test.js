import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const appSource = fs.readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');

test('admin SurfAI desk manages a durable report series', () => {
  assert.match(appSource, /\/api\/admin\/surfai\/reports/);
  assert.match(appSource, /handleSurfAIAdminSubmit/);
  assert.match(appSource, /handleCreateSurfAIReport/);
  assert.match(appSource, /handleToggleSurfAIListing/);
  assert.match(appSource, /ADD NEW REPORT/);
  assert.match(appSource, /ARCHIVE/);
  assert.match(appSource, /RELIST/);
  assert.match(appSource, /Protected PDF · URL or R2 asset/);
  assert.match(appSource, /Protected video · URL or R2 asset/);
  assert.match(appSource, /\/api\/admin\/uploads\/presign/);
  assert.match(appSource, /UPLOAD PDF TO R2/);
  assert.match(appSource, /UPLOAD VIDEO TO R2/);
  assert.match(appSource, /handleSurfAIAssetUpload/);
  assert.match(appSource, /Paid report content · Markdown/);
});

test('reader SurfAI metadata is loaded from the public metadata-only endpoint', () => {
  assert.match(appSource, /\/api\/surfai/);
  assert.match(appSource, /setSurfAIArticle/);
  assert.match(appSource, /return surfAIArticle/);
  assert.match(appSource, /isSurfAIArticle/);
});
