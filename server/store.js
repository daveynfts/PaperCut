"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DATABASES = {
  users: { key: "papercut_users", fallback: {} },
  publishers: { key: "papercut_publishers", fallback: {} },
  articles: { key: "papercut_articles", fallback: [] },
  transactions: { key: "papercut_transactions", fallback: {} },
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function clone(value) {
  return structuredClone(value);
}

class PaperCutStore {
  constructor({ redisClient, directory, seedDirectory = directory, requireCloud = false }) {
    if (requireCloud && !redisClient) {
      throw new Error("A Cloud Redis database is required in production");
    }
    this.redis = redisClient;
    this.directory = directory;
    this.seedDirectory = seedDirectory;
    this.queues = new Map();
  }

  async init() {
    for (const name of Object.keys(DATABASES)) {
      const current = await this._read(name);
      if (this.redis && current === null) {
        await this.redis.set(DATABASES[name].key, this._readSeed(name));
      }
    }
  }

  async read(name) {
    this._assertName(name);
    const value = await this._read(name);
    return clone(value === null ? this._readSeed(name) : value);
  }

  async update(name, mutator) {
    this._assertName(name);
    const previous = this.queues.get(name) || Promise.resolve();
    const operation = previous.catch(() => undefined).then(() => this._updateLocked(name, mutator));
    this.queues.set(name, operation);
    try {
      return await operation;
    } finally {
      if (this.queues.get(name) === operation) this.queues.delete(name);
    }
  }

  async _updateLocked(name, mutator) {
    if (!this.redis) {
      const current = await this.read(name);
      const result = await mutator(current);
      await this._writeFileAtomic(name, current);
      return result;
    }

    const config = DATABASES[name];
    const lockKey = `${config.key}:write-lock`;
    const lockToken = crypto.randomUUID();
    let acquired = false;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const result = await this.redis.set(lockKey, lockToken, { nx: true, px: 30000 });
      if (result === "OK") {
        acquired = true;
        break;
      }
      await sleep(25 + attempt * 10);
    }

    if (!acquired) throw new Error(`Database ${name} is busy; please retry`);

    try {
      const stored = await this.redis.get(config.key);
      const current = clone(stored === null ? this._readSeed(name) : stored);
      const result = await mutator(current);
      await this.redis.set(config.key, current);
      return result;
    } finally {
      const releaseScript = [
        "if redis.call('get', KEYS[1]) == ARGV[1] then",
        "  return redis.call('del', KEYS[1])",
        "end",
        "return 0",
      ].join("\n");
      await this.redis.eval(releaseScript, [lockKey], [lockToken]).catch(() => undefined);
    }
  }

  async _read(name) {
    if (this.redis) return this.redis.get(DATABASES[name].key);
    const filePath = this._filePath(name);
    try {
      return JSON.parse(await fs.promises.readFile(filePath, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return this._readSeed(name);
    }
  }

  _readSeed(name) {
    const seedPath = path.join(this.seedDirectory, `${name}.json`);
    try {
      return JSON.parse(fs.readFileSync(seedPath, "utf8"));
    } catch (_error) {
      return clone(DATABASES[name].fallback);
    }
  }

  async _writeFileAtomic(name, value) {
    const filePath = this._filePath(name);
    const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await fs.promises.writeFile(tempPath, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
    await fs.promises.rename(tempPath, filePath);
  }

  _filePath(name) {
    return path.join(this.directory, `${name}.json`);
  }

  _assertName(name) {
    if (!DATABASES[name]) throw new Error(`Unknown database: ${name}`);
  }
}

module.exports = { PaperCutStore };
