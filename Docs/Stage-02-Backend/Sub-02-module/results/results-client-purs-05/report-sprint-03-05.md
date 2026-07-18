# Clients+Purchasing — Sprint 3 Report: Clients — Logic (service + listener)

**Status:** ✅ Done — [`sprints-client-purs-05.md`](../sprints-client-purs-05.md) Sprint 3 marked ✅.

---

## What was implemented

### `Apps/api/src/modules/clients/clients.interface.ts` (extended from Sprint 2)
Added five listener-invoked methods to `IClientsService` — `materializePosClientForApprovedClient`,
`applySaleConfirmed`, `applyOrderConfirmed`, `applyClientPaymentRecorded`, `applyReturnCreated`.
Their payload types are imported directly from the contract's own event-payload types
(`ClientsEvents['client.approved']['posClientSeed']`, `SalesEvents['sale.confirmed']`, etc.)
rather than re-declared locally, so they stay in lockstep with whatever sales/orders/billing
actually emit once built.

### `Apps/api/src/modules/clients/clients.service.ts` — `ClientsService implements IClientsService`
Constructor DI: `(prisma, identity: IIdentityProvisioningPort, sequence: ISequenceService, catalogCart: ICatalogCartPort)`
— `activityRead` dropped per Sprint 2 (observability owns `/activity` directly).

- **Phone / register**: `checkPhoneAvailability` (shared by `validatePhone` and `register`) —
  `AVAILABLE` when no `Client` row owns the phone **or** the row is `REJECTED` (a rejected
  applicant may retry — the spec's three states don't cover `REJECTED` explicitly; treated as
  the catch-all "none" case rather than a fourth blocking state). `isValid = (status ===
  AVAILABLE)` — tying validity directly to registration-availability rather than inventing an
  undocumented phone-format regex (grepped the whole repo first; no such pattern exists
  anywhere, including `RegisterClientSchema.phone`, which is a bare `z.string()`). `register`
  re-runs the check, 409s with a **status-specific** message for `REGISTERED`/`PENDING`,
  validates `wilayaId`/`communeId` (existence + commune-belongs-to-wilaya) via a new
  `assertWilayaAndCommune` helper (mirrors platform's `Unknown wilayaCode`/`Unknown communeCode`
  messaging), allocates `code` via `SequenceService(tx, DocType.CLIENT)` **inside** the same
  transaction as the `Client` row create (the connection-rule pattern inventory's
  `createAdjustment` established — sequence allocation atomic with the document it numbers),
  emits `client.registered`.
- **Approve**: one transaction — `identity.provisionClientUser({username, password}, tx)` →
  `Client` row set `APPROVED`/`approvedAt`/`approvedByStaffId`/`userId` → commit → emit
  `client.approved {clientId, posClientSeed}`. 409 when not `PENDING`. Returns a freshly-fetched
  `AdminClientDto` (correctly showing no `posClientId` yet — the listener materializes the
  `PosClient` asynchronously, post-commit, per spec).
- **Reject**: 409 when not `PENDING`; sets `REJECTED` + optional `rejectionReason`; emits
  `client.rejected`. **No `staffId` param** (Sprint 2's interface decision — no column to store
  one).
- **Reset/change password**: `resetClientPassword` (admin) and `changeMyPassword` (self) both
  409 when the `Client` has no linked `userId` (not yet approved). `changeMyPassword` reads
  `User.passwordHash` directly + compares via the shared `comparePassword` util (Sprint 2's
  documented design — no identity port call for verification), 401s
  (`ErrorCode.AUTH_INVALID_CREDENTIALS`, mirroring identity's own `login` rejection) on a wrong
  current password. Both call `identity.resetPassword(userId, newPassword)` for the actual
  write and emit `client.passwordReset`.
- **Me**: `updateMe` never writes `phone` (the command schema already omits it — the service
  adds no extra guard beyond simply not referencing it); re-validates wilaya/commune only when
  either is supplied, reusing the existing row's value for whichever wasn't given so the
  cross-check still runs against a complete pair. Money proxied from the linked `PosClient`
  (`0` when none).
- **Cart**: `getCart` short-circuits to `[]` on an empty cart (no catalog-port call);
  otherwise resolves via `catalogCart.getCartProducts` and **silently skips** any cart row whose
  product didn't resolve (defensive — in practice every row should resolve, since products are
  never hard-deleted). `addCartItem` upserts (re-adding a favorite is a no-op, not a conflict);
  `removeCartItem` uses `deleteMany` (idempotent — no throw when already absent).
- **Admin pipeline**: `listClients`/`getClient`/`clientStats`/`adminUpdateClient` — straightforward
  reads/updates. **Roll-ups** (`totalOrders`/`totalSpent`/`lastOrderDate`) are aggregated for
  real against `Order` (by `clientId` — Order has no `posClientId` column, only `Sale` does) and
  `Sale` (by the linked `PosClient.id`), **deliberately unfiltered by status** — summing every
  row rather than only "confirmed"-ish ones, since choosing which `OrderStatus`/`SaleStatus`
  values count is a business rule that belongs to the not-yet-built orders/sales modules, not
  this one. Both tables are empty today (no module writes to them yet), so this reads `0`/
  `undefined` and lights up automatically once they exist — exactly the plan's framing, now
  actually wired end-to-end rather than hand-waved.
- **PosClient CRUD**: `code` via `SequenceService(tx, DocType.POS_CLIENT)`, allocated inside the
  same transaction as the create (same pattern as register). `quickCreatePosClient` and
  `createPosClient` share one private `createPosClientRow` helper — both routes create the exact
  same row shape from the exact same command, differing only in access level (spec's "the only
  manual client creation" note distinguishes pos-client creation, either route, from the
  self-service web `Client` pipeline — not the two pos-client routes from each other).
  `posClient.creditChanged` is emitted **only** when `initialCredit` is truthy (a `0→0` create
  is a no-op event, not worth narrating).
- **Listener-invoked methods** — see below.

**Two deliberate simplifications vs. the plan's §D-3 wording** (documented in code comments,
repeated here for visibility):
1. **`credit` is never "recomputed"** — there is no stored opening-balance column separate from
   the single mutating `PosClient.credit` field (the exact same limitation `Supplier.credit`
   has), so a from-scratch recompute is impossible without inventing a new column. Instead,
   whichever event carries its own emitter-computed snapshot (`sale.confirmed.newCredit`,
   `payment.clientRecorded.newCredit`) is applied as a **`set`** (inherently idempotent — a
   replay sets the same final value); `return.created`'s `creditEffect` has no snapshot in its
   payload (spec: "a signed delta"), so it's applied as a plain increment.
2. **`totalPaid`/`totalSold` are plain increments, not a ledger-recompute SUM** — the module
   contract's own wording is literally `totalPaid += paidAmount`/`totalSold += totalAmount`, and
   a genuinely replay-safe SUM would require committing to `SaleStatus`/`OrderStatus` filtering
   rules (which values count as "confirmed") that are the **not-yet-built** sales/orders
   modules' own business rules to define — guessing them now risks conflicting with those
   modules' real design. Correctness instead relies on the emitting module firing each event
   **exactly once per document** — the identical single-emission guarantee purchasing's own
   `SupplierInvoice` DRAFT→CONFIRMED guard already provides its listener (no defensive dedup
   there either). `client.approved`'s own handler is the one case with genuine, tested
   replay-safety, because `Client.posClientId` is a real, already-built state signal clients
   controls itself.

### `Apps/api/src/modules/clients/clients.listener.ts`
`ClientsListener(service: IClientsService).setup()` subscribes: `client.approved` (own,
materializes the `PosClient`) plus the four dormant handlers. Same `safeRun` guard as
`ObservabilityListener` (a throw/rejection never reaches `eventBus.emit`'s synchronous
dispatch).

### Tests
- `test/unit/modules/clients/clients.service.spec.ts` — 38 tests (mock Prisma + fake
  `IIdentityProvisioningPort`/`ISequenceService`/`ICatalogCartPort` + spy `eventBus`): phone
  four-states (including the `REJECTED`→available resolution); register success + both
  status-specific 409s + unknown-wilaya/unknown-commune/mismatched-commune 400s; `getMe`
  money-proxy + 404; `updateMe` never writes phone, re-validates wilaya/commune, maps P2025→404;
  `changeMyPassword`'s 409/401/success paths; cart resolve/skip-unresolved/empty-shortcut/
  upsert/deleteMany; `approveClient`'s tx-scoped provisioning + emit + 409/404;
  `rejectClient`'s 409 + emit; `resetClientPassword`'s 409 + emit; PosClient create/quick-create
  incl. the `posClient.creditChanged` emit-only-when-`initialCredit`-present behavior; all five
  listener-invoked methods directly (materialize idempotency, each cache handler's exact
  computed delta, both no-op branches).
- `test/unit/modules/clients/clients.listener.spec.ts` — 5 tests (real `ClientsService` + mocked
  Prisma + `eventBus.emit`, mirroring `observability.listener.spec.ts`'s pattern exactly):
  `client.approved` materializes on first emission and replay ⇒ exactly one `PosClient`;
  `sale.confirmed`/`payment.clientRecorded` apply their one-shot delta correctly; a handler
  rejection is swallowed (`logger.error` called, `eventBus.emit` never throws).

---

## Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run test:unit` (`test/unit` + `test/contract`) | ✅ 361/361 (25 files: 43 new — 38 service + 5 listener) |
| `npm run lint` | ✅ clean |
| Events emitted post-commit (register/approve/reject/passwordReset/creditChanged all fire after their write completes, not before) | ✅ |
| `client.approved`'s own listener is genuinely idempotent (tested); the four dormant handlers apply their event's literal one-shot effect (documented, not overclaimed as ledger-replay-safe) | ✅ |
| No cross-module folder import — only `ISequenceService` (imported directly, matching inventory's precedent for genuinely-shared infra) and the two locally-declared ports from Sprint 2 | ✅ |

`npm run test:int` not run — no route is wired yet (Sprint 4, per the phase file's "once wired" gate).

---

## Notes for later sprints

- **Sprint 4** (API/wiring): inject the real `catalogProductService` (as `ICatalogCartPort`) and
  the real `identityService` singleton (as `IIdentityProvisioningPort` — satisfies it
  structurally with zero adapter shim, unlike inventory's positional-args
  `inventoryPortAdapter`) at the `modules/index.ts` extension point; construct
  `ClientsService`/`ClientsController`/`new ClientsListener(service).setup()` in
  `clients.routes.ts`.
- If/when the sales/orders/billing modules are built, their own authors should revisit whether
  `totalPaid`/`totalSold` need a genuine ledger-recompute (once `SaleStatus`/`OrderStatus`
  filtering semantics are actually defined) — flagged in code comments at each of the four
  dormant handlers and in `loadAdminClientRollups`.

---

## Commit

`git add .` then `git commit -m "clients: sprint 3 — logic (service + listener)"`.
