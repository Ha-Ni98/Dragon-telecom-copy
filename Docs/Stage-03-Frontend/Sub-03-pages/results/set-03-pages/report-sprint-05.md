# Set-03 — Sprint 5 Report: Wiring — Products Trio (Assembly & Wiring)

Status: ✅ Done

All three products pages (ADM-02 list, ADM-03 add, ADM-04 information) fully rewired off the
Sub-01 numeric-id stub hooks onto the real contract-typed catalog hooks. This sprint touched
contract + backend + frontend, similar in shape to Sprint 2.

## ADM-02 — Products list

`AdminProducts.tsx` rewritten to mirror `StaffProducts.tsx`'s established URL-as-state pattern
(set-02): `ProductListQuerySchema.safeParse` over `searchParams`, debounced search firing the
`STAFF_SEARCH` beacon (ADM-02 §Interactions: "admin searches are audited too"), cascading
family/brand/model filters via `useCatalogFamilies/Brands/Models(..., admin=true)`.

**Dropped, not preserved:** the Sub-01 page had a full delete-product flow and an "add stock"
dialog — neither exists in ADM-02's spec ("No stock entry here — stock arrives only via supplier
invoices or adjustments"; no delete action mentioned at all). Removed both; the only row action
now is Edit → `<Link>` to ADM-04.

**Optimistic toggles:** implemented as local page-state overrides (`optimisticOverrides` map),
not TanStack cache surgery — `useUpdateProduct` is a shared, generic mutation also used by
ADM-04's full-form save, which shouldn't inherit list-row optimistic behavior. Set on click,
cleared on the mutation's `onSuccess` or `onError` (both clear it — success lets the invalidated
real value show through, error reverts to whatever the last real fetch had).

**Client-side stock-status filter:** `ProductListQuery` has no `stockStatus` param (only a
boolean `inStock`), so the "stock status" dropdown filters the current page's already-fetched
rows by their own `stockStatus` field rather than the server — a documented compromise, not a
silent gap.

Deleted as confirmed-orphaned once the rewrite landed: `admin-products-filters-section.tsx`
(logic folded into the page), `admin-products-stats-section.tsx`, `admin-products-supply-dialog.tsx`,
and the `use-admin-products.ts` hook file itself (zero remaining consumers, codebase-wide grep
confirmed before each deletion).

## ADM-03 — Add product

**The Sub-01 version had no real submit at all** — `confirmSave` just fired two toasts and
`navigate()`'d after a 2-second `setTimeout`, no API call. Full rewrite: RHF + `zodResolver`
against Sprint 1's `products-add.schema.ts` (which already reproduces every contract refine —
family/brand XOR, `initialUnitCost` required iff qty>0, pricing forbidden iff qty=0), wired to
`useCreateProduct()` (real multipart POST). Inline taxonomy "create new" commits immediately via
`useCreateCatalogFamily/Brand/Model` and selects the new entity's id — `newFamilyName`/
`newBrandName`/`newModelName` are never actually populated by this UI (the real id always
resolves before submit); they exist on the contract command for API completeness only.

**Bug caught before shipping:** my first pass wired `AutocompleteInput`'s `onChange` to a no-op
for family/brand/model — meaning selecting an *existing* entry from the dropdown did nothing at
all (only the "create new" path worked). Fixed: `onChange` now looks up the incoming value
against the fetched list and only commits it as the real id when it matches a genuine entity
(typed free text that doesn't match anything is correctly ignored, since it's not yet a valid id).

**`use-product-name-generation.ts` deleted, not wired**, despite the sprint task saying to wire
it. Reading it showed a `setTimeout(..., 300)` "simulate API delay" plus toast notifications —
entirely fake scaffolding around what's just `family + " " + brand + " " + model` string
concatenation. Wiring a fake-latency stub into a real form would be actively worse than not
using it; inlined the equivalent real (synchronous, hookless) logic directly, gated by a
`nameManuallyEdited` flag so auto-fill stops once the user edits the name themselves.

Confirmed-dead files deleted alongside this rewrite (verified zero references anywhere in
`src/` or `tests/` before removing): `pricing-summary.tsx`, `product-name-generator.tsx`. Two
other files that *looked* related (`product-hierarchy-section.tsx`, `model-dialog.tsx`) were
checked and kept — they're genuinely used by `AdminSettings.tsx`, unrelated to this page.

## ADM-04 — Product information

Rewritten around a new `use-edit-mode.ts` hook that owns two independent RHF instances (details,
pricing — "Save patches core + pricing separately," ADM-04 §Forms) behind one Edit/Save/Cancel
header, matching the spec's "edit-mode section pattern (one header ... spanning all cards)".
Images act immediately via their own mutations, not gated by edit mode (an upload/reorder commits
on its own, it was never going to wait for a form submit).

**A second contract gap found and fixed, same shape as A1:** building the images card revealed
`AdminProductDto` had **no `images` field at all** — only the public `ProductWithPricingResponseSchema`
carried it, even though the backend's `PRODUCT_INCLUDE` already fetches that relation for every
admin query. Fixed identically to A1: added `images: z.array(ProductImageResponseSchema)` to
`AdminProductResponseSchema`, then one line in `CatalogMapper.toAdminProductDto` to map it
(`product.images` was already on hand from the existing include — no new backend query needed).
Flagging this distinctly from the original A1–A4 list since it wasn't part of Sprint 2's
resolve-first set — it surfaced mid-Sprint-5, while actually building the images UI.

**Known gap, not fixed (out of authorized scope):** there is no `DELETE
/admin/products/:id/images` endpoint — only `POST` (add) and `PATCH` (reorder/metadata). The
images card can add and drag-to-reorder (reordering to front = new primary, mirroring the
backend's own "first file = primary" convention from `createProduct`) but cannot remove an
already-uploaded image. Documented in the component's own header comment rather than silently
built as a no-op button or silently patched with an unauthorized new endpoint.

**Movements/Supply/Sales history tabs** — all three wired with zero new endpoints, exactly per
Sprint 2's A4 resolution: `useMovements({ productId })`, `useProductSupplyHistory`,
`useProductSalesHistory`. Sales history retains the residual gap flagged in Sprint 2's report
(no resolved-vs-charged pair on `MovementDto`) — renders cost/profit instead, with a comment
pointing at the gap rather than fabricating data.

Confirmed-dead files deleted: `product-suppliers-table.tsx` + `add-supply-button.tsx` (superseded
by the new Supply-history tab — the old table's own "add supply" button was out-of-spec anyway,
same "no stock entry here" rule as ADM-02), `pricing-history-section.tsx` (referenced only in a
commented-out block, never actually rendered), and the stub hooks `use-admin-product-information.ts`
/ `use-product-pricing.ts` / `use-product-images.ts` / `use-product-suppliers.ts` (zero remaining
consumers, verified before deletion). Also deleted `use-brands.ts` / `use-models.ts` once ADM-03's
rewrite left them with zero consumers anywhere.

## Validation

- `tsc --noEmit` clean across **all three packages** — checked after every meaningful edit, not
  just at the end (contract + api re-checked twice, once for A1-style images fix).
- Systematic key audit: extracted all 86 `t()` calls across the 14 touched/new files, diffed
  against `translations.json` — found and added 1 real gap (`common.actions.save`). Also grepped
  for hardcoded `placeholder="..."` strings — none found this time.
- `eslint --fix` — 12 files had prettier-only formatting fixes; re-linted clean.
- **Contract:** `npm run validate` (tsc + circular-dep check + eslint + conformance tests) — all
  green, 4/4 tests.
- **API:** full `test/unit` + `test/contract` — **615/615** (no count change — the images fix
  only touched the mapper's output shape, no new test scenarios needed beyond what the existing
  `buildProduct`/mapper tests already exercise with their `images: []` default).
- **Web:** full `vitest run` — **54/54 files, 400/400 tests**, no regressions across two rounds
  of contract-shape changes (categoryPrices carried over from Sprint 2, images new this sprint) —
  each one caught and fixed the same shared `mockAdminProduct` fixture.
- Grep-verified zero `use-admin-products`/`use-admin-product-information`/`use-product-pricing`
  stub-hook references remain anywhere in `pages/` or `hooks/`.

## Carried into later sprints

- Sprint 6/7 build on the same `AdminProductDto.images`/`categoryPrices` fields now confirmed
  real end-to-end.
- The images-card DELETE gap and the Sales-history resolved-vs-charged gap remain open — flagged
  for a future sprint or explicit user sign-off on a new endpoint, not silently worked around.
