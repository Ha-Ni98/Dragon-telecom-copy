# Identity — Sprint 4 Report: Logic B (admin management)

**Status:** ✅ Done — [`sprints-identity-01.md`](../sprints-identity-01.md) Sprint 4 marked ✅.

---

## What was implemented

All 13 stub methods from Sprint 3 are now real. `IdentityService` fully implements `IIdentityService`.

### Users
- **`listUsers`** — paginates via `paginated(UserResponseSchema)`. Restricted to `type: { in: [ADMIN, STAFF] }` by default; an explicit `type: CLIENT` filter deliberately returns an empty page rather than erroring or leaking a malformed DTO — `UserDto.profile` has no CLIENT variant, so CLIENT rows are structurally out of this endpoint's domain (they're managed by the future `clients` module). `search` does a case-insensitive `contains` across `username`, `email`, and the linked `Staff`'s `firstName`/`lastName` (the contract's `UserListQuerySchema.search` doesn't specify which fields; this is a reasonable, documented interpretation — flagged here for the owner in case a narrower behavior was intended).
- **`getUser`** — 404s for a CLIENT-type id too, for the same reason.
- **`createUser(cmd, tx?)`** — a single `prisma.user.create({ data: { ..., staff: { create }, userRoles: { create } } })` call. **Realized during implementation that no explicit `$transaction` is needed here** — Prisma's nested-write syntax is already atomic as one call, whether run via `this.prisma` or a passed-in `tx`. `P2002` (duplicate username/email) → `ConflictError`.
- **`updateUser`** — fetches the existing row first (needed for the last-admin guard anyway), applies `isEnabled`/`password`/`profile`/`roleIds` deltas, and — when disabling or changing the password — revokes active refresh tokens **in the same transaction** as the user update (array-form `$transaction`, conditionally included only when actually needed, so a plain profile edit doesn't touch `RefreshToken` at all). Emits `user.updated` always, `user.roleChanged` only when `roleIds` was part of the command.
- **Last-admin guard** — `cmd.isEnabled === false && existing.isEnabled && existing.type === ADMIN` triggers a `count` of enabled admins; refuses with `ConflictError` (409) if it would hit zero. `type` isn't in `UpdateUserCommand`, so "demote" isn't reachable through this route — matches plan §3.5's read of the guard.
- **`resetPassword(userId, newPassword, tx?)`** — hashes + revokes tokens. **Real bug caught while writing the tx-aware branch**: a `Prisma.TransactionClient` has no `$transaction` method of its own (you can't nest Prisma transactions — the passed `tx` *is already* the atomic context). The original draft called `client.$transaction([...])` unconditionally regardless of whether `client` was `tx` or `this.prisma`, which would have been a runtime error the moment `resetPassword` was ever called with a `tx`. Fixed: when `tx` is given, both writes run directly against it; only the standalone path (`tx` absent) wraps its own two writes in `this.prisma.$transaction([...])`.

### Roles & pages
- **`listRoles` / `createRole` / `updateRole`** — standard CRUD; `createRole` maps `P2002` → `ConflictError`, `updateRole` maps `P2025` (record not found on update) → `NotFoundError`.
- **`setRolePages`** — looks up the role (404 if missing), resolves the requested `pageKeys` against the `Page` table, and rejects with `BadRequestError` (400, `VALIDATION_ERROR`) if any key is unknown **or** resolves to an `ADMIN`-scope page (details include both `unknownKeys` and `adminScopeKeys` arrays for a precise client-side error message). On success, replaces `RolePage` rows in a `$transaction` (`deleteMany` + `createMany`).
- **`listPages(query)`** — filters by `scope` when provided, otherwise returns the full registry.

### Technicians
Standard CRUD; `updateTechnician` maps `P2025` → `NotFoundError`; no delete endpoint exists (matches contract/spec).

### Shared helper
`getAllPageKeys()` (private) — also **replaces** Sprint 3's inline `prisma.page.findMany(...)` call inside `getEffectivePages`'s ADMIN branch (pure DRY refactor, no behavior change — still exercised by that sprint's existing tests, which still pass).

### `assertStaffLoaded`
Prisma's `User.staff` relation is nullable at the type level (`Staff | null`) even though ADMIN/STAFF rows always have one in practice (Sprint 2's mapper design note). Added a small private generic helper that narrows the type and throws loudly if the invariant is somehow violated, rather than letting `IdentityMapper.toUserDto` (which requires `staff: Staff`) fail a raw type-check at every call site. Used in `listUsers`, `getUser`, `createUser`, `updateUser`.

---

## Test coverage (+23 tests, `identity.service.spec.ts` now 39 total)

The mock Prisma object gained `user.create/count/findMany`, `role.*`, `rolePage.*`, `technician.*`. One real testing mistake caught along the way: the first draft faked Prisma errors as `Object.assign(new Error(...), { code: 'P2002' })`, which the service's `err instanceof Prisma.PrismaClientKnownRequestError` check correctly rejected (they aren't real instances) — every P2002/P2025 test failed with the *original* uncaught error instead of the mapped `AppError`. Fixed by constructing real `new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion })` instances, which is also a more faithful test of what Prisma actually throws.

---

## Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run lint` | ✅ clean (fixed one real finding: unused `Page` type import) |
| `npm run test:unit` | ✅ 97/97 tests, 13 files |
| Multi-row writes atomic where needed; DTOs schema-validated | ✅ |

Still no DB/integration exercise — Sprint 5 wires routes and runs the full service against a real test DB for the first time.

---

## Commit

`git add .` then `git commit -m "api: identity sprint 4 — admin management"`.
