"use strict";

const { z } = require("zod");
const { formatUsdc, parseUsdc } = require("./money");

const ethAddress = z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address");
const txHash = z.string().trim().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash");
const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const shortText = z.string().trim().min(1).max(120);
const content = z.string().trim().min(1).max(100_000);
const protectedAssetRef = (assetType) => z.string().trim().max(2_048).refine((value) => {
  if (!value) return true;
  if (value.startsWith(`r2://surfai/${assetType}/`)) {
    const key = value.slice(5);
    return /^surfai\/(?:pdf|video)\/[a-zA-Z0-9/._-]{1,500}$/.test(key) && !key.includes("..");
  }
  try {
    return new URL(value).protocol === "https:";
  } catch (_error) {
    return false;
  }
}, `Asset must be empty, use HTTPS, or reference an uploaded ${assetType} file`);
const domain = z.string().trim().toLowerCase().max(253).refine(
  (value) => /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value),
  "Invalid domain name"
);

const usdcAmount = (max = "1000000") =>
  z.union([z.string(), z.number()]).transform((value, context) => {
    try {
      return formatUsdc(parseUsdc(value, { max }));
    } catch (error) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: error.message });
      return z.NEVER;
    }
  });

const surfAIReportFields = {
  title: z.string().trim().min(3).max(200),
  snippet: z.string().trim().min(10).max(500),
  content,
  price: usdcAmount("1000"),
  pdfUrl: protectedAssetRef("pdf"),
  videoUrl: protectedAssetRef("video"),
};

const schemas = {
  articleCreate: z.object({
    title: z.string().trim().min(3).max(200),
    content,
    price: usdcAmount("1000"),
  }),
  articleUpdate: z.object({
    title: z.string().trim().min(3).max(200),
    content,
    price: usdcAmount("1000"),
  }),
  articleUnlock: z.object({ articleId: z.string().trim().min(1).max(128) }),
  entitlementReconcile: z.object({
    receipts: z.array(z.object({
      articleId: z.string().trim().min(1).max(128),
      txHash,
    })).max(25),
  }),
  publisherApplication: z.object({
    name: shortText,
    domain,
    walletAddress: ethAddress,
    category: z.string().trim().min(1).max(120).optional(),
  }),
  adminPublisherCreate: z.object({
    email,
    name: shortText,
    domain,
    walletAddress: ethAddress,
    category: z.string().trim().min(1).max(120).optional(),
  }),
  publisherVerify: z.object({ email, verified: z.boolean() }),
  surfaiUpdate: z.object(surfAIReportFields),
  surfaiReportCreate: z.object({
    ...surfAIReportFields,
    replaceCurrent: z.boolean().optional().default(true),
  }),
  surfaiReportUpdate: z.object({
    ...surfAIReportFields,
    listed: z.boolean(),
  }),
  r2UploadRequest: z.discriminatedUnion("assetType", [
    z.object({
      assetType: z.literal("pdf"),
      fileName: z.string().trim().min(1).max(255),
      contentType: z.literal("application/pdf"),
      size: z.number().int().positive().max(50 * 1024 * 1024, "PDF files are limited to 50 MB"),
    }),
    z.object({
      assetType: z.literal("video"),
      fileName: z.string().trim().min(1).max(255),
      contentType: z.enum(["video/mp4", "video/webm", "video/quicktime"]),
      size: z.number().int().positive().max(1024 * 1024 * 1024, "Video files are limited to 1 GB"),
    }),
  ]),
  withdraw: z.object({
    destinationAddress: ethAddress,
    amount: usdcAmount("1000000"),
  }),
};

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body || {});
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      });
    }
    req.validatedBody = result.data;
    next();
  };
}

module.exports = { schemas, validate };
