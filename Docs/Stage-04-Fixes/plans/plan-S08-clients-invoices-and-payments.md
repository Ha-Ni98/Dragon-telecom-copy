# Plan S8 — Clients, Invoices & Payments

*Contract + backend (clients, billing, purchasing, orders) + frontend. Consumes S1, S2, S5 and one
field from S7.*

Scope, from `app-issues-01.md` §S8 — nine items, numbered here as **J1–J9** and referenced by those
tags throughout.

| # | Item |
|---|---|
| **Clients** |
| J1 | Show the **created date** (S1's DTO fix) |
| J2 | Add a **record-payment action** for a client (amount above zero), mirroring the outgoing-invoice payment flow and showing the client's **previous and new credit** |
| **Client information** |
| J3 | The approve dialog's category dropdown shows the **name** after selection (RC-1) |
| J4 | Every tab is empty except browsing history — populate **Overview** (total sold, total paid, total credit, order count, total quantity of products), **Orders**, **Invoices** and **Payments** |
| **Invoices** |
| J5 | Incoming: opening an invoice shows the **supplier's** previous credit, not the invoice's, and updates the invoice information accordingly |
| J6 | Outgoing: **hide** the cancel-invoice and record-payment buttons on a **sale** invoice, keeping the underlying logic |
| J7 | Add a **source filter** on the outgoing tab |
| J8 | Add **start/end date filters on every tab** |
| **(cross-cutting, from J2/J5)** |
| J9 | The record-payment dialogs must preview from the counterparty's **current** credit everywhere, not from a document's frozen snapshot |

---

## 0. Before you start

### 0.1 Sets that must land first

**S1**, **S2**, **S5** and **S7** — all executed, reported and owner-approved.

| From | What S8 uses |
|---|---|
| S1 | `AdminClientDto.createdAt` — the field J1 renders. It already exists and is already populated; the table simply never read it (**F1**). |
| S2 | The rebuilt `AutocompleteInput`. **J3 is verify-only** — `approval-dialog.tsx` was in S2's "six already-correct sites" list and needs no change (**F2**). |
| S5 | `captureClientPaymentInTx` already accepts a **null `invoiceId`**, which is what makes J2's on-account client payment possible with no new backend primitive (**F5**). |
| S5 | `applyLedgerPayment` writes `totalPaid += amount` and `credit −= amount` on a locked row, inside the caller's transaction. J2 adds **no** new money path — it reuses `POST /admin/client-payments` unchanged. |
| **S7** | **`SupplierInvoiceDto.supplierCredit`** — added to the contract by S7 Action 1 and populated by S7 Action 3. **J5 consumes it. Do not re-add the contract field**; if it is missing, S7 did not land and this set must stop. |

**S8 blocks S18** (staff parity). Nothing else in the programme waits on it.

### 0.2 Owner decisions taken this session — settled, do not re-open

| # | Question | Owner's answer |
|---|---|---|
| **R1** | J4's Overview needs a **total quantity of products**. Summed over what? | **Invoice lines.** `SUM(InvoiceLine.quantity)` over every non-`CANCELLED` `Invoice` for the client's linked `PosClient`. Source-agnostic (SALE + ORDER + REPAIR) and stable across S9's order-lines rework, S10's move of order revenue to `COMPLETED` and S13's repair invoices. |
| **R2** | J2's action on a client with **no linked PosClient** (PENDING/REJECTED — approval is what materialises the `PosClient`). | **Rendered but disabled, with a tooltip** explaining the client must be approved first. The row layout stays uniform and the reason is visible. |

### 0.3 Findings from reading the code — read before acting

**F1 — J1 is a one-line bug, not a missing field.** `admin-clients-table.tsx:138–147` declares
`accessorKey: "lastOrderDate"` under the header key `admin.clients.table.**createdDate**`, and its
cell renders `row.original.lastOrderDate ?? "-"`. The column is not empty because the DTO lacks the
data — it is showing the **wrong field**, and it is empty because most clients have never ordered.
`AdminClientDto.createdAt` is required and populated (S1). It also renders the raw ISO string, with
no `formatDateTime`.

**F2 — J3 is already done.** S2's report lists `approval-dialog.tsx` among the six sites whose
option arrays were already built as `{ value: <entity>.id, label: <entity>.name }` and which
therefore needed no change under the new `AutocompleteInput` contract. `AdminClientDetail.tsx:48–51`
builds `categoryOptions` exactly that way. **Verify in the browser (checklist item 5); change
nothing.** If it *does* still show an id, that is a defect in S2's component, not in this dialog —
report it rather than patching around it here.

**F3 — `AdminClientDto` carries no money at all.** It has `totalOrders` and `totalSpent` (an
`Order.totalAmount` + `Sale.totalAmount` sum computed in `loadAdminClientRollups`,
`clients.service.ts:545`), but no `credit`, `totalPaid` or `totalSold` — those live on the linked
`PosClient`, which `ADMIN_CLIENT_INCLUDE` selects only `{ id, category: { name } }` from. J4's
Overview and J2's credit preview both need them.

**Do not widen `AdminClientResponseSchema`.** `loadAdminClientRollups` already fires two aggregates
**per row** on the list endpoint; R1's invoice-line sum would make it three, on every page load, for
a figure only the detail page shows. Action 1 adds a dedicated
`GET /admin/clients/:id/overview` instead — one client, one payload, fetched only where it is used.

**F4 — the client-detail tabs need three list reads, two of which already exist.**

| Tab | Query the backend already accepts | Gap |
|---|---|---|
| Invoices | `InvoiceListQuerySchema.posClientId` (`billing.query.ts:7`), honoured at `billing.service.ts:378` | none |
| Payments | `ClientPaymentListQuerySchema.posClientId` (`billing.query.ts:18`) | none |
| Orders | `BackofficeOrdersQuerySchema` has `status`/`search`/`from`/`to`/`page`/`limit` — **no `clientId`** | Action 5 + Action 9 |

Orders link to the registered client by `Order.clientId`; invoices and payments link by
`PosClient.id`. Both keys hang off `AdminClientDto` (`id` and `posClientId`) — no extra lookup.

**F5 — J2 needs no new backend endpoint.** `POST /admin/client-payments` already accepts
`{ posClientId, invoiceNumber?, amount, paidAt? }` with `invoiceNumber` optional, and S5's
`captureClientPaymentInTx` already handles a null `invoiceId` (the "on account" case D5 names for
repairs). `recordClientPaymentSchema` (`pages/staff/invoices/record-client-payment.schema.ts`) and
`RecordPaymentDialog` are both already shaped for it — `invoiceNumber` is `.optional()` and the
dialog only renders its hidden input `{invoiceNumber && …}`. **Reuse both components as-is.**

**F6 — J5 is the second call site of the bug S7 fixed once.** `StaffInvoices.tsx:240` passes
`previousCredit={supplierPaymentTarget?.newCredit ?? 0}` — the supplier's credit **frozen at that
invoice's confirm**, not now. S7 added `SupplierInvoiceDto.supplierCredit` and repaired the editor's
call site; this set repairs this one (Action 15a). The brief's "and updates the invoice information
accordingly" is satisfied by the existing invalidation: `useCreatePurchasingPayment` already sweeps
`qk.purchasing.invoices.all()` and `qk.purchasing.suppliers.all()` — **verify** it, do not re-add it.

**F7 — the outgoing dialog has the identical bug, and the brief does not name it.**
`StaffInvoices.tsx:212` passes `previousCredit={selectedInvoice.newCredit ?? 0}` to
`RecordPaymentDialog` — `Invoice.newCredit` is likewise a snapshot at issuance. This is a literal
copy of F6 in the same file, twelve lines apart. Per S2's precedent ("fix rather than defer when
it's a literal copy"), Action 2 adds `InvoiceDto.posClientCredit` and Action 15b consumes it — that
is **J9**. It also means J2's clients-list dialog and the invoice dialog preview from the same
figure, which is the only way the two can agree.

**F8 — J6's guard is `sourceType`, and the record-payment button already has a second condition.**
`InvoiceSnapshotView.tsx:99–111` renders record-payment when
`invoice.posClientId && status ∉ {CANCELLED, PAID} && onRecordPayment`, and cancel when
`scope === "admin" && status !== CANCELLED && onCancel`. J6 adds
`invoice.sourceType !== InvoiceSource.SALE` to **both**. "Keeping the underlying logic" means
`useCancelInvoice`, `useCreateClientPayment`, `BillingService.cancelInvoice` and
`captureClientPaymentInTx` are all untouched — this is a render condition only.

**F9 — J7 and J8 are almost entirely UI.** `InvoiceListQuerySchema` already carries `source`, `from`
and `to`, all honoured in `listInvoicesFor` (`billing.service.ts:377–392`), and
`SupplierInvoiceListQuerySchema` already carries `from`/`to`, honoured at `purchasing.service.ts:205`.
The **payments** tab is the only gap: neither `ClientPaymentListQuerySchema` nor
`SupplierPaymentListQuerySchema` has a date range (Actions 3, 4, 7, 8).

**F10 — the outgoing tab's page state is shared and will fight the new filters.**
`StaffInvoices.tsx:49` holds a single `page` state used only by `outgoingQuery`; `incomingQuery` and
`paymentsQuery` are hardcoded `{ page: 1, limit: 20 }` `useMemo`s with empty dep arrays. When a
filter changes, the page must reset to 1 — otherwise a filter applied on page 3 shows an empty
table. Action 16 gives each tab its own filter state and resets its page on every filter change.

**F11 — `useOrdersList` has no `enabled` option**, unlike `useInvoices`/`useClientPayments`. The
client-detail page already lives with this for `useClientActivity` and documents it in its header
comment ("fires once the client id is known rather than strictly on Browsing-tab activation").
**Follow that precedent** — do not add an `enabled` option to `useOrdersList` just for this page;
`useOrdersDirectory.ts` is shared with `/admin/orders` and `/staff/orders`.

### 0.4 Standing rules for this set

- **No test file may be edited and no test suite may be run** (D12). Validation is `npx tsc --noEmit`
  and `npm run lint` on `Apps/contract`, `Apps/api` and `Apps/web`.
- Every user-facing string goes through `t()` with a key added to
  `Apps/web/src/config/translations.json` (flat keys, `{ "en": …, "fr": …, "ar": "" }`).
- **No new money arithmetic.** J2 posts to the existing `POST /admin/client-payments`; every write
  of `credit`/`totalPaid`/`totalSold` stays exactly where S5 put it — inside
  `captureClientPaymentInTx`, on a locked row, in one transaction. If you find yourself writing a
  `posClient.update` anywhere in this set, stop: you have taken a wrong turn.
- The Overview figures are **reads**. `totalSold`, `totalPaid` and `credit` are read straight off
  `PosClient` — they are not recomputed, re-derived or reconciled here.
- Read the comments in every file you touch and rewrite any your change falsifies. Three are named
  explicitly (Actions 6, 13, 14).

---

## 1. Contract

### Action 1 — The client overview DTO and route (J4, J2)

**a. `Apps/contract/src/modules/clients/clients.dtos.ts`** — add after `AdminClientResponseSchema`:

```ts
// The client-detail Overview tab, and the source of the "previous credit" preview on the
// clients-list record-payment action. Money is proxied from the linked PosClient (0 when the
// client has never been approved, so no PosClient exists yet — same convention as
// ClientMeResponseSchema). totalProductQuantity is Σ InvoiceLine.quantity over the client's
// non-cancelled invoices (S8 R1) — source-agnostic across SALE/ORDER/REPAIR, and stable across
// S9's order-lines rework.
export const AdminClientOverviewResponseSchema = z.object({
  clientId: z.uuid(),
  posClientId: z.uuid().optional(),
  totalSold: z.number(),
  totalPaid: z.number(),
  credit: z.number(),
  orderCount: z.number().int().min(0),
  totalProductQuantity: z.number().int().min(0),
});
export type AdminClientOverviewDto = z.infer<typeof AdminClientOverviewResponseSchema>;
```

**b. `Apps/contract/src/modules/clients/clients.routes.ts`** — add to `CLIENT_ROUTES`, placed
**after** `ADMIN_DETAIL` in the object but registered **before** it in the router (Action 6c):

```ts
  ADMIN_OVERVIEW: '/admin/clients/:id/overview',
```

**c.** Confirm both are re-exported by `Apps/contract/src/modules/clients/index.ts` — read it; if it
uses explicit named exports rather than `export *`, add them.

### Action 2 — `InvoiceDto.posClientCredit` (J9, F7)

**File:** `Apps/contract/src/modules/billing/billing.dtos.ts`

In `InvoiceResponseSchema`, immediately after `newCredit`:

```ts
  // The linked POS client's credit *right now* — distinct from previousCredit/newCredit, which
  // bracket this invoice's own issuance. The record-payment dialog previews
  // `posClientCredit - amount`; using newCredit there previewed from a stale figure (S8 F7).
  // Absent on a walk-in invoice (no posClientId) and stripped for the client audience.
  posClientCredit: z.number().optional(),
```

Update the schema's leading comment, which enumerates the mapping-gated admin-only fields — this is
a new member of that set.

### Action 3 — Date range on the client-payments query (J8)

**File:** `Apps/contract/src/modules/billing/billing.query.ts`

```ts
export const ClientPaymentListQuerySchema = z.object({
  posClientId: z.uuid().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

Filtered on `paidAt`, the column the list already sorts by — mirror the comment style
`BackofficeOrdersQuerySchema` uses for its own `from`/`to`.

### Action 4 — Date range on the supplier-payments query (J8)

**File:** `Apps/contract/src/modules/purchasing/purchasing.query.ts`

Add the same two optional fields to `SupplierPaymentListQuerySchema`, filtered on `paidAt`.

### Action 5 — `clientId` on the back-office orders query (J4)

**File:** `Apps/contract/src/modules/orders/orders.query.ts`

Add to `BackofficeOrdersQuerySchema`, before `page`:

```ts
  // S8 J4 — the admin client-detail Orders tab scopes the same list to one registered client.
  // Order.clientId is the registered Client, not the PosClient the invoice/payment lists key on.
  clientId: z.uuid().optional(),
```

---

## 2. Backend

### Action 6 — `getClientOverview` (J4, J2)

**a. `Apps/api/src/modules/clients/clients.interface.ts`** — add to `IClientsService`, beside
`getClient`:

```ts
  getClientOverview(id: string): Promise<AdminClientOverviewDto>;
```

and import the type.

**b. `Apps/api/src/modules/clients/clients.service.ts`** — implement, after `getClient` (line 242):

```ts
  // The Overview tab's five figures. Money is read straight off the linked PosClient — never
  // recomputed here (D5: the ledger is the source of truth for totalPaid, and clients' own
  // applyDocumentCharge/applyLedgerPayment are its only writers). totalProductQuantity is
  // Σ InvoiceLine.quantity over non-cancelled invoices (S8 R1), which counts POS sales, orders
  // and repairs alike and survives S9/S10/S13 unchanged.
  async getClientOverview(id: string): Promise<AdminClientOverviewDto> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        posClientId: true,
        posClient: { select: { credit: true, totalPaid: true, totalSold: true } },
      },
    });
    if (!client) throw new NotFoundError('Client');

    const [orderCount, lineAgg] = await Promise.all([
      this.prisma.order.count({ where: { clientId: id } }),
      client.posClientId != null
        ? this.prisma.invoiceLine.aggregate({
            where: { invoice: { posClientId: client.posClientId, status: { not: PrismaInvoiceStatus.CANCELLED } } },
            _sum: { quantity: true },
          })
        : Promise.resolve(null),
    ]);

    return ClientsMapper.toAdminClientOverviewDto({
      clientId: client.id,
      posClientId: client.posClientId,
      credit: client.posClient?.credit ?? 0,
      totalPaid: client.posClient?.totalPaid ?? 0,
      totalSold: client.posClient?.totalSold ?? 0,
      orderCount,
      totalProductQuantity: lineAgg?._sum.quantity ?? 0,
    });
  }
```

`PrismaInvoiceStatus` is `InvoiceStatus` from `@prisma/client` — check how this file already
aliases Prisma enums (it uses `PrismaClientStatus` for `ClientStatus`) and follow the same import
style. If `InvoiceStatus` is not yet imported here, add it.

**c. `Apps/api/src/modules/clients/clients.mapper.ts`** — add `toAdminClientOverviewDto`, taking a
row type whose money fields are `Prisma.Decimal | number` and running them through the existing
private `toMoney`, then `AdminClientOverviewResponseSchema.parse(dto)`. Follow `toClientMeDto`'s
shape exactly — it already proxies the same three PosClient figures with the same 0 fallback.

**d. `Apps/api/src/modules/clients/clients.controller.ts`** — add beside `getClient`:

```ts
  getClientOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as ClientIdParams;
      sendSuccess(res, await this.service.getClientOverview(id), 200);
    } catch (error) {
      next(error);
    }
  };
```

**e. `Apps/api/src/modules/clients/clients.routes.ts`** — register **before** `ADMIN_DETAIL`:

```ts
router.get(
  CLIENT_ROUTES.ADMIN_OVERVIEW,
  adminOnly,
  validateRequest({ params: ClientIdParamsSchema }),
  controller.getClientOverview,
);
```

Express matches in registration order; `/admin/clients/:id` would otherwise be tried first and, while
it would not actually capture `/admin/clients/x/overview` (different segment count), keeping the
more specific route first matches the file's own stated convention for `ADMIN_STATS` (line 109's
comment). Extend that comment to cover this route too.

### Action 7 — Emit `posClientCredit` + date filters in billing (J9, J8)

**File:** `Apps/api/src/modules/billing/billing.service.ts`

**a.** Widen `INVOICE_INCLUDE` (line 29):

```ts
const INVOICE_INCLUDE = {
  staff: { select: { firstName: true, lastName: true } },
  posClient: { select: { credit: true } },
  lines: true,
} satisfies Prisma.InvoiceInclude;
```

Grep `INVOICE_INCLUDE` in this file and confirm every invoice read uses it (`findInvoiceOrThrow`,
`listInvoicesFor`, and any issuance re-read). A read that does not will fail the mapper's type check
at compile time — which is the point.

**b.** In `listClientPayments`, add the range to the `where`, on `paidAt`:

```ts
      ...(query.from != null || query.to != null
        ? {
            paidAt: {
              ...(query.from != null ? { gte: new Date(query.from) } : {}),
              ...(query.to != null ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
```

Read the method first — confirm the local's exact name and that `posClientId` is already applied
there; add only the range.

**File:** `Apps/api/src/modules/billing/billing.mapper.ts`

**c.** Widen `InvoiceRow`:

```ts
export type InvoiceRow = Invoice & {
  staff: Pick<Staff, 'firstName' | 'lastName'>;
  posClient: Pick<PosClient, 'credit'> | null;
  lines: InvoiceLine[];
};
```

`PosClient` is already imported in this file (for `ClientPaymentRow`).

**d.** In `toInvoiceDto`, emit it under the **same admin/staff gate** the record-payment button
lives behind — the client audience must not gain a new field:

```ts
    const includeMargins = ctx.audience === 'admin';
    const includeCounterpartyCredit = ctx.audience !== 'client';
    …
      ...(includeCounterpartyCredit && invoice.posClient != null
        ? { posClientCredit: BillingMapper.toMoney(invoice.posClient.credit) }
        : {}),
```

Place it directly after the `newCredit` spread, matching the contract's field order.

### Action 8 — Date filter on supplier payments (J8)

**File:** `Apps/api/src/modules/purchasing/purchasing.service.ts`, `listPayments` (line 444)

Add the same `paidAt` range block to the `where` (line 445 currently builds it from `supplierId`
alone).

### Action 9 — `clientId` filter on the back-office orders list (J4)

**File:** `Apps/api/src/modules/orders/orders.service.ts`, `listBackoffice` (line 169)

Add to the `where`, before the `search` block:

```ts
      ...(query.clientId != null ? { clientId: query.clientId } : {}),
```

No other change — pagination, ordering and the admin/staff scoping below it are untouched.

---

## 3. Frontend — services, hooks, query keys

### Action 10 — Client overview: service, key, hook

**a. `Apps/web/src/lib/query-keys.ts`** — add to `qk.clients.admin`:

```ts
      overview: (id: string) => ["clients", "admin", "overview", id] as const,
```

**b. `Apps/web/src/services/clients.service.ts`** — add beside `getAdminClient`:

```ts
export async function getAdminClientOverview(id: string): Promise<AdminClientOverviewDto> {
  const res = await api.get<ApiResponse<AdminClientOverviewDto>>(
    withParams(apiPath(CLIENT_ROUTES.ADMIN_OVERVIEW), { id }),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
```

**c. `Apps/web/src/hooks/useClientDirectory.ts`** — add:

```ts
export function useClientOverview(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.clients.admin.overview(id),
    queryFn: () => clientsService.getAdminClientOverview(id),
    enabled: !!id && options?.enabled !== false,
  });
}
```

The `enabled` option matters: J2's dialog must not fetch until it opens.

**d. `Apps/web/src/hooks/useBilling.ts`** — `useCreateClientPayment`'s `onSuccess` already
invalidates `qk.billing.all()`, `qk.clients.all()` and `qk.posClients.all()`. `qk.clients.all()` is
the `["clients"]` prefix, so it sweeps the new overview key too. **Verify this and change nothing.**

---

## 4. Frontend — the clients list (J1, J2)

### Action 11 — Table: created date + record-payment action

**File:** `Apps/web/src/pages/admin/clients/components/admin-clients-table.tsx`

**a. J1** — replace the `lastOrderDate` column (lines 138–147):

```tsx
      {
        accessorKey: "createdAt",
        header: t("admin.clients.table.createdDate"),
        cell: ({ row }) => (
          <div className="flex items-start gap-1 text-muted-foreground">
            <Calendar className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="break-words text-xs">
              {formatDateTime(row.original.createdAt, language)}
            </span>
          </div>
        ),
      },
```

Import `formatDateTime` from `@/lib/utils` and destructure `language` from `useTranslation()` (only
`t` is taken today). Add `language` to the `columns` `useMemo` dep array.

**b. J2** — a new prop and a third action button:

```ts
  onRecordPayment: (client: AdminClientDto) => void;
```

In the actions cell, after the existing two buttons:

```tsx
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={!row.original.posClientId}
                    onClick={() => onRecordPayment(row.original)}
                    aria-label={t("admin.clients.recordPayment.action")}
                  >
                    <CreditCard className="h-4 w-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              {!row.original.posClientId && (
                <TooltipContent>{t("admin.clients.recordPayment.needsApproval")}</TooltipContent>
              )}
            </Tooltip>
```

R2: rendered always, disabled without a `posClientId`. The `<span>` wrapper is required — a disabled
button fires no pointer events, so Radix's `TooltipTrigger` never sees the hover without it. `Tooltip`,
`TooltipTrigger`, `TooltipContent` come from `@/components/ui/tooltip`; check whether a
`TooltipProvider` already wraps the admin tree in `AdminLayout.tsx` and, if not, wrap the actions
cell's tooltip in one locally. `CreditCard` is already imported in this file (it is used by the
`totalSpent` cell).

**c.** Add `onRecordPayment` to the `useMemo` dep array alongside `onEdit`.

**d.** The file's header comment ends with "The DTO carries no `credit` field … the credit column is
dropped rather than fabricated". That is still true of the **column**, but the page now reads credit
for the payment dialog through a separate endpoint. Append one sentence saying so, so the next
reader does not conclude client credit is unavailable.

### Action 12 — Page: wire the dialog

**File:** `Apps/web/src/pages/admin/clients/AdminClients.tsx`

Read the file first (not reproduced here) and add, following `StaffInvoices.tsx`'s wiring shape:

```tsx
  const [paymentTarget, setPaymentTarget] = useState<AdminClientDto | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const overview = useClientOverview(paymentTarget?.id ?? "", { enabled: !!paymentTarget });
  const createClientPayment = useCreateClientPayment();

  const handleRecordPaymentSubmit = (values: RecordClientPaymentFormValues) => {
    createClientPayment.mutate(
      { scope: "admin", command: values },
      {
        onSuccess: () => {
          toast.success(t("admin.clients.recordPayment.success"));
          setPaymentTarget(null);
          setPaymentAmount(0);
        },
      },
    );
  };
```

and, at the end of the returned tree:

```tsx
      {paymentTarget?.posClientId && (
        <RecordPaymentDialog
          // Fresh mount per client — RHF freezes defaultValues at first render, the same bug
          // StaffInvoices.tsx keys around for this exact dialog.
          key={paymentTarget.id}
          open={!!paymentTarget}
          onOpenChange={(open) => !open && setPaymentTarget(null)}
          posClientId={paymentTarget.posClientId}
          previousCredit={overview.data?.credit ?? 0}
          amount={paymentAmount}
          onAmountChange={setPaymentAmount}
          onSubmit={handleRecordPaymentSubmit}
          isSubmitting={createClientPayment.isPending}
        />
      )}
```

**No `invoiceNumber` prop** — this is an on-account payment (F5). The dialog already renders its
hidden invoice input conditionally, and `captureClientPaymentInTx` already accepts a null
`invoiceId`.

Pass `onRecordPayment={setPaymentTarget}` to `AdminClientsTable`. Imports:
`RecordPaymentDialog` and `RecordClientPaymentFormValues` from
`@/pages/staff/invoices/components/RecordPaymentDialog` and
`@/pages/staff/invoices/record-client-payment.schema`; `useCreateClientPayment` from
`@/hooks/useBilling`; `useClientOverview` from `@/hooks/useClientDirectory`.

---

## 5. Frontend — the client detail tabs (J4)

Four new components under `Apps/web/src/pages/admin/clients/components/`. Keep each dumb
(props-only) and wire them in Action 17, matching how `BrowsingActivityTable` is already used.

### Action 13 — Overview tab

**New file:** `components/client-overview-panel.tsx`

Props: `{ overview?: AdminClientOverviewDto; isLoading?: boolean }`. Renders five `StatCard`s
(`@/components/shared/StatCard` — the shared primitive S2's set-02 work standardised; read one
existing consumer for its exact prop names before writing):

| Figure | Source | Key |
|---|---|---|
| Total sold | `overview.totalSold`, `formatDZD` | `admin.clients.overview.totalSold` |
| Total paid | `overview.totalPaid`, `formatDZD` | `admin.clients.overview.totalPaid` |
| Credit | `overview.credit`, `formatDZD` | `admin.clients.overview.credit` |
| Orders | `overview.orderCount` | `admin.clients.overview.orderCount` |
| Products bought | `overview.totalProductQuantity` | `admin.clients.overview.productQuantity` |

While `isLoading`, render `<TableSkeleton rows={1} columns={5} />` or the skeleton primitive the
sibling stat rows use. When `overview.posClientId` is absent, render the three money cards as `0`
with a one-line note (`admin.clients.overview.notApproved`) — that is the honest reading of a client
who has never been approved, not an error state.

Add a header comment stating that the money figures are `PosClient` caches read as-is (D5's ledger is
their only writer) and that `totalProductQuantity` is Σ invoice-line quantity per R1.

### Action 14 — Orders tab

Reuse `OrdersTable` from `@/pages/staff/orders/components/OrdersTable` directly — it is dumb and
props-only (`orders`, `isLoading`, `isError`, `onRetry`, `onRowClick`) and already renders the
reference, contact, product, quantity, type, total and status columns. **No new component.** Omit
`onRowClick` (the client-detail context has no order drawer).

Also update `AdminClientDetail.tsx`'s header comment, which currently asserts "Overview/Orders/
Invoices/Payments stay EmptyState placeholders; no scoped hook exists for them per the plan's
resolve-first section" — this set is exactly what falsifies that sentence.

### Action 15 — Invoices and Payments tabs

**Invoices** — reuse `InvoicesTable` from `@/pages/staff/invoices/components/InvoicesTable`
directly (props `invoices`, `isLoading`, `isError`, `onRetry`, `onRowClick`). Omit `onRowClick`.
**No new component.**

**Payments** — `PaymentsLedger` is a two-tab client/supplier component and is wrong here. Create
**`components/client-payments-table.tsx`**: props `{ payments?: ClientPaymentDto[]; isLoading?: boolean }`,
a `DataTable` with columns reference / invoice-or-on-account / amount / credit movement / date /
staff, reusing the **existing** `admin.invoices.payments.table.*` keys that `PaymentsLedger`'s
`clientColumns` already uses (`reference`, `invoice`, `onAccount`, `amount`, `creditMovement`,
`staff`) plus `staff.invoices.table.date`. Drop the `posClientName` column — every row on this page
is the same client. Add no new translation keys for it.

A refund shows as a **negative** amount (D6) — `formatDZD` handles the sign; do not `Math.abs` it.

### Action 16 — Wire the four tabs

**File:** `Apps/web/src/pages/admin/clients/AdminClientDetail.tsx`

```tsx
  const overview = useClientOverview(id ?? "");

  const ordersQuery = useMemo(
    () => ({ clientId: id, page: 1, limit: 20 }) as BackofficeOrdersQuery,
    [id],
  );
  const orders = useOrdersList("admin", ordersQuery);

  const invoicesQuery = useMemo(
    () => ({ posClientId: client?.posClientId, page: 1, limit: 20 }) as InvoiceListQuery,
    [client?.posClientId],
  );
  const invoices = useInvoices("admin", invoicesQuery, { enabled: !!client?.posClientId });

  const paymentsQuery = useMemo(
    () => ({ posClientId: client?.posClientId, page: 1, limit: 20 }) as ClientPaymentListQuery,
    [client?.posClientId],
  );
  const payments = useClientPayments(paymentsQuery, { enabled: !!client?.posClientId });
```

Replace each of the four `EmptyState` `TabsContent` bodies with the corresponding component. Keep the
`browsing` tab exactly as it is.

Note the ordering constraint: `client` comes from `useClientDirectoryEntry`, so `client?.posClientId`
is undefined on the first render — the `enabled` guards are what stop a `posClientId: undefined`
query from firing and returning the *whole* invoice list. Do not drop them.

Per F11, these hooks fire once the id is known rather than strictly on tab activation, matching
`useClientActivity`'s existing behaviour on this page. Say so in the header comment you rewrite in
Action 14.

---

## 6. Frontend — the invoices page (J5, J6, J7, J8, J9)

### Action 17 — Snapshot view: hide the two actions on a sale invoice (J6)

**File:** `Apps/web/src/pages/staff/invoices/components/InvoiceSnapshotView.tsx`

Add one local above the returned tree:

```tsx
  // J6 — a sale invoice is settled at the POS: its cancel and record-payment paths still exist
  // in the backend and the hooks, but must not be reachable from this dialog.
  const isSaleInvoice = invoice.sourceType === InvoiceSource.SALE;
```

Add `&& !isSaleInvoice` to **both** button conditions (lines 99 and 107). `InvoiceSource` is a value
import — the file currently imports only `InvoiceStatus` as a value; add it.

Update the two prop doc comments on `onCancel` and `onRecordPayment` (lines 17–23) to record the new
condition.

### Action 18 — The page: credit fixes + filters (J5, J7, J8, J9)

**File:** `Apps/web/src/pages/staff/invoices/StaffInvoices.tsx`

**a. J5** — line 240: `previousCredit={supplierPaymentTarget?.supplierCredit ?? 0}` (S7's field).

**b. J9/F7** — line 212: `previousCredit={selectedInvoice.posClientCredit ?? 0}` (Action 2's field).

**c. J7/J8 — per-tab filter state.** Replace the single `page` state (line 49) and the three
hardcoded query `useMemo`s with three independent filter+page states:

```tsx
  const [outgoingFilters, setOutgoingFilters] = useState<{ source?: InvoiceSource; from?: string; to?: string }>({});
  const [outgoingPage, setOutgoingPage] = useState(1);
  const [incomingFilters, setIncomingFilters] = useState<{ from?: string; to?: string }>({});
  const [paymentsFilters, setPaymentsFilters] = useState<{ from?: string; to?: string }>({});

  const outgoingQuery: InvoiceListQuery = useMemo(
    () => ({ ...outgoingFilters, page: outgoingPage, limit: 20 }),
    [outgoingFilters, outgoingPage],
  );
  const incomingQuery = useMemo(
    () => ({ ...incomingFilters, page: 1, limit: 20 }),
    [incomingFilters],
  );
  const paymentsQuery = useMemo(
    () => ({ ...paymentsFilters, page: 1, limit: 20 }),
    [paymentsFilters],
  );
```

Every filter setter must also `setOutgoingPage(1)` where a page exists (F10) — a filter applied on
page 3 otherwise shows an empty table. Only the outgoing tab is paginated today; leave the other two
as they are.

`paymentsQuery` feeds **both** `useClientPayments` and `usePurchasingPayments`; both query schemas
gain the same `from`/`to` in Actions 3 and 4, so one object serves both — but note they are separate
TypeScript types, so annotate the memo as the wider of the two or let inference handle it.

**d. J7/J8 — the filter bar.** Create **`components/InvoiceFiltersBar.tsx`** under
`pages/staff/invoices/components/`:

```ts
interface InvoiceFiltersBarProps {
  from?: string;
  to?: string;
  onChange: (next: { from?: string; to?: string; source?: InvoiceSource }) => void;
  /** Outgoing tab only — omit to render just the date range. */
  source?: InvoiceSource;
  showSource?: boolean;
}
```

Two `<Input type="date">`s (labels `admin.invoices.filters.from` / `.to`) and, when `showSource`, a
shadcn `<Select>` over `InvoiceSource` with an "all" option. Reuse the **existing**
`invoices.source.sale` / `.order` / `.repair` keys for the option labels — the same
`SOURCE_LABEL_KEY` map `InvoicesTable.tsx:16` declares; import that map rather than re-declaring it
(export it from `InvoicesTable.tsx` if it is not already exported). An empty date input must send
`undefined`, not `""` — `z.iso.date()` rejects `""`.

Render it above each of the three `TabsContent` bodies: outgoing with `showSource`, incoming and
payments without. In the **staff** scope (`scope !== "admin"`, no tabs) render the bar above
`outgoingTable` too — staff sees only the outgoing list, and J8 says "every tab".

**e.** The file's header comment describes the two Sprint-4 gaps this page filled; it is still
accurate. Add a line noting that both payment dialogs now preview from the counterparty's live
credit rather than the document snapshot, so the next reader does not "restore" the old expression.

---

## 7. Translations, gate, report

### Action 19 — Translation keys

**File:** `Apps/web/src/config/translations.json`

**Add:**

| Key | en | fr |
|---|---|---|
| `admin.clients.recordPayment.action` | Record a payment | Enregistrer un paiement |
| `admin.clients.recordPayment.needsApproval` | Approve this client first | Approuvez d'abord ce client |
| `admin.clients.recordPayment.success` | Payment recorded | Paiement enregistré |
| `admin.clients.overview.totalSold` | Total sold | Total vendu |
| `admin.clients.overview.totalPaid` | Total paid | Total payé |
| `admin.clients.overview.credit` | Credit | Crédit |
| `admin.clients.overview.orderCount` | Orders | Commandes |
| `admin.clients.overview.productQuantity` | Products bought | Produits achetés |
| `admin.clients.overview.notApproved` | This client has not been approved yet, so no account figures exist. | Ce client n'a pas encore été approuvé, aucun chiffre de compte n'existe. |
| `admin.invoices.filters.from` | From | Du |
| `admin.invoices.filters.to` | To | Au |
| `admin.invoices.filters.source` | Source | Source |
| `admin.invoices.filters.allSources` | All sources | Toutes les sources |

**Reuse, do not duplicate:** `admin.clients.table.createdDate` (already exists, and Action 11a
finally makes it truthful); every `admin.invoices.payments.table.*` key (Action 15);
`invoices.source.sale` / `.order` / `.repair` (Action 18d); `staff.invoices.recordPayment.*`
(Action 12 reuses the dialog wholesale).

**Check before adding**, with `grep -n '"admin.clients.detail.tabs' Apps/web/src/config/translations.json`:
the five tab labels already exist and are already rendered. Do not touch them.

Verify the file still parses (`node -e "require('./Apps/web/src/config/translations.json')"`).

### Action 20 — Validation gate

```
Apps/contract: npx tsc --noEmit      npm run lint
Apps/api:      npx prisma validate   npx tsc --noEmit   npm run lint
Apps/web:      npx tsc --noEmit      npm run lint
```

No schema change and no migration in this set.

`Apps/api`'s `tsc` includes `test/**`; every error there is **pre-existing** staleness from S1/S5
(itemised in `report-S01.md` and `report-S05.md`) plus whatever Action 7's `InvoiceRow` widening adds
— confirm `src/**` is clean by filtering error headers to paths outside `test/`. Lint has a **6-error
pre-existing baseline** on `prisma/seed.ts` and `validate-request.middleware.ts`.

Stale-test sweep (do **not** edit or run anything found):

```
grep -rln "InvoiceRow\|INVOICE_INCLUDE\|listClientPayments\|listBackoffice" Apps/api/test
grep -rln "lastOrderDate\|AdminClientsTable\|StaffInvoices\|InvoiceSnapshotView" Apps/web/tests
```

Action 7's `InvoiceRow` gains a required `posClient` member — **every billing test fixture that
constructs an `InvoiceRow` is now stale.** Name them individually in the report.

### Action 21 — Report

Write `Docs/Stage-04-Fixes/results/report-S08.md` following `report-S06.md`'s structure.

**Handoffs to record explicitly:**

1. **To S10** — the order-completion payment path will write a `ClientPayment` row; the client-detail
   Payments tab (Action 15) will surface it with no further change, and the Overview's
   `totalProductQuantity` will start counting order lines the moment order invoices are issued at
   `COMPLETED` (D3).
2. **To S13** — repair invoices (source `REPAIR`) will appear in the client's Invoices tab and their
   lines in `totalProductQuantity` automatically, because R1's aggregate is source-agnostic. The
   on-account repair payments (null `invoiceId`) will render as "on account" rows in the Payments
   tab, using the key that already exists.
3. **To S12** — J6 hides the record-payment and cancel buttons on **sale** invoices; the Returns tab
   S12 adds is the intended path for reversing a sale, and must not re-expose these two.
4. **To S18** — `StaffInvoices.tsx` is the shared page for `/staff/invoices` and `/admin/invoices`;
   the filter bar lands in **both** scopes at once, so S18 has nothing to mirror for it. The clients
   pages have no staff twin today.
5. Whether `AdminClients.tsx` needed a local `TooltipProvider` (Action 11b) — record the answer, since
   S18 will hit the same question on any staff twin.

---

## 8. Dependency order

Actions are already in execution order. The hard edges:

- **1 → 6 → 10 → 12 and 16** (overview DTO → service/route → hook → its two consumers).
- **2 → 7 → 18b** (invoice credit field → mapper → the call site that reads it).
- **3 → 7b**, **4 → 8**, **5 → 9** (each query schema before the `where` that consumes it).
- **11 → 12** (the table's new prop before its caller).
- **13/14/15 → 16** (the tab components before the page that mounts them).
- **S7 Action 1/3 → 18a.** If `SupplierInvoiceDto.supplierCredit` does not exist, S7 has not landed;
  stop rather than re-adding it here.
- Actions 17 and 18 are independent of §4 and §5 and may be done first if that suits.

---

## 9. Manual verification checklist

The owner performs these in the browser, with a database query where stated. No automated test runs.
Prepare: one **approved** client with a linked POS client, some POS sales, at least one order and one
recorded payment; one **pending** client; one supplier with two confirmed invoices at different dates.

**Clients list (J1, J2)**

1. `/admin/clients` — the **Created date** column now shows each client's registration date,
   formatted, for **every** row — including clients who have never ordered. Cross-check one against
   `SELECT code, "createdAt" FROM "Client" WHERE code = '…';`.
2. A third action icon (a card icon) appears on every row.
3. On a **pending** client the icon is **greyed out**; hovering it explains the client must be
   approved first.
4. On an **approved** client, click it. Note the client's credit first:
   `SELECT credit, "totalPaid" FROM "PosClient" WHERE id = '…';`
   The dialog's "previous credit" equals that figure exactly.
5. Type an amount: the preview shows `credit → credit − amount`. Submit. A success toast appears, and
   the same query shows `credit` down by the amount and `totalPaid` **up** by it.
6. `SELECT reference, "invoiceId", amount FROM "ClientPayment" ORDER BY "paidAt" DESC LIMIT 1;` — the
   new row has **`invoiceId` NULL** (an on-account payment) and the amount you entered.
7. `SELECT SUM(amount) FROM "ClientPayment" WHERE "posClientId" = '…';` still equals that client's
   `totalPaid` exactly. This is D5/D6's core invariant — it must survive J2.
8. Try to submit an amount of **0** or a negative one: the dialog rejects it inline.

**Client information — tabs (J3, J4)**

9. `/admin/clients/:id` on a **pending** client → **Approve**: the category dropdown shows the
   category **name** after selection, not a uuid (J3, verify-only — if it shows an id, report it as
   an S2 regression rather than patching this dialog).
10. `/admin/clients/:id` on an approved client → **Overview**: five figures, none of them an empty
    state. Cross-check the first three against
    `SELECT credit, "totalPaid", "totalSold" FROM "PosClient" WHERE id = '…';`.
11. **Orders** count matches `SELECT count(*) FROM "Order" WHERE "clientId" = '…';`.
12. **Products bought** matches
    `SELECT COALESCE(SUM(l.quantity),0) FROM "InvoiceLine" l JOIN "Invoice" i ON i.id = l."invoiceId" WHERE i."posClientId" = '…' AND i.status <> 'CANCELLED';`
13. **Orders** tab: only that client's orders, no one else's. Compare the row count to step 11.
14. **Invoices** tab: only that client's invoices. A POS sale you make for this client appears here
    within a refresh.
15. **Payments** tab: the payment from step 5 is listed, its invoice column reads **"on account"**,
    and its credit-movement column matches the preview from step 5.
16. **Browsing** tab is unchanged from before this set.
17. Open a **pending** client's detail page: Overview shows zeros with a "not approved yet" note, and
    Orders/Invoices/Payments render empty rather than erroring or showing another client's data.
18. Cancel an invoice for this client (`/admin/invoices` → outgoing → an **order** invoice → Cancel),
    then reload the Overview: **Products bought** has dropped by that invoice's quantity.

**Invoices — outgoing (J6, J7, J8)**

19. `/admin/invoices` → **Outgoing** → open a **SALE** invoice: there is **no** Cancel button and
    **no** Record-payment button.
20. Open an **ORDER** invoice that is not fully paid: **both** buttons are still there and both still
    work.
21. Note that client's credit, then use that Record-payment button. Its "previous credit" is the
    client's **current** credit — **the same figure the clients-list dialog showed in step 4** — not
    the invoice's frozen `newCredit`. Compare the two dialogs directly for the same client.
22. Outgoing tab: set the **source** filter to *Order* — only order invoices remain. Set it to *Sale*
    — only sale invoices. Reset to *All sources*.
23. Set a **From** date after every invoice's date: the table empties. Widen it: rows return.
24. Go to page 2 of the outgoing list, then change a filter: the list jumps back to **page 1** with
    results, not to an empty page 2.

**Invoices — incoming (J5, J8)**

25. Note a supplier's current credit on `/admin/suppliers`. `/admin/invoices` → **Incoming** → click
    the supplier's **oldest** invoice. The payment dialog's "previous credit" equals the supplier's
    **current** credit, not the figure frozen on that old invoice.
26. Submit a payment. The incoming table's **Paid** and **Outstanding** columns for that invoice
    update without a manual reload, and `/admin/suppliers` shows the new credit.
27. Incoming tab: the date-range filter narrows the list by invoice date.

**Invoices — payments (J8)**

28. **Payments** tab → **Client** sub-tab: the date filter narrows it. Set a range that excludes
    today and the payment from step 5 disappears; widen it and it returns.
29. **Supplier** sub-tab: the same filter narrows it, and the payment from step 26 behaves the same
    way.
30. A **refund** row (from any earlier return) still shows as a **negative** amount here and in the
    client-detail Payments tab.

**Staff parity spot-check**

31. `/staff/invoices` as a staff user: the date filter bar is present above the single outgoing
    table, and a **sale** invoice there also shows no record-payment button.

**Nothing else moved**

32. `/admin/pos` still completes a sale for a POS client and still issues its invoice with the
    payment row S5 introduced.
33. `/admin/orders` still lists **every** order (the new `clientId` filter is optional and unset
    there).
34. `/admin/supplier-invoices` and the S7 editor are unaffected.
