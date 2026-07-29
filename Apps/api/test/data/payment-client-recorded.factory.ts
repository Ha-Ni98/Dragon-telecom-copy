import { faker } from '@faker-js/faker';
import type { BillingEvents } from '@dragon-telecom/contract';

// Not schema-validated (event payloads are plain TS types, not zod schemas) — mirrors
// repair-picked-up.factory.ts's buildRepairPickedUpEvent. Consumed by orders.listener.ts
// (plan §C-2/§I.2).
export const buildPaymentClientRecordedEvent = (
  overrides: Partial<BillingEvents['payment.clientRecorded']> = {},
): BillingEvents['payment.clientRecorded'] => ({
  paymentId: faker.string.uuid(),
  posClientId: faker.string.uuid(),
  amount: 100,
  previousCredit: 200,
  newCredit: 100,
  ...overrides,
});
