# Dragon Telecom — Database Description (Final)

Conceptual model behind `schema.prisma`. Money: `Decimal(12,2)` DZD, cash only (no method columns). Every table has `id` (uuid PK), `createdAt`, `updatedAt` unless stated. No `isArchived` anywhere — `isEnabled` only. Notes, reasons, email: always nullable. Serial numbers are free text on document lines — never inventory state.

**Two structural rules everything obeys**
1. **Nothing mutates stock without a movement row.** `Product.quantityOnHand` = Σ signed IN/OUT movements; `quantityReserved` = Σ PENDING. IN movements are FIFO layers (`remainingQuantity`); OUT movements consume the oldest layer with remaining > 0 and store `costOfGoods` + `profit`. `avgStockPrice` is the average cost of the layers still on hand: recomputed on IN (quantity-weighted) **and** on OUT (from the remaining layers, since a FIFO OUT drains specific layers whose cost is not the average), untouched by PENDING, last value kept when quantity reaches zero.
2. **Denormalised-by-decision, verifiable-by-ledger.** `credit` / `totalPaid` / `totalSold` on POS clients, `credit` / `totalPaid` / `totalInvoiced` on suppliers, quantities on products, cost/profit on lines and documents, previous→new credit snapshots on payments and confirmed documents — all stored, never recomputed at read time, all recomputable from their ledgers for conformance checks.

---

## 1. Identity & Access

**User** — the single identity (clients, staff, admin all log in on one page).
`username` unique · `email` unique nullable · `passwordHash` (Argon2) · `type` enum `ADMIN | STAFF | CLIENT` · `isEnabled` · `lastLoginAt?`. A pending web client has **no User row** — credentials are created at approval. Admin may **reset a client's password** (sets a new one directly).

**RefreshToken** — `userId` FK · `tokenHash` unique · `expiresAt` (7 d; access JWT 15 min) · `revokedAt?` · `replacedByTokenId?` (rotation chain) · `userAgent?` · `ipAddress?`. Disabling a user kills all his tokens.

**Staff** — 1:1 profile for ADMIN/STAFF users: `userId` FK unique · `firstName` · `lastName` · `phone?` · `jobTitle?`. The admin is a Staff row with user.type ADMIN — no separate admin table.

**Role** — `code` unique uppercase · `name` · `description?` · `isEnabled`. Applies to STAFF users only; ADMIN bypasses the matrix.

**Page** — seeded registry: `key` unique · `label` · `group` · `scope` enum `ADMIN | STAFF`. Only STAFF-scope pages are assignable to roles.

**RolePage** — PK (`roleId`,`pageId`). **UserRole** — PK (`userId`,`roleId`). Effective access = union of enabled roles' pages. Guard: the last enabled ADMIN cannot be disabled or demoted.

**Technician** — repair workers, **no user account**: `name` · `phone?` · `isEnabled`.

---

## 2. Geography & Delivery

**Wilaya** — the 69 Algerian wilayas, bilingual: `wilayaCode` unique · `frName` · `arName`.

**Commune** — scoped to a wilaya, bilingual: `communeCode` unique · `wilayaId` FK → Wilaya · `frName` · `arName`.

**DeliveryFee** — **one row per wilaya; commune rows are explicit overrides**: `wilayaId` FK · `communeId?` FK nullable (null = the wilaya-level fee) · `deliveryHome` · `deliveryOffice` · unique (`wilayaId`,`communeId`). Resolution: commune override → wilaya row → settings default. `PICKUP` = 0, no row. Excel import/export.

---

## 3. Clients

**ClientCategory** — pricing tier, **name only**: `name` unique · `isEnabled`. Front-end hardcodes three price fields; the schema assumes nothing about the count.

**Client** — the **web identity** (registration, browsing, orders):
`userId?` FK unique nullable (null until approved) · `code` unique (`CLI-0042`) · `firstName` · `lastName` · `storeName?` · `phone` **unique** (immutable by the client; drives the registration conflict check — `registered` vs `pending` by this row's status) · `email?` · `wilayaId` FK · `communeId` FK · `address?` · `status` enum `PENDING | APPROVED | REJECTED` · `approvedAt?` · `approvedByStaffId?` FK · `rejectionReason?` · `posClientId?` FK unique nullable (**auto-created at approval**) · `isEnabled`.
Guests do **not** create Client rows — guest orders carry contact fields only.

**PosClient** — the **commercial identity** (category, money):
`code` unique (`POS-0042`) · `name` · `phone?` · `categoryId?` FK nullable (none ⇒ default price at POS) · `credit` (owed to the store) · `totalPaid` (lifetime) · `totalSold` (lifetime purchases — Σ confirmed sale/order totals; ≈ totalPaid + credit − openingCredit) · `isEnabled`.
May exist with no web account (walk-in). Every approved web client has exactly one. Manual client creation in the back-office creates only POS clients.

**ClientCart** — favorites (the heart), clients only, no quantity: PK (`clientId`,`productId`) · `addedAt`.

**ClientActivityLog** — the price-snooping audit, append-only: `clientId` FK · `type` enum `SEARCH | PRODUCT_VIEW | CATALOG_SESSION` · `query?` · `productId?` FK · `durationSeconds?` · `createdAt`.

**StaffSearchLog** — the inventory audit ("looked it up, never rang it up"), append-only: `userId` FK · `query` · `matchedProductId?` FK · `createdAt`.

---

## 4. Catalog

**Brand** — `name` unique · `slug` unique · `logoUrl?` · `isEnabled`.

**DeviceModel** — one row per physical phone, **no release year**: `brandId` FK · `name` (unique per brand) · `slug` unique · `isEnabled`.

**Family** — part category: `name` unique · `slug` unique · `iconUrl?` (drives the Home category cards) · `parentId?` FK self (one level) · `isUniversal` · `isFeatured` (the 6 on Home) · `isEnabled`.

**DeviceModelFamily** — PK (`deviceModelId`,`familyId`) — the many-to-many (an S24 Ultra has camera, battery, screen…).

**Product** —
`sku` unique · `barcode?` unique (auto-generatable) · `name` (auto "family brand model", editable) · `description?` · `familyId` FK · `deviceModelId?` FK nullable (null = universal) · `guestPrice?` (null ⇒ hidden from guests, guest ordering blocked) · `defaultSalePrice?` (nullable — a product born with 0 stock has no prices; also the POS price with no client attached) · `avgStockPrice` · `avgPrice` · `quantityOnHand` · `quantityReserved` (available = onHand − reserved, derived) · `reorderThreshold` · `isPublished` · `isEnabled`.
Quantity + `avgStockPrice`/`avgPrice` columns are **owned by the inventory module** — nothing else writes them.

**ProductImage** — `productId` FK · `url` · `alt?` · `position` · `isPrimary`. (3-image cap is front-end only.)

**ProductPrice** — absolute price per (product × category), sparse: `productId` FK · `clientCategoryId` FK · `price` · unique pair.
Resolution: tier row for the viewer's POS-client category → storefront `guestPrice` / POS `defaultSalePrice` → hidden / "price on request". Overrides live on lines, never written back. Reprice prompts: after supplier-invoice confirm and on adjustment-in, prefilled with current values.

---

## 5. Inventory — the FIFO ledger

**StockMovement** — append-only; audit spine and cost layers in one table:
`productId` FK · `direction` enum `IN | OUT | PENDING` · `type` enum (IN: `SUPPLIER_INVOICE`, `INITIAL_STOCK`, `ADJUSTMENT_IN`, `RETURN_IN`, `REPAIR_RETURN` (S30 — a returned repair's part restocked at its consumed cost) — OUT: `SALE`, `ORDER_OUT`, `REPAIR_CONSUMPTION`, `ADJUSTMENT_OUT` — PENDING: `PENDING_ORDER`, `PENDING_REPAIR`, `PENDING_RELEASE`, `REPAIR_CANCELLED` (S30 — reservation released because its repair was cancelled; on-hand untouched)) · `quantity` signed · `unitCost?` (IN — the layer's landed cost) · `remainingQuantity?` (IN — starts = quantity, drained FIFO) · `costOfGoods?` (OUT — Σ consumed qty × layer cost) · `profit?` (OUT — revenue − costOfGoods; null for ADJUSTMENT_OUT) · `balanceAfter` · `referenceType` + `referenceId` (must always resolve: SALE | ORDER | SUPPLIER_INVOICE | REPAIR | RETURN | ADJUSTMENT | PRODUCT) · `reason?` · `staffId` FK · `createdAt` (immutable).

**StockMovementConsumption** — which layers an OUT drained: `outMovementId` FK · `inMovementId` FK · `quantityConsumed` · `unitCost` snapshot. Makes costOfGoods auditable line-by-line and gives RETURN_IN its correct cost (restocked returns re-enter at the consumed cost).

**StockAdjustment** — `reference` unique (`ADJ-2026-0001`) · `reason` enum `COUNT | DAMAGE | LOSS | CORRECTION` · `note?` (**optional**) · `staffId` FK · `adjustedAt`.

**StockAdjustmentLine** — `adjustmentId` FK · `productId` FK · `countedQuantity` · `previousQuantity` · `delta` signed · `unitCost?` (IN deltas only; prefilled avg; becomes the layer's cost). IN deltas may carry a reprice payload (applied via the product module in the same transaction).

---

## 6. Suppliers & Purchasing

**Supplier** — `code` unique · `name` · `contactName?` · `phone?` · `email?` · `location?` · `credit` (store owes; `initialCredit` at creation becomes the opening value) · `totalPaid` · `totalInvoiced` (lifetime) · `isEnabled`.

**SupplierInvoice** — the only stock entry besides adjustments:
`reference` unique (`SIN-2026-0001`) · `supplierReference?` · `supplierId` FK · `status` enum `DRAFT | CONFIRMED | CANCELLED` · `invoiceDate` · `dueDate?` · `shippingCost` (apportioned into landed cost) · `amountOnly?` (**zero-line invoice** — pure amount, raises credit, XOR with lines) · `totalAmount` · `paidAmount` · `paidDate?` · `previousCredit?` + `newCredit?` (snapshot at confirmation) · `confirmedAt?` (S33 — set at confirm; anchors the Caisse) · `note?` · `staffId` FK.
DRAFT touches nothing. Confirm (one transaction): one IN layer per line at landed cost, avg-cost recompute, credit snapshot, sequence number — then the skippable reprice prompt. Immutable after; cancel reverses credit only (stock reversal is a deliberate adjustment).

**SupplierInvoiceLine** — `supplierInvoiceId` FK · `productId` FK (inline create allowed) · `productNameSnapshot` · `quantity` · `unitCost` · `landedUnitCost` · `lineTotal` · `serialNumbers?` text.

**SupplierPayment** — `reference` unique · `supplierId` FK · `supplierInvoiceId?` FK (on account allowed) · `amount` · `previousCredit` + `newCredit` snapshots · `paidAt` · `staffId` FK.

---

## 7. Sales (POS)

**Sale** — `reference` unique (`SAL-2026-0001`) · `posClientId?` FK (anonymous ⇒ default prices, no credit) · `origin` enum `POS | REPAIR` (repair pickup records a repair-origin sale; **no invoice** is issued for those) · `status` enum `DRAFT | COMPLETED | RETURNED | PARTIALLY_RETURNED | CANCELLED` · `subtotal` · `discountAmount` · `totalAmount` · `paidAmount` · `previousCredit?` + `newCredit?` (receipt figures) · `totalCost` + `totalProfit` (Σ lines, stored) · `soldAt?` (set at confirmation) · `staffId` FK (**staff queries scoped to this**) · `note?`.
DRAFT holds no stock and no money; visible only to its creator (+admin). Confirm = the transaction: FIFO consumption, movements, profit, credit math (`newCredit = previousCredit + (total − paid)`; underpayment requires a POS client), invoice event, sequence.

**SaleLine** — `saleId` FK · `productId` FK · `productNameSnapshot` · `quantity` · `resolvedPrice` (what the rules produced) · `unitPrice` (what was charged — override measurable) · `costOfGoods` · `profit` · `lineTotal` · `serialNumbers?`.

**Return** — `reference` unique · `saleId` FK · `type` enum `REFUND | EXCHANGE` · `reason?` · `refundAmount` · `returnedAt` · `staffId` FK.

**ReturnLine** — `returnId` FK · `saleLineId` FK (qty ≤ sold − already returned) · `quantity` · `restock` boolean (true ⇒ RETURN_IN layer at consumed cost; false ⇒ no movement) · `refundAmount`.

---

## 8. Online Orders

**Order** — multi-line (`OrderLine`); reserves stock at placement, one reservation per line:
`reference` unique (`ORD-2026-0001`) · `clientId?` FK nullable (**null for guests** — no auto client row; contact fields carry the identity) · `status` enum `PENDING | CONFIRMED | PACKAGED | IN_DELIVERY | COMPLETED | CANCELLED | CANCELLED_BY_CLIENT | RETURNED` · `orderType` enum `PICKUP | DELIVERY_HOME | DELIVERY_OFFICE` (PICKUP requires a client token) · `contactName` · `contactPhone` · `wilayaId?` + `communeId?` FK (null when pickup; prefilled from profile, editable) · `address?` · `deliveryCompany?` · `trackingNumber?` (set at IN_DELIVERY) ·
`subtotal` · `deliveryFee` (server-resolved: commune override → wilaya → default; 0 pickup) · `totalAmount` · `paidAmount` · `totalCost?` + `totalProfit?` (set at COMPLETED, FIFO) ·
`placedAt` · `confirmedAt?` · `inDeliveryAt?` (S33 — set at IN_DELIVERY) · `deliveredAt?` (at COMPLETED) · `cancelledAt?` · `confirmedByStaffId?` FK · `cancellationReason?`.

**OrderLine** — `orderId` FK · `productId` FK · `productNameSnapshot` · `quantity` · `resolvedPrice` (frozen at placement) · `unitPrice` (staff may adjust — pickup: at COMPLETED; delivery: at PACKAGED) · `costOfGoods?` + `profit?` (set at COMPLETED, FIFO) · `lineTotal` · `serialNumbers?` (entered at confirmation).

Placement → one `PENDING_ORDER` reservation **per line**, held through every intermediate state.
Pickup: `PENDING → CONFIRMED → PACKAGED → COMPLETED`; delivery (home or office):
`PENDING → CONFIRMED → PACKAGED → IN_DELIVERY → COMPLETED`, with each line's charged price
settable at `PACKAGED` for delivery and at `COMPLETED` for pickup. **`COMPLETED` is the single
moment** that releases the reservations, consumes the stock (`ORDER_OUT`, FIFO, per line), stamps
each line's `costOfGoods`/`profit` and the order's `totalCost`/`totalProfit`, issues the invoice
(`sourceType ORDER`, **no sale row**) and captures the payment — which becomes a `ClientPayment`
row when the client is known, while the order applies `totalSold` and credit. A guest (or a
registered client never approved as a `PosClient`) must pay in full at `COMPLETED`. `CANCELLED`
(admin, any non-terminal state) and `CANCELLED_BY_CLIENT` (client, any state but `COMPLETED`)
simply release the reservations, as does `RETURNED` reached from `IN_DELIVERY` — nothing was ever
consumed or invoiced at that point. Staff (page `STAFF_ORDERS`) may drive every forward
transition; **cancel remains admin-only**. A separate admin action returns a `COMPLETED` order:
it restocks at the consumed cost (a restock toggle → `RETURN_IN`) and refunds through a
negative-amount `ClientPayment` row, reversing credit only on a full return.

---

## 9. Repairs (back-office only)

**Repair** — `reference` unique (`REP-2026-0001`, the claim slip — the customer's only handle) · `posClientId?` FK · `customerName` · `customerPhone` · `brandId?` + `deviceModelId?` FK · `deviceLabel?` (free text fallback) · `deviceImei?` · `reportedIssues` string[] from `charging | display | battery | camera | speaker | microphone | water-damage | software | other` · `reportedIssueOther?` · `diagnosis?` (**optional**) · `status` enum `INTAKE | PROCESSING | COMPLETED | PICKED_UP | CANCELLED | RETURNED` (S30 — RETURNED only from PICKED_UP) · `technicianId?` FK → Technician (required for PROCESSING) · `labourPrice` · `partsTotal` · `totalAmount` · `paidAmount` (net of refunds) · `refundedAmount` (S30 — cash given back at CANCELLED/RETURNED) · `totalCost?` + `totalProfit?` · `intakeAt` · `completedAt?` · `pickedUpAt?` · `cancelledAt?` + `returnedAt?` (S30) · `saleId?` FK (the repair-origin sale recorded at pickup).

**RepairPart** — `repairId` FK · `productId` FK · `productNameSnapshot` · `quantity` (adding **reserves** via PENDING_REPAIR) · `unitPrice` · `costOfGoods?` · `profit?` · `lineTotal` · `serialNumbers?` · `consumptionMovementId?` FK → StockMovement (S30 — the REPAIR_CONSUMPTION row written at pickup; a return restocks from its layers) · `restockedOnReturn?` (S30 — set at RETURNED).
COMPLETED consumes parts (FIFO, idempotent; shortfall names the product). CANCELLED releases pending; consumed parts return explicitly.

**RepairStatusHistory** — `repairId` FK · `fromStatus` · `toStatus` · `note?` · `staffId` FK · `changedAt`.

---

## 10. Invoices & Payments

**Invoice** — outgoing snapshot document, sources **SALE and ORDER only** (never repair):
`number` unique, sequential per year (`FAC-2026-0001`; never reused, gaps never closed) · `posClientId?` FK · `sourceType` enum `SALE | ORDER` · `sourceId` · `status` enum `ISSUED | PARTIALLY_PAID | PAID | CANCELLED` · `clientNameSnapshot` · `clientAddressSnapshot?` · `totalAmount` · `paidAmount` · `previousCredit?` + `newCredit?` · `totalCost` + `totalProfit` (stored) · `issuedAt` · `dueDate?` · `staffId` FK (staff pages scoped to this).

**InvoiceLine** — snapshots; renders identically forever: `invoiceId` FK · `label` · `quantity` · `unitPrice` · `costSnapshot` · `profit` · `lineTotal` · `serialNumbers?`.

**ClientPayment** — `reference` unique · `posClientId` FK · `invoiceId?` FK (on account allowed) · `repairId?` FK (S13 — a repair's pre-pickup payment, re-linked to its invoice at pickup) · `reversalOfId?` self-FK (S30 — a negative row reversing the payment it points to; repairs reverse payment by payment) · `amount` (signed; refunds are negative) · `previousCredit` + `newCredit` snapshots (shown in the dialog) · `paidAt` · `staffId` FK · `standalone` (S35 — taken through Record payment, outside any document; the Caisse's Payments line; false for rows written before S35).

---

## 11. System

**Setting** — key–value, JSON-encoded: store info — the invoice/receipt header **and, since S38, the storefront footer** (name, address, phones, WhatsApp, email, social links); invoice prefixes + next sequences per document type (`INVOICE, SALE, ORDER, REPAIR, SUPPLIER_INVOICE, ADJUSTMENT, POS_CLIENT, CLIENT`; lowering refused), default delivery fees; the storefront section (featured products/families, repair-tools family, meta description, link-preview image). No localisation keys. `key` PK · `value` · `updatedAt`.

**HeroSlide** (S38) — the home-page slider, admin-managed: `desktopImageUrl` + `desktopImageKey` · `mobileImageUrl` + `mobileImageKey` (two separate uploads, ~1920×600 and ~1080×1080) · `text` JSON keyed by content locale `{ fr: { title, ctaLabel }, en: { title, ctaLabel } }` — real text rendered over the image, never baked in; this is slide *content*, not a localisation key · `link` (internal path or http(s) URL) · `isActive` · `startsAt?` / `endsAt?` (store-day bounds, `endsAt` exclusive) · `displayOrder` · `createdAt` · `updatedAt`. Public = active, inside its window, by `displayOrder`, max 5.

**AuditLog** — append-only, admin-only: `userId?` FK · `actionType` open string (no enum — new actions need no schema change) · `entityType` · `entityId` · `description` (**one narrated string containing the before/after values** — no structured diff columns) · `ipAddress?` · `createdAt`.

---

## 12. Invariants (backend enforces, conformance tests prove)

1. `quantityOnHand` = Σ signed IN/OUT; `quantityReserved` = Σ PENDING; Σ IN `remainingQuantity` = onHand.
2. FIFO drains the oldest layer with remaining > 0; OUT never exceeds available; PENDING never exceeds onHand.
3. OUT `costOfGoods` = Σ consumption rows; `profit` = revenue − costOfGoods; document totals = Σ lines; `totalSold` on a POS client = Σ his confirmed sale + order totals.
4. `avgStockPrice` recomputes on IN and OUT, and equals `Σ(remaining layer qty × layer cost) ÷ Σ(remaining qty)` at all times; PENDING never moves it; at zero quantity the last value is kept. It drives stock valuation, margin displays and the adjustment default unit cost — so it is **not** merely a display figure. Profit is still strictly FIFO, from each movement's own stored `costOfGoods`. Restocked returns re-enter at the consumed cost. `avgPrice` is separate: the unweighted mean of purchase unit costs, supplier-invoice context only.
5. CONFIRMED supplier invoices, COMPLETED sales, ISSUED invoices: immutable. DRAFTs touch no stock, no money. Confirmations and repair completion idempotent.
6. A PENDING client has no User row and cannot authenticate. Approval atomically creates credentials + category + the linked POS client. Admin password reset overwrites the hash and revokes the client's refresh tokens.
7. `Client.phone` unique and immutable by the client; registration check answers `registered` vs `pending` from the matching row's status.
8. Guests: non-null `guestPrice` products only, delivery modes only, no cart, `clientId = null` on their orders.
9. Delivery fee resolves server-side (commune override → wilaya → default; pickup 0). Client totals never trusted.
10. Credit/paid/sold caches equal their ledger recomputation (conformance check).
11. Access JWT 15 min; refresh 7 d, hashed, rotated, revocable; disabled user ⇒ dead tokens.
12. Staff scoping: `staffId` filters staff sale/invoice/draft queries; staff order actions cover PENDING→COMPLETED only (no cancel/return); roles reference STAFF-scope pages only; last enabled admin protected.
13. Every money/stock/status/access mutation writes an audit row with its narration.
