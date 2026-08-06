"use strict";

const USDC_DECIMALS = 6;
const USDC_SCALE = 10n ** BigInt(USDC_DECIMALS);

function parseUsdc(value, options = {}) {
  const { allowZero = false, max = "1000000" } = options;
  const raw = typeof value === "number" ? String(value) : String(value || "").trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(raw)) {
    throw new Error("Amount must be a non-negative USDC decimal with at most 6 places");
  }

  const [whole, fraction = ""] = raw.split(".");
  const units = BigInt(whole) * USDC_SCALE + BigInt(fraction.padEnd(USDC_DECIMALS, "0"));
  if ((!allowZero && units <= 0n) || (allowZero && units < 0n)) {
    throw new Error("Amount must be positive");
  }

  if (max !== null && units > parseUsdc(max, { allowZero: true, max: null })) {
    throw new Error(`Amount exceeds the ${max} USDC limit`);
  }
  return units;
}

// Circle returns balance amounts using the token's display precision, which
// can contain more fractional digits than USDC's six internal decimals. Keep
// request validation strict, but safely floor external balance data to the
// nearest USDC base unit so we never overstate spendable funds.
function parseExternalUsdcBalance(value) {
  const raw = String(value ?? "").trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(raw);
  if (!match) throw new Error("Circle returned an invalid USDC balance");

  const whole = match[1];
  const fraction = (match[2] || "").slice(0, USDC_DECIMALS).padEnd(USDC_DECIMALS, "0");
  return BigInt(whole) * USDC_SCALE + BigInt(fraction);
}

function formatUsdc(units, minimumDecimals = 2) {
  const value = typeof units === "bigint" ? units : BigInt(units);
  if (value < 0n) throw new Error("USDC units cannot be negative");

  const whole = value / USDC_SCALE;
  const fraction = (value % USDC_SCALE).toString().padStart(USDC_DECIMALS, "0");
  const trimmed = fraction.replace(/0+$/, "");
  const decimals = trimmed.padEnd(minimumDecimals, "0");
  return decimals ? `${whole}.${decimals}` : whole.toString();
}

module.exports = { formatUsdc, parseExternalUsdcBalance, parseUsdc, USDC_SCALE };
