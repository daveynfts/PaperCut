"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { formatUsdc, parseExternalUsdcBalance, parseUsdc } = require("../money");

test("Circle balances with extra decimal precision are safely normalized", () => {
  assert.equal(formatUsdc(parseExternalUsdcBalance("0.000000000000000000")), "0.00");
  assert.equal(formatUsdc(parseExternalUsdcBalance("6.62607015")), "6.62607");
  assert.equal(formatUsdc(parseExternalUsdcBalance("1.23456789")), "1.234567");
  assert.equal(formatUsdc(parseExternalUsdcBalance("0.0000009")), "0.00");
});

test("external balance normalization rejects malformed values", () => {
  assert.throws(() => parseExternalUsdcBalance("-1"), /invalid USDC balance/);
  assert.throws(() => parseExternalUsdcBalance("1e-7"), /invalid USDC balance/);
});

test("user-entered USDC amounts remain limited to six decimal places", () => {
  assert.throws(() => parseUsdc("1.2345678"), /at most 6 places/);
});
