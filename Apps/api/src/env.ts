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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
