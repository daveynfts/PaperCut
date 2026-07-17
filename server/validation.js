"use strict";

const { z } = require("zod");
const { formatUsdc, parseUsdc } = require("./money");

const ethAddress = z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address");
const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const shortText = z.string().trim().min(1).max(120);
const content = z.string().trim().min(1).max(100_000);
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
