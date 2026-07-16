# Sprint 1 — Identity (Core) & JWT Primitive

**Status:** ✅ Complete

## What was created / changed

- **`Apps/contract/src/modules/identity/`** — new module, 6 content files + barrel (plan A / spec `identity.md`):
  - `identity.enums.ts` — `UserType { ADMIN, STAFF, CLIENT }`, `PageScope { ADMIN, STAFF }`, `AuthType` (login-result discriminator).
  - `identity.routes.ts` — `IDENTITY_ROUTES` (12 constants, full-path style per plan C7).
  - `identity.command.ts` — `LoginCommand`, `RefreshCommand`, `CreateUserCommand` (cross-field `.refine()`: `roleIds` required-non-empty iff STAFF, forbidden iff ADMIN), `UpdateUserCommand`, `CreateRoleCommand`, `UpdateRoleCommand`, `SetRolePagesCommand`, `CreateTechnicianCommand`, `UpdateTechnicianCommand`.
  - `identity.query.ts` — `UserListQuery`, `PagesQuery`, `UserIdParams`, `RoleIdParams`, `TechnicianIdParams`.
  - `identity.dtos.ts` — `LoginResultDto`, `RefreshResultDto`, `StaffProfileDto`, `RoleDto`, `PageDto`, `TechnicianDto`, `UserDto`.
  - `identity.events.ts` — `IdentityEvents` map: `auth.loggedIn`, `user.created`, `user.updated`, `user.roleChanged`.
  - `index.ts` barrel.
- **`Apps/contract/src/common/auth.ts`** — reshaped per plan §1.3/C4: `JWTPayloadSchema = { sub: uuid; type: UserType; clientId?: uuid; staffId?: uuid }`, now imports `UserType` from `modules/identity/identity.enums` instead of the deleted `modules/user`.
- **Deleted** the superseded template dirs: `modules/user/`, `modules/auth/`, `modules/delivery-company/` (plan C3).
- **`Apps/contract/src/index.ts`** — added `export * from './common/auth'` and `export * from './modules/identity'`.
- **`Apps/contract/src/__tests__/conformance.test.ts`** — trimmed the `LoginSchema` / `GetDeliveryCompaniesQuerySchema` / `CreateDeliveryCompanySchema` / `DeliveryCompanyResponseSchema` test blocks, which imported from the now-deleted template modules. Kept the `BooleanQuerySchema` suite (still a real, current `common/` export). This is dead-reference cleanup forced by the Sprint 1 deletion task, not new test authorship — no tests were written for the new `identity` module (out of scope for this phase; the contract deliverable is types/schemas/routes per rules §2, not a test suite).

## Decisions on spec ambiguity (non-blocking — trivial per rules §0, not stopped-for)

1. **`AuthType` casing.** `identity.md` writes `LoginResultDto.authType: 'client'|'staff'|'admin'` (lowercase) but `JwtPayload.type: 'CLIENT'|'STAFF'|'ADMIN'` (uppercase) — same three roles, two literal casings, in the same spec file. Modelled as two distinct enums: `UserType` (uppercase values, used by the JWT and `UserDto.type`) and `AuthType` (lowercase values, used only by `LoginResultDto.authType`) — preserves the spec's exact literal values under `contract-rules.md` §3.4 (no magic strings) rather than silently normalizing one away.
2. **`LoginResultDto.profile` typed `z.unknown()`.** The spec gives no field list for this `profile` (unlike `CreateUserCommand.profile`, which is fully spelled out). Since `LoginResultDto` authenticates all three `authType`s and a CLIENT login's profile belongs to the `clients` module (not yet built, and `identity` must not depend on it — would invert the plan's `common → identity → catalog → {clients, inventory}` dependency direction), the field is left `z.unknown()` per rules §3.3 ("no `any`, use `unknown` and narrow") rather than fabricated. The consumer narrows by `authType` once `clients` exists.
3. **`user.created` / `user.updated` / `user.roleChanged` event payloads.** Only `auth.loggedIn`'s payload is spelled out in the spec; the other three are named without a field list. Modelled minimally and conservatively (`{ user: UserDto }` for created/updated, `{ userId; roleIds }` for roleChanged) rather than left empty, since `contract-rules.md` requires an `events.ts` for any module with declared events. Flagged for review once the backend stage defines the actual audit-listener payload needs.
4. **`CreateUserCommand`/`UpdateUserCommand` `password: min(8)`.** No length constraint is stated in `identity.md` for this field (only `clients.md`'s `ResetClientPasswordCommand` states `min(6)`). Applied `min(8)`, transplanted directly from the rules file's own canonical worked example (`contract-rules.md` §5.C, `CreateUserSchema { password: z.string().min(8) }`) rather than inventing an unrelated constraint.
5. **`SetRolePagesCommand`** has no refine for "STAFF-scope pages only" — that check requires a DB lookup against the seeded `Page.scope` registry, which is backend logic per rules §1's ignore list, not contract-enforceable via Zod alone.

## Validation

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `madge --circular --extensions ts src` | ✅ no circular dependency (12 files processed) |
| `eslint src` | ✅ clean |
| `tsx --test` (conformance suite) | ✅ 4/4 passing |
| Every type `z.infer`'d, no `any`, ISO dates | ✅ — `lastLoginAt: z.iso.datetime().optional()`; no other dates in this module |
| No sensitive field in any DTO | ✅ — `password` appears only in `identity.command.ts` (inputs); DTOs never carry `passwordHash`/token hashes/ids; raw `accessToken`/`refreshToken` in `LoginResultDto`/`RefreshResultDto` are the sanctioned §0.1.3 exception (owner-only) |
| No business logic / DB / Express imports | ✅ |
| 6-file-max per module | ✅ — 6 content files + `index.ts` |

## Commit

Committed on green as `contract: sprint 1 — identity core & JWT primitive`.
