# Plan S13 — Repairs

Execution plan for **set 13** of `Docs/Stage-04-Fixes/app-issues-01.md`.
Implements **D5**, **D6**, **D8**, **D9** on the repairs module, end to end.

---

## §0 — Before you start

### 0.1 Sets that must already be landed

| Set | What S13 consumes from it | Verified present |
|---|---|---|
| **S1** | `InvoiceSource.REPAIR`, `Repair.invoiceId String? @unique`, `Sale.origin` + its enum removed, sales' `repair.pickedUp` listener deleted | ✅ `schema.prisma:113-117`, `:823`; no `sales.listener.ts` exists |
| **S2** | `components/shared/autocomplete-input.tsx` rebuilt to the RC-1 contract (`value` = id, input always shows `label`) | ✅ `autocomplete-input.tsx:46-56` |
| **S5** | `applyDocumentCharge` / `applyLedgerPayment` on the clients credit port; `issueInvoiceInTx` / `captureClientPaymentInTx` on billing | ✅ `clients.service.ts:468`, `:495`; `billing.service.ts:130`, `:272` |
| **S10** | The completion pattern this set mirrors line for line | ✅ `orders.service.ts:342-511` (`completeOrder`) |

**Read `orders.service.ts:340-511` before writing any backend code in this set.** The repair
pickup transaction is structurally the same transaction as `completeOrder`, and any divergence
from it should be deliberate and commented.

### 0.2 Owner decisions taken while planning (settled — do not re-open)

| # | Decision |
|---|---|
| **R1** | **Technicians tab = counts + revenue.** Per technician: total repairs, one count per `RepairStatus`, and `revenue` = Σ `totalAmount` over that technician's `PICKED_UP` repairs. No profit column, no turnaround column. |
| **R2** | **Keep the 5-lane board; paginate the whole filtered set at 10/page.** `RepairListQuery` gains `page`/`limit`; the board renders whichever ≤10 tickets came back, spread across its existing lanes. The page selector lives in the filter row beside the technician and date-range filters. Drag-and-drop survives unchanged. |
| **R3** | **Add `ClientPayment.repairId String?`** (+ relation + index). At `PICKED_UP` the repair's on-account rows are re-linked to the freshly issued invoice, so `Invoice.paidAmount = Σ ClientPayment.amount` stays true by construction. |

### 0.3 One decision this plan takes on its own — flag it back to the owner

**R4 — `Repair.totalProfit` becomes `totalAmount − totalCost`, i.e. labour counts as profit.**

Today `totalProfit` is Σ `RepairPart.profit` only, while `totalAmount` is parts **plus** labour.
That triple is internally incoherent (`revenue − cost ≠ profit`) and S14 has to read all three
off `Repair` directly (D8/D9), so it cannot stay. The old repair-origin `Sale` carried the same
incoherence (`recordRepairSale` copied `payload.totalProfit`, parts-only, onto a sale whose
`totalAmount` included labour) — this is a latent bug being closed, not a re-interpretation of a
figure anyone has relied on.

**Executor: implement R4, and put it at the top of the report so the owner can object.** No
existing repair figure is displayed anywhere today except in the ticket drawer, so the blast
radius is nil.

### 0.4 Data caveat — existing COMPLETED repairs

Under the pre-S13 rule, `changeStatus(COMPLETED)` already released and **consumed** every part
(`repairs.service.ts:226-235`). After this set, consumption happens at `PICKED_UP` instead. Any
repair currently sitting in `COMPLETED` has therefore already drained its FIFO layers and would
consume a **second** time at pickup.

The database is not in production. **Action 1.2** below carries the `DELETE` statements that clear
repair data as part of the migration. If the owner wants the rows kept, say so before executing —
there is no correct in-place fix, only an inventory re-count.

### 0.5 Root causes found while reading (not obvious from the issue text)

| # | Finding | Consequence for this plan |
|---|---|---|
| **F1** | **The "spare-part input doesn't select a product" bug is two bugs.** `RepairTicketDetail.tsx:130-150` uses a raw `<Input>` for search whose text never changes on selection (so the field visibly keeps the typed query), *and* `addRepairPartSchema`'s `productId: z.uuid()` failure is never rendered — `errors.productId` has no `<p>` anywhere in the form, so a submit with no selection fails **silently**. The visible symptom "its price appears but nothing is selected" is exactly this pair. Fix both: swap in `AutocompleteInput` (label-showing, RC-1) **and** render `errors.productId`. |
| **F2** | **`consumedPartReturns` becomes dead code.** It exists (contract command, service branch `repairs.service.ts:245-251`, `repair-status.schema.ts` refine, `RepairStatusDialog.tsx:147-171`, `StaffRepairs.tsx:140-143`) purely to restock parts that were consumed at `COMPLETED`. Under D8 nothing is ever consumed before `PICKED_UP`, and cancel is unreachable *from* `PICKED_UP` — so no part can ever be consumed at cancel time. Delete the whole path, including `buildOriginalConsumptions` (its only caller). |
| **F3** | **`RepairStatusCommand.paidAmount` is an absolute overwrite** (`repairs.service.ts:270` writes `paidAmount: cmd.paidAmount` straight onto the row). Cumulative payments (D5) make that wrong: the pickup-moment field must be a **delta**. Renamed to `paymentAmount` in this set so the change is impossible to miss at every call site. |
| **F4** | **`repairs.service.ts:284-307`'s comment block is already wrong** the moment consumption moves. It claims "COMPLETED (a prior, separate call) already stamped every part's costOfGoods/profit … so the pre-load snapshot is still current". After this set the stamping happens *inside* the pickup transaction, so `existing` (pre-loaded, line 192) carries `null`s. The event payload must be built from the in-transaction results, and that comment rewritten. |
| **F5** | **`StaffRepairs.tsx:57-59` documents the cascading brand→model gap explicitly** ("IntakeDialog has no onBrandChange callback … the full, unfiltered model list is passed instead"). This set closes it; that comment must be deleted, not left lying. |
| **F6** | **`repairs.interface.ts:21-22` and `repairs.service.ts:85-86` both reference "sales' own listener"** reading the intake history row for `repair.pickedUp`'s missing staffId. That listener was deleted in S1. Both comments are stale — the intake history row still matters (creator scoping), but for one reason now, not two. |
| **F7** | **`useRepairs.ts:98-100`'s comment** says a status transition "hand[s] off to a repair-origin sale/invoice". No sale is produced any more (D9). Rewrite. |
| **F8** | **`billing.service.ts:125-127` already anticipates this set** — `captureClientPaymentInTx`'s `invoiceId` is optional precisely for "a repair collect[ing] payments across several steps while its invoice only appears at PICKED_UP". Use it as documented; do not invent a second path. |

---

## §1 — Prisma & migration

### Action 1.1 — `Apps/api/prisma/schema.prisma` — link on-account payments to their repair (R3)

In `model ClientPayment` (line 916), after the `invoiceId` field, add:

```prisma
  repairId       String?  // R3/D5 — set on a payment taken before the repair's invoice exists
                          // (on-account). Re-pointed to `invoiceId` at PICKED_UP; the repairId
                          // itself is kept so a repair can always list its own payments.
```

and in the relation block:

```prisma
  repair    Repair?   @relation(fields: [repairId], references: [id])
```

and an index:

```prisma
  @@index([repairId])
```

In `model Repair` (line 799), add to the relation block:

```prisma
  payments ClientPayment[]
```

**No other schema change is needed.** `Repair.invoiceId` (S1) already exists and already carries
the "pickup idempotency latch" comment — keep it and make it true (Action 3.4 latches on it).

### Action 1.2 — the migration

```bash
cd Apps/api && npx prisma migrate dev --name s13_repair_payment_link
```

Then **append** to the generated `migration.sql` (the data reset from §0.4):

```sql
-- S13/§0.4 — pre-S13 COMPLETED repairs already consumed their parts under the old rule and
-- would consume a second time at PICKED_UP. The database is not in production; repair history
-- is discarded rather than reconciled. Stock movements already written are left in place —
-- run a stock count afterwards if the resulting quantityOnHand matters.
DELETE FROM "ClientPayment" WHERE "repairId" IS NOT NULL;
DELETE FROM "RepairStatusHistory";
DELETE FROM "RepairPart";
DELETE FROM "Repair";
```

Regenerate the client (`npx prisma generate`) before touching any service code.

---

## §2 — Contract (`Apps/contract`)

### Action 2.1 — `src/modules/repairs/repairs.constants.ts` *(new file)*

Mirrors `modules/orders/orders.constants.ts` exactly — the machine lives in the contract so the
backend guard and the frontend dialog read the same table (hard rule 1).

```ts
import { RepairStatus } from './repairs.enums';

// D8 — the forward machine. INTAKE → PROCESSING → COMPLETED → PICKED_UP, with CANCELLED
// reachable from every non-terminal state. Shared by the backend guard (repairs.service.ts's
// changeStatus) and the ticket dialog's status select (S13), so a legal move is defined once.
export const REPAIR_STATUS_TRANSITIONS: Readonly<Partial<Record<RepairStatus, readonly RepairStatus[]>>> = {
  [RepairStatus.INTAKE]: [RepairStatus.PROCESSING, RepairStatus.CANCELLED],
  [RepairStatus.PROCESSING]: [RepairStatus.COMPLETED, RepairStatus.CANCELLED],
  [RepairStatus.COMPLETED]: [RepairStatus.PICKED_UP, RepairStatus.CANCELLED],
};

// Nothing leaves these. PICKED_UP is terminal because its invoice is immutable — reversing a
// pickup needs a return document, not a cancel (D8/D9).
export const REPAIR_TERMINAL_STATUSES: readonly RepairStatus[] = [
  RepairStatus.PICKED_UP,
  RepairStatus.CANCELLED,
];

export function repairTransitionsFrom(from: RepairStatus): readonly RepairStatus[] {
  return REPAIR_STATUS_TRANSITIONS[from] ?? [];
}

export function isRepairTransitionAllowed(from: RepairStatus, to: RepairStatus): boolean {
  return repairTransitionsFrom(from).includes(to);
}

export function isRepairStatusTerminal(status: RepairStatus): boolean {
  return REPAIR_TERMINAL_STATUSES.includes(status);
}

// D8 — the single money moment: parts consumed, invoice issued, revenue recognised.
export function repairTransitionRequiresPayment(to: RepairStatus): boolean {
  return to === RepairStatus.PICKED_UP;
}
```

Export it from `src/modules/repairs/index.ts` (add `export * from './repairs.constants';` as the
first line, matching orders' own ordering).

### Action 2.2 — `src/modules/repairs/repairs.query.ts`

Replace `RepairListQuerySchema` with:

```ts
// S13 — intake-date range + pagination (R2: 10 per page, page selector in the filter row; the
// board is not a table, so the pager is not a table footer). `from`/`to` filter on intakeAt.
export const RepairListQuerySchema = z.object({
  status: z.enum(RepairStatus).optional(),
  technicianId: z.uuid().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
```

Delete the "board data, no pagination" wording wherever it appears — it is now false in three
places: this file, `repairs.interface.ts:11-13`, and `Apps/web/src/services/repairs.service.ts:21-22`.

### Action 2.3 — `src/modules/repairs/repairs.command.ts`

1. **`RepairStatusSchema`** — replace wholesale:

```ts
// S13/D8 — `paymentAmount` is the money captured AT this transition (a DELTA, added to the
// repair's cumulative paidAmount), not the repair's new total. Renamed from `paidAmount`, which
// was an absolute overwrite (F3) and cannot survive D5's cumulative payments.
// `refundAmount` is the cash returned when cancelling a repair that already collected money
// (D6 — recorded as a negative-amount ClientPayment row for a known client).
// `consumedPartReturns` is GONE (F2): under D8 nothing is ever consumed before PICKED_UP, and
// cancel is unreachable from PICKED_UP, so no consumed part can exist at cancel time.
export const RepairStatusSchema = z.object({
  toStatus: z.enum(RepairStatus),
  note: z.string().optional(),
  paymentAmount: z.number().min(0).optional(),
  refundAmount: z.number().min(0).optional(),
});
export type RepairStatusCommand = z.infer<typeof RepairStatusSchema>;
```

2. **New — cumulative payment at any step (D5):**

```ts
// S13/D5 — a payment captured at INTAKE/PROCESSING/COMPLETED, before the invoice exists. For a
// known POS client this becomes an on-account ClientPayment row (null invoiceId, repairId set);
// for a walk-in it only moves the repair's own paidAmount.
export const RecordRepairPaymentSchema = z.object({
  amount: z.number().positive(),
});
export type RecordRepairPaymentCommand = z.infer<typeof RecordRepairPaymentSchema>;
```

### Action 2.4 — `src/modules/repairs/repairs.dtos.ts`

Add to `RepairResponseSchema`, after `pickedUpAt`:

```ts
  // S13/D9 — the invoice issued at PICKED_UP. Absent before pickup and on cancelled repairs.
  invoiceNumber: z.string().optional(),
  // S13/D5 — the ledger rows taken for this repair (on-account before pickup, invoice-linked
  // after). Empty for a walk-in repair: no PosClient means no ledger row is possible, and the
  // repair's own paidAmount is the whole record.
  payments: z.array(
    z.object({
      id: z.uuid(),
      reference: z.string(),
      amount: z.number(),
      paidAt: z.iso.datetime(),
      invoiceId: z.uuid().optional(),
    }),
  ),
```

Add a new DTO at the end of the file (R1):

```ts
// S13/R1 — the admin Technicians tab. Counts per status plus revenue (Σ totalAmount over that
// technician's PICKED_UP repairs — the only status at which repair revenue is recognised, D8).
export const TechnicianRepairStatsResponseSchema = z.object({
  technicianId: z.uuid(),
  technicianName: z.string(),
  isEnabled: z.boolean(),
  totalRepairs: z.number().int(),
  intakeCount: z.number().int(),
  processingCount: z.number().int(),
  completedCount: z.number().int(),
  pickedUpCount: z.number().int(),
  cancelledCount: z.number().int(),
  revenue: z.number(),
});
export type TechnicianRepairStatsDto = z.infer<typeof TechnicianRepairStatsResponseSchema>;
```

### Action 2.5 — `src/modules/repairs/repairs.routes.ts`

Add three route pairs. **`ADMIN_TECHNICIAN_STATS` deliberately does not live under
`/admin/repairs/…`** — it would sit behind `ADMIN_BY_ID`'s `:id` segment, whose
`RepairIdParamsSchema` uuid validation would reject `technicians` with a 400 rather than falling
through.

```ts
  // S13/D5 — cumulative payment at any pre-pickup step.
  STAFF_PAYMENTS: '/staff/repairs/:id/payments',
  ADMIN_PAYMENTS: '/admin/repairs/:id/payments',
  // S13/R1 — the admin Technicians tab. Mounted OUTSIDE /admin/repairs on purpose: a
  // /admin/repairs/technicians path would be swallowed by ADMIN_BY_ID's uuid-validated :id.
  ADMIN_TECHNICIAN_STATS: '/admin/repair-technicians',
```

### Action 2.6 — `src/modules/repairs/repairs.events.ts`

`repair.pickedUp`'s payload gains the invoice, and its header comment must lose the "snapshotParts
isn't fielded in the spec" framing (parts now really are costed inside the pickup transaction):

```ts
  'repair.pickedUp': {
    repairId: string;
    posClientId?: string;
    invoiceNumber: string;   // S13/D9 — always issued at this moment
    totalAmount: number;
    paidAmount: number;      // cumulative, after this transition's own capture
    totalCost: number;
    totalProfit: number;
    snapshotParts: { … unchanged … }[];
    labourPrice: number;
  };
```

`repair.cancelled` gains `refundAmount?: number`.

**Check before editing:** `observability.listener.ts:303-311` consumes `repair.pickedUp`. Adding
fields is safe; confirm it does not destructure a removed one (it does not — nothing is removed).

---

## §3 — Backend (`Apps/api`)

### Action 3.1 — `src/modules/billing/billing.service.ts` + `billing.interface.ts` — two port changes

**3.1a — `captureClientPaymentInTx` accepts `repairId`.** In `billing.interface.ts:59-63` and the
implementation at `billing.service.ts:130-133`, widen the input:

```ts
    input: { posClientId: string; invoiceId?: string; repairId?: string; amount: number; paidAt?: Date; staffId: string },
```

and pass it through to the `tx.clientPayment.create` data block:

```ts
        ...(input.repairId != null ? { repairId: input.repairId } : {}),
```

*Assignability note:* sales' and orders' locally-declared `IBillingIssuePort` (`sales.interface.ts:76`,
`orders.interface.ts:65`) do **not** need editing — an implementation whose parameter object has an
extra **optional** property still satisfies their narrower declarations. Do not touch them.

**3.1b — new port method `linkRepairPaymentsToInvoiceInTx`.** Every `ClientPayment` and `Invoice`
write must stay inside billing (hard rule 5) — repairs may not `updateMany` those tables itself.
Add to `IBillingService` (`billing.interface.ts`, in the injected-port block) and implement:

```ts
  // S13/D5 — at PICKED_UP the repair's on-account rows (invoiceId null) are re-pointed at the
  // invoice just issued, then the invoice's paidAmount/status are recomputed from the ledger, so
  // `Invoice.paidAmount = Σ ClientPayment.amount` holds for repair invoices exactly as it does
  // for sale and order invoices. A NO-OP when nothing was linked: a walk-in repair has no ledger
  // rows at all, and recomputing from an empty ledger would wipe the paidAmount the invoice was
  // issued with.
  async linkRepairPaymentsToInvoiceInTx(
    tx: Prisma.TransactionClient,
    input: { repairId: string; invoiceId: string },
  ): Promise<void> {
    const linked = await tx.clientPayment.updateMany({
      where: { repairId: input.repairId, invoiceId: null },
      data: { invoiceId: input.invoiceId },
    });
    if (linked.count === 0) return;

    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: input.invoiceId }, select: { totalAmount: true } });
    const aggregate = await tx.clientPayment.aggregate({ where: { invoiceId: input.invoiceId }, _sum: { amount: true } });
    const paidAmount = aggregate._sum.amount?.toNumber() ?? 0;
    const totalAmount = invoice.totalAmount.toNumber();
    const status =
      paidAmount <= 0
        ? PrismaInvoiceStatus.ISSUED
        : paidAmount >= totalAmount
          ? PrismaInvoiceStatus.PAID
          : PrismaInvoiceStatus.PARTIALLY_PAID;
    await tx.invoice.update({ where: { id: input.invoiceId }, data: { paidAmount, status } });
  }
```

The status ladder is copied verbatim from `captureClientPaymentInTx` (`billing.service.ts:175-185`) —
add a comment on both saying they must stay in step.

### Action 3.2 — `src/modules/repairs/repairs.interface.ts` — ports and signatures

Add the two injected ports repairs has never had, declared locally and narrowed (the
`ICatalogPricingPort` precedent — no `implements`, structural typing only):

```ts
// Injected port (dependency inversion) — real implementation is clients' own composition-root
// singleton (`clientsService`, exported from clients.routes.ts), assembled in repairs.routes.ts.
// PosClient belongs to clients; repairs writes it only through this port, inside its own
// transaction, on a locked row (D5, credit-serialization fix). `applyLedgerPayment` is NOT
// declared here — repairs never calls it directly; every ledger write goes through billing's
// captureClientPaymentInTx, which owns the ClientPayment row that must accompany it.
export interface IRepairCreditPort {
  applyDocumentCharge(
    tx: Prisma.TransactionClient,
    posClientId: string,
    payload: { totalSoldDelta: number; creditDelta: number },
  ): Promise<{ previousCredit: number; newCredit: number }>;
}

// Injected port — real implementation is billing's own BillingService (billing.routes.ts's
// exported singleton). D9: a repair produces an invoice and no sale record.
export interface IBillingIssuePort {
  issueInvoiceInTx(tx: Prisma.TransactionClient, input: InvoiceIssueRequest): Promise<{ invoiceId: string; number: string }>;
  captureClientPaymentInTx(
    tx: Prisma.TransactionClient,
    input: { posClientId: string; invoiceId?: string; repairId?: string; amount: number; paidAt?: Date; staffId: string },
  ): Promise<{ paymentId: string; reference: string; previousCredit: number; newCredit: number }>;
  linkRepairPaymentsToInvoiceInTx(tx: Prisma.TransactionClient, input: { repairId: string; invoiceId: string }): Promise<void>;
}
```

`InvoiceIssueRequest` is imported from `'../billing/billing.interface'` (the same direct
sibling-type import orders uses — `orders.interface.ts` already does this).

Update `IRepairsService`:

```ts
  listRepairs(query: RepairListQuery, actor: JWTPayload): Promise<PaginatedResult<RepairDto>>;
  …
  recordPayment(id: string, cmd: RecordRepairPaymentCommand, actor: JWTPayload): Promise<RepairDto>;
  listTechnicianStats(): Promise<TechnicianRepairStatsDto[]>;
```

Rewrite the stale header comment (F1's "board data, not a paginated list") and **F6**'s two
"sales' own listener" references (`:21-22`): the intake history row now anchors creator-scoping
only.

### Action 3.3 — `src/modules/repairs/repairs.routes.ts` — wiring

```ts
import { clientsService } from '../clients/clients.routes';
import { billingService } from '../billing/billing.routes';
…
const service = new RepairsService(prisma, inventoryService, sequenceService, clientsService, billingService);
```

Add a header comment matching `orders.routes.ts:22-23`'s: *"clientsService satisfies
IRepairCreditPort structurally; billingService satisfies IBillingIssuePort structurally — no
adapter needed."*

Mount the new routes:

```ts
router.post(
  REPAIR_ROUTES.STAFF_PAYMENTS,
  staffRepairsOrAdmin,
  validateRequest({ params: RepairIdParamsSchema, body: RecordRepairPaymentSchema }),
  controller.recordPayment,
);
router.post(
  REPAIR_ROUTES.ADMIN_PAYMENTS,
  adminOnly,
  validateRequest({ params: RepairIdParamsSchema, body: RecordRepairPaymentSchema }),
  controller.recordPayment,
);

// R1 — admin-only; the staff Technicians tab is out of scope here (S18 aligns staff guards).
router.get(REPAIR_ROUTES.ADMIN_TECHNICIAN_STATS, adminOnly, controller.listTechnicianStats);
```

**Verify the export names first**: `grep -n "^export" Apps/api/src/modules/clients/clients.routes.ts
Apps/api/src/modules/billing/billing.routes.ts` — use whatever those files actually export, not
the names guessed here.

### Action 3.4 — `src/modules/repairs/repairs.service.ts` — the core rewrite

This is the largest single action in the set. Work through it in the order below.

**3.4a — constructor** takes the two new ports:

```ts
  constructor(
    private prisma: PrismaClient,
    private inventory: IInventoryService,
    private sequence: ISequenceService,
    private clientCredit: IRepairCreditPort,
    private billing: IBillingIssuePort,
  ) { … }
```

Add a module constant near `STATUS_SEQUENCE`:

```ts
// The labour line's label on the issued invoice (D9). A persisted snapshot, not UI text — same
// class as billing's own 'Walk-in Customer' default, so it is a server-side constant and not a
// t() key.
const REPAIR_LABOUR_LINE_LABEL = 'Labour';
```

**Delete `STATUS_SEQUENCE`** — `repairTransitionsFrom` from the contract replaces it.

**3.4b — `listRepairs` → paginated + date range.** Add to the `where`:

```ts
      ...(query.from != null || query.to != null
        ? { intakeAt: { ...(query.from != null ? { gte: new Date(query.from) } : {}), ...(query.to != null ? { lte: new Date(query.to) } : {}) } }
        : {}),
```

and return `PaginatedResult<RepairDto>` using the same `$transaction([count, findMany])` +
`paginated(RepairResponseSchema).parse(...)` shape as `billing.service.ts:listInvoicesFor`
(`skip: (query.page - 1) * query.limit`, `take: query.limit`, `orderBy: { intakeAt: 'desc' }`).

**3.4c — read-only guard.** Add a private helper and call it first in `updateRepair`, `addPart`
and `removePart`:

```ts
  // D8 — once picked up or cancelled a repair is frozen: no product edits, no labour edits. A
  // picked-up repair's invoice is immutable; reversing it needs a return document, not an edit.
  private assertEditable(status: PrismaRepairStatus): void {
    if (isRepairStatusTerminal(status as RepairStatus)) {
      throw new ConflictError('REPAIR_READ_ONLY');
    }
  }
```

**3.4d — `changeStatus`: the transition guard.** Replace the `STATUS_SEQUENCE` index arithmetic
(`repairs.service.ts:204-214`) with the contract machine:

```ts
    if (!isRepairTransitionAllowed(existing.status as RepairStatus, cmd.toStatus)) {
      throw new BadRequestError('Illegal repair status transition');
    }
    if (cmd.toStatus === RepairStatus.PROCESSING && existing.technicianId == null) {
      throw new BadRequestError('technicianId is required before moving to PROCESSING');
    }
```

Keep the idempotent re-`COMPLETED` short-circuit at `:196-198` exactly as it is. Delete the
separate CANCELLED branch — `REPAIR_STATUS_TRANSITIONS` already encodes "CANCELLED from every
non-terminal state, never from PICKED_UP or CANCELLED", which is what that branch hand-rolled.

**3.4e — `COMPLETED` no longer consumes (D8).** Delete the entire `if (cmd.toStatus ===
RepairStatus.COMPLETED)` block at `:226-235`. Parts stay reserved from `addPart` right through to
pickup. `totalCost`/`totalProfit` are no longer written at `COMPLETED` — strip them from the
`tx.repair.update` data at `:268`, leaving only `completedAt`.

**3.4f — `CANCELLED` (D6/D8).** Replace `:237-252` with:

```ts
      if (cmd.toStatus === RepairStatus.CANCELLED) {
        // D8 — nothing was ever consumed (consumption happens at PICKED_UP alone), so every part
        // is simply released. The old consumedPartReturns/restock path is gone with it (F2).
        for (const part of existing.parts) {
          await this.inventory.release(tx, part.productId, part.quantity, ref);
        }

        // D6 — money already collected is returned as a NEGATIVE-amount ledger row, never by
        // editing totalPaid. Capped at what was actually taken. A walk-in repair has no PosClient
        // and therefore no ledger row: its own paidAmount is the whole record (D5).
        const alreadyPaid = existing.paidAmount.toNumber();
        refundApplied = Math.min(cmd.refundAmount ?? alreadyPaid, alreadyPaid);
        if (refundApplied > 0 && existing.posClientId != null) {
          await this.billing.captureClientPaymentInTx(tx, {
            posClientId: existing.posClientId,
            repairId: id,
            amount: -refundApplied,
            staffId,
          });
        }
      }
```

and add `...(cmd.toStatus === RepairStatus.CANCELLED ? { cancelledAt: new Date(), paidAmount: existing.paidAmount.toNumber() - refundApplied } : {})`
to the `tx.repair.update` data.

> `cancelledAt` does not exist on `Repair`. **Do not add it** — the `RepairStatusHistory` row
> written in the same transaction already carries the timestamp, and no DTO exposes a cancelled-at
> field. Write only `paidAmount`.

**Delete `buildOriginalConsumptions` entirely** (`:334-362`) — F2 removes its only caller.

**3.4g — `PICKED_UP`: the money moment (D5/D8/D9).** This is the new heart of the method. Mirror
`orders.service.ts:342-511`. Extract it into a private `pickUpRepair(existing, cmd, actor)` rather
than growing `changeStatus` — `changeStatus` should branch to it the way `updateStatus` branches to
`completeOrder`.

Sequence, all inside one `this.prisma.$transaction`:

1. **Resolve the client.** `existing.posClientId` is already a `PosClient` id (repairs attach POS
   clients directly, unlike orders which proxy through `Client.posClientId` — no resolution step
   needed). `clientNameSnapshot` falls back to `existing.customerName` when `posClientId` is null,
   so a walk-in's invoice shows the real name rather than "Walk-in Customer".
2. **Guard, before the transaction opens** (fail fast, no wasted FIFO work — orders' R2 discipline
   at `orders.service.ts:369-374`):

   ```ts
   const paidBefore = existing.paidAmount.toNumber();
   const paymentAmount = cmd.paymentAmount ?? 0;
   const totalAmount = existing.totalAmount.toNumber();
   // A walk-in has no PosClient to hold a debt against — the repair must leave fully paid.
   if (existing.posClientId == null && paidBefore + paymentAmount !== totalAmount) {
     throw new BadRequestError('CREDIT_REQUIRES_CLIENT');
   }
   ```
3. **Release + consume, per part** (FIFO), stamping each `RepairPart` and accumulating
   `totalCost` / partsProfit — the same loop `COMPLETED` used to run, moved here verbatim, with
   `MovementType.REPAIR_CONSUMPTION` and `ref = { referenceType: 'REPAIR', referenceId: id, staffId }`.
4. **R4 — profit.** `const totalProfit = totalAmount - totalCost;` (labour is pure profit). Do
   **not** use the summed part profits; comment the line with R4's reasoning.
5. **Charge the account (D5).** Only when `posClientId != null`:
   ```ts
   ({ previousCredit } = await this.clientCredit.applyDocumentCharge(tx, existing.posClientId, {
     totalSoldDelta: totalAmount,
     creditDelta: totalAmount,
   }));
   ```
6. **Issue the invoice (D9).** `sourceType: InvoiceSource.REPAIR`, `sourceId: id`,
   `paidAmount: posClientId != null ? 0 : paidBefore + paymentAmount`,
   `previousCredit`, `newCredit: previousCredit + (totalAmount - (paidBefore + paymentAmount))`,
   `totalCost`, `totalProfit`, `staffId`, and lines = one per part
   (`label: part.productNameSnapshot`, `quantity`, `unitPrice`, `costSnapshot`, `profit`,
   `lineTotal`, `serialNumbers` when present) **plus**, when `labourPrice > 0`, one line
   `{ label: REPAIR_LABOUR_LINE_LABEL, quantity: 1, unitPrice: labourPrice, costSnapshot: 0, profit: labourPrice, lineTotal: labourPrice }`.
7. **Re-link the on-account rows (R3).**
   `await this.billing.linkRepairPaymentsToInvoiceInTx(tx, { repairId: id, invoiceId: issued.invoiceId });`
   — after issuance, before the capture, so the capture's own recompute sees the linked rows.
8. **Capture this transition's payment (D5).** Only when `posClientId != null && paymentAmount > 0`:
   `captureClientPaymentInTx(tx, { posClientId, invoiceId: issued.invoiceId, repairId: id, amount: paymentAmount, staffId })`.
9. **Latch and stamp the repair:**
   ```ts
   const latch = await tx.repair.updateMany({
     where: { id, invoiceId: null },
     data: {
       status: PrismaRepairStatus.PICKED_UP,
       pickedUpAt: new Date(),
       invoiceId: issued.invoiceId,
       paidAmount: paidBefore + paymentAmount,
       totalCost,
       totalProfit,
     },
   });
   if (latch.count === 0) throw new ConflictError('Repair has already been picked up');
   ```
   (`Repair.invoiceId @unique` is the idempotency latch S1's own schema comment promised —
   the same `updateMany`-guard shape the deleted `recordRepairSale` used on `saleId`.)
10. **After commit:** `this.inventory.flushEvents(capturedTx!)`, then emit
    `invoice.issued` (`{ invoiceNumber, sourceType: InvoiceSource.REPAIR, sourceReference: existing.reference }`),
    `repair.statusChanged`, `repair.pickedUp` (payload built from the **in-transaction** figures —
    **F4**), and `payment.clientRecorded` when step 8 ran.

**Rewrite the `:284-307` comment block** (F4) to describe the new order of events.

**3.4h — `recordPayment` (D5).**

```ts
  // D5 — a payment taken at any pre-pickup step. For a known POS client this is an on-account
  // ClientPayment row (null invoiceId — no invoice exists yet — with repairId set so it can be
  // re-linked at pickup, R3); credit falls by the amount, so a prepaying client's credit goes
  // negative and is brought back to zero by the applyDocumentCharge at PICKED_UP. For a walk-in
  // there is no PosClient and therefore no ledger row: only the repair's own paidAmount moves.
  async recordPayment(id, cmd, actor) {
    const existing = await this.prisma.repair.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Repair');
    this.assertEditable(existing.status);

    const staffId = await this.movementStaffId(actor);
    await this.prisma.$transaction(async (tx) => {
      if (existing.posClientId != null) {
        await this.billing.captureClientPaymentInTx(tx, {
          posClientId: existing.posClientId,
          repairId: id,
          amount: cmd.amount,
          staffId,
        });
      }
      await tx.repair.update({ where: { id }, data: { paidAmount: { increment: cmd.amount } } });
    });

    return this.getRepairDto(id, { includeMargins: actor.type === UserType.ADMIN });
  }
```

**3.4i — `listTechnicianStats` (R1).**

```ts
  // R1 — one row per technician. Counts come from a groupBy(technicianId, status); revenue is
  // Σ totalAmount over PICKED_UP repairs only, the single status at which repair revenue is
  // recognised (D8). Technicians with no repairs still appear, with zeros.
  async listTechnicianStats(): Promise<TechnicianRepairStatsDto[]> {
    const [technicians, groups, revenueGroups] = await Promise.all([
      this.prisma.technician.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.repair.groupBy({ by: ['technicianId', 'status'], _count: { _all: true } }),
      this.prisma.repair.groupBy({ by: ['technicianId'], where: { status: PrismaRepairStatus.PICKED_UP }, _sum: { totalAmount: true } }),
    ]);
    …assemble, map through RepairsMapper.toTechnicianStatsDto…
  }
```

**3.4j — `REPAIR_INCLUDE`** gains the two new reads:

```ts
  payments: { orderBy: { paidAt: 'asc' as const } },
  invoice: { select: { number: true } },
```

### Action 3.5 — `src/modules/repairs/repairs.mapper.ts`

- `toRepairDto` maps `invoiceNumber` (from `repair.invoice?.number`) and `payments[]`
  (`id`, `reference`, `amount` as number, `paidAt` ISO, `invoiceId` when non-null).
- New `static toTechnicianStatsDto(...)` parsing through `TechnicianRepairStatsResponseSchema`,
  matching the file's existing parse-on-the-way-out convention.
- Update the file-header comment if it enumerates the DTO's fields.

### Action 3.6 — `src/modules/repairs/repairs.controller.ts`

Add `recordPayment` and `listTechnicianStats` handlers, following the existing shape exactly
(`req.validated.params as RepairIdParams`, `req.validated.body as RecordRepairPaymentCommand`,
`sendSuccess(res, result, 201)` for the payment, `200` for the stats list).

---

## §4 — Frontend (`Apps/web`)

### Action 4.1 — `src/services/repairs.service.ts`

- `listRepairs` returns `PaginatedResult<RepairDto>`; delete the "bare array — RepairListQuery
  carries no page/limit" comment (now false).
- New `recordRepairPayment(scope, id, command)` → `POST` `STAFF_PAYMENTS`/`ADMIN_PAYMENTS`.
- New `listTechnicianStats()` → `GET` `ADMIN_TECHNICIAN_STATS` (admin-only, no scope parameter).

### Action 4.2 — `src/lib/query-keys.ts`

Extend the `repairs` block:

```ts
  repairs: {
    all: () => ["repairs"] as const,
    list: (scope: string, query?: unknown) => ["repairs", "list", scope, query] as const,
    detail: (scope: string, id: string) => ["repairs", "detail", scope, id] as const,
    // S13/R1 — admin-only technician stats; no scope member (there is no staff route).
    technicianStats: () => ["repairs", "technician-stats"] as const,
  },
```

### Action 4.3 — `src/hooks/useRepairs.ts`

- `useRepairs` now returns the paginated envelope (no signature change needed — the query fn's
  return type carries it).
- New `useRecordRepairPayment()` — invalidates `qk.repairs.all()` **and** `qk.billing.all()` **and**
  `qk.clients.all()` (a ledger row moves `PosClient.credit`/`totalPaid`; check the exact key name in
  `query-keys.ts` before writing it).
- New `useTechnicianRepairStats()` on `qk.repairs.technicianStats()`.
- `useUpdateRepairStatus` — extend its invalidation set to `qk.clients.all()` too (pickup now
  charges credit), and **rewrite its stale comment** (F7): no repair-origin sale exists any more;
  pickup issues an invoice and captures a ledger payment.

### Action 4.4 — `src/pages/staff/repairs/repair-status.schema.ts`

Replace the three refines:

```ts
export function repairStatusSchema(t, opts: { amountDue: number }) {
  return z
    .object({
      toStatus: z.enum(RepairStatus),
      note: z.string().optional(),
      paymentAmount: z.number().min(0, t("staff.repairs.statusDialog.paymentAmountInvalid")).optional(),
      refundAmount: z.number().min(0, t("staff.repairs.statusDialog.refundAmountInvalid")).optional(),
      technicianId: z.uuid().optional(),
    })
    .refine((d) => d.toStatus !== RepairStatus.PROCESSING || !!d.technicianId, {
      message: t("staff.repairs.statusDialog.technicianRequired"),
      path: ["technicianId"],
    })
    // D8 — pickup must settle the ticket: the amount entered here plus what was already paid must
    // reach the total. `amountDue` is totalAmount − paidAmount, computed by the caller.
    .refine((d) => d.toStatus !== RepairStatus.PICKED_UP || opts.amountDue <= 0 || (d.paymentAmount ?? 0) > 0, {
      message: t("staff.repairs.statusDialog.paymentAmountRequired"),
      path: ["paymentAmount"],
    });
}
```

`consumedPartIds` and its refine are deleted (F2). The compile-time contract guard at the bottom
keeps omitting `technicianId` and now reads
`Omit<RepairStatusFormValues, "technicianId"> extends RepairStatusCommand`.

**Beware the S3 gotcha** recorded in the programme memory: `register(field, { valueAsNumber: true })`
on an empty optional number input yields `NaN`, which `z.number().optional()` rejects with an
opaque message. Both money inputs here are optional numbers — use the same
`z.preprocess((v) => (Number.isNaN(v) ? undefined : v), …)` treatment the S3 plan established, or
register with `setValueAs`.

### Action 4.5 — `src/pages/staff/repairs/components/RepairStatusDialog.tsx`

1. Delete the local `NEXT_STATUS` map; use `repairTransitionsFrom(repair.status)` from the contract.
2. Delete the whole `consumedPartIds` prop and its `<Switch>` block (`:147-171`).
3. **PICKED_UP branch** — replace the bare paid-amount input with the settlement form:
   - show `totalAmount`, `paidAmount` so far, and **amount due** (`totalAmount − paidAmount`);
   - the `paymentAmount` input **defaults to the amount due**;
   - when the amount due is already ≤ 0, render a "nothing left to pay" line and no input;
   - the footer gains an explicit **Cancel** button (`onOpenChange(false)`) beside Save, so
     "Cancel leaves the status at completed" is a real affordance and not just the ✕.
4. **CANCELLED branch** — when `repair.paidAmount > 0`, render a `refundAmount` input **defaulting
   to `repair.paidAmount`**, with helper text naming what will be returned. Hidden when nothing was
   paid.
5. Add a `presetStatus?: RepairStatus` prop that locks the select when the dialog is launched for a
   specific transition — same shape `OrderStatusDialog` gained in S11; reuse that component's
   pattern rather than inventing a second one.

### Action 4.6 — `src/pages/staff/repairs/components/RepairTicketDetail.tsx`

1. **Spare-part picker (F1)** — replace the raw `<Input>` + result-button list (`:130-150`) with:

   ```tsx
   <AutocompleteInput
     value={watch("productId") ?? ""}
     onChange={(value) => {
       const product = productSearchResults?.find((p) => p.id === value);
       setValue("productId", value, { shouldValidate: true });
       if (product) setValue("unitPrice", product.defaultSalePrice ?? 0);
     }}
     suggestions={(productSearchResults ?? []).map((p) => ({ value: p.id, label: p.name }))}
     onSearch={onProductSearch}
     label={t("staff.repairs.addPart.productLabel")}
     placeholder={t("staff.repairs.addPart.productPlaceholder")}
     emptyMessage={t("staff.repairs.addPart.noResults")}
     error={errors.productId?.message}
   />
   ```

   No `onCreateNew` — a repair part must be an existing catalog product. The component hides the
   create-new row on its own when no handler is passed (`autocomplete-input.tsx:107-114`).
   `watch` must be pulled out of the existing `useForm` destructure.
2. **Render `errors.productId`** — via the `error` prop above; that is the silent half of F1.
3. **Read-only mode** — when `isRepairStatusTerminal(repair.status)`: hide the add-part form, hide
   the per-part delete buttons, disable the labour-price input and the diagnosis textarea, and show
   a `t("staff.repairs.detail.readOnly")` note. The existing status-gate at `:221` already hides the
   "Update status" button for those two statuses — keep it, and switch it to
   `!isRepairStatusTerminal(repair.status)`.
4. **Payments section** — a new block between the totals and the timeline:
   - the cumulative paid line already at `:201-204` stays;
   - beneath it, `repair.payments.map(...)` → reference · date · `formatDZD(amount)` (negative
     amounts render as refunds — style them with the destructive token);
   - a **Record payment** button, hidden in read-only mode, opening a small dialog with one
     amount field defaulting to `totalAmount − paidAmount`;
   - when `repair.payments` is empty *and* `repair.posClientId` is absent, show
     `t("staff.repairs.payments.walkIn")` instead of an empty list.
5. **Invoice link** — when `repair.invoiceNumber` is set, render it beside the totals linking to
   `/admin/invoices/${repair.invoiceNumber}` for `scope === "admin"` (check the real route in
   `App.tsx` before writing the path) and as plain text for staff.

### Action 4.7 — `src/pages/staff/repairs/components/IntakeDialog.tsx` (F5)

Replace the brand and model `<Select>`s with `AutocompleteInput` + create-if-absent, exactly as
`AdminProductsAdd.tsx:203-289` does it:

- the dialog now calls `useCatalogBrands()`, `useCatalogModels({ brandId }, false, { enabled: !!brandId })`,
  `useCreateCatalogBrand()` and `useCreateCatalogModel()` **itself** — the `brands`/`models` props
  are removed from `IntakeDialogProps` and from `StaffRepairs.tsx`;
- model selection is disabled until a brand is chosen, and `onCreateNew` on the model field passes
  `{ brandId, name }`;
- **delete the "Dumb (owns only local form state)" claim** in this file's header comment and the
  cascading-gap comment at `StaffRepairs.tsx:57-59` — both become false.

### Action 4.8 — `src/pages/staff/repairs/components/RepairBoard.tsx` (R2)

The filter row above the lanes gains:

- **date-range inputs** — two `<Input type="date">` bound to `from`/`to`, labelled
  `t("staff.repairs.board.dateFrom")` / `t("staff.repairs.board.dateTo")`;
- **`<SimplePagination page={} totalPages={} onPageChange={} />`** (`components/shared/SimplePagination.tsx`),
  fed from the paginated envelope's `meta`.

Both are new props (`from`, `to`, `onDateRangeChange`, `page`, `totalPages`, `onPageChange`) —
the board stays dumb, `StaffRepairs.tsx` owns the state.

Add a comment noting R2: the board shows one page of ≤10 tickets spread across five lanes, so a
lane can legitimately be empty on a page whose tickets all share one status.

### Action 4.9 — `src/pages/staff/repairs/StaffRepairs.tsx`

- Hold `from`/`to`/`page` state; reset `page` to 1 whenever any filter changes.
- Pass `repairs={repairsPage?.items}` and the pagination props down.
- Drop the `brands`/`models` fetches (moved into `IntakeDialog`, Action 4.7) and their comment.
- `handleStatusSubmit` passes `paymentAmount`/`refundAmount` through unchanged; the
  `technicianId` side-call before `PROCESSING` stays as documented at `:120-121`.
- **Drag-and-drop:** `handleDropOnLane` still fires the bare `{ toStatus }` command. It now bounces
  for `PROCESSING` (needs a technician), `PICKED_UP` (needs a payment) and `CANCELLED`-with-money
  (needs a refund decision). **Update the long header comment at `:33-43`** — the list of bouncing
  transitions has changed, and `consumedPartReturns` is no longer one of the reasons.
- Add the **Tabs** wrapper (Action 4.10) around the board.

### Action 4.10 — Technicians tab (R1)

New `src/pages/admin/repairs/components/TechniciansTab.tsx`:

- `useTechnicianRepairStats()` for the rows, `DataTable` for the layout (mirror
  `ReturnsTable.tsx` from S12 for column definitions and the loading/error/empty triad);
- columns: name · total · intake · processing · completed · picked up · cancelled · revenue
  (`formatDZD`), plus a disabled badge when `isEnabled` is false;
- an **Add technician** button opening a dialog with `name` (required) and `phone` (optional),
  submitting through the existing `useCreateTechnician()` (`hooks/useIdentity.ts:115`) — no new
  backend work; on success toast `t("admin.repairs.technicians.success")` and invalidate both
  `qk.identity.technicians.all()` and `qk.repairs.technicianStats()`.

In `StaffRepairs.tsx`, wrap the board in a `<Tabs>` **only for `scope === "admin"`** — the same
admin-only tab-bar shape S12 added to `StaffSales.tsx:225-236`. Staff keeps the bare board (the
stats endpoint is `adminOnly`; S18 owns staff parity).

### Action 4.11 — `src/pages/staff/repairs/repair-status-labels.ts`

No change needed — but check whether S11's `lib/order-status-labels.ts` move set a precedent worth
following here. It did **not** create a shared repair equivalent; leave this file where it is and
note that in the report.

### Action 4.12 — translations (`src/config/translations.json`)

Flat dotted keys → `{ en, fr, ar }`, with `ar` always `""` (the established convention — and note
the brief's `translation.json` is the wrong filename). Add:

| Key | en |
|---|---|
| `staff.repairs.board.dateFrom` | From |
| `staff.repairs.board.dateTo` | To |
| `staff.repairs.detail.readOnly` | This repair is closed — no further edits |
| `staff.repairs.detail.invoiceNumber` | Invoice |
| `staff.repairs.detail.amountDue` | Amount due |
| `staff.repairs.addPart.productPlaceholder` | Search a product |
| `staff.repairs.addPart.productRequired` | Select a product |
| `staff.repairs.addPart.noResults` | No matching product |
| `staff.repairs.intake.brandPlaceholder` | Search or add a brand |
| `staff.repairs.intake.modelPlaceholder` | Search or add a model |
| `staff.repairs.intake.modelBrandFirst` | Choose a brand first |
| `staff.repairs.payments.title` | Payments |
| `staff.repairs.payments.empty` | No payments recorded |
| `staff.repairs.payments.walkIn` | Walk-in customer — no client ledger |
| `staff.repairs.payments.record` | Record payment |
| `staff.repairs.payments.amountLabel` | Amount |
| `staff.repairs.payments.amountInvalid` | Amount must be above zero |
| `staff.repairs.payments.submit` | Record payment |
| `staff.repairs.payments.success` | Payment recorded |
| `staff.repairs.payments.refundRow` | Refund |
| `staff.repairs.statusDialog.paymentAmountLabel` | Amount collected now |
| `staff.repairs.statusDialog.paymentAmountInvalid` | Amount must be zero or more |
| `staff.repairs.statusDialog.paymentAmountRequired` | Collect the remaining amount to complete the pickup |
| `staff.repairs.statusDialog.nothingDue` | Fully paid — nothing left to collect |
| `staff.repairs.statusDialog.refundAmountLabel` | Amount to return |
| `staff.repairs.statusDialog.refundAmountInvalid` | Amount must be zero or more |
| `staff.repairs.statusDialog.refundHelp` | This repair collected {amount}. Returning it records a refund. |
| `staff.repairs.statusDialog.cancel` | Cancel |
| `staff.repairs.errors.readOnly` | This repair is closed and can no longer be changed |
| `admin.repairs.tabs.board` | Board |
| `admin.repairs.tabs.technicians` | Technicians |
| `admin.repairs.technicians.title` | Technicians |
| `admin.repairs.technicians.add` | Add technician |
| `admin.repairs.technicians.nameLabel` | Name |
| `admin.repairs.technicians.nameRequired` | Name is required |
| `admin.repairs.technicians.phoneLabel` | Phone (optional) |
| `admin.repairs.technicians.submit` | Add technician |
| `admin.repairs.technicians.success` | Technician added |
| `admin.repairs.technicians.empty` | No technicians yet |
| `admin.repairs.technicians.error` | Couldn't load technicians — retry |
| `admin.repairs.technicians.disabled` | Disabled |
| `admin.repairs.technicians.columns.total` | Repairs |
| `admin.repairs.technicians.columns.revenue` | Revenue |

Status-count column headers reuse the existing `staff.repairs.board.*` keys — do not duplicate them.

**Delete** the two keys F2 orphans: `staff.repairs.statusDialog.consumedPartReturnsLabel` and
`staff.repairs.statusDialog.consumedPartReturnsRequired`. Grep first to be sure nothing else reads them.

---

## §5 — The money arithmetic, worked

Trace this by hand against your implementation before declaring the set done. Client starts at
`credit = 0`, `totalPaid = 0`, `totalSold = 0`. Repair total **5 000** (parts 3 000, labour 2 000),
parts FIFO cost **1 800**.

| Step | Ledger row | `credit` | `totalPaid` | `totalSold` | `Repair.paidAmount` | `Invoice.paidAmount` |
|---|---|---|---|---|---|---|
| Intake, collect 500 | +500, `invoiceId` null, `repairId` set | −500 | 500 | 0 | 500 | — |
| Processing, collect 500 | +500, on account | −1 000 | 1 000 | 0 | 1 000 | — |
| `PICKED_UP`, collect 4 000 — step 5 `applyDocumentCharge(+5000, +5000)` | — | **4 000** | 1 000 | **5 000** | 1 000 | — |
| — step 6 issue invoice (`paidAmount: 0`) | — | 4 000 | 1 000 | 5 000 | 1 000 | 0 |
| — step 7 re-link the two on-account rows | — | 4 000 | 1 000 | 5 000 | 1 000 | **1 000** (PARTIALLY_PAID) |
| — step 8 capture 4 000 | +4 000, invoice-linked | **0** | **5 000** | 5 000 | **5 000** | **5 000** (PAID) |

`totalPaid = Σ ClientPayment.amount` ✅ · `credit` returns to 0 for a fully-settled repair ✅ ·
`Invoice.paidAmount = Σ ClientPayment.amount` for that invoice ✅ · `totalSold` moves **once**,
at pickup ✅. Repair figures: `totalAmount` 5 000, `totalCost` 1 800, `totalProfit` **3 200**
(R4: 5 000 − 1 800, i.e. parts margin 1 200 + labour 2 000).

**Cancellation after 1 000 collected:** refund row −1 000 → `credit` 0 → −(−1 000) = back to 0,
`totalPaid` back to 0, `Repair.paidAmount` 0, every reservation released, no invoice, no `totalSold`
movement (nothing was ever charged). ✅

---

## §6 — Validation gate (D12)

No test file may be read, edited or run. Run, from the repo root:

```bash
cd Apps/contract && npx tsc --noEmit && npm run lint
cd ../api      && npx tsc --noEmit && npm run lint
cd ../web      && npx tsc --noEmit && npm run lint
```

For `Apps/api`, its tsconfig includes `test/**` — filter the `tsc` output to non-test paths and
itemise the remaining test-file staleness in the report per file (the S5 precedent). Expect new
staleness in any repairs spec: `consumedPartReturns`, `paidAmount` on the status command,
`STATUS_SEQUENCE`, and `listRepairs`' return type all changed.

`npm run lint` in this repo **crashes rather than warns** on real findings — treat a crash as a
finding, not as tooling breakage.

---

## §7 — Manual verification checklist (browser)

**Setup:** an approved client with a linked POS client and a known starting credit; one walk-in.

### Board, filters, pagination
1. `/admin/repairs` — the board shows at most **10** tickets; a pager sits in the filter row.
2. Page 2 loads a different set; lanes may be empty on some pages (expected, R2).
3. Set a From/To range around one ticket's intake date — only that ticket survives.
4. The technician filter still narrows, and resets the pager to page 1.

### Intake
5. Brand field: type a brand that does not exist → **"create new"** appears → pick it → the field
   shows the **name**, not an id.
6. Model is disabled until a brand is chosen; after choosing, only that brand's models are offered,
   and create-new attaches to that brand.

### The spare-part bug (F1)
7. Open a ticket → parts editor → type in the product field → pick a result. The field now shows
   the **product name**; the price fills in.
8. Press **Add part** with nothing selected → a visible "Select a product" error (previously a
   silent no-op).
9. Add a part → inventory `/admin/inventory` shows the quantity moved to **reserved**, not out.

### Payments before pickup (D5)
10. Ticket at INTAKE → **Record payment** 500 → the payments list shows one row; cumulative paid = 500.
11. `/admin/clients/:id` → that client's **credit is −500** and **total paid 500**. (Negative credit
    = the store owes them; correct until pickup.)
12. Move to PROCESSING (assign a technician) → record another 500 → paid 1 000, credit −1 000.

### Completion consumes nothing (D8)
13. Move to COMPLETED. `/admin/inventory` — the part is **still reserved**, `quantityOnHand`
    unchanged, no `REPAIR_CONSUMPTION` movement in the ledger.

### Pickup — the money moment (D8/D9)
14. Update status → PICKED_UP. The dialog shows total, paid so far and **amount due**, prefilled.
15. Press **Cancel** → the repair is still **COMPLETED**.
16. Reopen, press **Save** → transition succeeds.
17. Inventory: the reservation is gone, `quantityOnHand` dropped, one `REPAIR_CONSUMPTION` movement
    whose **reference reads `REP-…`** (RC-4, S1).
18. `/admin/invoices` — a new invoice, source **Repair**, status **PAID**, `paidAmount` = the full
    total (not just the pickup instalment — this is R3 working).
19. That invoice's lines list every part **plus a Labour line**.
20. The client's own portal → **My invoices** shows the repair invoice.
21. `/admin/clients/:id` — **credit back to 0**, total paid = the repair total, **total sold**
    increased by the repair total.
22. `/admin/payments` (client-payments ledger) — three rows for this repair, all now carrying the
    invoice number.

### Read-only after pickup
23. Reopen the picked-up ticket: no add-part form, no delete buttons, labour and diagnosis disabled,
    no "Update status" button, and a "closed" note.

### Cancellation with a refund (D6)
24. New repair, collect 700, move to PROCESSING, then cancel → the dialog offers a refund
    **prefilled at 700**.
25. Confirm → reservations released (inventory back to full availability), the client's credit and
    total paid both back to their pre-repair values, and a **negative-amount** row in the payments
    ledger.
26. Try to cancel a **picked-up** repair → the action is not offered anywhere.

### Walk-in
27. Repair with no POS client: pickup refuses unless the amount due is collected in full
    (`CREDIT_REQUIRES_CLIENT`); once paid, the invoice is issued under the customer's real name and
    the payments section reads "Walk-in customer — no client ledger".

### Technicians tab
28. `/admin/repairs` → **Technicians** tab lists every technician with counts per status and revenue.
29. Add a technician → it appears in the table and in the intake dialog's technician select.
30. Revenue for a technician equals the sum of their **picked-up** repair totals only.

### Regression sweep
31. `/staff/repairs` still works for a staff user (board, intake, parts, payments) — no Technicians tab.
32. POS, orders and sales are untouched: complete one POS sale and one order and confirm their
    credit/totalPaid/totalSold arithmetic is unchanged.
