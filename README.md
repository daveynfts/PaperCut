# PaperCut

PaperCut is a pay-per-article reader. Readers authenticate with Privy and pay
small USDC amounts to unlock publisher content. The API owns all authorization,
article terms, payment state, and content grants; the browser never decides who
is an author, payee, administrator, or successful payer.

## Repository layout

- `server/` - Express API, Privy authentication, Circle wallet transfers, and
  Redis/file persistence.
- `vercel-demo-react/` - React/Vite reader and publisher dashboard.
- `contracts/` - PaperCut payment contracts.
- `deploy-helper/` - Hardhat 3 deployment scripts and contract tests.

## Requirements

- Node.js 20 or newer for the API and frontend.
- Node.js 22.13 or newer for Hardhat 3.
- A Privy application.
- Upstash Redis and Circle developer-controlled wallets for production payment
  deployments.

## Local setup

Copy `.env.example` to `.env`, fill in the Privy values, and keep
`PAYMENT_MODE=mock` for local development only.

```bash
npm install
npm start
```

The API listens on `http://localhost:4000` by default.

Start the frontend in a second terminal:

```bash
cd vercel-demo-react
npm install
npm run dev
```

Create `vercel-demo-react/.env.local` with:

```dotenv
VITE_PRIVY_APP_ID=your-privy-app-id
VITE_API_URL=http://localhost:4000
```

## Authentication and administration

Authenticated API requests require a Privy access token. The frontend sends it
as `Authorization: Bearer ...`. If Privy identity tokens are enabled, the
frontend also sends `X-Privy-Identity-Token`; the API verifies both tokens and
rejects them if they belong to different users. Otherwise, the API loads the
user identified by the verified access token from Privy.

Set `ADMIN_EMAILS` to a comma-separated allowlist of verified Privy email
addresses. There is no admin password or client-selected identity fallback.

## Payment modes

`PAYMENT_MODE` must be one of:

- `disabled` - payments and wallet creation are unavailable.
- `mock` - local deterministic payment simulation. Production rejects this
  mode unless `ALLOW_MOCK_PAYMENTS=true` is deliberately set.
- `live` - Circle developer-controlled wallets on Arc Testnet. All Circle
  secrets and wallet IDs in `.env.example` are required.

Only Circle's `COMPLETE` state grants content or updates balances. Pending
transfers are polled through the transaction endpoint, while failed, denied,
or cancelled transfers release their reservation without granting access.

Production requires Redis by default. File persistence can only be enabled
explicitly with `ALLOW_FILE_DB_IN_PRODUCTION=true`, which is not recommended for
multi-instance or serverless deployments.

## Cloudflare R2 uploads for SurfAI

The admin SurfAI desk can upload protected PDFs and videos directly from the
browser to a private Cloudflare R2 bucket. The API signs the upload, so R2
credentials never reach the frontend and large media files do not pass through
the Vercel function. Saved reports store an internal `r2://...` reference. Only
an entitled reader receives a short-lived signed R2 download or playback URL.

Create an R2 API token with Object Read & Write access limited to the PaperCut
bucket, then add these server-side environment variables in Vercel:

```dotenv
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET=papercut-media
R2_UPLOAD_URL_TTL_SECONDS=900
R2_READ_URL_TTL_SECONDS=900
```

Configure the bucket CORS policy for direct browser uploads and video range
requests. Origins must be origins only, without `/papercut` paths:

```json
[
  {
    "AllowedOrigins": ["https://daveynfts.com", "http://localhost:5173"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["Content-Type", "Range"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Keep the R2 bucket private. `SURFAI_PDF_URL` and `SURFAI_VIDEO_URL` remain
supported for legacy externally hosted assets, while uploads from admin use
private R2 references by default.

## Verification

Run the API checks and tests:

```bash
npm run check
npm test
```

Run the frontend lint and production build:

```bash
cd vercel-demo-react
npm run check
```

Compile and test the contracts:

```bash
cd deploy-helper
npm install
npm run check
```

The GitHub Actions workflow under `.github/workflows/ci.yml` runs these checks
for pushes and pull requests.

## Security notes

- Never commit `.env`, private keys, seed phrases, Privy secrets, Redis tokens,
  or Circle entity secrets.
- Rotate any credential that has ever appeared in Git history; deleting it from
  the latest revision does not revoke it.
- Configure `CORS_ORIGIN` with the exact deployed frontend origins.
- R2 access keys are server-only. Never add them to `VITE_*` variables or the
  browser bundle. Keep the bucket private and use the signed upload/read flow.
- Legacy `SURFAI_PDF_URL` and `SURFAI_VIDEO_URL` values are disclosed only
  after an API entitlement grant; their external host must enforce access.
- Review and test live Circle transfers with small amounts before production.
