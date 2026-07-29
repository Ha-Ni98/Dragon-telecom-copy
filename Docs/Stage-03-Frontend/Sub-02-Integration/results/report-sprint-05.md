# Sprint 5 Report — Platform & Orders

**Status:** ✅ Done · **Branch:** `stage-03-sub-02-integration` · **Scope:** `/src/services`, `/src/lib`,
`/src/hooks`, `/tests` — no `/src/components` or `/src/pages` touched.

---

## What shipped

- **`src/services/platform.service.ts`** (new file) — 9 real, contract-typed functions: `listWilayas`, `getFee`,
  `getAdminFees`, `upsertFees` (PUT, confirmed against the router — not POST), `importFees` (FormData),
  `exportFees` (raw `Blob`, envelope bypassed), `getSettings`, `updateSettings`, `getPublicSettings`.
- **`src/services/orders.service.ts`** — 9 real functions appended: `placeOrder`, `listMyOrders`,
  `cancelMyOrder`, `listOrders`, `confirmOrder`, `updateOrderStatus`, `adminCancelOrder`, `returnOrder`,
  `orderStats` — all `STAFF_*`/`ADMIN_*` pairs collapsed into one function taking a `scope: "staff" | "admin"`
  parameter.
- **3 new hook files**: `src/hooks/usePlatform.ts` (9 hooks), `useOrdersPortal.ts` (3 hooks, client-facing),
  `useOrdersDirectory.ts` (6 hooks, staff/admin pipeline with cross-domain invalidation).
- **`tests/fixtures/data/platform.mock.ts`** + **`orders.mock.ts`** (new) + **`msw/platform.handlers.ts`** +
  **`msw/orders.handlers.ts`** (new, incl. a raw non-enveloped Blob handler for `exportFees`) + registered in
  `server.ts`.
- **32 new tests**: `platform.service.test.ts` (11) + `orders.service.test.ts` (13) + `platform.test.tsx` (4) +
  `orders.test.tsx` (4).
- **Retroactive fix to Sprint 3**: renamed 8 hook exports across `useCatalogTaxonomy.ts` and
  `useClientCategories.ts` that collided with pre-existing `use-admin-settings.ts` stub hook names.

## Resolved every plan.md §6 `*(confirm)*` item for this sprint by reading the real backend

`Apps/api/src/modules/platform/platform.interface.ts` + `.routes.ts` and
`Apps/api/src/modules/orders/orders.interface.ts` + `.routes.ts` settled everything directly:
- `upsertFees` is **PUT**, not POST.
- `importFees`'s result (`{ imported: number }`) and orders' admin-cancel body (`{ reason?: string }`) are
  **not exported from the contract** — both are backend-internal types (`platform.interface.ts`,
  `orders.interface.ts`). Declared locally in the frontend services, matching exactly.
- `MY_CANCEL` takes **no command body** — only validates `OrderIdParamsSchema`.
- `exportFees` **deliberately bypasses the envelope** (raw `Content-Type`/`Content-Disposition` response,
  confirmed by an explicit backend comment: "plan §8.4").
- Orders' `STATS` routes have **no route-ordering risk** (unlike catalog/clients' `*_STATS`) — every STATS
  route is GET while its same-prefix siblings are POST/PATCH, so no `:id`-pattern can steal the request.

## Found and fixed a naming collision from Sprint 3 (retroactive)

Before writing any Sprint 5 code, checking `use-admin-settings.ts` (a Sub-01 stub file never inspected in
Sprint 3) revealed it independently implements brand/family/model/category CRUD **and** delivery-fee
import/export — for `AdminProductsAdd.tsx`'s hierarchy UI and `delivery-fees-section.tsx`. 8 of Sprint 3's hook
exports (`useCreateBrand`, `useUpdateBrand`, `useCreateFamily`, `useUpdateFamily`, `useCreateModel`,
`useUpdateModel`, `useClientCategories`, `useCreateClientCategory`, `useUpdateClientCategory`) collided with
this file's own exports. Different files never collide at compile time (confirmed — `tsc` stayed clean the
whole time), but identical names across two hook files is genuinely confusing for Sub-03. Renamed to
`useCreateCatalogBrand`/`useUpdateCatalogBrand`/etc. and `useCatalogClientCategories`/
`useCreateCatalogClientCategory`/`useUpdateCatalogClientCategory` — zero risk, since these files (committed in
Sprint 3) have no consumers yet outside their own tests, which were updated in the same pass. This sprint's new
`usePlatform.ts` hooks were named with the same collision-avoidance in mind from the start
(`useAdminDeliveryFees` not `useDeliveryFees`, etc.).

## Found and fixed a real invalidation bug

`usePlaceOrder`'s mutation invalidated `qk.orders.mine()` (called with no arguments → key
`["orders","mine",undefined]`), but `useMyOrders()` defaults its query parameter to `{}` → key
`["orders","mine",{}]`. TanStack's prefix matching requires each key segment to match exactly, and
`undefined !== {}`, so the invalidation silently never touched the mounted query — caught by a failing test
(`expected 1 to be 2`), not by inspection. The deeper issue: `qk.orders.mine(query)` always appends a third key
element, so it can never serve as a true prefix for an arbitrary filter object — the same class of bug Sprint 3
fixed for `catalog.brands`/`families`/`models`. Fixed by switching `usePlaceOrder`/`useCancelMyOrder` to
invalidate `qk.orders.all()` instead — broader (also sweeps admin/stats) but correct, and already the proven
pattern `useOrdersDirectory.ts`'s mutations use.

## Validation

```
npm run check
```
Clean, whole project, zero errors.

```
npx vitest run
```
**19/19 files, 174/174 tests passing** (up from 142/142 at Sprint 4 close — 32 new).

Two environment quirks worked around in tests (documented inline, not real bugs): cross-realm `instanceof File`
in Sprint 3 has a Blob analogue here — `Blob.text()`/`new Response(blob).text()` are unreliable across this
environment's Node/jsdom Blob realms, so the `exportFees` test asserts `instanceof Blob` + `size > 0` instead of
reading content.

Lint: fully-new files and files with no pre-existing content (renamed-only) were auto-fixed directly.
`orders.service.ts` (mixed old stub + new real section) was reconstructed from the original committed stub +
the fixed new section, same technique as Sprints 3–4 — confirmed via `eslint` that only the 2 pre-existing debt
lines remain flagged.

## Commit

`fe: integration sprint 5 — Platform & Orders` on `stage-03-sub-02-integration`.

## Handoff to Sprint 6 (Inventory & Purchasing)

- Check `use-admin-settings.ts` (and any other Sub-01 "admin settings"-style catch-all stub files) for hook-name
  collisions before naming new hooks — it's a broader surface than the per-domain stub files checked so far.
- Any invalidation using a `qk.<domain>.<family>(query)`-shaped key (one that always appends a positional
  argument) should sweep via the broader `.all()` prefix instead, not the same-shaped key called bare — verify
  with a real "does the mounted query refetch" test, not just "does it compile."
