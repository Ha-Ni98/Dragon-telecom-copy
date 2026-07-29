import { faker } from '@faker-js/faker';
import { prisma } from '../../src/common/db/prisma';
import {
  AuthType,
  OrderStatus,
  type ClientsEvents,
  type IdentityEvents,
  type OrdersEvents,
  type CatalogEvents,
  type PlatformEvents,
} from '@dragon-telecom/contract';

export type SeedAuditLogOptions = {
  actionType?: string;
  entityType?: string;
  entityId?: string;
  description?: string;
  userId?: string;
  ipAddress?: string;
};

export const seedAuditLog = async (options: SeedAuditLogOptions = {}) =>
  prisma.auditLog.create({
    data: {
      actionType: options.actionType ?? 'settings.changed',
      entityType: options.entityType ?? 'Settings',
      entityId: options.entityId ?? faker.string.uuid(),
      description: options.description ?? faker.lorem.sentence(),
      ...(options.userId != null ? { userId: options.userId } : {}),
      ...(options.ipAddress != null ? { ipAddress: options.ipAddress } : {}),
    },
  });

// Representative sample payloads spanning the listener's narration patterns — verbatim
// `description` (settings.changed/deliveryFees.changed), structured status-change
// (order.statusChanged), structured credit-change (posClient.creditChanged), a plain
// actor-bearing event (auth.loggedIn), and the activity-side product.searched handler. Not an
// exhaustive one-per-event registry (~30 would be speculative before the listener spec exists —
// see Sprint O1 report); each is `satisfies`-checked against the real contract event type so it
// can't silently drift from the payload observability.listener.ts (Sprint O3) will actually
// receive.
export const SAMPLE_EVENTS = {
  'auth.loggedIn': {
    userId: faker.string.uuid(),
    authType: AuthType.STAFF,
    ipAddress: '10.0.0.5',
  } satisfies IdentityEvents['auth.loggedIn'],
  'settings.changed': {
    description: 'Settings updated: delivery.defaultHome: 500 → 700',
  } satisfies PlatformEvents['settings.changed'],
  'deliveryFees.changed': {
    description: 'Updated 1 delivery fee row(s)',
  } satisfies PlatformEvents['deliveryFees.changed'],
  'order.statusChanged': {
    orderId: faker.string.uuid(),
    fromStatus: OrderStatus.CONFIRMED,
    toStatus: OrderStatus.PACKAGED,
  } satisfies OrdersEvents['order.statusChanged'],
  'posClient.creditChanged': {
    posClientId: faker.string.uuid(),
    previousCredit: 1500,
    newCredit: 3200,
    cause: 'sale SAL-2026-0088',
  } satisfies ClientsEvents['posClient.creditChanged'],
  'product.searched': {
    userId: faker.string.uuid(),
    query: 'usb-c cable',
  } satisfies CatalogEvents['product.searched'],
} as const;
