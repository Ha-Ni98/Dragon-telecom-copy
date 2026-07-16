# Sprint 0 — Common Foundation & Package Setup

**Status:** ✅ Complete

## What was created / changed

- `Apps/contract/package.json` — renamed `name`: `@your-app/contract` → `@dragon-telecom/contract` (plan §3.2).
- `Apps/contract/src/common/types.ts` — reviewed against plan §1.1; already matches exactly (`ApiResponse<T>`, `PaginationMetaSchema`/`PaginationMeta`, `paginated()` factory, `BooleanQuerySchema`, `PaginatedResult<T>`). **No changes needed.**
- `Apps/contract/src/common/errors.ts` — reviewed against plan §1.2; already matches exactly (baseline 8 `ErrorCode` members, no domain additions). **No changes needed.**
- `Apps/contract/src/index.ts` — reset to the Sprint-0 scope: now exports only `./common/errors` and `./common/types`. Removed `./common/auth`, `./modules/user`, `./modules/auth`, `./modules/delivery-company` from the root barrel.

## Deferred (by design, per sprints.md)

- `common/auth.ts` is **untouched** and still on disk (still imports `UserRole` from `../modules/user/user.enums`, still valid) — it is reshaped to the `{ sub; type: UserType; clientId?; staffId? }` JWT payload in Sprint 1, once `identity.UserType` exists.
- The template module directories `modules/user`, `modules/auth`, `modules/delivery-company` are **not deleted yet** — that is a Sprint 1 task. They remain on disk and are still directly imported by `src/__tests__/conformance.test.ts`, which is why the existing test suite still passes unchanged in this sprint.

## Validation

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `madge --circular --extensions ts src` | ✅ no circular dependency (17 files processed) |
| `eslint src` | ✅ clean |
| `tsx --test` (conformance suite) | ✅ 12/12 passing (still exercising the template `auth`/`delivery-company` modules — expected, replaced in Sprint 1) |
| Every type `z.infer`'d, no `any`, ISO dates | ✅ — no DTOs touched this sprint; `common/types.ts` carries no date fields |
| No sensitive fields in any DTO | ✅ — no DTOs touched this sprint |
| No business logic / DB / Express imports | ✅ |

## Flagged (non-blocking)

- **Downstream break, expected:** `Apps/api/package.json` and `Apps/web/package.json` both declare `"@your-app/contract": "file:../contract"`. The rename means their declared dependency name no longer matches `Apps/contract`'s `package.json` name. Per the confirmed source of truth, `Apps/api`/`Apps/web` are template scaffolding to be rebuilt against the new contract in Stage 02/03 — not touched here, and out of scope for Stage 01 validation (which only runs `Apps/contract`'s own `npm run validate`).

## Commit

Committed on green as `contract: sprint 0 — common foundation & package setup`.
