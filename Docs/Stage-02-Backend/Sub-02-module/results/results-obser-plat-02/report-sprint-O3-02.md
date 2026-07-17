# Observability — Sprint O3 Report: Logic B (the listener & narration engine)

**Status:** ✅ Done — [`sprints-obser-plat-02.md`](../sprints-obser-plat-02.md) Sprint O3 marked ✅.
**This is the module's core.**

---

## What was built

`src/modules/observability/observability.listener.ts` — `class ObservabilityListener`, injects
`IObservabilityService`. `setup()` registers **34 handlers** across 10 emitting modules (grouped
into `registerIdentity`/`registerClients`/`registerCatalog`/`registerInventory`/`registerPlatform`/
`registerPurchasing`/`registerSales`/`registerOrders`/`registerRepairs`/`registerBilling`), matching
plan §0.1's listen-list exactly: 33 audit events + 1 activity event (`product.searched`).

Every handler builds an `AuditEntry` from the **payload alone** (no cross-table reads) and calls
`service.recordAuditEvent(...)`, following the narration map from plan §3.1:
- **Verbatim `description`:** `settings.changed`, `deliveryFees.changed`, `inventory.adjusted`,
  `taxonomy.changed`, `clientCategory.changed`.
- **Structured status transitions:** `order.statusChanged`, `repair.statusChanged`.
- **Structured credit transitions:** `posClient.creditChanged`, `supplier.creditChanged`,
  `supplierInvoice.confirmed`, `payment.supplierRecorded`, `payment.clientRecorded`.
- **Simple past-tense entity events:** the rest (`user.*`, `client.*`, `product.*`,
  `order.confirmed/placed/cancelled/returned`, `repair.pickedUp/cancelled`, `invoice.*`,
  `sale.confirmed`, `return.created`).

`product.searched` bypasses the audit path entirely and calls `service.recordProductSearched`
directly — writing a `StaffSearchLog` row, never an `AuditLog` row.

`test/unit/modules/observability/observability.listener.spec.ts` — 8 tests, written before the
implementation, exercising the **real** `ObservabilityListener` + `ObservabilityService` pair (with
a mocked Prisma), driven through the real `eventBus` — not a hand-built `AuditEntry` (that's O2's
job). This is the first spec that proves the full listener→service→Prisma chain end-to-end.

---

## The core safety guarantee: never throw into the emitter

Every handler funnels through a `safeRun(eventName, fn)` helper that double-guards:

```ts
private safeRun(eventName: string, fn: () => Promise<void>): void {
  try {
    void fn().catch((err) => logger.error({ err, event: eventName }, '...'));
  } catch (err) {
    logger.error({ err, event: eventName }, '...');
  }
}
```

The **outer** `try/catch` matters as much as the `.catch()`: the synchronous `build(payload)` step
(constructing the narration string) happens *inside* `fn`'s closure, before any `await` — a bug
there (e.g. an unexpected `undefined` field) would throw **synchronously** the moment `fn()` is
invoked, before it ever returns a promise. Without the outer `try/catch`, that synchronous throw
would propagate straight back through `eventBus.emit()`'s synchronous dispatch, breaking the
"never throws into the emitter" guarantee for exactly the failure mode most likely to actually
occur (a narration-building bug), while the `.catch()` alone only covers *async* rejections from
`recordAuditEvent` itself. Both paths are exercised by the "resilience" test (a rejected
`auditLog.findFirst` call, forcing the async path) — a synchronous-throw test wasn't added since
triggering it would require deliberately breaking a `build()` function, which felt like testing a
bug rather than a behavior; the outer `try/catch`'s necessity is argued above instead.

## Test design note: one shared listener registration, not one per test

`eventBus` is a module-level singleton (real `EventEmitter` underneath). Calling `setup()` more
than once would attach duplicate listeners for the same 34 keys, permanently, for the rest of the
test file's life — a second `beforeEach`-based `setup()` call would make every subsequent emit
double-invoke the service. `setup()` is therefore called **exactly once**, in `beforeAll`, wired to
one `ObservabilityService` backed by a mocked Prisma; each test asserts on that service's
`prisma.auditLog.create`/`prisma.staffSearchLog.create` mock calls rather than needing a second,
narration-only mock service — which also means the narration tests are exercising the *real*
service's field-mapping, not a hand-wired double.

---

## Validation

- `npx tsc --noEmit` — clean. Notably: every one of the 34 handlers' payload field accesses
  (`p.orderId`, `p.totals.totalAmount`, `p.previousCredit`, etc.) matched the **real** contract
  event types on the first attempt — no field-name corrections needed. The generic
  `handle<P>(eventName, payload, build)` helper's type parameter `P` is inferred per-call from
  `eventBus.on`'s own generic (based on the literal event-name argument), so this works without
  needing the bus's internal `AppEvents` type exported.
- `npm run lint` — clean.
- `npm run test:unit` — green, **164/164** tests, 18 files (156 prior + 8 new).
- Every handler is wrapped by `safeRun`; narration is built from the payload only (no `await` on
  any DB read before constructing the `AuditEntry`, confirmed by code review of every `build`
  closure); the "resilience" test proves a failing `recordAuditEvent` doesn't propagate and is
  logged; the "idempotency" test proves the O2 dedupe check works through the real event-driven
  path (not just direct `AuditEntry` calls); `product.searched` never touches `AuditLog`.

## Committed on green

`api: observability sprint 3 — listener and narration`.
