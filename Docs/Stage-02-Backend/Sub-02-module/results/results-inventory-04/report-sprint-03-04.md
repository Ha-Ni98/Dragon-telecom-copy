# Inventory — Sprint 3 Report: Logic B — reads + adjustments (`InventoryReadService`)

**Status:** ✅ Done — [`sprints-inventory-04.md`](../sprints-inventory-04.md) Sprint 3 marked ✅.

---

## Constructor gap filled (implementation necessity, not a redesign)

The sprint file's `InventoryReadService` constructor listed only `(prisma, sequence:
ISequenceService, catalogPricing: ICatalogPricingPort)` — but the very next task line requires
`createAdjustment` to call `engine.addLayer`/`engine.consumeFifo` for non-zero deltas, which is
impossible without a reference to the engine. Added **`engine: IInventoryService`** as a fourth
constructor parameter. This is filling in an evident omission (the next sentence of the same task
already assumes "engine" exists), not a conflict — resolved without stopping to ask, per the
standing rule that HOW gaps are resolved toward what the surrounding text obviously intends.

## First cross-module interface import: `ISequenceService`

`ISequenceService` lives in `platform.interface.ts` (API-internal, not a contract type) and has no
existing consumer yet — platform/identity/observability/catalog don't allocate document sequence
numbers. Inventory's `createAdjustment` (needing `DocType.ADJUSTMENT`) is the **first** consumer,
so there's no precedent to follow mechanically. Decided to import it directly via a relative
cross-module path (`import type { ISequenceService } from '../platform/platform.interface'`)
rather than re-declaring an equivalent port locally: unlike `ICatalogPricingPort` (which the plan
explicitly frames as "the port inventory needs" because catalog doesn't expose one), platform's
sequence interface is already a stable, deliberately-shared cross-module contract — re-declaring it
would just be duplication. It's a **type-only** import (`import type`, erased under
`verbatimModuleSyntax`), so it carries no runtime dependency-cycle risk. Every future document
module (orders, sales, purchasing, repairs, billing) will do the same import.

---

## What was implemented

### `Apps/api/src/modules/inventory/inventory.service.ts` — `InventoryReadService`, replacing the Sprint-2 stubs

- **`getStock`** — maps all `Product` rows through `InventoryMapper.toStockRowDto`; `lowStockOnly`
  filters the already-derived `isLow` field (reusing the mapper's own threshold logic rather than
  expressing it as a second, parallel Prisma predicate); `export='csv'` returns an `ExportResult`
  (`text/csv`, one line per row, no field escaping) — mirrors platform's `exportFees` CSV branch
  exactly for consistency, including its lack of quoting/escaping (flagged below, same limitation,
  not newly introduced). Unpaginated, per the contract (plan §8 #4 — `StockQuery` has no page/limit).
- **`listMovements`** — `MovementsQuery` filters (`productId`/`type`/`staffId`/`from`/`to`) mapped
  onto a `Prisma.StockMovementWhereInput` (`to` treated as *inclusive* of that whole day via an
  exclusive upper bound one day later); paginated via `count` + `findMany` (`skip`/`take`), ordered
  newest-first (no sort order specified by the spec; picked as the natural admin-ledger default).
  **`referenceLabel` resolution** (the join dispatch Sprint 1's mapper deliberately deferred here):
  `PRODUCT` resolves from the *already-joined* `movement.product.name` — no extra query, since for
  an `INITIAL_STOCK`-style movement the reference **is** the product itself; `ADJUSTMENT` and
  `SUPPLIER_INVOICE` batch-resolve via one `findMany({ id: { in: [...] } })` each (not one query per
  row); any other `referenceType` (SALE/ORDER/REPAIR/RETURN — modules not yet built) gets no
  `resolvedName` and falls through to the mapper's `"type shortId"` fallback.
- **`listReservations`** — `Prisma.groupBy` on `(productId, referenceType, referenceId)` over
  `direction: 'PENDING'` with `_sum.quantity`/`_min.createdAt`; kept only groups whose net signed
  sum is `> 0` (a fully-released holder nets to 0 and disappears, matching the engine's signed
  `PENDING_RELEASE` convention from Sprint 2). `holderType` derived from `referenceType` alone
  (`REPAIR` → `ReservationHolderType.REPAIR`, else `ORDER`) — **mirrors the engine's own
  `reservationType` derivation, inverted** — not from the movement `type` column, since a single
  holder's group can contain both a `PENDING_ORDER`/`PENDING_REPAIR` row and a `PENDING_RELEASE`
  row. **Paginated in application memory, not at the DB level** — flagged as a deliberate tradeoff
  below.
- **`createAdjustment`** — single `$transaction`: allocates `reference` via
  `sequence.nextNumber(tx, DocType.ADJUSTMENT)`; creates the `StockAdjustment` header; per line,
  reads the product (unlocked — see the concurrency note below), computes
  `delta = countedQuantity − previousQuantity`, and dispatches: `delta > 0` →
  `engine.addLayer(..., unitCost ?? currentAvgCost, ADJUSTMENT_IN, ref)`; `delta < 0` →
  `engine.consumeFifo(..., revenue=null, ADJUSTMENT_OUT, ref)` (⇒ `profit=null` for free, since the
  engine already implements that rule); `delta === 0` → neither, but an optional `line.prices` still
  runs through `catalogPricing.applyPricing(tx, ...)` **in the same transaction** regardless of
  delta sign. Every line gets a `StockAdjustmentLine` row (`previousQuantity`/`countedQuantity`/
  `delta`, `unitCost` only when an IN layer was actually created). After the transaction resolves:
  `engine.flushEvents(capturedTx)` (the `tx` reference captured via a closure variable assigned
  inside the callback — the mechanism anticipated in Sprint 2's report), then
  `eventBus.emit('inventory.adjusted', { reference, description })`.

### A genuine interpretation call: what goes in `AdjustmentResultDto.lines[]`

`AdjustmentResultDto.lines[].movementId` is a required `z.uuid()` — but a `delta === 0`
reprice-only line has no movement to report. Decided: **such lines are simply omitted from the
result's `lines[]` array** (the reprice still happens; it's just not representable in a shape whose
only fields are `productId`/`delta`/`movementId`). The alternative — inventing a placeholder
`movementId` — would fail schema validation or misrepresent a non-event as an event. Verified with
a dedicated test (`a zero-delta reprice-only line calls applyPricing but produces no result line`).

### Concurrency note: the adjustment's pre-read is intentionally unlocked

`createAdjustment` needs `previousQuantity` (and a fallback `unitCost`) **before** it can even
decide which engine method to call — this read happens via a plain `tx.product.findUnique`, not
the engine's own `SELECT ... FOR UPDATE`. This is a deliberate choice, not an oversight: the actual
ledger math (onHand, averageCost, balanceAfter, FIFO draining) is fully protected by the engine's
own lock the moment it's invoked, so the ledger itself can never be corrupted. The only thing that
could be marginally stale under a genuine race is the **audit-only** `previousQuantity`/`delta`
recorded on the `StockAdjustmentLine` — and a real conflict (e.g. someone else's sale consumes the
stock mid-adjustment) surfaces as the engine's own `INSUFFICIENT_STOCK` 409, rolling back the whole
adjustment transaction, not a silent wrong number. Given adjustments are infrequent and
staff-initiated (a physical count reconciliation is inherently a snapshot-in-time exercise), this
was judged an acceptable, clearly-documented tradeoff rather than plumbing a second row lock through
a class that doesn't otherwise need one.

---

## Tests (`Apps/api/test/unit/modules/inventory/inventory.service.spec.ts`, +38 tests, 63 total in the file)

Extended the same spec file (catalog Sprint 3/4 precedent). The engine (`IInventoryService`) is
**mocked** for these tests — its own correctness was already proven in Sprint 2 with dedicated FIFO
tests; this sprint's tests focus on the new orchestration logic (sequence allocation, delta
computation, in-tx reprice, event sequencing), not re-verifying FIFO math.

- **`getStock`** — `availableQuantity`/`stockValue`/`isLow` derivation; `lowStockOnly` filtering;
  CSV shape (`mime`, `filename`, header row, correct line count).
- **`listMovements`** — pagination/meta; `PRODUCT` label from the joined name (asserting the
  adjustment lookup is **not** called); `ADJUSTMENT` label via the batched lookup; the
  `"type shortId"` fallback for `SALE`; the full filter-to-`where` mapping including the inclusive
  `to` date.
- **`listReservations`** — `holderType`/`ageHours` derivation (via `vi.useFakeTimers`); `REPAIR`
  holder type; exclusion of a fully-released (net-zero) group.
- **`createAdjustment`** — IN delta defaults to current avgCost; an explicit `unitCost` overrides
  it; OUT delta calls `consumeFifo` with `revenue=null`; a zero-delta reprice-only line calls
  `applyPricing` but contributes no result line; reprice runs **in the same transaction** as a
  non-zero delta (asserted via the same mocked `tx` identity — the shared `prismaMock`, matching
  catalog's `$transaction` mock convention exactly); `flushEvents`/`inventory.adjusted` each fire
  exactly once, after the transaction; an unknown product rejects with 404.

### Bugs the tests caught before they shipped
Two first-draft tests failed on the first run, both test-construction bugs: (1) `lowStockOnly`'s
test used non-UUID product ids (`'p1'`/`'p2'`), which `StockRowResponseSchema.parse` correctly
rejected — fixed with real UUIDs; (2) `listMovements`' basic pagination test crashed on
`supplierInvoices.map` because `buildMovementRow()`'s default `referenceType` is
`'SUPPLIER_INVOICE'`, triggering the batched lookup, and the test hadn't mocked
`supplierInvoiceFindManyMock` — fixed by giving `beforeEach` safe persistent defaults
(`mockResolvedValue([])`) for both batch-lookup mocks, so any test using the default fixture
doesn't need to know about a resolver it isn't testing.

---

## Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run lint --no-color` | ✅ clean |
| `npm run test:unit` (289 tests / 22 files, incl. 63 in the inventory service spec) | ✅ green |
| Every `IInventoryReadService` method returns a `.parse()`d DTO / `PaginatedResult` / `ExportResult` | ✅ |
| `createAdjustment` is transactional: sequence + per-line engine dispatch + reprice all inside one `$transaction` | ✅ |
| `inventory.adjusted` emitted **after** the transaction resolves (not from inside it) | ✅ (explicit test) |
| `Decimal→number` / `Date→ISO` at every boundary | ✅ (unchanged from Sprint 1's mapper, reused as-is) |

`npm run test:int` not run — no route is wired yet (first applicable in Sprint 4).

---

## Flagged for the owner

1. **`listReservations` paginates in application memory**, not at the DB level: `groupBy` +
   `having`-style filtering (net sum > 0) + an accurate total count don't compose cleanly through
   Prisma's `groupBy` API in one query, so all matching *open* groups are fetched, filtered, and
   sliced in JS. Acceptable since "currently open reservations" is a bounded, actively-shrinking
   set (unlike movement history, which only grows) — but would need revisiting if that set ever
   becomes large. Not a blocker for this sprint or Sprint 4.
2. **CSV export has no field escaping** (matches platform's existing `exportFees` CSV branch
   exactly — same limitation, not newly introduced here). A product `name` containing a comma
   would misalign columns. Cross-cutting concern better fixed once for both exporters than
   invented ad hoc in this module.
3. **`ISequenceService` cross-module import precedent** (see above) — worth the owner's awareness
   since every future document module will repeat it.

---

## Notes for Sprint 4

- `InventoryReadService`'s constructor is now `(prisma, sequence, catalogPricing, engine)` — the
  composition root (`inventory.routes.ts`) must supply all four: `prisma`, the real
  `sequenceService` (imported from `platform.routes`), a real `catalogPricingService` (catalog's
  side of the port — not yet exported; catalog must add it, per plan §7.2), and the `InventoryService`
  engine instance created in the same file.
- No contract changes, no schema changes this sprint.

---

## Commit

`git add .` then `git commit -m "api: inventory sprint 3 — reads and adjustments"`.
