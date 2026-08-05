# Dragon Telecom — Fix Programme: Issue Sets & Planning Brief

The app is built and running across backend, frontend and the shared contract. What follows is the consolidated list of defects and change requests from manual testing, divided into **18 sets** sized so that one focused agent session can plan or execute each without losing context.

**Standing context:** the app and database are **not in production**. Data may be dropped, schemas rewritten, and migrations created freely. Always prefer the correct model over a backward-compatible one.

# THE SETS

## Design decisions in force

These are settled. Plan to them.

| # | Decision |
|---|---|
| D1 | **Orders are multi-line.** An `OrderLine` table exists; the folded single-product columns leave `Order`. |
| D2 | **An order consumes stock only at `COMPLETED`.** Quantities stay reserved through every earlier state. Cost, profit and revenue are recognised at completion — nothing accrues before it. |
| D3 | **An order's invoice is issued at `COMPLETED`**, not at confirmation. |
| D4 | **`CANCELLED_BY_CLIENT` is a distinct order status**, alongside admin `CANCELLED`. Both terminal, both release the reservation. |
| D5 | **The client-payment ledger is the source of truth for `totalPaid`.** Any captured payment — POS sale, order completion, repair — creates a `ClientPayment` row, and only that row updates `totalPaid`. Sales and orders never write `totalPaid` directly. |
| D6 | **Refunds are `ClientPayment` rows with a negative amount**, so `totalPaid` remains `Σ amount` over the ledger. |
| D7 | **Returns:** a partial return lowers `totalSold` and `totalPaid` only, leaving credit untouched. A **full** return additionally reverses that sale's credit delta (`sale.newCredit − sale.previousCredit`). |
| D8 | **A repair consumes its parts, issues its invoice and recognises its revenue at `PICKED_UP`** — all three at the same moment. Parts stay **reserved** from the moment they're added until pickup. |
| D9 | **A repair produces an invoice and no sale record.** `InvoiceSource` gains `REPAIR`; the invoice is visible in the client's invoice list. `Sale.origin` disappears. |
| D10 | **Two average costs per product.** `avgStockPrice` (quantity-weighted) drives margin displays, adjustment defaults and stock valuation. `avgPrice` (unweighted mean of purchase unit costs) appears **only in the supplier-invoice context**, to recall what the product previously cost. |
| D11 | **A delivery order's price may be set at `PACKAGED`.** Public catalog and product pages show the placement price; the client's order page shows the order's current price. |
| D12 | **No test gate.** Lint and compile only; behavior is verified manually. Each set ends with a report and a verification checklist the owner approves before the next set starts. |

## Dependency graph

```
S1 (schema/contract)   ─┬─► S3, S4, S7, S8, S13, S14
S2 (shared UI)         ─┴─► S3, S4, S6, S7, S8, S13, S17
S5 (payment ledger)    ────► S6, S10, S12, S13
S9 (order lines)       ────► S10 ─► S11, S16
every admin set        ────► S18 (staff parity)  ← last
```

**Execution order:** S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8 → S9 → S10 → S11 → S12 → S13 → S14 → S15 → S16 → S17 → S18.

## Cross-cutting root causes — fix once, verify at many sites

| # | Symptom | Sites | Set |
|---|---|---|---|
| RC-1 | Autocomplete shows the **id** instead of the name after selection | Add Product (family/brand/model), POS-Client (category), approve-client dialog (category), Add Invoice (supplier, product), Inventory adjustments (product), Settings (featured products), Repairs (brand/model) | **S2** |
| RC-2 | Margin missing, uncolored, or not recomputed as the price changes | Add Product, Product Info edit mode, Add-Invoice reprice section | **S2** |
| RC-3 | Light-mode contrast: white text on a light badge | "low stock" stat, "issued" invoice tag (admin and client) | **S2** |
| RC-4 | Backend returns an **id** where the UI needs a **reference** | stock-movement reference cells for order / sale / repair, admin and staff | **S1** |
| RC-5 | Charts render white-on-white — usable only in dark mode | every Statistics graph | **S14** |

---

## S1 — Schema & contract foundation *(backend; unblocks S3, S4, S7, S8, S13, S14)*

Mechanical model-layer work. Behavioral changes belong to the sets that consume these.

- **Dual average costs (D10).** Add `avgPrice` — the unweighted mean of purchase unit costs across receipts — alongside the existing quantity-weighted figure, exposed as **`avgStockPrice`**. Both maintained on every IN movement. Ripple: prisma → contract → mapper → service → the DTOs read by Product Info, Add-Invoice hints, inventory adjustment defaults and statistics. The plan must state explicitly which figure each consumer reads: **margins, adjustment default and stock valuation → `avgStockPrice`; supplier-invoice hint → `avgPrice`**.
- Add a database **index on `Product.barcode`** (feeds S3's search).
- Add **`paidDate`** to supplier payments; expose it in the contract and the supplier-invoices table DTO.
- Add **`createdAt`** to the admin clients list DTO — the table already renders that column empty.
- Add the **created date** to the sales and invoices list DTOs.
- **Repair invoicing model (D9).** Add `REPAIR` to `InvoiceSource`; replace `Repair.saleId` with `Repair.invoiceId`; **remove `Sale.origin`** and its enum entirely (with repairs no longer producing sales, the column carries one value). Delete the sales module's `repair.pickedUp` listener and billing's "skip repair-origin" guard. This set carries only the schema, contract and compile-level fallout — the new issuance behavior lands in **S13**, and the statistics consequences in **S14**.
- **RC-4:** wherever a stock movement or an admin/staff list returns a bare `referenceId` for an order, sale or repair, resolve and return the human **reference** (`ORD-…`, `SAL-…`, `REP-…`) alongside it.

## S2 — Shared UI primitives *(frontend; unblocks most admin sets)*

- **RC-1** — rebuild the shared autocomplete so the input always displays the selected entity's **label**, never its id, on first and every subsequent selection. Audit every consumer listed in the RC table.
- **RC-2** — one shared margin display: value plus color code (**> 0 green, ≤ 0 red**), recomputing reactively as the price input changes (today it goes stale), and rendered for the guest price too, beneath its "leave empty to not set" helper text. Margins are computed against **`avgStockPrice`**.
- **RC-3** — fix badge and tag palettes so light mode has legible contrast.
- **Scroll restoration** — navigating to a new route must land at the **top** of the page; it currently preserves the previous offset.
- **Not Found** — renders the admin sidebar for every user; make it standalone (404 message and return button, no shell).
- **Sign out** (admin and staff) must redirect to login immediately.

## S3 — Product admin pages *(needs S1, S2)*

**Add Product** — reorder the fields to **family → brand → model**, then name and description, then barcode · leave barcode editing disabled for now · margins with color code including the guest price (RC-2) · on save show a success toast and redirect to a **cleanly reset** Add form (it currently returns still populated with the saved product).

**Products list** — remove the image column · resize the stock-status column so its text fits (widen it or reduce the text) · fix the light-mode "low in stock" stat (RC-3) · allow **searching by barcode** in the text field, using S1's index · add a **second tab** showing the table with all product prices, like the staff products view.

**Product Info** — add **image removal**, front and back, deleting the stored file itself · margin with color code recomputing live in edit mode (RC-2) · **bug:** when the guest price is null the price-section update never fires, so nothing saves; once a guest price is set saving works, but the margin still doesn't recompute as values change · surface **avg price** and **avg stock price** from S1.

## S4 — Inventory *(needs S1, S2)*

- Stock levels: search by **barcode or product name**; add a **total product cost** column; rename the second quantity column to **reserved qty**.
- Movement ledger: search by **barcode or product name**.
- Adjustments: the product picker shows the **name**, not the id (RC-1).
- Adjustments: on a positive delta, default the new unit cost to the product's **`avgStockPrice`**, with helper text beneath the input reading *"the average price is …"*.

## S5 — Payment ledger as the source of truth *(backend; reworks money arithmetic)*

Implements **D5**, **D6** and **D7**. This set changes paths that were deliberately serialized earlier — every write stays inside the owning transaction on a locked row.

- **Sale confirmation:** when a POS client is attached and the paid amount is above zero, create a **`ClientPayment` row inside the confirm transaction**, linked to the invoice that same transaction issues. The sale writes **credit** and **`totalSold`**; the payment row writes **`totalPaid`**. Remove `totalPaid` from the sale's own cache write so the figure can never be counted twice.
- **Credit port rework:** split the existing combined call — the sale side applies `credit += (total − paid)` and `totalSold += total`; the payment side applies `totalPaid += amount` and `credit −= amount`. Both on locked reads in the caller's transaction. The composed result must equal the previous single-call arithmetic; state that reasoning in the plan.
- **Order completion (prepares S10)** and **repair pickup (prepares S13)** follow the same shape: the captured payment becomes a `ClientPayment` row; the document applies credit and `totalSold`.
- **Payments taken before an invoice exists** — a repair collects money across several steps while its invoice only appears at pickup — are ledger rows with a null `invoiceId` (on account). **Walk-in customers have no POS client**, so no ledger row is possible; for them the document's own `paidAmount` is the record. Make both cases explicit.
- **Returns (D7):** a partial return lowers `totalSold` and `totalPaid` by the refund and leaves credit alone; a **full** return additionally reverses that sale's credit delta. Detect "fully returned" by comparing the return lines against the sale's lines.
- **Refunds are negative-amount `ClientPayment` rows (D6)**, keeping `totalPaid = Σ amount` true by construction.

## S6 — POS & POS clients *(needs S2, S5)*

**POS** — re-resolve and refresh product prices when a client is selected, so prices follow his category · after saving, the receipt view gains a **return-to-fresh-POS** button beside print · show the client's **previous and new credit** above the paid amount · **draft bugs:** "clear" must delete the draft from the database, removing a product must update the draft's line list, and emptying the last line must delete the draft · default the **paid amount to the subtotal**, credit excluded · **remove the discount from the UI** (keep the column, set 0) · **search log:** record only the last search, debounced **2 seconds** between keystrokes · **product card redesign:** name on the left, resolved price on the right, and beneath them all four prices (`default | category 1 | category 2 | category 3`), with prices visually secondary rather than dominant — ripples to contract and backend if the card isn't sent those prices today · the quick-add-client dialog gains a **category select**, matching the POS-client dialog component · wire the confirmation to the payment row introduced in S5.

**POS clients** — the category field offers a dropdown of existing categories only, with **no create-new**, and shows the name after selection (RC-1) · for a POS client linked to a user account, replace the raw client id with an **arrow linking to `/admin/clients/:id`**.

## S7 — Supplier invoices & suppliers *(needs S1, S2)*

**Add Invoice** (`/admin/supplier-invoices/new`) — remove **save-draft from the UI only**, leaving hook, service and backend untouched; the buttons are **Save** and **Cancel**, where Cancel makes no changes and returns to the supplier-invoices list · **reject an empty invoice** (no products and an amount-only of 0) with a message · the supplier field shows the **name** (RC-1) · **shipping cost defaults to 0** · product rows show the product **name**, drop create-on-no-result, and become a dropdown plus a small **quick-add button to its left** opening a dialog ordered like Add Product — family, brand and model (each a dropdown with its own quick-add), then the auto-generated name · beneath the quantity field two helper texts: **"qty in stock is …"** and **"avg price is …"**, the latter being the **unweighted `avgPrice`** (D10) · the **reprice section** moves to the **top** of the invoice information, showing per product the qty in stock beside the avg stock qty and every price field (guest, default, each category) prefilled with current values, each labelled with its previous value in the form `guest price -previous 1000-` or `-previous empty-`, carrying the shared margin display (RC-2) · **a saved invoice can never be cancelled** — remove the affordance entirely.

**Invoice information** (`/admin/supplier-invoices/:id`) — the record-payment dialog shows the **supplier's** previous credit, not the invoice's · product rows show names, not ids.

**Supplier invoices list** — add **supplier reference** (`-` when null), **paid amount**, and **paid date** (S1).

**Suppliers** — allow **re-enabling** a disabled supplier · block **adding an invoice** to a disabled supplier · a disabled supplier's information page is **read-only**.

## S8 — Clients, invoices & payments *(needs S1, S2)*

**Clients** — show the **created date** (S1's DTO fix) · add a **record-payment action** for a client (amount above zero), mirroring the outgoing-invoice payment flow and showing the client's **previous and new credit**.

**Client information** — the approve dialog's category dropdown shows the **name** after selection (RC-1) · **every tab is empty except browsing history** — populate **Overview** (total sold, total paid, total credit, order count, total quantity of products), **Orders**, **Invoices** and **Payments**.

**Invoices** — incoming: opening an invoice shows the **supplier's** previous credit, not the invoice's, and updates the invoice information accordingly · outgoing: **hide** the cancel-invoice and record-payment buttons on a sale invoice, keeping the underlying logic · add a **source filter** on the outgoing tab and **start/end date filters on every tab**.

## S9 — Orders: schema, contract & order lines *(D1 — model layer only)*

- Add the **`OrderLine`** table: `orderId`, `productId`, `productNameSnapshot`, `quantity`, `resolvedPrice`, `unitPrice`, `costOfGoods?`, `profit?`, `lineTotal`, `serialNumbers?`. Remove the corresponding folded columns from `Order`, keeping order-level totals (`subtotal`, `deliveryFee`, `totalAmount`, `paidAmount`, `totalCost`, `totalProfit`).
- Add **`CANCELLED_BY_CLIENT`** to `OrderStatus` alongside `CANCELLED` (D4).
- Update the contract: `PlaceOrderCommand` accepts a **lines array**, `OrderDto` exposes `lines`, and the per-type status-machine constants live in the contract (no magic strings).
- The migration may drop data freely.
- This set carries the mechanical ripple only — mappers, DTO shapes, and the compile-level fallout across backend and frontend. **All behavioral change belongs to S10.**

## S10 — Orders: backend semantics *(needs S5, S9 — highest risk)*

- **Stock is consumed only at `COMPLETED` (D2).** From placement through every intermediate state the quantity remains **reserved**, per line. `CANCELLED`, `CANCELLED_BY_CLIENT` and `RETURNED` release the reservation and return the stock. FIFO consumption, `costOfGoods` and `profit` are computed at completion, per line and aggregated to the order.
- **The invoice is issued at `COMPLETED` (D3)** — move billing off order confirmation. Its `paidAmount` is the payment captured at that step, and that payment is a **`ClientPayment` row** (D5) whenever the client is known.
- **Per-type status machines**, with constants in the contract:
  - *Pickup:* `PENDING → CONFIRMED | CANCELLED` (no price set) · `CONFIRMED → PACKAGED | CANCELLED` · `PACKAGED → COMPLETED | CANCELLED`, where moving to `COMPLETED` prompts for **price and payment**.
  - *Delivery (home or office):* `PENDING → CONFIRMED | CANCELLED` · `CONFIRMED → PACKAGED | CANCELLED` · `PACKAGED → IN_DELIVERY | CANCELLED`, with the **product price settable at `PACKAGED`** (D11) · `IN_DELIVERY → COMPLETED | RETURNED`, with the **total payment amount set** on completion.
  - `CANCELLED`, `CANCELLED_BY_CLIENT` and `RETURNED` are terminal.
- On `COMPLETED` with a **known client**, the order updates **`totalSold` and credit**, while `totalPaid` comes from the payment row — all in-transaction on locked rows.
- **Revenue, cost and profit count at completion only (D2)** — nothing accrues while an order is confirmed or in delivery.

## S11 — Orders: admin UI *(needs S10)*

- Table: add the **user** and the **client's category** (`-` when unregistered); render products per line now that orders are multi-line.
- Stat cards: add a **badge to each**, add **completed orders**, and add **cancelled by client**.
- Add an **action column** offering only the transitions legal for that order's type and current state (using S10's contract constants), while keeping row-click to open the order.
- Wire the price and payment prompts to the states that require them: pickup at `COMPLETED`; delivery price at `PACKAGED`, payment at `IN_DELIVERY → COMPLETED`.

## S12 — Sales & returns *(needs S5)*

- Viewing a sale receipt and issuing a **return** applies the semantics implemented in S5 (D6, D7) — this set is the UI and its wiring, not the arithmetic.
- Add a **Returns tab**: a table of returns (return reference, sale reference, date, client, user, quantity returned, total returned); clicking a row shows the returned products with their returned prices.
- Add the **created date** column to the sales table.

## S13 — Repairs *(needs S1, S2, S5)*

- Brand and model inputs become searchable with **create-if-absent**, like Add Product.
- Add a **date-range filter** on intake date.
- Paginate at **10 per page**, with a page selector in the filter area (it is not a table).
- **Bug:** the spare-part input doesn't actually select a product, although its price appears in the field.
- Allow a **cumulative paid amount at every step** (500, then 500, showing 1000 in total). Each capture follows **D5** — a ledger row with a null `invoiceId` for a known client, or the repair's own `paidAmount` for a walk-in.
- **Parts stay reserved from the moment they are added until `PICKED_UP` (D8).** No consumption happens at completion.
- Moving to **`PICKED_UP`** is the single moment that: releases the reservations and **consumes the parts** (FIFO, producing `costOfGoods` and `profit`), **issues the invoice** (source `REPAIR`, no sale record — D9), and recognises the revenue. If the paid amount doesn't equal the total (parts plus labour), open a payment dialog first: **Cancel** leaves the status at completed, **Save** applies the payment and completes the transition.
- **Cancellation** is reachable from `INTAKE`, `PROCESSING` and `COMPLETED` — it simply releases the reservations, since nothing was ever consumed. It is **not** reachable from `PICKED_UP`, whose invoice is immutable; reversing that requires a return document, not a cancel. If any payment was taken, prompt to return it (defaulting to the amount paid) and record the refund as a **negative-amount ledger row** (D6), reducing the repair's paid total.
- Once **picked up or cancelled**, the repair is **read-only** — no product or labour edits.
- Repair invoices appear in the **client's** invoice list.
- Add a **Technicians tab** listing technicians with their stats, and allow adding one.

## S14 — Statistics *(needs S1)*

- **RC-5:** every report and graph renders white-on-white and works only in dark mode — fix the chart palette for both themes.
- **Repairs are now a direct revenue source.** With no repair sale record (D9), repair revenue no longer arrives through the sales figures — statistics must read repairs directly, recognising **revenue, cost and profit together at `PICKED_UP`** (D8). Verify nothing double-counts and nothing is lost.
- **Orders count at completion only** (D2) — confirm every revenue, cost and profit query reflects that.
- **Stock valuation uses `avgStockPrice`** (D10).
- **Audit the statistics code end to end**, backend and frontend. Prior work already corrected `sales-by-category` (it groups by client tier, not product family) and extended top products — verify those landed and look for the same class of drift elsewhere.

## S15 — Public storefront

**Header** — the **search field returns nothing**; make it work · the **cart button** shows "not available yet" although the cart page exists — route it there · the account button shows a plain blue circle; show the user's **initials**, like the admin shell · **mobile has no search** — add an icon that expands in place of the store name for room.

**Home** — read featured products and families from **settings**.

**Products** — on mobile the filter drawer hides the entire page; leave the product list partly visible, like the header's burger menu.

**Product info** — replace the order **dialog** with an inline **section between the quantity selector and the Order button**, carrying the same fields and logic (full name, phone, delivery mode — home or office for guests — wilaya, commune) · remove the optional "location" field from the UI and send null · apply the **register form's phone validation** · show full name and phone on the **order confirmation** · for registered users prefill name, phone, wilaya and commune, and **keep that prefill correct after edits and navigation** (state currently leaks between pages) · public catalog and product pages show the **placement price**, while the client's order page shows the order's **current** price (D11).

**My orders** — add the **cancelled-by-client** stat (D4) · the client may cancel **any order except a completed one**.

**Login / Register** — add the home page's header and footer.

## S16 — Cart: multi-product ordering *(needs S9, S10)*

- Order **all products in the cart at once** as a single multi-line order (D1): one order, N lines, one delivery fee, one reservation per line.
- Keep single-product ordering from the product page working through the same lines-based command.

## S17 — Users, roles & settings

- Users tab: allow **changing a user's password** (new and confirm only, no current password).
- Settings → storefront → **featured products**: the search field shows the product id on selection — remove that input entirely and rebuild it (RC-1).
- Settings → storefront: allow choosing up to **6 featured families**.

## S18 — Staff parity & permissions *(last)*

- Apply **every admin-page change from the sets above** to the corresponding staff pages.
- Add the **POS-client page** to the staff-visible pages.
- **Audit the 403s:** a staff user holding the repairs-page role receives 403 on endpoints that page needs (technician list, invoices). Map every staff page to the endpoints it calls and align the guards.