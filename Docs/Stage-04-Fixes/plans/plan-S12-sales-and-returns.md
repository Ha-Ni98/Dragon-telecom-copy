# Plan S12 — Sales & returns

*The arithmetic already exists: S5 rewrote `createReturn` around the payment ledger (D6/D7) and
that code is live. This set is the **UI and its wiring** — plus the one thing the UI cannot be built
without: a way to **read** returns back, which the backend does not offer today (only
`POST /admin/returns` exists).*

Covers `app-issues-01.md` §S12 in full:

- the sale receipt + return flow apply S5's semantics (D6, D7) — **UI and wiring, not arithmetic**;
- a **Returns tab**: return reference, sale reference, date, client, user, quantity returned, total
  returned; row click → the returned products with their returned prices;
- the **created date** column on the sales table.

---

## 0. Before you start

### 0.1 Sets that must land first

- **S5** — the payment ledger. Executed (`results/report-S05.md`). It rewrote
  `sales.service.ts:createReturn`: a refund is a **negative-amount `ClientPayment`**, capped at
  `sale.paidAmount − already-refunded`; a **partial** return moves `totalSold` only, a **full**
  return additionally reverses the sale's own credit delta. **Do not change one line of that
  arithmetic in this set.** Re-read `sales.service.ts:334–435` before touching anything nearby.
- **S1** — `SaleDto.createdAt` (already present, `sales.dtos.ts:23`, mapped at
  `sales.mapper.ts:49`). §S12's "created date column" is therefore frontend-only.

### 0.2 Owner decisions taken this session — settled, do not re-open

| # | Question | Owner's answer |
|---|---|---|
| **R1** | How is the returns list built? | **One paginated list, lines inline.** New admin-only `GET /admin/returns` with an optional `saleId` filter; each row carries its own `lines[]`, so the row-click detail needs no second fetch and no detail endpoint. |
| **R2** | How far does the return dialog go? | **Bounds + refund summary.** Fix the per-line max to *sold − already returned*, and add a read-only summary showing the refund entered, the cash actually refundable, and the credit effect (partial vs full, D7). |

### 0.3 Findings from reading the code — read before acting

**F1 — `ReturnDialog`'s `alreadyReturnedByLine` prop is dead.** `ReturnDialog.tsx:35` declares it,
`createReturnSchema`'s `lineBounds` consumes it, and **no caller passes it** — `StaffSales.tsx:173`
renders the dialog without it. Its default `{}` makes every bound `line.quantity`, i.e. *sold*, not
*sold − already returned*. The backend re-validates correctly (`sales.service.ts:327–330`), so today
a second return on the same line is accepted by the form and rejected by the server with a raw
English message. R1's `saleId` filter is what finally makes the prop fillable. This is the root
cause behind §S12's "issuing a return applies the semantics implemented in S5" — fix it once here.

**F2 — the cash-refund cap is invisible.** `sales.service.ts:353–354` silently clamps
`cashRefunded = min(refundAmount, sale.paidAmount − alreadyRefunded)`. On a sale taken wholly on
credit the operator can type a refund of 5 000 DA, submit successfully, and see **no cash move at
all** — correct behavior, zero feedback. R2's summary is what surfaces it. Note the cap uses cash
**actually refunded** (Σ negative `ClientPayment`), which can be *less* than Σ prior
`Return.refundAmount` when an earlier return was itself capped — so the summary must not derive it
from the returns list. Action 5 exposes the real figure on `SaleDto`.

**F3 — `AdminSales.tsx` is a one-line wrapper** around `StaffSales.tsx` with `scope="admin"`, the
same shape as `AdminOrders`. Returns are admin-only (`SALE_ROUTES.RETURN` is guarded by `adminOnly`),
so the Returns tab is gated on `scope === "admin"`; staff parity is S18's set.

**F4 — `GET` and `POST` may share the `/admin/returns` literal.** `SALE_ROUTES.UPDATE_DRAFT` and
`DELETE_DRAFT` already establish that convention in this exact file (same path, different verb, its
own constant so no call site hardcodes the string). Follow it — do **not** invent
`/admin/returns/list`.

**F5 — `qk.sales.all()` already covers a nested returns key.** `useCreateReturn` invalidates
`qk.sales.all()` (`["sales"]`), so a `qk.sales.returns(query) → ["sales", "returns", query]` key is
invalidated for free after every return. No change to `useCreateReturn`'s fan-out.

**F6 — nothing in this set touches stock, credit, `totalPaid` or `totalSold`.** The only new backend
code is one read query and one aggregate. If you find yourself writing a `$transaction` in this set,
stop: you have left the plan.

---

## 1. Contract — the return read model

### Action 1 — `Apps/contract/src/modules/sales/sales.dtos.ts`

Append two schemas after `ReceiptResponseSchema`:

```ts
// S12 — the return read model. `Return`/`ReturnLine` existed since set-06 but were write-only
// (POST /admin/returns); the admin Returns tab is the first consumer that reads them back.
// Product identity is denormalised off the linked SaleLine (a ReturnLine has no productId of its
// own), and `unitPrice` is the price the line was *sold* at — "the returned products with their
// returned prices" (§S12) means `refundAmount`, which is per-line and operator-entered, so both
// are carried.
export const ReturnLineResponseSchema = z.object({
  id: z.uuid(),
  saleLineId: z.uuid(),
  productId: z.uuid(),
  productName: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  restock: z.boolean(),
  refundAmount: z.number(),
});
export type ReturnLineDto = z.infer<typeof ReturnLineResponseSchema>;

// `totalQuantity` is Σ lines[].quantity, computed in the mapper rather than stored — the table
// needs it as a column and every consumer would otherwise re-derive it. `posClientId`/
// `posClientName` are the *sale's* client (a Return has no client of its own); both absent for a
// walk-in sale, which the table renders as "Comptoir".
export const ReturnResponseSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  saleId: z.uuid(),
  saleReference: z.string(),
  type: z.enum(ReturnType),
  reason: z.string().optional(),
  refundAmount: z.number(),
  totalQuantity: z.number().int(),
  returnedAt: z.iso.datetime(),
  posClientId: z.uuid().optional(),
  posClientName: z.string().optional(),
  staffId: z.uuid(),
  staffName: z.string(),
  lines: z.array(ReturnLineResponseSchema),
});
export type ReturnDto = z.infer<typeof ReturnResponseSchema>;
```

Extend the file's import to `import { SaleStatus, ReturnType } from './sales.enums';`.

**Also** add one field to `SaleResponseSchema`, after `paidAmount` (F2):

```ts
  // S12 — cash actually refunded against this sale so far (Σ of the negative ClientPayment rows on
  // its invoice), so the return dialog can show what is still refundable before the backend
  // silently caps it (sales.service.ts's cashRefundable). Present on the **detail** read only:
  // populating it on the list would cost a per-row ledger aggregate for a figure no list column
  // shows.
  refundedAmount: z.number().optional(),
```

### Action 2 — `Apps/contract/src/modules/sales/sales.query.ts`

Append:

```ts
// S12 — the admin Returns tab. `saleId` doubles as the return dialog's "already returned per line"
// lookup (one sale's returns), which is why the list carries its lines inline.
export const ReturnListQuerySchema = z.object({
  saleId: z.uuid().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ReturnListQuery = z.infer<typeof ReturnListQuerySchema>;
```

### Action 3 — `Apps/contract/src/modules/sales/sales.routes.ts`

Add one constant, with a comment mirroring the existing `DELETE_DRAFT` note (F4):

```ts
  RETURN: '/admin/returns',
  // Same path as RETURN, distinguished only by HTTP verb (GET vs POST) — its own constant so no
  // call site hardcodes the string (same convention as UPDATE_DRAFT/DELETE_DRAFT above).
  RETURNS_LIST: '/admin/returns',
```

`sales/index.ts` already re-exports all four files with `export *` — no change there.

---

## 2. Backend — read returns back

### Action 4 — `Apps/api/src/modules/sales/sales.mapper.ts`

1. Add the row type next to `SaleRow`:

```ts
// S12 — the shape RETURN_INCLUDE (sales.service.ts) produces. A ReturnLine carries no product
// identity of its own, so the linked SaleLine is joined for productId/name/unitPrice.
export type ReturnRow = Return & {
  sale: Pick<Sale, 'reference' | 'posClientId'> & { posClient: Pick<PosClient, 'name'> | null };
  staff: Pick<Staff, 'firstName' | 'lastName'>;
  lines: (ReturnLine & {
    saleLine: Pick<SaleLine, 'productId' | 'productNameSnapshot' | 'unitPrice'>;
  })[];
};
```

Extend the `@prisma/client` type import with `Return`, `ReturnLine`.

2. Add the mapper method, following the file's existing conventions exactly (conditional spreads for
   optionals, `toMoney` for every `Decimal`, `Schema.parse(dto)` as the last statement, the enum
   cast comment):

```ts
  // No margin gate: a return exposes refund amounts and quantities, never cost or profit — and the
  // route is admin-only anyway (sales.routes.ts).
  static toReturnDto(row: ReturnRow): ReturnDto {
    const dto: ReturnDto = {
      id: row.id,
      reference: row.reference,
      saleId: row.saleId,
      saleReference: row.sale.reference,
      // Prisma's generated $Enums.ReturnType and the contract's ReturnType are distinct nominal
      // types with identical string values (same cast as toSaleDto's SaleStatus).
      type: row.type as ReturnType,
      ...(row.reason != null ? { reason: row.reason } : {}),
      refundAmount: SalesMapper.toMoney(row.refundAmount),
      totalQuantity: row.lines.reduce((sum, line) => sum + line.quantity, 0),
      returnedAt: row.returnedAt.toISOString(),
      ...(row.sale.posClientId != null ? { posClientId: row.sale.posClientId } : {}),
      ...(row.sale.posClient?.name != null ? { posClientName: row.sale.posClient.name } : {}),
      staffId: row.staffId,
      staffName: `${row.staff.firstName} ${row.staff.lastName}`,
      lines: row.lines.map((line) => ({
        id: line.id,
        saleLineId: line.saleLineId,
        productId: line.saleLine.productId,
        productName: line.saleLine.productNameSnapshot,
        quantity: line.quantity,
        unitPrice: SalesMapper.toMoney(line.saleLine.unitPrice),
        restock: line.restock,
        refundAmount: SalesMapper.toMoney(line.refundAmount),
      })),
    };
    return ReturnResponseSchema.parse(dto);
  }
```

3. Widen `toSaleDto`'s context for F2 — `ctx: { includeMargins: boolean; refundedAmount?: number }` —
   and emit the field right after `paidAmount`:

```ts
      ...(ctx.refundedAmount != null ? { refundedAmount: ctx.refundedAmount } : {}),
```

   Every existing call site keeps compiling (the new key is optional); only `getSale` will pass it.

### Action 5 — `Apps/api/src/modules/sales/sales.service.ts`

1. Add the include constant beside `SALE_INCLUDE`:

```ts
const RETURN_INCLUDE = {
  sale: { select: { reference: true, posClientId: true, posClient: { select: { name: true } } } },
  staff: { select: { firstName: true, lastName: true } },
  // Stable order so a return's lines never reshuffle between reads (same rule as orders'
  // ORDER_INCLUDE); the SaleLine join supplies the product identity a ReturnLine lacks.
  lines: {
    orderBy: { id: 'asc' },
    include: { saleLine: { select: { productId: true, productNameSnapshot: true, unitPrice: true } } },
  },
} satisfies Prisma.ReturnInclude;
```

2. Add the list method (place it directly after `createReturn`, so the write and its read sit
   together):

```ts
  // Admin-only route (contract). Read-only: no transaction, no stock, no money — the return
  // document was fully applied by createReturn (S5's D6/D7 arithmetic).
  async listReturns(query: ReturnListQuery): Promise<PaginatedResult<ReturnDto>> {
    const where: Prisma.ReturnWhereInput = {
      ...(query.saleId != null ? { saleId: query.saleId } : {}),
      ...(query.from != null || query.to != null
        ? {
            returnedAt: {
              ...(query.from != null ? { gte: new Date(query.from) } : {}),
              ...(query.to != null ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.return.count({ where }),
      this.prisma.return.findMany({
        where,
        include: RETURN_INCLUDE,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { returnedAt: 'desc' },
      }),
    ]);

    return paginated(ReturnResponseSchema).parse({
      items: rows.map((row) => SalesMapper.toReturnDto(row as ReturnRow)),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }
```

   (`this.prisma.$transaction([...])` here is the read-pair idiom `listSales`/`listBackoffice`
   already use for count+page — not a write transaction.)

3. In `getSale`, resolve the cash already refunded and pass it through (F2). Reuse the exact
   expression `createReturn` uses at lines 339–353 so the two can never drift:

```ts
  async getSale(reference: string, actor: JWTPayload): Promise<SaleDto> {
    const sale = await this.prisma.sale.findUnique({ where: { reference }, include: SALE_INCLUDE });
    if (!sale) throw new NotFoundError('Sale');
    const isAdmin = actor.type === UserType.ADMIN;
    if (!isAdmin && sale.staffId !== actor.staffId) throw new ForbiddenError();
    // S12/F2 — cash actually refunded so far, so the return dialog can show what is still
    // refundable. Same source of truth createReturn's own cap reads: the negative-amount ledger
    // rows on this sale's invoice, never Σ Return.refundAmount (an earlier return may itself have
    // been capped).
    const refundedAmount = await this.cashRefundedSoFar(sale.id);
    return SalesMapper.toSaleDto(sale as SaleRow, { includeMargins: isAdmin, refundedAmount });
  }
```

   Extract the shared helper and call it from **both** `getSale` and `createReturn` (replacing the
   inline `invoice`/`refundedSoFar` block there — but keep `createReturn`'s own `invoice` lookup,
   which it still needs for `captureClientPaymentInTx`):

```ts
  private async cashRefundedSoFar(saleId: string): Promise<number> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { sourceType_sourceId: { sourceType: PrismaInvoiceSource.SALE, sourceId: saleId } },
      select: { id: true },
    });
    if (!invoice) return 0;
    const sum = await this.prisma.clientPayment.aggregate({
      where: { invoiceId: invoice.id, amount: { lt: 0 } },
      _sum: { amount: true },
    });
    return Math.abs(sum._sum.amount?.toNumber() ?? 0);
  }
```

   > If extracting cleanly from `createReturn` risks disturbing its transaction, leave
   > `createReturn` byte-for-byte as it is and let the helper serve `getSale` only — duplicated
   > arithmetic in two places is worse than one, but touching S5's money path is worse than both.
   > Record whichever you chose in the report.

4. Add `ReturnListQuery`, `ReturnDto` and `ReturnResponseSchema` to the contract import block, and
   `ReturnRow` to the mapper import.

### Action 6 — `Apps/api/src/modules/sales/sales.interface.ts`

Add to `ISalesService`, after `createReturn`:

```ts
  listReturns(query: ReturnListQuery): Promise<PaginatedResult<ReturnDto>>;
```

plus the two type imports. No port changes — this set injects nothing new.

### Action 7 — `Apps/api/src/modules/sales/sales.controller.ts`

```ts
  listReturns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.listReturns(req.validated.query as ReturnListQuery), 200);
    } catch (error) {
      next(error);
    }
  };
```

Same shape as `listAdminSales`. Add `ReturnListQuery` to the type import.

### Action 8 — `Apps/api/src/modules/sales/sales.routes.ts`

Register the route immediately **before** the existing `POST` on the same literal, and import
`ReturnListQuerySchema`:

```ts
router.get(SALE_ROUTES.RETURNS_LIST, adminOnly, validateRequest({ query: ReturnListQuerySchema }), controller.listReturns);
router.post(SALE_ROUTES.RETURN, adminOnly, validateRequest({ body: CreateReturnSchema }), controller.createReturn);
```

Express dispatches on method as well as path, so the shared literal is unambiguous. No new guard —
`adminOnly` already exists in this file.

---

## 3. Frontend — data layer

### Action 9 — `Apps/web/src/services/sales.service.ts`

```ts
// Admin-only, read side of the same `/admin/returns` literal `createReturn` posts to (GET vs POST).
export async function listReturns(query: ReturnListQuery): Promise<PaginatedResult<ReturnDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<ReturnDto>>>(
    apiPath(SALE_ROUTES.RETURNS_LIST),
    { params: query },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
```

### Action 10 — `Apps/web/src/lib/query-keys.ts`

Add one key inside the existing `sales` group (F5 — nesting is what makes `useCreateReturn`'s
`qk.sales.all()` invalidation reach it):

```ts
    returns: (query?: unknown) => ["sales", "returns", query] as const,
```

### Action 11 — `Apps/web/src/hooks/useSales.ts`

```ts
// S12 — the admin Returns tab, and the return dialog's "already returned per line" lookup
// (`{ saleId }`). `options.enabled` follows useSales' own precedent: the dialog's query must not
// fire until a sale is actually selected.
export function useReturns(query: ReturnListQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.sales.returns(query),
    queryFn: () => salesService.listReturns(query),
    enabled: options?.enabled,
  });
}
```

`useCreateReturn`'s `onSuccess` fan-out is **unchanged** (F5).

---

## 4. Frontend — the Returns tab

### Action 12 — new `Apps/web/src/pages/admin/sales/components/ReturnsTable.tsx`

Dumb, props-only, modelled directly on `SalesTable.tsx` (same `DataTable` + `TableSkeleton` +
`EmptyState` + `NotFoundState` + retry-button shape).

```ts
interface ReturnsTableProps {
  returns?: ReturnDto[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onRowClick?: (item: ReturnDto) => void;
}
```

Columns, in this order (§S12's list, verbatim):

| id | header key | cell |
|---|---|---|
| `reference` | `admin.sales.returnsTable.reference` | `<span className="font-mono text-sm">` |
| `saleReference` | `admin.sales.returnsTable.saleReference` | `<span className="font-mono text-sm">` |
| `returnedAt` | `admin.sales.returnsTable.date` | `formatDateTime(…, language)` |
| `client` | `admin.sales.returnsTable.client` | `item.posClientName ?? t("staff.sales.table.counter")` |
| `staffName` | `admin.sales.returnsTable.user` | plain |
| `totalQuantity` | `admin.sales.returnsTable.quantity` | plain |
| `refundAmount` | `admin.sales.returnsTable.total` | `formatDZD(…, language)` |
| `type` | `admin.sales.returnsTable.type` | `t(RETURN_TYPE_LABEL_KEY[item.type])` |

`RETURN_TYPE_LABEL_KEY` is a module-level `Record<ReturnType, string>` in this file mapping
`REFUND → "admin.sales.returnDialog.typeRefund"` and `EXCHANGE → "admin.sales.returnDialog.typeExchange"`
— reusing the dialog's existing keys, the same way `SalesTable` declares its own `STATUS_LABEL_KEY`.

Mobile row: reference + refund amount on the first line, client + date on the second.
Empty state icon: `Undo2` from `lucide-react`. `TableSkeleton rows={8} columns={8}`.

### Action 13 — new `Apps/web/src/pages/admin/sales/components/ReturnDetailDialog.tsx`

Dumb, props-only: `{ open, onOpenChange, item: ReturnDto | null }`. Renders `null` when `item` is
null. No fetch — the row already carries its lines (R1).

- Title `admin.sales.returnDetail.title`, with `item.reference` and `item.saleReference` beneath it.
- One bordered row per `item.lines` entry: product name, `quantity`, the price it was sold at
  (`unitPrice`), the **refunded** amount (`refundAmount`), and a restock marker
  (`restock ? t("admin.sales.returnDetail.restockYes") : t("…restockNo")`).
- `item.reason` when present, under `admin.sales.returnDetail.reason`.
- A total row: `admin.sales.returnDetail.total` → `formatDZD(item.refundAmount, language)`.

### Action 14 — `Apps/web/src/pages/staff/sales/StaffSales.tsx`

Wrap the existing list in tabs — **admin only** (F3). Structure, following `AdminProducts.tsx:199`:

```tsx
{scope === "admin" ? (
  <Tabs defaultValue="sales">
    <TabsList>
      <TabsTrigger value="sales">{t("admin.sales.tabs.sales")}</TabsTrigger>
      <TabsTrigger value="returns">{t("admin.sales.tabs.returns")}</TabsTrigger>
    </TabsList>
    <TabsContent value="sales">{salesSection}</TabsContent>
    <TabsContent value="returns">{returnsSection}</TabsContent>
  </Tabs>
) : (
  salesSection
)}
```

where `salesSection` is the existing `<SalesFilters> + <SalesTable> + <SimplePagination>` block
extracted to a local `const`, unchanged. `returnsSection` is
`<ReturnsTable> + <SimplePagination>` over its own page state.

New state and queries in this component:

- `const [returnsPage, setReturnsPage] = useState(1);`
- `const [selectedReturn, setSelectedReturn] = useState<ReturnDto | null>(null);`
- `const returnsQuery: ReturnListQuery = useMemo(() => ({ page: returnsPage, limit: 20 }), [returnsPage]);`
- `const { data: returnsResult, … } = useReturns(returnsQuery, { enabled: scope === "admin" });`
- the per-sale lookup that finally fills F1's dead prop:

```tsx
  // S12/F1 — ReturnDialog has always accepted `alreadyReturnedByLine`; until this set nothing
  // could produce it, so its per-line max was "sold" rather than "sold − already returned" and a
  // second return on the same line was rejected only by the server. limit 100: a single sale's
  // returns, not a page of the global list.
  const { data: saleReturns } = useReturns(
    { saleId: selectedSale?.id, page: 1, limit: 100 },
    { enabled: canReturn && !!selectedSale },
  );
  const alreadyReturnedByLine = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of saleReturns?.items ?? []) {
      for (const line of item.lines) {
        map[line.saleLineId] = (map[line.saleLineId] ?? 0) + line.quantity;
      }
    }
    return map;
  }, [saleReturns]);
```

Then pass `alreadyReturnedByLine={alreadyReturnedByLine}` to `<ReturnDialog>` — and extend its
remount `key` to `` `${selectedSale?.id ?? "none"}-${saleReturns?.meta.total ?? 0}` `` so the bounds
are recomputed after a return lands rather than staying frozen at the first render's values.

Render `<ReturnDetailDialog open={!!selectedReturn} onOpenChange={(open) => !open && setSelectedReturn(null)} item={selectedReturn} />`
inside the `scope === "admin"` block, alongside the existing `<ReturnDialog>`.

### Action 15 — `Apps/web/src/pages/staff/sales/components/SalesTable.tsx`

Add the created-date column immediately after the existing `soldAt` "Date" column:

```tsx
      {
        accessorKey: "createdAt",
        header: t("staff.sales.table.createdAt"),
        cell: ({ row }) => formatDateTime(row.original.createdAt, language),
      },
```

`SaleDto.createdAt` is required (S1), so no fallback is needed — unlike `soldAt`, which stays
`"—"` for a draft. Bump both `TableSkeleton` counts by one (`scope === "admin" ? 8 : 7`).

### Action 16 — `Apps/web/src/pages/admin/sales/components/ReturnDialog.tsx`

Two changes; the schema file (`create-return.schema.ts`) is **unchanged** — its `lineBounds`
mechanism already does the right thing once real bounds arrive.

1. **Bounds (F1):** none — `lineBounds` is already computed from the prop at lines 54–57. It starts
   working the moment Action 14 passes the prop. Verify the `max={lineBounds[saleLine.id]}` on the
   quantity input and drop any line whose bound is `0` from the rendered list (a fully-returned line
   cannot be returned again, and offering a checkbox that can only produce a validation error is
   noise).

2. **Refund summary (R2/F2):** add a read-only block above `<DialogFooter>`, driven by
   `watch("lines")`:

```tsx
  const watchedLines = watch("lines");
  const refundTotal = (watchedLines ?? []).reduce((sum, l) => sum + (Number(l.refundAmount) || 0), 0);
  const cashRefundable = Math.max(0, sale.paidAmount - (sale.refundedAmount ?? 0));
  // D7 — "full" means every sale line is fully returned once this return lands. A full return
  // additionally reverses the sale's own credit delta; a partial one leaves credit untouched.
  const isFullReturn = sale.lines.every((saleLine) => {
    const entered = (watchedLines ?? []).find((l) => l.saleLineId === saleLine.id)?.quantity ?? 0;
    return (alreadyReturnedByLine[saleLine.id] ?? 0) + Number(entered) >= saleLine.quantity;
  });
```

   Render, each as a label/value row inside a `rounded-lg border border-border bg-muted/40 p-3` box
   titled `admin.sales.returnDialog.summaryTitle`:

   - `admin.sales.returnDialog.summaryRefundTotal` → `formatDZD(refundTotal, language)`
   - `admin.sales.returnDialog.summaryCashRefundable` → `formatDZD(cashRefundable, language)`
   - when `refundTotal > cashRefundable`, a `text-warning` line reading
     `admin.sales.returnDialog.summaryCashCapped` — *"Only … will be refunded in cash; the rest
     reduces what the client owes."* Not a validation error: the backend accepts it and the cap is
     correct behavior (F2), the operator just needs to see it.
   - `isFullReturn ? t("…creditEffectFull") : t("…creditEffectPartial")`

   `useTranslation()` already supplies `language` here? It does not — the component currently
   destructures `{ t }` only. Change to `const { t, language } = useTranslation();` and import
   `formatDZD` from `@/lib/utils`.

---

## 5. Translation keys

Add to `Apps/web/src/config/translations.json` — flat dotted keys, `{ "en", "fr", "ar" }`, with
**`ar` an empty string** (the convention across every key in this file).

| Key | en | fr |
|---|---|---|
| `staff.sales.table.createdAt` | `Created` | `Créée le` |
| `admin.sales.tabs.sales` | `Sales` | `Ventes` |
| `admin.sales.tabs.returns` | `Returns` | `Retours` |
| `admin.sales.returnsTable.reference` | `Return` | `Retour` |
| `admin.sales.returnsTable.saleReference` | `Sale` | `Vente` |
| `admin.sales.returnsTable.date` | `Date` | `Date` |
| `admin.sales.returnsTable.client` | `Client` | `Client` |
| `admin.sales.returnsTable.user` | `User` | `Utilisateur` |
| `admin.sales.returnsTable.quantity` | `Qty returned` | `Qté retournée` |
| `admin.sales.returnsTable.total` | `Total refunded` | `Total remboursé` |
| `admin.sales.returnsTable.type` | `Type` | `Type` |
| `admin.sales.returnsTable.empty` | `No returns yet` | `Aucun retour` |
| `admin.sales.returnsTable.error` | `Returns could not be loaded` | `Impossible de charger les retours` |
| `admin.sales.returnDetail.title` | `Return detail` | `Détail du retour` |
| `admin.sales.returnDetail.product` | `Product` | `Produit` |
| `admin.sales.returnDetail.quantity` | `Quantity` | `Quantité` |
| `admin.sales.returnDetail.unitPrice` | `Sold at` | `Vendu à` |
| `admin.sales.returnDetail.refundAmount` | `Refunded` | `Remboursé` |
| `admin.sales.returnDetail.restock` | `Restocked` | `Remis en stock` |
| `admin.sales.returnDetail.restockYes` | `Yes` | `Oui` |
| `admin.sales.returnDetail.restockNo` | `No` | `Non` |
| `admin.sales.returnDetail.reason` | `Reason` | `Motif` |
| `admin.sales.returnDetail.total` | `Total refunded` | `Total remboursé` |
| `admin.sales.returnDialog.summaryTitle` | `Refund summary` | `Résumé du remboursement` |
| `admin.sales.returnDialog.summaryRefundTotal` | `Refund entered` | `Remboursement saisi` |
| `admin.sales.returnDialog.summaryCashRefundable` | `Cash refundable` | `Remboursable en espèces` |
| `admin.sales.returnDialog.summaryCashCapped` | `Only the refundable cash will be paid back; the remainder reduces what the client owes.` | `Seul le montant remboursable sera rendu en espèces ; le reste réduit ce que le client doit.` |
| `admin.sales.returnDialog.creditEffectPartial` | `Partial return — the client's credit is unchanged.` | `Retour partiel — le crédit du client reste inchangé.` |
| `admin.sales.returnDialog.creditEffectFull` | `Full return — this sale's credit is reversed.` | `Retour complet — le crédit de cette vente est annulé.` |

**Reused, already present — do not re-add:** `staff.sales.table.counter`,
`staff.sales.table.empty`/`error`, `admin.sales.returnDialog.typeRefund`/`typeExchange` and every
other `admin.sales.returnDialog.*` key, `common.actions.tryAgain`.

---

## 6. Validation gate

No test file is read, edited or run (D12). In order:

```bash
(cd Apps/contract && npx tsc --noEmit && npm run lint)
(cd Apps/api     && npx tsc --noEmit 2>&1 | grep -E "^src/" ; npm run lint)
(cd Apps/web     && npx tsc --noEmit)
```

- `Apps/api` lint baseline is **6 pre-existing errors** (`prisma/seed.ts` ×3,
  `validate-request.middleware.ts` ×3). Unchanged count = pass.
- Do **not** run `npm run lint` in `Apps/web` (~10.2k pre-existing prettier findings). Use
  `npx eslint --fix` scoped to the files this set touched, then re-run `tsc`.

Sweeps — the first is the one that matters most in this set (F6):

```bash
# no money/stock write was added: only listReturns/cashRefundedSoFar are new, both read-only
git diff -- Apps/api/src/modules/sales/sales.service.ts | grep -nE "^\+.*(applyDocumentCharge|applyLedgerPayment|captureClientPaymentInTx|returnIn|consumeFifo|totalPaid|totalSold|credit)"
# no listener was given money to write (standing invariant, report-credit-serialization.md)
find Apps/api/src/modules -name "*.listener.ts" | xargs grep -nE "credit|totalPaid|totalSold|paidAmount|quantityOn|quantityRes"
# no hardcoded returns path
grep -rn "'/admin/returns'" Apps/web/src Apps/api/src
```

The first must produce **no output**. The second may match comments and narration-string builders
only. The third must match `sales.routes.ts` (contract) alone.

---

## 7. Manual verification checklist

The owner runs these in the browser, signed in as **admin** unless stated.

**Setup**
1. `/admin/pos` — make two sales to the same POS client: **Sale A** paid in full, **Sale B** paid
   only partially (the rest on credit). Note the client's credit and total paid before you start.

**Sales table**
2. `/admin/sales` — the table now has both a **Date** (sold) and a **Created** column, and a draft
   row shows `—` for Date but a real timestamp for Created.

**Returns tab**
3. A **Sales / Returns** tab bar sits above the table. The Returns tab is empty at first.
4. Open Sale A → **Issue return** → return **one** of two units of one line, restock on, refund =
   one unit's price. Submit.
5. The Returns tab now lists one row: return reference, **Sale A's** reference, today's date, the
   client's name, your username, quantity `1`, the refunded total, and type *Refund*.
6. Click that row → a dialog lists the returned product with the price it was **sold** at and the
   amount **refunded**, the restock marker, and the total.
7. `/staff/sales` as a staff user: **no** tab bar, no Returns table — staff parity is S18.

**Per-line bounds (F1)**
8. Re-open Sale A → **Issue return**. The line you partly returned now caps at the **remaining**
   quantity, not the original. Try to type more → the form blocks it *before* submitting (no server
   error toast).
9. Return the remaining unit and every other line, so the sale is fully returned. Re-open the
   dialog → that sale's lines are gone / it offers nothing left to return, and the sale's status
   reads **Returned**.

**Refund summary (R2/F2)**
10. Open **Sale B** (partially paid) → **Issue return** → tick a line and enter a refund **larger**
    than what was actually paid on that sale. The summary shows *Refund entered* and a smaller
    *Cash refundable*, plus the warning that only the refundable part comes back in cash.
11. The same panel reads **"Partial return — the client's credit is unchanged."** Tick every line at
    full quantity → it flips to **"Full return — this sale's credit is reversed."**
12. Submit the partial return. `/admin/pos-clients` → the client's **credit is unchanged**, their
    **total sold** fell by the refund, and their **total paid** fell only by the cash that was
    actually available (never below where it started) — D7, unchanged from S5.
13. `/admin/invoices` → Sale B's invoice moved back from PAID/PARTIALLY_PAID, and the payments
    ledger shows a **negative-amount** row for the refund (D6).

**The ledger invariant still holds**
14. `SELECT SUM(amount) FROM "ClientPayment" WHERE "posClientId" = '…';` equals that client's
    `totalPaid` exactly.

**Nothing else moved**
15. `/admin/pos` still confirms a sale, prints its receipt and records its ledger row exactly as
    before.
16. The sales list's status filter, date range, seller and POS-client filters and pagination all
    behave as they did; the sale detail drawer still opens on row click with its cost/profit lines
    and credit snapshot.
17. `/admin/orders` — the S11 work is untouched: action column, stat badges, user/category columns
    all still render.

---

The owner reviews and approves before S13 begins.
