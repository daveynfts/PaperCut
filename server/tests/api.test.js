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
});

test("protected payment and admin routes reject missing or insufficient identity", async () => {
  await request(app)
    .post("/api/user/withdraw")
    .send({ destinationAddress: "0x1111111111111111111111111111111111111111", amount: "1" })
    .expect(401);

  await request(app)
    .put("/api/publishers/verify")
    .set(asUser("hayden@uniswap.org"))
    .send({ email: "vitalik@ethereum.org", verified: false })
    .expect(403);
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

  const wallet = await request(app).post("/api/user/wallet").set(reader).send({}).expect(200);
  assert.ok(wallet.body.unlockedArticles["0"]);

  await request(app).get("/api/articles/0").set(asUser("other-reader@example.com")).expect(402);
});
