# Plan S36 — Client purchase history: the "Products bought" tab

Execution plan for **set 36** of `Docs/Stage-04-Fixes/sets-34-36.md`. This is the last set of the
programme.

---

## §0 — Before you start

### 0.1 Sets that must already be landed

**S34 and S35 are committed** (`9dd1f7e`, `a1f6848`). S36 doesn't depend on either.

S36 touches two files that S34 also changed:
- `StaffSales.tsx` (S34 rewrote its filters; S36 adds a deep-link read);
- `StaffPosClients.tsx` (S34 added search and the payment result; S36 passes `scope` to the
  drawer).

Keep S34's code intact in both. The only other shared file is
`Apps/web/src/config/translations.json`, where you only **add** keys.

### 0.2 Owner decisions taken while planning (settled, do not re-open)

| # | Question | Answer |
|---|---|---|
| Q1 | On the **staff** POS-clients drawer, should the tab show the whole history, or only this staff member's own sales? | **The whole history:** every product the client bought, from any seller, plus their orders. No margins appear anyway. A link to another seller's sale opens the sale drawer's existing "forbidden" message. |
| Q2 | What does **amount refunded** show? | **Cash refunded:** Σ stored `ReturnLine.refundAmount`. A return credited to the client's account (S32) reads "1 returned, 0 refunded". The dev data has exactly this case. |
| Q3 | A POS sale can carry a sale-level discount that isn't spread onto its lines. What does a product's **total amount** use? | **The stored `lineTotal`**, as the brief says ("never recomputed"). On a discounted sale, the product total is before the sale-level discount. A note under the table says so. |

### 0.3 Where the tab lands (determined from the code)

| Side | Page that exists | Identity it starts from | The tab |
|---|---|---|---|
| **Admin** | `/admin/clients/:id`, `AdminClientDetail.tsx`. The web client's information page has tabs Overview, Orders, Invoices, Payments and Browsing. | web `Client.id` | A sixth tab, **Products bought** |
| **Admin and staff** | The **POS-client detail drawer** (`pos-client-detail-drawer.tsx`), shared by `/admin/pos-clients` and `/staff/pos-clients` through `StaffPosClients.tsx` (S18/D-5). It has tabs Sales, Payments and Credit history. | `PosClient.id` | A fourth tab, **Products bought** |

**Staff have no client information page.** `/admin/clients/:id` sits inside the shared `/admin`
route group, but every API it calls is `adminOnly`. The staff equivalent is the POS-client drawer,
so the tab lands there for staff. It lands there for admin too, because a **walk-in** POS client
(no web account) can only be reached through that drawer. The client's own account page is not
touched.

### 0.4 The two identities, both ways round

- `Client.posClientId` is a unique FK, so one query from either side finds the other (§2).
- **Sales** reach the client through `Sale.posClientId`. **Orders** reach the client through the
  web `Order.clientId`.
- Every combination works, and neither empty branch crashes:

| Starting point | Sales branch | Orders branch |
|---|---|---|
| Web client with a linked POS client | its POS client's sales | its own orders |
| Web client with **no** POS identity (never approved) | omitted, because there is no `posClientId` | its own orders. In practice there are none: an unapproved client can't log in, so can't order. The query still runs safely. |
| POS client with a linked web account | its sales | the linked client's orders |
| **Walk-in** POS client (no web account) | its sales | omitted |

A branch is omitted by building the SQL with `Prisma.empty`, not by matching `= NULL`.

### 0.5 What counts as "bought"

- **Sales:** status `COMPLETED`, `PARTIALLY_RETURNED` or `RETURNED`. This is
  `SALE_RECOGNIZED_STATUSES` from statistics: a sale that saw a return is still a sale. **Drafts and
  cancelled sales are excluded.**
- **Orders:** status `COMPLETED` or `RETURNED` **and** `deliveredAt IS NOT NULL`.
  - `deliveredAt` is set only at COMPLETED (`orders.service.ts:478`).
  - An order can also reach `RETURNED` straight from `IN_DELIVERY`, and then nothing was consumed
    or invoiced. The `deliveredAt` test excludes exactly those.
- **Repair parts are excluded:** `RepairPart` is never read.
- **Returns** are shown **separately, never netted:**
  - quantity returned = Σ `ReturnLine.quantity`;
  - amount refunded = Σ `ReturnLine.refundAmount` (Q2).

  "3 bought, 1 returned" stays two figures.
- **Amounts** are the stored line figures: Σ `lineTotal` per product, and `unitPrice`/`lineTotal`
  per document line. They are **never** recomputed from catalog prices, so a repriced product still
  shows what was charged (Q3).

### 0.6 SQL validated during planning (read-only, dev DB)

Both queries below ran on the dev DB, and every product row equals a plain Prisma recomputation of
the same lines and return lines. Measured results:

- **POS-2026-0003 (walk-in, no web account):**
  - Display Redmi K20: 2 bought / 21 000 / 1 returned / 10 500 refunded;
  - Display Lg V20: 1 / 18 000 / 1 / 18 000;
  - Battery Samsung S24 ultra: 1 / 8 500 / 1 returned / **0 refunded** (credited, Q2).
- **POS-2026-0001:** Charger Connector Lg V10: 2 / 3 600 / 2 / 3 600.
- **POS-2026-0002 (has a linked web account):** 3 products, sales only. Its web client has no
  completed order. The orders branch ran without error.
- `s."status"::text IN (${Prisma.join(statuses)})` with Prisma enum values matches
  `prisma.sale.count` (14 = 14). So the status lists are typed constants, not string literals
  (hard rule 1).

### 0.7 Findings (record them in the report)

- **F1 — no page could open one sale or one order from a link.** The sales page opens a sale only
  from a row click (`useSale(scope, reference)` exists). The orders page has no single-order fetch
  at all. The brief asks each drill row to link to the full document, so S36 adds two small,
  general-purpose deep links (Actions 4.2–4.4):
  - `/{scope}/sales?sale=<reference>` opens that sale's detail drawer;
  - `/{scope}/orders?search=<reference>` opens the orders list on **All**, filtered to that
    reference.

  No new endpoint is needed.
- **F2 — the sale-level discount is not apportioned to lines** (Q3). On a discounted sale, Σ of the
  tab's amounts exceeds the sale's `totalAmount` by the discount. The note under the table states
  it.
- **F3 — staff links to orders need the orders page.** A staff member without `STAFF_ORDERS` who
  clicks an order link is bounced by the existing `PageGuard`. Expected behaviour, not a bug.
- **F4 — the order deep link records a staff search.** Opening it pre-fills the orders search box,
  and `StaffOrders` audits every search (`useSendStaffSearch`). So following a link writes one
  staff-search log row with the reference. This is accepted: it is a real search of that
  reference.

### 0.8 Decisions this plan takes on its own (list them in the report)

| # | Decision | Why |
|---|---|---|
| P1 | **Two endpoints per identity:** the paginated product aggregate, and one product's documents (paginated). They are mounted three ways: admin by web-client id, admin by POS-client id, and staff by POS-client id. | The two lists have different row shapes and their own pagination. The documents list is fetched only when a row is clicked. A `?productId` switch on one endpoint would return two shapes from one route. The path style follows `CLIENT_ROUTES.ADMIN_OVERVIEW` (`/admin/clients/:id/overview`). |
| P2 | **One SQL core** in `ClientsService`, fed by `{ posClientId \| null, clientId \| null }`. Two thin public methods per list resolve the identities first: the web id → its `posClientId`, or the POS id → its linked `Client.id`. A missing client or POS client gives a 404. A product never bought gives an empty page, not a 404. | One query for every entry point, so the admin page and the drawer can never disagree. |
| P3 | The aggregation is **one `GROUP BY` over a `UNION ALL` of sale lines and order lines**, with `LIMIT/OFFSET` in SQL. Returns are pre-aggregated **per line** in a sub-query before the join, so a line with two return rows is never double-counted. A separate `COUNT(DISTINCT "productId")` gives the total. | The brief's SQL requirement, and the 1 GB machine rule. A naive join of return lines to lines would multiply quantities. |
| P4 | Product rows are ordered by **most recently bought first**, then name. They show the **current** `Product.name`. | The most recent purchases come first. Grouping is by `productId`, so one current name per product is the stable label. The document lines keep their own snapshots, but the tab doesn't show them. |
| P5 | Page sizes: products **10**, documents **10**, `limit` max 100. | Bounded results. It fits the drawer. |
| P6 | Document rows are ordered **newest first**. A return row carries its source document (sale or order reference), and its link opens that source. | "Each row links through to the full sale or order." A return has no page of its own. Its source document's drawer lists it (sales have a Returns tab). |
| P7 | The drawer is widened from `sm:max-w-lg` to `sm:max-w-2xl`. | A five-column table doesn't fit 512 px. |
| P8 | The web side uses **one component** (`ClientPurchasedProductsTab`) and **one hook pair**, keyed by a web-only owner type `{ kind: "client", id } \| { kind: "posClient", scope, id }`. | The admin page and the drawer render the same tab. The owner type is a single-side type, so it lives in `Apps/web/src/types` (hard rule 1). |
| P9 | **No query invalidation is wired** for the new keys. | The tab mounts only when opened (Radix unmounts inactive `TabsContent`), and React Query's default `staleTime: 0` refetches on every mount. |
| P10 | **No new index.** | Every branch filters on an indexed or small-table key (`Order.clientId` is indexed; the sales of one POS client are few). Revisit only if it gets slow. |

---

## §1 — Contract (`Apps/contract/src/modules/clients`)

### Action 1.1 — `clients.enums.ts`

Add:

```ts
// S36 — the kind of a row in a client's purchase-history documents list ("Products bought" tab).
export enum PurchaseDocumentKind {
  SALE = 'SALE',
  ORDER = 'ORDER',
  RETURN = 'RETURN',
}
```

### Action 1.2 — `clients.routes.ts`

1. In `CLIENT_ROUTES`, after `ADMIN_OVERVIEW`, add:
   ```ts
  // S36 — the "Products bought" tab (admin client page): paginated per-product aggregate, and the
  // documents behind one product. Keyed by the web Client id.
  ADMIN_PURCHASED_PRODUCTS: '/admin/clients/:id/purchased-products',
  ADMIN_PURCHASED_PRODUCT_DOCUMENTS: '/admin/clients/:id/purchased-products/:productId',
   ```
2. In `POS_CLIENT_ROUTES`, after `STAFF_BY_ID`, add:
   ```ts
  // S36 — the same tab in the POS-client drawer (both scopes), keyed by the PosClient id.
  ADMIN_PURCHASED_PRODUCTS: '/admin/pos-clients/:id/purchased-products',
  ADMIN_PURCHASED_PRODUCT_DOCUMENTS: '/admin/pos-clients/:id/purchased-products/:productId',
  STAFF_PURCHASED_PRODUCTS: '/staff/pos-clients/:id/purchased-products',
  STAFF_PURCHASED_PRODUCT_DOCUMENTS: '/staff/pos-clients/:id/purchased-products/:productId',
   ```

### Action 1.3 — `clients.query.ts`

Add:

```ts
// S36 — the "Products bought" tab: both lists are paginated server-side (bounded, max 100).
export const PurchasedProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
export type PurchasedProductsQuery = z.infer<typeof PurchasedProductsQuerySchema>;

// `id` is the web Client id or the PosClient id, depending on the route (S36).
export const PurchasedProductParamsSchema = z.object({ id: z.uuid(), productId: z.uuid() });
export type PurchasedProductParams = z.infer<typeof PurchasedProductParamsSchema>;
```

### Action 1.4 — `clients.dtos.ts`

Import `PurchaseDocumentKind` from `./clients.enums`, then add:

```ts
// S36 — one product a client bought, aggregated over their completed POS sales and completed
// online orders (never repair parts). Amounts are the stored line totals (before any sale-level
// discount, owner Q3). Returns are shown separately, never netted: `amountRefunded` is the cash
// handed back (Σ ReturnLine.refundAmount, owner Q2) — a return credited to the client's account
// adds to `quantityReturned` and 0 here. No cost or profit, for admin and staff alike.
export const PurchasedProductResponseSchema = z.object({
  productId: z.uuid(),
  productName: z.string(),
  quantityBought: z.number().int(),
  totalAmount: z.number(),
  quantityReturned: z.number().int(),
  amountRefunded: z.number(),
  lastBoughtAt: z.iso.datetime(),
});
export type PurchasedProductDto = z.infer<typeof PurchasedProductResponseSchema>;

// S36 — one document behind a purchased product. SALE/ORDER rows: the line's own quantity,
// unitPrice and lineTotal (`amount`). RETURN rows: returned quantity and refunded cash (`amount`),
// with the sale/order they came from in `sourceKind`/`sourceReference` (the row links to it).
export const PurchasedProductDocumentResponseSchema = z.object({
  kind: z.enum(PurchaseDocumentKind),
  documentId: z.uuid(),
  reference: z.string(),
  at: z.iso.datetime(),
  quantity: z.number().int(),
  unitPrice: z.number().optional(),
  amount: z.number(),
  sourceKind: z.enum([PurchaseDocumentKind.SALE, PurchaseDocumentKind.ORDER]).optional(),
  sourceReference: z.string().optional(),
});
export type PurchasedProductDocumentDto = z.infer<typeof PurchasedProductDocumentResponseSchema>;
```

Make sure `index.ts` re-exports enums, routes, query and dtos (it does). Run
`npx tsc --noEmit && npm run lint` in `Apps/contract`.

---

## §2 — API (`Apps/api/src/modules/clients`)

### Action 2.1 — `clients.service.ts`: constants

`Prisma` is already a value import here. Add `SaleStatus as PrismaSaleStatus` and
`OrderStatus as PrismaOrderStatus` to the existing `@prisma/client` value import. Then add, at
module level:

```ts
// S36 — what counts as "bought" in a client's purchase history. Sales: confirmed, including those
// that later saw a return (statistics' SALE_RECOGNIZED_STATUSES) — drafts and cancelled sales are
// out. Orders: COMPLETED or RETURNED *and* deliveredAt set — deliveredAt is stamped only at
// COMPLETED, so an order RETURNED straight from IN_DELIVERY (nothing consumed or invoiced) is out.
const PURCHASE_SALE_STATUSES = [PrismaSaleStatus.COMPLETED, PrismaSaleStatus.PARTIALLY_RETURNED, PrismaSaleStatus.RETURNED];
const PURCHASE_ORDER_STATUSES = [PrismaOrderStatus.COMPLETED, PrismaOrderStatus.RETURNED];

type PurchaseIdentities = { posClientId: string | null; clientId: string | null };
```

### Action 2.2 — `clients.service.ts`: identity resolution and the four public methods

Add a `// --- Purchase history (S36) ---` block:

```ts
  // S36 — both identities from either side (Client.posClientId is a unique FK). 404 when the
  // starting row doesn't exist; a missing other side just omits that branch.
  private async purchaseIdentitiesFromClient(clientId: string): Promise<PurchaseIdentities> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { id: true, posClientId: true } });
    if (!client) throw new NotFoundError('Client');
    return { posClientId: client.posClientId, clientId: client.id };
  }

  private async purchaseIdentitiesFromPosClient(posClientId: string): Promise<PurchaseIdentities> {
    const posClient = await this.prisma.posClient.findUnique({
      where: { id: posClientId },
      select: { id: true, linkedClient: { select: { id: true } } },
    });
    if (!posClient) throw new NotFoundError('PosClient');
    return { posClientId: posClient.id, clientId: posClient.linkedClient?.id ?? null };
  }

  async listClientPurchasedProducts(clientId: string, query: PurchasedProductsQuery): Promise<PaginatedResult<PurchasedProductDto>> {
    return this.purchasedProductsPage(await this.purchaseIdentitiesFromClient(clientId), query);
  }

  async listPosClientPurchasedProducts(posClientId: string, query: PurchasedProductsQuery): Promise<PaginatedResult<PurchasedProductDto>> {
    return this.purchasedProductsPage(await this.purchaseIdentitiesFromPosClient(posClientId), query);
  }

  async listClientPurchasedProductDocuments(
    clientId: string,
    productId: string,
    query: PurchasedProductsQuery,
  ): Promise<PaginatedResult<PurchasedProductDocumentDto>> {
    return this.purchasedProductDocumentsPage(await this.purchaseIdentitiesFromClient(clientId), productId, query);
  }

  async listPosClientPurchasedProductDocuments(
    posClientId: string,
    productId: string,
    query: PurchasedProductsQuery,
  ): Promise<PaginatedResult<PurchasedProductDocumentDto>> {
    return this.purchasedProductDocumentsPage(await this.purchaseIdentitiesFromPosClient(posClientId), productId, query);
  }
```

### Action 2.3 — `clients.service.ts`: the aggregate (validated SQL)

```ts
  // S36 — every product the client bought: one GROUP BY over a UNION ALL of sale lines (via the POS
  // identity) and order lines (via the web identity), paginated in SQL — no line is loaded into
  // memory (1 GB machine). Returns are pre-aggregated PER LINE before the join, so a line returned
  // in two goes is never double-counted. A missing identity omits its branch (Prisma.empty), so a
  // walk-in POS client (sales only) and a web client with no POS identity (orders only) both work.
  private async purchasedProductsPage(ids: PurchaseIdentities, query: PurchasedProductsQuery): Promise<PaginatedResult<PurchasedProductDto>> {
    const branches: Prisma.Sql[] = [];
    if (ids.posClientId != null) {
      branches.push(Prisma.sql`
        SELECT sl."productId" AS "productId", sl."quantity" AS qty, sl."lineTotal" AS amount,
               COALESCE(rs.qty, 0) AS rqty, COALESCE(rs.refund, 0) AS refund, s."soldAt" AS at
        FROM "SaleLine" sl
        JOIN "Sale" s ON s."id" = sl."saleId"
        LEFT JOIN (SELECT rl."saleLineId" AS lid, SUM(rl."quantity") AS qty, SUM(rl."refundAmount") AS refund
                   FROM "ReturnLine" rl WHERE rl."saleLineId" IS NOT NULL GROUP BY rl."saleLineId") rs ON rs.lid = sl."id"
        WHERE s."posClientId" = ${ids.posClientId} AND s."status"::text IN (${Prisma.join(PURCHASE_SALE_STATUSES)})`);
    }
    if (ids.clientId != null) {
      branches.push(Prisma.sql`
        SELECT ol."productId", ol."quantity", ol."lineTotal", COALESCE(ro.qty, 0), COALESCE(ro.refund, 0), o."deliveredAt"
        FROM "OrderLine" ol
        JOIN "Order" o ON o."id" = ol."orderId"
        LEFT JOIN (SELECT rl."orderLineId" AS lid, SUM(rl."quantity") AS qty, SUM(rl."refundAmount") AS refund
                   FROM "ReturnLine" rl WHERE rl."orderLineId" IS NOT NULL GROUP BY rl."orderLineId") ro ON ro.lid = ol."id"
        WHERE o."clientId" = ${ids.clientId} AND o."status"::text IN (${Prisma.join(PURCHASE_ORDER_STATUSES)})
          AND o."deliveredAt" IS NOT NULL`);
    }
    const empty = { page: query.page, limit: query.limit, total: 0, totalPages: 0 };
    if (branches.length === 0) return paginated(PurchasedProductResponseSchema).parse({ items: [], meta: empty });

    const bought = Prisma.join(branches, ' UNION ALL ');
    const [rows, counted] = await Promise.all([
      this.prisma.$queryRaw<
        { productId: string; productName: string; quantityBought: number; totalAmount: Prisma.Decimal; quantityReturned: number; amountRefunded: Prisma.Decimal; lastBoughtAt: Date }[]
      >`
        WITH bought AS (${bought})
        SELECT b."productId", p."name" AS "productName",
               SUM(b.qty)::int AS "quantityBought", SUM(b.amount) AS "totalAmount",
               SUM(b.rqty)::int AS "quantityReturned", SUM(b.refund) AS "amountRefunded",
               MAX(b.at) AS "lastBoughtAt"
        FROM bought b JOIN "Product" p ON p."id" = b."productId"
        GROUP BY b."productId", p."name"
        ORDER BY MAX(b.at) DESC, p."name" ASC
        LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
      this.prisma.$queryRaw<{ total: number }[]>`WITH bought AS (${bought}) SELECT COUNT(DISTINCT "productId")::int AS total FROM bought`,
    ]);
    const total = counted[0]?.total ?? 0;

    return paginated(PurchasedProductResponseSchema).parse({
      items: rows.map((row) => ClientsMapper.toPurchasedProductDto(row)),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }
```

Notes for the executor:
- Money columns come back as `Prisma.Decimal` (numeric). The mapper converts them.
- `SUM(int)` is bigint in Postgres, so the casts to `::int` are required.
- `paginated` and the new schemas come from `@dragon-telecom/contract`. Check whether `paginated`
  is already imported in this file (it is used by `listPosClients`).

### Action 2.4 — `clients.service.ts`: one product's documents (validated SQL)

```ts
  // S36 — the documents behind one purchased product: each sale/order line that contained it, and
  // each return of it, as their own rows (never netted), newest first, paginated in SQL. Same
  // population rules and identity branches as purchasedProductsPage. A return row carries the
  // sale/order it came from (the web links it there — a return has no page of its own).
  private async purchasedProductDocumentsPage(
    ids: PurchaseIdentities,
    productId: string,
    query: PurchasedProductsQuery,
  ): Promise<PaginatedResult<PurchasedProductDocumentDto>> {
    const branches: Prisma.Sql[] = [];
    if (ids.posClientId != null) {
      branches.push(Prisma.sql`
        SELECT ${PurchaseDocumentKind.SALE}::text AS kind, s."id" AS "documentId", s."reference", s."soldAt" AS at,
               sl."quantity", sl."unitPrice" AS "unitPrice", sl."lineTotal" AS amount,
               NULL::text AS "sourceKind", NULL::text AS "sourceReference"
        FROM "SaleLine" sl JOIN "Sale" s ON s."id" = sl."saleId"
        WHERE sl."productId" = ${productId} AND s."posClientId" = ${ids.posClientId}
          AND s."status"::text IN (${Prisma.join(PURCHASE_SALE_STATUSES)})`);
      branches.push(Prisma.sql`
        SELECT ${PurchaseDocumentKind.RETURN}::text, r."id", r."reference", r."returnedAt",
               rl."quantity", NULL::numeric, rl."refundAmount",
               ${PurchaseDocumentKind.SALE}::text, s."reference"
        FROM "ReturnLine" rl
        JOIN "Return" r ON r."id" = rl."returnId"
        JOIN "SaleLine" sl ON sl."id" = rl."saleLineId"
        JOIN "Sale" s ON s."id" = sl."saleId"
        WHERE sl."productId" = ${productId} AND s."posClientId" = ${ids.posClientId}
          AND s."status"::text IN (${Prisma.join(PURCHASE_SALE_STATUSES)})`);
    }
    if (ids.clientId != null) {
      branches.push(Prisma.sql`
        SELECT ${PurchaseDocumentKind.ORDER}::text, o."id", o."reference", o."deliveredAt",
               ol."quantity", ol."unitPrice", ol."lineTotal", NULL::text, NULL::text
        FROM "OrderLine" ol JOIN "Order" o ON o."id" = ol."orderId"
        WHERE ol."productId" = ${productId} AND o."clientId" = ${ids.clientId}
          AND o."status"::text IN (${Prisma.join(PURCHASE_ORDER_STATUSES)}) AND o."deliveredAt" IS NOT NULL`);
      branches.push(Prisma.sql`
        SELECT ${PurchaseDocumentKind.RETURN}::text, r."id", r."reference", r."returnedAt",
               rl."quantity", NULL::numeric, rl."refundAmount",
               ${PurchaseDocumentKind.ORDER}::text, o."reference"
        FROM "ReturnLine" rl
        JOIN "Return" r ON r."id" = rl."returnId"
        JOIN "OrderLine" ol ON ol."id" = rl."orderLineId"
        JOIN "Order" o ON o."id" = ol."orderId"
        WHERE ol."productId" = ${productId} AND o."clientId" = ${ids.clientId}
          AND o."status"::text IN (${Prisma.join(PURCHASE_ORDER_STATUSES)}) AND o."deliveredAt" IS NOT NULL`);
    }
    if (branches.length === 0) {
      return paginated(PurchasedProductDocumentResponseSchema).parse({
        items: [],
        meta: { page: query.page, limit: query.limit, total: 0, totalPages: 0 },
      });
    }
    const docs = Prisma.join(branches, ' UNION ALL ');
    const [rows, counted] = await Promise.all([
      this.prisma.$queryRaw<
        { kind: string; documentId: string; reference: string; at: Date; quantity: number; unitPrice: Prisma.Decimal | null; amount: Prisma.Decimal; sourceKind: string | null; sourceReference: string | null }[]
      >`SELECT * FROM (${docs}) d ORDER BY d.at DESC, d."reference" DESC LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
      this.prisma.$queryRaw<{ total: number }[]>`SELECT COUNT(*)::int AS total FROM (${docs}) d`,
    ]);
    const total = counted[0]?.total ?? 0;

    return paginated(PurchasedProductDocumentResponseSchema).parse({
      items: rows.map((row) => ClientsMapper.toPurchasedProductDocumentDto(row)),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }
```

Notes for the executor:
- Column names come from the **first** branch of a `UNION ALL`. Keep the SALE branch first when it
  exists. When only order branches exist, give the ORDER branch the same aliases as the SALE
  branch: `AS kind`, `AS "documentId"`, `AS at`, `AS "unitPrice"`, `AS amount`,
  `AS "sourceKind"`, `AS "sourceReference"`. The simplest safe rule: **alias every column in
  every branch.**
- `PurchaseDocumentKind` is a contract value import.
- The return-row filters repeat the parent's status filter, so a return of a draft or cancelled
  document can't appear. That can't happen today, but the filter keeps the two lists consistent.

### Action 2.5 — `clients.mapper.ts`

Add two mappers. `Number(...)` converts a Decimal. Use the existing `toNumber()` helper if the
mapper has one, otherwise `Number(x)`:

```ts
  // S36 — no cost/profit fields exist on these rows at all; nothing to strip.
  static toPurchasedProductDto(row: {
    productId: string; productName: string; quantityBought: number; totalAmount: Prisma.Decimal;
    quantityReturned: number; amountRefunded: Prisma.Decimal; lastBoughtAt: Date;
  }): PurchasedProductDto {
    return {
      productId: row.productId,
      productName: row.productName,
      quantityBought: row.quantityBought,
      totalAmount: Number(row.totalAmount),
      quantityReturned: row.quantityReturned,
      amountRefunded: Number(row.amountRefunded),
      lastBoughtAt: row.lastBoughtAt.toISOString(),
    };
  }

  static toPurchasedProductDocumentDto(row: {
    kind: string; documentId: string; reference: string; at: Date; quantity: number;
    unitPrice: Prisma.Decimal | null; amount: Prisma.Decimal; sourceKind: string | null; sourceReference: string | null;
  }): PurchasedProductDocumentDto {
    return {
      kind: row.kind as PurchaseDocumentKind,
      documentId: row.documentId,
      reference: row.reference,
      at: row.at.toISOString(),
      quantity: row.quantity,
      ...(row.unitPrice != null ? { unitPrice: Number(row.unitPrice) } : {}),
      amount: Number(row.amount),
      ...(row.sourceKind != null ? { sourceKind: row.sourceKind as PurchaseDocumentKind.SALE | PurchaseDocumentKind.ORDER } : {}),
      ...(row.sourceReference != null ? { sourceReference: row.sourceReference } : {}),
    };
  }
```

`paginated(...).parse` in the service validates the enum values at runtime.

### Action 2.6 — `clients.interface.ts`

Add the four public methods to `IClientsService`, with the same signatures as Action 2.2.

### Action 2.7 — `clients.controller.ts`

Add four handlers in the `getClientOverview` shape:

- `listClientPurchasedProducts`: params `ClientIdParams`, query `PurchasedProductsQuery`.
- `listClientPurchasedProductDocuments`: params `PurchasedProductParams`, query
  `PurchasedProductsQuery`.
- `listPosClientPurchasedProducts`: params `PosClientIdParams`.
- `listPosClientPurchasedProductDocuments`: params `PurchasedProductParams`.

Each one calls the matching service method and returns `sendSuccess(..., 200)`. The controller has
no logic.

### Action 2.8 — `clients.routes.ts`

Import `PurchasedProductParamsSchema` and `PurchasedProductsQuerySchema`. Register the documents
route **before** its parent, by habit (the S33 precedent):

```ts
// S36 — the "Products bought" tab. Admin client page (web Client id):
router.get(CLIENT_ROUTES.ADMIN_PURCHASED_PRODUCT_DOCUMENTS, adminOnly,
  validateRequest({ params: PurchasedProductParamsSchema, query: PurchasedProductsQuerySchema }), controller.listClientPurchasedProductDocuments);
router.get(CLIENT_ROUTES.ADMIN_PURCHASED_PRODUCTS, adminOnly,
  validateRequest({ params: ClientIdParamsSchema, query: PurchasedProductsQuerySchema }), controller.listClientPurchasedProducts);
// POS-client drawer, both scopes (PosClient id). Staff see the client's WHOLE history, every seller
// (owner Q1) — no margins are in it.
router.get(POS_CLIENT_ROUTES.ADMIN_PURCHASED_PRODUCT_DOCUMENTS, adminOnly,
  validateRequest({ params: PurchasedProductParamsSchema, query: PurchasedProductsQuerySchema }), controller.listPosClientPurchasedProductDocuments);
router.get(POS_CLIENT_ROUTES.ADMIN_PURCHASED_PRODUCTS, adminOnly,
  validateRequest({ params: PosClientIdParamsSchema, query: PurchasedProductsQuerySchema }), controller.listPosClientPurchasedProducts);
router.get(POS_CLIENT_ROUTES.STAFF_PURCHASED_PRODUCT_DOCUMENTS, staffPosClientsOrAdmin,
  validateRequest({ params: PurchasedProductParamsSchema, query: PurchasedProductsQuerySchema }), controller.listPosClientPurchasedProductDocuments);
router.get(POS_CLIENT_ROUTES.STAFF_PURCHASED_PRODUCTS, staffPosClientsOrAdmin,
  validateRequest({ params: PosClientIdParamsSchema, query: PurchasedProductsQuerySchema }), controller.listPosClientPurchasedProducts);
```

Express matches by method and full path. `/staff/pos-clients/:id/purchased-products` can't collide
with `PATCH /staff/pos-clients/:id` or `GET /staff/pos-clients/search`, because the segment counts
differ. Format the routes as the file's prettier style prefers.

Run `npx tsc --noEmit && npm run lint` in `Apps/api`.

---

## §3 — Web data layer (`Apps/web/src`)

### Action 3.1 — new `types/purchase-history.types.ts`

```ts
import type { PosClientsScope } from "@/services/clients.service";

// S36 — whose purchase history the "Products bought" tab shows. The admin client page starts from
// the web Client id; the POS-client drawer (both scopes) from the PosClient id. The API resolves
// the other identity itself, so both render the same aggregate.
export type PurchaseHistoryOwner =
  | { kind: "client"; id: string }
  | { kind: "posClient"; scope: PosClientsScope; id: string };
```

If importing a type from a service into `types` creates a cycle that eslint flags, declare the
scope inline as `"staff" | "admin"` instead.

### Action 3.2 — `services/clients.service.ts`

Add these, importing the new contract types and `PurchaseHistoryOwner`:

```ts
// S36 — the "Products bought" tab: route chosen by whose history it is (admin client page vs the
// POS-client drawer in either scope).
function purchasedProductsRoute(owner: PurchaseHistoryOwner, documents: boolean): string {
  if (owner.kind === "client") {
    return documents ? CLIENT_ROUTES.ADMIN_PURCHASED_PRODUCT_DOCUMENTS : CLIENT_ROUTES.ADMIN_PURCHASED_PRODUCTS;
  }
  if (owner.scope === "admin") {
    return documents ? POS_CLIENT_ROUTES.ADMIN_PURCHASED_PRODUCT_DOCUMENTS : POS_CLIENT_ROUTES.ADMIN_PURCHASED_PRODUCTS;
  }
  return documents ? POS_CLIENT_ROUTES.STAFF_PURCHASED_PRODUCT_DOCUMENTS : POS_CLIENT_ROUTES.STAFF_PURCHASED_PRODUCTS;
}

export async function listPurchasedProducts(
  owner: PurchaseHistoryOwner,
  query: PurchasedProductsQuery,
): Promise<PaginatedResult<PurchasedProductDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<PurchasedProductDto>>>(
    withParams(apiPath(purchasedProductsRoute(owner, false)), { id: owner.id }),
    { params: query },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function listPurchasedProductDocuments(
  owner: PurchaseHistoryOwner,
  productId: string,
  query: PurchasedProductsQuery,
): Promise<PaginatedResult<PurchasedProductDocumentDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<PurchasedProductDocumentDto>>>(
    withParams(apiPath(purchasedProductsRoute(owner, true)), { id: owner.id, productId }),
    { params: query },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
```

Match the file's existing import style for `api`, `apiPath`, `withParams`, `CLIENT_ROUTES` and
`POS_CLIENT_ROUTES`.

### Action 3.3 — `lib/query-keys.ts`

Add a top-level group next to `posClients`:

```ts
  // S36 — the "Products bought" tab; `owner` (PurchaseHistoryOwner) is part of every key so the admin
  // client page, the admin drawer and the staff drawer never share a cache entry.
  purchaseHistory: {
    all: () => ["purchase-history"] as const,
    products: (owner: unknown, query?: unknown) => ["purchase-history", "products", owner, query] as const,
    documents: (owner: unknown, productId: string, query?: unknown) =>
      ["purchase-history", "documents", owner, productId, query] as const,
  },
```

### Action 3.4 — new `hooks/usePurchaseHistory.ts`

```ts
import { useQuery } from "@tanstack/react-query";
import type { PurchasedProductsQuery } from "@dragon-telecom/contract";
import * as clientsService from "@/services/clients.service";
import { qk } from "@/lib/query-keys";
import type { PurchaseHistoryOwner } from "@/types/purchase-history.types";

// S36 — no invalidation is wired: the tab mounts only when opened (inactive TabsContent unmounts)
// and the default staleTime of 0 refetches on every mount.
export function usePurchasedProducts(owner: PurchaseHistoryOwner, query: PurchasedProductsQuery) {
  return useQuery({
    queryKey: qk.purchaseHistory.products(owner, query),
    queryFn: () => clientsService.listPurchasedProducts(owner, query),
    enabled: !!owner.id,
  });
}

export function usePurchasedProductDocuments(
  owner: PurchaseHistoryOwner,
  productId: string | null,
  query: PurchasedProductsQuery,
) {
  return useQuery({
    queryKey: qk.purchaseHistory.documents(owner, productId ?? "", query),
    queryFn: () => clientsService.listPurchasedProductDocuments(owner, productId!, query),
    enabled: !!owner.id && !!productId,
  });
}
```

---

## §4 — Deep links (F1)

### Action 4.1 — new `lib/deep-links.ts`

```ts
// S36 — links that open one sale or one order from elsewhere (the "Products bought" documents).
// The sales page opens that sale's detail drawer; the orders page opens on All, searched to that
// reference (there is no single-order endpoint — the list's reference search finds it).
export type BackofficeScope = "staff" | "admin";

export const SALE_DEEP_LINK_PARAM = "sale";
export const ORDER_SEARCH_DEEP_LINK_PARAM = "search";

export const saleDeepLink = (scope: BackofficeScope, reference: string): string =>
  `/${scope}/sales?${SALE_DEEP_LINK_PARAM}=${encodeURIComponent(reference)}`;

export const orderDeepLink = (scope: BackofficeScope, reference: string): string =>
  `/${scope}/orders?${ORDER_SEARCH_DEEP_LINK_PARAM}=${encodeURIComponent(reference)}`;
```

### Action 4.2 — `pages/staff/sales/StaffSales.tsx`

1. Import `useSearchParams` from `react-router-dom` and `SALE_DEEP_LINK_PARAM` from
   `@/lib/deep-links`.
2. Add `const [searchParams, setSearchParams] = useSearchParams();`.
3. Seed the selected sale from the link:
   `const [selectedReference, setSelectedReference] = useState<string | null>(() => searchParams.get(SALE_DEEP_LINK_PARAM));`
4. Add a close handler and pass it to `SaleDetailDrawer`'s `onOpenChange`:
   ```ts
  // S36 — closing a deep-linked sale also drops ?sale= so a refresh doesn't reopen it.
  const closeSaleDrawer = () => {
    setSelectedReference(null);
    if (searchParams.has(SALE_DEEP_LINK_PARAM)) {
      setSearchParams((prev) => {
        prev.delete(SALE_DEEP_LINK_PARAM);
        return prev;
      }, { replace: true });
    }
  };
   ```
   Then use `onOpenChange={(open) => !open && closeSaleDrawer()}`.
5. Add one line to the header comment:
   `S36 — ?sale=<reference> opens that sale's drawer (lib/deep-links.ts); staff opening another seller's sale see the drawer's forbidden state.`

### Action 4.3 — `pages/staff/orders/StaffOrders.tsx`

1. Import `useSearchParams` and `ORDER_SEARCH_DEEP_LINK_PARAM`.
2. Seed the state from the link:
   ```ts
  // S36 — ?search=<reference> (lib/deep-links.ts) opens the list on All, searched to that order.
  const [searchParams] = useSearchParams();
  const linkedSearch = searchParams.get(ORDER_SEARCH_DEEP_LINK_PARAM) ?? "";
  const [status, setStatus] = useState<OrderStatus | undefined>(linkedSearch ? undefined : OrderStatus.PENDING);
  const [searchInput, setSearchInput] = useState(linkedSearch);
   ```
   This replaces the two existing `useState` lines for `status` and `searchInput`. Check that
   `OrderStatusTabs` renders `undefined` as **All**; `changeStatus(undefined)` already exists for
   that.

### Action 4.4 — note on the `/admin` twins

`AdminSales` and `AdminOrders` render `StaffSales` and `StaffOrders` with `scope="admin"`, so both
deep links work in both scopes with no extra change.

---

## §5 — The tab (`Apps/web/src/pages/admin/clients/components`)

### Action 5.1 — new `client-purchased-products-tab.tsx`

`ClientPurchasedProductsTab({ owner }: { owner: PurchaseHistoryOwner })`:

- **State:** `page` (start 1) and `selected: PurchasedProductDto | null`. The query is
  `useMemo(() => ({ page, limit: 10 }), [page])`, read through `usePurchasedProducts(owner, query)`.
- **Loading:** show `TableSkeleton rows={5} columns={5}`.
- **Error:** show `NotFoundState title={t("admin.clients.purchasedProducts.error")} body=""`.
- **Table:** a `DataTable` with these columns:
  - `productName`, header `admin.clients.purchasedProducts.product`;
  - `quantityBought`, header `.quantityBought`;
  - `totalAmount`, header `.totalAmount`, cell `formatDZD(…, language)`;
  - `quantityReturned`, header `.quantityReturned`;
  - `amountRefunded`, header `.amountRefunded`, cell `formatDZD`.
- **Row behaviour:** `getRowKey={(row) => row.productId}` and `onRowClick={setSelected}`.
- **Mobile row:** the product name, then
  `t("admin.clients.purchasedProducts.mobileSummary", { bought, returned })`, then the total amount.
- **Empty state:** an `EmptyState` with a `ShoppingBag` icon and title `.empty`.
- **Below the table:** `<p className="text-xs text-muted-foreground">{t("admin.clients.purchasedProducts.note")}</p>`
  (Q2/Q3).
- **Pager:** `SimplePagination` when `meta.totalPages > 1`.
- **Dialog:** `<PurchasedProductDocumentsDialog owner={owner} product={selected} onClose={() => setSelected(null)} />`.
- **Header comment:**
  `S36 — "Products bought": every product the client bought (completed POS sales + completed online orders, never repair parts), aggregated in SQL and paginated server-side. Returns shown separately, never netted. No cost/profit, on either side. Rows open the documents behind the product.`

### Action 5.2 — new `purchased-product-documents-dialog.tsx`

`PurchasedProductDocumentsDialog({ owner, product, onClose })`:

1. **State.** A `Dialog` open while `product != null`. It holds `page` state, reset to 1 when
   `product?.productId` changes (`useEffect`, the S33 drill-dialog precedent). It reads
   `usePurchasedProductDocuments(owner, product?.productId ?? null, { page, limit: 10 })`.
2. **Title.** `t("admin.clients.purchasedProducts.documents.title", { product: product.productName })`.
3. **Link scope.** `const linkScope: BackofficeScope = owner.kind === "client" ? "admin" : owner.scope;`
4. **Columns:**
   - **type:** `t` of `.documents.kind.sale|order|return`, keyed by `row.kind`. Use a
     `Record<PurchaseDocumentKind, string>` label map in this file.
   - **date:** `formatDateTime(row.at, language)`.
   - **reference:** a react-router `Link` to the document (see "Link targets" below), styled
     `font-mono text-sm text-primary hover:underline`. For a RETURN row, show the return's own
     `reference` with a muted second line `t(".documents.from", { reference: row.sourceReference })`.
   - **quantity**.
   - **unit price:** `row.unitPrice != null ? formatDZD(row.unitPrice) : "—"`.
   - **amount:** `formatDZD(row.amount)`. The header is `.documents.amount` ("Line total /
     refunded"). Render RETURN rows' amount as `text-destructive`.
5. **Link targets:**
   - SALE → `saleDeepLink(linkScope, row.reference)`;
   - ORDER → `orderDeepLink(linkScope, row.reference)`;
   - RETURN → the source document: `row.sourceKind === SALE ? saleDeepLink(linkScope, row.sourceReference!) : orderDeepLink(linkScope, row.sourceReference!)`.
6. **Rest of the dialog.** Loading shows a `TableSkeleton`. The empty state uses
   `.documents.empty`. Mobile row: type · date · reference · amount. `SimplePagination` appears
   when there is more than one page. The dialog's `max-w-3xl` follows the S33 drill dialog.
7. **Header comment:**
   `S36 — the documents behind one purchased product: each sale/order line that contained it and each return of it (own rows, newest first), from the stored line figures. Every row links to its sale or order (returns to the document they came from) via lib/deep-links.`

### Action 5.3 — `pages/admin/clients/AdminClientDetail.tsx`

1. Add a sixth `TabsTrigger value="purchased"` with the `ShoppingBag` icon and
   `t("admin.clients.detail.tabs.purchasedProducts")`. Change the `TabsList` class to
   `grid w-full grid-cols-3 lg:grid-cols-6`.
2. Add `<TabsContent value="purchased"><ClientPurchasedProductsTab owner={{ kind: "client", id }} /></TabsContent>`.
   `id` is already narrowed to a string after the not-found guard. Keep the owner object stable with
   `useMemo(() => ({ kind: "client", id: id ?? "" }) as const, [id])`, because it is part of the
   query key.
3. Add one line to the header comment:
   `S36 — sixth tab "Products bought" (ClientPurchasedProductsTab, keyed by this web Client id; the API also reads the linked POS client's sales).`

### Action 5.4 — `pages/admin/pos-clients/components/pos-client-detail-drawer.tsx`

1. Add a required prop `scope: "staff" | "admin"` with the doc comment
   `/** S36 — picks the Products-bought endpoints (and link scope) for this drawer. */`.
2. Change `SheetContent` to `className="w-full overflow-y-auto sm:max-w-2xl"` (P7).
3. Make the `TabsList` `grid-cols-4`. Add `TabsTrigger value="purchased"` with the `ShoppingBag`
   icon and `t("admin.posClients.detail.tabs.purchasedProducts")`.
4. Add `<TabsContent value="purchased"><ClientPurchasedProductsTab owner={owner} /></TabsContent>`
   with `const owner = useMemo(() => ({ kind: "posClient", scope, id: client?.id ?? "" }) as const, [scope, client?.id]);`.
   Declare it **before** the `if (!client) return null` early return (hooks rule).
5. Append to the header comment:
   `S36 — fourth tab "Products bought": the client's WHOLE purchase history (every seller — owner Q1; POS sales + the linked web account's orders), fetched only when the tab opens.`

### Action 5.5 — `pages/staff/pos-clients/StaffPosClients.tsx`

Pass `scope={scope}` to `<PosClientDetailDrawer …>`. Nothing else changes in this file.

### Action 5.6 — `config/translations.json`

Run the byte-safe round-trip check first (the S33–S35 precedent). Insert each key next to its
siblings, with `ar: ""`:

| Key | en | fr |
|---|---|---|
| `admin.clients.detail.tabs.purchasedProducts` | Products bought | Produits achetés |
| `admin.posClients.detail.tabs.purchasedProducts` | Products bought | Produits achetés |
| `admin.clients.purchasedProducts.product` | Product | Produit |
| `admin.clients.purchasedProducts.quantityBought` | Qty bought | Qté achetée |
| `admin.clients.purchasedProducts.totalAmount` | Total amount | Montant total |
| `admin.clients.purchasedProducts.quantityReturned` | Qty returned | Qté retournée |
| `admin.clients.purchasedProducts.amountRefunded` | Amount refunded | Montant remboursé |
| `admin.clients.purchasedProducts.mobileSummary` | {bought} bought · {returned} returned | {bought} acheté(s) · {returned} retourné(s) |
| `admin.clients.purchasedProducts.empty` | This client hasn't bought any product yet | Ce client n'a encore acheté aucun produit |
| `admin.clients.purchasedProducts.error` | Couldn't load the purchase history | Impossible de charger l'historique d'achats |
| `admin.clients.purchasedProducts.note` | Amounts are the line totals as sold, before any discount on the whole sale. "Refunded" is the cash handed back; a return credited to the client's account shows 0. | Les montants sont les totaux de ligne tels que vendus, avant toute remise sur la vente entière. « Remboursé » est l'argent rendu ; un retour porté au crédit du client affiche 0. |
| `admin.clients.purchasedProducts.documents.title` | {product} — documents | {product} — documents |
| `admin.clients.purchasedProducts.documents.type` | Type | Type |
| `admin.clients.purchasedProducts.documents.date` | Date | Date |
| `admin.clients.purchasedProducts.documents.reference` | Reference | Référence |
| `admin.clients.purchasedProducts.documents.quantity` | Quantity | Quantité |
| `admin.clients.purchasedProducts.documents.unitPrice` | Unit price | Prix unitaire |
| `admin.clients.purchasedProducts.documents.amount` | Line total / refunded | Total ligne / remboursé |
| `admin.clients.purchasedProducts.documents.from` | From {reference} | Depuis {reference} |
| `admin.clients.purchasedProducts.documents.empty` | No documents | Aucun document |
| `admin.clients.purchasedProducts.documents.kind.sale` | Sale | Vente |
| `admin.clients.purchasedProducts.documents.kind.order` | Order | Commande |
| `admin.clients.purchasedProducts.documents.kind.return` | Return | Retour |

---

## §6 — Conception docs (`Docs/Stage-00-Conception`)

1. `Module-Contracts/clients.md`: add route rows for the six new paths (admin client, admin
   POS-client and staff POS-client, each with a documents twin). In Business Logic, add the §0.5
   rules: the population, returns never netted, cash refunded, stored line totals, and the SQL
   aggregation with per-line return sub-queries.
2. `Pages-Requirements/ADM-12b-client-detail.md`: add the **Products bought** tab (columns, drill
   dialog, links, note).
3. `Pages-Requirements/ADM-11-pos-clients.md`: add the drawer's fourth tab (both scopes, whole
   history), the wider drawer, and the data dependencies
   (`usePurchasedProducts`/`usePurchasedProductDocuments` → `['purchase-history', …]`).

---

## §7 — Validation gate

No test file may be read for editing, edited or run. From the repo root:

```bash
cd Apps/contract && npx tsc --noEmit && npm run lint
cd ../api      && npx tsc --noEmit && npm run lint
cd ../web      && npx tsc --noEmit && npx eslint <every file this set touched or created>
```

**Baselines** (S35): api `src` 0 errors, whole project 198 errors in 29 files; api lint 7
pre-existing errors; web `tsc -p tsconfig.test.json` 52 errors. Report any drift.
`PosClientDetailDrawer` gains a required `scope` prop, so a test rendering it without one may now
fail to compile. **Do not edit it.** List it.

**Grep sweeps:**
- `grep -rn "'COMPLETED'\|'RETURNED'\|'PARTIALLY_RETURNED'" Apps/api/src/modules/clients` → none.
  The statuses come from the Prisma enum constants.
- `grep -rn "costOfGoods\|profit\|totalCost" <the S36 block of clients.service.ts and the two new web components>`
  → none.
- `grep -rn "repairPart\|RepairPart" <the S36 block>` → none (parts excluded).
- `grep -rn "\"/admin/sales?\|\"/staff/sales?\|/orders?search" Apps/web/src/pages` → none. Links go
  through `lib/deep-links.ts`.

**Read-only smoke run (recommended, the S33–S35 precedent):** write a throwaway
`Apps/api/src/__probe.ts` that calls the four service methods through the exported
`clientsService`. Check:
- the dev figures in §0.6;
- that page 2 continues page 1 with no overlap;
- that `total` equals the row count across all pages;
- that, for one product, `quantityBought` equals Σ SALE/ORDER document quantities, and
  `quantityReturned`/`amountRefunded` equal Σ RETURN document quantities/amounts;
- that a POS client with no web account and a web client's id both answer without error.

Delete the probe afterwards. Run `set -a; . ./.env; set +a` first, and don't override `LOG_LEVEL`.

---

## §8 — Manual verification checklist (browser)

The dev data already holds useful cases (§0.6). Signed in as **admin**:

### A. POS-client drawer (admin)
1. Open `/admin/pos-clients` and click **POS-2026-0003**. The drawer is wider and has a fourth tab,
   **Products bought**. Open it. The rows read, newest purchase first:
   - Battery Samsung S24 ultra: **1 bought, 8 500, 1 returned, 0 refunded**;
   - Display Redmi K20: **2, 21 000, 1, 10 500**;
   - Display Lg V20: **1, 18 000, 1, 18 000**;
   - Motherboard Iphone 13 pro: **1, 20 000, 0, 0**.

   The note under the table explains the "0 refunded" row.
2. **Cross-check against the documents.** Click **Display Redmi K20**. The dialog lists its sale
   line(s) with date, reference, quantity, unit price and line total, plus a **Return** row with
   its own reference, "From SAL-…" and 10 500. The line totals add up to 21 000, and the return
   amounts add up to 10 500.
3. Click the sale reference. You land on `/admin/sales` with **that sale's drawer open**. Its line
   for the product shows the same unit price and quantity. Its returns (the sales page's
   **Returns** tab) show the same refund. Close the drawer: the URL loses `?sale=`, and refreshing
   doesn't reopen it.
4. Back on the client, open **Battery Samsung S24 ultra**. The Return row shows **0**. In the sale's
   detail, the return's refund is 0, and the client's **Credit history** shows the credited amount
   instead (S32). Returned 1, refunded 0, never "0 bought".
5. **POS-2026-0001** (a walk-in with no web account) works: Charger Connector Lg V10 reads
   **2 bought, 3 600, 2 returned, 3 600 refunded**. It never reads "0".
6. **Total cross-check:** for one client, add up the **Total amount** column across all pages.
   Open the drawer's **Sales** tab and add up those sales' totals. The two sums are equal when
   none of the client's sales had a sale-level discount. Otherwise the tab's sum is higher by
   exactly the sum of those discounts (Q3, F2).
7. **Repricing:** in `/admin/products`, change the price of a product this client bought, then
   reopen the tab. Its amounts and unit prices are unchanged. Restore the price.
8. Make a **draft** sale (don't confirm) for the client with a new product. It does **not** appear.
   Confirm it: it appears at the top. Repair parts used on the client's repairs never appear.

### B. Admin client page (web identity)
9. Open `/admin/clients`, then the client linked to **POS-2026-0002**. The new **Products bought**
   tab shows the same three products as that POS client's drawer, with the same figures, because
   both resolve the same two identities.
10. If you complete an **online order** for this web client, its products appear here and in the
    POS-client drawer. The drill shows an **Order** row whose link opens `/admin/orders` on **All**,
    searched to that reference. An order still `IN_DELIVERY`, or one returned before completion,
    never appears.
11. Open a web client who was **never approved** (no POS client). The tab shows the empty state,
    with no error.

### C. Staff
12. Sign in as a staff user holding **POS clients**. Open `/staff/pos-clients` → **POS-2026-0003**
    → **Products bought**. The figures are the same as admin's, from every seller (Q1). The tab has
    no cost or profit column, and neither does the dialog. In the Network tab, the
    `purchased-products` response has no cost or profit field.
13. Click a sale reference sold by **another** staff member. `/staff/sales` opens the drawer with
    the existing "not allowed" message. Your own sales open normally.
14. A staff user **without** the orders page who clicks an order link is sent away by the page
    guard (F3).

---

## §9 — Execution protocol

Execute this set, then write `Docs/Stage-04-Fixes/results/report-S36.md`. The report covers:
- what changed, file by file;
- Q1–Q3, P1–P10 and F1–F4;
- the gate outputs against the baselines, including any drifted test file, unedited;
- the smoke-run figures.

It ends with the §8 verification checklist. **Stop there** for the owner's review. Do not commit
unless asked.
