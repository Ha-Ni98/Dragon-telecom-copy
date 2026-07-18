# Sprint 1 Report — Orders: Foundation (mapper, interface, factories)

**Set:** 07 (orders + repairs + statistics) · **Module:** orders · **Layer:** foundation
**Status:** ✅ Done

---

## What was built

- **`src/modules/orders/orders.mapper.ts`** — `OrdersMapper` (static/pure):
  - `toOrderDto(order: OrderRow, ctx: { includeMargins; now? })` — field-listed (never spreads
    `Order`); `Decimal → number` via a private `toMoney`; `Date → ISO`; Prisma `OrderStatus`/
    `OrderType` cast to the contract enums (same nominal-type invariant sales/purchasing rely
    on). Margin-gated: `costOfGoods`/`profit` are omitted both when `includeMargins===false`
    (staff) **and** when the columns are still `null` (order not yet confirmed) — both cases are
    `.optional()` on the DTO so omission parses either way. `wilaya`/`commune`/`address` are
    included only when the joined row carries them (naturally null for PICKUP, since
    `Order.wilayaId`/`communeId` are null on those rows — no PICKUP-specific branch needed).
    `canBeCancelled = status === OrderStatus.PENDING`. `ageHours` delegates to a public static
    `ageHours(since, now = new Date())` helper, mirroring `InventoryMapper.ageHours` exactly (a
    default param, not a `ctx`-only field) — kept the mapper deterministic for tests via the
    `now` override on `ctx`.
  - `toStatsDto(counts: Partial<Record<OrderStatus, number>>)` — maps a `groupBy status`
    roll-up onto the seven `.min(0)` fields, defaulting any missing status to `0`.
  - `toPersistencePlace(cmd, ctx: PlaceOrderContext)` — `status: PENDING`, `resolvedPrice`
    **and** `unitPrice` both set to `ctx.resolvedPrice` (frozen equal at placement, plan §I.1
    BL#1); `subtotal`/`totalAmount` computed from `ctx.resolvedPrice × cmd.quantity` (+
    `ctx.fee`); delivery fields (`wilayaId`/`communeId`/`address?`) included only when
    `cmd.orderType !== PICKUP` **and** `cmd.delivery` is present (defensive null-check rather
    than a non-null assertion — no `!.` precedent exists anywhere else in the codebase's
    mappers, confirmed by grep).
  - `ageHours(since, now?)` — public static helper (also directly unit-tested).
- **`src/modules/orders/orders.interface.ts`** — `IOrdersService` with all ten methods from
  plan §I.2, actor threaded as the contract's own `JWTPayload` (`placeOrder`'s actor is
  **optional**, since a guest never authenticates). Declared a local `CancelOrderCommand = {
  reason?: string }` type (not a contract schema) per the plan §I.2 footnote/§D-4 — `CANCEL`'s
  body is validated in the routes file (Sprint 3) via a minimal inline `z.object`, exactly like
  set 06's `CREDIT_REQUIRES_CLIENT` resolved without a new `ErrorCode`.
- **Factories** (`test/data/`):
  - `order.factory.ts` — `makeOrder(overrides)` (a plain `OrderRow` builder, reused by both this
    sprint's mapper spec and Sprint 2's service spec — kept in `test/data` rather than
    duplicated per-spec-file, since the sprints doc calls for the same joined shape in both
    places) and `seedOrder(options)` (a real DB-writing helper for the Sprint 3 integration
    suite, mirroring `seedSale`'s option/default shape).
  - `place-order.factory.ts` — `makePlaceOrderCommand(overrides)`, defaulting to PICKUP; passing
    `{ orderType: DELIVERY_HOME | DELIVERY_OFFICE }` auto-fills a matching `delivery` block so
    the schema's required-unless-PICKUP refinement is satisfied without every caller repeating
    it.
  - `payment-client-recorded.factory.ts` — `buildPaymentClientRecordedEvent(overrides)`, a plain
    (non-schema-validated) event-payload builder mirroring `repair-picked-up.factory.ts`'s
    `buildRepairPickedUpEvent`, for Sprint 2's listener spec.
- **Test:** `test/unit/modules/orders/orders.mapper.spec.ts` (23 tests) — margin gating (staff
  omits, admin keeps, and admin also omits when the columns are still null pre-confirm); PICKUP
  omits `wilaya`/`commune`/`address` with a zero fee; delivery orders surface the joined
  wilaya/commune/address; `ageHours` derivation (24h fixture); `canBeCancelled` true only while
  PENDING; `resolvedPrice`/`unitPrice` both surfaced and distinguishable; `serialNumbers`
  comma-string↔array (parse direction only — the free-text column is written at confirmation,
  not placement, so no serialize-side test belongs in this sprint); `Decimal→number`
  conversions; `toStatsDto` roll-up + all-zero default; `toPersistencePlace` freezing/
  computation/PICKUP-omission/delivery-inclusion/`clientId` resolution; a `.parse` never-throws
  guard; plus a direct `ageHours` unit.

## Deviations from the plan (and why)

- **`toOrderDto`'s margin gate also checks column-nullness, not only `includeMargins`.** The
  plan's wording ("omit … when `includeMargins===false`; admin keeps them") reads as a pure
  actor-type gate, but `Order.costOfGoods`/`profit` are genuinely `null` until confirm (BL#3).
  If the mapper included them unconditionally for `includeMargins:true`, `OrderResponseSchema
  .parse` would still succeed (both fields are `.optional()`, and the spread guard already
  keys off `!= null`), so this isn't a correctness bug either way — but omitting the spread
  guard entirely (i.e. keying **only** off `includeMargins`) would attempt `toMoney(null)` and
  throw. Kept both conditions (`ctx.includeMargins && order.costOfGoods != null`) as the only
  form that's actually safe; documented inline. No plan conflict — this is filling in a detail
  the plan's prose left implicit.
- **No `note` persistence.** `PlaceOrderCommand.note` is contract-valid input, but `Order` (the
  Prisma model, unchanged in this set) has no `note` column at all, and `OrderDto` doesn't
  surface one either — it is accepted by validation and silently dropped by
  `toPersistencePlace`. This is a genuine, non-blocking gap (schema doesn't support it, plan §0
  confirms no migration this set) — same "flagged, not fixed" precedent as set 06's
  `SaleDto.lines` missing `id`. Flagging here for whoever revisits the schema later; no test
  asserts on `note` since there is nothing to assert.
- **Test-fixture-only fix:** two mapper-test IDs (`'w-1'`/`'c-1'`) initially used non-UUID
  placeholder strings, which `OrderResponseSchema`'s `z.uuid()` correctly rejected on first
  run — replaced with fixed-format UUID constants (`WILAYA_ID`/`COMMUNE_ID`). Not a mapper
  defect; the schema conformance guard caught a sloppy fixture exactly as it should.

## Validation

- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green — **504/504 tests, 35 files** (23 new orders-mapper tests; no
  regressions elsewhere). `test:int` not run this sprint — no route is wired yet (N/A per the
  sprint's own validation checklist).
- [x] `npm run lint` clean (`src test prisma`, no findings).
- [x] Mapper is static/pure and field-listing (no entity spread anywhere); returns only contract
  DTOs (`OrderDto`/`OrderStatsDto`), each via a `.parse()` conformance guard; no route/DTO/enum
  re-declared — every import (`OrderResponseSchema`, `OrderStatsResponseSchema`, `OrderStatus`,
  `OrderType`, `PlaceOrderCommand`) comes straight from `@dragon-telecom/contract` (plan §0).
- [x] Committed on green.

## Next sprint

Sprint 2 — Orders: Logic (service + listener). `OrdersService` will consume `OrdersMapper` +
`IOrdersService` as built here; `makeOrder`/`makePlaceOrderCommand`/
`buildPaymentClientRecordedEvent` are ready for its service/listener specs.
