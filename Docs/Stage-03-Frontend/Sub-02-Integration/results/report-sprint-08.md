# Sprint 8 Report — Identity Admin

**Status:** ✅ Done · **Branch:** `stage-03-sub-02-integration` · **Scope:** `/src/services`, `/src/hooks`,
`/tests` — no `/src/components` or `/src/pages` touched.

---

## What shipped

- **`src/services/identity.service.ts`** (new file) — 12 functions covering users (`listUsers`/`createUser`/
  `getUser`/`updateUser`), roles+pages (`listRoles`/`createRole`/`updateRole`/`setRolePages`/`listPages`), and
  technicians (`listTechnicians`/`createTechnician`/`updateTechnician`). Separate from the pre-existing
  `auth.service.ts` (session/login, real since Sub-01) — this is the admin back-office half of the identity
  module.
- **`src/hooks/useIdentity.ts`** (new file) — 12 hooks (7 queries + 5 mutations), all reading from the
  `qk.identity.*` families already scaffolded in the registry since Sprint 1.
- **`tests/fixtures/data/identity.mock.ts`** (new) + **`msw/identity-admin.handlers.ts`** (new), registered in
  `server.ts`.
- **19 new tests**: `identity.service.test.ts` (14) + `identity.test.tsx` (5).

## Genuinely new territory — the one adjacent stub surface was checked and cleared

No same-named Sub-01 stub file exists (`identity.service.ts`/`useIdentity.ts` are both new names). The only
adjacent surface is `use-admin-settings.ts`'s admin-accounts slice (`useAdminAccounts`/`useCreateAdminAccount`/
`useUpdateAdminAccount`/`useDeleteAdminAccount`, numeric ids, backed by `AdminSettingsService`) — checked per the
standing rule and confirmed zero name collisions, so every hook name from plan.md §2.1 was used verbatim
(`useUsers`/`useUser`/`useCreateUser`/`useUpdateUser`/`useRoles`/`useCreateRole`/`useUpdateRole`/
`useSetRolePages`/`usePages`/`useTechnicians`/`useCreateTechnician`/`useUpdateTechnician`).

## All 12 routes confirmed 1:1 against the real backend — no `*(confirm)*` surprises this time

Unlike Sprints 5-7 (each of which found at least one genuine plan.md placeholder-guess correction), reading
`Apps/api/src/modules/identity/{identity.routes,identity.interface,identity.controller}.ts` confirmed the plan's
own route table exactly as written: `ROLE_BY_ID` is PATCH-only (no GET-by-id route exists for role detail —
`listRoles()` is the only role read), `users` is the only paginated list (`UserListQuery` carries `page`/
`limit`; `roles`/`pages`/`technicians` queries don't), and `createUser`/`createRole`/`createTechnician` respond
201 while every update/list responds 200. No local (non-contract) types were needed anywhere in this service —
every DTO/command/query used is a real, exported contract type.

## Two-user fixture pair exercises every Risks-section edge case directly

`identity.mock.ts` builds one STAFF user (`roles`/`effectivePages` populated, all optionals present) and one
ADMIN user (`roles: []`, `effectivePages: []`, `email`/`lastLoginAt` both absent) — the contract's own `PageKey`
comment notes admin bypasses the page-key matrix entirely (no `admin(PAGE_KEY)` gating pattern exists anywhere
in Stage-00), so an ADMIN's `effectivePages` being empty is the correct, spec-driven state rather than a gap.
Both users appear together in `mockUsersPaginated`, so the paginated-list test exercises both shapes in one
fixture.

## Validation

```
npm run check
```
Clean, whole project, zero errors (`tsc --noEmit` on both `/src` and `/src`+`/tests`).

```
npx vitest run
```
**29/29 files, 257/257 tests passing** (up from 238/238 at Sprint 7 close — 19 new).

Lint: `eslint --fix` scoped to the 6 new files only (all genuinely new — no old-stub section to reconstruct
around). Confirmed zero errors afterward.

## Commit

`fe: integration sprint 8 — identity admin` on `stage-03-sub-02-integration`.

## Handoff to Sprint 9 (Sales & Repairs & Billing — final sprint)

- The last domain set: `sales.service.ts` (POS drafts/confirm/returns), `repairs.service.ts` (repairs + parts +
  status), `billing.service.ts` (invoices + client-payments). All Tier 5 (no MVP UI yet), so — like inventory in
  Sprint 6 — expect zero page/component consumer checks needed, but still run the `use-admin-settings.ts` pass
  per the standing rule.
- `qk.sales.*`/`qk.repairs.*`/`qk.billing.*` are already scaffolded in the registry (Sprint 1). Per plan §3's
  cross-domain invalidation matrix, sale confirm/return and repair add-part/status(complete→sale) must sweep
  `qk.inventory.all()` + `qk.billing.all()` (+ `qk.clients.all()`/`qk.posClients.all()` for credit on
  confirm/return) — worth double-checking each of those target families has a real `.all()` sibling before
  writing the invalidation, per the standing `qk` registry check.
- Standing checklist (unchanged): check page/component consumers + `use-admin-settings.ts` collisions before
  naming hooks; read the real backend interface/controller before guessing response shapes; check the `qk`
  registry for a real `.all()` sibling before writing any mutation invalidation. This is the final sprint of the
  9-sprint plan — after it lands, Sub-02 (Integration Engine) is complete.
