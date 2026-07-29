# Identity — Sprint 3 Report: Logic A (auth & sessions)

**Status:** ✅ Done — [`sprints-identity-01.md`](../sprints-identity-01.md) Sprint 3 marked ✅.

---

## What was implemented

### `IdentityService` (`Apps/api/src/modules/identity/identity.service.ts`)
Constructor-injected `PrismaClient` (manual DI — `routes.ts` will be the only place `new IdentityService(prisma)` happens, in Sprint 5). Implements the **full** `IIdentityService` interface now, not just this sprint's 4 methods — TypeScript's `implements` requires every member to exist to compile. The 13 methods out of scope this sprint (users/roles/pages/technicians — Sprint 4's work) are typed stubs:

```ts
async listUsers(_query: UserListQuery): Promise<PaginatedResult<UserDto>> {
  return this.notImplemented('listUsers');
}
```

`notImplemented(method)` throws `Error("IdentityService.${method}() is not implemented yet (see Sprint 4)")`. No route points at any of them yet (routes don't exist until Sprint 5), so this is inert until Sprint 4 replaces each stub body with real logic.

### `login(cmd, ctx)`
- **Three-way resolution** (`resolveLoginUser`): one query tries `username` OR `email` directly; if neither matches, falls back to `Client.phone → Client.userId → User`. A pending client (`Client.userId === null`) correctly falls through to "not found" rather than resolving — the DB lookup for phone stops at `client?.userId` and never queries `user` if it's null.
- **No enumeration/timing oracle**: unknown user, wrong password, and disabled user all throw the exact same `AppError(401, AUTH_INVALID_CREDENTIALS, 'Invalid credentials')`, and the unknown-user path still calls `comparePassword` (against a precomputed constant Argon2id hash of an arbitrary value) so the timing profile matches the real-user path.
- **Success path**: `user.lastLoginAt` update + `RefreshToken` creation happen in one `prisma.$transaction([...])` (array form — no dependency between the two writes). `auth.loggedIn` is emitted only *after* that transaction resolves.
- **JWT payload**: `sub`/`type` always; `staffId: user.staff.id` (not `User.id` — matches how `Sale.staffId`, `StockMovement.staffId`, etc. reference `Staff.id` elsewhere in the schema) for STAFF/ADMIN, `clientId: user.client.id` for CLIENT — picked by which relation is actually populated, not by switching on `type`, so it can't drift from the DB's own reality.
- **`profile`**: STAFF/ADMIN → `IdentityMapper.toStaffProfileDto(user.staff)`; CLIENT → `undefined` (the DTO field is `z.unknown()`, so this is valid — the `clients` module owns the real client-profile shape, identity doesn't depend on it). If an ADMIN/STAFF row somehow has no `Staff` row, this throws an internal `Error` loudly rather than silently returning a bad DTO — that would be a data-integrity bug, not a normal runtime case.

### `refresh(cmd, ctx)`
Hash the presented token → look up `RefreshToken.tokenHash`. Branches, in order: not found → 401; already revoked → **revoke every still-active token for that user** (`updateMany`, the "chain-kill"), then 401; expired → 401; user missing/disabled → 401 (defense-in-depth — disabling a user is supposed to already revoke their tokens via Sprint 4's `updateUser`, so this branch should be unreachable in practice, but it's cheap insurance and now has its own test). Otherwise: interactive `$transaction(async (tx) => {...})` (needs the newly-created token's id to set `replacedByTokenId` on the old one, hence the callback form rather than the array form used in `login`).

### `logout(userId)` / `getEffectivePages(user)`
`logout` is a one-line `updateMany` revoking the caller's active tokens. `getEffectivePages` reuses `IdentityMapper.effectivePages` from Sprint 2 for **both** branches — ADMIN fetches every `Page.key` and passes it as `allPageKeys`; STAFF/CLIENT fetch `UserRole`s (with the same nested `role → rolePages → page` include the mapper expects) and pass `[]` for the unused `allPageKeys` param. No duplicate "map pages to keys" logic between the two branches.

---

## Test coverage (`identity.service.spec.ts`, 16 tests)

Mocks Prisma via constructor injection directly (`new IdentityService(prismaMock)`) — no need to `vi.mock('@common/db/prisma')` since the service never imports the singleton itself. `vi.mock`s the four `@common/*` utils the service imports (`event-bus`, `password.utils`, `token.utils`, `refresh-token.utils`), matching how the service itself imports them (alias-based — this is the **first** module in the repo, so it establishes the `@common/*`-alias convention the rules doc's example code already shows, rather than the relative-import style `src/common/` files use internally).

Covers: direct username/email resolution; phone→client fallback (including the pending-client no-op case); byte-identical 401 across unknown/wrong-password/disabled; the dummy-compare call count on the unknown-user path; `lastLoginAt` + `auth.loggedIn` on success; `staffId` vs `clientId` JWT payload selection; refresh rotation fields; reuse→chain-kill; expired; disabled-user refresh; logout; effective-pages for both STAFF and ADMIN.

---

## Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run lint` | ✅ clean |
| `npm run test:unit` | ✅ 74/74 tests, 13 files (+16 from this sprint) |
| Throws `AppError` subclasses; emits after commit; returns `.parse()`-validated DTOs | ✅ |

No DB/integration work this sprint (as with Sprint 2) — `login`/`refresh`/`logout`/`getEffectivePages` will get their first real-DB exercise in Sprint 5's integration suite, once routes exist to drive them end-to-end.

---

## Commit

`git add .` then `git commit -m "api: identity sprint 3 — auth and sessions"`.
