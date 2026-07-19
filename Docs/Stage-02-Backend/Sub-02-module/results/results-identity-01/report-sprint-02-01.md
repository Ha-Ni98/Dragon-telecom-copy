# Identity — Sprint 2 Report: Foundation (mapper, interface, factories)

**Status:** ✅ Done — [`sprints-identity-01.md`](../sprints-identity-01.md) Sprint 2 marked ✅.

---

## What was implemented

### `Apps/api/src/modules/identity/`
- **`identity.mapper.ts`** — `IdentityMapper` (static class): `toUserDto`, `toStaffProfileDto`, `toRoleDto`, `toPageDto`, `toTechnicianDto`, `toAuthType`, `effectivePages`. Never spreads a Prisma entity — every field is listed explicitly; nullable Prisma fields (`phone`, `jobTitle`, `description`, `lastLoginAt`) are included only via a conditional spread (`exactOptionalPropertyTypes: true` forbids assigning `undefined` to an optional DTO key directly). Every `toXxxDto` ends with the matching contract `*ResponseSchema.parse(...)` as the conformance guard.
- **`identity.interface.ts`** — `IIdentityService`, all 17 methods from the plan's method table (§2.1), typed against contract Commands/Queries/DTOs only. `createUser`/`resetPassword` take an optional `Prisma.TransactionClient` (the injected-service connection rule for the `clients` module).

### Design note: `UserWithRelations.staff` is typed non-nullable
Prisma's `User.staff` relation is optional (`Staff?`), but both ADMIN and STAFF users always get a `Staff` row (plan §3.6) — CLIENT users never reach `toUserDto` (identity's `/admin/users` CRUD only manages ADMIN/STAFF; `UserDto.profile` is a required field with no CLIENT variant). Rather than have the mapper defensively handle an "impossible" null case, the mapper's local type requires `staff: Staff` — pushing the obligation to the **service** (Sprint 4) to only ever call `toUserDto` with a query result that actually included a non-null staff. Documented inline in the mapper.

### Test factories (`test/data/`)
- **`user.factory.ts`** (extended) — `createUserPayload` (built via `CreateUserSchema.parse(...)`, so it can never produce a factory-drifted `CreateUserCommand`; resolves `type` before conditionally including `roleIds` to satisfy the schema's refine rules) and `seedUser` (persists `User`+`Staff`, real Argon2id hash, optional `roleIds` → `UserRole` rows).
- **`login.factory.ts`**, **`role.factory.ts`**, **`page.factory.ts`**, **`technician.factory.ts`**, **`refresh-token.factory.ts`** — all new, matching plan §4.1. `seedRole` optionally assigns `RolePage`s by page key; `seedRefreshToken` returns both the raw token and the persisted row (needed for integration tests to exercise real hash-lookup rotation/reuse).

### Two unplanned-but-necessary additions
1. **`src/common/utils/refresh-token.utils.ts`** (+ unit test, 4 cases) — `generateRefreshToken`/`hashRefreshToken` (SHA-256 of a `randomBytes(32)` token). `refresh-token.factory.ts` needed to hash a token identically to however the service will hash it; embedding the algorithm in the factory (and again in `identity.service.ts` next sprint) risked silent drift between the two independent implementations. Extracted once, matches the existing `password.utils.ts`/`token.utils.ts` pattern (pure, split-by-domain util). Sprint 3's task list in `sprints-identity-01.md` was updated to reference this instead of "private service helpers."
2. **`prisma/pages.registry.ts`** — Sprint 1's `prisma/seed.ts` had the canonical 7-page list as a local const. `page.factory.ts` needs the exact same list; importing `seed.ts` directly would have run its `main()` (a live DB write) as an import side effect. Extracted the array into its own side-effect-free module; `seed.ts` and `page.factory.ts` both import from it now.

### Real bug found and fixed: `npm run lint` crashed on this environment
ESLint 10.7's `stylish` formatter calls `util.styleText` (added in Node 20.12) whenever there is at least one finding to print. Sprint 1 had zero findings, so the codepath never ran and the crash went unnoticed; Sprint 2's real code tripped a genuine `@typescript-eslint/consistent-type-imports` finding (see below), which then crashed the formatter *before* printing the message — so the actual lint error was invisible until re-run with `--no-color`. Fixed properly two ways:
1. The real finding: `identity.mapper.ts` imported `PageScope`/`UserType` as **value** imports but only ever used them in type-assertion position (`as ContractPageScope`) — switched to type-only imports.
2. The crash itself: added `--no-color` to the `lint` script in `package.json` (harmless on Node ≥20 — this is purely an ANSI-color-codepath issue, not a rule change) so the script reports findings instead of crashing, regardless of the Node version running it.

---

## Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run lint` | ✅ clean (after the two fixes above) |
| `npm run test:unit` | ✅ 58/58 tests, 12 files — mapper (18), `refresh-token.utils` (4), contract conformance (2), pre-existing (34) |
| Mapper excludes sensitive fields; every DTO parses its `*ResponseSchema` | ✅ verified by the mapper spec |
| Interface methods return DTOs, never entities | ✅ by construction (contract DTO/Command types only) |

No DB/integration work in this sprint — the new `seedXxx` factory functions aren't exercised yet (they will be in Sprint 5's integration tests); `tsc` confirms they compile against the real Prisma client types.

---

## Commit

`git add .` then `git commit -m "api: identity sprint 2 — foundation"`.
