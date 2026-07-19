import { faker } from '@faker-js/faker';
import { OrderType, PlaceOrderSchema, type PlaceOrderCommand } from '@dragon-telecom/contract';

// Defaults to PICKUP (no delivery block); pass { orderType: OrderType.DELIVERY_HOME |
// DELIVERY_OFFICE } to get the delivery variant — the delivery block is filled in
// automatically whenever the resolved orderType requires it, matching the schema's own
// required-unless-PICKUP / forbidden-when-PICKUP refinement (orders.command.ts).
export const makePlaceOrderCommand = (overrides: Partial<PlaceOrderCommand> = {}): PlaceOrderCommand => {
  const orderType = overrides.orderType ?? OrderType.PICKUP;
  const isDelivery = orderType !== OrderType.PICKUP;

  return PlaceOrderSchema.parse({
    productId: faker.string.uuid(),
    quantity: 1,
    orderType,
    contact: { fullName: faker.person.fullName(), phone: faker.string.numeric(10) },
    ...(isDelivery ? { delivery: { wilayaId: faker.string.uuid(), communeId: faker.string.uuid() } } : {}),
    ...overrides,
  });
};
