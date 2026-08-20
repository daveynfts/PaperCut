"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, test } = require("node:test");
const request = require("supertest");

const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "papercut-test-"));
process.env.NODE_ENV = "test";
process.env.TEST_AUTH_BYPASS = "true";
process.env.PAYMENT_MODE = "mock";
process.env.PAPERCUT_DATA_DIR = dataDirectory;
process.env.ADMIN_EMAILS = "admin@example.com";
process.env.SURFAI_VIDEO_URL = "https://media.example.test/protected-surfai.mp4";
process.env.R2_ACCOUNT_ID = "test-account";
process.env.R2_ACCESS_KEY_ID = "test-access-key";
process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
process.env.R2_BUCKET = "papercut-test";
process.env.R2_PREFIX = "PaperCut";

const app = require("../server");
const asUser = (email) => ({ "x-test-user-email": email });

after(() => {
  const resolved = path.resolve(dataDirectory);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.match(path.basename(resolved), /^papercut-test-/);
  fs.rmSync(resolved, { recursive: true, force: true });
});

test("health endpoint reports the explicit mock payment mode", async () => {
  const response = await request(app).get("/api/health").expect(200);
  assert.equal(response.body.paymentMode, "mock");
});

test("article content cannot be bypassed with an author query", async () => {
  const response = await request(app).get("/api/articles/0?author=Hayden%20Adams").expect(402);
  assert.equal(response.body.error, "Payment Required");
  assert.equal(response.body.content, undefined);

  const special = await request(app).get("/api/articles/surfai-daily").expect(402);
  assert.equal(special.body.content, undefined);
  assert.equal(special.body.pdfUrl, undefined);
  assert.equal(special.body.videoUrl, undefined);
});

test("protected payment and admin routes reject missing or insufficient identity", async () => {
  await request(app).get("/api/admin/surfai").expect(401);

  await request(app)
    .put("/api/admin/surfai")
    .set(asUser("reader@example.com"))
    .send({
      title: "Unauthorized SurfAI update",
      snippet: "This update must never reach the protected settings store.",
      content: "## Unauthorized",
      price: "0.15",
      pdfUrl: "",
      videoUrl: "",
    })
    .expect(403);

  await request(app)
    .post("/api/user/entitlements/reconcile")
    .send({ receipts: [] })
    .expect(401);

  await request(app)
    .post("/api/user/withdraw")
    .send({ destinationAddress: "0x1111111111111111111111111111111111111111", amount: "1" })
    .expect(401);

  await request(app)
    .put("/api/publishers/verify")
    .set(asUser("hayden@uniswap.org"))
    .send({ email: "vitalik@ethereum.org", verified: false })
    .expect(403);

  await request(app).post("/api/admin/uploads/presign").send({}).expect(401);
  await request(app).post("/api/admin/uploads/presign").set(asUser("reader@example.com")).send({
    assetType: "pdf",
    fileName: "report.pdf",
    contentType: "application/pdf",
    size: 1024,
  }).expect(403);
});

test("admin can create constrained direct-upload URLs for private R2 assets", async () => {
  const admin = asUser("admin@example.com");
  const config = await request(app).get("/api/admin/uploads/config").set(admin).expect(200);
  assert.equal(config.body.r2.configured, true);
  assert.equal(config.body.r2.bucket, "papercut-test");
  assert.equal(config.body.r2.prefix, "PaperCut");

  await request(app).post("/api/admin/uploads/presign").set(admin).send({
    assetType: "pdf",
    fileName: "not-a-pdf.mp4",
    contentType: "video/mp4",
    size: 1024,
  }).expect(400);

  const response = await request(app).post("/api/admin/uploads/presign").set(admin).send({
    assetType: "pdf",
    fileName: "SurfAI Report 2026.pdf",
    contentType: "application/pdf",
    size: 1024 * 1024,
  }).expect(200);
  assert.match(response.body.assetRef, /^r2:\/\/PaperCut\/surfai\/pdf\/\d{4}\/\d{2}\/\d{2}\/[a-f0-9-]+-SurfAI-Report-2026\.pdf$/);
  assert.match(response.body.uploadUrl, /^https:\/\//);
  const uploadUrl = new URL(response.body.uploadUrl);
  assert.equal(uploadUrl.hostname, "test-account.r2.cloudflarestorage.com");
  assert.match(uploadUrl.pathname, /^\/papercut-test\/PaperCut\/surfai\/pdf\//);
  assert.equal(response.body.uploadHeaders["Content-Type"], "application/pdf");
  assert.ok(uploadUrl.searchParams.has("X-Amz-Signature"));
  assert.ok(new URL(response.body.previewUrl).searchParams.has("X-Amz-Signature"));
  assert.doesNotMatch(JSON.stringify(response.body), /test-secret-key/);
});

test("admin can update SurfAI content and protected media without leaking it publicly", async () => {
  const admin = asUser("admin@example.com");
  const originalResponse = await request(app).get("/api/admin/surfai").set(admin).expect(200);
  const original = originalResponse.body.surfai;
  const update = {
    title: "SurfAI Weekly Capital Signal",
    snippet: "A public preview of this week's highest-conviction capital and compute signals.",
    content: "## Protected weekly signal\n\nOnly entitled readers can access this analysis.",
    price: "0.25",
    pdfUrl: "https://media.example.test/surfai-weekly.pdf",
    videoUrl: "https://media.example.test/surfai-weekly.mp4",
  };

  const saved = await request(app).put("/api/admin/surfai").set(admin).send(update).expect(200);
  assert.equal(saved.body.surfai.title, update.title);
  assert.equal(saved.body.surfai.content, update.content);
  assert.equal(saved.body.surfai.pdfUrl, update.pdfUrl);
  assert.equal(saved.body.surfai.videoUrl, update.videoUrl);
  assert.equal(saved.body.surfai.updatedBy, "admin@example.com");

  const publicMetadata = await request(app).get("/api/surfai").expect(200);
  assert.equal(publicMetadata.body.title, update.title);
  assert.equal(publicMetadata.body.price, update.price);
  assert.equal(publicMetadata.body.content, undefined);
  assert.equal(publicMetadata.body.pdfUrl, undefined);
  assert.equal(publicMetadata.body.videoUrl, undefined);

  const protectedArticle = await request(app).get("/api/articles/surfai-daily").expect(402);
  assert.equal(protectedArticle.body.content, undefined);
  assert.equal(protectedArticle.body.pdfUrl, undefined);
  assert.equal(protectedArticle.body.videoUrl, undefined);

  await request(app).put("/api/admin/surfai").set(admin).send({
    title: original.title,
    snippet: original.snippet,
    content: original.content,
    price: original.price,
    pdfUrl: original.pdfUrl || "",
    videoUrl: original.videoUrl || "",
  }).expect(200);
});

test("SurfAI admin rejects insecure media URLs", async () => {
  const admin = asUser("admin@example.com");
  const current = (await request(app).get("/api/admin/surfai").set(admin).expect(200)).body.surfai;
  const response = await request(app).put("/api/admin/surfai").set(admin).send({
    title: current.title,
    snippet: current.snippet,
    content: current.content,
    price: current.price,
    pdfUrl: "http://media.example.test/insecure.pdf",
    videoUrl: current.videoUrl || "",
  }).expect(400);
  assert.match(JSON.stringify(response.body.details), /HTTPS/);
});

test("SurfAI accepts prefixed R2 assets while preserving legacy R2 references", async () => {
  const admin = asUser("admin@example.com");
  const current = (await request(app).get("/api/admin/surfai").set(admin).expect(200)).body.surfai;
  const update = {
    title: current.title,
    snippet: current.snippet,
    content: current.content,
    price: current.price,
    pdfUrl: "r2://surfai/pdf/2026/08/20/legacy-report.pdf",
    videoUrl: "r2://PaperCut/surfai/video/2026/08/20/new-briefing.mp4",
  };

  const saved = await request(app).put("/api/admin/surfai").set(admin).send(update).expect(200);
  assert.equal(saved.body.surfai.pdfUrl, update.pdfUrl);
  assert.equal(saved.body.surfai.videoUrl, update.videoUrl);

  await request(app).put("/api/admin/surfai").set(admin).send({
    ...update,
    pdfUrl: "r2://PaperCut/surfai/video/2026/08/20/wrong-kind.mp4",
  }).expect(400);

  await request(app).put("/api/admin/surfai").set(admin).send({
    title: current.title,
    snippet: current.snippet,
    content: current.content,
    price: current.price,
    pdfUrl: current.pdfUrl || "",
    videoUrl: current.videoUrl || "",
  }).expect(200);
});

test("publisher identity, article ownership, and prices are server controlled", async () => {
  await request(app)
    .post("/api/articles")
    .set(asUser("hayden@uniswap.org"))
    .send({ title: "Invalid price", content: "This content is long enough.", price: "-0.01", author: "Vitalik Buterin" })
    .expect(400);

  await request(app)
    .post("/api/articles")
    .set(asUser("reader@example.com"))
    .send({ title: "Unauthorized", content: "This should never be published.", price: "0.01" })
    .expect(403);
});

test("publisher applications cannot choose another user's email", async () => {
  await request(app)
    .post("/api/publishers")
    .set(asUser("applicant@example.com"))
    .send({
      email: "victim@example.com",
      name: "Applicant",
      domain: "example.com",
      walletAddress: "0x2222222222222222222222222222222222222222",
      category: "General",
    })
    .expect(201);

  const registry = await request(app).get("/api/publishers").set(asUser("admin@example.com")).expect(200);
  assert.ok(registry.body["applicant@example.com"]);
  assert.equal(registry.body["victim@example.com"], undefined);
});

test("mock payment grants content only after a completed operation", async () => {
  const reader = asUser("paying-reader@example.com");
  await request(app).post("/api/user/wallet").set(reader).send({ email: "spoof@example.com" }).expect(200);

  const faucet = await request(app).post("/api/user/faucet").set(reader).send({}).expect(200);
  assert.equal(faucet.body.status, "COMPLETE");
  assert.equal(faucet.body.amount, "1.00");
  assert.equal(faucet.body.balance, "1.00");

  const unlock = await request(app).post("/api/articles/unlock").set(reader).send({ articleId: "0" }).expect(200);
  assert.equal(unlock.body.status, "COMPLETE");
  assert.equal(unlock.body.balance, "0.95");

  const article = await request(app).get("/api/articles/0").set(reader).expect(200);
  assert.equal(article.body.success, true);
  assert.ok(article.body.content.length > 50);

  const surfUnlock = await request(app).post("/api/articles/unlock").set(reader).send({ articleId: "surfai-daily" }).expect(200);
  assert.equal(surfUnlock.body.status, "COMPLETE");
  assert.equal(surfUnlock.body.balance, "0.80");

  const surfArticle = await request(app).get("/api/articles/surfai-daily").set(reader).expect(200);
  assert.equal(surfArticle.body.videoUrl, process.env.SURFAI_VIDEO_URL);

  const wallet = await request(app).post("/api/user/wallet").set(reader).send({}).expect(200);
  assert.ok(wallet.body.unlockedArticles["0"]);
  assert.ok(wallet.body.unlockedArticles["surfai-daily"]);

  await request(app).get("/api/articles/0").set(asUser("other-reader@example.com")).expect(402);
  const otherSurfArticle = await request(app).get("/api/articles/surfai-daily").set(asUser("other-reader@example.com")).expect(402);
  assert.equal(otherSurfArticle.body.videoUrl, undefined);
});

test("personal library returns purchased dispatch metadata without protected content", async () => {
  const reader = asUser("library-reader@example.com");
  const initialWallet = await request(app).post("/api/user/wallet").set(reader).send({}).expect(200);
  assert.equal(initialWallet.body.walletStatus, "READY");
  assert.deepEqual(initialWallet.body.pendingOperations, []);

  const emptyLibrary = await request(app).get("/api/user/library").set(reader).expect(200);
  assert.equal(emptyLibrary.body.summary.totalItems, 0);
  assert.deepEqual(emptyLibrary.body.items, []);

  await request(app).post("/api/user/faucet").set(reader).send({}).expect(200);
  await request(app).post("/api/articles/unlock").set(reader).send({ articleId: "1" }).expect(200);

  const response = await request(app).get("/api/user/library").set(reader).expect(200);
  assert.equal(response.body.summary.totalItems, 1);
  assert.equal(response.body.summary.totalSpent, "0.08");
  assert.equal(response.body.items[0].articleId, "1");
  assert.equal(response.body.items[0].title, "The Promise and Challenges of Crypto-Pluralism");
  assert.equal(response.body.items[0].status, "UNLOCKED");
  assert.match(response.body.items[0].txHash, /^0x[a-f0-9]{64}$/);
  assert.equal(response.body.items[0].content, undefined);
  assert.deepEqual(response.body.pending, []);
});

test("SurfAI report series preserves old purchases and supports archive, update, and relist", async () => {
  const admin = asUser("admin@example.com");
  const legacyBuyer = asUser("paying-reader@example.com");
  const initialList = await request(app).get("/api/admin/surfai/reports").set(admin).expect(200);
  const legacy = initialList.body.reports.find((report) => report.id === "surfai-daily");
  assert.ok(legacy);
  assert.equal(legacy.purchaseCount, 1);

  const create = await request(app).post("/api/admin/surfai/reports").set(admin).send({
    title: "SurfAI Capital Signal 002",
    snippet: "A new report in the SurfAI series with a permanent independent entitlement.",
    content: "## Signal 002\n\nProtected intelligence for buyers of the second report.",
    price: "0.22",
    pdfUrl: "https://media.example.test/surfai-002.pdf",
    videoUrl: "https://media.example.test/surfai-002.mp4",
    replaceCurrent: true,
  }).expect(201);
  const newReport = create.body.surfai;
  assert.match(newReport.id, /^surfai-\d{8}-[a-f0-9-]+$/);
  assert.notEqual(newReport.id, legacy.id);

  const publicCurrent = await request(app).get("/api/surfai").expect(200);
  assert.equal(publicCurrent.body.id, newReport.id);
  assert.equal(publicCurrent.body.content, undefined);
  const publicReports = await request(app).get("/api/surfai/reports").expect(200);
  assert.deepEqual(publicReports.body.reports.map((report) => report.id), [newReport.id]);
  assert.equal(publicReports.body.reports[0].videoUrl, undefined);

  const archivedLegacy = (await request(app).get("/api/admin/surfai/reports").set(admin).expect(200))
    .body.reports.find((report) => report.id === legacy.id);
  assert.equal(archivedLegacy.listed, false);

  const oldPurchase = await request(app).get(`/api/articles/${legacy.id}`).set(legacyBuyer).expect(200);
  assert.equal(oldPurchase.body.success, true);
  const nonBuyer = asUser("archived-report-nonbuyer@example.com");
  await request(app).post("/api/user/wallet").set(nonBuyer).send({}).expect(200);
  const blockedPurchase = await request(app).post("/api/articles/unlock").set(nonBuyer).send({ articleId: legacy.id }).expect(409);
  assert.match(blockedPurchase.body.error, /archived/i);

  const updatedLegacyContent = "## Updated archive\n\nExisting buyers receive the corrected report content.";
  await request(app).put(`/api/admin/surfai/reports/${legacy.id}`).set(admin).send({
    title: legacy.title,
    snippet: legacy.snippet,
    content: updatedLegacyContent,
    price: legacy.price,
    pdfUrl: legacy.pdfUrl || "",
    videoUrl: legacy.videoUrl || "",
    listed: false,
  }).expect(200);
  const updatedPurchase = await request(app).get(`/api/articles/${legacy.id}`).set(legacyBuyer).expect(200);
  assert.equal(updatedPurchase.body.content, updatedLegacyContent);

  await request(app).put(`/api/admin/surfai/reports/${legacy.id}`).set(admin).send({
    title: legacy.title,
    snippet: legacy.snippet,
    content: legacy.content,
    price: legacy.price,
    pdfUrl: legacy.pdfUrl || "",
    videoUrl: legacy.videoUrl || "",
    listed: true,
  }).expect(200);
  await request(app).put(`/api/admin/surfai/reports/${newReport.id}`).set(admin).send({
    title: newReport.title,
    snippet: newReport.snippet,
    content: newReport.content,
    price: newReport.price,
    pdfUrl: newReport.pdfUrl || "",
    videoUrl: newReport.videoUrl || "",
    listed: false,
  }).expect(200);
  const restoredCurrent = await request(app).get("/api/surfai").expect(200);
  assert.equal(restoredCurrent.body.id, legacy.id);
});

test("R2 references stay private and become short-lived links only for entitled readers", async () => {
  const admin = asUser("admin@example.com");
  const buyer = asUser("paying-reader@example.com");
  const original = (await request(app).get("/api/admin/surfai/reports").set(admin).expect(200))
    .body.reports.find((report) => report.id === "surfai-daily");
  const pdfUpload = (await request(app).post("/api/admin/uploads/presign").set(admin).send({
    assetType: "pdf",
    fileName: "private-report.pdf",
    contentType: "application/pdf",
    size: 4096,
  }).expect(200)).body;
  const videoUpload = (await request(app).post("/api/admin/uploads/presign").set(admin).send({
    assetType: "video",
    fileName: "private-briefing.mp4",
    contentType: "video/mp4",
    size: 8192,
  }).expect(200)).body;

  await request(app).put("/api/admin/surfai/reports/surfai-daily").set(admin).send({
    title: original.title,
    snippet: original.snippet,
    content: original.content,
    price: original.price,
    pdfUrl: pdfUpload.assetRef,
    videoUrl: videoUpload.assetRef,
    listed: true,
  }).expect(200);

  const publicMetadata = await request(app).get("/api/surfai").expect(200);
  assert.equal(publicMetadata.body.pdfUrl, undefined);
  assert.equal(publicMetadata.body.videoUrl, undefined);
  assert.doesNotMatch(JSON.stringify(publicMetadata.body), /r2:\/\//);

  const protectedArticle = await request(app).get("/api/articles/surfai-daily").set(buyer).expect(200);
  assert.match(protectedArticle.body.pdfUrl, /^https:\/\//);
  assert.match(protectedArticle.body.videoUrl, /^https:\/\//);
  assert.ok(new URL(protectedArticle.body.pdfUrl).searchParams.has("X-Amz-Signature"));
  assert.ok(new URL(protectedArticle.body.videoUrl).searchParams.has("X-Amz-Signature"));
  assert.doesNotMatch(JSON.stringify(protectedArticle.body), /r2:\/\//);

  const adminList = await request(app).get("/api/admin/surfai/reports").set(admin).expect(200);
  const configured = adminList.body.reports.find((report) => report.id === "surfai-daily");
  assert.equal(configured.pdfUrl, pdfUpload.assetRef);
  assert.ok(new URL(configured.pdfPreviewUrl).searchParams.has("X-Amz-Signature"));

  await request(app).put("/api/admin/surfai/reports/surfai-daily").set(admin).send({
    title: original.title,
    snippet: original.snippet,
    content: original.content,
    price: original.price,
    pdfUrl: original.pdfUrl || "",
    videoUrl: original.videoUrl || "",
    listed: true,
  }).expect(200);
});

test("concurrent wallet initialization returns one stable wallet", async () => {
  const reader = asUser("concurrent-reader@example.com");
  const responses = await Promise.all(
    Array.from({ length: 12 }, () => request(app).post("/api/user/wallet").set(reader).send({}))
  );

  for (const response of responses) assert.equal(response.status, 200);
  assert.equal(new Set(responses.map((response) => response.body.address)).size, 1);
  assert.equal(new Set(responses.map((response) => response.body.walletId)).size, 1);
});
