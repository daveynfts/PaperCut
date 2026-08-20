"use strict";

const crypto = require("crypto");
const { GetObjectCommand, PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const DEFAULT_UPLOAD_TTL_SECONDS = 15 * 60;
const DEFAULT_READ_TTL_SECONDS = 15 * 60;
let cachedClient = null;
let cachedClientKey = "";

function getR2Config() {
  const accountId = String(process.env.R2_ACCOUNT_ID || "").trim();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const bucket = String(process.env.R2_BUCKET || "").trim();
  const prefix = normalizePrefix(process.env.R2_PREFIX);
  const endpoint = String(process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "")).trim();
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    prefix,
    endpoint,
    uploadTtlSeconds: positiveInteger(process.env.R2_UPLOAD_URL_TTL_SECONDS, DEFAULT_UPLOAD_TTL_SECONDS, 3600),
    readTtlSeconds: positiveInteger(process.env.R2_READ_URL_TTL_SECONDS, DEFAULT_READ_TTL_SECONDS, 3600),
  };
}

function normalizePrefix(value) {
  const prefix = String(value || "").trim().replace(/^\/+|\/+$/g, "");
  if (!prefix) return "";
  if (
    prefix.length > 200
    || !/^[a-zA-Z0-9._/-]+$/.test(prefix)
    || prefix.includes("//")
    || prefix.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    const error = new Error("R2_PREFIX must be a safe object-key prefix");
    error.statusCode = 503;
    throw error;
  }
  return prefix;
}

function positiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function assertR2Configured() {
  const config = getR2Config();
  const missing = [
    ["R2_ACCOUNT_ID or R2_ENDPOINT", config.endpoint],
    ["R2_ACCESS_KEY_ID", config.accessKeyId],
    ["R2_SECRET_ACCESS_KEY", config.secretAccessKey],
    ["R2_BUCKET", config.bucket],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) {
    const error = new Error(`R2 upload storage is not configured: ${missing.join(", ")}`);
    error.statusCode = 503;
    throw error;
  }
  return config;
}

function getR2Client(config = assertR2Configured()) {
  const key = [config.endpoint, config.accessKeyId, config.secretAccessKey].join("|");
  if (!cachedClient || cachedClientKey !== key) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      requestChecksumCalculation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    cachedClientKey = key;
  }
  return cachedClient;
}

function sanitizeFileName(fileName) {
  const clean = String(fileName || "asset")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120);
  return clean || "asset";
}

function createAssetKey(assetType, fileName, prefix = getR2Config().prefix) {
  if (!new Set(["pdf", "video"]).has(assetType)) throw new Error("Unsupported R2 asset type");
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "/");
  const root = prefix ? `${prefix}/` : "";
  return `${root}surfai/${assetType}/${date}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
}

function toR2AssetRef(key) {
  return `r2://${key}`;
}

function parseR2AssetRef(value, expectedAssetType) {
  if (!String(value || "").startsWith("r2://")) return null;
  const key = String(value).slice(5);
  const match = key.match(/^(?:[a-zA-Z0-9._-]+\/)*surfai\/(pdf|video)\/[a-zA-Z0-9/._-]{1,500}$/);
  const unsafeSegment = key.split("/").some((segment) => segment === "." || segment === "..");
  if (!match || unsafeSegment || (expectedAssetType && match[1] !== expectedAssetType)) {
    const error = new Error("Invalid R2 asset reference");
    error.statusCode = 400;
    throw error;
  }
  return key;
}

async function createR2Upload({ assetType, fileName, contentType }) {
  const config = assertR2Configured();
  const key = createAssetKey(assetType, fileName, config.prefix);
  const uploadUrl = await getSignedUrl(getR2Client(config), new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
    Metadata: { papercutAssetType: assetType },
  }), { expiresIn: config.uploadTtlSeconds });
  return {
    assetRef: toR2AssetRef(key),
    key,
    uploadUrl,
    uploadHeaders: { "Content-Type": contentType },
    expiresIn: config.uploadTtlSeconds,
  };
}

async function resolveProtectedAssetUrl(value) {
  if (!value) return "";
  const key = parseR2AssetRef(value);
  if (!key) return value;
  const config = assertR2Configured();
  return getSignedUrl(getR2Client(config), new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ResponseContentDisposition: "inline",
  }), { expiresIn: config.readTtlSeconds });
}

function r2StorageStatus() {
  try {
    const config = assertR2Configured();
    return { configured: true, bucket: config.bucket, prefix: config.prefix };
  } catch (_error) {
    return { configured: false, bucket: null, prefix: null };
  }
}

module.exports = {
  createR2Upload,
  createAssetKey,
  normalizePrefix,
  parseR2AssetRef,
  r2StorageStatus,
  resolveProtectedAssetUrl,
  sanitizeFileName,
  toR2AssetRef,
};
