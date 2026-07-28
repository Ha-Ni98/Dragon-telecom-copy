# Report — Set 13: Repairs

Executed against `Docs/Stage-04-Fixes/plans/plan-S13-repairs.md` on `stage-04-fix`, 2026-07-27.
Implements **D5**, **D6**, **D8**, **D9** end to end on the repairs module.

## Owner decisions carried into execution

- **R4 (labour counts as pure profit)** — confirmed by the owner before execution. Implemented
  exactly as flagged in the plan: `totalProfit = totalAmount − totalCost` at `PICKED_UP`, not the
  summed part profits.
- **Pre-S13 repair data** — the owner confirmed the database is disposable draft data. The
  migration's data-reset (`DELETE FROM "ClientPayment"/"RepairStatusHistory"/"RepairPart"/"Repair"`)
  was executed, not skipped.

## What changed

### Schema & migration
- `ClientPayment.repairId String?` + relation + `@@index([repairId])`; `Repair.payments
  ClientPayment[]` (R3). Migration `20260727114254_s13_repair_payment_link`, applied to the dev
  database (`prisma migrate dev`), client regenerated.

### Contract (`Apps/contract/src/modules/repairs`)
- New `repairs.constants.ts` — `REPAIR_STATUS_TRANSITIONS`, `repairTransitionsFrom`,
  `isRepairTransitionAllowed`, `isRepairStatusTerminal`, `repairTransitionRequiresPayment`.
  Mirrors `orders.constants.ts` exactly, per hard rule 1 (shared machine, no magic strings).
- `RepairListQuerySchema` gained `from`/`to`/`page`/`limit` (default `limit: 10`, R2).
- `RepairStatusSchema`: `paidAmount` → `paymentAmount` (now a delta, not an absolute overwrite —
  F3 in the plan) + new `refundAmount`; `consumedPartReturns` deleted (F2 — dead under D8).
- New `RecordRepairPaymentSchema`/`RecordRepairPaymentCommand` (D5).
- `RepairResponseSchema` gained `invoiceNumber?` and `payments[]`.
- New `TechnicianRepairStatsResponseSchema`/`TechnicianRepairStatsDto` (R1).
- New routes: `STAFF_PAYMENTS`/`ADMIN_PAYMENTS`, `ADMIN_TECHNICIAN_STATS` (mounted at
  `/admin/repair-technicians`, outside `/admin/repairs/…`, so it isn't swallowed by
  `ADMIN_BY_ID`'s uuid-validated `:id`).
- `repair.pickedUp` event gained `invoiceNumber`; `repair.cancelled` gained `refundAmount?`.

### Backend (`Apps/api`)
- **`billing.interface.ts`/`billing.service.ts`**: `captureClientPaymentInTx` accepts an optional
  `repairId`; new `linkRepairPaymentsToInvoiceInTx` re-points a repair's on-account
  `ClientPayment` rows to the invoice issued at pickup and recomputes that invoice's
  `paidAmount`/`status` from the ledger (same status ladder as the existing recompute, kept in
  step by a paired comment on both).
- **`repairs.interface.ts`**: new locally-declared `IRepairCreditPort`/`IBillingIssuePort`
  (structural, no adapter — the `ICatalogPricingPort` precedent), `listRepairs` now returns
  `PaginatedResult<RepairDto>`, plus `recordPayment`/`listTechnicianStats`.
- **`repairs.routes.ts`**: wires `clientsService`/`billingService` in; mounts the two new route
  pairs and the technician-stats endpoint.
- **`repairs.service.ts`** — the core rewrite:
  - `listRepairs` paginated + intake-date range.
  - `changeStatus` reads the contract's transition table instead of a hand-rolled
    `STATUS_SEQUENCE`; branches to two new private methods:
    - `pickUpRepair` (D8/D9/D5) — releases + FIFO-consumes every part (moved here from the old
      `COMPLETED` branch, which now does nothing but flip status+timestamp), computes
      `totalProfit = totalAmount − totalCost` (R4), charges the account
      (`applyDocumentCharge`), issues the invoice (`InvoiceSource.REPAIR`, one line per part plus
      a `Labour` line when `labourPrice > 0`), re-links on-account payments
      (`linkRepairPaymentsToInvoiceInTx`) **before** capturing this transition's own payment (so
      the capture's ledger recompute sees every row), captures the payment if any, and latches
      `Repair.invoiceId` (`updateMany` guard, mirrors the deleted `recordRepairSale`'s
      `saleId` latch).
    - `cancelRepair` (D6/D8) — releases every reservation unconditionally (nothing is ever
      consumed before pickup any more), refunds `Math.min(refundAmount ?? paidAmount,
      paidAmount)` as a negative-amount ledger row when a POS client is known.
  - `buildOriginalConsumptions` deleted (F2 — its only caller, the `consumedPartReturns` restock
    path, is gone).
  - New `recordPayment` (D5) and `listTechnicianStats` (R1, two `groupBy`s + a technician list,
    zero-filled for technicians with no repairs).
  - New `assertEditable` guard (D8 read-only), called from `updateRepair`/`addPart`/`removePart`.
- **`repairs.mapper.ts`**: `RepairRow` gained `payments`/`invoice`; `toRepairDto` maps both; new
  `toTechnicianStatsDto`.
- **`repairs.controller.ts`**: `recordPayment`/`listTechnicianStats` handlers.

### Frontend (`Apps/web`)
- **`services/repairs.service.ts`**: `listRepairs` returns the paginated envelope; new
  `recordRepairPayment`/`listTechnicianStats`.
- **`query-keys.ts`**: `qk.repairs.technicianStats()`.
- **`hooks/useRepairs.ts`**: new `useRecordRepairPayment`/`useTechnicianRepairStats`;
  `useUpdateRepairStatus` now also invalidates `qk.billing.all()` and `qk.clients.all()` (pickup
  now moves credit/totalSold and issues an invoice/payment).
- **`repair-status.schema.ts`**: rewritten around the renamed `paymentAmount`/new
  `refundAmount`, `z.coerce.number()` + the 3-generic `useForm<Input, unknown, Output>` shape
  (same NaN-on-empty-optional fix `order-status.schema.ts` established in S10); the
  `consumedPartIds`/restock refine is gone; a new refine requires `paymentAmount > 0` at
  `PICKED_UP` whenever `amountDue > 0`.
- **`RepairStatusDialog.tsx`**: transition list now comes from `repairTransitionsFrom` (no local
  `NEXT_STATUS` map); gained `presetStatus` (S11's `OrderStatusDialog` shape); `PICKED_UP` shows
  total/paid/amount-due with a payment field defaulted to the amount due (or a "nothing due"
  line); `CANCELLED` shows a refund field, defaulted to `paidAmount`, only when money was
  collected; footer gained an explicit Cancel button.
- **`RepairTicketDetail.tsx`** — **F1 fixed**: the spare-part picker is now `AutocompleteInput`
  (shows the picked product's name; `errors.productId` now renders, closing the silent-failure
  half of the bug). Read-only mode (`isRepairStatusTerminal`) hides the add-part form and delete
  buttons and disables labour/diagnosis inputs. New Payments section (list + a "Record payment"
  dialog defaulted to the amount due; a walk-in with no payments shows a distinct message from an
  empty ledger). Invoice number is shown as **plain text**, not a link — confirmed via `App.tsx`
  that no per-invoice detail route exists (`AdminInvoices`/`StaffInvoices` are single list pages);
  this is a deliberate deviation from the plan's "link when possible" wording, not an oversight.
- **`IntakeDialog.tsx`** — **F5 closed**: now owns its own brand/model fetch (`useCatalogBrands`,
  `useCatalogModels({brandId}, false, {enabled: !!brandId})`) with create-if-absent
  (`AutocompleteInput` + `useCreateCatalogBrand`/`useCreateCatalogModel`), cascading — choosing a
  brand resets any previously-picked model. `brands`/`models` props removed.
- **`RepairBoard.tsx`**: gained a date-range filter and `SimplePagination`; still five lanes, now
  showing one page (≤10) of the filtered set — a lane can legitimately be empty on a given page.
- **`StaffRepairs.tsx`**: owns `technicianFilter`/`from`/`to`/`page` state (any filter change
  resets `page` to 1); drives the new `RecordRepairPaymentDialog` via `RepairTicketDetail`;
  admin scope wraps the board in a `Tabs` (Board / Technicians), `PageHeader` sitting **above**
  the tab bar — matched to S12's actual `StaffSales.tsx` layout, not the plan's looser wording (a
  header-inside-tab-content reading was considered and rejected as worse UX). Header comment
  rewritten to describe the three transitions drag-and-drop still bounces on
  (PROCESSING/PICKED_UP/CANCELLED-with-money), replacing the stale `consumedPartReturns`
  wording.
- New **`RecordRepairPaymentDialog.tsx`** + **`record-repair-payment.schema.ts`** (D5).
- New **`TechniciansTab.tsx`** + **`add-technician.schema.ts`** (R1) — `DataTable` mirroring
  `ReturnsTable.tsx`'s shape; reuses the existing `useCreateTechnician()` (no new backend
  surface); invalidates both `qk.identity.technicians.all()` and `qk.repairs.technicianStats()`
  on success.
- **74 translation keys added** (42 new + delete of the 2 F2-orphaned
  `consumedPartReturns*` keys, confirmed unused first via grep), inserted next to their existing
  `staff.repairs.*`/`admin.repairs.*` neighbours, `ar: ""` per convention. Every `t()` call across
  the touched files was cross-checked against `translations.json` — zero unresolved keys.

## Deviations from the plan

1. **Invoice number renders as plain text, not a link** (see `RepairTicketDetail.tsx` above) —
   the plan asked to "check the real route... before writing the path"; the check found no route
   exists.
2. **`PageHeader` sits above the `Tabs`, not inside the board's `TabsContent`** — the plan's
   wording was ambiguous; S12's actual code (`StaffSales.tsx`) was used as the concrete
   precedent instead of re-deriving a new layout.

Neither changes behavior the plan promised; both are documented here per the "flag it back"
instruction rather than silently decided.

## Validation gate (D12 — no test file read, edited, or run)

| Package | `tsc --noEmit` | `lint` |
|---|---|---|
| `Apps/contract` | clean | clean |
| `Apps/api` | `src/**` clean; `test/**` has pre-existing staleness only (see below) | 6 pre-existing errors, `prisma/seed.ts` + `validate-request.middleware.ts` — neither touched by S13 |
| `Apps/web` | clean | 3908 pre-existing errors across the repo (prettier-noise baseline, per programme memory) — confirmed **zero** overlap with any S13-touched file by diffing lint-error file paths against `git status --porcelain` |

**`Apps/api` test staleness** (not read/edited, itemized for the record): `repairs.service.spec.ts`
references the old 3-arg constructor, `paidAmount`, and `consumedPartReturns`; `billing.*.spec.ts`
references pre-S5 symbols already stale before this set. No new categories of staleness were
introduced beyond what S13's own contract renames (`paidAmount`→`paymentAmount`,
`RepairListQuerySchema` shape) mechanically cause.

## Money arithmetic, verified by hand

Traced the plan's §5 worked example (intake 500 + processing 500 + pickup 4000 on a 5000-total,
1800-cost repair) against the actual `pickUpRepair`/`recordPayment` code, step by step — matches
exactly: `credit` returns to 0 at full settlement, `totalPaid` = Σ ledger amount, `Invoice.paidAmount`
= Σ ledger amount for that invoice (1000 on-account + 4000 captured = 5000, PAID), `totalSold`
moves once, `totalProfit` = 5000 − 1800 = 3200 (R4: parts margin 1200 + labour 2000). Cancellation
after partial payment reverses cleanly (refund row = negative ledger amount, credit/totalPaid both
return to their pre-repair values, no `totalSold` movement since nothing was ever charged).

## Manual verification checklist (browser)

Unchanged from the plan's §7 — reproduced here for the reviewer's convenience.

**Board, filters, pagination**
1. `/admin/repairs` — board shows at most 10 tickets; pager sits in the filter row.
2. Page 2 loads a different set; lanes may legitimately be empty on some pages.
3. A From/To range around one ticket's intake date isolates it.
4. Technician filter still narrows and resets the pager to page 1.

**Intake**
5. Brand field: type a nonexistent brand → "create new" → picked → field shows the name.
6. Model disabled until a brand is chosen; only that brand's models offered; create-new attaches
   to that brand.

**The spare-part bug (F1)**
7. Parts editor: type → pick a result → field shows the product name; price fills in.
8. Press Add part with nothing selected → visible "Select a product" error.
9. Add a part → `/admin/inventory` shows the quantity as **reserved**, not out.

**Payments before pickup (D5)**
10. INTAKE → Record payment 500 → payments list shows one row; cumulative paid = 500.
11. `/admin/clients/:id` → credit −500, total paid 500.
12. PROCESSING (assign technician) → record another 500 → paid 1000, credit −1000.

**Completion consumes nothing (D8)**
13. Move to COMPLETED — inventory still reserved, no `REPAIR_CONSUMPTION` movement yet.

**Pickup — the money moment (D8/D9)**
14. PICKED_UP dialog shows total/paid so far/amount due, prefilled.
15. Cancel in the dialog → status stays COMPLETED.
16. Reopen, Save → transition succeeds.
17. Inventory: reservation gone, one `REPAIR_CONSUMPTION` movement whose reference reads `REP-…`.
18. `/admin/invoices` — new invoice, source Repair, status PAID, `paidAmount` = full total.
19. Lines: every part plus a Labour line.
20. Client portal → My invoices shows the repair invoice.
21. `/admin/clients/:id` — credit back to 0, total paid = repair total, total sold increased.
22. `/admin/payments` — three rows for this repair, all carrying the invoice number.

**Read-only after pickup**
23. Reopen the picked-up ticket: no add-part form, no delete buttons, labour/diagnosis disabled,
    no "Update status" button, "closed" note shown.

**Cancellation with a refund (D6)**
24. New repair, collect 700, PROCESSING, cancel → dialog offers a refund prefilled at 700.
25. Confirm → reservations released, credit/total paid back to pre-repair values, negative-amount
    ledger row.
26. A picked-up repair offers no cancel affordance anywhere.

**Walk-in**
27. No-POS-client repair: pickup refuses unless paid in full (`CREDIT_REQUIRES_CLIENT`); once
    paid, invoice shows the real customer name; payments section reads "Walk-in customer — no
    client ledger".

**Technicians tab**
28. `/admin/repairs` → Technicians tab lists every technician with per-status counts + revenue.
29. Add a technician → appears in the table and in the intake dialog's technician select.
30. Revenue equals the sum of that technician's picked-up repair totals only.

**Regression sweep**
31. `/staff/repairs` still works (board, intake, parts, payments) — no Technicians tab.
32. A POS sale and an order still confirm with unchanged credit/totalPaid/totalSold arithmetic.

---

Awaiting owner review before **S14 (Statistics)** starts — S14 reads `Repair.totalCost`/
`totalProfit`/`pickedUpAt` stamped by this set's `pickUpRepair`, so it cannot be meaningfully
verified until this set is approved.
