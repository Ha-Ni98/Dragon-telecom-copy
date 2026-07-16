# Module: inventory
The FIFO ledger: movements, layers, reserve/release/consume engine, adjustments. **Owns Product.quantityOnHand / quantityReserved / averageCost.**

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
| `INVENTORY_ROUTES.STOCK` | GET `/api/admin/inventory/stock?lowStockOnly=` | admin | levels + stock value; CSV export param |
| `INVENTORY_ROUTES.MOVEMENTS` | GET `/api/admin/inventory/movements` | admin | filters product/type/date/staff |
| `INVENTORY_ROUTES.RESERVATIONS` | GET `/api/admin/inventory/reservations` | admin | holder + age |
| `INVENTORY_ROUTES.ADJUSTMENTS` | POST `/api/admin/inventory/adjustments` | admin | |

```
StockRowDto { productId; name; barcode?; quantityOnHand; quantityReserved; availableQuantity;
              averageCost; stockValue; reorderThreshold; isLow }
MovementDto { id; productId; productName; direction: 'IN'|'OUT'|'PENDING'; type: MovementType;
  quantity; unitCost?; remainingQuantity?;            // IN rows (live FIFO layer)
  costOfGoods?; profit?;                              // OUT rows
  balanceAfter; referenceType; referenceId; referenceLabel; reason?; staffName; createdAt }
MovementType = 'SUPPLIER_INVOICE'|'INITIAL_STOCK'|'ADJUSTMENT_IN'|'RETURN_IN'
             | 'SALE'|'ORDER_OUT'|'REPAIR_CONSUMPTION'|'ADJUSTMENT_OUT'
             | 'PENDING_ORDER'|'PENDING_REPAIR'|'PENDING_RELEASE'
ReservationDto { productId; productName; quantity; holderType: 'ORDER'|'REPAIR'; holderReference; ageHours }
CreateAdjustmentCommand { reason: 'COUNT'|'DAMAGE'|'LOSS'|'CORRECTION'; note?;
  lines: { productId; countedQuantity; unitCost?; prices?: UpdatePricingCommand }[] }
AdjustmentResultDto { reference; lines: { productId; delta; movementId }[] }
```

## Injected service [CONTRACT] — the dependency every document module receives
```
InventoryService {
  reserve(tx, productId, qty, ref)                          // PENDING_ORDER / PENDING_REPAIR
  release(tx, productId, qty, ref)                          // PENDING_RELEASE
  addLayer(tx, productId, qty, unitCost, type, ref) → { movementId }   // IN + avgCost recompute
  consumeFifo(tx, productId, qty, revenue|null, type, ref)
      → { movementId; costOfGoods; profit|null; consumptions: {inMovementId; qty; unitCost}[] }
  returnIn(tx, originalConsumptions, qty, ref) → { movementId }        // RETURN_IN at consumed cost
}
```
Callers: catalog (INITIAL_STOCK) · purchasing (addLayer per line) · orders (reserve/release/consume/returnIn) · sales (consume/returnIn) · repairs (reserve/release/consume/returnIn) · adjustments (internal).

## Events [CONTRACT]
- Emits `inventory.stockChanged { productId; onHand; reserved }`, `inventory.lowStock { productId; available; threshold }`, `inventory.adjusted { reference; description }` (audit/dashboard).
- Listens: **nothing** — state changes arrive only through the injected service (events can't return FIFO results, and splitting the transaction could leave a sale without its movement).

## Business Logic [BACKEND]
1. Every call writes movement rows **and** the product's quantity/averageCost columns inside the caller's transaction; `balanceAfter` on each row.
2. `consumeFifo` drains oldest layers with `remainingQuantity > 0`, writes StockMovementConsumption rows, rejects `INSUFFICIENT_STOCK { productId, requested, available }` when qty > onHand − reserved.
3. avgCost on IN only: `(oldQty×oldAvg + inQty×unitCost)/(oldQty+inQty)`.
4. Adjustments: IN deltas take `unitCost` (default = current avgCost) and may carry a reprice payload applied through the catalog pricing service in the same transaction; OUT deltas consume FIFO with `profit = null`. Note optional.
5. Low-stock check after every change; emit when available crosses ≤ threshold. Sequence via `SequenceService('ADJUSTMENT')`.

## Test Scenarios [BACKEND]
Layers 10@100 + 10@150, consume 15 ⇒ COGS 1750, layer 5@150 remains. Over-consume → 409, zero rows. reserve→release restores available. returnIn at 150 (not avg). balanceAfter chain under interleaving. Invariants: onHand = Σ movements; Σ remaining = onHand; reserved = Σ PENDING. Adjustment reprice atomic. ADJUSTMENT_OUT profit null.
