import { describe, it, expect } from 'vitest';
import type { Client, PosClient } from '@prisma/client';
import { Prisma, ClientStatus as PrismaClientStatus } from '@prisma/client';
import { ClientStatus, PhoneAvailability, type ProductWithPricingDto } from '@dragon-telecom/contract';
import {
  ClientsMapper,
  type AdminClientRow,
  type ClientMeRow,
  type PosClientRow,
} from '../../../../src/modules/clients/clients.mapper';

const now = new Date('2026-01-01T00:00:00.000Z');

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const WILAYA_ID = '22222222-2222-4222-8222-222222222222';
const COMMUNE_ID = '33333333-3333-4333-8333-333333333333';
const POS_CLIENT_ID = '44444444-4444-4444-8444-444444444444';
const CATEGORY_ID = '55555555-5555-4555-8555-555555555555';
const PRODUCT_ID = '66666666-6666-4666-8666-666666666666';

const buildClientRow = (overrides: Partial<Client> = {}): Client => ({
  id: CLIENT_ID,
  userId: null,
  code: 'CLI-ABC12345',
  firstName: 'John',
  lastName: 'Doe',
  storeName: null,
  phone: '0550000000',
  email: null,
  wilayaId: WILAYA_ID,
  communeId: COMMUNE_ID,
  address: null,
  status: PrismaClientStatus.PENDING,
  approvedAt: null,
  approvedByStaffId: null,
  rejectionReason: null,
  posClientId: null,
  isEnabled: true,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const buildPosClientRow = (overrides: Partial<PosClient> = {}): PosClient => ({
  id: POS_CLIENT_ID,
  code: 'POS-ABC12345',
  name: 'John Doe',
  phone: null,
  categoryId: null,
  credit: new Prisma.Decimal(0),
  totalPaid: new Prisma.Decimal(0),
  totalSold: new Prisma.Decimal(0),
  isEnabled: true,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const buildProductWithPricing = (overrides: Partial<ProductWithPricingDto> = {}): ProductWithPricingDto => ({
  id: PRODUCT_ID,
  name: 'Screen Protector',
  createdAt: now.toISOString(),
  brand: { id: '77777777-7777-4777-8777-777777777777', name: 'Samsung' },
  family: { id: '88888888-8888-4888-8888-888888888888', name: 'Screens' },
  images: [],
  priceHidden: false,
  inStock: true,
  inCart: true,
  ...overrides,
});

describe('ClientsMapper', () => {
  describe('toValidatePhoneDto', () => {
    it.each([
      [true, PhoneAvailability.AVAILABLE],
      [false, PhoneAvailability.REGISTERED],
      [false, PhoneAvailability.PENDING],
    ] as const)('assembles + parses isValid=%s, status=%s', (isValid, status) => {
      const dto = ClientsMapper.toValidatePhoneDto(isValid, status);
      expect(dto).toEqual({ isValid, status });
    });
  });

  describe('toClientMeDto', () => {
    it('excludes category and raw status — never present on the DTO', () => {
      const row: ClientMeRow = { ...buildClientRow(), posClient: null };
      const dto = ClientsMapper.toClientMeDto(row);

      expect(dto).not.toHaveProperty('status');
      expect(dto).not.toHaveProperty('category');
    });

    it('proxies money from the linked PosClient, Decimal→number', () => {
      const row: ClientMeRow = {
        ...buildClientRow({ posClientId: POS_CLIENT_ID }),
        posClient: {
          credit: new Prisma.Decimal('1500.50'),
          totalPaid: new Prisma.Decimal('3000'),
          totalSold: new Prisma.Decimal('4500'),
        },
      };

      const dto = ClientsMapper.toClientMeDto(row);

      expect(dto.credit).toBe(1500.5);
      expect(dto.totalPaid).toBe(3000);
      expect(dto.totalSold).toBe(4500);
    });

    it('defaults money to 0 when no PosClient is linked yet (still PENDING)', () => {
      const row: ClientMeRow = { ...buildClientRow(), posClient: null };
      const dto = ClientsMapper.toClientMeDto(row);

      expect(dto.credit).toBe(0);
      expect(dto.totalPaid).toBe(0);
      expect(dto.totalSold).toBe(0);
    });

    it('converts createdAt to an ISO string and omits null optionals', () => {
      const row: ClientMeRow = { ...buildClientRow({ email: null, storeName: null, address: null }), posClient: null };
      const dto = ClientsMapper.toClientMeDto(row);

      expect(dto.createdAt).toBe(now.toISOString());
      expect(dto).not.toHaveProperty('email');
      expect(dto).not.toHaveProperty('storeName');
      expect(dto).not.toHaveProperty('address');
    });

    it('includes optionals when present', () => {
      const row: ClientMeRow = {
        ...buildClientRow({ email: 'john@example.com', storeName: 'Johns Shop', address: '12 Main St' }),
        posClient: null,
      };
      const dto = ClientsMapper.toClientMeDto(row);

      expect(dto.email).toBe('john@example.com');
      expect(dto.storeName).toBe('Johns Shop');
      expect(dto.address).toBe('12 Main St');
    });
  });

  describe('toAdminClientDto', () => {
    it('composes fullName and maps wilaya/commune French names', () => {
      const row: AdminClientRow = {
        ...buildClientRow(),
        wilaya: { frName: 'Alger' },
        commune: { frName: 'Bab El Oued' },
        user: null,
        posClient: null,
      };

      const dto = ClientsMapper.toAdminClientDto(row, { totalOrders: 0, totalSpent: 0 });

      expect(dto.fullName).toBe('John Doe');
      expect(dto.wilayaFr).toBe('Alger');
      expect(dto.communeFr).toBe('Bab El Oued');
    });

    it('passes the raw ClientStatus enum through (admin view, unlike ClientMeDto)', () => {
      const row: AdminClientRow = {
        ...buildClientRow({ status: PrismaClientStatus.APPROVED }),
        wilaya: { frName: 'Alger' },
        commune: { frName: 'Bab El Oued' },
        user: null,
        posClient: null,
      };

      const dto = ClientsMapper.toAdminClientDto(row, { totalOrders: 0, totalSpent: 0 });

      expect(dto.status).toBe(ClientStatus.APPROVED);
    });

    it('includes username/categoryName/posClientId only when present', () => {
      const row: AdminClientRow = {
        ...buildClientRow({ posClientId: POS_CLIENT_ID }),
        wilaya: { frName: 'Alger' },
        commune: { frName: 'Bab El Oued' },
        user: { username: 'johndoe' },
        posClient: { id: POS_CLIENT_ID, category: { name: 'Gold' } },
      };

      const dto = ClientsMapper.toAdminClientDto(row, { totalOrders: 0, totalSpent: 0 });

      expect(dto.username).toBe('johndoe');
      expect(dto.categoryName).toBe('Gold');
      expect(dto.posClientId).toBe(POS_CLIENT_ID);
    });

    it('omits username/categoryName/posClientId/lastOrderDate when absent', () => {
      const row: AdminClientRow = {
        ...buildClientRow(),
        wilaya: { frName: 'Alger' },
        commune: { frName: 'Bab El Oued' },
        user: null,
        posClient: null,
      };

      const dto = ClientsMapper.toAdminClientDto(row, { totalOrders: 0, totalSpent: 0 });

      expect(dto).not.toHaveProperty('username');
      expect(dto).not.toHaveProperty('categoryName');
      expect(dto).not.toHaveProperty('posClientId');
      expect(dto).not.toHaveProperty('lastOrderDate');
    });

    it('passes through the roll-up counters (order/sale aggregates computed by the caller)', () => {
      const row: AdminClientRow = {
        ...buildClientRow(),
        wilaya: { frName: 'Alger' },
        commune: { frName: 'Bab El Oued' },
        user: null,
        posClient: null,
      };

      const dto = ClientsMapper.toAdminClientDto(row, {
        totalOrders: 4,
        totalSpent: 12000,
        lastOrderDate: now,
      });

      expect(dto.totalOrders).toBe(4);
      expect(dto.totalSpent).toBe(12000);
      expect(dto.lastOrderDate).toBe(now.toISOString());
    });
  });

  describe('toPosClientDto', () => {
    it('converts Decimal money fields to numbers', () => {
      const row: PosClientRow = {
        ...buildPosClientRow({ credit: new Prisma.Decimal('-250.75'), totalPaid: new Prisma.Decimal('1000'), totalSold: new Prisma.Decimal('1250.75') }),
        category: null,
        linkedClient: null,
      };

      const dto = ClientsMapper.toPosClientDto(row);

      expect(dto.credit).toBe(-250.75);
      expect(dto.totalPaid).toBe(1000);
      expect(dto.totalSold).toBe(1250.75);
    });

    it('includes categoryName/linkedClientId only when present', () => {
      const row: PosClientRow = {
        ...buildPosClientRow({ categoryId: CATEGORY_ID }),
        category: { name: 'Wholesale' },
        linkedClient: { id: CLIENT_ID },
      };

      const dto = ClientsMapper.toPosClientDto(row);

      expect(dto.categoryName).toBe('Wholesale');
      expect(dto.linkedClientId).toBe(CLIENT_ID);
    });

    it('omits categoryName/linkedClientId/phone when absent', () => {
      const row: PosClientRow = { ...buildPosClientRow(), category: null, linkedClient: null };

      const dto = ClientsMapper.toPosClientDto(row);

      expect(dto).not.toHaveProperty('categoryName');
      expect(dto).not.toHaveProperty('linkedClientId');
      expect(dto).not.toHaveProperty('phone');
    });
  });

  describe('toCartItemDto', () => {
    it('assembles the cart row with the pre-resolved product — never rebuilds pricing', () => {
      const product = buildProductWithPricing();
      const dto = ClientsMapper.toCartItemDto({ productId: PRODUCT_ID, addedAt: now }, product);

      expect(dto).toEqual({ productId: PRODUCT_ID, addedAt: now.toISOString(), product });
    });
  });

  describe('toClientStatsDto', () => {
    it('assembles + parses the five counters', () => {
      const dto = ClientsMapper.toClientStatsDto({
        totalClients: 10,
        pending: 3,
        approved: 6,
        rejected: 1,
        newThisMonth: 2,
      });
      expect(dto).toEqual({ totalClients: 10, pending: 3, approved: 6, rejected: 1, newThisMonth: 2 });
    });
  });
});
