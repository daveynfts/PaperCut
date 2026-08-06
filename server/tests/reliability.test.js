"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { _test: authTest } = require("../auth");
const { createRetryableInitializer } = require("../retryable-initializer");

test("a failed startup attempt can recover on the next request", async () => {
  let attempts = 0;
  const initialize = createRetryableInitializer(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary dependency failure");
    return "ready";
  });

  await assert.rejects(initialize(), /temporary dependency failure/);
  assert.equal(await initialize(), "ready");
  assert.equal(await initialize(), "ready");
  assert.equal(attempts, 2);
});

test("an expired optional identity token falls back to the verified access-token user", async () => {
  const user = { id: "did:privy:user-123", linked_accounts: [] };
  let lookups = 0;
  const privy = {
    utils: () => ({
      auth: () => ({
        verifyIdentityToken: async () => { throw new Error("expired"); },
      }),
    }),
    users: () => ({
      _get: async (userId) => {
        lookups += 1;
        assert.equal(userId, user.id);
        return user;
      },
    }),
  };

  assert.equal(await authTest.resolvePrivyUser(privy, user.id, "expired-token"), user);
  assert.equal(lookups, 1);
});
