import {
  StockRowResponseSchema,
  MovementResponseSchema,
  ReservationResponseSchema,
  AdjustmentResultResponseSchema,
  MovementDirection,
  MovementType,
  ReservationHolderType,
  paginated,
  type StockRowDto,
  type MovementDto,
  type ReservationDto,
  type AdjustmentResultDto,
  type PaginatedResult,
} from "@dragon-telecom/contract";
import { mockProductWithPricing } from "./catalog.mock";

const PAGE_META = { page: 1, limit: 20, total: 1, totalPages: 1 };

export const mockStockRow: StockRowDto = StockRowResponseSchema.parse({
  productId: mockProductWithPricing.id,
  name: mockProductWithPricing.name,
  quantityOnHand: 10,
  quantityReserved: 2,
  availableQuantity: 8,
  averageCost: 3000,
  stockValue: 30000,
  reorderThreshold: 3,
  isLow: false,
});

export const mockStockRows: StockRowDto[] = [mockStockRow];

// SUPPLIER_INVOICE movement (IN) — unitCost/costOfGoods/profit absent (only SALE/ORDER_OUT
// movements carry cost-of-goods/profit; a supplier delivery has no revenue side).
export const mockMovementIn: MovementDto = MovementResponseSchema.parse({
  id: "b0000000-0000-4000-8000-000000000001",
  productId: mockProductWithPricing.id,
  productName: mockProductWithPricing.name,
  direction: MovementDirection.IN,
  type: MovementType.SUPPLIER_INVOICE,
  quantity: 10,
  unitCost: 3000,
  remainingQuantity: 10,
  balanceAfter: 10,
  referenceType: "SupplierInvoice",
  referenceId: "b0000000-0000-4000-8000-000000000010",
  referenceLabel: "INV-0001",
  staffName: "Amine Belkacem",
  createdAt: "2026-01-05T00:00:00.000Z",
});

// SALE movement (OUT) — costOfGoods/profit present (admin-only optionals, populated here).
export const mockMovementOut: MovementDto = MovementResponseSchema.parse({
  id: "b0000000-0000-4000-8000-000000000002",
  productId: mockProductWithPricing.id,
  productName: mockProductWithPricing.name,
  direction: MovementDirection.OUT,
  type: MovementType.SALE,
  quantity: 1,
  costOfGoods: 3000,
  profit: 1500,
  balanceAfter: 9,
  referenceType: "Sale",
  referenceId: "b0000000-0000-4000-8000-000000000011",
  referenceLabel: "SALE-0001",
  staffName: "Sara Haddad",
  createdAt: "2026-01-06T00:00:00.000Z",
});

export const mockMovementsPaginated: PaginatedResult<MovementDto> = paginated(
  MovementResponseSchema,
).parse({
  items: [mockMovementIn, mockMovementOut],
  meta: { ...PAGE_META, total: 2 },
});

export const mockReservation: ReservationDto = ReservationResponseSchema.parse({
  productId: mockProductWithPricing.id,
  productName: mockProductWithPricing.name,
  quantity: 2,
  holderType: ReservationHolderType.ORDER,
  holderReference: "ORD-0002",
  ageHours: 1,
});

export const mockReservationsPaginated: PaginatedResult<ReservationDto> = paginated(
  ReservationResponseSchema,
).parse({ items: [mockReservation], meta: { ...PAGE_META, total: 1 } });

export const mockAdjustmentResult: AdjustmentResultDto = AdjustmentResultResponseSchema.parse({
  reference: "ADJ-0001",
  lines: [
    {
      productId: mockProductWithPricing.id,
      delta: -2,
      movementId: "b0000000-0000-4000-8000-000000000003",
    },
  ],
});
