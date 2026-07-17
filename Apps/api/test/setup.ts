// Force every vitest run onto the disposable test database — never the dev/prod one.
// Runs before any test file imports src/env.ts or the Prisma singleton (see setupFiles
// in vitest.config.ts / vitest.integration.config.ts).
process.env['NODE_ENV'] = 'test';

const testDatabaseUrl =
  process.env['TEST_DATABASE_URL'] ?? 'postgresql://user:password@localhost:5433/dragon_telecom_test';

process.env['TEST_DATABASE_URL'] = testDatabaseUrl;
process.env['DATABASE_URL'] = testDatabaseUrl;

process.env['JWT_SECRET'] =
  process.env['JWT_SECRET'] ?? 'test_secret_that_is_at_least_32_chars_long!!';
