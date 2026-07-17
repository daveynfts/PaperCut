"use strict";

// Kept as a compatibility entry point for the old manual faucet test. The
// canonical integration suite now uses an isolated temporary database and the
// test-only authenticated identity path.
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const testFile = path.join(__dirname, "tests", "api.test.js");
const result = spawnSync(process.execPath, ["--test", testFile], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
