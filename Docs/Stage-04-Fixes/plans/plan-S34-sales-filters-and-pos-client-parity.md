# Plan S34 — Sales filters & POS-client parity

Execution plan for **set 34** of `Docs/Stage-04-Fixes/sets-34-36.md`.

---

## §0 — Before you start

### 0.1 Sets that must already be landed

**S1–S33 are committed and merged** (`87d001a Dragon Telecom v1.5`). S34 depends on one earlier
artefact only:

- **S32:** `Apps/contract/src/common/store-time.ts` → `storeDayRangeUtc(from?, to?)`. Its rules
  are Africa/Algiers calendar days, an inclusive `to` day and half-open UTC bounds. The sales list
  already uses it. This set extends it to the other list endpoints (Action 2.3).

S35 and S36 don't depend on S34, and S34 doesn't depend on them. The only file the three sets
share is `Apps/web/src/config/translations.json`. **Add** keys next to their siblings and change
nothing else in it.

> The brief calls the translations file `translation.json`. Its real name is
> **`Apps/web/src/config/translations.json`**: a flat object keyed by the full dotted key, each
> value `{ "en": …, "fr": …, "ar": "" }`. New keys follow that shape, with `ar` left `""` like
> every other entry.

### 0.2 Diagnosis — the sales page filters

I traced every filter through the whole chain:
component → `StaffSales.tsx` state → `SaleListQuery` → `qk.sales.list(scope, query)` → axios
`params` → `validateRequest({ query: SaleListQuerySchema })` → `SalesService.listSales` `where`.
I then **ran the real HTTP pipeline** (the `app` router, the real middleware and the real service)
against the dev database with a minted admin token. That throwaway script has been deleted. Of
14 sales in the dev DB:

| Request | Rows returned | Meaning |
|---|---|---|
| no filter | 14 | baseline |
| `status=DRAFT` / `status=COMPLETED` | 0 / 9 | status filter applied |
| `from=2099-01-01` / `to=2000-01-01` | 0 / 0 | date filter applied |
| `posClientId=<a real POS client>` | 3 | POS-client id filter applied |
| `sellerId=<Staff.id>` | 13 | seller id filter applied |
| `sellerId=<User.id of the same person>` | **0** | see F1 |

**The back end applies every parameter correctly when it is given the right value.** No
parameter is stripped by the schema or ignored by the service. Both breaks are in
`StaffSales.tsx`, where typed text is turned into an id **before** the query is built:

| Filter | Verdict | Where the chain breaks |
|---|---|---|
| Product search | Works | Sent as free text (`product`), matched server-side. This is the working path the broken ones were compared against. |
| Status | **Works** | Probe above. Its one defect is cosmetic: `RETURNED` and `PARTIALLY_RETURNED` both show the label "Retournée" (`SalesFilters.tsx:16-17`, `SalesTable.tsx:16-17`), so an admin can't tell which of the two items they picked. |
| Date range | **Works** | `soldAt`, Algiers days, inclusive `to` (S32). Its one defect: the `to` input has no label (`SalesFilters.tsx:106-111`), so the two date boxes are indistinguishable. |
| Seller | **Broken. The filter never reaches the query, or reaches it with the wrong id.** | `StaffSales.tsx:82-91`. (a) The typed text becomes a `sellerId` **only** if it equals a `User.username` exactly. The Seller column shows `Staff.firstName + lastName` ("Admin User"), so typing what the table shows never matches. `sellerId` stays `undefined` and the query key doesn't change. (b) When the username does match, the code sends **`u.id`, the `User` id**. `Sale.staffId` is the **`Staff`** id, and `UserDto` doesn't even carry a staff id. The list empties (probe: 13 → 0). |
| POS client | **Broken. The filter never reaches the query.** | `StaffSales.tsx:93-101`. The text becomes a `posClientId` only on an **exact, full-name**, case-insensitive match, and only among the first 20 rows of `GET /pos-clients/search`. A partial name or a phone number resolves to `undefined`, the query key doesn't change, and the list stays unfiltered. |
| Client-name search | **Absent** | The "POS client" box is an exact-name→id resolver, not a search. Searching by part of a name or by phone was never implemented. |

**The fix (Actions 1.1, 2.1, 3.3):** stop resolving names to ids in the component. Send the typed
text as two new free-text query parameters, `client` and `seller`, matched server-side. This is
the same path as the product search that works.

### 0.3 Audit — the same bug class on the other list pages

I read each page's filter state, the query it builds, the contract schema and the service `where`:

| Page (both scopes) | Filters offered | Name→id resolution? | Params stripped / ignored? | Date-range off-by-one? |
|---|---|---|---|---|
| Orders `StaffOrders.tsx` | status tabs, search, from/to | No (free-text `search` on reference/contact name/phone) | No | **Yes**: `placedAt lte new Date(to)` (`orders.service.ts:228-235`) |
| Invoices, outgoing tab `StaffInvoices.tsx` | from/to, source (admin) | No | No | **Yes**: `issuedAt` (`billing.service.ts:358-366`) |
| Invoices, payments tab (admin) | from/to | No | No | **Yes**: client payments `paidAt` (`billing.service.ts:238-246`) and supplier payments `paidAt` (`purchasing.service.ts:463-471`) |
| Invoices, incoming tab (admin) | from/to | No | No | **No.** `SupplierInvoice.invoiceDate` is `@db.Date`, so `lte <that date>` is inclusive and has no time zone. Leave it alone. |
| Repairs `StaffRepairs.tsx` / `RepairBoard.tsx` | technician (real id `Select`), from/to | No | No | **Yes**: `intakeAt` (`repairs.service.ts:78-85`) |
| Supplier invoices `AdminSupplierInvoices.tsx` | none | n/a | n/a | n/a |
| Suppliers `AdminSuppliers.tsx` | search | No (free text, server-side) | No | n/a |
| Sales, Returns tab | none in the UI; `ReturnListQuery` accepts from/to | No | No | **Yes**: `returnedAt` (`sales.service.ts:341-349`) |

**The exact-name→id defect exists only on the sales page**
(`grep "toLowerCase() ===" Apps/web/src/pages` → only `StaffSales.tsx:89,99`).

**A related defect breaks every other date filter: the selected `to` day is never included.**
S32-F2 recorded it and left it unfixed. `lte: new Date('2026-11-07')` means "up to
2026-11-07T00:00Z", so a single-day filter (`from = to`) **always returns an empty list**, and
picking today as `to` hides today. A filter that returns nothing for a day with documents looks
exactly like a page with no data, which is the failure the brief targets. Action 2.3 fixes all six
endpoints with the S32 helper. Each endpoint keeps the column it already filters on.

### 0.4 Findings (record them in the report)

- **F1 — the seller filter had two defects** (§0.2). It matched usernames, not the displayed name,
  and it sent a `User` id where a `Staff` id is required. Fixed by the server-side `seller` text
  filter.
- **F2 — the POS-client filter only fired on an exact full name** among the first 20 search hits.
  A partial name or a phone did nothing. Fixed by the server-side `client` text filter.
- **F3 — status and date filters were verified working.** Probe figures are in §0.2. Only the
  ambiguous "Retournée" label and the unlabelled `to` box are fixed (Actions 3.1/3.2).
- **F4 — the date-range off-by-one on six list endpoints** (§0.3, S32-F2 carried over). Fixed by
  Action 2.3. `SupplierInvoice.invoiceDate` is a `@db.Date` column and is correct as it is.
- **F5 — the staff POS-clients page's Record-payment button always failed for staff.** The button
  renders in both scopes (`pos-clients-table.tsx:122-145`), but `StaffPosClients.tsx:58`
  hard-codes `scope: "admin"`. Every staff submit therefore went to `POST /admin/client-payments`
  (adminOnly) and got a 403. Even with the right scope, `POST /staff/client-payments` demanded
  `STAFF_INVOICES`. Fixed by Actions 2.4 and 3.4.
- **F6 — `paymentAmount` was never reset when the dialog was dismissed** (`StaffPosClients.tsx`
  resets it only on success). The next client's dialog opened pre-filled with the previous typed
  amount. Fixed by Action 3.4.
- **F7 — the record-payment amount showed an untranslated error when emptied.**
  `register("amount", { valueAsNumber: true })` maps an empty box to `NaN`. Zod 4's `z.number()`
  then rejects it with its built-in English message, before `.positive(t(…))` runs. That breaks
  hard rule 2. Fixed by Action 3.6. This is the same `NaN` trap S3 recorded. The field is
  required, so `NaN` must still fail; only the message changes.
- **F8 — not fixed, out of scope:** `validate-request.middleware.ts:37-45` computes normalised
  `body`/`query`/`params` (blank → `undefined`) and then parses the **raw** values. The
  normalisation is dead code. Every filter bar already sends `undefined` rather than `""`, so
  nothing is broken by it today. Enabling it would change every route's parsing (for example,
  the string `"null"` would become `null`), so it is reported, not changed.
- **F9 — not fixed, out of scope:** the admin invoices page's **Incoming** and **Payments** tabs
  fetch `page: 1, limit: 20` and render **no pager** (`StaffInvoices.tsx:118-135`). Rows past the
  20th are silently unreachable. This is a candidate for a later set.
- **F10 — not fixed, out of scope:** the inventory movements filter
  (`inventory.service.ts:614-620`) includes the `to` day but uses UTC days, not Algiers days.
  Inventory wasn't in the audit list.

### 0.5 Decisions this plan takes on its own (list them in the report)

| # | Decision | Why |
|---|---|---|
| P1 | **Replace the component's name→id resolution with two free-text query params, `client` and `seller`**, matched in `listSales`. `sellerId`/`posClientId` stay in the schema; the POS-clients drawer still sends `posClientId`. | It is the product search's working path. One request, no second lookup, and no "first match" guessing. |
| P2 | **`client` matches `PosClient.name` OR `PosClient.phone`** (case-insensitive contains, whole trimmed string). | This is exactly `ClientsService.searchPosClients`, the POS attach search, so the brief's "consistent with the search used elsewhere" holds. A walk-in sale (no POS client) never matches a client search. |
| P3 | **`seller` is tokenised. Every whitespace token must appear in `Staff.firstName`, `Staff.lastName` or `User.username`.** | The table shows "First Last", so typing the full displayed name must match. The token rule is the one `productLineWhere` already uses. |
| P4 | **The client search is shown in both scopes. The seller search and the date range stay admin-only.** | A staff member's list is already confined to their own sales server-side (`extraWhere` is spread last, S32-F3). A client search inside it exposes nothing new and isn't margin data. |
| P5 | **Every list date filter adopts `storeDayRangeUtc`** on the column it already uses. The exception is `invoiceDate` (`@db.Date`). | This is the S32/Q2 rule. Only which rows a list returns changes; no stored or reported money figure changes. |
| P6 | **Record-payment on the POS-clients page (both scopes) keeps the dialog open after a successful submit.** It then shows the server's snapshot: reference, amount, **previous credit → new credit** from the returned `ClientPaymentDto`, and a Close button. The invoices and client-directory callers keep their current close-on-success behaviour. | The brief asks for the credit movement "before and after submitting". `CreditMovementPreview`'s own contract says "previews before submit and echoes it after". The echo uses the ledger row's own snapshot, not a client-side subtraction from a possibly stale list row. |
| P7 | **The payment guard becomes `anyPages: [STAFF_INVOICES, STAFF_POS_CLIENTS]`.** The existing `staffPaymentsReadOrAdmin` constant (already that exact rule, for the GET) is renamed and used for the POST too. | Staff who hold only `STAFF_INVOICES` keep the invoices page's Record-payment action. Staff who hold only `STAFF_POS_CLIENTS` gain it. Nothing else uses that route (§0.6). |
| P8 | **`PARTIALLY_RETURNED` gets its own label key.** The duplicated status-label map in `SalesFilters.tsx` is deleted in favour of an export from `SalesTable.tsx`. | This is the precedent of `InvoiceFiltersBar` importing `SOURCE_LABEL_KEY` from `InvoicesTable`. Two copies of one map is how the mislabel happened. |

### 0.6 What the payment-guard change touches (checked)

- `POST /staff/client-payments` (`BILLING_ROUTES.STAFF_CLIENT_PAYMENTS`) has exactly two web
  callers through `useCreateClientPayment`:
  - `StaffInvoices.tsx` (staff scope). Its users hold `STAFF_INVOICES`, so they still pass.
  - `StaffPosClients.tsx`. It currently sends `scope: "admin"` (F5). After this set it sends
    `scope`, so staff holding `STAFF_POS_CLIENTS` pass.
- `AdminClients.tsx` posts to the admin route. It is unaffected.
- No web component checks `STAFF_INVOICES` before showing a payment action. The only web uses of
  the key are the `PageGuard` on `/staff/invoices` (`App.tsx:384`), `nav-links.ts:93` and
  `staff-pages.ts`.
- The payment itself is **unchanged**. `BillingService.createClientPayment` →
  `captureClientPaymentInTx` writes the `ClientPayment` row in a transaction, on the row-locked
  `PosClient`, with `previousCredit`/`newCredit` snapshots. `totalPaid` moves only through the
  ledger. No service code changes.

---

## §1 — Contract (`Apps/contract`)

### Action 1.1 — `src/modules/sales/sales.query.ts`: free-text client and seller filters

In `SaleListQuerySchema`, add these two fields after `product`:

```ts
  // S34 — the filter bar's free-text client/seller boxes. Matched server-side, like `product`:
  // the page used to resolve the typed text to an id on an exact match, which never fired for a
  // partial name and sent a User id where a Staff id was needed (report-S34 F1/F2).
  // `client`: the sale's POS client by name or phone (same match as GET /pos-clients/search).
  // `seller`: every whitespace token must appear in the seller's first name, last name or username.
  client: z.string().trim().min(1).max(100).optional(),
  seller: z.string().trim().min(1).max(100).optional(),
```

Rewrite the header comment (lines 4-7) so it no longer says the filter bar sends
`sellerId`/`posClientId`:

```ts
// `sellerId`/`posClientId` (set-03 A3) — exact-id filters, kept for programmatic callers (the
// POS-clients drawer's Sales tab sends posClientId). The filter bar sends `seller`/`client` text
// instead (S34).
// S32/Q2 — `from`/`to` are Africa/Algiers calendar days applied to `soldAt`, `to` inclusive.
// Drafts have no `soldAt`, so any date filter excludes them.
```

Also add one line above `ReturnListQuerySchema`'s `from`:
`// S34 — Africa/Algiers days on returnedAt, \`to\` inclusive (storeDayRangeUtc).`

### Action 1.2 — date-semantics comments on the other list queries (comments only)

These files get **no schema change**. Add the same one-line comment above each `from:` field,
naming the column:

| File | Schema | Comment |
|---|---|---|
| `src/modules/orders/orders.query.ts` | `BackofficeOrdersQuerySchema` | `// S34 — Africa/Algiers days on placedAt, \`to\` inclusive (storeDayRangeUtc).` |
| `src/modules/billing/billing.query.ts` | `InvoiceListQuerySchema` | `… on issuedAt …` |
| `src/modules/billing/billing.query.ts` | `ClientPaymentListQuerySchema` | Extend the existing S8 J8 comment with `S34 — Africa/Algiers days, \`to\` inclusive.` |
| `src/modules/purchasing/purchasing.query.ts` | `SupplierPaymentListQuerySchema` | Same as above. |
| `src/modules/purchasing/purchasing.query.ts` | `SupplierInvoiceListQuerySchema` | `// invoiceDate is a calendar date (@db.Date) — compared as-is, \`to\` already inclusive.` |
| `src/modules/repairs/repairs.query.ts` | `RepairListQuerySchema` | `… on intakeAt …` |

Run `npx tsc --noEmit && npm run lint` in `Apps/contract`.

---

## §2 — API (`Apps/api`)

### Action 2.1 — `src/modules/sales/sales.service.ts`: apply `client` and `seller` in `listSales`

1. In `private async listSales` (≈ line 569), add these two spreads **after** the `product` spread
   and **before** `...opts.extraWhere`. The staff scoping must stay last:

   ```ts
      // S34 — free-text client / seller filters (replace the page's exact-name→id resolution).
      ...(query.client != null ? { posClient: SalesService.posClientTextWhere(query.client) } : {}),
      ...(query.seller != null ? { staff: SalesService.sellerTextWhere(query.seller) } : {}),
   ```

   The `staff` relation filter is ANDed with a staff caller's `{ staffId }` scoping, so it can only
   narrow a staff list, never widen it. Say so in the comment you leave on the
   `extraWhere` line. Update that existing comment (`// S32/F3 — spread LAST …`) to add:
   `The S34 seller text filter is a relation filter ANDed with this, so it cannot widen it either.`

2. Rename the comment on the `sellerId`/`posClientId` lines from
   `// set-03 A3 — admin filters (ADM-10's seller/POS-client dropdowns).` to
   `// set-03 A3 — exact-id filters (the POS-clients drawer sends posClientId; S34 moved the filter bar to text).`

3. Add two private static helpers directly after `productLineWhere` (≈ line 698):

   ```ts
  // S34 — the sales list's client search: the same match as ClientsService.searchPosClients
  // (name or phone, case-insensitive contains), so the client found at the POS is the client the
  // list can be filtered by. A walk-in sale (no POS client) never matches.
  private static posClientTextWhere(search: string): Prisma.PosClientWhereInput {
    const trimmed = search.trim();
    return {
      OR: [
        { name: { contains: trimmed, mode: 'insensitive' } },
        { phone: { contains: trimmed, mode: 'insensitive' } },
      ],
    };
  }

  // S34 — the seller search. The table shows "First Last" (SalesMapper's staffName) and an admin
  // may type the login name instead, so every token must match first name, last name or username.
  private static sellerTextWhere(search: string): Prisma.StaffWhereInput {
    const tokens = search.trim().split(/\s+/).filter(Boolean);
    return {
      AND: tokens.map((token) => ({
        OR: [
          { firstName: { contains: token, mode: 'insensitive' as const } },
          { lastName: { contains: token, mode: 'insensitive' as const } },
          { user: { username: { contains: token, mode: 'insensitive' as const } } },
        ],
      })),
    };
  }
   ```

   `Sale.posClient` is optional. Prisma accepts a plain `PosClientWhereInput` for it, and that
   excludes rows whose relation is null. If `tsc` objects, wrap it as `{ is: … }`. Both forms
   mean the same thing.

### Action 2.2 — `src/modules/sales/sales.service.ts`: `listReturns` date bounds

In `listReturns` (≈ line 335), replace the `returnedAt: { gte…, lte… }` block with:

```ts
      // S34 — Africa/Algiers days, `to` inclusive (was `lte: new Date(to)`, which dropped the `to` day).
      ...(query.from != null || query.to != null ? { returnedAt: storeDayRangeUtc(query.from, query.to) } : {}),
```

`storeDayRangeUtc` is already imported in this file.

### Action 2.3 — Algiers-day bounds on the other list endpoints

In each method below, replace the `<column>: { ...(from ? { gte: new Date(from) }) , ...(to ? { lte: new Date(to) }) }`
block with the single spread
`...(query.from != null || query.to != null ? { <column>: storeDayRangeUtc(query.from, query.to) } : {}),`.
Add `storeDayRangeUtc` to the file's existing `from '@dragon-telecom/contract'` import, which is a
value import, not `type`. Keep or extend the existing comment and append
`S34 — Africa/Algiers days, \`to\` inclusive.`

| File | Method | Column |
|---|---|---|
| `src/modules/orders/orders.service.ts` | `listBackoffice` (≈ 214) | `placedAt` |
| `src/modules/billing/billing.service.ts` | `listClientPayments` (≈ 235) | `paidAt` |
| `src/modules/billing/billing.service.ts` | `listInvoicesFor` (≈ 350) | `issuedAt` |
| `src/modules/purchasing/purchasing.service.ts` | `listPayments` (≈ 460) | `paidAt` |
| `src/modules/repairs/repairs.service.ts` | `listRepairs` (≈ 74) | `intakeAt` |

**Do not touch** `purchasing.service.ts` `listInvoices` (`invoiceDate`, a `@db.Date` column, so it
is already correct). Add one comment above its date block instead:
`// invoiceDate is @db.Date — a plain calendar date, so lte <to> already includes the to day (S34 audit).`

`listInvoicesFor` spreads `scopeWhere` last. Keep that order.

### Action 2.4 — `src/modules/billing/billing.routes.ts`: widen the client-payment guard

1. Rename the constant `staffPaymentsReadOrAdmin` to **`staffClientPaymentsOrAdmin`**. Its rule
   stays the same: `types: [STAFF, ADMIN]`, `anyPages: [STAFF_INVOICES, STAFF_POS_CLIENTS]`,
   `checkDB: true`. Replace its comment with:

   ```ts
// S18 — the client-payment list (POS-clients drawer's Payments tab, D-5). S34 — recording a
// payment uses the same rule: holding STAFF_POS_CLIENTS is enough to take a payment from the
// POS-clients page; STAFF_INVOICES still works for the invoices page's Record payment.
   ```

2. On the `router.post(BILLING_ROUTES.STAFF_CLIENT_PAYMENTS, …)` route, replace
   `staffInvoicesOrAdmin` with `staffClientPaymentsOrAdmin`.
3. On the `router.get(BILLING_ROUTES.STAFF_CLIENT_PAYMENTS_LIST, …)` route, use the renamed
   constant.
4. `staffInvoicesOrAdmin` stays as it is for the three invoice GET routes.

Run `npx tsc --noEmit && npm run lint` in `Apps/api`.

---

## §3 — Web (`Apps/web/src`)

### Action 3.1 — `pages/staff/sales/components/SalesTable.tsx`: one exported status-label map

Rename `const STATUS_LABEL_KEY` to **`export const SALE_STATUS_LABEL_KEY`** and update its use in
this file. Change the `PARTIALLY_RETURNED` entry to `"staff.sales.status.partiallyReturned"`.
Keep `RETURNED` → `"orders.returned"`.

### Action 3.2 — `pages/staff/sales/components/SalesFilters.tsx`

1. Delete the local `STATUS_LABEL_KEY` and import `SALE_STATUS_LABEL_KEY` from
   `@/pages/staff/sales/components/SalesTable`. Use it in the status `Select`.
2. Props. Replace `posClientName`/`onPosClientSearch` with **`clientQuery: string`** and
   **`onClientQueryChange: (q: string) => void`**. Both are required, because the box is shown in
   both scopes (P4). Replace `sellerName`/`onSellerSearch` with **`sellerQuery?: string`** and
   **`onSellerQueryChange?: (q: string) => void`**, which stay admin-only. Rewrite the props doc
   comment:
   `/** S34 — client search (name or phone) in both scopes; seller search and the date range admin-only. */`
3. Render the client `Input` **outside** the `scope === "admin"` block, after the Today button:
   `value={clientQuery}`, `onChange={(e) => onClientQueryChange(e.target.value)}`,
   `placeholder={t("admin.sales.filters.clientSearch")}`, `className="w-52"`.
4. Inside the admin block, the seller `Input` keeps `placeholder={t("admin.sales.filters.seller")}`
   and binds to `sellerQuery`/`onSellerQueryChange`. Delete the old POS-client input from the
   block.
5. Date inputs: change the `from` input's `aria-label` to `t("admin.sales.filters.from")` and give
   the `to` input `aria-label={t("admin.sales.filters.to")}`. Put a matching `title` on each, so
   the unlabelled boxes show which is which on hover.
6. Update the header comment `// Dumb, props-only (Sprint 4) …` to add:
   `S34 — every filter here is plain text/enum/date; ids are never resolved in the page.`

### Action 3.3 — `pages/staff/sales/StaffSales.tsx`: send text, not resolved ids

1. Delete the `useUsers` import (`@/hooks/useIdentity`), the `usePosClientSearch` import
   (`@/hooks/usePosClients`) and the `sellerMatches`/`sellerId` and
   `posClientMatches`/`posClientId` blocks (lines 82-101).
2. Rename the state to `sellerInput`/`setSellerInput` and `clientInput`/`setClientInput`. Keep
   `debouncedSeller`/`debouncedClient` via `useDebouncedValue(…, 300)`.
3. Build the query as:

   ```ts
      // S34 — free text, matched server-side (sales.query.ts `client`/`seller`).
      client: debouncedClient.trim() || undefined,
      seller: scope === "admin" ? debouncedSeller.trim() || undefined : undefined,
   ```

   Remove `sellerId`/`posClientId` from the object and from the `useMemo` deps. Add
   `debouncedClient`/`debouncedSeller` to the deps. The query key `qk.sales.list(scope, query)`
   already includes the whole object, so no key change is needed.
4. Pass `clientQuery={clientInput}`, `onClientQueryChange={(n) => { setClientInput(n); setPage(1); }}`,
   `sellerQuery={sellerInput}` and `onSellerQueryChange={(n) => { setSellerInput(n); setPage(1); }}`
   to `SalesFilters`.
5. Replace the header comment's set-03 A3 paragraph (lines 46-50) with:

   ```ts
// S34 — the seller and client boxes send free text (`seller`/`client`), matched server-side.
// They used to be resolved to an id here on an exact name match: the seller box matched usernames
// (the table shows first + last name) and sent a User id where Sale.staffId holds a Staff id, and
// the client box ignored partial names and phones (report-S34 F1/F2). The client search shows in
// both scopes (staff results stay limited to their own sales server-side); seller and the date
// range are admin-only.
   ```

### Action 3.4 — `pages/staff/pos-clients/StaffPosClients.tsx`: search, and payment parity

1. **Search** (both scopes):
   - Add `const [searchInput, setSearchInput] = useState("")` and
     `const debouncedSearch = useDebouncedValue(searchInput, 300)` (import from
     `@/hooks/useDebouncedValue`).
   - `clientsQuery` becomes
     `useMemo(() => ({ search: debouncedSearch.trim() || undefined, page: currentPage, limit: 10 }), [debouncedSearch, currentPage])`.
     `PosClientListQuerySchema.search` already exists and `listPosClients` matches name, phone and
     code. **No API change, and the attach-flow `/pos-clients/search` endpoint is not used.**
     `qk.posClients.list(scope, query)` already keys on the query.
   - Render the search box **in the page, between the header row and `<PosClientsTable>`**, not
     inside the table. The table renders a `TableSkeleton` while loading, which would unmount the
     input and drop focus on every keystroke. Copy the markup from the suppliers precedent
     (`admin-suppliers-table.tsx:216-224`): a `relative` div, a lucide `Search` icon and
     `<Input className="pl-10" placeholder={t("admin.posClients.searchPlaceholder")} value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setCurrentPage(1); }} />`.
     Constrain it with `className="relative max-w-sm"` on the wrapper.

2. **Payment parity** (fixes F5/F6, implements P6):
   - `handleRecordPaymentSubmit`: change `{ scope: "admin", command: values }` to
     **`{ scope, command: values }`**.
   - Add `const [paymentResult, setPaymentResult] = useState<ClientPaymentDto | null>(null)`
     (import the type from `@dragon-telecom/contract`).
   - On success, call `toast.success(t("admin.clients.recordPayment.success"))` (unchanged) and
     `setPaymentResult(created)`, using the mutation's `onSuccess: (created) => …`
     argument. **Do not** clear `paymentTarget`; the dialog stays open on its result view.
   - Add one close handler and use it for the dialog's `onOpenChange(false)`:
     ```ts
  // Closing (Cancel, overlay, or the result view's Close) always resets the amount and the result —
  // the amount used to survive a dismissal and pre-fill the next client's dialog (report-S34 F6).
  const closePaymentDialog = () => {
    setPaymentTarget(null);
    setPaymentAmount(0);
    setPaymentResult(null);
  };
     ```
   - Pass `result={paymentResult}` to `RecordPaymentDialog`. Keep `key={paymentTarget.id}`.
3. Fix the stale header comment (lines 32-34, "`onRecordPayment` is left unwired …"). Replace that
   sentence with:
   `S34 — Record payment works in both scopes (staff route, guarded by STAFF_POS_CLIENTS or STAFF_INVOICES) and echoes the ledger row's previous → new credit after submit; the list has a name/phone/code search.`

### Action 3.5 — `pages/staff/invoices/components/RecordPaymentDialog.tsx`: optional result view

1. Add an optional prop with this doc comment:
   ```ts
  /** S34 — when set, the dialog shows the recorded payment (the server's own previous/new credit
   * snapshot) instead of the form. Only the POS-clients page passes it; other callers keep
   * closing on success. */
  result?: ClientPaymentDto | null;
   ```
2. When `result` is set, render inside the same `DialogContent`:
   - `DialogTitle` → `t("staff.invoices.recordPayment.recordedTitle")`;
   - a two-row `dl` or `div` list: `t("staff.invoices.recordPayment.reference")` →
     `result.reference`, and `t("staff.invoices.recordPayment.amountLabel")` →
     `formatDZD(result.amount, language)` (`formatDZD` from `@/lib/utils`; take `language` from
     `useTranslation()`);
   - `<CreditMovementPreview previousCredit={result.previousCredit} newCredit={result.newCredit} />`;
   - a `DialogFooter` with `<Button type="button" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>`.

   Otherwise render the existing form unchanged. Call `useForm` unconditionally above the branch,
   as it is today, to keep hook order stable.
3. Update the component's header comment to mention the S34 echo-after-submit view.

### Action 3.6 — `pages/staff/invoices/record-client-payment.schema.ts`: translated `NaN` message

Change the amount field to:

```ts
    // S34 — an emptied box arrives as NaN (valueAsNumber); without its own message z.number()
    // reported Zod's English default before .positive ran (report-S34 F7). Required, so NaN still fails.
    amount: z
      .number({ error: t("staff.invoices.recordPayment.amountInvalid") })
      .positive(t("staff.invoices.recordPayment.amountInvalid")),
```

The `AssertAssignable` guard below it must still compile. The output type is still `number`.

### Action 3.7 — `config/translations.json`: new keys

Insert each key next to its siblings, with `ar` set to `""`:

| Key | en | fr |
|---|---|---|
| `staff.sales.status.partiallyReturned` | Partially returned | Partiellement retournée |
| `admin.sales.filters.clientSearch` | Client name or phone | Nom ou téléphone du client |
| `admin.sales.filters.from` | From | Du |
| `admin.sales.filters.to` | To | Au |
| `admin.posClients.searchPlaceholder` | Search by name, phone or code | Rechercher par nom, téléphone ou code |
| `staff.invoices.recordPayment.recordedTitle` | Payment recorded | Paiement enregistré |
| `staff.invoices.recordPayment.reference` | Reference | Référence |

`admin.sales.filters.posClient` and `admin.sales.filters.dateRange` become unused. Leave them in
place, since deleting keys is not part of this set. List them in the report.

---

## §4 — Validation gate

No test file may be read for editing, edited or run. From the repo root:

```bash
cd Apps/contract && npx tsc --noEmit && npm run lint
cd ../api      && npx tsc --noEmit && npm run lint
cd ../web      && npx tsc --noEmit && npx eslint <every file this set touched>
```

**Baselines** (from S33): api test tsc 198 errors in 29 files; api lint 7 pre-existing errors;
web test tsc (`-p tsconfig.test.json`) 52 errors. Report any per-file difference. One is expected:
any web test that renders `SalesFilters` with the removed `posClientName`/`onPosClientSearch`
props, or that mocks `useUsers`/`usePosClientSearch` for `StaffSales`, will now drift. **Do not
edit it.** List it in the report.

**Grep sweeps:**
- `grep -rn "toLowerCase() ===" Apps/web/src/pages` → no hit in `StaffSales.tsx`.
- `grep -rn "lte: new Date(query.to)" Apps/api/src/modules` → **one** hit only:
  `purchasing.service.ts` `listInvoices` (`invoiceDate`, deliberately kept, Action 2.3).
- `grep -rn "staffPaymentsReadOrAdmin\|scope: \"admin\", command" Apps/api/src Apps/web/src/pages/staff/pos-clients`
  → none.
- `grep -n "STATUS_LABEL_KEY" Apps/web/src/pages/staff/sales/components/SalesFilters.tsx` → only the
  imported `SALE_STATUS_LABEL_KEY`.

No migration and no schema change.

---

## §5 — Manual verification checklist (browser)

Before you start, make sure the dev data has at least:
- two sellers with sales;
- two POS clients with completed sales, one of them with a phone number;
- one walk-in sale;
- one partially returned sale;
- documents on **two different days**.

Note one known day `D` that has a sale, an order, an invoice, a client payment, a supplier payment
and a repair intake. Today works if you create them now.

### A. Admin sales page (`/admin/sales`)

1. **Status:** pick **Brouillon**. Only drafts are listed. Pick **Terminée**. Only completed sales
   are listed. Open the list: **Retournée** and **Partiellement retournée** are now two distinct
   items, and each lists only its own status.
2. **Date range:** hover the two date boxes. They read **Du** and **Au**. Set **Du = Au = D**.
   D's sales are listed, and nothing from another day. Clear both, then press **Ventes du jour**.
   Today's sales are listed.
3. **Seller:** type the first few letters of a name **as shown in the Seller column** (e.g.
   "Adm"). Only that seller's sales remain. Type the full displayed name ("Admin User"): the same
   result. Type the login username: the same result. Type `zzzz`: an **empty** table, not the
   unfiltered list.
4. **Client:** type part of a POS client's name. Only that client's sales remain, and walk-in
   ("Comptoir") rows disappear. Clear it and type a fragment of that client's **phone**: the same
   result. Type `zzzz`: an empty table.
5. **Combined:** client + **Terminée** + Du/Au. The result is the intersection. Change any one
   filter and the page goes back to 1.
6. **Money cross-check:** with the client filter set to one client and no other filter, add up the
   **Total** column (use the footer total if shown). Open that client on `/admin/pos-clients` →
   detail drawer → **Sales** tab. The same sales are listed, with the same totals. The sum of their
   totals is ≤ the client's **Total sold** column. It is equal when the client has no completed
   online orders and no returns, because `totalSold` also counts orders and falls by returned line
   value.

### B. Staff sales page (`/staff/sales`, as a staff user holding the sales page)

7. The **client search** box is present. The seller box and the date boxes are not. Typing a
   client name lists **only your own** sales to that client. Sign in as a second seller who also
   sold to that client: each sees only their own.

### C. Date filters on the other list pages (same day `D`)

8. `/admin/orders`: set **from = to = D**. D's orders are listed. Before this set the list was empty.
9. `/admin/invoices` → **Outgoing**: from = to = D lists D's invoices. **Payments**: from = to = D
   lists D's client **and** supplier payments. **Incoming** is unchanged: from = to = a supplier
   invoice's date lists it, as it did before.
10. `/admin/repairs` board: from = to = D shows the repairs taken in on D.
11. **Money cross-check (same Algiers day on both pages):** on **Payments** with from = to = D,
    add up the **supplier** payment amounts. Open `/admin/cash-register` for D. The sum equals the
    Suppliers section's **total paid to suppliers**, which S33/Q1 defines as the SupplierPayment
    rows with `paidAt` on that day. If you can create one, a payment recorded just after local
    midnight must appear under D on both pages, not under the day before. Then open one listed
    **client** payment that has an invoice number, and open that invoice on **Outgoing**. Its
    **Paid** amount equals the sum of every Payments-tab row carrying that invoice number, with
    the filter cleared. Refund rows count as negative.

### D. POS clients search (`/admin/pos-clients` and `/staff/pos-clients`)

12. Type part of a client's **name**. The table narrows and the pager resets to page 1. A **phone**
    fragment and a **code** (`CLI-…`) fragment narrow it too. The box keeps focus while the table
    reloads. Clear it and the full list returns.

### E. Record payment from the staff POS-clients page

Setup: in `/admin/users`, give a staff user a role holding **`STAFF_POS_CLIENTS` but not
`STAFF_INVOICES`**. Sign in as that user. Pick a client with a known credit, say **C** DZD. Note C
and their **Total paid** P from the table.

13. Click the card icon on that client's row. The dialog shows **Previous credit = C**. Clear the
    amount: a **translated** "Amount must be greater than zero" appears on submit. Type `0`: the
    same message. Type `1500`: the preview reads **C → C − 1500**.
14. Submit. A success toast appears **and the dialog stays open**, now titled **Payment recorded**.
    It shows a `PAY-…` reference, amount 1500 and **Previous credit C → New credit C − 1500**,
    taken from the server. No 403 appears. Press **Close**.
15. Reopen the dialog for a **different** client. The amount box is **not** pre-filled with 1500.
16. The row now shows credit **C − 1500** and total paid **P + 1500**. The detail drawer's
    **Payments** tab lists the new `PAY-…` row with the same previous/new credit. **Credit
    history** shows the same movement.
17. **Ledger cross-check:** as admin, open `/admin/invoices` → **Payments**. Find the same `PAY-…`
    reference: amount 1500, no invoice number (on account), staff name = the staff user. Its
    previous credit equals the credit shown in step 13, and its new credit = previous − 1500.
18. **Regression:** sign in as a staff user holding **`STAFF_INVOICES` only**. Open an invoice with
    a POS client on `/staff/invoices` and record a payment. It succeeds, and that dialog still
    closes on success.
19. As **admin** on `/admin/pos-clients`, repeat steps 13-16. The behaviour is identical.

---

## §6 — Report

File `Docs/Stage-04-Fixes/results/report-S34.md` with:
- the diagnosis table (§0.2) and the audit table (§0.3) as found;
- F1–F10;
- P1–P8;
- every file changed;
- gate outputs against the baselines, including any drifted test file, unedited;
- the two now-unused translation keys.
