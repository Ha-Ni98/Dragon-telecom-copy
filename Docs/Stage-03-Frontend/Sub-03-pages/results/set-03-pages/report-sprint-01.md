# Set-03 — Sprint 1 Report: Schemas & i18n (Foundation)

Status: ✅ Done

## What shipped

### Zod schemas (15 files, all RHF-ready, all contract-aligned)

| File | Contract Command wrapped | Notes |
|---|---|---|
| `pages/staff/pos/confirm-sale.schema.ts` | `ConfirmSaleCommand` | translated `min(0)` message |
| `pages/staff/pos/quick-add-pos-client.schema.ts` | `CreatePosClientCommand` | translated `name` required |
| `pages/staff/orders/confirm-order.schema.ts` | `ConfirmOrderCommand` | shared staff/admin |
| `pages/staff/orders/order-status.schema.ts` | `UpdateOrderStatusCommand` | + page-local refine: deliveryCompany/trackingNumber required iff `status === IN_DELIVERY` |
| `pages/admin/orders/components/return-order.schema.ts` | `ReturnOrderCommand` | factory takes `maxQuantity` (ordered qty, known client-side) |
| `pages/admin/orders/components/cancel-order.schema.ts` | `AdminCancelOrderCommand` (service-local, not contract) | reason optional |
| `pages/admin/sales/components/create-return.schema.ts` | `CreateReturnCommand` | factory takes `lineBounds: Record<saleLineId, maxQty>`, enforced via `superRefine`; contract's `ReturnType` aliased `SaleReturnType` to avoid shadowing TS's built-in `ReturnType<T>` |
| `pages/staff/invoices/record-client-payment.schema.ts` | `CreateClientPaymentCommand` | shared staff/admin |
| `pages/admin/invoices/components/record-supplier-payment.schema.ts` | `CreateSupplierPaymentCommand` | admin-only |
| `pages/staff/repairs/intake-repair.schema.ts` | `CreateRepairCommand` | + page-local refine: `reportedIssueOther` required iff `reportedIssues` includes `OTHER` |
| `pages/staff/repairs/add-repair-part.schema.ts` | `AddRepairPartCommand` | factory takes optional `maxQuantity` |
| `pages/staff/repairs/repair-status.schema.ts` | `RepairStatusCommand` | + page-local `technicianId` field (not on the contract command — submitted via a separate `useUpdateRepair` call before the status PATCH) with 3 refines: technician required for PROCESSING, paidAmount required for PICKED_UP, consumedPartReturns required per consumed part for post-consumption CANCELLED (factory takes `consumedPartIds`) |
| `pages/admin/products/products-add.schema.ts` | `CreateProductCommand` | reproduces all 5 contract refines with translated messages |
| `pages/admin/products/product-details.schema.ts` | `UpdateProductCommand` | product-core fields only, per contract's Business Logic #6 |
| `pages/admin/products/product-pricing.schema.ts` | `UpdatePricingCommand` | reads `AdminProductDto.categoryPrices` once A1 lands (Sprint 2) |

Every file follows the established codebase convention (`login.schema.ts`, `register.schema.ts`,
`order.schema.ts`): a factory `xSchema(t, ...params)` returning the `z.object`, an exported
`FormValues` type, and a compile-time `AssertAssignable<FormValues extends Command>` guard so a
future contract rename fails the build here instead of silently drifting.

**Deliberate deviation from the sprint task list:** `SaleDraftCommand` got **no** wrapper schema.
STF-02 describes the draft as "built incrementally; PATCH on change" — it's UI state serialized
into PATCH bodies as the ticket changes, not a single validated RHF submit. The plan's own
`use[Name]` hook mapping (`useUpdateDraft`) confirms this — there's no "submit the draft" moment
to gate with `zodResolver`. The type is used directly from `@dragon-telecom/contract` at the call
site in Sprint 6/7 wiring.

### i18n (`config/translations.json`)

Added 339 new keys (344 authored, 5 dropped as exact duplicates of pre-existing
`admin.productInfo.{edit,save,cancel,notFound,error}` keys — reused instead per the reuse-first
rule). Covers, per page: page title, stat cards, table columns, tabs, dialog titles/fields/buttons,
empty/error states, and every message referenced by the 15 schema files above. `en`/`fr` are real
copy; `ar` is `""` on every key (verified programmatically — zero exceptions).

## Validation

- `tsc --noEmit` (web) — clean, including all 15 `AssertAssignable` compile-time guards.
- `npx eslint --fix` on the new files — 3 files had prettier-only formatting fixes (multi-line
  chained calls); re-linted clean after fix.
- `vitest run` — 51 files / 393 tests, all still green (no regressions; this sprint added no test
  files, as Sprint 1 is schemas/i18n only, per the phase's inside-out ordering).
- `translations.json` re-parsed as valid JSON post-merge; 0 key collisions left unresolved, 0
  malformed entries (missing `en`/`fr`, or `ar !== ""`).
- No inline strings introduced (all schemas source messages via `t(...)`); no `useEffect` fetching
  (no components built yet); no test files added under `/src`.

## Carried into Sprint 2

- Schemas already assume `AdminProductDto.categoryPrices` (A1) and `useRepair(scope, id)` (B1) —
  both land in Sprint 2, so Sprint 3+ primitives can consume real types immediately.
- `order-status.schema.ts` and `intake-repair.schema.ts` each added one refine beyond their
  contract command — flagged above for the Sprint 3/4 component authors so the dialogs surface
  those messages on the right field.
