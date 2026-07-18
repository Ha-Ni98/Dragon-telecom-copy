# Stage 02 — Audit Fixes (single-session execution plan)

**Mode:** Light mode (workflow.md §8). No sprint file, no phase gate — execute every action below in this one session, in order.
**Authority:** This file states WHAT. `back-end-rules.md` / `module-implementation-rules.md` / `test-rules.md` still govern HOW. `contract-rules.md` governs the two contract touches (A4, B3). On any genuine WHICH conflict with a module contract, stop and ask; everything else here is pre-decided by the owner.

## Global execution rules

1. Execute actions **in the order listed** (A2 → A3 → A1 → A4 → B2 → B3 → B4). Each action is independent; a blocked action must be reported, not silently skipped, and must not stop the others.
2. **Per action:** implement → validate → **commit on green** with exactly the message given in that action's header (`fix: <id> <title>`). One commit per action, contract + api changes of the same action in the same commit (established precedent: identity/platform sprint 1 reports).
3. **Validation gate for every action:** `tsc --noEmit` clean (api; contract too when touched), `npm run lint` clean, `npm run test:unit` green, and `npm run test:int` for any action that changes runtime behavior (A1–A4, B3, B4 — export the `.env` `TEST_DATABASE_URL` first, per the sales sprint-4 report's correction). When the contract is touched, also run `npm --prefix Apps/contract run validate`.
4. **Never loosen a test to make an assertion pass.** Update tests only where this plan changes the specified behavior they assert.
5. **After all actions:** write one consolidated report at `Docs/Stage-02-Backend/results/report-audit-fixes.md` — per action: what changed (files), decisions taken, validation results, commit hash. Commit the report as `docs: audit-fixes report`.
6. **Recorded decision, no code change:** the staff-search double-write risk is resolved in favor of the **server-side `product.searched` emission**. `OBS_ROUTES.STAFF_SEARCH_BEACON` stays implemented but Stage 3 must never call it for staff/admin product searches. Add one sentence to the beacon controller's header comment stating this, include it in whichever commit touches the repo last, and restate it in the report so Stage 3 planning picks it up.
7. Out of scope, do not touch: geography seeding stays at 3 wilayas / 14 communes (owner decision on audit item B1); login rate limiting stays deferred; the 2 environment-flaky purchasing concurrency integration tests stay as documented.

---

## A2 — Admin users get real Staff rows · `fix: A2 admin users get real Staff rows`

**Why:** `database-description.md` §1: "Staff — 1:1 profile for ADMIN/STAFF users; the admin is a Staff row." Identity created Staff only for `UserType.STAFF`, which forced `SystemStaffResolver` to attribute every admin-initiated stock movement to a hidden `system.internal` placeholder and left `Order.confirmedByStaffId` null on admin confirms. The movement ledger must answer "who did this" with the actual admin.

**Changes (no schema migration — the `Staff` model already supports this):**

1. `Apps/api/src/modules/identity/identity.service.ts`
   - `createUser`: create the `Staff` profile row for **both** `ADMIN` and `STAFF` types (the `CreateUserCommand.profile` data is already collected for both). Locate the current type-conditional around the Staff create and remove it.
   - Login / JWT construction (~the `staffId` is only set `if (user.staff)` site, previously noted at identity.service.ts:515): no logic change needed once admins have Staff rows — verify the admin JWT now carries `staffId` and that `/api/me/permissions` and every `requireAuth` path still pass.
2. **Backfill:** extend the existing admin seeding path (`npm run seed:admin` script, and `prisma/seed.ts` if it also creates the admin) to **upsert** a `Staff` row for any existing `ADMIN` user missing one (idempotent, keyed on `userId`). Names: use the seed's existing admin profile values.
3. `Apps/api/src/common/utils/system-staff.utils.ts` — **keep** `SystemStaffResolver`, but it must now be reached only for actors with no `staffId` (guests / storefront clients). In `orders.service.ts` and `repairs.service.ts`, confirm every call site resolves `actor.staffId ?? systemStaff.resolve()` — with admins now carrying `staffId`, admin actions flow through the real id with **zero call-site changes**. Do not delete the resolver or its tests.
4. `orders.service.ts` — admin confirm must now set `Order.confirmedByStaffId` to the admin's real `staffId` (remove/adjust the deliberate null-for-admin carve-out documented in the orders sprint-2 report).

**Tests:** update identity unit tests asserting "no Staff row for ADMIN"; add one asserting the Staff row + `staffId` in the admin JWT. Update the orders test asserting `confirmedByStaffId` null on admin confirm to assert the real id. Add one integration assertion: an admin-driven confirm produces `StockMovement.staffId` = the admin's Staff id (not `system.internal`'s). Re-run the full orders + repairs suites (the resolver refactor precedent: behavior-preserving must be proven, not assumed).

---

## A3 — ORDER invoices copy real cost/profit · `fix: A3 order invoices carry real cost and profit`

**Why:** `billing.service.ts`'s `issueFromOrder` defaults `totalCost`/`totalProfit` (and the line's `costSnapshot`/`profit`) to 0, while `Order.costOfGoods`/`profit` hold the real FIFO figures on the very row the listener reads. Invoices are immutable snapshots — every issued one is permanently wrong.

**Changes:**

1. `Apps/api/src/modules/billing/billing.service.ts` — `issueFromOrder`: read `Order.costOfGoods` / `Order.profit` and write them to `Invoice.totalCost` / `Invoice.totalProfit` and to the single `InvoiceLine.costSnapshot` / `InvoiceLine.profit`. Null-guard: if either is null on a confirmed order (should be impossible per orders BL#3), fall back to 0 and log a warning — do not throw inside a listener.
2. If `resolveCurrentAverageCosts` is still SALE-origin-only (billing sprint-6 note), extend it to ORDER-origin (direct `Order.productId`, no line-correlation ambiguity) so the admin invoice view's `currentAverageCost` join works for ORDER invoices too.

**Tests:** update `billing.service.spec.ts`'s "ORDER issue … cost/profit default 0" case to assert the copied figures. Add/extend one integration assertion in the existing place→confirm→invoice flow: the issued ORDER invoice's `totalCost`/`totalProfit` equal the confirmed order's stored values. Statistics needs no change (it already reads `Order.profit`), but delete/update its "zeroed ORDER-invoice cost" workaround comment if one exists in code.

---

## A1 — `sales-by-category` groups by client category · `fix: A1 sales-by-category groups by client category`

**Why:** Statistics read "category" as `Product.family`. The spec's dimension is the **client category tier** (VIP/Premium/…): the report's purpose is "how much discount does each tier really get." The family split already exists as the `sales-by-family` chart — the current reading duplicates it.

**Changes:**

1. `Apps/api/src/modules/statistics/statistics.service.ts` — the `sales-by-category` branch of `getReport`: regroup over COMPLETED sales by `Sale.posClient.categoryId` → `ClientCategory.name`, with sales having no `posClientId` (or a category-less POS client) in a **"No client / default price"** bucket. Row columns: category name, sales count, quantity, revenue (Σ `unitPrice×qty`), resolved revenue (Σ `resolvedPrice×qty`), **discount** = Σ `(resolvedPrice − unitPrice)×qty`, cost, profit. Chart: revenue per category. Keep the drill id = categoryId (nullable for the bucket).
2. Do **not** touch `sales-by-family` (the chart) — it stays the product-family dimension.

**Tests:** rewrite the `sales-by-category` unit cases for the new grouping (two tiers + the no-client bucket; discount math asserted against a deliberate per-line override fixture). One integration case: two confirmed sales under different categories land in different rows with correct discount figures.

---

## A4 — Expose `SaleLine.id` in `SaleDto.lines` · `fix: A4 expose sale line ids for returns`

**Why:** `CreateReturnCommand.lines[].saleLineId` requires the internal SaleLine UUID and no documented response exposes it — the returns screen (ADM-10) cannot be built. Contract change, owner-approved.

**Changes:**

1. `Apps/contract/src/modules/sales/sales.dtos.ts` — add `id: z.uuid()` to `SaleResponseSchema.lines[]` (and thereby `SaleDto`). Additive only; touch nothing else in the schema.
2. `Apps/api/src/modules/sales/sales.mapper.ts` — map `SaleLine.id` into the line DTO. `ReceiptDto.lines` stays **unchanged** (customer-facing paper, per the sales sprint-5 narrowing decision).
3. `Apps/api/test/integration/sales.integration.spec.ts` — the return test currently fetches `saleLineId` via direct `prisma.saleLine` query (the flagged test-only expedient). Change it to obtain the id **through the API** (`GET` the sale detail, read `lines[].id`) — this is the proof the gap is closed.

**Tests:** sales mapper spec asserts `id` present and a valid uuid; contract validate green; the reworked integration return flow green.

---

## B2 — Drop unpersisted order fields from the contract · `fix: B2 drop order note and return reason from contract`

**Why:** `Order` has no `note` or return-reason column; both fields are validated then silently dropped. Owner decision: remove them from the contract rather than migrate. **Scope guard:** only these two — sales' `CreateReturnCommand.reason` (backed by `Return.reason`) and repairs' status `note` (backed by `RepairStatusHistory.note`) are untouched.

**Changes:**

1. `Apps/contract/src/modules/orders/orders.command.ts` — remove `note` from `PlaceOrderCommand`; remove `reason` from `ReturnOrderCommand`. Leave `UpdateOrderStatusCommand.reason` / cancel's reason **as is** (backed by `Order.cancellationReason`).
2. `Apps/api/src/modules/orders/` — remove the silent-drop handling (`toPersistencePlace`'s note passthrough comment, any mapper/controller mention), and update `test/data/order.factory.ts` + any unit/integration fixture that sends `note` or return `reason`.
3. Delete the two "flagged, not fixed" inline comments that documented the gap (orders sprint 1 & 2 reports' code markers) — the gap no longer exists.

**Tests:** contract validate green; a request still sending `note` must now be rejected by Zod's strict handling exactly as any unknown field is in this codebase (assert consistently with existing unknown-field behavior — do not invent a new strictness policy here).

---

## B3 — Server-side product sort · `fix: B3 product list sort enum and ordering`

**Why:** The catalog is paginated server-side (15/page); client-side sorting can only reorder the current page, so "price ascending" would be wrong everywhere past page 1. The sort keys come from Stage 0's page spec PUB-02: newest, price asc/desc, name.

**Changes:**

1. `Apps/contract/src/modules/catalog/catalog.enums.ts` — add `ProductSort { NEWEST='newest', PRICE_ASC='price_asc', PRICE_DESC='price_desc', NAME='name' }`.
2. `Apps/contract/src/modules/catalog/catalog.query.ts` — `ProductListQuery.sort` changes from `z.string().optional()` to `z.enum(ProductSort).optional()` (this resolves the Stage-01 sprint-2 open item; note it in the report).
3. `Apps/api/src/modules/catalog/catalog.service.ts` — public list `orderBy` mapping: `newest → createdAt desc` (default when absent), `name → name asc`, `price_asc|price_desc → guestPrice asc|desc with nulls last` (Prisma `{ sort, nulls: 'last' }`). **Recorded limitation (state it in code comment + report):** price sort uses the public reference price (`guestPrice`); a tier-priced client's resolved prices may deviate slightly from this ordering — per-viewer price sorting would require per-row resolution and is explicitly out of scope.
4. Apply the same mapping to the staff/admin lists only if they already accept `sort` via the same query schema; do not add sort params to endpoints that don't have them.

**Tests:** query-schema conformance (invalid sort value → 400); service unit cases for each of the four orderings incl. null-guestPrice placement; one integration case: `?sort=price_asc` returns ascending across a seeded set with one null-guestPrice product last.

---

## B4 — Extend `TopProductDto` to the page requirement · `fix: B4 top products carry brand family averagePrice image`

**Why:** ADM-15 specifies top products as: product, brand, family, totalSold, revenue, averagePrice, image. The inferred local shape has only `{productId; productName; quantitySold; revenue}`.

**Changes:**

1. `Apps/api/src/modules/statistics/statistics.mapper.ts` — extend the **local** `TopProductResponseSchema`/`TopProductDto` (it is deliberately non-contract; keep it local): add `brandName: string`, `familyName: string`, `averagePrice: number` (= revenue / quantitySold, guard division by zero), `imageUrl: string.optional()` (the product's primary image, omitted when none).
2. `Apps/api/src/modules/statistics/statistics.service.ts` — `getTopProducts`: join `Product → brand, family, images (isPrimary first)`; compute `averagePrice`; ranking stays by `quantitySold` (the sprint-8 inference, unchanged).

**Tests:** mapper spec for the new fields incl. image-absent omission and the zero-quantity guard; the existing service/integration top-products assertions extended to the new shape.

---

## Definition of done

- 7 commits in order: `fix: A2 …`, `fix: A3 …`, `fix: A1 …`, `fix: A4 …`, `fix: B2 …`, `fix: B3 …`, `fix: B4 …`, plus `docs: audit-fixes report`.
- Full unit suite green; integration suite green except the 2 documented purchasing concurrency tests (unchanged count — if that count changes in either direction, investigate and report before committing).
- Contract package validates green; no new circular dependency (`madge`).
- `Docs/Stage-02-Backend/results/report-audit-fixes.md` written, covering every action + the §6 recorded decision, and explicitly restating for Stage 3: **staff/admin product searches are logged server-side only — the frontend must not call `STAFF_SEARCH_BEACON`**, and **`SaleDto.lines[].id` is now the returns screen's line identifier**.
