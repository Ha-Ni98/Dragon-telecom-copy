# Inventory — Sprint 2 Report: Logic A — the FIFO engine (`InventoryService`)

**Status:** ✅ Done — [`sprints-inventory-04.md`](../sprints-inventory-04.md) Sprint 2 marked ✅.

---

## Interface refinement (asked-and-answered during implementation, not a genuine conflict)

Sprint 1's `IInventoryService` had no way for the engine to emit events after the *caller's*
transaction commits — Prisma has no "after commit" hook reachable from inside the transaction
callback, and the engine never owns the caller's `tx`. Added **`flushEvents(tx): void`** to the
interface: every mutating method now buffers its `stockChanged`/`lowStock` payloads keyed by the
`tx` reference itself (a `WeakMap<Prisma.TransactionClient, BufferedEvent[]>`), and the caller
invokes `flushEvents(tx)` immediately after its own `$transaction(...)` resolves. A caller whose
transaction throws never reaches that line, so the buffer is simply discarded with the `tx` object
— no phantom events on rollback. This is the exact seam the plan called for (§7.3, §8 #6); mirrors
catalog Sprint 5's precedent of refining a Sprint-1 interface once the real implementation need
became concrete.

---

## Concurrency design (the one correctness decision worth flagging explicitly)

Every mutating method starts by **locking the `Product` row** via `SELECT id FROM "Product" WHERE
id = $1 FOR UPDATE` (raw query), then re-reads the full row through the normal ORM
(`findUniqueOrThrow`) — mirroring `SequenceService.nextNumber`'s existing `FOR UPDATE` precedent in
`platform.service.ts` exactly (same problem class: a concurrently-mutated running total). A plain
read-then-literal-write (no lock) is unsafe under concurrent callers: two transactions can both
read the same pre-state, and the second one's blocked `UPDATE` would overwrite the first's commit
with values computed from stale data (a classic lost update) — this is why `FOR UPDATE` is not
optional here.

Since **every** engine method (`addLayer`, `consumeFifo`, `reserve`, `release`, `returnIn`) takes
this same lock before touching anything, and nothing else in the system ever writes a
`StockMovement`/`StockMovementConsumption` row (spec §Events: "state changes arrive only through
the injected engine"), the Product row lock is the single serialization point for **all** of that
product's inventory state — onHand, reserved, averageCost, and its FIFO layers. This let
`consumeFifo`'s layer-draining loop (`stockMovement.findMany` + per-layer `remainingQuantity`
decrement) skip a second, separate lock on the layer rows themselves: no concurrent drainer can be
racing, because it would already be queued behind the same Product-row lock.

---

## What was implemented

### `Apps/api/src/modules/inventory/inventory.service.ts`
- **`InventoryService`** (the engine) — `reserve`, `release`, `addLayer`, `consumeFifo`, `returnIn`,
  `flushEvents`, plus private `lockProduct`/`buffer`/`checkAndBufferLowStock`/`addLayerCore`/
  `reservationType` helpers.
  - `addLayer`/`returnIn` share a private `addLayerCore` (both are IN-direction writes with the
    same avgCost-recompute formula — BL#3 applies to every IN movement, RETURN_IN included, not
    just `SUPPLIER_INVOICE`/`INITIAL_STOCK`).
  - `consumeFifo` computes the full drain plan (read-only) before writing anything, so the
    over-consume rejection and an "invariant broken" defensive throw (layers can't actually supply
    `qty` — should never happen given the class's own invariants, but left as a loud failure rather
    than silently under-draining) both leave **zero rows**.
  - `reserve`/`release` derive their `MovementType` (`PENDING_ORDER`/`PENDING_REPAIR`/
    `PENDING_RELEASE`) from `ref.referenceType` rather than a redundant explicit parameter, matching
    the spec's exact signature (`reserve(tx, productId, qty, ref)` — no `type` argument).
  - `release` is idempotent: clamps to 0 rather than going negative, and — a **decision worth
    flagging** — writes **no movement row at all** when there is nothing left to release (a
    repeated release for an already-released holder is a true no-op, not a zero-effect ledger
    entry). This keeps `reserved = Σ PENDING` exact without a zero-quantity row cluttering history.
  - **`balanceAfter` on PENDING rows** (reserve/release) — a decision worth flagging since the spec
    doesn't split this out explicitly: interpreted as "current onHand" (unaffected by these calls),
    since `balanceAfter` is a single field tracking the one onHand ledger, and PENDING movements by
    definition don't change onHand.
  - **`returnIn`'s cost-group split** — a decision worth flagging: `originalConsumptions` can span
    multiple original unit costs (one prior sale can draw from two different-cost FIFO layers), so
    `returnIn` groups by unit cost and recreates **one new layer per distinct cost** — blending them
    into a single averaged-cost layer would distort every future `consumeFifo` draw from that layer,
    silently defeating the whole point of "not avgCost." Since `ReturnInResult` (Sprint 1's
    interface) carries a single `movementId`, the returned id is the **last** layer created; this is
    a known interface simplification (the caller gets confirmation, not a full list) — flagged
    rather than silently redesigning the Sprint-1 interface mid-sprint.
  - **Signed ledger convention** (derived from the schema's `quantity Int // signed` comment and
    the plan's own invariant phrasing): IN movements `+qty`, OUT movements `-qty`,
    `PENDING_ORDER`/`PENDING_REPAIR` `+qty`, `PENDING_RELEASE` `-qty`. This makes
    `onHand = Σ(IN/OUT quantity)` and `reserved = Σ(PENDING quantity)` plain sums, matching the
    spec's Test Scenarios invariants exactly.
- **`InventoryReadService`** — typed stubs only (`getStock`/`listMovements`/`listReservations`/
  `createAdjustment` each throw `"...not implemented yet (see Sprint 3)"`), constructor
  **`PrismaClient`-only for now** (catalog Sprint 3's stub precedent: start minimal, widen the
  constructor in the sprint that actually needs `ISequenceService`/`ICatalogPricingPort`).

### `Apps/api/src/modules/inventory/inventory.interface.ts`
- Added `flushEvents(tx): void` to `IInventoryService` (see refinement note above).

### Tests (`Apps/api/test/unit/modules/inventory/inventory.service.spec.ts`)
- 25 tests, written before the implementation. Given the engine's correctness hinges on state
  *evolving correctly across a sequence of calls* (not just one call's isolated output), the spec
  uses a small **stateful in-memory fake** standing in for `Prisma.TransactionClient` — plain arrays
  /objects mutated the way Postgres would (including `{increment}`/`{decrement}` semantics), rather
  than hand-chaining `mockResolvedValueOnce` per call. This is what actually exercises the spec's
  scenario faithfully: `addLayer(10@100)` → `addLayer(10@150)` → `consumeFifo(15)` really does drain
  the ledger in FIFO order and needs correct intermediate state at each step.
- Covers, verbatim from the spec's Test Scenarios: `10@100+10@150` consume `15` ⇒ COGS 1750, layer
  `5@150` remains, correct consumption rows; over-consume ⇒ 409 `INSUFFICIENT_STOCK`, zero rows
  (**and** a reservation-aware variant: onHand alone would cover it, but `onHand − reserved` doesn't);
  `reserve→release` restores available, onHand untouched; `returnIn` at the original 150, not
  avgCost (plus a multi-cost-group variant: one return spanning two original costs recreates two
  layers); `balanceAfter` chain + all three invariants (`onHand=Σmovements`,
  `Σremaining(IN)=onHand`, `reserved=ΣPENDING`) verified together over one interleaved sequence
  (addLayer → reserve → addLayer → consumeFifo → release); `ADJUSTMENT_OUT` ⇒ `profit=null`;
  `stockChanged` on every change, `lowStock` **only** on the downward threshold cross (three-step
  test: above → crosses → stays low, confirming no re-emit).
- Additional coverage beyond the sprint's list, exercising design decisions made while
  implementing: avgCost untouched by `consumeFifo`; signed quantity on OUT/PENDING_RELEASE rows;
  `PENDING_ORDER` vs `PENDING_REPAIR` derivation from `ref.referenceType`; release's true-no-op path
  (no row, no event) once already at 0; `returnIn`'s qty/`originalConsumptions` mismatch guard;
  `flushEvents` buffering semantics (nothing emitted before flush; flushing twice only emits once;
  flushing an untouched `tx` is a harmless no-op); `NotFoundError` for an unknown product.

### Bugs the tests caught before they shipped
Two of the first-draft tests (over-consume, and the reservation-aware over-consume variant) failed
on the first run — not because the engine was wrong, but because the tests themselves seeded a
product with a "phantom" starting `quantityOnHand` that had no backing FIFO layer, then added a
real layer on top via `addLayer`. The Product row's declared quantity and the fake ledger's actual
layers disagreed, so `consumeFifo` correctly detected it couldn't supply the requested quantity
from real layers. Fixed by seeding `quantityOnHand: 0` and letting `addLayer` establish the entire
balance, matching how every other scenario in the file is constructed. While in there, also
tightened the fake's `$queryRaw` mock to check the actually-queried id against the current product
(it previously ignored the argument entirely — harmless everywhere else since every other test
queries the one seeded product, but worth fixing for fidelity; it also let the dedicated
"unknown product" test drop its now-redundant manual override).

---

## Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean (required `noUncheckedIndexedAccess`-safe destructuring/guards throughout the new test file — see below) |
| `npm run lint --no-color` | ✅ clean (one `prefer-const` fix: the fake's `product` binding is only ever mutated by field, never reassigned) |
| `npm run test:unit` (271 tests / 22 files, incl. 25 new engine tests) | ✅ green |
| Engine writes movement rows **and** the `Product` columns inside the **passed `tx`** only (never opens its own) | ✅ |
| Throws `AppError` subclasses (`ConflictError` 409 for `INSUFFICIENT_STOCK`, `NotFoundError` 404 for an unknown product) | ✅ |
| Buffers events — nothing emitted before `flushEvents(tx)` is called | ✅ (explicitly tested) |
| Zero rows written on `INSUFFICIENT_STOCK` | ✅ (explicitly tested, including the reservation-aware case) |
| Inventory is the sole writer of `quantityOnHand`/`quantityReserved`/`averageCost` in this codebase so far (no other module touches these columns) | ✅ (unchanged — nothing else was touched this sprint) |

`npm run test:int` not run — no route is wired yet (first applicable in Sprint 4).

`noUncheckedIndexedAccess` note: the project's `tsconfig.json` has this on, so every array
destructure/index in the new test file (`const [x] = arr.filter(...)`, etc.) needed either a
guard-then-throw right after destructuring or was rewritten to avoid indexing — kept as explicit
`if (!x) throw new Error(...)` guards rather than non-null assertions, so a genuinely-empty result
fails with a clear message instead of a silent `undefined` property access.

---

## Notes for later sprints

- **Sprint 3** (`InventoryReadService`) will widen its constructor to `(prisma, sequence:
  ISequenceService, catalogPricing: ICatalogPricingPort)` when it implements `createAdjustment`
  (which delegates IN/OUT deltas to this sprint's engine via `addLayer`/`consumeFifo`, and calls
  `catalogPricing.applyPricing` in the same tx for the optional reprice line) — then calls
  `engine.flushEvents(tx)` after its own `$transaction` resolves, plus emits `inventory.adjusted`
  itself (not buffered by the engine, since that event belongs to the adjustment flow, not the FIFO
  engine).
- **Sprint 3**'s `listMovements` owns the per-`referenceType` join dispatch for `referenceLabel`
  that Sprint 1's mapper deferred to it (`ADJUSTMENT`→`StockAdjustment.reference`, etc.).
- No contract changes, no schema changes this sprint. `InventoryReadService`'s stub bodies are the
  only thing Sprint 3 replaces; the engine class is complete and not expected to change shape.

---

## Commit

`git add .` then `git commit -m "api: inventory sprint 2 — fifo engine"`.
