# Inventory — Sprint 1 Report: Foundation — mapper, interfaces, factories

**Status:** ✅ Done — [`sprints-inventory-04.md`](../sprints-inventory-04.md) Sprint 1 marked ✅.

---

## What was implemented

### `Apps/api/src/modules/inventory/inventory.mapper.ts`
- `toStockRowDto` — `availableQuantity`/`stockValue`/`isLow` derived, `averageCost` `Decimal→number`,
  `barcode?` omitted when null.
- `toMovementDto(movement, product, staff, referenceLabel)` — `direction`/`type` cast to the contract
  enums (Prisma's own enums carry identical string values, plan §1.3); `unitCost?`/`remainingQuantity?`
  (IN)/`costOfGoods?`/`profit?` (OUT) each omitted when `null`; `staffName = firstName + ' ' + lastName`;
  `createdAt→ISO`; `referenceLabel` passed straight through (resolution is the caller's job, see below).
- `toReservationDto(group, product)` — takes an already-aggregated `ReservationGroup` (the service groups
  live PENDING movements per holder in Sprint 3; the mapper does no aggregation).
- `toAdjustmentResultDto(adjustment, lines)` — reference + per-line `{ productId, delta, movementId }`
  passthrough.
- `resolveReferenceLabel(referenceType, referenceId, resolvedName?)` — pure fallback logic only
  (`resolvedName ?? "${referenceType} ${referenceId.slice(0,8)}"`). **Scope decision:** the plan's
  per-`referenceType` *dispatch* (which table to join — `StockAdjustment`/`Product`/`SupplierInvoice`)
  requires DB access and is therefore the **service's** job (Sprint 3's `listMovements`), not the
  mapper's — mappers stay static/pure with no I/O (rules §3). The mapper only owns the
  resolved-value-or-fallback decision; recorded here so Sprint 3 knows where the join logic belongs.
- Two helpers made **public** because the FIFO engine (Sprint 2) reuses them for its low-stock
  edge-trigger check, keeping the threshold/available-quantity math in one place (mirrors catalog's
  public `availableQuantity`/`deriveStockStatus` precedent): `availableQuantity` and `isLow`. Also
  `ageHours(since, now?)` for `listReservations` (Sprint 3).
- Every `toDto` ends `…ResponseSchema.parse(dto)`; money via a private `toMoney` (`Prisma.Decimal | number
  → number`), matching the platform/catalog `Money` type precedent.

### `Apps/api/src/modules/inventory/inventory.interface.ts`
- `IInventoryReadService` — `getStock`/`listMovements`/`listReservations`/`createAdjustment`, all
  returning contract DTOs / `PaginatedResult<T>` / `ExportResult` (rules §4 honoured for the whole
  HTTP-facing surface).
- `ExportResult` — declared **locally** rather than imported from platform: `platform.interface.ts`'s
  `ExportFeesResult` isn't re-exported through any barrel (modules only exchange singletons/ports via
  `routes.ts`, never ad hoc type imports across module folders), so a same-shape local type is the
  precedent-consistent choice. Resolves the plan §5 item 1 "reuse or declare locally" fork toward
  "declare locally."
- `IInventoryService` (the injected engine) + `MovementRef` (internal — carries `staffId` +
  `referenceType`/`referenceId`, since `StockMovement.staffId` is a required column the spec's bare
  positional `ref` can't supply) + the engine's result types (`AddLayerResult`, `ConsumeFifoResult`,
  `ReturnInResult`, `ConsumptionLine`). Returns the spec-mandated internal transactional shapes, not
  DTOs — the one deliberate exception to rules §4, per plan §8 #1.
- `ICatalogPricingPort` — `applyPricing(tx, productId, cmd)`, the port inventory needs from catalog for
  in-tx adjustment repricing (plan §7.1–2).

### Factories (`Apps/api/test/data/`)
- `staff.factory.ts` (new) — `seedStaff(options?)`. `Staff.userId` is a required FK, so this wraps
  `seedUser({ type: STAFF })` and hands back just the `Staff` row (narrowed with a runtime guard, since
  `User.staff` types as `Staff | null` even though the same call just created it).
- `stock-movement.factory.ts` (new) — `seedStockMovement(options)`, **persistence-only**: no
  `CreateMovementCommand` exists in the contract (movements are written only by the injected engine or
  the internal adjustment path — spec §Events rationale), so there is no matching command-payload half,
  unlike every other factory in this directory. Defaults to a live IN layer
  (`remainingQuantity = quantity`); override `direction`/`type` for OUT/PENDING rows.
- `stock-adjustment.factory.ts` (new) — `createAdjustmentPayload` (parses `CreateAdjustmentSchema`) +
  `seedStockAdjustment` (direct `StockAdjustment`+`StockAdjustmentLine[]` persistence, for Sprint 3/4
  scenarios needing a pre-existing adjustment, e.g. `referenceLabel` resolution for `ADJUSTMENT` rows).
- `product.factory.ts` — reused as-is (`seedProduct` already covers `quantityOnHand`/`averageCost`/
  `reorderThreshold` overrides needed for stock-row/FIFO fixtures); no changes required.

### Tests (`Apps/api/test/unit/modules/inventory/inventory.mapper.spec.ts`)
- 20 tests, written before the mapper implementation (test-first per the execution protocol): schema-
  parse conformance for every DTO; `availableQuantity`/`stockValue`/`isLow` math (both sides of the
  threshold); `Decimal→number`; `Date→ISO`; `staffName` composition; enum passthrough (`direction`/
  `type`); optional `unitCost`/`remainingQuantity`/`costOfGoods`/`profit`/`reason`/`barcode` each omitted
  when `null` and included when set; `referenceLabel`/`referenceType`/`referenceId` passthrough;
  `resolveReferenceLabel` resolved-vs-fallback; the `availableQuantity`/`isLow`/`ageHours` helpers
  directly.

---

## Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run lint --no-color` | ✅ clean |
| `npm run test:unit` (246 tests / 21 files, incl. 20 new mapper tests) | ✅ green |
| Mapper never spreads the entity, excludes nothing sensitive (admin-only surface — cost is in-scope by
  design per plan §1.1), returns `.parse()`d contract DTOs | ✅ |
| `IInventoryReadService` methods return DTOs only; the injected `IInventoryService`'s non-DTO returns are
  the documented spec-mandated exception (plan §8 #1), not an oversight | ✅ |
| No service/route logic added yet | ✅ (only mapper + interface + test factories) |

`npm run test:int` not run — no route is wired yet (first applicable in Sprint 4, per the sprint file's
gate rule and the phase file's "once wired").

---

## Notes for later sprints

- **Sprint 2** (the FIFO engine) should call `InventoryMapper.availableQuantity`/`InventoryMapper.isLow`
  for its low-stock edge-trigger check rather than re-deriving the comparison.
- **Sprint 3** (`InventoryReadService`) owns the per-`referenceType` join dispatch for `referenceLabel`
  (`ADJUSTMENT`→`StockAdjustment.reference`, `PRODUCT`→`Product.name`,
  `SUPPLIER_INVOICE`→`SupplierInvoice.reference`, else no `resolvedName` → mapper fallback) — the mapper
  only executes the final resolved-or-fallback choice.
- No contract changes, no schema changes, no cross-module coupling touched this sprint — fully isolated
  to the new module folder + `test/data`.

---

## Commit

`git add .` then `git commit -m "api: inventory sprint 1 — foundation"`.
