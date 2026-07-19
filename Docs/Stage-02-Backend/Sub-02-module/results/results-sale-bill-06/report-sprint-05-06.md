# Sales+Billing — Sprint 5 Report: Billing — Foundation (mapper, interface, factories)

**Status:** ✅ Done — [`sprints-sale-bill-06.md`](../sprints-sale-bill-06.md) Sprint 5 marked ✅.

---

## What was implemented

### `Apps/api/src/modules/billing/billing.mapper.ts`
Pure/static `BillingMapper`, field-listing (never spreads), each method ends `.parse()`:
- **`toInvoiceDto(invoice: InvoiceRow, ctx: InvoiceMapContext)`** — audience-gated
  (`'client'|'staff'|'admin'`): `totalCost`/`totalProfit` (document) and `costSnapshot`/`profit`
  (per line) included only for `admin`. `issuedAt` ISO, `dueDate` date-only.
- **`toClientPaymentDto(payment: ClientPaymentRow)`** — `invoiceNumber?` only when linked;
  `Decimal→number`; `paidAt` ISO.
- **`toInvoicePersistence(input: InvoiceIssueInput)`** — immutable snapshot create-input.

### Two significant schema gaps found (neither is a schema migration — resolved via ctx/service, same pattern as Sprint 1's catalog port and Sprint 3's repair-staffId gap)

**1. `Invoice` has no `sourceReference` column at all** — only the internal `sourceId` (an opaque
FK into either `Sale.id` or `Order.id`). But `InvoiceDto.sourceReference: z.string()` is
**required on every audience**, not just admin. This is more consequential than a cosmetic gap:
every single invoice read (list, detail, PDF) needs it. **Resolution:** `sourceReference` is
supplied via `ctx` (not read off the `Invoice` row), and Sprint 6's service resolves it live at
read time by batch-joining `sourceId` against `Sale.reference`/`Order.reference` (grouped by
`sourceType`, since `sourceId` alone doesn't say which table to join). This is safe, not just
convenient: `Sale.reference`/`Order.reference` are themselves immutable once a document reaches
its confirmed/placed state (a `Sale`'s DRAFT placeholder reference is fully replaced *before*
`sale.confirmed` fires — verified in Sprint 3 — so by the time an invoice could exist for it, the
source reference never changes again). Re-deriving it live is therefore equivalent in practice to
"rendering identically forever," even though nothing is cached on the `Invoice` row itself.

**2. `InvoiceLine` has no `productId`** — only a free-text `label` (unlike `SaleLine`, which does
carry `productId`). The spec's `currentAverageCost` ("joined live for the admin compose/inspect
view") has no direct FK path to `Product.averageCost` at all. **Resolution:** also supplied via
`ctx` (`currentAverageCostByLineId: Map<invoiceLineId, number>`, optional — gracefully omitted
when absent, following the same non-throwing precedent as catalog's `resolvePosPrices`). Sprint
6's service will correlate `InvoiceLine`s back to their source document's lines (for SALE origin:
`SaleLine`, which has `productId`; for ORDER origin: `Order.productId` directly, since orders are
single-line) by matching `(label, quantity, unitPrice)` — the only reconstruction path available
without a schema migration, since there is no FK and neither `InvoiceLine` nor `SaleLine` carries
an orderable timestamp for a safe positional zip. **Documented limitation carried to Sprint 6:**
this tuple match is not airtight for a sale with two identical lines (same product/qty/price
entered as separate lines rather than one line with a higher quantity) — an edge case, not the
common path.

Both gaps are why `toInvoicePersistence` takes a normalized `InvoiceIssueInput` (one shape,
regardless of origin) rather than the plan's literal `(source, event, lines)` — `sale.confirmed`
and `order.confirmed` have too little in common (order has no `previousCredit`/`newCredit` at all,
nests `totals`, etc.) for the mapper to reconcile them itself; Sprint 6's service normalizes
whichever event fired into this shape first. This mirrors the same "supplied pre-resolved, service
does the join" pattern used repeatedly since Sprint 1 (catalog ports, sales' `ctx.productNames`).

### `Apps/api/src/modules/billing/billing.interface.ts`
`IBillingService` (all methods from plan §II.2) + local `PdfResult = { filename; mime:
'application/pdf'; body: Buffer }` (mirrors platform/inventory's `ExportResult` — not a contract
DTO, PDFs bypass the envelope per §D-6).

### Factories
- `test/data/create-client-payment.factory.ts` — `createClientPaymentPayload`.
- `test/data/billing-events.factory.ts` — `buildSaleConfirmedEvent`/`buildOrderConfirmedEvent`
  (plain builders, not schema-validated — event payloads are TS types, not zod schemas, same as
  Sprint 2's `repair-picked-up.factory.ts`).

### Tests (`test/unit/modules/billing/billing.mapper.spec.ts`, 12 tests)
- `toInvoiceDto`: client/staff both strip `totalCost`/`totalProfit`/`costSnapshot`/`profit`/
  `currentAverageCost`; admin keeps the money fields and injects `currentAverageCost` from
  `ctx.currentAverageCostByLineId`, omitting it gracefully when the map has no entry for that
  line; `sourceReference` always comes from `ctx` (never a row field — there is none);
  `Decimal→number`/`issuedAt` ISO/`dueDate` date-only; `serialNumbers` passes through as a plain
  string (unlike sales' array conversion — billing's contract models it as `z.string().optional()`
  the same way purchasing does); `.parse` never throws across all three audiences.
- `toClientPaymentDto`: `invoiceNumber` only when linked; money/date conversions.
- `toInvoicePersistence`: `status` fixed to `ISSUED`; optional fields (`posClientId`,
  `clientAddressSnapshot`, `previousCredit`/`newCredit`, line `serialNumbers`) included only when
  present on the input.

---

## Validation

| Check | Result |
|---|---|
| `Apps/api`: `npx tsc --noEmit` | ✅ clean (one `consistent-type-imports` fix applied — `InvoiceSource` is only ever used in type position in this file) |
| `Apps/api`: `npm run test:unit` (`test/unit` + `test/contract`) | ✅ 460/460 (32 files) |
| `Apps/api`: `npm run lint` | ✅ clean |
| `Apps/contract`: `npx tsc --noEmit` | ✅ clean (unchanged this sprint) |
| Mapper pure/field-listing, audience-gated; returns contract DTOs only | ✅ |
| No service logic added this sprint (mapper + interface + factories only) | ✅ |
| `npm run test:int` | not run — no `billing` route exists yet; first applicable at Sprint 7 |

---

## Notes for later sprints

- **Sprint 6** (billing logic): `issueFromSale`/`issueFromOrder` must (a) resolve `sourceReference`
  by batch-joining `sourceId` → `Sale.reference`/`Order.reference`, grouped by `sourceType`;
  (b) for the admin `currentAverageCost` map, correlate `InvoiceLine`s back to source lines by
  `(label, quantity, unitPrice)` and batch-fetch `Product.averageCost` for the resolved
  `productId`s; (c) normalize whichever event fired into one `InvoiceIssueInput` before calling
  `toInvoicePersistence`.
- No `schema.prisma` changes this sprint (as the sprint doc anticipated) — every touched model
  already existed; both gaps above were resolved without a migration.

---

## Commit

`git add .` then `git commit -m "billing: sprint 5 — foundation (mapper, interface, factories)"`.
