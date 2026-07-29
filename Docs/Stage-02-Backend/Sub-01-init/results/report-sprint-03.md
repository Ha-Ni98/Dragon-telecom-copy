# Sprint 3: Guards — Report

**Status:** ✅ Done
**Scope:** Middleware layer — request augmentation, `validateRequest`, `requireAuth`, `globalErrorHandler` — unit-tested with Sprint 2's factory/fixture.

---

## 1. Work done

- **`src/@types/express.d.ts`** — augments `Express.Request` with `user?: JWTPayload` (contract) and `validated: { body?; query?; params? }`. No `@ts-ignore`.
- **`src/common/middlewares/validate-request.middleware.ts`** — `validateRequest({ body?, query?, params? })` parses each present segment with its schema and writes the coerced result to `req.validated`; `next(err)` on `ZodError`. Schema-agnostic — works with any Zod schema passed in, contract or otherwise.
- **`src/common/middlewares/auth.middleware.ts`** — `requireAuth({ types?, checkDB? })`: requires `Bearer <token>`, `jwt.verify`s it, validates shape via `JWTPayloadSchema.parse`; with `checkDB`, looks up `prisma.user.findUnique({ where: { id: payload.sub }, select: { type, isEnabled } })`, rejects a missing/disabled user, and refreshes `payload.type` from the DB; rejects if `types` is set and the payload's type isn't in it; sets `req.user`; maps `JsonWebTokenError` → `AuthError`. The one sanctioned DB call in middleware.
- **`src/common/middlewares/error.middleware.ts`** — `globalErrorHandler`: `AppError` → its own `statusCode` + `ApiResponse` error envelope; `ZodError` → 400 `VALIDATION_ERROR` with `err.issues` as `details`; anything else → `logger.error({err})` + 500 `INTERNAL_SERVER_ERROR`. Response bodies are built as typed `ApiResponse` values (not raw object literals) for compile-time envelope-shape safety.
- **`test/fixtures/auth.fixture.ts`** — `mintAuthToken(overrides?)`: builds a `user.factory` user, signs it through the real `generateToken`, returns `{ token, user }` so specs can both authenticate and assert against the same underlying user.

## 2. Two real compile-time issues found and fixed (not just rebinding)

1. **Stale generated Prisma client.** `tsc --noEmit` initially failed with `'type' does not exist` against a `UserSelect` shaped like `{ username, fullName, role: UserRole, deletedAt, ... }` — fields that don't exist in Dragon Telecom's `schema.prisma` at all. The `@prisma/client` in `node_modules` had been generated from the old template schema and never regenerated. Fixed with `npx prisma generate`, which now matches the real schema (`username`, `passwordHash`, `type: UserType`, `isEnabled`, no `fullName`/`role`/`deletedAt`).
2. **Prisma enum vs. contract enum are distinct nominal types.** After regenerating, `payload.type = fresh.type` failed: `$Enums.UserType` (Prisma-generated) and the contract's `UserType` are two separate TypeScript enum declarations with identical string values (`schema.prisma`'s own header comment: "Enum values are identical to the contract's enums") — TS enums are nominal, so they don't unify structurally. Fixed with a documented cast: `payload.type = fresh.type as UserType;`. This will recur for every enum shared between the schema and the contract (`ClientStatus`, `OrderStatus`, etc.) once Sub-02 modules start reading them — worth a shared convention rather than solving ad hoc per module.

## 3. Tests created

- **`test/unit/middleware/validate-request.middleware.spec.ts`** (3 tests) — coercion lands in `req.validated.query`; a failing body schema calls `next` with a `ZodError`; unspecified segments stay `undefined` in `req.validated`.
- **`test/unit/middleware/auth.middleware.spec.ts`** (6 tests) — missing token → `AuthError`; invalid token → `AuthError`; valid token sets `req.user`; type not in the allowed list → `ForbiddenError`; `checkDB` rejects a disabled user (Prisma mocked via `vi.hoisted`, never a real connection); `checkDB` refreshes `req.user.type` from the fresh lookup.
- **`test/unit/middleware/error.middleware.spec.ts`** (4 tests) — `AppError` branch maps to its status + envelope; `ZodError` branch maps to 400/`VALIDATION_ERROR`; unknown `Error` branch maps to 500/`INTERNAL_SERVER_ERROR` (and genuinely logs via Pino — visible as a JSON log line in the test run, expected); `details` passes through when the error provides them.

**Result:** 3 new spec files, 13 new tests. Combined with Sprints 1–2: **9 files, 33 tests, all passing.**

## 4. Validation

| Check | Result |
|---|---|
| `tsc --noEmit` | Clean (after the Prisma regenerate + enum-cast fixes) |
| `npm run lint` | 0 problems — see environment note below |
| `npm run test:unit` | 33/33 passing |
| Middleware fails fast via `next(err)`, never sends the final response | Confirmed by code review — no `res.` calls in `validate-request`/`auth` middlewares |
| No DB calls except `requireAuth({ checkDB })` | Confirmed via grep — the only `prisma.` call in `src/common/middlewares/` |
| No `console.*` outside `env.ts`; no `process.env` outside `env.ts`; no `@ts-ignore` | Confirmed |
| Specs use `auth.fixture`/`user.factory`, no hardcoded data | Yes |

**Environment note:** `npm run lint`'s default `stylish` formatter crashes on the local Node v18.18.0 (`util.styleText is not a function` — that API landed in Node 20.12+; ties back to the `engines: >=20` gap flagged in Sprint 1). The crash happens in ESLint's *formatter*, after linting itself completes, so it doesn't indicate a lint failure. Verified 0 problems via `eslint src test --format json` (bundled, unaffected). Did not change the `lint` script's formatter to work around a local-only, already-flagged Node version gap — normal `stylish` output is fine on any Node ≥20.12, which is what `engines` already requires.

## 5. Notes for later sprints

- Sprint 4 wires `pino-http` (from this sprint's `logger`) into `app.ts`, plus mounts `globalErrorHandler` as the last middleware and builds `server.ts`/`health.spec.ts`/the conformance harness — nothing here blocks that.
- The Prisma-enum-vs-contract-enum cast pattern (§2.2) will recur; Sub-02 modules should adopt the same one-line, commented cast rather than re-deriving it each time.
