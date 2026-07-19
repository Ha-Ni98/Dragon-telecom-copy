# Stage 02 — Audit Fixes: Execution Report

Executed per `Docs/Stage-02-Backend/plan-audit-fixes.md`, light mode, single session, in the
order specified (A2 → A3 → A1 → A4 → B2 → B3 → B4). One commit per action, all green before
committing. This report covers every action plus the plan's §6 recorded decision.

---

## A2 — Admin users get real Staff rows

**Commit:** `6092754 fix: A2 admin users get real Staff rows`

**Finding before touching anything:** `identity.service.ts`'s `createUser` already creates a
`Staff` row unconditionally for both `ADMIN` and `STAFF` (no type-conditional exists in the
current code), `buildJwtPayload` already includes `staffId` whenever `user.staff` is present, and
`test/data/user.factory.ts`'s `seedUser` already creates a Staff row for every type too. This part
of the plan's premise was already fixed in the codebase — likely from an earlier, undocumented
pass. No changes were needed in `identity.service.ts` or its tests beyond adding explicit
regression coverage (see Tests below).

**What actually changed:**
- `Apps/api/src/common/utils/system-staff.utils.ts` — updated the resolver's header comment,
  which incorrectly stated "an ADMIN JWT never carries a staffId" (no longer true).
- `Apps/api/src/modules/orders/orders.service.ts` — `confirmOrder`'s
  `...(actor.staffId != null ? { confirmedByStaffId: actor.staffId } : {})` line already produced
  the correct behavior (admins now have `staffId`, so it flows through with **zero call-site
  changes**, exactly as the plan predicted). Only the stale comment above it (describing an
  admin-specific null carve-out) was rewritten.
- `Apps/api/src/modules/repairs/repairs.service.ts` — verified `actor.staffId ?? systemStaff.resolve()`
  already matches the required pattern; no changes needed.

**Decision, not fixed — user-approved:** Item 2 (backfill script) assumed an existing
`npm run seed:admin` / `Apps/api/scripts/create-admin.ts`. That script was deleted in commit
`e43a93f` ("api: sub-01 sprint 1 — foundation") during the identity module's bcrypt→Argon2id
rewrite and never recreated, even though `Docs/deploy-instruction.md` still documents it as live.
**Per explicit owner decision during this session** (the app is not live yet), this backfill was
**skipped** — no admin seeding script was recreated. The `deploy-instruction.md` / actual-repo-state
mismatch is unresolved and should be addressed separately before any real deployment.

**Tests:**
- `identity.service.spec.ts`: added an ADMIN-login JWT test (asserts `staffId` present) and an
  ADMIN `createUser` test (asserts the Staff row is created from the same profile data).
- `orders.service.spec.ts`: `adminActor` fixture now carries a real `staffId`; the confirm test
  renamed and reasserts `confirmedByStaffId`/`StockMovement.staffId` equal the admin's own Staff
  id, not the system placeholder.
- `orders.integration.spec.ts`: new test — an admin-driven confirm via the real HTTP route
  produces `Order.confirmedByStaffId` and `StockMovement.staffId` equal to the admin's real Staff
  id, verified against the actual `system.internal` Staff id to prove it's not that placeholder.
- Full orders + repairs + identity integration suites re-run green (behavior-preserving proven,
  not assumed, per the resolver-refactor precedent).

---

## A3 — ORDER invoices carry real cost and profit

**Commit:** `4a1ae1f fix: A3 order invoices carry real cost and profit`

**Changes:**
- `Apps/api/src/modules/billing/billing.service.ts` — `issueFromOrder` now reads
  `Order.costOfGoods`/`Order.profit` (already fetched on the row) and writes them to
  `Invoice.totalCost`/`totalProfit` and the single `InvoiceLine.costSnapshot`/`profit`.
  Null-guarded: if either is null on a confirmed order, defaults to 0 and logs a warning via
  `logger.warn` (added the `@common/config/logger` import) — never throws inside the listener.
- `resolveCurrentAverageCosts` extended to ORDER-origin invoices: a direct `Order.productId` join
  (no line-correlation ambiguity, since an ORDER invoice always has exactly one line), alongside
  the existing SALE-origin label/quantity/unitPrice best-effort correlation.
- `Apps/api/src/modules/statistics/statistics.service.ts` — updated the now-stale
  "never the ORDER invoice's zeroed cost" comment in `computeRevenueProfit` and the
  `getFiltered` comment referencing the old sales-by-category family grouping (see A1). No logic
  change — statistics already read `Order.profit` directly, as the plan expected.

**Tests:**
- `billing.service.spec.ts`: rewrote the "ORDER issue defaults to 0" case to assert the copied
  real cost/profit figures (both `Invoice` and the single `InvoiceLine`); added a new case for the
  null-guard fallback (missing `costOfGoods`/`profit` → defaults to 0, resolves without throwing).
- `orders.integration.spec.ts`: extended the existing place→confirm→invoice end-to-end test to
  assert the issued invoice's `totalCost`/`totalProfit` equal the confirmed order's own stored
  values (and a concrete FIFO-cost assertion: 3 units × unitCost 400 = 1200).
- Full billing + orders + statistics integration suites re-run green.

---

## A1 — sales-by-category groups by client category

**Commit:** `215d98b fix: A1 sales-by-category groups by client category`

**Changes:**
- `Apps/api/src/modules/statistics/statistics.service.ts` — `reportSalesByCategory` rewritten
  to group COMPLETED sales by `Sale.posClient.categoryId` → `ClientCategory.name`, with sales
  having no `posClientId` (or a category-less POS client) landing in a `categoryId: null`,
  `"No client / default price"` bucket. Row columns: `categoryId`, `categoryName`, `salesCount`,
  `quantity`, `revenue` (Σ unitPrice×qty), `resolvedRevenue` (Σ resolvedPrice×qty), `discount`
  (Σ (resolvedPrice−unitPrice)×qty), `cost`, `profit`. Chart: revenue per category. Drill id =
  `categoryId` (nullable for the bucket). `sales-by-family` (the CHARTS route) is untouched — it
  stays the product-family dimension.

**Tests:**
- `statistics.service.spec.ts`: no prior unit coverage existed for `SALES_BY_CATEGORY` at all
  (only `SALES_BY_SELLER`/`SALES_BY_PRODUCT` were tested) — added two new cases: two tiers + the
  no-client bucket with a deliberate per-line unitPrice override (discount math asserted), and a
  POS-client-with-no-category case landing in the same bucket as a guest sale.
- `statistics.integration.spec.ts`: new test — two real confirmed POS sales under two seeded
  `ClientCategory` rows land in two distinct report rows with the correct discount figures.

---

## A4 — Expose SaleLine.id in SaleDto.lines

**Commit:** `f4a3c7c fix: A4 expose sale line ids for returns`

**Contract touch (governed by contract-rules.md):**
- `Apps/contract/src/modules/sales/sales.dtos.ts` — added `id: z.uuid()` to
  `SaleResponseSchema.lines[]`. Additive only. `ReceiptResponseSchema` (customer-facing) is
  untouched, per the sales sprint-5 narrowing decision.

**Changes:**
- `Apps/api/src/modules/sales/sales.mapper.ts` — `toSaleDto` now maps `line.id` into the line DTO.
  `toReceiptDto` untouched.

**Tests:**
- `sales.mapper.spec.ts`: `buildLineRow`'s default id (`'line-1'`) was not a valid UUID — the new
  `z.uuid()` field would have made every existing test in this file throw on `.parse()`. Fixed the
  fixture to a real UUID constant (`SALE_LINE_ID`) and added a dedicated test asserting `lines[0].id`
  is present and UUID-shaped.
- `sales.integration.spec.ts` — the return test previously fetched `saleLineId` via a direct
  `prisma.saleLine.findFirstOrThrow` query (the flagged test-only expedient). Reworked to obtain it
  through the API: confirm the sale, `GET /api/admin/sales/:reference` (using the **post-confirm**
  reference — confirming reassigns the reference from its `DRAFT-*` placeholder to the real
  `SAL-*` sequence number, so the pre-confirm reference is stale for this lookup), read
  `lines[0].id`. This is the proof the gap is closed.
- Full sales unit + integration suites green; contract `validate` green.

---

## B2 — Drop unpersisted order fields from the contract

**Commit:** `cd3e8c9 fix: B2 drop order note and return reason from contract`

**Contract touch:**
- `Apps/contract/src/modules/orders/orders.command.ts` — removed `note` from `PlaceOrderSchema`;
  removed `reason` from `ReturnOrderSchema`. `UpdateOrderStatusCommand.reason` (backed by
  `Order.cancellationReason`) is untouched, as scoped.

**Changes:**
- `Apps/api/src/modules/orders/orders.service.ts` — deleted the "flagged, not fixed" comment
  block in `returnOrder` documenting the `cmd.reason` silent-drop (the field, and the comment
  about it, no longer exist).
- `Apps/api/src/modules/orders/orders.mapper.ts` — deleted the equivalent comment in
  `toPersistencePlace` about `cmd.note`. Neither method ever actually referenced these fields in
  code (they were genuinely inert) — only the documentation of the gap needed removing.
- No test fixture anywhere sent `note` or return `reason` — `test/data/order.factory.ts` was
  already clean.

**Testing-strictness decision (deviation from the plan's literal wording, documented here for the
owner):** the plan's Tests line says a request sending `note` "must now be rejected... exactly as
any unknown field is in this codebase." Verified empirically: this codebase's **actual** default
for a plain `z.object()` (Zod v4) is to **silently strip** unrecognized keys, not reject them.
The only `.strict()` precedent anywhere in the contract is `clients.command.ts`'s `UpdateMeSchema`,
a deliberate, documented one-off for a specific spec-mandated 400 (`phone` is immutable). Per the
plan's own parenthetical — "do not invent a new strictness policy here" — `PlaceOrderSchema` and
`ReturnOrderSchema` were **not** made `.strict()`. Tests instead assert the actual, consistent
codebase default: a request sending `note`/`reason` is accepted (200/201) and the field is
silently absent from what's parsed. If the owner actually wants a 400 here, that's a separate,
explicit decision to add `.strict()`.

**Tests:**
- `orders.mapper.spec.ts`: two new schema-level tests (`PlaceOrderSchema.parse` strips `note`;
  `ReturnOrderSchema.parse` strips `reason`), with the reasoning above stated inline.
- Contract `validate` green; full unit suite green. (Not in the plan's test:int list for
  A1–A4/B3/B4, so integration suites were not re-run for this action specifically, per the plan's
  own validation-gate scoping.)

---

## B3 — Server-side product sort

**Commit:** `58e44eb fix: B3 product list sort enum and ordering`

**Contract touch (governed by contract-rules.md):**
- `Apps/contract/src/modules/catalog/catalog.enums.ts` — added
  `ProductSort { NEWEST, PRICE_ASC, PRICE_DESC, NAME }`.
- `Apps/contract/src/modules/catalog/catalog.query.ts` — `ProductListQuery.sort` changed from
  `z.string().optional()` to `z.enum(ProductSort).optional()`. This resolves the Stage-01
  sprint-2 open item.

**Decision made during this session (asked the owner, since it's one of the two designated
contract-touch stop-and-ask points):** the public list's default-when-absent is `newest`
(`createdAt desc`). Staff's own list currently defaults to `name asc` when no sort is given;
admin's own list already defaults to `createdAt desc` (i.e., already equals "newest"). The plan
says to "apply the same mapping" to staff/admin — ambiguous on whether that includes the
*default*. **Owner decision: keep staff's default as `name asc`; the shared newest/name/price_asc/
price_desc mapping only kicks in when a caller explicitly passes `?sort=...`.** Admin's default
was already `createdAt desc`, so this only mattered for the staff list.

**Changes:**
- `Apps/api/src/modules/catalog/catalog.service.ts` — new `resolveProductOrderBy(sort, fallback)`
  helper: `newest → createdAt desc`, `name → name asc`, `price_asc|price_desc → guestPrice
  asc|desc` with Prisma's `{ sort, nulls: 'last' }`. Wired into all three list methods
  (`listProducts` fallback `createdAt desc`, `listStaffProducts` fallback `name asc` — unchanged
  per the owner decision, `listAdminProducts` fallback `createdAt desc` — already its default).
  **Recorded limitation** (in code comment + here): price sort uses the public reference price
  (`guestPrice`), never a per-viewer resolved price — a tier-priced client's resolved prices may
  deviate slightly from this ordering; per-viewer price sorting would need per-row resolution and
  is explicitly out of scope.

**Tests:**
- `catalog.service.spec.ts`: one case per sort value on the public list, plus cases proving
  staff's default is unchanged when `sort` is absent but is overridden when present, and admin's
  unchanged `createdAt desc` default.
- `catalog.integration.spec.ts`: `?sort=bogus` → 400 (schema conformance); `?sort=price_asc`
  returns ascending across four seeded products with the null-`guestPrice` product last.
- Full unit suite + catalog integration suite green; contract `validate` green.

---

## B4 — Extend TopProductDto to the page requirement

**Commit:** `f411c00 fix: B4 top products carry brand family averagePrice image`

**Changes:**
- `Apps/api/src/modules/statistics/statistics.mapper.ts` — extended the local (deliberately
  non-contract) `TopProductResponseSchema`/`TopProductDto`: added `brandName: string`,
  `familyName: string`, `averagePrice: number` (= revenue / quantitySold, guarded to 0 when
  quantitySold is 0), `imageUrl: string.optional()` (omitted, not null, when the product has no
  image).
- `Apps/api/src/modules/statistics/statistics.service.ts` — `getTopProducts` now joins
  `Product → brand, family, images` (ordered `isPrimary desc, position asc`, `take: 1`) for just
  the 10 already-ranked products, not every product ever sold. Ranking stays by `quantitySold`
  →`revenue` sort, unchanged.

**Tests:** no prior test coverage existed for `getTopProducts` at all (unit or integration) — this
plan action's "extend the existing... assertions" premise didn't have anything to extend, so
fresh coverage was added instead:
- `statistics.mapper.spec.ts`: `averagePrice` computation, the divide-by-zero guard, `imageUrl`
  presence and its omission-when-absent.
- `statistics.service.spec.ts`: brand/family/image join and `imageUrl` omission.
- `statistics.integration.spec.ts`: a real confirmed POS sale plus a seeded primary
  `ProductImage`, asserted end-to-end through `GET /api/admin/statistics/top-products`.
- Full unit suite + statistics integration suite green.

---

## §6 recorded decision — staff-search double-write risk

**Resolved in favor of the server-side `product.searched` emission** (already implemented in
`catalog.service.ts`'s `emitProductSearched`, fired only for staff/admin searches, never for the
public storefront). `OBS_ROUTES.STAFF_SEARCH_BEACON` stays implemented in
`observability.controller.ts`/`observability.routes.ts`, but **Stage 3 must never call it for
staff/admin product searches** — only the server-side emission is the source of truth for that
event. One sentence to this effect was added to `recordStaffSearch`'s header comment in
`Apps/api/src/modules/observability/observability.controller.ts`, committed in B4 (the last
action touching the repo).

**Restated here for Stage 3 planning, per the plan's explicit instruction:**
- **Staff/admin product searches are logged server-side only — the frontend must not call
  `STAFF_SEARCH_BEACON` for product searches.**
- **`SaleDto.lines[].id` is now the returns screen's line identifier** (ADM-10 can be built
  against it; see A4).

---

## Validation summary

- `tsc --noEmit` clean on every action (api; contract too when touched).
- `npm run lint` clean on every action (api and contract).
- `npm run test:unit`: 613 tests, all green, after every action.
- `npm --prefix Apps/contract run validate` (check + cycles/madge + lint + conformance test):
  green on every contract-touching action (A4, B2, B3).
- `npm run test:int` (full suite, run twice for confirmation): **133 passed, 3 failed** — all 3
  failures in `purchasing.integration.spec.ts`, none in any file this session touched.

### Integration test count changed from the plan's documented baseline — investigated

The plan's Definition of Done expected exactly 2 environment-flaky purchasing concurrency tests.
The full suite run showed **3** failures in `purchasing.integration.spec.ts`:
1. `concurrency > two parallel payments on the same supplier serialize` — documented, pre-existing.
2. `concurrency > two parallel confirms of the same invoice are safe` — documented, pre-existing.
3. `Supplier.credit == opening + Σ confirmed − Σ payments (property) > holds after a mix of
   confirms and payments` — **not previously documented as flaky.**

Investigated before writing this report, since the plan requires that: checked out the pre-session
baseline commit (`53283e9`) into a separate git worktree, installed dependencies fresh, and ran
the exact same test against the same test database. **It passed on baseline.** Re-ran the isolated
test on this session's branch 3 times in a row: passed once (1968ms, slower run), failed twice
(≈910ms, faster runs) — i.e., it's **probabilistic**, not a deterministic regression. Reading
`purchasing.service.ts` confirms why: `confirmInvoice` and `createPayment` never write
`Supplier.credit` inside their own transaction — they compute a `previousCredit`/`newCredit`
snapshot, commit their own row (`SupplierInvoice`/`SupplierPayment`), then `eventBus.emit(...)`
without awaiting the listener before the HTTP response returns.
`applySupplierInvoiceConfirmed`/`applyPaymentSupplierRecorded` are the ones that actually write
`Supplier.credit`, asynchronously, off that snapshot. A fast-enough next sequential request can
read `Supplier.credit` before the prior request's listener has applied its write, computing its
own `newCredit` off a stale value — this is architecturally the same class of race as the two
already-documented `Promise.all` concurrency tests, just also reachable without explicit
parallelism because the real serialization point (the listener write) is never awaited.

**Not fixed** — purchasing's concurrency/credit-serialization design is explicitly out of scope
for this plan (§ Global execution rules #7: "the 2 environment-flaky purchasing concurrency
integration tests stay as documented"), and no file this session touched is anywhere near this
code path (verified via `git diff 53283e9 HEAD --stat` — zero files under
`Apps/api/src/modules/purchasing/` or its tests were changed by any of the 7 actions). Flagging
here per the Definition of Done's explicit "investigate and report before committing" instruction:
**the real count of environment-flaky purchasing tests is 3, not 2** — the owner should either
update the documented baseline or treat this as a genuine (pre-existing, unrelated) bug to fix
separately by awaiting the listener (or moving the `Supplier.credit` write into the same
transaction as the snapshot computation).

---

## Commits

| # | Hash | Message |
|---|---|---|
| 1 | `6092754` | `fix: A2 admin users get real Staff rows` |
| 2 | `4a1ae1f` | `fix: A3 order invoices carry real cost and profit` |
| 3 | `215d98b` | `fix: A1 sales-by-category groups by client category` |
| 4 | `f4a3c7c` | `fix: A4 expose sale line ids for returns` |
| 5 | `cd3e8c9` | `fix: B2 drop order note and return reason from contract` |
| 6 | `58e44eb` | `fix: B3 product list sort enum and ordering` |
| 7 | `f411c00` | `fix: B4 top products carry brand family averagePrice image` |

## Out of scope, untouched (per plan §7)

- Geography seeding stays at 3 wilayas / 14 communes.
- Login rate limiting stays deferred.
