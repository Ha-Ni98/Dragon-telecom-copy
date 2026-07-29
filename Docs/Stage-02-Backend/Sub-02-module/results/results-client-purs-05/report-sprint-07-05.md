# Clients+Purchasing — Sprint 7 Report: Purchasing — API (controller, routes, wiring, integration)

**Status:** ✅ Done — [`sprints-client-purs-05.md`](../sprints-client-purs-05.md) Sprint 7 marked ✅.

This completes the `purchasing` module (all 3 sprints) and **the full clients+purchasing set
(all 7 sprints)**.

---

## What was implemented

### `Apps/api/src/modules/purchasing/purchasing.controller.ts`
Thin — every method `try/catch → next(error)`, reads `req.validated.{body,query,params}`,
responds via `sendSuccess`. Status codes: `201` for `createSupplier`/`createInvoice`/
`createPayment`, `200` for everything else (including `confirmInvoice`/`cancelInvoice` — state
transitions on an existing resource). `createInvoice`/`confirmInvoice`/`cancelInvoice`/
`createPayment` read `req.user!.staffId!` (always set for admin — identity's own invariant).

### `Apps/api/src/modules/purchasing/purchasing.routes.ts`
Composition root: `new PurchasingService(prisma, sequenceService, inventoryService, catalogProductService)`,
`new PurchasingController(service)`, `new PurchasingListener(service).setup()`. Every route
`requireAuth({types:[ADMIN], checkDB:true})`, `PURCHASING_ROUTES` constants only, per-segment
`validateRequest`. `SUPPLIER_STATS` registered before `SUPPLIER_DETAIL`/`SUPPLIER_BY_ID` so
`/stats` is never captured as `:id` (same hazard `CLIENT_ROUTES.ADMIN_STATS` had in Sprint 4).

Followed Sprint 4's direct-sibling-import precedent again: `sequenceService`
(`../platform/platform.routes`), `inventoryService` (`../inventory/inventory.routes`), and
`catalogProductService` (`../catalog/catalog.routes`, satisfying `ICatalogRepricePort`) are all
imported directly — no adapter object, confirmed by a clean `tsc --noEmit` with zero casts (the
real methods' signatures match the consumer-declared port interfaces exactly, exactly as
Sprint 5/6 designed them to).

### `Apps/api/src/modules/index.ts`
Added `import { router as purchasingRouter } from './purchasing/purchasing.routes';` and
`apiRouter.use(purchasingRouter);` — no adapter needed, same as clients' Sprint 4 wiring.

### Tests

**`test/contract/routes.conformance.spec.ts`** — added a DB-free "purchasing route resolution"
block mirroring inventory's pattern exactly (every `PURCHASING_ROUTES` path is admin-guarded, no
public routes at all, so `requireAuth`'s missing-token check short-circuits before any Prisma
call on every single route — no exclusions needed, unlike clients' public
`VALIDATE_PHONE`/`REGISTER`).

**`test/integration/purchasing.integration.spec.ts`** (new, 10 tests) — real Postgres, real
`ApiResponse` envelope, real `app`/`registerModules` wiring:
- supplier CRUD: create with `initialCredit` → list → detail aggregate (empty
  invoices/payments for a brand-new supplier) → `isEnabled` toggle → stats.
- **full invoice lifecycle** against a real seeded product: DRAFT create (asserts
  `projectedNewAverageCost` is present on the DRAFT read) → confirm (asserts the real
  `StockMovement` row, the `Product.quantityOnHand` delta, the `Supplier.credit` snapshot, and
  `ConfirmResultDto.repriceCandidates`) → **double-confirm no-op** (same reference, still exactly
  one movement) → payment against that invoice's real reference (snapshot math) → payment list
  filtered by `supplierId`.
- `PATCH` after confirm → `409`.
- `amountOnly` + `lines` together → `400` (the schema's own refine, proven end-to-end through
  the real route).
- cancel: reverses credit only for a previously-confirmed invoice; cancelling a DRAFT invoice
  leaves credit untouched (proves Sprint 6's `wasConfirmed` guard for real, not just against
  mocked Prisma).
- **concurrency**: two parallel `POST /supplier-payments` on the same supplier — asserts the two
  `previousCredit`/`newCredit` snapshots chain without overlap (the `FOR UPDATE` lock's actual
  serialization effect, not just "both succeeded") and the final `credit`/`totalPaid` match the
  combined result; two parallel confirms of the *same* invoice — exactly one `StockMovement` set
  and the credit reflects a single application, not double.
- **property test**: `Supplier.credit == opening + Σ confirmed invoices − Σ payments` (spec
  BL#6) across a real mix of two confirmed invoices and two payments — the one property test
  this module's real ledger tables (unlike clients' `PosClient`, which has no writer module yet)
  make fully honest to write, since purchasing owns every side of its own ledger already.

---

## Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run test:unit` (`test/unit` + `test/contract`) | ✅ 399/399 (28 files) |
| `npm run lint` | ✅ clean |
| Routes use contract constants only; responses via `sendSuccess`; mapper excludes sensitive fields | ✅ |
| **`npm run test:int`** | ⚠️ **could not be executed in this environment** — same limitation as Sprint 4 |

### `test:int` — same environment limitation as Sprint 4, re-confirmed

Re-attempted starting the disposable test Postgres (`docker compose -f docker-compose.test.yml
up -d`, sandbox restriction lifted for the one command) — identical `permission denied
while trying to connect to the Docker daemon socket`. This is the same host-level Docker-group
gap documented in Sprint 4's report, not something that changed. I did not re-run the "is this
environment-wide" cross-check (already proven in Sprint 4 against 7 other pre-existing spec
files); the same conclusion applies here unchanged. **Please run `npm run test:int` yourself**
(real Postgres reachable at `TEST_DATABASE_URL`) to get the real signal on
`purchasing.integration.spec.ts`, in particular the two concurrency tests (parallel payments,
parallel confirms) — these depend on genuine Postgres row-locking behavior
(`SELECT ... FOR UPDATE`) that no mock can substitute for, so they are the highest-value tests
in this file to see actually run.

What I did verify instead: `tsc --noEmit` compiles the new integration spec cleanly (catches
signature mismatches against the real `IPurchasingService`/DTOs/factories), `eslint` passes, and
every route path/HTTP verb was cross-checked character-for-character against
`PURCHASING_ROUTES`.

---

## Set-05 completion summary

All 7 sprints done. 12 module files created (6 `clients` + 6 `purchasing`), both routers mounted
in `modules/index.ts` with zero cross-module adapter shims (`clients`→identity/catalog,
`purchasing`→inventory/catalog/platform, all satisfied structurally by direct sibling imports).
399 unit/conformance tests green throughout; two integration spec files written (25 tests
combined) that compile and lint cleanly but could not be executed against a real database in
this sandbox (Docker access unavailable) — flagged plainly in both Sprint 4's and this report
rather than claimed as verified.

Deviations from the original plan, all documented in their sprint's report as they were
discovered: `PosClientListQuerySchema`/`ClientStatsDto`/`ValidatePhoneSchema`/`UpdateMeSchema.strict()`
added to the contract; `identity.provisionClientUser` dropped its unused `clientId` param;
no activity-read port (observability already owns `/activity`); aggregate-cache idempotency
simplified from "recompute-from-ledger" to literal one-shot snapshot/increment application
(both `clients` and `purchasing`); direct sibling-module imports instead of aggregator adapters
for both modules' cross-module ports; `Supplier.lastDeliveryAt` derived rather than
schema-migrated; a DRAFT-invoice placeholder `reference` before confirm's real sequence
allocation; cancel's `wasConfirmed` guard preventing a wrongful credit reversal on a DRAFT
cancel.

---

## Commit

`git add .` then `git commit -m "purchasing: sprint 7 — api and wiring"`.
