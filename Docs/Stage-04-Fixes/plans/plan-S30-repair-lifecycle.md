# Plan S30 — Repair lifecycle: reservations, cancellation, return & receipts

Execution plan for **set 30** of `Docs/Stage-04-Fixes/sets-30-33.md`.

---

## §0 — Before you start

### 0.1 Sets that must already be landed

This set needs only the S1–S29 programme, which is merged on `main`. It needs nothing from
S31–S33. S31 (the shared product picker) builds on the reservation fixes made here, so **S31
must not start before this set is approved.**

| Precedent this set builds on | Where it lives today (verified) |
|---|---|
| Repairs consume parts, issue an invoice and recognise revenue at `PICKED_UP` (S13, D8/D9) | `repairs.service.ts:282-466` (`pickUpRepair`) |
| Cancel releases every reservation and refunds through a negative ledger row (S13, D6) | `repairs.service.ts:473-528` (`cancelRepair`) |
| Ledger capture primitive, signed amount, recomputes the invoice from Σ ledger (S5) | `billing.service.ts:130-185` (`captureClientPaymentInTx`) |
| Credit-port primitives, on a locked `PosClient` row | `clients.service.ts:468-503` (`applyDocumentCharge`, `applyLedgerPayment`) |
| Whole-document return with restock at consumed cost | `orders.service.ts:652-792` (`returnOrder`) + `:832-860` (`buildOriginalConsumptions`) |
| Engine re-entry at consumed cost, one layer per distinct cost | `inventory.service.ts:250-282` (`returnIn`) |
| Per-line restock `Switch` in a return dialog, default **on** | `web/src/pages/admin/sales/components/ReturnDialog.tsx:86-94, 148-163` |
| Row lock idiom `SELECT … FOR UPDATE` via `tx.$queryRaw` | `inventory.service.ts:370-374` (`lockProduct`) |

**Read `orders.service.ts:652-860` and `repairs.service.ts` in full before writing any backend
code.** The return transaction in this plan follows `returnOrder`. Where it differs from it, the
difference is deliberate and noted.

### 0.2 Owner decisions taken while planning (settled — do not re-open)

| # | Decision |
|---|---|
| **Q1** | **One reversal row per original payment, linked to it.** New nullable self-FK `ClientPayment.reversalOfId`. A partial cancel-time refund reverses payments **newest first**. The last payment touched may be reversed only in part. The payments page shows "reverses PAY-…" on each reversal row. |
| **Q2** | **A returned repair leaves statistics entirely**, the same as a cancelled one. It is removed from revenue, cost **and** profit. A part that is not restocked does **not** stay behind as a cost or loss. (This differs on purpose from S24's sales/orders rule.) |
| **Q3** | **The repair receipt never prints the breakdown, at any stage.** No parts lines, labour line or parts total. **Total, Paid, Amount due and the PAID/UNPAID stamp stay.** While `totalAmount` is 0, the Total, Amount due and stamp are omitted. Paid still prints when something was prepaid. |
| **Q4** | **A return refunds in full, read-only.** Every payment is reversed completely. The dialog shows the refund total but does not let staff edit it. |

### 0.3 Root cause of "deleting a part leaves its reservation behind"

**The backend does not leak.** The evidence, checked in this session:

| # | Finding | Evidence |
|---|---|---|
| F1 | `removePart` already releases the part's reservation in the same transaction that deletes the part. | `repairs.service.ts:209-216` |
| F2 | The dev database is consistent. For every product, `quantityReserved` equals the net Σ of its `PENDING` ledger rows. Every repair's net `PENDING` balance equals the quantity of its current parts. | Read-only SQL against `dragon_telecom_dev` |
| F3 | The owner's own test today shows release working. On **REP-2026-0008** (2026-10-11, 14:13–14:26) a part was added and deleted twice, and each delete wrote a `PENDING_RELEASE −1` row in the same second. The only reservation still open in the whole database is **ORD-2026-0001** (CONFIRMED), not a repair. | Read-only SQL |
| F4 | **Real defect (display):** `useAddRepairPart`, `useRemoveRepairPart` and `useUpdateRepairStatus` invalidate `repairs` and `inventory`, but **never `catalog`**. Every product view therefore keeps showing the old reserved/available figures until its 30 s `staleTime` runs out and it is remounted: the admin products list, the POS cards and the repair part search (`StaffProductDto.availableQuantity`). This matches "quantityReserved is never decremented" exactly. | `hooks/useRepairs.ts:67-99`, `lib/query-client.ts:69` |
| F5 | **Real defect (display):** the ledger shows the raw enum `PENDING_RELEASE`. It has no translation, no legend, and no visible link to the `PENDING_REPAIR` row it cancels out. Filtering by type `PENDING_REPAIR` shows the reservation **without** its release, so the reservation looks orphaned. (The ledger is append-only: the `PENDING_REPAIR` row is *supposed* to stay.) | `movement-ledger-table.tsx:38-41, 63-68`, `inventory-filters.tsx:64-69` |
| F6 | **Real latent leak (concurrency):** every repair mutation reads the repair **before** opening its transaction and never re-checks it inside. Suppose a part is added in one tab while another tab picks up or cancels the same repair. `addPart` passes `assertEditable` on the stale status and reserves. `pickUpRepair`/`cancelRepair` then iterate the stale `existing.parts`, which do not include the new part. The new reservation is never released, on a repair that is now read-only. The same staleness lets `addPart` and `updateRepair` overwrite each other's `totalAmount`. | `repairs.service.ts:151-220, 227, 315, 489` |
| F7 | **Latent:** `inventory.release` clamps against the product's **global** `quantityReserved`. Its own comment says "idempotent by source-document id", but nothing scopes it to the holder. A stale or duplicated release can therefore eat into **another** order's or repair's reservation. | `inventory.service.ts:91-95` |
| F8 | There is **no edit-quantity path** for a repair part (no route, no UI). Changing a quantity today means deleting the part and adding it again, and both of those paths are covered above. S31 adds no edit path either: its editable list is client-side until "add parts". | `repairs.routes.ts`, `RepairTicketDetail.tsx` |

**What this set does about it:** it fixes F4 (cache invalidation) and F5 (translated types,
legend, filter labels), and closes F6 (repair row lock, re-read inside every transaction) and F7
(release clamped to the holder's own outstanding reservation). The owner should hear about F1–F3
in the report: nothing was broken in the database, and the symptom came from the screens.

### 0.4 Decisions this plan takes on its own — flag them back to the owner in the report

| # | Decision | Why |
|---|---|---|
| P1 | **`inventory.release` clamps to the holder's own outstanding reservation** (Σ PENDING rows for `productId` + `referenceType` + `referenceId`), as well as to the product-wide reserved figure. | F7. It costs one aggregate, on an existing index `[referenceType, referenceId]`, under the product lock the engine already holds. Every existing caller already releases with the same `referenceType`/`referenceId` it reserved with (orders `ORDER`/order id, repairs `REPAIR`/repair id — checked at every call site), so their behaviour is unchanged. |
| P2 | **Each repair mutation locks the repair row (`SELECT … FOR UPDATE`) and re-reads it inside its transaction.** | F6. Same idiom as `lockProduct`/`lockPosClient`. |
| P3 | **Return is its own endpoint** (`POST …/repairs/:id/return`, staff + admin, dual-mounted like every repair route). `POST …/status` with `toStatus: RETURNED` is rejected with a sentinel. | The return needs a per-part restock list, which `RepairStatusCommand` does not carry. This follows the orders precedent (`ORDER_ROUTES.*_RETURN`). |
| P4 | **Dragging a card onto the new Returned lane bounces with the existing toast**, the same as the documented PROCESSING/PICKED_UP drag gap. Returns are made from the ticket's **Return repair** button. | Keeps the drag contract the board already documents (`StaffRepairs.tsx:34-45`). |
| P5 | **`REPAIR_RETURN` rows use `referenceType: 'REPAIR'`** (`referenceId` = repair id), not `'RETURN'`. | Avoids the RETURN three-way-id wart (`inventory.service.ts:758-761`). The ledger already resolves `REPAIR:<id>` to `REP-…`. |
| P6 | **New pickups record which OUT movement consumed each part** (`RepairPart.consumptionMovementId`). A part picked up before S30 has no link. The return then matches it by product and accepts the match only if it is unique. If the same product was fitted twice on one pre-S30 repair, the restock is refused with a sentinel. | Restock must use the **consumed** cost. This is not a backfill. |
| P7 | **Walk-in return/cancel:** there is no `PosClient`, so there can be no ledger row (`ClientPayment.posClientId` is required). Only `Repair.paidAmount`/`refundedAmount` move. A walk-in's invoice is cancelled with its `paidAmount` snapshot left as issued. | Same rule S13 set for walk-in cancellation. |
| P8 | **New stored figures on `Repair`: `refundedAmount`, `cancelledAt`, `returnedAt`.** | Without them a walk-in refund leaves no record, and S33's "refunded repair amount" has nothing stored to read. |

---

## §1 — Prisma & migration

### Action 1.1 — `Apps/api/prisma/schema.prisma`

1. `enum MovementType`: **append** `REPAIR_CANCELLED` and `REPAIR_RETURN` after
   `PENDING_RELEASE`. In Postgres, `ADD VALUE` appends, so order in the Prisma enum does not
   matter.
2. `enum RepairStatus`: append `RETURNED` after `CANCELLED`.
3. `StockMovement`: add the back-relation
   `repairPartConsumed RepairPart? @relation("RepairPartConsumption")`.
   Update the `referenceType` trailing comment only if needed (no new reference type is added).
4. `Repair`: add three columns after `pickedUpAt`:
   ```prisma
   cancelledAt        DateTime? // S30 — set at CANCELLED
   returnedAt         DateTime? // S30 — set at RETURNED (from PICKED_UP only)
   ```
   and after `paidAmount`:
   ```prisma
   refundedAmount     Decimal      @default(0) @db.Decimal(12, 2) // S30 — cash given back at CANCELLED/RETURNED; paidAmount is net of it
   ```
5. `RepairPart`: add
   ```prisma
   consumptionMovementId String?  @unique // S30 — the REPAIR_CONSUMPTION OUT row written at PICKED_UP; REPAIR_RETURN reads its layers
   restockedOnReturn     Boolean? // S30 — null until RETURNED; then whether this part went back on the shelf
   consumptionMovement   StockMovement? @relation("RepairPartConsumption", fields: [consumptionMovementId], references: [id])
   ```
6. `ClientPayment`: add
   ```prisma
   reversalOfId   String? // S30/Q1 — a negative row reversing (part of) the payment it points to
   reversalOf     ClientPayment?  @relation("PaymentReversal", fields: [reversalOfId], references: [id])
   reversals      ClientPayment[] @relation("PaymentReversal")
   ```
   and `@@index([reversalOfId])` next to the existing `@@index([repairId])`. **Not `@unique`**:
   the ledger primitive is generic, and only the repairs service guarantees that it reverses a
   payment at most once.

### Action 1.2 — the migration

```bash
cd Apps/api && npx prisma migrate dev --create-only --name s30_repair_return
```

Inspect the generated SQL. It must contain only: three `ALTER TYPE … ADD VALUE` statements
(`MovementType` ×2, `RepairStatus` ×1), the new columns, the unique index on
`RepairPart.consumptionMovementId`, the index on `ClientPayment.reversalOfId`, and two foreign
keys. **No `UPDATE`, no `DELETE`, no backfill** (hard rule 7). Then:

```bash
npx prisma migrate dev && npx prisma generate
```

Regenerate the client before touching any service code.

---

## §2 — Contract (`Apps/contract`)

### Action 2.1 — `src/modules/inventory/inventory.enums.ts`

Add two members to `MovementType`. Contract order drives the filter dropdown
(`Object.values`), so place each one beside its family:

- `REPAIR_RETURN = 'REPAIR_RETURN'` directly after `RETURN_IN`
- `REPAIR_CANCELLED = 'REPAIR_CANCELLED'` directly after `PENDING_RELEASE`

Add a comment above each: `REPAIR_RETURN` is IN, restocks a part of a RETURNED repair at its
consumed cost. `REPAIR_CANCELLED` is PENDING: a reservation released because the repair was
cancelled; it changes `quantityReserved` only, never on-hand.

### Action 2.2 — `src/modules/repairs/repairs.enums.ts`

Add `RETURNED = 'RETURNED'` after `CANCELLED`.

### Action 2.3 — `src/modules/repairs/repairs.constants.ts`

1. `REPAIR_STATUS_TRANSITIONS`: add `[RepairStatus.PICKED_UP]: [RepairStatus.RETURNED]`.
2. `REPAIR_TERMINAL_STATUSES` becomes `[CANCELLED, RETURNED]` ("nothing leaves these"). Rewrite
   its comment: PICKED_UP is no longer terminal, since it can move to RETURNED, but it is still
   read-only.
3. New `REPAIR_READ_ONLY_STATUSES = [PICKED_UP, CANCELLED, RETURNED]` and
   `export function isRepairReadOnly(status: RepairStatus): boolean`. The comment says that
   once these statuses are reached, parts, labour, diagnosis and pre-pickup payments are frozen.
   A picked-up repair's invoice is immutable, and reversing it is a return, not an edit.
4. Keep `isRepairStatusTerminal` exported, with its new meaning. Existing imports, including any
   test, still compile.
5. New error-sentinel constant, same shape as `CATALOG_ERROR` (`catalog.constants.ts:43-47`):
   ```ts
   export const REPAIR_ERROR = {
     READ_ONLY: 'REPAIR_READ_ONLY',
     STATUS_CHANGED: 'REPAIR_STATUS_CHANGED',
     RETURN_REQUIRES_PICKED_UP: 'REPAIR_RETURN_REQUIRES_PICKED_UP',
     RETURN_VIA_RETURN_ACTION: 'REPAIR_RETURN_VIA_RETURN_ACTION',
     UNKNOWN_PART: 'REPAIR_UNKNOWN_PART',
     CONSUMPTION_NOT_FOUND: 'REPAIR_CONSUMPTION_NOT_FOUND',
   } as const;
   export type RepairErrorSentinel = (typeof REPAIR_ERROR)[keyof typeof REPAIR_ERROR];
   ```
   `READ_ONLY` keeps the exact string `assertEditable` already throws, so anything matching on it
   still works.

### Action 2.4 — `src/modules/repairs/repairs.command.ts`

Add:

```ts
// S30 — return a PICKED_UP repair (→ RETURNED, terminal). `restockPartIds` lists the parts that
// go back on the shelf (REPAIR_RETURN at their consumed cost); a part not listed produces no
// movement (fitted then removed, not resellable). No refund field: every payment is reversed in
// full (owner decision Q4). `note` is the reason, written to the status history.
export const ReturnRepairSchema = z.object({
  restockPartIds: z.array(z.uuid()),
  note: z.string().optional(),
});
export type ReturnRepairCommand = z.infer<typeof ReturnRepairSchema>;
```

In the comment above `RepairStatusSchema`, add one line: `toStatus: RETURNED` is rejected here,
and a return goes through `ReturnRepairSchema`.

### Action 2.5 — `src/modules/repairs/repairs.routes.ts`

Add `STAFF_RETURN: '/staff/repairs/:id/return'` and `ADMIN_RETURN: '/admin/repairs/:id/return'`
with an `// S30 — PICKED_UP → RETURNED` comment.

### Action 2.6 — `src/modules/repairs/repairs.dtos.ts`

`RepairResponseSchema`:
- `refundedAmount: z.number()`, placed after `paidAmount`
- `cancelledAt: z.iso.datetime().optional()` and `returnedAt: z.iso.datetime().optional()`, placed after `pickedUpAt`
- `payments[]`: add `reversesReference: z.string().optional()`. This is the reference of the payment the row reverses (Q1).
- `parts[]`: add `restockedOnReturn: z.boolean().optional()`. It is absent until RETURNED.
- Update the `invoiceNumber` comment: the invoice is absent before pickup and on cancelled repairs. It is still present, as CANCELLED, on a returned repair.

`TechnicianRepairStatsResponseSchema`: add `returnedCount: z.number().int()` after
`cancelledCount`.

### Action 2.7 — `src/modules/repairs/repairs.events.ts`

Add:

```ts
'repair.returned': { repairId: string; invoiceNumber: string; refundAmount: number; restockedPartCount: number; reason?: string };
```

Update the header comment so it mentions `repair.returned`.

### Action 2.8 — `src/modules/billing/billing.dtos.ts`

`ClientPaymentResponseSchema`: add `repairReference: z.string().optional()` (`REP-…`, the repair
this row was taken or refunded for) and `reversesReference: z.string().optional()` (`PAY-…`).
Both are optional, so every existing consumer still compiles.

---

## §3 — Backend (`Apps/api`)

### Action 3.1 — `src/modules/inventory/inventory.interface.ts`

1. Add the single-side types, next to `MovementRef`:
   ```ts
   // S30 — the PENDING types a release may write: the generic PENDING_RELEASE, or
   // REPAIR_CANCELLED for a release caused by cancelling a repair (ledger traceability only;
   // the arithmetic is identical — quantityReserved down, on-hand untouched).
   export type ReleaseMovementType = MovementType.PENDING_RELEASE | MovementType.REPAIR_CANCELLED;
   // S30 — the IN types a returnIn may write: RETURN_IN (sales/orders) or REPAIR_RETURN.
   export type ReturnInMovementType = MovementType.RETURN_IN | MovementType.REPAIR_RETURN;
   ```
2. Widen the signatures. The last parameter is optional, so no existing caller changes:
   `release(tx, productId, qty, ref, type?: ReleaseMovementType)` and
   `returnIn(tx, originalConsumptions, qty, ref, type?: ReturnInMovementType)`.

### Action 3.2 — `src/modules/inventory/inventory.service.ts`

1. **`release`**, which takes `type: ReleaseMovementType = MovementType.PENDING_RELEASE`:
   - After `lockProduct`, compute the holder's outstanding reservation:
     ```ts
     const holder = await tx.stockMovement.aggregate({
       where: { productId, direction: 'PENDING', referenceType: ref.referenceType, referenceId: ref.referenceId },
       _sum: { quantity: true },
     });
     const actualQty = Math.min(qty, holder._sum.quantity ?? 0, product.quantityReserved);
     ```
     This replaces `Math.min(qty, product.quantityReserved)`. The `actualQty <= 0` early return
     stays.
   - Write `type` (not the hard-coded `PENDING_RELEASE`) on the movement row.
   - Rewrite the comment so it says what is now true. The clamp is per holder: a release can
     never reduce another document's reservation, and a repeated release for the same holder is
     a true no-op (P1).
2. **`returnIn`**, which takes `type: ReturnInMovementType = MovementType.RETURN_IN`: pass
   `type` into `addLayerCore`. `REPAIR_RETURN` is not in `PURCHASE_RECEIPT_TYPES`, so `avgPrice`
   is untouched and `avgStockPrice` is recomputed. Both are correct.
3. Update the stale comments:
   - `:39-41` (`PURCHASE_RECEIPT_TYPES`): add REPAIR_RETURN to "re-enters at the original
     consumed cost — excluded".
   - `:294-299` (`addLayerCore`): "for every IN type including RETURN_IN and REPAIR_RETURN".
     "the three PENDING types" becomes "the four PENDING types".

### Action 3.3 — `src/modules/billing/billing.interface.ts` + `billing.service.ts` + `billing.mapper.ts`

1. **`captureClientPaymentInTx`**: the input gains `reversalOfId?: string`. Persist it with the
   same conditional-spread idiom as `repairId`. Update the method comment: a negative row may
   point at the payment it reverses (S30/Q1). Change the input type in **both**
   `IBillingService` and the method.
2. **New `cancelInvoiceInTx(tx, input: { invoiceId: string }): Promise<{ number: string }>`**,
   placed beside `issueInvoiceInTx`:
   - Read `{ number, status }`. If the status is already `CANCELLED`, return `{ number }`
     (idempotent).
   - Otherwise set `status: CANCELLED` only. Leave `paidAmount` and every other column alone.
   - **Must not emit.** The caller emits `invoice.cancelled` after its own commit (same rule as
     `issueInvoiceInTx`).
   - Comment: status only, numbers never reused, gaps never closed. Callers: repairs' return
     (S30). The caller must capture any reversal rows **before** cancelling, because
     `captureClientPaymentInTx` does not recompute a CANCELLED invoice.
   - Declare it on `IBillingService` under the injected-port block.
3. **`PAYMENT_INCLUDE`** (`billing.service.ts:29-33`): add
   `repair: { select: { reference: true } }` and `reversalOf: { select: { reference: true } }`.
4. **`billing.mapper.ts`**: `ClientPaymentRow` gains
   `repair: Pick<Repair, 'reference'> | null; reversalOf: Pick<ClientPayment, 'reference'> | null;`.
   `toClientPaymentDto` maps `repairReference` and `reversesReference` with the conditional
   spread. Grep `toClientPaymentDto`: its only callers are `billing.service.ts:227, 256`, and
   both use `PAYMENT_INCLUDE`.
5. Leave billing's HTTP `cancelInvoice` unchanged. **Report it:** an admin cancelling a REPAIR
   invoice directly through the invoices page still bypasses the repair (no reversal, no credit
   change). This is a pre-existing gap and outside S30.

### Action 3.4 — `src/modules/repairs/repairs.interface.ts`

- `IBillingIssuePort`: add `reversalOfId?: string` to `captureClientPaymentInTx`'s input, and
  declare `cancelInvoiceInTx(tx, input: { invoiceId: string }): Promise<{ number: string }>`.
  `billingService` keeps satisfying it structurally.
- `IRepairsService`: add
  `returnRepair(id: string, cmd: ReturnRepairCommand, actor: JWTPayload): Promise<RepairDto>;`
  with the comment `// S30 — PICKED_UP → RETURNED: restock chosen parts at consumed cost,
  reverse every payment, cancel the invoice.` Update the `changeStatus` comment: CANCELLED from
  INTAKE/PROCESSING/COMPLETED only, and RETURNED is not accepted here.

### Action 3.5 — `src/modules/repairs/repairs.service.ts` — the core of the set

Imports to add: `MovementType as PrismaMovementType` and `type RepairPart` from
`@prisma/client` (the Prisma `where` and the helper signature); `REPAIR_ERROR`, `isRepairReadOnly`, `type ReturnRepairCommand` from the contract;
`type ConsumptionLine` from `../inventory/inventory.interface`.

Add `type RepairWithIncludes = Prisma.RepairGetPayload<{ include: typeof REPAIR_INCLUDE }>;`
under `REPAIR_INCLUDE`, and use it in place of the two inline `Prisma.RepairGetPayload<…>`
annotations.

#### 3.5.a — New private helpers (place them above `getRepairDto`)

```ts
// S30 (F6) — the repair row is the serialization point for its own parts, payments and status:
// the same SELECT … FOR UPDATE idiom as inventory's lockProduct / clients' lockPosClient. Every
// mutation re-reads the repair through this INSIDE its transaction and decides from that read,
// never from a pre-transaction one — otherwise a part added in one tab while another tab picks
// the repair up is reserved and never released.
private async lockRepair(tx: Prisma.TransactionClient, id: string): Promise<RepairWithIncludes> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Repair" WHERE id = ${id} FOR UPDATE`;
  if (!rows[0]) throw new NotFoundError('Repair');
  return tx.repair.findUniqueOrThrow({ where: { id }, include: REPAIR_INCLUDE });
}
```

```ts
// S30/Q1 — reverses up to `amount` of this repair's ledger money, newest payment first, one
// NEGATIVE row per original payment linked through reversalOfId. Portions already reversed are
// skipped. A reversal row carries the original's invoiceId (so a return's reversals land on the
// invoice and walk its paidAmount back down) and always the repairId (so the ticket lists it).
// Only for a known POS client — a walk-in has no ledger (P7).
private async reversePaymentsInTx(
  tx: Prisma.TransactionClient,
  repair: RepairWithIncludes,
  amount: number,
  staffId: string,
): Promise<{ paymentId: string; previousCredit: number; newCredit: number; amount: number; invoiceId: string | null }[]>
```
Body:
- `reversedById`: for each payment with `reversalOfId != null`, add `-amount` to its original's
  running total.
- `originals`: payments with `amount > 0` and `reversalOfId == null`, sorted by `paidAt` desc and
  then `reference` desc.
- Loop: `open = original.amount − reversed`. Skip when `open <= 0`. `take = min(remaining, open)`.
  Call `this.billing.captureClientPaymentInTx(tx, { posClientId: repair.posClientId!, ...(original.invoiceId != null ? { invoiceId: original.invoiceId } : {}), repairId: repair.id, amount: -take, reversalOfId: original.id, staffId })`.
  Push the result with `amount: -take` and `invoiceId: original.invoiceId`. Decrement
  `remaining`, and stop at `remaining <= 0`.

```ts
// S30 (P6) — the FIFO layers this part drained at PICKED_UP, so REPAIR_RETURN re-enters at the
// consumed cost, never the current average (mirrors orders' buildOriginalConsumptions). A part
// picked up since S30 links its OUT row directly; one picked up before has no link and is
// matched by product, which is unambiguous unless the same product was fitted twice.
private async partConsumptions(tx: Prisma.TransactionClient, repairId: string, part: RepairPart): Promise<ConsumptionLine[]>
```
Body:
- `let outMovementId = part.consumptionMovementId`.
- If it is null, run `tx.stockMovement.findMany({ where: { referenceType: 'REPAIR', referenceId: repairId, productId: part.productId, type: PrismaMovementType.REPAIR_CONSUMPTION }, select: { id: true } })`.
  Unless exactly one row comes back, throw
  `new ConflictError(REPAIR_ERROR.CONSUMPTION_NOT_FOUND, { partId: part.id })`.
- Read `stockMovementConsumption.findMany({ where: { outMovementId }, orderBy: { id: 'asc' } })`
  and map each row to `{ inMovementId, qty: quantityConsumed, unitCost: unitCost.toNumber() }`.
  `returnIn` itself asserts that Σ qty equals the part's quantity.

`assertEditable` becomes:
`if (isRepairReadOnly(status as RepairStatus)) throw new ConflictError(REPAIR_ERROR.READ_ONLY);`.
Update its comment: picked up, cancelled or returned means frozen.

#### 3.5.b — Every existing mutation re-reads under the lock

| Method | Change |
|---|---|
| `updateRepair` | Wrap the work in `this.prisma.$transaction`. Inside it: `const locked = await this.lockRepair(tx, id); this.assertEditable(locked.status);`. Compute `totalAmount` from `locked.partsTotal`. The pre-transaction `findUnique` stays only for the 404. |
| `addPart` | Inside the tx, before `reserve`: `const locked = await this.lockRepair(tx, id); this.assertEditable(locked.status);`. Compute `totalAmount` from `locked.labourPrice`, not `existing.labourPrice`. |
| `removePart` | Inside the tx: lock and assert. `const part = locked.parts.find((p) => p.id === partId); if (!part) throw new NotFoundError('RepairPart');`. Delete the pre-tx `repairPart.findUnique`. A double-clicked delete now gets a clean 404 instead of a P2025 500. Compute `totalAmount` from `locked.labourPrice`. |
| `changeStatus` | Before the transition check: `if (cmd.toStatus === RepairStatus.RETURNED) throw new BadRequestError(REPAIR_ERROR.RETURN_VIA_RETURN_ACTION);`. Inside the simple-path tx: `const locked = await this.lockRepair(tx, id); if (locked.status !== existing.status) throw new ConflictError(REPAIR_ERROR.STATUS_CHANGED);`. Rewrite the method comment for S30 (CANCELLED from INTAKE/PROCESSING/COMPLETED, RETURNED via `returnRepair`). |
| `recordPayment` | Inside the tx: lock and `assertEditable(locked.status)` before capturing. |

#### 3.5.c — `pickUpRepair`

Keep the pre-tx walk-in fast-fail as it is (it fails fast). **Inside the tx**, first line:

```ts
const locked = await this.lockRepair(tx, existing.id);
if (locked.status !== existing.status) throw new ConflictError(REPAIR_ERROR.STATUS_CHANGED);
```

Then derive `paidBefore`, `totalAmount` and `labourPrice` from `locked`. Declare them as `let`
outside the callback, because the post-commit emits use them. Repeat the walk-in check against
`locked`, and iterate **`locked.parts`** everywhere (the consume loop, invoice lines,
`stampedParts`). In the consume loop, extend the part update to:

```ts
await tx.repairPart.update({
  where: { id: part.id },
  data: { costOfGoods: result.costOfGoods, profit: result.profit, consumptionMovementId: result.movementId },
});
```

Nothing else in the money arithmetic changes. Update the comment block above the method: the
locked re-read and the consumption link (S30).

#### 3.5.d — `cancelRepair` (rewrite)

Inside the tx:
1. `const locked = await this.lockRepair(tx, existing.id);`. If
   `!isRepairTransitionAllowed(locked.status as RepairStatus, RepairStatus.CANCELLED)`, throw
   `ConflictError(REPAIR_ERROR.STATUS_CHANGED)`.
2. `alreadyPaid = locked.paidAmount.toNumber()`,
   `refundApplied = Math.min(cmd.refundAmount ?? alreadyPaid, alreadyPaid)`. Declare both as
   `let` outside for the emits.
3. For each `locked.parts`:
   `await this.inventory.release(tx, part.productId, part.quantity, ref, MovementType.REPAIR_CANCELLED);`
   **Release only. Never `addLayer`/`returnIn`. On-hand does not move.**
4. If `locked.posClientId != null && refundApplied > 0`:
   `reversals = await this.reversePaymentsInTx(tx, locked, refundApplied, staffId);`
   (there is no invoice yet, so every original has `invoiceId` null).
5. Write the history row (unchanged).
6. `tx.repair.update`:
   `{ status: CANCELLED, cancelledAt: new Date(), paidAmount: alreadyPaid − refundApplied, refundedAmount: { increment: refundApplied } }`.

After the commit: `flushEvents`, `repair.statusChanged`, `repair.cancelled` (unchanged payload).
Then add **one `payment.clientRecorded` per reversal** (`paymentId`, `posClientId`, `amount`
negative, `previousCredit`, `newCredit`, no `invoiceNumber`). Today's cancel emits none, which
leaves the audit log without the refund rows.

Rewrite the method comment. Nothing was consumed before PICKED_UP, so every part is released, as
a `REPAIR_CANCELLED` row so the ledger says why. Money collected is reversed payment by payment
(Q1), newest first, partially if the prompt lowered the amount. A walk-in moves only
`paidAmount`/`refundedAmount`. Labour is not a technician payout, so nothing is owed back. The
repair simply never reaches revenue.

#### 3.5.e — New `returnRepair` (place it after `cancelRepair`)

```ts
// S30 — PICKED_UP → RETURNED (terminal, read-only). Mirrors orders' returnOrder with three
// deliberate differences: restock is per part (cmd.restockPartIds), the refund is always every
// payment in full (Q4, no amount field), and the invoice is CANCELLED (status only — numbers are
// never reused, gaps never closed). Restocked parts re-enter at their consumed cost
// (REPAIR_RETURN, referenceType REPAIR — P5); non-restocked parts write no movement. For a POS
// client the document charge is reversed through the credit port and every payment through
// the ledger, so credit/totalPaid/totalSold land exactly where they were before the repair —
// all in this one transaction on locked rows (hard rule 6).
async returnRepair(id: string, cmd: ReturnRepairCommand, actor: JWTPayload): Promise<RepairDto>
```

Steps:
1. Run `findUnique` for the 404. If `status !== PICKED_UP`, throw
   `ConflictError(REPAIR_ERROR.RETURN_REQUIRES_PICKED_UP)`. Then `staffId`, `isAdmin`.
2. `$transaction`:
   1. `locked = lockRepair(tx, id)`. Re-check `locked.status === PICKED_UP` and
      `isRepairTransitionAllowed(PICKED_UP, RETURNED)`, using the same sentinel as step 1.
   2. Validate `cmd.restockPartIds`: every id must be in `locked.parts`, otherwise throw
      `BadRequestError(REPAIR_ERROR.UNKNOWN_PART)`. Build `restockSet`.
   3. `ref = { referenceType: 'REPAIR', referenceId: locked.id, staffId, ...(cmd.note != null ? { reason: cmd.note } : {}) }`.
   4. For each `locked.parts`: if the part is in `restockSet`, call
      `await this.inventory.returnIn(tx, await this.partConsumptions(tx, locked.id, part), part.quantity, ref, MovementType.REPAIR_RETURN)`.
      **Always** run `tx.repairPart.update({ where: { id: part.id }, data: { restockedOnReturn: restockSet.has(part.id) } })`.
   5. Money:
      - **POS client:**
        `reversals = await this.reversePaymentsInTx(tx, locked, locked.paidAmount.toNumber(), staffId)`
        and `refundTotal = −Σ reversal.amount`. Then
        `await this.clientCredit.applyDocumentCharge(tx, locked.posClientId, { totalSoldDelta: −totalAmount, creditDelta: −totalAmount })`.
      - **Walk-in:** `refundTotal = locked.paidAmount.toNumber()`. No ledger row.
   6. `const { number } = await this.billing.cancelInvoiceInTx(tx, { invoiceId: locked.invoiceId! });`.
      This must come **after** step 5, so the reversals were recomputed onto the invoice first.
   7. `tx.repair.update`:
      `{ status: RETURNED, returnedAt: new Date(), paidAmount: locked.paidAmount − refundTotal, refundedAmount: { increment: refundTotal } }`.
   8. History row `PICKED_UP → RETURNED`, with `note` if given.
3. After the commit:
   - `flushEvents`
   - `repair.statusChanged`
   - `repair.returned { repairId, invoiceNumber: number, refundAmount: refundTotal, restockedPartCount: restockSet.size, ...(cmd.note ? { reason } : {}) }`
   - `invoice.cancelled { invoiceNumber: number, reason?: cmd.note }`
   - one `payment.clientRecorded` per reversal (with `invoiceNumber: number`)
4. Return `getRepairDto(id, { includeMargins: isAdmin })`.

> `Repair.totalCost`/`totalProfit` are **not** zeroed. They remain the pickup snapshot.
> Statistics drops the repair by status (Q2). Leaving the snapshot keeps the ticket truthful about
> what the pickup recorded.

#### 3.5.f — `listTechnicianStats`

Add `returnedCount: counts[PrismaRepairStatus.RETURNED] ?? 0`. Revenue stays PICKED_UP-only, so
returned repairs drop out of it automatically. Add one comment line saying so.

### Action 3.6 — `src/modules/repairs/repairs.mapper.ts`

- `toRepairDto`:
  - map `refundedAmount`, `cancelledAt?` and `returnedAt?`.
  - `parts[].restockedOnReturn`: add it when it is non-null.
  - `payments[].reversesReference`: build `const referenceById = new Map(repair.payments.map((p) => [p.id, p.reference]))` and add `reversesReference` when `payment.reversalOfId` resolves.
- `TechnicianStatsRow` and `toTechnicianStatsDto`: add `returnedCount`, and include it in the
  `totalRepairs` sum. Update the comment from "the five status counts" to "six".

### Action 3.7 — `src/modules/repairs/repairs.controller.ts` + `repairs.routes.ts`

- Controller: `returnRepair` handler, same shape as `changeStatus`, returning `sendSuccess(res, result, 200)`.
- Routes: mount `STAFF_RETURN` (`staffRepairsOrAdmin`) and `ADMIN_RETURN` (`adminOnly`) with
  `validateRequest({ params: RepairIdParamsSchema, body: ReturnRepairSchema })`, after the
  status routes, with an `// S30` comment.

### Action 3.8 — `src/modules/observability/observability.listener.ts`

In `registerRepairs()`, add a `repair.returned` handler. `actionType: 'repair.returned'`,
`entityType: 'Repair'`, description ``Returned: refund ${p.refundAmount}, ${p.restockedPartCount} part(s) restocked``.
This follows the `order.returned` handler at `:290-298`.

### Action 3.9 — `src/modules/statistics/statistics.service.ts` (comments only — Q2 needs no code)

Every repair money read filters `status: REPAIR_RECOGNIZED_STATUS` (`PICKED_UP`). These are
lines 421, 453, 671, 768, 802, 903, 995, 1074, 1201, 1322 and 1449, and the dashboard and
technician revenue are built on the same reads. CANCELLED and RETURNED therefore drop out by
construction. `reportAgeing` reads only `ISSUED|PARTIALLY_PAID` invoices, so a returned repair's
CANCELLED invoice drops out too.

- `:77-79`: append to the `REPAIR_RECOGNIZED_STATUS` comment: "S30/Q2 — CANCELLED and RETURNED
  repairs are excluded by this filter alone; a returned repair leaves revenue, cost and profit
  entirely, restocked or not."
- `:1270-1273`: "The three PENDING types" becomes "The PENDING types (PENDING_ORDER,
  PENDING_REPAIR, PENDING_RELEASE, REPAIR_CANCELLED)". The `direction` filter already excludes
  REPAIR_CANCELLED.

---

## §4 — Frontend (`Apps/web`)

### Action 4.1 — `src/services/repairs.service.ts`

Add `returnRepair(scope, id, command: ReturnRepairCommand): Promise<RepairDto>`, which POSTs to
`ADMIN_RETURN`/`STAFF_RETURN`. Same body as `updateRepairStatus`, with a `// S30` comment.

### Action 4.2 — `src/hooks/useRepairs.ts`

1. Add `queryClient.invalidateQueries({ queryKey: qk.catalog.all() })` to **`useAddRepairPart`,
   `useRemoveRepairPart` and `useUpdateRepairStatus`** (F4). Update each hook's comment: product
   lists carry `quantityReserved`/`availableQuantity`, so a reservation change must refresh them
   too.
2. New `useReturnRepair()`. Its `mutationFn` calls `repairsService.returnRepair`. `onSuccess`
   invalidates `qk.repairs.all()`, `qk.inventory.all()`, `qk.catalog.all()`, `qk.billing.all()`
   and `qk.clients.all()`. **No new query key** is needed.

### Action 4.3 — `src/lib/query-client.ts`

Add the six `REPAIR_ERROR` sentinels to `SENTINEL_TRANSLATION_KEYS` (keys in §4.14). Import
`REPAIR_ERROR` from the contract.

### Action 4.4 — `src/pages/staff/repairs/repair-status-labels.ts`

Add `[RepairStatus.RETURNED]: "staff.repairs.board.returned"`. Update the comment so it also
lists RepairReturnDialog among the consumers.

### Action 4.5 — `src/pages/staff/repairs/components/RepairBoard.tsx`

- Append `RepairStatus.RETURNED` to `LANES`.
- In both grids (the skeleton and the lanes), replace `sm:grid-cols-2 lg:grid-cols-5` with
  `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`.
- Update the `page`/`totalPages` prop comment: "five lanes" becomes "six lanes".

### Action 4.6 — `src/pages/staff/repairs/StaffRepairs.tsx`

- Header comment: add that dropping a card on **Returned** always bounces too (P4). Returns go
  through the ticket's Return action.
- Wire `const returnRepair = useReturnRepair();` and
  `handleReturn = (command: ReturnRepairCommand) => returnRepair.mutate({ scope, id: selectedRepairId, command }, { onSuccess: () => toast.success(t("staff.repairs.return.success")) })`.
- Pass `onReturn={handleReturn}` and `isReturning={returnRepair.isPending}` to
  `RepairTicketDetail`.

### Action 4.7 — `src/pages/staff/repairs/components/RepairStatusDialog.tsx`

Filter `RETURNED` out of `targets`:
`repairTransitionsFrom(repair.status).filter((s) => s !== RepairStatus.RETURNED)`, with the
comment `// S30 — RETURNED needs per-part restock choices; it has its own dialog (RepairReturnDialog).`
Today the dialog cannot be opened on a PICKED_UP repair, so this is defensive. The cancel refund
prompt stays as it is, still defaulting to `repair.paidAmount`.

### Action 4.8 — New `src/pages/staff/repairs/return-repair.schema.ts`

```ts
// S30 — the return dialog's form. One row per part; `restock` defaults to true (sales'
// ReturnDialog precedent). Mapped to ReturnRepairCommand by the dialog on submit
// (restockPartIds = parts with restock=true) — the shapes differ on purpose, so there is no
// AssertAssignable guard here.
export function returnRepairSchema(_t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    parts: z.array(z.object({ partId: z.uuid(), restock: z.boolean() })),
    note: z.string().optional(),
  });
}
export type ReturnRepairFormValues = z.infer<ReturnType<typeof returnRepairSchema>>;
```

(Drop the `t` parameter if lint flags it as unused. No message is needed.)

### Action 4.9 — New `src/pages/staff/repairs/components/RepairReturnDialog.tsx`

A dumb component that owns only its form state. Props:
`{ open; onOpenChange; repair: RepairDto | null; onSubmit: (command: ReturnRepairCommand) => void; isSubmitting? }`.

- `useForm<ReturnRepairFormValues>` with `zodResolver`. `defaultValues.parts` =
  `repair.parts.map((p) => ({ partId: p.id, restock: true }))`.
- Layout, inside `Dialog` → `DialogContent className="max-w-lg"`:
  - Title `staff.repairs.return.title`.
  - Description `staff.repairs.return.description` with `{ invoice: repair.invoiceNumber }`.
  - Parts list in `max-h-64 overflow-y-auto`. Each row shows the part name,
    `quantity × unitPrice`, and a `Switch` labelled `staff.repairs.return.restockLabel`. Use a
    `Controller` on `parts.${index}.restock`, exactly like `ReturnDialog.tsx:148-163`. With no
    parts, show `staff.repairs.return.noParts`.
  - A read-only refund summary in a bordered box: `staff.repairs.return.refundTotal` against
    `formatDZD(repair.paidAmount)`. Below it, `staff.repairs.return.accountNote` when
    `repair.posClientId != null`, or `staff.repairs.return.walkInNote` otherwise.
  - `Textarea` for the note, labelled `staff.repairs.return.noteLabel`.
  - Footer: an outline `common.actions.cancel`, and a destructive submit
    `staff.repairs.return.confirm` that is disabled while `isSubmitting`.
- On submit:
  `onSubmit({ restockPartIds: values.parts.filter((p) => p.restock).map((p) => p.partId), ...(values.note ? { note: values.note } : {}) })`.
- Header comment: S30. It is only reachable from a PICKED_UP ticket. The refund is not editable
  (Q4). Parts switched off write no stock movement.

### Action 4.10 — `src/pages/staff/repairs/components/RepairTicketDetail.tsx`

- `readOnly = isRepairReadOnly(repair.status)` (replaces `isRepairStatusTerminal`). Update the
  header comment.
- New props: `onReturn: (command: ReturnRepairCommand) => void; isReturning?: boolean`.
- Local state `returnDialogOpen`.
- When `repair.status === RepairStatus.PICKED_UP`, render a full-width
  `variant="destructive"` button `staff.repairs.return.action` where the "Update status" button
  sits. That button is hidden here, because PICKED_UP is read-only.
- Mount `<RepairReturnDialog key={repair.id} … />` as a sibling of `<Sheet>`, next to
  `RecordRepairPaymentDialog`. On submit, call `onReturn(command)` and close the dialog (the
  same pattern as `handleRecordPayment`).
- Totals block: when `repair.refundedAmount > 0`, add a row `staff.repairs.detail.refunded`
  showing `formatDZD(repair.refundedAmount)`.
- Each part row: when `part.restockedOnReturn != null`, show a small `Badge`
  (`variant="outline"`) with `staff.repairs.detail.partRestocked` or
  `staff.repairs.detail.partNotRestocked`.
- Each payment row: when `payment.reversesReference`, append
  `` · ${t("staff.repairs.payments.reverses", { reference: payment.reversesReference })} ``
  after the existing refund label.

### Action 4.11 — Receipts (Q3): `components/RepairReceipt.tsx` **and** `repair-receipt-escpos.ts`

Both renderers must change identically, because they are kept in step (header comment of
`repair-receipt-escpos.ts`).

1. **Delete** the parts section, the labour line and the "parts total" line. Serial numbers go
   with the parts section.
2. Replace the totals block with:
   - `const priced = repair.totalAmount > 0;`
   - `priced` → print **Total** (bold).
   - `priced || repair.paidAmount > 0` → print **Paid**.
   - `priced && amountDue > 0` → print **Amount due**.
   - `repair.refundedAmount > 0` → print **Refunded** (`staff.repairs.receipt.refunded`). This
     covers cancelled and returned tickets.
   - The PAID/PARTIAL/UNPAID stamp prints **only when `priced`**. Keep the existing
     paid/partial/unpaid rule inside that guard. The old "a fresh INTAKE ticket stays UNPAID"
     comment becomes "an unpriced ticket prints no money figure at all (S30/Q3)".
3. Comments to update:
   - RepairReceipt's header: what is printed now, and that there is no breakdown at any stage.
   - escpos header's "Section order deliberately mirrors…" list: remove parts and labour, and
     add refunded.
   - The NEVER-print-margins hard rule stays word for word.
4. Remove `staff.repairs.receipt.parts`, `.labour`, `.partsTotal` and `.serials` from
   `translations.json`, but **only if** `grep -rn` across `src/` shows no other use after the
   edit.

### Action 4.12 — Movement ledger: labels, legend, filter (F5)

1. **New `src/pages/admin/inventory/movement-type-labels.ts`**:
   ```ts
   // S30 — single source of truth for MovementType → translation keys (label + legend line),
   // shared by the ledger table, its type filter and the legend. Record<…> so a new contract
   // member fails to compile until it is labelled.
   export const MOVEMENT_TYPE_LABEL_KEY: Record<MovementType, string> = { … };
   export const MOVEMENT_TYPE_HELP_KEY: Record<MovementType, string> = { … };
   ```
   Fill one entry per member (all 13), using the key scheme in §4.14.
2. **New `src/pages/admin/inventory/components/movement-type-legend.tsx`**: a `Popover`
   (`@/components/ui/popover`) triggered by an outline icon `Button` with lucide `Info` and
   `aria-label={t("admin.inventory.movements.legend.open")}`. The content
   (`className="w-96 max-h-96 overflow-y-auto"`) has the heading
   `admin.inventory.movements.legend.title`, then three groups (IN / OUT / PENDING), each headed
   by `admin.inventory.movements.legend.group.in|out|pending`. Each entry shows the translated
   label in bold and the help line under it. Define the grouping as a local const of three
   `MovementType[]` arrays. It is single-side UI ordering, not shared data.
3. **`movement-ledger-table.tsx`**:
   - Type cell (desktop and mobile): `label={t(MOVEMENT_TYPE_LABEL_KEY[row.original.type])}`.
   - Replace the header comment that says types are "rendered as its raw value rather than 11
     new translation keys", because it is now false.
4. **`inventory-filters.tsx`**:
   - Option text `t(MOVEMENT_TYPE_LABEL_KEY[type])`.
   - The "all" option uses `admin.inventory.movements.filters.allTypes` (it was wrongly
     `common.labels.status`).
   - Render `<MovementTypeLegend />` immediately after the type `Select`.

### Action 4.13 — Other `RepairStatus`/payments consumers

| File | Change |
|---|---|
| `pages/admin/dashboard/components/RepairsByStatusWidget.tsx` | Append `RepairStatus.RETURNED` to the status list and `[RepairStatus.RETURNED]: "repairs.status.returned"` to the label map. |
| `pages/admin/repairs/components/TechniciansTab.tsx` | Add a `returnedCount` column after `cancelledCount`, with header `t(REPAIR_STATUS_LABEL_KEY[RepairStatus.RETURNED])`. Same cell shape as its neighbours. |
| `pages/admin/invoices/components/PaymentsLedger.tsx` (client tab, desktop and mobile) | Invoice cell: `invoiceNumber ?? (repairReference ? t("admin.invoices.payments.table.repairRef", { reference: repairReference }) : t("…onAccount"))`. Amount cell: when `reversesReference`, render a second muted line `t("admin.invoices.payments.table.reverses", { reference })`. |

The other `ClientPaymentDto` consumers (`client-payments-table.tsx`,
`pos-client-detail-drawer.tsx`, `AdminClientDetail.tsx`, `StaffInvoices.tsx`,
`StaffPosClients.tsx`): run `grep` to confirm none of them builds the DTO by hand. If one
renders an invoice-or-on-account cell, apply the same `repairRef` fallback. Otherwise leave it.

### Action 4.14 — `src/config/translations.json`

The file is **`translations.json`** (plural), not the `translation.json` named in the brief.
Every entry has the shape `{ "en": …, "fr": …, "ar": "" }`, matching the existing keys.

| Key | en | fr |
|---|---|---|
| `staff.repairs.board.returned` | Returned | Retournée |
| `repairs.status.returned` | Returned | Retournée |
| `staff.repairs.return.action` | Return repair | Retourner la réparation |
| `staff.repairs.return.title` | Return repair | Retour de réparation |
| `staff.repairs.return.description` | The device was picked up. Returning it cancels invoice {invoice} and reverses every payment. | L'appareil a été récupéré. Le retour annule la facture {invoice} et rembourse chaque paiement. |
| `staff.repairs.return.restockLabel` | Back in stock | Remettre en stock |
| `staff.repairs.return.noParts` | No parts on this repair — nothing to restock | Aucune pièce sur cette réparation — rien à remettre en stock |
| `staff.repairs.return.refundTotal` | Refund to the customer | Remboursement au client |
| `staff.repairs.return.accountNote` | The client's account returns to its balance before this repair. | Le compte du client revient à son solde d'avant cette réparation. |
| `staff.repairs.return.walkInNote` | Walk-in customer — hand the amount back in cash. | Client de passage — rendez le montant en espèces. |
| `staff.repairs.return.noteLabel` | Reason (optional) | Motif (facultatif) |
| `staff.repairs.return.confirm` | Confirm return | Confirmer le retour |
| `staff.repairs.return.success` | Repair returned | Réparation retournée |
| `staff.repairs.detail.refunded` | Refunded | Remboursé |
| `staff.repairs.detail.partRestocked` | Restocked | Remis en stock |
| `staff.repairs.detail.partNotRestocked` | Not restocked | Non remis en stock |
| `staff.repairs.payments.reverses` | reverses {reference} | annule {reference} |
| `staff.repairs.receipt.refunded` | Refunded | Remboursé |
| `admin.invoices.payments.table.repairRef` | Repair {reference} | Réparation {reference} |
| `admin.invoices.payments.table.reverses` | Reverses {reference} | Annule {reference} |
| `admin.inventory.movements.filters.allTypes` | All types | Tous les types |
| `admin.inventory.movements.legend.open` | What do the movement types mean? | Que signifient les types de mouvement ? |
| `admin.inventory.movements.legend.title` | Movement types | Types de mouvement |
| `admin.inventory.movements.legend.group.in` | Stock in | Entrées |
| `admin.inventory.movements.legend.group.out` | Stock out | Sorties |
| `admin.inventory.movements.legend.group.pending` | Reservations (on-hand unchanged) | Réservations (stock physique inchangé) |
| `common.errors.sentinel.repairReadOnly` | This repair is closed and can no longer be edited | Cette réparation est clôturée et ne peut plus être modifiée |
| `common.errors.sentinel.repairStatusChanged` | This repair was just changed elsewhere — reopen it and try again | Cette réparation vient d'être modifiée ailleurs — rouvrez-la et réessayez |
| `common.errors.sentinel.repairReturnRequiresPickedUp` | Only a picked-up repair can be returned | Seule une réparation récupérée peut être retournée |
| `common.errors.sentinel.repairReturnViaReturnAction` | Use the ticket's Return action to return a repair | Utilisez l'action Retour du ticket pour retourner une réparation |
| `common.errors.sentinel.repairUnknownPart` | A selected part does not belong to this repair | Une pièce sélectionnée n'appartient pas à cette réparation |
| `common.errors.sentinel.repairConsumptionNotFound` | This part's stock history can't be found, so it can't be restocked — return it without restocking | L'historique de stock de cette pièce est introuvable — retournez-la sans la remettre en stock |

**Movement types:** one label key and one help key per member,
`admin.inventory.movements.types.<camelCase>` and `admin.inventory.movements.legend.<camelCase>`:

| Member | Label en / fr | Help en / fr |
|---|---|---|
| SUPPLIER_INVOICE | Supplier invoice / Facture fournisseur | Stock received on a confirmed supplier invoice. / Stock reçu sur une facture fournisseur confirmée. |
| INITIAL_STOCK | Initial stock / Stock initial | Opening quantity entered when the product was created. / Quantité de départ saisie à la création du produit. |
| ADJUSTMENT_IN | Adjustment (in) / Ajustement (entrée) | Stock added by an inventory count or correction. / Stock ajouté par un inventaire ou une correction. |
| RETURN_IN | Sale/order return / Retour vente/commande | A returned sale or order item put back on the shelf at its original cost. / Article de vente ou commande retourné, remis en rayon à son coût d'origine. |
| REPAIR_RETURN | Repair return / Retour de réparation | A part from a returned repair put back on the shelf at the cost it was consumed at. / Pièce d'une réparation retournée, remise en rayon au coût auquel elle avait été consommée. |
| SALE | Sale / Vente | Stock sold at the POS. / Stock vendu en caisse. |
| ORDER_OUT | Order / Commande | Stock shipped or handed over on a completed online order. / Stock remis sur une commande en ligne terminée. |
| REPAIR_CONSUMPTION | Repair consumption / Consommation réparation | A part fitted in a repair, consumed when the device was picked up. / Pièce posée sur une réparation, consommée à la récupération de l'appareil. |
| ADJUSTMENT_OUT | Adjustment (out) / Ajustement (sortie) | Stock removed by an inventory count, damage or loss. / Stock retiré par un inventaire, une casse ou une perte. |
| PENDING_ORDER | Order reservation / Réservation commande | Held for an online order; still on the shelf. / Réservé pour une commande en ligne ; toujours en rayon. |
| PENDING_REPAIR | Repair reservation / Réservation réparation | Held for a repair part; still on the shelf. / Réservé pour une pièce de réparation ; toujours en rayon. |
| PENDING_RELEASE | Reservation released / Réservation libérée | A reservation given back: part removed, order cancelled, or released just before consumption. / Réservation rendue : pièce retirée, commande annulée, ou libérée juste avant consommation. |
| REPAIR_CANCELLED | Repair cancelled / Réparation annulée | Reservation released because its repair was cancelled — nothing left the shelf. / Réservation libérée car la réparation a été annulée — rien n'a quitté le rayon. |

Validate the file with `node -e "JSON.parse(require('fs').readFileSync('Apps/web/src/config/translations.json','utf8'))"`.

---

## §5 — Stage-00 documentation (authoritative model)

Make the S30 edits only. Stage-00's repairs text is already stale from S13 (it still mentions
`saleId` and `consumedPartReturns`). **Report that staleness. Do not rewrite it**, except where
an S30 sentence would contradict it.

1. `Docs/Stage-00-Conception/database-description.md`:
   - `:84` StockMovement types: add `REPAIR_RETURN` under IN and `REPAIR_CANCELLED` under PENDING.
   - `:150` Repair: status enum gains `RETURNED`; add `refundedAmount`, `cancelledAt?`, `returnedAt?`.
   - `:152` RepairPart: add `consumptionMovementId?` and `restockedOnReturn?`.
   - `:166` ClientPayment: add `repairId?` (missing since S13) and `reversalOfId?`.
2. `Docs/Stage-00-Conception/Module-Contracts/repairs.md`:
   - Add the RETURN route row.
   - Update the `RepairStatus` line.
   - Rewrite the `CANCELLED` clause of Business Logic item 3 to S30 (release as REPAIR_CANCELLED, payment-by-payment reversal).
   - Add item 5 — Return (PICKED_UP → RETURNED; restock per part at consumed cost; every payment reversed; invoice cancelled; credit/totalPaid/totalSold restored).
   - Add `repair.returned` under Events.
3. `Docs/Stage-00-Conception/schema.prisma` (the Stage-00 copy): mirror Action 1.1's additions.

---

## §6 — The arithmetic, worked (check the implementation against these)

**Setup.** POS client C has `credit 0`, `totalPaid 0`, `totalSold 0`. Product P has two FIFO
layers: 1 @ 1 800 and 5 @ 2 000, so `onHand 6`, `reserved 0`. Repair R has one part P ×1 at
3 000 and labour 1 000, so `total 4 000`.

| Step | Ledger rows (ClientPayment) | Stock rows | C credit / totalPaid / totalSold | P onHand / reserved |
|---|---|---|---|---|
| Add part | — | `PENDING_REPAIR +1` | 0 / 0 / 0 | 6 / 1 |
| Payment 1 500 at PROCESSING | PAY-1 +1 500 (on account, repairId R) | — | −1 500 / 1 500 / 0 | 6 / 1 |
| Pickup, pays 1 000 | PAY-1 relinked to FAC-1; PAY-2 +1 000 (FAC-1) | `PENDING_RELEASE −1`, `REPAIR_CONSUMPTION −1` (cost 1 800, layer 1) | charge +4 000, then −1 000: 1 500 / 2 500 / 4 000 | 5 / 0 |
| **Return, part restocked** | PAY-3 −1 000 reversalOf PAY-2; PAY-4 −1 500 reversalOf PAY-1 (both on FAC-1) | `REPAIR_RETURN +1`, unitCost **1 800** | +1 000, +1 500, then −4 000: **0 / 0 / 0** | 6 / 0 |

After the return: FAC-1's paid amount is recomputed to 0 and its status walks down to ISSUED,
then it is set to **CANCELLED**. R ends **RETURNED**, `paidAmount 0`, `refundedAmount 2 500`.
`avgStockPrice` is recomputed with a layer at 1 800. `avgPrice` is **unchanged**. If the part is
**not** restocked: no stock row, P stays at onHand 5, and the money rows are identical.
Statistics: R is absent from every revenue, cost and profit figure (Q2).

**Cancellation, partial refund.** Same client and repair. Payments PAY-1 +1 500 and then PAY-2
+500 are taken before pickup, giving credit −2 000 and totalPaid 2 000. Cancel with the prompt
lowered to 700:

- Stock: `REPAIR_CANCELLED −1` (PENDING). Reserved 1 → 0, onHand 6 → **6 (unchanged)**.
- Ledger: PAY-3 −500 reversalOf PAY-2 (newest first, fully). PAY-4 −200 reversalOf PAY-1 (partly).
- C: credit −2 000 → −1 300 (the store still owes 1 300 on account), totalPaid 2 000 → 1 300, totalSold unchanged at 0.
- R: CANCELLED, `paidAmount 1 300`, `refundedAmount 700`, `cancelledAt` set. No invoice exists.

With the prompt left at its default of 2 000, the end state is credit 0 and totalPaid 0.

**Walk-in return.** The repair was paid 4 000 at pickup (exact, as walk-ins require). There are
no ledger rows. The invoice is CANCELLED with its `paidAmount 4 000` snapshot unchanged (P7).
R: `paidAmount 0`, `refundedAmount 4 000`.

---

## §7 — Validation gate

No test file may be read, edited or run (hard rule 3). From the repo root:

```bash
cd Apps/contract && npx tsc --noEmit && npm run lint
cd ../api      && npx tsc --noEmit && npm run lint
cd ../web      && npx tsc --noEmit && npm run lint
```

- `Apps/api`'s tsconfig includes `test/**`. Filter `tsc` output to non-test paths, and list any
  new test-file staleness in the report, per file. Expect it in repairs, inventory and billing
  specs: new `release`/`returnIn` params, new DTO fields, `TechnicianStatsRow.returnedCount`, and
  `isRepairStatusTerminal`'s new meaning.
- `npm run lint` in this repo **crashes rather than warns** on real findings. Treat a crash as a
  finding.
- Web lint: auto-fix prettier-only noise in touched files with `eslint --fix`, and confirm the
  count otherwise matches the pre-change baseline.

Grep sweeps to run before declaring the gates green:

- `grep -rn "isRepairStatusTerminal" Apps/api/src Apps/web/src`: no remaining runtime use that
  should be `isRepairReadOnly`.
- `grep -rn "'REPAIR_READ_ONLY'" Apps/api/src`: none (use `REPAIR_ERROR.READ_ONLY`).
- `grep -rn "existing.parts\|existing.paidAmount\|existing.labourPrice" Apps/api/src/modules/repairs`:
  only in pre-transaction fast-fail checks. Nothing inside a `$transaction` callback.
- `grep -rn "PENDING_RELEASE" Apps/api/src/modules/repairs`: none. Cancel passes
  `REPAIR_CANCELLED`; pickup and removePart use the default.

---

## §8 — Manual verification checklist (browser)

Open `/admin/inventory` (Stock, Movements, Reservations), `/admin/invoices` → Payments, the
POS-client detail drawer and `/admin/repairs` in separate tabs. Use one POS client whose credit
you note down first, and one product P whose on-hand, reserved and avg stock price you note down.

### A. Reservations and the display fix (F4/F5)
1. Open a repair in INTAKE and add P ×1. **Without reloading**, the admin products list and the
   repair's own part search show P's available quantity **down by 1**.
2. Delete the part. Without reloading, available goes **back up**.
3. Movements tab, filtered on P: `Repair reservation +1` then `Reservation released −1`, both
   referencing `REP-…`, in the same second as your clicks. The type column and the type filter
   show translated labels. The ⓘ legend opens and explains every type in three groups. The
   filter's first option reads "All types".
4. Reservations tab: no open row for that repair.
5. Add P ×1 again. In a second tab, open the same repair and move it to CANCELLED. Back in the
   first tab, try to add another part: you get the "repair is closed" toast, **not** a new
   reservation. Reservations tab: nothing open for that repair. (F6)

### B. Cancellation (from INTAKE, PROCESSING and COMPLETED)
6. New repair for the POS client. Add P ×1, record payments of 1 500 and then 500, set labour,
   and cancel with the refund lowered to 700.
7. Movements: one **`Repair cancelled −1`** row (PENDING). Stock tab: P's **on-hand is
   unchanged** and reserved is back to its starting value. **No IN row exists.**
8. Payments page: two new negative rows. −500 "Reverses PAY-(the 500)" and −200 "Reverses
   PAY-(the 1 500)". The invoice column reads "Repair REP-…". Credit snapshots chain: credit
   rises by 500, then by 200.
9. POS-client drawer: credit is 1 300 below where it was before the repair, and totalPaid is
   1 300 above. The ticket reads CANCELLED, Paid 1 300, Refunded 700, and is read-only.
10. Repeat with the default refund (= everything paid). Credit and totalPaid return to their
    pre-repair values.
11. Try to cancel a PICKED_UP repair: CANCELLED is not offered, and no Update-status button
    shows.
12. Statistics overview and repairs report for today: cancelled repairs add nothing to revenue,
    cost or profit. Technicians tab: they count under Cancelled only.

### C. Pickup (regression) and Return
13. New repair for the POS client. P ×1 at 3 000, labour 1 000, prepay 1 500, pick up paying
    1 000. Movements: `Reservation released −1`, then `Repair consumption −1` with its cost.
    Invoice FAC-… is PARTIALLY_PAID at 2 500.
14. The ticket shows a red **Return repair** button. Open it: one switch per part (on by
    default), refund 2 500 read-only, the account note. Switch the part **on** and confirm.
15. Movements: `Repair return +1` (IN), referencing `REP-…`, with **unit cost equal to the
    consumption row's cost** (not the current average). Stock: P on-hand +1, avg stock price
    recomputed. Avg price (supplier) unchanged.
16. Payments: −1 000 reversing the pickup payment and −1 500 reversing the prepayment, both
    showing FAC-… in the invoice column.
17. Invoices: FAC-… is **CANCELLED**, and its number is unchanged (no renumbering, no gap
    closed).
18. POS-client drawer: credit, totalPaid and totalSold are **exactly** the values you noted
    before step 13.
19. Ticket: RETURNED, read-only, the part badged "Restocked", Refunded 2 500, timeline shows
    Picked up → Returned with your reason. Board: card in the new **Returned** lane. Dashboard
    widget: Returned count.
20. Repeat steps 13–19 with the switch **off**: no `Repair return` row, P on-hand unchanged,
    badge "Not restocked", money rows identical.
21. Statistics for today: both returned repairs are absent from revenue, cost and profit.
    Technicians tab: counted under Returned, not in revenue.
22. Walk-in repair, picked up and fully paid, then returned. No ledger rows appear. Invoice
    CANCELLED. Ticket Paid 0, Refunded = total.
23. Drag any card onto the Returned lane: it snaps back with "That move isn't allowed".

### D. Receipts and tickets (Q3)
24. Fresh INTAKE ticket, nothing priced. Print the receipt (browser and thermal if available).
    **No Total, no Amount due, no stamp.** If a prepayment was recorded, only "Paid" shows.
25. Add a part and labour, then print: **no parts lines, no labour line, no parts total**. Total,
    Paid, Amount due and the stamp show the current figures.
26. Picked-up ticket: Total, Paid and the PAID stamp, with no breakdown. Cancelled or returned
    ticket: the "Refunded" line appears.
27. The client label (Print label) is unchanged.

### E. Regression sweep
28. Orders: confirm, cancel and complete an order. Reservations open and close as before, and
    Reservations shows no stray negative or open rows (P1 clamp).
29. POS sale and sales return: unchanged, `Sale/order return` label on RETURN_IN rows.
30. Ledger CSV/PDF export still works. Types there are raw enum names (server-side export, out of
    scope).

---

## §9 — Files touched

**New (4):**
- `Apps/web/src/pages/staff/repairs/components/RepairReturnDialog.tsx`
- `Apps/web/src/pages/staff/repairs/return-repair.schema.ts`
- `Apps/web/src/pages/admin/inventory/movement-type-labels.ts`
- `Apps/web/src/pages/admin/inventory/components/movement-type-legend.tsx`

Also new: the migration directory `Apps/api/prisma/migrations/<ts>_s30_repair_return/`.

**Modified:**
- **api:** `prisma/schema.prisma`; `modules/inventory/inventory.{interface,service}.ts`;
  `modules/billing/billing.{interface,service,mapper}.ts`;
  `modules/repairs/repairs.{interface,service,mapper,controller,routes}.ts`;
  `modules/observability/observability.listener.ts`; `modules/statistics/statistics.service.ts`
  (comments only).
- **contract:** `modules/inventory/inventory.enums.ts`;
  `modules/repairs/repairs.{enums,constants,command,routes,dtos,events}.ts`;
  `modules/billing/billing.dtos.ts`.
- **web:** `services/repairs.service.ts`; `hooks/useRepairs.ts`; `lib/query-client.ts`;
  `pages/staff/repairs/{repair-status-labels.ts, repair-receipt-escpos.ts, StaffRepairs.tsx}`;
  `pages/staff/repairs/components/{RepairBoard, RepairStatusDialog, RepairTicketDetail, RepairReceipt}.tsx`;
  `pages/admin/inventory/components/{movement-ledger-table, inventory-filters}.tsx`;
  `pages/admin/dashboard/components/RepairsByStatusWidget.tsx`;
  `pages/admin/repairs/components/TechniciansTab.tsx`;
  `pages/admin/invoices/components/PaymentsLedger.tsx`; `config/translations.json`.
- **docs:** `Docs/Stage-00-Conception/{database-description.md, schema.prisma, Module-Contracts/repairs.md}`.

**Deliberately not touched:**
- `orders.service.ts` and `sales.service.ts`. They benefit from P1 without edits.
- `clients.service.ts`. Its existing ports are enough.
- Billing's HTTP `cancelInvoice` (gap reported, §3.3.5).
- The statistics stock-movement report's raw type labels.
- Server-side CSV/PDF type labels.
- Every test file.

---

## §10 — Execution protocol

Execute this set alone. When it is finished, write `Docs/Stage-04-Fixes/results/report-S30.md`.
The report must:

1. Open with the **§0.3 finding**: the database never leaked. The symptom came from stale product
   caches and an unlabelled ledger. Also state what was hardened (P1, P2).
2. List the **§0.4 decisions P1–P8** so the owner can object.
3. Describe every change by file, list the validation-gate results (with the test-file
   staleness itemised), and list the pre-existing Stage-00 staleness found.
4. End with the **§8 checklist** verbatim.

The owner reviews and approves the report before S31 begins.
