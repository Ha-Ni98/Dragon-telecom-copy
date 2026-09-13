import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('/api'),
  DATABASE_URL: z.url(),
  TEST_DATABASE_URL: z.url().optional(),
  CORS_ORIGIN: z.string().default('*'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRATION: z.string().default('15m'),
  // Number of days (not a duration string like JWT_EXPIRATION) — refresh tokens are raw
  // random bytes, not JWTs, so nothing requires the jsonwebtoken/`ms` duration format.
  REFRESH_TOKEN_EXPIRATION: z.coerce.number().int().min(1).default(7),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  // S26.1 — Cloudflare R2. Validated at boot because an image upload that reaches a
  // misconfigured client fails per-request with an opaque S3 error instead of failing the
  // deploy. Names match the keys already present in Apps/api/.env — do not rename.
  R2_ENDPOINT: z.url(),
  R2_BUCKET_NAME: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  // Public base URL of the bucket's custom domain. Image traffic is served from here directly,
  // never proxied through the Fly machine (set S26.1 — keeps egress off the app's bandwidth and
  // its 1 GB of memory). No trailing slash.
  R2_PUBLIC_URL: z.url(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
