# Report S8 — Clients, Invoices & Payments

Executed per `Docs/Stage-04-Fixes/plans/plan-S08-clients-invoices-and-payments.md`, actions 1→21
in order, single session, immediately following S7 in the same session (S7's
`SupplierInvoiceDto.supplierCredit` is a prerequisite for Action 18a).

## Summary

All 21 actions completed. `tsc --noEmit` is clean on `Apps/contract`, `Apps/api` and `Apps/web`.
Lint is clean on every S8-touched file (five files needed a prettier `--fix` pass — pure
formatting, no logic change; see §Validation gate). No schema/migration in this set. No test file
was edited. No test suite was run.

## What changed

### Contract (Actions 1–5)

- `clients.dtos.ts`: new `AdminClientOverviewResponseSchema` (`clientId`, `posClientId?`,
  `totalSold`, `totalPaid`, `credit`, `orderCount`, `totalProductQuantity`) — the client-detail
  Overview tab's five figures, and the source of the clients-list record-payment preview.
- `clients.routes.ts`: `CLIENT_ROUTES.ADMIN_OVERVIEW = '/admin/clients/:id/overview'`.
- `billing.dtos.ts`: `InvoiceResponseSchema` gains `posClientCredit: z.number().optional()` — the
  linked POS client's credit *right now*, distinct from the invoice's own `previousCredit`/
  `newCredit` snapshot. Stripped for the client audience (mirrors the `totalCost`/`totalProfit`
  margin gate, but open to staff — see billing.mapper.ts below).
- `billing.query.ts`: `ClientPaymentListQuerySchema` gains `from`/`to` (date-only, optional).
- `purchasing.query.ts`: `SupplierPaymentListQuerySchema` gains the same `from`/`to`.
- `orders.query.ts`: `BackofficeOrdersQuerySchema` gains `clientId: z.uuid().optional()` — the
  admin client-detail Orders tab scopes the shared back-office list to one registered client.

### Backend (Actions 6–9)

- **Clients** — new `getClientOverview(id)` on `IClientsService`/`ClientsService`: reads
  `PosClient.credit`/`totalPaid`/`totalSold` as-is (D5 — the ledger is their only writer, never
  recomputed here), counts `Order` rows by `clientId`, and aggregates `Σ InvoiceLine.quantity`
  over the client's non-cancelled invoices (R1). Zero-figure fallback when the client has no
  linked `PosClient` (never approved). New `ClientsMapper.toAdminClientOverviewDto`. New
  controller method + route, registered **before** `ADMIN_DETAIL` per the file's existing
  `ADMIN_STATS` convention (the comment now explains this route pair can't actually collide, since
  the segment counts differ).
- **Billing** — `INVOICE_INCLUDE` now selects `posClient.credit`; `InvoiceRow` widened to include
  it. `toInvoiceDto` emits `posClientCredit` whenever `ctx.audience !== 'client'` **and** a
  `posClient` exists — open to both `staff` and `admin` (unlike the cost/profit margin fields,
  which are admin-only), since both incoming-tab and outgoing-tab record-payment dialogs are
  staff-operated. `listClientPayments` gained the `paidAt` date-range filter.
- **Purchasing** — `listPayments` gained the same `paidAt` date-range filter.
- **Orders** — `listBackoffice`'s `where` gained `clientId` when present in the query, appended
  after the existing date-range block; no other change to pagination, ordering or admin/staff
  scoping.

### Frontend — services, hooks, query keys (Action 10)

- `qk.clients.admin.overview(id)` added. `getAdminClientOverview` service function and
  `useClientOverview(id, { enabled? })` hook (mirrors `useClientDirectoryEntry`'s `!!id` guard,
  plus the caller-controlled `enabled` J2's dialog needs). Verified `useCreateClientPayment`'s
  existing `qk.clients.all()` invalidation already sweeps the new overview key — no change needed
  there.

### Frontend — clients list (Actions 11–12)

- **`admin-clients-table.tsx`** — J1: the `lastOrderDate`-under-a-`createdDate`-header bug (F1)
  fixed — the column now reads `accessorKey: "createdAt"` and renders `formatDateTime`. J2: a
  third action icon (`CreditCard`), disabled with a tooltip (R2) when `posClientId` is absent,
  wrapped in a local `TooltipProvider` (no ancestor provider exists in `AdminLayout`). New
  `onRecordPayment` prop.
- **`AdminClients.tsx`** — wires `RecordPaymentDialog` (reused wholesale from
  `pages/staff/invoices/components`, per F5 — no new component) against `useClientOverview` for
  the live "previous credit" and `useCreateClientPayment` with **no `invoiceNumber`** (an
  on-account payment; `captureClientPaymentInTx` already accepts a null `invoiceId`, S5).

### Frontend — client-detail tabs (Actions 13–16)

- **`client-overview-panel.tsx`** (new) — five `StatCard`s (total sold, total paid, credit,
  orders, products bought), a loading-skeleton state, and a one-line note (not an error state)
  when the client has no linked `PosClient` yet.
- **Orders/Invoices tabs** — reuse `OrdersTable`/`InvoicesTable` directly (both already dumb,
  props-only components), per the plan's explicit "no new component" instruction. `onRowClick`
  omitted on both.
- **`client-payments-table.tsx`** (new) — reuses the existing `admin.invoices.payments.table.*`
  keys `PaymentsLedger`'s client sub-tab already uses, minus the counterpart column (redundant on
  a single-client page). Refunds render as negative amounts, never `Math.abs`'d (D6).
- **`AdminClientDetail.tsx`** — wires all four: `useClientOverview(id ?? "")` and
  `useOrdersList("admin", { clientId: id, … })` fire unconditionally once the id is known (F11 —
  no `enabled` option on either hook, same precedent as the pre-existing `useClientActivity`
  call); `useInvoices`/`useClientPayments` are genuinely gated on `!!client?.posClientId`. Header
  comment rewritten — it previously asserted these four tabs had "no scoped hook … per the plan's
  resolve-first section", which this action falsifies.

### Frontend — the invoices page (Actions 17–18)

- **`InvoiceSnapshotView.tsx`** — J6: both the record-payment and cancel buttons now also require
  `invoice.sourceType !== InvoiceSource.SALE`. The underlying hooks/service/backend are untouched
  — this is a render-condition-only change, per the plan.
- **`InvoicesTable.tsx`** — exported `SOURCE_LABEL_KEY` (was module-private) for reuse by the new
  filter bar's source `<Select>` options.
- **`InvoiceFiltersBar.tsx`** (new) — a shared date-range bar (`from`/`to`), plus an optional
  source `<Select>` for the outgoing tab. An emptied date input sends `undefined`, never `""`
  (`z.iso.date()` rejects the empty string).
- **`StaffInvoices.tsx`** — the two credit-preview bugs fixed: line ~240's supplier dialog now
  reads `supplierPaymentTarget?.supplierCredit` (S7's field) instead of the stale `newCredit`;
  the client dialog now reads `selectedInvoice.posClientCredit` (Action 2's new field) instead of
  its own stale `newCredit` (F7 — the identical bug, twelve lines from the one the brief named).
  The single shared `page` state was split into three independent filter+page states
  (`outgoingFilters`/`outgoingPage`, `incomingFilters`, `paymentsFilters`) — every filter setter
  that has a page also resets it to 1 (F10), so a filter applied on page 3 never shows an empty
  table. `paymentsQuery` feeds both `useClientPayments` and `usePurchasingPayments` from one
  object (both query schemas gained identical `from`/`to` shapes in Actions 3–4). The filter bar
  renders above all three tab bodies, with `showSource` only on outgoing; the staff (non-admin)
  scope renders it above its single outgoing table too, per J8's "every tab".

### Translations (Action 19)

Added 13 keys: three record-payment strings, six Overview-tab labels/note, four invoice-filter
labels. Confirmed via `grep` that none of the 13 pre-existed and that the five
`admin.clients.detail.tabs.*` labels this set now actually renders content under were already
present and untouched. JSON validated via `require()`.

## Findings during execution

No deviations from the plan were required. Two things worth flagging:

- **Five newly-written/edited files needed one `eslint --fix` pass each** for pure prettier
  formatting (import-list line-wrapping, a JSX text-node wrap, an inline-onChange wrap) — no logic
  changed; confirmed via a second lint pass returning exit 0 on all five.
- **`InvoicesTable.tsx` exporting `SOURCE_LABEL_KEY` alongside its component triggers a
  `react-refresh/only-export-components` warning.** Left as-is rather than splitting into a new
  file — this exact pattern (a component file also exporting a constant/helper) is already
  widespread and accepted across the codebase (`MarginDisplay.tsx`, `badge.tsx`, `button.tsx`,
  `AuthProvider.tsx`, `LanguageProvider.tsx`, and 25+ others all carry the identical warning). The
  lint script has no `--max-warnings` gate, so this does not fail the build.

## Validation gate — all green

```
Apps/contract: npx tsc --noEmit ✓ (0 errors)      npm run lint ✓ (0 problems)

Apps/api:      npx prisma validate ✓ (unchanged schema, sanity check only)
               npx tsc --noEmit — src/** 0 errors (confirmed by filtering error-header paths to
               outside test/); every remaining error is inside test/**, itemized below — same
               20-file list as S7, no new src-side breakage.
               npm run lint — 6 pre-existing errors (prisma/seed.ts ×3,
               validate-request.middleware.ts ×3), identical to the S1/S4/S5/S7 baseline; neither
               file touched this session.

Apps/web:      npx tsc --noEmit ✓ (0 errors) — this project's tsconfig.json only includes
               `src/**`, so test/fixture staleness (below) is invisible to this check by design.
               npm run lint — 0 new errors on any S8-touched file. Five files had 5 pure-
               formatting errors total, fixed via `eslint --fix`; re-lint of all five returns
               exit 0. One pre-existing-pattern warning (react-refresh) on InvoicesTable.tsx,
               discussed above — not an error, does not fail the script.
```

No test file was edited. No test suite was run.

**Stale-test sweep (do not edit/run):**

```
grep -rln "InvoiceRow|INVOICE_INCLUDE|listClientPayments|listBackoffice" Apps/api/test
→ test/unit/modules/purchasing/purchasing.mapper.spec.ts — already flagged in report-S07.md
  (its `SupplierInvoiceRow` fixture is missing `supplier.credit`, from S7's Action 3).
→ test/unit/modules/billing/billing.mapper.spec.ts — **newly stale, introduced by this set**:
  `buildInvoiceRow` constructs an `InvoiceRow` without a `posClient` field, now required by
  Action 7's widening.
→ test/unit/modules/purchasing/purchasing.service.spec.ts — **an S7-caused staleness not caught
  in S7's own sweep**: its local `buildInvoiceRow` (a `SupplierInvoiceRow`-shaped fixture,
  distinct from purchasing.mapper.spec.ts's own) also builds `supplier: { name: 'Acme Parts' }`
  with no `credit`. Flagging here since S7's report only named the mapper spec.

grep -rln "lastOrderDate|AdminClientsTable|StaffInvoices|InvoiceSnapshotView" Apps/web/tests
→ tests/fixtures/data/clients.mock.ts — matched on the literal string `lastOrderDate`, which
  the fixture still legitimately carries (the DTO field itself is untouched; only the table
  column that used to read it was fixed). **Verified not actually stale** — the fixture object
  is still a valid AdminClientDto.
→ tests/unit/pages/staff-invoices/invoices.test.tsx — **behaviorally stale, not just
  uncompilable** (worth flagging explicitly per the plan's instruction). Its shared
  `mockInvoice` fixture (`tests/fixtures/data/billing.mock.ts`) has `sourceType:
  InvoiceSource.SALE`. Two of its tests now assert the *opposite* of this set's intended
  behavior:
    - "admin scope shows three tabs and a cancel action on the outgoing snapshot" (~line 111) —
      J6 now hides the cancel button on exactly this invoice's sourceType.
    - the record-payment submission test (~line 147) — J6 hides that button too, for the same
      reason.
  Neither test was touched, per rule.
```

## Handoffs recorded per the plan's execution protocol

1. **To S10** — the order-completion payment path will write a `ClientPayment` row; the
   client-detail Payments tab surfaces it automatically, and `totalProductQuantity` starts
   counting order lines the moment order invoices are issued at `COMPLETED` (D3), with no further
   change needed here.
2. **To S13** — repair invoices (source `REPAIR`) will appear in the client's Invoices tab and
   their lines in `totalProductQuantity` automatically (R1's aggregate is source-agnostic).
   On-account repair payments (null `invoiceId`) render as "on account" rows in the Payments tab
   using the key that already exists.
3. **To S12** — J6 hides record-payment/cancel on **sale** invoices specifically so the Returns
   tab S12 adds becomes the one path for reversing a sale; S12 must not re-expose either button.
4. **To S18** — `StaffInvoices.tsx` is the shared page for `/staff/invoices` and `/admin/invoices`;
   the filter bar landed in both scopes in this one edit, so S18 has nothing to mirror for it. The
   clients pages have no staff twin today.
5. **Two S7-era test fixtures were found broken during this set's sweep, not S7's own** (see
   above) — `purchasing.service.spec.ts`'s `buildInvoiceRow`. Recorded here since S7's report did
   not name it.

## Manual verification checklist

The owner performs these in the browser, with a database query where stated. No automated test
runs. Prepare: one **approved** client with a linked POS client, some POS sales, at least one
order and one recorded payment; one **pending** client; one supplier with two confirmed invoices
at different dates.

**Clients list (J1, J2)**

1. `/admin/clients` — the **Created date** column now shows each client's registration date,
   formatted, for **every** row — including clients who have never ordered. Cross-check one
   against `SELECT code, "createdAt" FROM "Client" WHERE code = '…';`.
2. A third action icon (a card icon) appears on every row.
3. On a **pending** client the icon is **greyed out**; hovering it explains the client must be
   approved first.
4. On an **approved** client, click it. Note the client's credit first:
   `SELECT credit, "totalPaid" FROM "PosClient" WHERE id = '…';`
   The dialog's "previous credit" equals that figure exactly.
5. Type an amount: the preview shows `credit → credit − amount`. Submit. A success toast appears,
   and the same query shows `credit` down by the amount and `totalPaid` **up** by it.
6. `SELECT reference, "invoiceId", amount FROM "ClientPayment" ORDER BY "paidAt" DESC LIMIT 1;` —
   the new row has **`invoiceId` NULL** (an on-account payment) and the amount you entered.
7. `SELECT SUM(amount) FROM "ClientPayment" WHERE "posClientId" = '…';` still equals that client's
   `totalPaid` exactly. This is D5/D6's core invariant — it must survive J2.
8. Try to submit an amount of **0** or a negative one: the dialog rejects it inline.

**Client information — tabs (J3, J4)**

9. `/admin/clients/:id` on a **pending** client → **Approve**: the category dropdown shows the
   category **name** after selection, not a uuid (J3, verify-only — if it shows an id, report it
   as an S2 regression rather than patching this dialog).
10. `/admin/clients/:id` on an approved client → **Overview**: five figures, none of them an
    empty state. Cross-check the first three against
    `SELECT credit, "totalPaid", "totalSold" FROM "PosClient" WHERE id = '…';`.
11. **Orders** count matches `SELECT count(*) FROM "Order" WHERE "clientId" = '…';`.
12. **Products bought** matches
    `SELECT COALESCE(SUM(l.quantity),0) FROM "InvoiceLine" l JOIN "Invoice" i ON i.id = l."invoiceId" WHERE i."posClientId" = '…' AND i.status <> 'CANCELLED';`
13. **Orders** tab: only that client's orders, no one else's. Compare the row count to step 11.
14. **Invoices** tab: only that client's invoices. A POS sale you make for this client appears
    here within a refresh.
15. **Payments** tab: the payment from step 5 is listed, its invoice column reads **"on
    account"**, and its credit-movement column matches the preview from step 5.
16. **Browsing** tab is unchanged from before this set.
17. Open a **pending** client's detail page: Overview shows zeros with a "not approved yet" note,
    and Orders/Invoices/Payments render empty rather than erroring or showing another client's
    data.
18. Cancel an invoice for this client (`/admin/invoices` → outgoing → an **order** invoice →
    Cancel), then reload the Overview: **Products bought** has dropped by that invoice's
    quantity.

**Invoices — outgoing (J6, J7, J8)**

19. `/admin/invoices` → **Outgoing** → open a **SALE** invoice: there is **no** Cancel button and
    **no** Record-payment button.
20. Open an **ORDER** invoice that is not fully paid: **both** buttons are still there and both
    still work.
21. Note that client's credit, then use that Record-payment button. Its "previous credit" is the
    client's **current** credit — **the same figure the clients-list dialog showed in step 4** —
    not the invoice's frozen `newCredit`. Compare the two dialogs directly for the same client.
22. Outgoing tab: set the **source** filter to *Order* — only order invoices remain. Set it to
    *Sale* — only sale invoices. Reset to *All sources*.
23. Set a **From** date after every invoice's date: the table empties. Widen it: rows return.
24. Go to page 2 of the outgoing list, then change a filter: the list jumps back to **page 1**
    with results, not to an empty page 2.

**Invoices — incoming (J5, J8)**

25. Note a supplier's current credit on `/admin/suppliers`. `/admin/invoices` → **Incoming** →
    click the supplier's **oldest** invoice. The payment dialog's "previous credit" equals the
    supplier's **current** credit, not the figure frozen on that old invoice.
26. Submit a payment. The incoming table's **Paid** and **Outstanding** columns for that invoice
    update without a manual reload, and `/admin/suppliers` shows the new credit.
27. Incoming tab: the date-range filter narrows the list by invoice date.

**Invoices — payments (J8)**

28. **Payments** tab → **Client** sub-tab: the date filter narrows it. Set a range that excludes
    today and the payment from step 5 disappears; widen it and it returns.
29. **Supplier** sub-tab: the same filter narrows it, and the payment from step 26 behaves the
    same way.
30. A **refund** row (from any earlier return) still shows as a **negative** amount here and in
    the client-detail Payments tab.

**Staff parity spot-check**

31. `/staff/invoices` as a staff user: the date filter bar is present above the single outgoing
    table, and a **sale** invoice there also shows no record-payment button.

**Nothing else moved**

32. `/admin/pos` still completes a sale for a POS client and still issues its invoice with the
    payment row S5 introduced.
33. `/admin/orders` still lists **every** order (the new `clientId` filter is optional and unset
    there).
34. `/admin/supplier-invoices` and the S7 editor are unaffected.
