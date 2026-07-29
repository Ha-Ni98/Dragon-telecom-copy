import {
  OrderResponseSchema,
  OrderStatsResponseSchema,
  OrderStatus,
  OrderType,
  paginated,
  type OrderDto,
  type OrderStatsDto,
  type PaginatedResult,
} from "@dragon-telecom/contract";
import { mockProductWithPricing } from "./catalog.mock";
import { mockWilaya } from "./platform.mock";

const PAGE_META = { page: 1, limit: 20, total: 1, totalPages: 1 };

// PICKUP: no wilaya/commune/address/deliveryCompany/trackingNumber, deliveryFee 0.
export const mockOrderPickup: OrderDto = OrderResponseSchema.parse({
  id: "01000000-0000-4000-8000-000000000001",
  reference: "ORD-0001",
  status: OrderStatus.PENDING,
  orderType: OrderType.PICKUP,
  contactName: "Amine Belkacem",
  contactPhone: "0550000001",
  productId: mockProductWithPricing.id,
  productName: mockProductWithPricing.name,
  quantity: 1,
  resolvedPrice: 4500,
  unitPrice: 4500,
  subtotal: 4500,
  deliveryFee: 0,
  totalAmount: 4500,
  paidAmount: 0,
  placedAt: "2026-01-10T00:00:00.000Z",
  canBeCancelled: true,
  ageHours: 2,
});

// DELIVERY_HOME (admin viewer): wilaya/commune present, costOfGoods/profit populated
// (admin-only, staff mapper strips them — plan.md §2.6 edge case).
export const mockOrderDelivery: OrderDto = OrderResponseSchema.parse({
  id: "01000000-0000-4000-8000-000000000002",
  reference: "ORD-0002",
  status: OrderStatus.CONFIRMED,
  orderType: OrderType.DELIVERY_HOME,
  contactName: "Sara Haddad",
  contactPhone: "0550000002",
  wilaya: { id: mockWilaya.id, frName: mockWilaya.frName, arName: mockWilaya.arName },
  commune: {
    id: mockWilaya.communes[0].id,
    frName: mockWilaya.communes[0].frName,
    arName: mockWilaya.communes[0].arName,
  },
  address: "12 Rue Didouche Mourad",
  deliveryCompany: "Yalidine",
  trackingNumber: "YAL-000123",
  productId: mockProductWithPricing.id,
  productName: mockProductWithPricing.name,
  quantity: 2,
  resolvedPrice: 4500,
  unitPrice: 4500,
  subtotal: 9000,
  deliveryFee: 500,
  totalAmount: 9500,
  paidAmount: 9500,
  costOfGoods: 6000,
  profit: 3000,
  placedAt: "2026-01-11T00:00:00.000Z",
  confirmedAt: "2026-01-11T01:00:00.000Z",
  canBeCancelled: true,
  ageHours: 1,
});

export const mockOrdersList: OrderDto[] = [mockOrderPickup, mockOrderDelivery];

export const mockOrdersPaginated: PaginatedResult<OrderDto> = paginated(OrderResponseSchema).parse({
  items: mockOrdersList,
  meta: { ...PAGE_META, total: 2 },
});

export const mockOrderStats: OrderStatsDto = OrderStatsResponseSchema.parse({
  pending: 3,
  confirmed: 2,
  packaged: 1,
  inDelivery: 1,
  completed: 10,
  cancelled: 1,
  returned: 0,
});
