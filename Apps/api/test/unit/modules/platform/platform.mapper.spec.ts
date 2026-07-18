import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import type { Commune, Wilaya } from '@prisma/client';
import { FeeSource, WilayaResponseSchema, SettingsResponseSchema, PublicSettingsResponseSchema, AdminFeesResponseSchema } from '@dragon-telecom/contract';
import { PlatformMapper } from '../../../../src/modules/platform/platform.mapper';
import { DEFAULT_SETTINGS } from '../../../../prisma/settings-defaults';

const WILAYA_ID = '11111111-1111-4111-8111-111111111111';
const COMMUNE_A_ID = '22222222-2222-4222-8222-222222222222';
const COMMUNE_B_ID = '33333333-3333-4333-8333-333333333333';

const buildWilaya = (overrides: Partial<Wilaya> = {}): Wilaya => ({
  id: WILAYA_ID,
  wilayaCode: '30',
  frName: 'Ouargla',
  arName: 'ورقلة',
  ...overrides,
});

const buildCommune = (overrides: Partial<Commune> = {}): Commune => ({
  id: COMMUNE_A_ID,
  communeCode: '1101',
  wilayaId: WILAYA_ID,
  frName: 'Ouargla',
  arName: 'ورقلة',
  ...overrides,
});

describe('PlatformMapper', () => {
  describe('toWilayaDto', () => {
    it('carries both languages and nested communes', () => {
      const wilaya = buildWilaya();
      const communeA = buildCommune();
      const communeB = buildCommune({ id: COMMUNE_B_ID, communeCode: '1102', frName: 'Rouissat', arName: 'الرويسات' });

      const dto = PlatformMapper.toWilayaDto({ ...wilaya, communes: [communeA, communeB] });

      expect(dto.frName).toBe('Ouargla');
      expect(dto.arName).toBe('ورقلة');
      expect(dto.communes).toHaveLength(2);
      expect(dto.communes[0]).toEqual({
        id: COMMUNE_A_ID,
        communeCode: '1101',
        frName: 'Ouargla',
        arName: 'ورقلة',
      });
      expect(() => WilayaResponseSchema.parse(dto)).not.toThrow();
    });

    it('parses against WilayaResponseSchema (conformance)', () => {
      const dto = PlatformMapper.toWilayaDto({ ...buildWilaya(), communes: [] });
      expect(WilayaResponseSchema.safeParse(dto).success).toBe(true);
    });
  });

  describe('toFeeDto', () => {
    it('converts a Prisma Decimal to a number', () => {
      const dto = PlatformMapper.toFeeDto(new Prisma.Decimal('500.00'), new Prisma.Decimal('300.00'), FeeSource.COMMUNE);
      expect(dto.deliveryHome).toBe(500);
      expect(dto.deliveryOffice).toBe(300);
      expect(typeof dto.deliveryHome).toBe('number');
    });

    it('passes a plain number through unchanged', () => {
      const dto = PlatformMapper.toFeeDto(500, 300, FeeSource.DEFAULT);
      expect(dto.deliveryHome).toBe(500);
      expect(dto.deliveryOffice).toBe(300);
    });

    it.each([FeeSource.COMMUNE, FeeSource.WILAYA, FeeSource.DEFAULT])('reflects source=%s', (source) => {
      const dto = PlatformMapper.toFeeDto(100, 100, source);
      expect(dto.source).toBe(source);
    });
  });

  describe('toSettingsDto', () => {
    it('merges in defaults for entirely-missing sections', () => {
      const rows = [{ key: 'store', value: JSON.stringify({ name: 'Custom Store' }) }];

      const dto = PlatformMapper.toSettingsDto(rows);

      expect(dto.store.name).toBe('Custom Store');
      expect(dto.invoicing).toEqual(DEFAULT_SETTINGS.invoicing);
      expect(dto.delivery).toEqual(DEFAULT_SETTINGS.delivery);
      expect(dto.storefront).toEqual(DEFAULT_SETTINGS.storefront);
    });

    it('uses every present row and parses against SettingsResponseSchema', () => {
      const rows = [
        { key: 'store', value: JSON.stringify({ name: 'Dragon Telecom' }) },
        { key: 'invoicing', value: JSON.stringify(DEFAULT_SETTINGS.invoicing) },
        { key: 'delivery', value: JSON.stringify({ defaultHome: 700, defaultOffice: 400 }) },
        { key: 'storefront', value: JSON.stringify({ featuredProductIds: [] }) },
      ];

      const dto = PlatformMapper.toSettingsDto(rows);

      expect(dto.delivery).toEqual({ defaultHome: 700, defaultOffice: 400 });
      expect(SettingsResponseSchema.safeParse(dto).success).toBe(true);
    });

    it('returns full defaults for a fresh DB with no rows at all', () => {
      const dto = PlatformMapper.toSettingsDto([]);
      expect(dto).toEqual(DEFAULT_SETTINGS);
      expect(SettingsResponseSchema.safeParse(dto).success).toBe(true);
    });
  });

  describe('toPublicSettingsDto', () => {
    it('exposes only the storefront section', () => {
      const settings = PlatformMapper.toSettingsDto([]);

      const dto = PlatformMapper.toPublicSettingsDto(settings);

      expect(dto).toEqual({ storefront: settings.storefront });
      expect(Object.keys(dto)).toEqual(['storefront']);
      expect(PublicSettingsResponseSchema.safeParse(dto).success).toBe(true);
    });
  });

  describe('toAdminFeesDto', () => {
    const wilaya = { ...buildWilaya(), communes: [buildCommune(), buildCommune({ id: COMMUNE_B_ID, communeCode: '1102' })] };

    it('falls back to settings defaults when no wilaya-level fee row exists', () => {
      const dto = PlatformMapper.toAdminFeesDto([wilaya], [], { defaultHome: 500, defaultOffice: 300 });

      expect(dto.wilayas).toHaveLength(1);
      expect(dto.wilayas[0]?.deliveryHome).toBe(500);
      expect(dto.wilayas[0]?.deliveryOffice).toBe(300);
      expect(dto.wilayas[0]?.communes).toHaveLength(0);
    });

    it('uses the wilaya-level fee row when present, and lists only communes with an explicit override', () => {
      const fees = [
        { wilayaId: WILAYA_ID, communeId: null, deliveryHome: new Prisma.Decimal('600'), deliveryOffice: new Prisma.Decimal('350') },
        { wilayaId: WILAYA_ID, communeId: COMMUNE_A_ID, deliveryHome: 800, deliveryOffice: 450 },
      ];

      const dto = PlatformMapper.toAdminFeesDto([wilaya], fees, { defaultHome: 500, defaultOffice: 300 });

      expect(dto.wilayas[0]?.deliveryHome).toBe(600);
      expect(dto.wilayas[0]?.deliveryOffice).toBe(350);
      expect(dto.wilayas[0]?.communes).toHaveLength(1);
      expect(dto.wilayas[0]?.communes[0]).toMatchObject({ communeId: COMMUNE_A_ID, deliveryHome: 800, deliveryOffice: 450 });
      expect(AdminFeesResponseSchema.safeParse(dto).success).toBe(true);
    });
  });
});
