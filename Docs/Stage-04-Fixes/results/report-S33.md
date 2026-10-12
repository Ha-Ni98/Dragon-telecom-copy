# Report — Set 33 (Cash register / Caisse page)

Executed against `Docs/Stage-04-Fixes/plans/plan-S33-cash-register.md`, all actions,
2026-10-12, on top of committed S30–S32. This is the last set of the S30–S33 programme.

**Gates:** contract, api and web pass `tsc --noEmit` with zero errors outside test files. Lint is
clean on every touched file; api lint shows only its 7 pre-existing errors. Test-file compile
counts are unchanged (api 198 in 29 files, web 52). No test file was read for editing, edited or
run. **One schema-only migration, applied to the dev database. No data was changed or deleted.**

---

## Decisions

### Owner decisions (taken while planning)

| # | Question | Answer |
|---|---|---|
| Q1 | Suppliers: "total paid"? | **Payments made that day** (`SupplierPayment.paidAt`), whichever invoice they settle. New supplier credit = invoiced that day − paid that day. |
| Q2 | Supplier invoice anchor? | **New `SupplierInvoice.confirmedAt`**, set at confirm. No backfill. |
| Q3 | Orders "confirmed and in delivery"? | **New `Order.inDeliveryAt`**, set at IN_DELIVERY. Two counts. No backfill. |
| Q4 | Returns scope? | **Sale and order returns**, by `returnedAt`. Accepted caveat: an order return stores the refund the operator typed, which can exceed the cash refunded. |

### Plan decisions (applied as written)

| # | Decision |
|---|---|
| P1 | The Caisse lives in the statistics module: two new admin-only `STATS_ROUTES`. |
| P2 | Drill-through is an in-page dialog fed by one paginated endpoint covering 9 drill targets. |
| P3 | Repairs "paid" is **gross** (`paidAmount + refundedAmount`), and "unpaid" is total − gross paid, so a later return never rewrites the pickup day. |
| P4 | Repair refunds are dated on `cancelledAt` / `returnedAt` and read from `Repair.refundedAmount` (walk-ins included). |
| P5 | The repair refund card appears only on days with a refund. |
| P6 | No new indexes. |
| P7 | Drill rows have no status column and no onward link. |
| P8 | Drill page size 20 (max 100), oldest first. |
| P9 | Admin-only on both sides: API `adminOnly`, and the web route behind a nested `RoleGuard allow={[ADMIN]}`. |

### Small deviations from the plan

- **Walk-in label:** the drill dialog reuses the existing `staff.sales.table.counter`
  ("Comptoir", the label the Sales and Returns tables already use) instead of adding
  `admin.cashRegister.drill.walkIn`. So **38** keys were added: the plan's 40-row table minus that
  key and minus `admin.cashRegister.refresh` (`common.actions.refresh` already existed, as the plan
  had already noted).
- **Checklist step 2 is corrected.** The plan said the sidebar never offers the Caisse to staff.
  In fact the admin sidebar lists every admin entry to anyone inside `/admin`, which is
  pre-existing behaviour (Statistics is the same). The route guard is what blocks staff. The
  checklist below says so.
- **Wording:** drill types and section props live in `types/cash-register.types.ts`, which also
  gained `CashRegisterDrillTarget` (the dialog's current target), and the dialog takes
  `target`/`onClose` rather than separate `drill`/`titleKey`/`open` props.

---

## Findings

- **F1 — supplier "last delivery" reads `updatedAt`, which payments bump.** `getLastDeliveryAt`
  and `getProductHistory` claimed `updatedAt == confirm time`. That is false: `createPayment`
  updates the invoice. Only the comments were corrected. Switching to `confirmedAt` would blank
  them for every pre-S33 invoice.
- **F2 — client "Record payment" cash appears in no section.** This is a gap in the brief's
  section list, not a bug. It could be added later as one more `ClientPayment` aggregate.
- **F3 — repair deposits land on the pickup day,** because the brief anchors repairs on
  `pickedUpAt`.
- **F4 — repairs and purchasing hooks don't invalidate `qk.stats.all()`.** The Caisse hooks use
  `staleTime: 0` and the page has a Refresh button. Other hooks were not touched.

---

## Migration (verbatim)

`Apps/api/prisma/migrations/20261012120000_s33_cash_register_timestamps/migration.sql`, generated
with `prisma migrate diff` (non-interactive shell), applied with `prisma migrate deploy`, client
regenerated. The test database was not migrated.

```sql
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "inDeliveryAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SupplierInvoice" ADD COLUMN     "confirmedAt" TIMESTAMP(3);
```

---

## What changed

### Database / Prisma
- `schema.prisma`: `SupplierInvoice.confirmedAt DateTime?`, `Order.inDeliveryAt DateTime?`, each
  commented.

### Contract (`Apps/contract/src/modules/statistics`)
- `statistics.enums.ts`: `CashRegisterDrill` (9 targets).
- `statistics.query.ts`: `CashRegisterQuerySchema` (`date?`), `CashRegisterDocumentsQuerySchema`
  (`date?`, `drill`, `page`, `limit ≤ 100`).
- `statistics.dtos.ts`: `CashRegisterResponseSchema` (five sections) and
  `CashRegisterDocumentResponseSchema` (uniform drill row).
- `statistics.routes.ts`: `CASH_REGISTER`, `CASH_REGISTER_DOCUMENTS`.

### API (`Apps/api/src/modules`)
- `purchasing.service.ts`: `confirmInvoice` stamps `confirmedAt` (double-confirm paths return
  before it, so the first stamp is never overwritten). F1 comments corrected in
  `getLastDeliveryAt` / `getProductHistory`, code unchanged.
- `orders.service.ts`: the forward transition stamps `inDeliveryAt` on IN_DELIVERY.
- `statistics.service.ts`:
  - **`getCashRegister`:** computes `storeDayRangeUtc(date, date)` once and runs 9 Prisma
    aggregates in one `Promise.all`. No document rows are loaded.
  - **`getCashRegisterDocuments`:** one `switch` over the 9 drill targets. Each target runs a
    count + page in `$transaction`, selects only what it needs, and orders by its anchoring
    timestamp (REPAIR_REFUNDS orders by reference, because it has two anchors).
  - **Nine private where-builders,** one per figure, shared by both methods (the "list equals
    figure" guarantee).
  - New module constant `CASH_REGISTER_REPAIR_PICKED_STATUSES`, a `StoreDayRange` type and a
    `round2` helper.
- `statistics.mapper.ts`: `toCashRegisterDto`.
- `statistics.interface.ts` / `statistics.controller.ts` / `statistics.routes.ts`: the two
  methods, handlers and `adminOnly` routes (documents route registered first).

### Web (`Apps/web/src`)
- `lib/utils.ts`: `formatStoreTime(iso, language)`, Algiers time of day.
- `services/statistics.service.ts`: `getCashRegister`, `getCashRegisterDocuments`.
- `lib/query-keys.ts`: `qk.stats.cashRegister`, `qk.stats.cashRegisterDocuments`, nested under
  `stats` so existing `qk.stats.all()` invalidations reach them.
- `hooks/useStatistics.ts`: `useCashRegister`, `useCashRegisterDocuments` (`staleTime: 0`).
- New `types/cash-register.types.ts`.
- New `pages/admin/cash-register/AdminCashRegister.tsx`: date picker (`max` today), Today,
  Refresh, the boundary note, five sections, skeleton and error states, one drill dialog.
- New `pages/admin/cash-register/components/cash-register-section.tsx`: a card of `StatCard`s;
  drillable figures are wrapped in a labelled button.
- New `pages/admin/cash-register/components/cash-register-drill-dialog.tsx`: `DataTable` with
  per-drill optional columns (paid / source document), local times, "Comptoir" for walk-ins,
  `SimplePagination`, and the page reset when the target or date changes.
- `App.tsx`: lazy route inside a nested `RoleGuard allow={[UserType.ADMIN]} fallbackPath="/admin"`.
- `config/nav-links.ts`: **Cash register** (`Wallet` icon) after Sales.
- `config/translations.json`: 38 keys added (en/fr, `ar: ""`), byte-safe round trip checked
  first.

### Docs (`Docs/Stage-00-Conception`)
- `database-description.md`: `SupplierInvoice.confirmedAt?` (and the missing `paidDate?`),
  `Order.inDeliveryAt?`.
- `Module-Contracts/statistics.md`: the two routes, and Business Logic item 6 (the Caisse rules).
- New `Pages-Requirements/ADM-20-cash-register.md`.

---

## Validation gate

```
contract  npx tsc --noEmit          → clean
          npm run lint              → clean
api       npx prisma validate       → valid
          npx tsc --noEmit          → src clean; test files 198 errors / 29 files (= S32 baseline)
          npm run lint              → 7 errors, all pre-existing (seed.ts ×3, validate-request ×3,
                                       orders.service ORDER_PRICE_EDIT_STATUS)
web       npx tsc --noEmit          → clean
          npx eslint --fix <10 touched files> → prettier reflowed AdminCashRegister.tsx only
          npx eslint <same files>   → clean
          npx tsc -p tsconfig.test.json → 52 errors (= S32 baseline), all pre-existing drift
```

**Read-only smoke run against the dev database** (a throwaway `tsx` script calling the real
service, deleted afterwards; no writes):
- For 2026-07-29 and 2026-10-04, every headline figure **equals the sum / row count of its drill
  list**. For example, 2026-07-29: Sales 3 / 86 100 sold / 87 100 paid (new credit −1 000);
  Returns 2 / 3 600; Repairs 2 / paid 13 100; Orders confirmed 2, completed 1 / 23 500; Supplier
  payments 1 / 37 800.
- **The day boundary holds:** rows stamped 23:10Z–23:26Z on 2026-07-28 (00:10–00:26 Algiers)
  appear on **2026-07-29**, not on the 28th.
- Pre-S33 supplier invoices and order dispatches have no new timestamps, so "Invoices confirmed"
  and "Sent out" read 0 on every past day, as expected (no backfill).

**Grep sweeps:**
1. `createdAt|updatedAt|invoiceDate|DAY_MS` inside the S33 block → only the comment that forbids
   them.
2. `storeDayRangeUtc` in the statistics service → import, one type comment, and exactly one call
   in each Caisse method.
3. A `/admin/cash-register` literal → only `App.tsx` and `nav-links.ts` (the API uses
   `STATS_ROUTES`).
4. Migrations → exactly one new `migration.sql` with two `ADD COLUMN` statements.

**Expected behavioural staleness (not run):** none known. No existing test covers the changed
`confirmInvoice` / order-transition writes beyond the extra column.

---

## §6 — Manual verification checklist (browser)

Signed in as **admin**. Keep these open in separate tabs: `/admin/cash-register`, `/admin/sales`,
`/admin/repairs`, `/admin/orders`, `/admin/supplier-invoices`, `/admin/invoices` → **Payments**,
and `/admin/inventory` → **Movements**. Before starting, note every figure the Caisse shows for
today. Each step below states the expected change after you press **Refresh**.

### A. Page and access
1. The sidebar has **Cash register** after Sales. It opens on **today**, with the boundary note
   under the title. The date picker won't go past today.
2. Sign in as a **staff** user and type `/admin/cash-register` → you are sent back to `/admin`.
   (The admin sidebar lists every admin entry to anyone inside `/admin`, staff included. That is
   pre-existing behaviour, the same as Statistics today; the route guard is what blocks it.) Sign
   back in as admin.

### B. Sales and returns
3. POS: a walk-in sale of 1 500 paid 1 500, then a sale to client **C** of 1 000 paid 600. Caisse
   → Sales: count +2, total sold +2 500, total paid +2 100, new client credit +400.
4. Click **Number of sales** → the dialog lists both sales with today's local times. The
   walk-in's party reads **Comptoir**, and the paid column shows 1 500 and 600.
5. Return 1 line of the walk-in sale (refund 500, restock on). Caisse → Returns: count +1, total
   refunded +500. The drill row shows the sale's reference as source. **Sales figures don't
   change**: the return is its own section. Movements: one RETURN IN row at the sale's cost.
6. Return a completed **order** with refund 300. Returns: count +1, refunded +300. The drill row
   shows the order reference and the order's contact name.

### C. Repairs
7. Pick up a repair of total 2 000 that has 500 paid → Repairs: count +1, paid +500, unpaid
   +1 500. The drill row shows paid 500.
8. Return that same repair (S30, full refund) → Repairs: count, paid and unpaid **don't change**
   (P3), and a **Refunded** card appears: 500 · 1. Its drill row's time is the return time.
   Payments ledger: a negative row of −500 linked to the original payment (if C has an account).
9. Cancel an INTAKE repair that had a 200 deposit → Refunded becomes 700 · 2. Repair count does
   not change (it was never picked up).
10. A walk-in repair cancelled with a deposit → refunded rises by the deposit too. There is no
    ledger row (S30 P7), and the Caisse still counts it.

### D. Orders
11. Confirm a PENDING order → Orders: confirmed +1. Move another to IN_DELIVERY → sent out +1.
12. Complete an order of total 3 000 with 3 000 paid → completed +1, paid on completed +3 000.
    Its drill row shows paid 3 000.
13. An order completed **before** S33 and moved to IN_DELIVERY before S33 never appears under
    "sent out" on any day (no backfill). This is expected.

### E. Suppliers
14. Create and confirm a supplier invoice of 10 000 → Suppliers: invoices +1, total invoiced
    +10 000, new supplier credit +10 000.
15. Record a supplier payment of 4 000 today, on an **older** invoice → paid to suppliers +4 000,
    new supplier credit +10 000 − 4 000 = **+6 000** for the day. The payments drill shows the
    older invoice's reference as source.
16. Record a supplier payment with a **past** effective date → it appears on that past day's
    Caisse, not today's.
17. An invoice confirmed before S33 never appears on any day (no `confirmedAt`). Expected.
18. `SELECT reference, "confirmedAt" FROM "SupplierInvoice" ORDER BY "createdAt" DESC LIMIT 3;`
    → the invoice from step 14 has a timestamp; older ones are NULL.

### F. Day boundary
19. Pick **yesterday** → every section shows yesterday's activity only. Pick today again → back
    to the figures above.
20. Boundary SQL check (optional): for a sale near midnight,
    `SELECT reference, "soldAt", "soldAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Algiers' AS local FROM "Sale" ORDER BY "soldAt" DESC LIMIT 5;`
    The local date in that column is the day it appears on.
21. Every headline drill list has exactly as many rows (sum of pages) as its count, and its
    amounts add up to its figure.

### G. Regression
22. `/admin/statistics` and the admin dashboard still load with the same figures as before.
23. Supplier-invoice confirm, order status changes and repair actions behave as before. The only
    new effect is the two timestamps.

---

The owner reviews and approves this report. This closes the S30–S33 programme.
