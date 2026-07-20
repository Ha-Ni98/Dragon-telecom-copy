# Sprint 6 Report — Inventory & Purchasing

**Status:** ✅ Done · **Branch:** `stage-03-sub-02-integration` · **Scope:** `/src/services`, `/src/hooks`,
`/tests` — no `/src/components` or `/src/pages` touched.

---

## What shipped

- **`src/services/inventory.service.ts`** (new file) — 4 real functions: `getStock`, `exportStockCsv` (the
  backend's dual-return `StockRowDto[] | ExportResult` split into two frontend functions — a query hook can
  only have one result type), `listMovements`, `listReservations`, `createAdjustment`.
- **`src/services/purchasing.service.ts`** (new file) — 13 real functions across suppliers, supplier invoices,
  and payments.
- **4 new hook files**: `useInventory.ts` (5 hooks), `usePurchasingSuppliers.ts` (5),
  `usePurchasingInvoices.ts` (6), `usePurchasingPayments.ts` (2) — every purchasing hook prefixed
  `usePurchasingX` to avoid the 15 pre-existing exports across `use-admin-suppliers.ts`/
  `use-supplier-information.ts`.
- **`tests/fixtures/data/inventory.mock.ts`** + **`purchasing.mock.ts`** (new) + **`msw/inventory.handlers.ts`**
  + **`msw/purchasing.handlers.ts`** (new) + registered in `server.ts`.
- **32 new tests**: `inventory.service.test.ts` (7) + `purchasing.service.test.ts` (16) +
  `inventory.test.tsx` (4) + `purchasing.test.tsx` (5).

## Both domains were genuinely new territory — no stub-collision consumer check needed for inventory

Inventory has no MVP UI ported yet, so `inventory.service.ts` had zero pre-existing consumers to check.
Purchasing's pre-existing stubs are class-based (`AdminSuppliersService`) rather than the free-function pattern
`catalog.service.ts`/`clients.service.ts`/`orders.service.ts` use, so there was never a same-named file to
append to — `purchasing.service.ts` is a clean new file, same pattern as Sprint 5's `platform.service.ts`. Still
ran the full collision check (including `use-admin-settings.ts`, per Sprint 5's lesson) before writing any hook
names — zero hits.

## Resolved every open plan.md §6 item by reading the real backend

`Apps/api/src/modules/inventory/inventory.interface.ts` + `.controller.ts` and
`Apps/api/src/modules/purchasing/purchasing.interface.ts` + `.controller.ts` confirmed:
- `confirmSupplierInvoice` takes **no command body** — the router validates only
  `SupplierInvoiceIdParamsSchema`; `staffId` is injected server-side from the auth token.
- `getStock`'s CSV branch, like platform's `exportFees`, **bypasses the envelope entirely** (raw
  `Content-Type`/`Content-Disposition`, checked via `'body' in result` in the controller).
- `PURCHASING_ROUTES.SUPPLIER_BY_ID` and `SUPPLIER_DETAIL` are **the same literal path**
  (`/admin/suppliers/:id`), split into two route constants purely for router-file readability (GET uses
  `SUPPLIER_DETAIL`, PATCH uses `SUPPLIER_BY_ID`) — both produce an identical URL string.
- `SUPPLIER_STATS` must be registered before `SUPPLIER_DETAIL`/`SUPPLIER_BY_ID` in any handler array — same
  `:id`-pattern greedy-match risk Sprints 3–4 found for `PRODUCT_STATS`/`ADMIN_STATS`, confirmed present here
  too and built into `purchasing.handlers.ts` from the start (not discovered via a failing test this time).

## Caught the Sprint-5 invalidation-key bug class by inspection, not by a failing test

Before writing `useCreatePurchasingPayment`, checked the `qk` registry directly: `purchasing.payments` has no
`.all()` sibling (`{ list: (query?) => [...] }` only) — the exact shape Sprint 5 found broken for
`qk.orders.mine()`. Fixed proactively by invalidating the broader `qk.purchasing.all()` instead of a bare
`qk.purchasing.payments.list()` call. This is now a standing check for every remaining sprint: any
`qk.<domain>.<family>(query)`-shaped key with no `.all()` sibling needs the broader prefix, not a bare call.

## Two test-authoring lessons (not code bugs)

Writing the payments hook test surfaced two related pitfalls, now documented inline in the test file:
1. Pre-seeding the *exact* cache key a hook under test reads from (intending it as a "before" marker) instead
   makes `isSuccess` trivially true from the seed data, before the real network fetch ever resolves.
2. `queryClient.getQueryState(key)?.isInvalidated` is a **transient** flag — it clears the instant an
   actively-mounted query's automatic refetch resolves. It's a valid assertion only when nothing is actively
   watching the invalidated key (the cross-domain tests, e.g. `useConfirmPurchasingInvoice`, where
   inventory/catalog have no mounted observer in that specific test). When the read hook **is** mounted, a
   handler-call-count assertion (already the established pattern for catalog/orders' create-mutation tests) is
   the correct, non-racy signal.

## Validation

```
npm run check
```
Clean, whole project, zero errors.

```
npx vitest run
```
**23/23 files, 206/206 tests passing** (up from 174/174 at Sprint 5 close — 32 new).

Lint: fully clean directly — both service files are entirely new, no old-stub section to reconstruct around
this time (unlike Sprints 3–5's mixed old/new files).

## Commit

`fe: integration sprint 6 — inventory & purchasing` on `stage-03-sub-02-integration`.

## Handoff to Sprint 7 (Statistics & Observability)

- Both domains this sprint are read-heavy/admin-dashboard-adjacent — Sprint 7's statistics domain is entirely
  read-only (no command file at all per the contract), so no invalidation-key or FormData concerns should arise
  there; observability has beacons (202+null) worth double-checking against the corrected 204/202 envelope rule
  from Sprint 4.
- Before writing any new `qk.<domain>.<family>` mutation invalidation, check whether the family has a real
  `.all()` sibling first — cheaper than discovering it via a failing test.
