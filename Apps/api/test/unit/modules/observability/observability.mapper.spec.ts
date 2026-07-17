import { describe, it, expect } from 'vitest';
import type { AuditLog, ClientActivityLog, Product, StaffSearchLog, User } from '@prisma/client';
import { ClientActivityType, Prisma, UserType as PrismaUserType } from '@prisma/client';
import {
  ClientActivityResponseSchema,
  StaffSearchResponseSchema,
  AuditLogResponseSchema,
  LogStatsResponseSchema,
} from '@dragon-telecom/contract';
import { ObservabilityMapper } from '../../../../src/modules/observability/observability.mapper';

const now = new Date('2026-01-01T00:00:00.000Z');
const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const AUDIT_ID = '44444444-4444-4444-8444-444444444444';

const buildClientActivity = (overrides: Partial<ClientActivityLog> = {}): ClientActivityLog => ({
  id: 'activity-1',
  clientId: CLIENT_ID,
  type: ClientActivityType.SEARCH,
  query: null,
  productId: null,
  durationSeconds: null,
  createdAt: now,
  ...overrides,
});

const buildProduct = (overrides: Partial<Product> = {}): Product => ({
  id: PRODUCT_ID,
  sku: 'SKU-1',
  barcode: null,
  name: 'Charger Cable',
  description: null,
  familyId: 'family-1',
  deviceModelId: null,
  guestPrice: null,
  defaultSalePrice: null,
  averageCost: new Prisma.Decimal(0),
  quantityOnHand: 0,
  quantityReserved: 0,
  reorderThreshold: 0,
  isPublished: false,
  isEnabled: true,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: USER_ID,
  username: 'johndoe',
  email: null,
  passwordHash: 'hashed',
  type: PrismaUserType.STAFF,
  isEnabled: true,
  lastLoginAt: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const buildStaffSearchLog = (overrides: Partial<StaffSearchLog> = {}): StaffSearchLog => ({
  id: 'search-1',
  userId: USER_ID,
  query: 'usb-c cable',
  matchedProductId: null,
  createdAt: now,
  ...overrides,
});

const buildAuditLog = (overrides: Partial<AuditLog> = {}): AuditLog => ({
  id: AUDIT_ID,
  userId: null,
  actionType: 'order.statusChanged',
  entityType: 'Order',
  entityId: 'order-1',
  description: 'Order order-1: status confirmed → packaged',
  ipAddress: null,
  createdAt: now,
  ...overrides,
});

describe('ObservabilityMapper', () => {
  describe('toClientActivityDto', () => {
    it('converts createdAt to ISO and omits query/product/durationSeconds when null', () => {
      const dto = ObservabilityMapper.toClientActivityDto({ ...buildClientActivity(), product: null });

      expect(dto.createdAt).toBe(now.toISOString());
      expect(dto).not.toHaveProperty('query');
      expect(dto).not.toHaveProperty('product');
      expect(dto).not.toHaveProperty('durationSeconds');
      expect(ClientActivityResponseSchema.safeParse(dto).success).toBe(true);
    });

    it('includes the joined product when present, and durationSeconds for PRODUCT_VIEW', () => {
      const dto = ObservabilityMapper.toClientActivityDto({
        ...buildClientActivity({ type: ClientActivityType.PRODUCT_VIEW, productId: PRODUCT_ID, durationSeconds: 42 }),
        product: buildProduct(),
      });

      expect(dto.product).toEqual({ id: PRODUCT_ID, name: 'Charger Cable' });
      expect(dto.durationSeconds).toBe(42);
      expect(ClientActivityResponseSchema.safeParse(dto).success).toBe(true);
    });
  });

  describe('toStaffSearchDto', () => {
    it('takes userName from the joined user and omits matchedProduct when null', () => {
      const dto = ObservabilityMapper.toStaffSearchDto({ ...buildStaffSearchLog(), user: buildUser(), matchedProduct: null });

      expect(dto.userName).toBe('johndoe');
      expect(dto).not.toHaveProperty('matchedProduct');
      expect(StaffSearchResponseSchema.safeParse(dto).success).toBe(true);
    });

    it('includes matchedProduct when present', () => {
      const dto = ObservabilityMapper.toStaffSearchDto({
        ...buildStaffSearchLog({ matchedProductId: PRODUCT_ID }),
        user: buildUser(),
        matchedProduct: buildProduct(),
      });

      expect(dto.matchedProduct).toEqual({ id: PRODUCT_ID, name: 'Charger Cable' });
    });
  });

  describe('toAuditLogDto', () => {
    it('omits user when null and passes actionType through as an arbitrary string', () => {
      const dto = ObservabilityMapper.toAuditLogDto({ ...buildAuditLog(), user: null });

      expect(dto).not.toHaveProperty('user');
      expect(dto.actionType).toBe('order.statusChanged');
      expect(dto).not.toHaveProperty('ipAddress');
      expect(AuditLogResponseSchema.safeParse(dto).success).toBe(true);
    });

    it('includes user and ipAddress when present, and accepts a never-before-seen actionType', () => {
      const dto = ObservabilityMapper.toAuditLogDto({
        ...buildAuditLog({ actionType: 'some.brandNewEvent', userId: USER_ID, ipAddress: '10.0.0.1' }),
        user: buildUser(),
      });

      expect(dto.user).toEqual({ id: USER_ID, username: 'johndoe' });
      expect(dto.ipAddress).toBe('10.0.0.1');
      expect(dto.actionType).toBe('some.brandNewEvent');
      expect(AuditLogResponseSchema.safeParse(dto).success).toBe(true);
    });
  });

  describe('toLogStatsDto', () => {
    it('passes counts through and parses LogStatsResponseSchema', () => {
      const dto = ObservabilityMapper.toLogStatsDto({ total: 100, today: 5, week: 20, month: 60 });
      expect(dto).toEqual({ total: 100, today: 5, week: 20, month: 60 });
      expect(LogStatsResponseSchema.safeParse(dto).success).toBe(true);
    });
  });
});
