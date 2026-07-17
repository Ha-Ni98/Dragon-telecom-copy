# Sprint 3 — Clients & Inventory

**Status:** ✅ Complete

## What was created / changed

- **`Apps/contract/src/modules/clients/`** — new module, 6 content files + barrel (plan B / spec `clients.md`):
  - `clients.enums.ts` — `ClientStatus { PENDING, APPROVED, REJECTED }`, `PhoneAvailability { AVAILABLE='available', REGISTERED='registered', PENDING='pending' }` (lowercase, same pattern as Sprint 1's `AuthType` vs `UserType`).
  - `clients.routes.ts` — two route consts, `CLIENT_ROUTES` and `POS_CLIENT_ROUTES`, per the spec's two-resource module.
  - `clients.command.ts` — `RegisterClientCommand`, `UpdateMeCommand` (no `phone` — read-only), `ChangeMyPasswordCommand`, `ApproveClientCommand`, `RejectClientCommand`, `ResetClientPasswordCommand`, `AdminUpdateClientCommand`, `CreatePosClientCommand`, `UpdatePosClientCommand`, `AddCartItemCommand`.
  - `clients.query.ts` — `AdminClientListQuery`, `PosClientSearchQuery`, `ClientIdParams`, `PosClientIdParams`, `CartItemParams`.
  - `clients.dtos.ts` — `ValidatePhoneResultDto`, `ClientMeDto` (no category/raw status), `AdminClientDto`, `PosClientDto`, `CartItemDto`.
  - `clients.events.ts` — `ClientsEvents` map: `client.registered`, `client.approved`, `client.rejected`, `client.passwordReset`, `posClient.creditChanged`.
  - `index.ts` barrel.
- **`Apps/contract/src/modules/inventory/`** — new module, 6 content files + barrel (plan D / spec `inventory.md`):
  - `inventory.enums.ts` — `MovementDirection`, `MovementType` (11 values), `AdjustmentReason`, plus a local `ReservationHolderType { ORDER, REPAIR }` for `ReservationDto.holderType`.
  - `inventory.routes.ts` — `INVENTORY_ROUTES` (4 constants).
  - `inventory.command.ts` — `CreateAdjustmentCommand`.
  - `inventory.query.ts` — `StockQuery`, `MovementsQuery`, `ReservationsQuery`.
  - `inventory.dtos.ts` — `StockRowDto`, `MovementDto`, `ReservationDto`, `AdjustmentResultDto`.
  - `inventory.events.ts` — `InventoryEvents` map: `inventory.stockChanged`, `inventory.lowStock`, `inventory.adjusted` (all three have explicit payloads in the spec).
  - `index.ts` barrel.
- **`Apps/contract/src/index.ts`** — added `export * from './modules/clients'` and `export * from './modules/inventory'`.

## Plan deviation: value imports instead of `import type` for the two cross-module edges

The plan (§3.3) said `CartItemDto.product → catalog.ProductWithPricingDto` and `CreateAdjustmentCommand.lines[].prices → catalog.UpdatePricingCommand` should use `import type` to keep the dependency type-only. Implementing that literally would force either a hand-written type intersection (`z.infer<...> & { product: ProductWithPricingDto }`) or `z.unknown()` for the nested field — both violate rules §3.1 ("types derive from schemas... never declare a type and a schema separately"). Since `contract-rules.md` outranks the plan on HOW (§0), both files instead import the **actual runtime schema** (`ProductWithPricingResponseSchema`, `UpdatePricingSchema`) as values and nest it directly, so `CartItemDto` and `CreateAdjustmentCommand` stay single `z.infer`s with real nested runtime validation. The dependency direction is unaffected — `catalog` still imports nothing from `clients` or `inventory` — so `madge --circular` stays clean regardless of type-only vs. value import.

## Decisions on spec ambiguity (non-blocking — trivial per rules §0, not stopped-for)

1. **`clients.enums.ts` route constants not explicitly named in the spec.** `ADMIN_STATS` (spec note: "+ stats route", no path given) inferred as `/api/admin/clients/stats`, matching the `PRODUCT_STATS` precedent (`/api/admin/products/stats`) from Sprint 2. `CART_ITEM` (`/api/clients/me/cart/:productId`) and `POS_CLIENT_ROUTES.ADMIN_BY_ID` split out from the spec's parenthesised path shorthand, matching the pattern used throughout Sprints 1–2.
2. **`ChangeMyPasswordCommand`, `RejectClientCommand`, `UpdatePosClientCommand` field lists are inferred** — none is given a field list in `clients.md`'s type block (only the route table's notes hint at them: "reason optional" for reject). Modelled on the closest sibling pattern already in the contract (`ResetClientPasswordCommand`'s `min(6)`; the universal `isEnabled` toggle).
3. **`StockQuery`, `MovementsQuery.from/to`, `ReservationsQuery` are inferred** — `inventory.md`'s type block only defines the DTOs, not these query schemas. `StockQuery.export` is typed `z.literal('csv')` (only CSV is named in the route note — not modelled as an open format enum since no other formats are documented). `ReservationsQuery` has no filter fields anywhere in the source, so it's pagination-only rather than inventing filters.
4. **`referenceType` on `MovementDto` stays `z.string()`**, not an enum — `database-description.md` explicitly calls it an open string column (mirrors `AuditLog.actionType`), even though its plausible values are listed in prose.
5. **Four of five `client.*` event payloads are minimally inferred** (`client.registered`, `client.rejected`, `client.passwordReset`) — same pattern as Sprints 1–2 (only the events with explicit payloads in the spec — `client.approved`, `posClient.creditChanged` — are modelled beyond a bare id). All three `inventory.*` events, by contrast, had full explicit payloads in the spec — no inference needed there.

## Validation

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `madge --circular --extensions ts src` | ✅ no circular dependency (33 files processed) — confirms both `clients→catalog` and `inventory→catalog` edges stay one-directional |
| `eslint src` | ✅ clean |
| `tsx --test` (conformance suite) | ✅ 4/4 passing (unchanged — no new tests added, out of scope) |
| Every type `z.infer`'d, no `any`, ISO dates | ✅ — `createdAt`/`lastOrderDate`/`createdAt` (movement) all `z.iso.datetime()`; `MovementsQuery.from/to` use `z.iso.date()` (day-level, no time component, per the query-filter use case) |
| No sensitive field in any DTO | ✅ — `password`/`passwordHash`/`tokenHash` scan of both modules' DTOs returns no matches; `password`/`newPassword`/`currentPassword` appear only in `clients.command.ts` (inputs) |
| No business logic / DB / Express imports | ✅ |
| 6-file-max per module | ✅ — both modules: 6 content files + `index.ts` |

## Commit

Committed on green as `contract: sprint 3 — clients & inventory`.
