# Environment Variables

Every variable listed here must also exist in the `src/env.ts` Zod schema — the validator is the superset of everything the code reads. The app crashes on boot if a required one is missing or invalid.

## Required
- **`NODE_ENV`** — `development` | `production` | `test`. Drives logging and perf.
- **`PORT`** — listen port (default `3000`).
- **`API_PREFIX`** — route mount prefix (default `/api/v1`). Tests and the frontend use this.
- **`DATABASE_URL`** — Postgres connection string for Prisma.
- **`CORS_ORIGIN`** — frontend URL, no trailing slash.
- **`JWT_SECRET`** — min 32 chars. Generate with `openssl rand -hex 32`.
- **`JWT_EXPIRATION`** — access-token lifetime (default `15m`). Read by `token.utils`.
- **`LOG_LEVEL`** — Pino level (default `info`). Read by `config/logger`.

## Realtime (opt-in — already in the template schema)
- **`WS_ENABLED`** — `true` | `false` (default `false`). When `false`, no Socket.IO server is started (see `Apps/api/src/common/realtime`). The frontend has a matching `VITE_WS_ENABLED`.
- **`WS_PATH`** — Socket.IO mount path (default `/socket.io`).

## Project-specific add-ons (add to the schema when you adopt them)
- **`TEST_DATABASE_URL`** — separate disposable DB for integration tests.
- **`REFRESH_TOKEN_EXPIRATION`** — refresh-token lifetime (default `7d`). Used by the Auth service to set `RefreshToken.expiredAt`.
- **`REDIS_URL`** — caching/queues.
- **`SMTP_*`** — email.

## Cloudflare R2 (image storage — S26.1, required)
Every image upload (product photos, brand logos, family icons, the store logo, the print logo) is
processed by the shared image pipeline and stored in R2. Objects are served from `R2_PUBLIC_URL`
directly — the API never proxies image bytes, so image traffic costs the Fly machine nothing.
- **`R2_ENDPOINT`** — the account's S3-compatible endpoint, `https://<account-id>.r2.cloudflarestorage.com`.
- **`R2_BUCKET_NAME`** — the bucket holding all processed images.
- **`R2_ACCESS_KEY_ID`** / **`R2_SECRET_ACCESS_KEY`** — R2 API token credentials.
- **`R2_PUBLIC_URL`** — the bucket's public custom domain / `r2.dev` URL, no trailing slash. Every
  stored object's DTO `url` is `${R2_PUBLIC_URL}/${key}`.

## `.env.example` (commit this; never commit a real `.env`)

```bash
# Application
NODE_ENV="development"
PORT=3000
API_PREFIX="/api/v1"

# Frontend (no trailing slash)
CORS_ORIGIN="http://localhost:5173"

# Database (Prisma)
DATABASE_URL="postgresql://user:password@localhost:5432/myapp?schema=public"
TEST_DATABASE_URL="postgresql://user:password@localhost:5433/myapp_test?schema=public"

# Auth — generate with: openssl rand -hex 32  (must be >= 32 chars)
JWT_SECRET="replace-with-openssl-rand-hex-32-output-0000000000"
JWT_EXPIRATION="15m"

# Logging
LOG_LEVEL="debug"

# Realtime (opt-in) — leave false unless the app needs realtime
WS_ENABLED="false"
WS_PATH="/socket.io"

# Cloudflare R2 (image storage) — S26.1
R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
R2_BUCKET_NAME="myapp"
R2_ACCESS_KEY_ID="replace-me"
R2_SECRET_ACCESS_KEY="replace-me"
R2_PUBLIC_URL="https://media.example.com"
```
