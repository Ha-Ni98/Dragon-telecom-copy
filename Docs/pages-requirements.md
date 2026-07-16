# Audit logs

**Area:** Admin · **Layout:** Desktop-first

Stats (total, today, week, month) · filters (search, user, action type, date range) · table 20/page: date, user, action label, entity, **description** — one narrated string containing the before/after values ("Order ORD-2026-0113: status confirmed → packaged"). No structured diff. Append-only; admin-only; no delete/purge.

## Data
`GET /api/admin/logs` · `GET /api/admin/logs/stats`

# Client detail

**Area:** Admin · **Layout:** Desktop-first

`/admin/clients/:id` — information + statistics.

Tabs: **Overview** (contact, category, status, member-since, credit + total paid via POS client) · Orders · Invoices · Payments · **Browsing** — the price-snooping audit: last searches (query + date), **time spent per product page** (product, duration, date), catalog sessions; date-range filter.

## Data
`GET /api/admin/clients/:id` · `GET /api/admin/clients/:id/activity?type=&from=&to=&page=`

# Web clients

**Area:** Admin · **Layout:** Desktop-first

Stats (total, active, pendingApprovals, newThisMonth) · filters (status, category) · table: full name, store name, username (—), phone, email, wilaya/commune, category, status, totalOrders, totalSpent, lastOrder · actions: **Approve** (pending), Edit, Detail, Disable. **No create button** — web clients exist only through registration.

**Approval dialog** — registration recap; **set username + password** (creates the login); **pick a category**; Approve (auto-creates the linked POS client) / Reject (reason optional).

## Data
`GET /api/admin/clients` · `POST .../:id/approve|reject` · `PATCH .../:id` · `GET /api/admin/clients/stats`

# Admin dashboard

**Area:** Admin · **Layout:** Desktop-first

KPI cards (totalClients, totalProducts, ordersThisWeek, revenueThisMonth — each with % change) · **pending online orders** (actionable, 5) · **pending registrations** (5) · recent orders (8) · recent clients (5) · low stock (5) · repairs by status · draft sales by staff. Widgets load independently.

## Data
`GET /api/admin/dashboard`

# Inventory

**Area:** Admin · **Layout:** Desktop-first

Four tabs.

**Stock levels** — product, on hand, reserved, available, avg cost, stock value, threshold; low-stock highlight + filter; CSV export.

**Movement ledger** — append-only: date, product, type, signed qty, **remaining qty** (IN rows — live FIFO layer), **cost of goods + profit** (OUT rows), balance after, clickable reference document, staff, reason?. Filters: product, type, date, staff. Types: IN `SUPPLIER_INVOICE · INITIAL_STOCK · ADJUSTMENT_IN · RETURN_IN` / PENDING `PENDING_ORDER · PENDING_REPAIR (+release)` / OUT `SALE · ORDER_OUT · REPAIR_CONSUMPTION · ADJUSTMENT_OUT`.

**Pending / reserved** — product, qty, holder (order/repair ref), **age** — an old pending order starves the counter.

**Adjustments** — reason enum, **note optional**, lines (counted vs system, delta preview). IN deltas ask a unit cost (prefilled avg — creates a layer) and offer the **reprice form** prefilled with current prices; OUT deltas consume FIFO.

## Data
`GET /api/admin/inventory/stock|movements|reservations` · `POST /api/admin/inventory/adjustments`

# Invoices & payments

**Area:** Admin · **Layout:** Desktop-first

**Outgoing** — number, date, client, **source: sale | order**, total, paid, status; snapshot render (labels, prices, serials, cost + profit per line, previous/new credit); product rows display the **current avg cost** beside the snapshot price; PDF, print, record payment, cancel (reason optional; numbers never reused).

**Incoming** — accounting view over supplier invoices; overdue flagged.

**Payments** — two ledgers (client / supplier); every row shows **previous credit → new credit**.

## Data
`GET /api/admin/invoices` · `GET .../:number(/pdf)` · `POST .../:number/cancel` · `GET /api/admin/client-payments|supplier-payments` · `POST /api/admin/client-payments|supplier-payments`

# Orders

**Area:** Admin · **Layout:** Desktop-first

Stats (thisMonth, pending, confirmed, inDelivery) · search + status tabs (default PENDING) + date range · table 14/page: reference, client (name, phone, wilaya, totalOrders, completion rate), product, type, totals, status, date, **age flag** (pending > 24 h).

Statuses: `PENDING → CONFIRMED → PACKAGED → IN_DELIVERY → COMPLETED` (+ `CANCELLED` pre-completion, reason optional; **`RETURNED`** post-completion with per-line restock toggle).

Dialogs: **Show** (read-only, availability re-check per line) · **Confirm** (optional price adjust + serials; converts the reservation to ORDER_OUT, stores profit, issues the invoice; idempotent; loud 409 on shortfall) · **Status** (delivery company + tracking at IN_DELIVERY; deliveredAt on COMPLETED) · **Return**.

## Data
`GET /api/admin/orders` · `POST .../:id/confirm|cancel|return` · `PATCH .../:id/status` · `GET /api/admin/orders/stats`

# POS clients

**Area:** Admin · **Layout:** Desktop-first

The commercial identities. Table: name, phone, category, **credit**, total paid, linked web account (or —), enabled. **Add dialog** — the only manual client creation in the app: name*, phone?, category?, initialCredit?. Detail: sales history, payments, credit history.

## Data
`GET|POST|PATCH /api/admin/pos-clients` · `GET /api/admin/pos-clients/:id` · `POST /api/admin/client-payments`

# Admin POS

**Area:** Admin · **Layout:** Desktop-first

Identical UI and flow to staff-pos.md, unscoped: the admin sees and can confirm **everyone's** drafts and sales. See staff-pos.md for the full behaviour.

# Product information

**Area:** Admin · **Layout:** Desktop-first

Global edit-mode toggle (header Save/Cancel spans all sections).

Sections: details (name, description, taxonomy, barcode) · images · pricing (guest + default + 3 categories, margin % vs avg cost) · **stock card** (on hand, reserved, available, avg cost, stock value, threshold) · tabs: **movements** (IN rows show layer remaining qty; OUT rows show cost of goods + profit), supply history, sales history (resolved vs charged, profit).

## Data
`GET /api/admin/products/:id` · `PATCH .../:id` · `PATCH .../:id/pricing` · `GET .../:id/movements|supplies|sales`

# Add product

**Area:** Admin · **Layout:** Desktop-first

Three cards + confirmation dialog.

1. **Basic info** — barcode* (+ auto-generate), name* (auto "family brand model", editable), family*/brand*/model comboboxes **with inline create**, description?.
2. **Initial stock** — initialQuantity (default 0). **> 0 ⇒ initialUnitCost\* required** (first FIFO layer + initial avg cost) and the Pricing card unlocks; = 0 ⇒ pricing locked, product born price-less.
3. **Pricing** *(unlocked only with stock)* — guestPrice? (empty ⇒ hidden from guests, stated inline), defaultSalePrice* (POS price), three category price fields (front-end hardcodes three; API accepts any set), margin % vs cost per field; reorderThreshold?.
4. **Images** — ≤3 (front-end cap), primary flag, reorder.

## Data
`POST /api/admin/products` (multipart) · taxonomy GETs + inline POSTs · `GET /api/admin/client-categories`

# Products list

**Area:** Admin · **Layout:** Desktop-first

Stats cards (total / in / low / out) · search + cascading filters + stock-status filter · table 20/page: image, product, barcode, family/brand/model, on hand, reserved, **available**, avg cost, status badge, published, enabled · row actions: **Edit**, **Disable/Enable** (no delete). Header → Add product.

Admin searches are beaconed like staff ones.

## Data
`GET /api/admin/products` · `GET /api/admin/products/stats` · `PATCH /api/admin/products/:id`

# Repairs

**Area:** Admin · **Layout:** Desktop-first

Back-office only — no public surface.

**Board** — kanban `INTAKE → PROCESSING → COMPLETED → PICKED_UP` (+ CANCELLED); cards: reference, customer, device, technician, age, unpaid badge; drag validated server-side.

**Intake** — customer name + phone (or attach POS client → prefill); brand + model (free-text fallback); IMEI?; **reported issues = multi-select** (charging, display, battery, camera, speaker, microphone, water-damage, software, other + free text); technician (from the technicians list — **no user account needed**). Prints the claim slip (reference = the customer's only handle).

**Detail** — device/customer; diagnosis (optional, editable in PROCESSING); parts (product, qty, price, serials? — adding **reserves**); labour; total = labour + parts; timeline (notes optional).

**Transitions** — PROCESSING needs a technician · COMPLETED **consumes parts** (FIFO, profit stored, idempotent, shortfall names the product) · PICKED_UP takes cash payment and records the repair sale (revenue reporting; **no invoice**) · CANCELLED anywhere (reason optional; consumed parts returned explicitly).

## Data
`GET|POST|PATCH /api/admin/repairs` · `POST .../:id/parts` · `POST .../:id/status` · `GET|POST|PATCH /api/admin/technicians`

# Sales & returns

**Area:** Admin · **Layout:** Desktop-first

All sellers' sales (DRAFT included): reference, date, POS client, seller, total, paid, status; footer totals. Detail: lines with **resolved vs charged price**, cost of goods + **profit**, serials, credit snapshot (previous → new), invoice link, receipt reprint, **Issue return**.

Return dialog: lines + qty (≤ sold − returned), per-line **restock toggle** (on ⇒ RETURN_IN at consumed cost; off ⇒ no movement), refund/exchange, reason optional, refund defaults to charged price.

## Data
`GET /api/admin/sales` · `GET /api/admin/sales/:reference` · `POST /api/admin/returns`

# Settings

**Area:** Admin · **Layout:** Desktop-first

Tabs:
- **Store** — name, address, phone, logo — **invoice header only** (storefront footer is front-end static).
- **Invoicing** — prefixes + next sequences per document type (decrease refused); footer note?.
- **Categories** — client categories: **name only**, enable/disable; member count + priced-product count shown as warnings.
- **Hierarchy** — Families (name, icon, parent?, featured ≤6) / Brands (name, logo) / Models (brand, name — no release year; model↔family many-to-many). Inline create; **disable only**.
- **Delivery fees** — **one row per wilaya** (home + office) with expandable **explicit commune overrides**; Excel import (row-level validation) / export.
- **Storefront** — featured products, delivery companies list (template module).

No localisation tab.

## Data
`GET|PATCH /api/admin/settings` · taxonomy admin routes · `GET|PUT /api/admin/delivery-fees` · `POST /api/admin/delivery-fees/import`

# Reports & statistics

**Area:** Admin · **Layout:** Desktop-first

Filters synced to URL (`?dateRange=&familyId=`).

**Overview cards (all-time):** totalRevenue, **totalProfit** (Σ stored FIFO line profits), stockValue, totalClientCredit, totalSupplierCredit. **Filtered cards:** revenue / profit / orders + % vs previous period. **Charts:** revenue over time (per-family option), orders trend, clients growth, sales by family (pie). **Top-selling products.**

**Drillable reports** (chart + table + CSV; every figure clicks through): sales by product (qty, revenue, cost, profit) · by client / by category (**resolved vs charged = real discount**) · by seller · stock movements summary (large adjustments = shrinkage signal) · repairs (volume, turnaround, labour vs parts, per technician) · supplier spend · receivables/payables ageing · **client browsing** (top searches; most-viewed never-purchased).

## Data
`GET /api/admin/statistics/overview|filtered|charts/:chart|top-products` · `GET /api/admin/reports/:type`

# Supplier invoices

**Area:** Admin · **Layout:** Desktop-first

The stock entry point.

**List** — internal ref, supplier ref, supplier, date, total, paid, status (DRAFT|CONFIRMED|CANCELLED), overdue flag.

**Create/edit (DRAFT)** — header: supplier, supplier ref?, dates, shipping cost, note?. Lines: product picker + **inline create**, qty, unit cost, serials?. **Zero-line allowed** (amountOnly — raises credit, no stock). Live footer: landed unit cost per line + **projected new avg cost**.

**Confirm** — transactional (layers at landed cost, avg recompute, credit snapshot previous→new) → then the **reprice prompt**: one prefilled price form per received product, skippable. Immutable after; cancel reverses credit only (stock reversal is a deliberate adjustment).

**Payment** — against invoice or on account; dialog shows previous credit → new credit.

## Data
`GET|POST|PATCH /api/admin/supplier-invoices` · `POST .../:id/confirm|cancel` · `PATCH /api/admin/products/:id/pricing` (reprice) · `POST /api/admin/supplier-payments`

# Suppliers

**Area:** Admin · **Layout:** Desktop-first

Stats (total, totalDue, totalPaid) · table 10/page: name, contact, phone, email, location, **credit**, invoices count, last delivery · actions: Edit → detail, Add invoice, Disable. **Add dialog includes initialCredit.**

**Supplier detail** — edit-mode sections: details · financial card (credit, invoiced, paid — stored) · invoices table · payments ledger · product history (qty, unit cost, **landed cost**, date).

## Data
`GET|POST|PATCH /api/admin/suppliers` · `GET /api/admin/suppliers/:id` · `GET /api/admin/suppliers/stats`

# Users & roles

**Area:** Admin · **Layout:** Desktop-first

**Users** — username, full name, job title, **type (admin | staff)**, roles, enabled, last login. Create/edit: credentials, profile, isEnabled, and a **type switch** — Admin ⇒ all pages, role matrix hidden; Staff ⇒ role multi-select (staff pages only) with the **effective page list rendered live**.

**Roles** — CRUD; page matrix over the **staff registry only**, grouped with select-all per group.

Guards: last enabled admin undisablable/undemotable (server-enforced); disable instead of delete everywhere.

## Data
`GET|POST|PATCH /api/admin/users` · `GET|POST|PATCH /api/admin/roles` · `PUT /api/admin/roles/:id/pages` · `GET /api/admin/pages?scope=staff`

# Cart (favorites)

**Area:** Public · **Layout:** Mobile-first

## Purpose
The heart's backing store — clients only, guests never see this page.

## Sections
Item list (image, name, live price, availability, remove, **Order** button per row → the same single-product order modal) · empty state → catalog.

## Rules
No multi-product checkout. Prices re-resolved on load; a product no longer priced for this viewer shows "Price on request" with Order disabled.

## Data
`GET /api/clients/me/cart` · `DELETE /api/clients/me/cart/:productId`

# Catalog

**Area:** Public · **Layout:** Mobile-first

## Purpose
Narrow the catalog to the parts that fit.

## Sections
Header (total vs filtered count) · `ProductFilters` (search 300 ms, Brand, Family, Model cascading from brand, in-stock toggle, sort, clear) · `ProductGrid` (1/2/4 cols, 15/page).

## Behaviour
- Filters synced to URL; brand change resets model.
- Heart on each card (clients only): red = in cart/favorites; toggles `POST/DELETE /api/clients/me/cart`.
- Guests: hidden-price products show the badge, no heart, card still opens detail.
- Signed-in client browsing is beaconed: searches and catalog session duration → `POST /api/activity/client`.

## Data
`GET /api/products?...&page=&limit=15` · `GET /api/families` · `GET /api/brands` · `GET /api/models?brandId=`

## States
Skeleton grid; empty state with reset; error with retry.

# Home

**Area:** Public · **Layout:** Mobile-first

## Purpose
Route a visitor into the catalog in one tap.

## Sections
- `HeroSection` — static i18n texts, 2 CTAs (Browse products / Learn more). No API.
- `CategoriesSection` — 6 featured family cards **from the backend with icons** → `/products?familyId=`.
- `BrandsSection` — brand-logo carousel from the backend → `/products?brandId=`.
- `ProductsSection` — featured products, search input, family select, grid/list toggle.
- Footer — **front-end static types** (phone, socials); no settings call.

## Data
`GET /api/families?featured=true&limit=6&withCount=true` · `GET /api/brands` · `GET /api/products?featured=true&limit=8`

## States
Per-section skeletons; sections fail independently. Cards show viewer-resolved price or "Sign in to see the price".

# Login

**Area:** Public · **Layout:** Mobile-first

One card for clients, staff, and admin. Username (username/email/phone) + password; Zod + RHF. Success routes by authType: admin → /admin, staff → /staff (first permitted page), client → back-target or /. Single generic failure message. Register link (clients only). Tokens: access 15 min + refresh 7 d, silent refresh in the Auth provider.

## Data
`POST /api/auth/login` · `POST /api/auth/refresh` · `POST /api/auth/logout`

# My Account

**Area:** Public (client) · **Layout:** Mobile-first

## Profile tab
firstName, lastName, **phone: read-only**; email, storeName, wilaya/commune, address editable (Edit/Save/Cancel). Password form (current + new + confirm). Status card: badge **"Active" only**, member-since — **category never shown**.

## Billing tab
`MoneyStatusCard`: credit (owed), total paid — from the linked POS client. Shortcuts → My Orders, My Invoices.

## Data
`GET/PATCH /api/clients/me` · `POST /api/clients/me/password`

# My Invoices

**Area:** Public (client) · **Layout:** Mobile-first

Table: number, date, **source: sale | order** (repairs never appear), total, paid, status. Row → read-only snapshot render + PDF download.

## Data
`GET /api/clients/me/invoices` · `/:number` · `/:number/pdf`

# My Orders

**Area:** Public (client) · **Layout:** Mobile-first

Summary counts by status · filter (pending / confirmed / packaged / in-delivery / completed / cancelled / returned) · `OrderCard`: reference, date, product line (price frozen at placement), fee, total, paid, status badge, **Cancel** (PENDING only — releases the reservation, reason optional). Detail: mode, wilaya/commune, delivery company + tracking when in-delivery, timeline, linked invoice.

## Data
`GET /api/clients/me/orders?status=&page=` · `POST /api/orders/:id/cancel`

# Order confirmation

**Area:** Public · **Layout:** Mobile-first

Reference, line summary, fee, total, mode, and: **pending confirmation — the store will call the contact number.** Reached only after a successful POST /api/orders; direct visits redirect home. Guests keep the reference as their only handle.

# Product details

**Area:** Public · **Layout:** Mobile-first

## Purpose
Decide and order — the only place an order is created.

## Sections
Gallery (≤3 images, front-end cap) · header (badges, name, brand, model, heart) · description · pricing block · **Order now** → `ProductOrderModal` · related products.

## Pricing block by viewer
Approved client: tier price, else guestPrice, else "Price on request". Guest: guestPrice, or "Only registered users can see this price" + sign-in (ordering disabled).

## Order modal (single product)
Quantity (≤ available) · fullName + phone (prefilled for clients, editable) · **wilaya + commune prefilled from profile, editable** · mode: guest = delivery-home|delivery-office; client also pickup · fee appears only when wilaya+commune+mode set; pickup ⇒ wilaya/commune disabled, fee 0 · live total · confirm → PENDING order, stock reserved.

## Data
`GET /api/products/:id` · `GET /api/wilayas` · `GET /api/delivery-fees?wilayaCode=&communeId=` · `POST /api/orders` (`clientId` null for guests) · view duration beacon on unmount.

## States
409 stock conflict surfaces inline on quantity; idempotency key on submit; 404 for unpublished/disabled products.

# Register

**Area:** Public · **Layout:** Mobile-first

## Purpose
Client sign-up, **no password** — credentials issued at approval.

## Fields
firstName*, lastName*, phone* (async-validated), email?, storeName?, wilaya* → commune* (cascading).

## Flow
fill → `POST /api/auth/validate-phone` → confirmation dialog recapping the data → `POST /api/auth/register` → success: "Thank you for registering — please wait for the admin's approval."

## Phone conflicts
`registered` → "This phone number is already registered." · `pending` → "Your request is pending / being processed."

# Staff dashboard

**Area:** Staff · **Layout:** Desktop-first

His day, his data: today's sales count + revenue (own), draft sales awaiting confirmation (own), low-stock alerts (read-only). Widgets gated by the page set; land here after login unless the role grants no dashboard.

## Data
`GET /api/staff/dashboard`

# Staff invoices

**Area:** Staff · **Layout:** Desktop-first

Invoices **he issued**: number, date, client, total, paid, status; snapshot view + PDF; **record cash payment** — the dialog shows previous credit → new credit.

## Data
`GET /api/staff/invoices` · `POST /api/staff/client-payments`

# POS

**Area:** Staff · **Layout:** Desktop-first

## Purpose
Ring up a counter sale in minimal keystrokes. Highest-frequency screen.

## Layout
Left: product search (**barcode-scanner focus**, `F2`) + family quick-pick. Right: ticket (lines, discount, total) + credit/payment panel (`F4`), confirm (`Enter`).

## Behaviour
- Scan adds a line; re-scan increments; qty ≤ available.
- Attach POS client (search name/phone) ⇒ lines re-resolve to his category price; none attached ⇒ default price.
- Per-line price override — resolved price stays visible beside the charged one.
- Optional serial numbers per line (free text).
- **DRAFT until confirmed** — holds no stock; drafts listed under "my drafts".
- **Cash only.** Receipt: total · previous credit · grand total · total paid · new credit. Underpayment requires an attached client (raises his credit).
- Staff sees only his own sales/drafts.

## Data
`GET /api/staff/products?search=` (barcode match jumps) · `GET /api/staff/pos-clients/search` · `POST /api/staff/pos-clients` (quick add) · `POST /api/staff/sales` · `PATCH /api/staff/sales/:id` · `POST /api/staff/sales/:id/confirm`

## States
Confirm 409s: `INSUFFICIENT_STOCK` names the product; `CREDIT_REQUIRES_CLIENT` focuses the client field.

# Staff products

**Area:** Staff · **Layout:** Desktop-first

Read-only catalog for the counter (granted with POS access): image, name, barcode, family/brand/model, **available qty**, the **4 prices** (default + three categories). Search + cascading filters. No cost, no margins, no edit.

Every executed search is beaconed (`POST /api/activity/staff-search`) — the inventory-audit trail for "looked it up, never rang it up".

## Data
`GET /api/staff/products?search=&familyId=&brandId=&modelId=&page=`

# Staff repairs

**Area:** Staff · **Layout:** Desktop-first

Optional page in the role matrix. Same board/detail as the admin repairs page but scoped to tickets he created or works. See admin-repairs.md for the full behaviour — identical UI, scoped queries.

## Data
`GET /api/staff/repairs` and the shared repair endpoints.

# Staff sales

**Area:** Staff · **Layout:** Desktop-first

His sales only: reference, date, POS client (or "Comptoir"), total, paid, status (DRAFT | COMPLETED | …). Detail: lines with resolved vs charged price, serials, receipt reprint. **No return action** — returns are admin-side.

## Data
`GET /api/staff/sales?status=&page=` · `GET /api/staff/sales/:reference`

