# Module: repairs
Back-office only — no public surface, no repair invoices. Technicians have no user accounts (identity module registry).

## Shared Conventions (self-contained — no other file needed)
- Every response: `ApiResponse<T>` (`sendSuccess` wraps; frontend unwraps `data`). Zod 4; types via `z.infer`; dates as ISO strings. Inputs `XxxCommand`/`XxxQuery`, outputs `XxxDto`, routes `[MODULE]_ROUTES` with UPPERCASE keys. Lists use `PaginationInfo`.
- Money: decimal DZD. **Cash only** — no payment-method field exists anywhere.
- **No delete endpoints** — `isEnabled` PATCH toggles. Notes, reasons, email: always `.optional()`.
- Access levels: `public` · `client` (JWT type CLIENT) · `staff(PAGE_KEY)` (JWT type STAFF + page in effective set; data scoped where stated) · `admin` (type ADMIN — all pages, unscoped data).
- **Connection rule:** needs a return value inside the caller's transaction ⇒ **injected service** (`InventoryService`, `SequenceService`, `DeliveryFeeService`); mirrors state elsewhere ⇒ **domain event**, emitted after commit, listener idempotent by source-document id. Event payloads are contract DTOs, named past-tense.
- Confirmed/issued documents are immutable snapshots; corrections are cancellations or return documents. Every money/stock/status/access mutation emits an event the audit module narrates.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `REPAIR_ROUTES.LIST` | GET `/api/(staff|admin)/repairs?status=&technicianId=` | staff(STAFF_REPAIRS: created-by-me)\|admin | board data |
| `REPAIR_ROUTES.CREATE` | POST `/api/(staff|admin)/repairs` | staff(STAFF_REPAIRS)\|admin | intake + claim slip |
| `REPAIR_ROUTES.UPDATE` | PATCH `.../repairs/:id` | staff\|admin | diagnosis?, labourPrice, technicianId |
| `REPAIR_ROUTES.PARTS` | POST/DELETE `.../repairs/:id/parts(/:partId)` | staff\|admin | reserve / release |
| `REPAIR_ROUTES.STATUS` | POST `.../repairs/:id/status` | staff\|admin | transitions |

```
RepairStatus = 'INTAKE'|'PROCESSING'|'COMPLETED'|'PICKED_UP'|'CANCELLED'
ReportedIssue = 'charging'|'display'|'battery'|'camera'|'speaker'|'microphone'|'water-damage'|'software'|'other'
CreateRepairCommand { posClientId?; customerName; customerPhone;
  brandId?; deviceModelId?; deviceLabel?; deviceImei?;
  reportedIssues: ReportedIssue[].min(1); reportedIssueOther?; technicianId? }
AddRepairPartCommand { productId; quantity; unitPrice; serialNumbers? }
RepairStatusCommand { toStatus; note?; paidAmount?;                       // paidAmount at PICKED_UP
  consumedPartReturns?: { partId; restock: boolean }[] }                 // only for CANCELLED after consumption
RepairDto { id; reference; status; customerName; customerPhone; posClientId?;
  device { brand?; model?; label?; imei? }; reportedIssues; reportedIssueOther?; diagnosis?;
  technician? { id; name }; labourPrice; partsTotal; totalAmount; paidAmount;
  totalCost?; totalProfit?;                                               // admin mapping only
  intakeAt; completedAt?; pickedUpAt?; ageHours;
  parts: { id; productId; productName; quantity; unitPrice; costOfGoods?; profit?; lineTotal; serialNumbers? }[];
  history: { fromStatus; toStatus; note?; staffName; changedAt }[] }
```

## Events [CONTRACT]
- Emits `repair.pickedUp { repairId; posClientId?; totalAmount; paidAmount; totalCost; totalProfit; snapshotParts; labourPrice }` — **sales module** records the repair-origin sale (no invoice).
- Emits `repair.statusChanged`, `repair.cancelled` (audit).
- Listens: none — stock via injected `InventoryService`.

## Business Logic [BACKEND]
1. Intake: `SequenceService('REPAIR')`; claim slip printed with the reference — the customer's only handle. Attaching a POS client prefills name/phone.
2. Parts: add → `reserve(PENDING_REPAIR)` (shortfall 409 names the product); remove → `release`. `partsTotal`/`totalAmount = labour + parts` maintained.
3. Transitions — `INTAKE→PROCESSING`: technicianId required (400). `PROCESSING→COMPLETED` (**idempotent**): per part `release` + `consumeFifo(REPAIR_CONSUMPTION, revenue = unitPrice×qty)` → part costOfGoods/profit, repair totals. `COMPLETED→PICKED_UP`: cash paidAmount, pickedUpAt, `saleId` back-link written by the sales listener → emit. `CANCELLED` from any state (reason optional): release pending parts; **already-consumed parts return only through explicit `consumedPartReturns`** (restock ⇒ returnIn at consumed cost).
4. Diagnosis and every note optional. reportedIssues validated against the enum; `other` unlocks free text.

## Test Scenarios [BACKEND]
Processing without technician 400. Part add reserves; delete releases. Double COMPLETE: one consumption. Pickup emits once; sales replay-safe. Cancel post-consumption without the returns block leaves stock untouched; with restock re-enters at consumed cost. Staff sees only tickets he created; admin all.
