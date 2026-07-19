# Sales+Billing — Sprint 2 Report: Sales — Foundation (mapper, interface, factories)

**Status:** ✅ Done — [`sprints-sale-bill-06.md`](../sprints-sale-bill-06.md) Sprint 2 marked ✅.

---

## What was implemented

### `Apps/api/src/modules/sales/sales.mapper.ts`
Pure/static `SalesMapper`, field-listing (never spreads), each method ends `.parse()` against its
contract schema (rules §4/§6):
- **`toSaleDto(sale: SaleRow, ctx: { includeMargins: boolean })`** — margin-gated: `totalCost`/
  `totalProfit` (document) and `costOfGoods`/`profit` (per line) are included only when
  `includeMargins`. Surfaces both `resolvedPrice` and `unitPrice` unconditionally (a price
  override is just `unitPrice ≠ resolvedPrice`, measurable, per spec BL#4). `soldAt` is ISO or
  omitted entirely for a still-DRAFT row. Prisma `SaleOrigin`/`SaleStatus` cast to the contract's
  same-named-but-nominally-distinct enums (same pattern as purchasing's `SupplierInvoiceStatus`
  cast).
- **`toReceiptDto(sale: SaleRow)`** — customer-facing only; no cost/profit field exists on this
  schema at all (not gated, structurally absent). `grandTotal` isn't a stored column — derived as
  `total + previousCredit` (verified against spec BL#2's own credit formula: `newCredit =
  previousCredit + (totalAmount − paidAmount)` ⇒ `newCredit = grandTotal − totalPaid`, so the two
  formulas agree).
- **`toPersistenceDraft(cmd: SaleDraftCommand, ctx: DraftMapContext)`** — DRAFT create-input;
  `resolvedPrice` fixed at `0` (unresolved until confirm), `lineTotal` is a preview
  (`unitPrice × quantity`, fully recomputed at confirm). `ctx.productNames` is supplied
  pre-resolved by the service (a DB read) — same "never rebuilt here" precedent as purchasing's
  `toConfirmResultDto` and clients' `toCartItemDto`.

**One necessary addition to `DraftMapContext` beyond the plan's literal `{ staffId;
productNames }`:** a `reference: string` placeholder. `Sale.reference` is `@unique` with **no**
`@default` in the schema — the create-input cannot omit it. Purchasing hit the identical gap for
`SupplierInvoice.reference` and solved it with a service-level `draftReference()` helper applied
directly in the service's `prisma.create()` call (not through a mapper method, since purchasing's
mapper has no persistence-input builder at all). Sales' plan explicitly wants a mapper-level
`toPersistenceDraft`, so the placeholder is threaded through `ctx` instead — Sprint 3's service
will generate it the same random-placeholder way and pass it in, keeping the mapper pure (no ID
generation inside it).

**Second, self-contained addition:** `SaleLine.serialNumbers` is a free-text Prisma `String?`
column, but the contract's `SaleDto`/`ReceiptDto`/`SaleDraftCommand` all model it as `string[]`
(unlike purchasing's `SupplierInvoiceLine.serialNumbers`, which is a plain string on both sides —
no conversion needed there). Sales is the first module needing an array↔string conversion; chose
comma-join/split as the convention (serials are alphanumeric IMEI/serial strings, never containing
a comma), implemented as two private helpers (`serializeSerials`/`parseSerials`).

### `Apps/api/src/modules/sales/sales.interface.ts`
- **`ISalesService`** — all methods from plan §I.2 (`createDraft`, `updateDraft`, `confirm` →
  `ReceiptDto` per §D-3, `listStaffSales`, `listAdminSales`, `getSale`, `createReturn`, plus the
  listener-only `recordRepairSale`). Actor threaded as the contract's own `JWTPayload` directly
  (it already carries `type`/`staffId`) rather than inventing a narrower local alias — mirrors how
  clients' `Viewer = JWTPayload | undefined` reuses the same type rather than a hand-rolled subset.
- **`ICatalogPosPricingPort`** — declared here (consumer side), named `resolvePosPrices` to match
  Sprint 1's catalog method exactly (structural typing needs the name, not just the shape).

### Factories (`Apps/api/test/data`)
- **`sale-draft.factory.ts`** — `createSaleDraftPayload`/`createUpdateSaleDraftPayload` (command
  builders, `.parse()`-validated) + `seedSale` (DB insert helper for Sprint 4/7 integration
  fixtures, mirroring `seedSupplierInvoice`'s shape: random placeholder reference, optional nested
  `lines.create`).
- **`confirm-sale.factory.ts`** — `createConfirmSalePayload`.
- **`create-return.factory.ts`** — `createReturnPayload`.
- **`repair-picked-up.factory.ts`** — `buildRepairPickedUpEvent` (plain object builder, not
  schema-validated — `RepairsEvents['repair.pickedUp']` is a TS type, not a zod schema).

### Tests (`test/unit/modules/sales/sales.mapper.spec.ts`, 17 tests)
- `toSaleDto`: staff (`includeMargins:false`) omits `totalCost`/`totalProfit`/line
  `costOfGoods`/`profit`; admin (`includeMargins:true`) keeps them; `Decimal→number`; `soldAt`
  ISO-or-omitted; `resolvedPrice`/`unitPrice` both surfaced and distinct (override measurable);
  `posClientName` joined; comma-string `serialNumbers` parses to an array and is omitted when
  `null`; `.parse` never throws on a valid row.
- `toReceiptDto`: never carries cost/profit ("staff mapping hides profit" carried through to the
  receipt too — it never has the fields at all); `grandTotal = total + previousCredit`;
  `previousCredit`/`newCredit` default to `0` when the columns are `null`; `.parse` never throws.
- `toPersistenceDraft`: `resolvedPrice=0` + preview `lineTotal`; falls back to `''` when a
  productId isn't in `ctx.productNames`; serializes an array to `'SN-A,SN-B'`;
  `posClientId`/`discountAmount`/`note` included only when present on the command.

---

## Validation

| Check | Result |
|---|---|
| `Apps/api`: `npx tsc --noEmit` | ✅ clean |
| `Apps/api`: `npm run test:unit` (`test/unit` + `test/contract`) | ✅ 422/422 (29 files) |
| `Apps/api`: `npm run lint` | ✅ clean |
| `Apps/contract`: `npx tsc --noEmit` | ✅ clean (unchanged this sprint) |
| Mapper pure/field-listing, no spread; margin-gated per `includeMargins`; every method ends `.parse()` | ✅ |
| No service logic added this sprint (mapper + interface + factories only) | ✅ |
| `npm run test:int` | not run — no `sales` route exists yet; first applicable at Sprint 4 |

---

## Notes for later sprints

- **Sprint 3** (sales logic): the service must generate the DRAFT `reference` placeholder (mirror
  purchasing's `draftReference()`) and pass it into `DraftMapContext`; must resolve
  `ctx.productNames` via a DB read before calling `toPersistenceDraft`; must treat a missing
  `resolvedPrice` from `ICatalogPosPricingPort.resolvePosPrices` as its own domain error (Sprint 1
  report), not assume it's always present.
- **Sprint 4** (sales API): `seedSale` (in `sale-draft.factory.ts`) is ready for integration-test
  fixtures (existing DRAFT/COMPLETED sales for update/confirm/detail/list/ownership scenarios).
- No `schema.prisma` changes this sprint — every touched model already existed.

---

## Commit

`git add .` then `git commit -m "sales: sprint 2 — foundation (mapper, interface, factories)"`.
