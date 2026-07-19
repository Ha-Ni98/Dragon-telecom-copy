# Sales+Billing — Sprint 4 Report: Sales — API (controller, routes, wiring, integration)

**Status:** ✅ Done — [`sprints-sale-bill-06.md`](../sprints-sale-bill-06.md) Sprint 4 marked ✅.

---

## What was implemented

### `Apps/api/src/modules/sales/sales.controller.ts`
Thin, arrow-method fields, `try/catch → next`, reads `req.validated`, responds via `sendSuccess`.
`createDraft` → `201`; `updateDraft`/`confirm`/`listStaffSales`/`listAdminSales`/`getSale`/
`createReturn` → `200` (matches the sprint doc's own literal status-code grouping — `RETURN` is
`200`, not `201`, even though it creates a new `Return` row, since the sprint task explicitly
grouped it with the reads/updates). `getSale` serves **both** `STAFF_DETAIL` and `ADMIN_DETAIL` —
the owner-or-admin guard and margin-gating both live in the service, keyed off the same
`req.user` actor either way.

### `Apps/api/src/modules/sales/sales.routes.ts`
Composition root: `new SalesService(prisma, sequenceService, inventoryService,
catalogProductService)` — `catalogProductService` (unchanged this sprint, already exported from
`catalog.routes.ts`) satisfies `ICatalogPosPricingPort` structurally (its `resolvePosPrices`
method, Sprint 1) — confirmed by a clean `tsc`, no adapter needed, same direct-sibling-import shape
purchasing established. Guards per plan §I.2/§D-1, mirroring catalog's `staffProductsOrAdmin`
precedent (`types` always paired explicitly with `pages`, not left implicit):

| Route | Guard |
|---|---|
| `CREATE_DRAFT`/`UPDATE_DRAFT`/`CONFIRM` | `types:[STAFF,ADMIN], pages:[STAFF_POS], checkDB:true` |
| `STAFF_LIST` | `types:[STAFF,ADMIN], pages:[STAFF_SALES], checkDB:true` |
| `STAFF_DETAIL` | `types:[STAFF,ADMIN], checkDB:true` (no page — owner-or-admin lives in the service) |
| `ADMIN_LIST`/`ADMIN_DETAIL`/`RETURN` | `types:[ADMIN], checkDB:true` |

No route-ordering conflicts to resolve (unlike purchasing's `SUPPLIER_STATS`-before-`:id`) —
every `SALE_ROUTES` path is either a distinct segment count or a distinct HTTP method from every
other, so Express dispatches unambiguously without a literal-before-`:param` ordering trick.

### Wiring (`Apps/api/src/modules/index.ts`)
Direct import of `salesRouter`, mounted at the extension point after `purchasingRouter`. No
aggregator adapter — same one-directional shape as purchasing.

---

## Genuine gap found during integration testing: `SaleDto` never exposes `SaleLine.id`

`SaleResponseSchema.lines[]` (frozen contract) has no `id` field at all — only `productId`,
`productName`, `quantity`, `resolvedPrice`, `unitPrice`, optional `costOfGoods`/`profit`,
`lineTotal`, optional `serialNumbers`. But `CreateReturnCommand.lines[].saleLineId` **requires**
the real internal `SaleLine` UUID to identify which line is being returned. There is currently
**no way for a real frontend to discover a `saleLineId` from any documented API response** — the
integration test below can only supply one because it queries `prisma.saleLine` directly (a
test-only expedient, not something a browser client could do).

This wasn't caught during planning (the plan's Test Scenarios only cover "restock vs not", not
how the return UI would obtain line identity) and doesn't block this sprint's own correctness —
`createReturn`'s logic is sound given a valid `saleLineId`, which is all Sprint 3's unit tests and
this sprint's integration test exercise. **Flagged as a follow-up for whoever builds the admin
returns screen:** either add an `id` field to `SaleResponseSchema.lines[]` (the direct fix) or
have the return UI resolve lines some other way. Not fixed here — it's a contract change, out of
scope for "sales API — controller/routes/wiring/integration."

---

## `npm run test:int` — actually run this sprint (real Postgres reachable in this environment)

Contrary to prior sprints' note ("test:int could not be executed — no Docker/Postgres access"),
**this environment has a real Postgres reachable** at the `TEST_DATABASE_URL` in `.env`
(`127.0.0.1:5544`) — `test/setup.ts`'s hardcoded fallback (`localhost:5433`) is only used when
`TEST_DATABASE_URL` isn't already exported into the shell running vitest; exporting the `.env`
values first makes the real integration suite reachable. **This correction is noted for future
sprints and for memory** — don't assume `test:int` is unrunnable without checking first.

Wrote and ran `test/integration/sales.integration.spec.ts` (7 tests, genuinely green against the
real test DB, not skipped):
- **draft → confirm end-to-end**: seeds a product with a real FIFO layer (via
  `inventoryService.addLayer` inside a `$transaction` — seeding only `Product.quantityOnHand`
  directly, as `seedProduct` does by default, would leave no backing `StockMovement` IN layer and
  `consumeFifo` would 409 regardless of the cached number); POST draft (`201`) → POST confirm
  (`200`, parses as `ReceiptDto`, `total`/`totalPaid`/`newCredit` correct) → asserts real
  `Product.quantityOnHand` dropped (10→8) and `eventBus.emit('sale.confirmed', …)` was called
  (via `vi.spyOn`, mirroring catalog's own `product.repriced` assertion pattern).
- **stock exhaustion**: confirming a draft requesting more than the seeded layer → `409`, sale row
  stays `DRAFT` in the DB.
- **underpayment gate**: confirming with `paidAmount` below `totalAmount` and no linked `PosClient`
  → `400`.
- **ownership**: staff B reading staff A's sale by reference → `403` both while `DRAFT` and after
  confirm; admin reads it fine. **One test bug fixed along the way, not a service bug:** `confirm`
  reassigns `reference` (the `DRAFT-xxx` placeholder → the real `SAL-YYYY-NNNN`), so a post-confirm
  lookup by the pre-confirm reference correctly 404s, not 403 — the test now re-reads
  `confirmRes.body.data.reference` (the `ReceiptDto`'s own field) for the post-confirm assertions.
- **`STAFF_LIST` scoping**: staff B's own list never contains staff A's sale.
- **`RETURN`**: a `STAFF` token (even holding both `STAFF_POS`/`STAFF_SALES`) → `403` (admin-only,
  no page bypasses it); a `restock:true` return on a real confirmed sale restores real stock
  (`quantityOnHand` 7→9) via a genuine `RETURN_IN` `StockMovement` row (queried directly to
  confirm the injected engine, not a stub, actually ran).

**Full `test:int` run (all 10 integration spec files, 100 tests):** 98 passed, **2 pre-existing
failures in `purchasing.integration.spec.ts`'s own concurrency block** (`two parallel payments …`,
`two parallel confirms …`) — reproduced identically running that file alone, **before and
independent of any sales/billing change**; unrelated to this sprint.

---

## Validation

| Check | Result |
|---|---|
| `Apps/api`: `npx tsc --noEmit` | ✅ clean |
| `Apps/api`: `npm run test:unit` (`test/unit` + `test/contract`) | ✅ 448/448 (31 files) |
| `Apps/api`: `npm run test:int` | ✅ 98/100 (10 files) — 2 pre-existing, unrelated purchasing concurrency failures (see above) |
| `Apps/api`: `npm run lint` | ✅ clean |
| Routes use `SALE_ROUTES` constants only; every response goes through `sendSuccess`; mapper excludes margins when gated (staff `getSale`/`listStaffSales` never carry `costOfGoods`/`profit`/`totalCost`/`totalProfit`) | ✅ |
| `test/contract/routes.conformance.spec.ts` extended with a `sales route resolution` block — every `SALE_ROUTES` path resolves (not a raw 404) unauthenticated, DB-free | ✅ (10/10 conformance tests) |

---

## Notes for later sprints

- **Sprint 5-7** (billing): billing's `issueFromSale` listener now has real `Sale`/`SaleLine` rows
  to read (confirm actually populates `costOfGoods`/`profit`/`resolvedPrice`, not just planned).
- **Flagged, not fixed:** `SaleResponseSchema.lines[]` has no `id` — a real admin returns UI cannot
  discover a `saleLineId` from the API today. Worth a contract addition before that UI is built.
- Memory correction: this environment **does** have a reachable test Postgres (export `.env`'s
  `TEST_DATABASE_URL`/`DATABASE_URL` before running `test:int` — the npm script itself doesn't
  load `.env`, unlike `dev`). Future sprints should verify DB reachability before assuming
  `test:int` can't run.

---

## Commit

`git add .` then `git commit -m "sales: sprint 4 — api and wiring"`.
