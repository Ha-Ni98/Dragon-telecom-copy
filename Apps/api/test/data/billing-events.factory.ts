import { faker } from '@faker-js/faker';
import { SaleOrigin, type OrdersEvents, type SalesEvents } from '@dragon-telecom/contract';

// Not schema-validated (event payloads are plain TS types, not zod schemas) — plain builders for
// billing.listener.ts's issueFromSale/issueFromOrder (plan §II.4).
export const buildSaleConfirmedEvent = (
  overrides: Partial<SalesEvents['sale.confirmed']> = {},
): SalesEvents['sale.confirmed'] => ({
  saleId: faker.string.uuid(),
  origin: SaleOrigin.POS,
  totalAmount: 1000,
  paidAmount: 1000,
  snapshotLines: [
    { productId: faker.string.uuid(), productName: 'Test Product', quantity: 1, unitPrice: 1000, lineTotal: 1000 },
  ],
  ...overrides,
});

export const buildOrderConfirmedEvent = (
  overrides: Partial<OrdersEvents['order.confirmed']> = {},
): OrdersEvents['order.confirmed'] => ({
  orderId: faker.string.uuid(),
  snapshotLine: { productId: faker.string.uuid(), productName: 'Test Product', quantity: 1, unitPrice: 1000, lineTotal: 1000 },
  totals: { subtotal: 1000, deliveryFee: 0, totalAmount: 1000, paidAmount: 1000 },
  confirmedByStaffId: faker.string.uuid(),
  ...overrides,
});
