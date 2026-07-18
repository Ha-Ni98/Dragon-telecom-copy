import { describe, it, expect } from 'vitest';
import type { Brand, ClientCategory, DeviceModel, Family, Product, ProductImage } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { StockStatus } from '@dragon-telecom/contract';
import { CatalogMapper } from '../../../../src/modules/catalog/catalog.mapper';

const now = new Date('2026-01-01T00:00:00.000Z');

const BRAND_ID = '11111111-1111-4111-8111-111111111111';
const FAMILY_ID = '22222222-2222-4222-8222-222222222222';
const MODEL_ID = '33333333-3333-4333-8333-333333333333';
const PRODUCT_ID = '44444444-4444-4444-8444-444444444444';

const buildBrand = (overrides: Partial<Brand> = {}): Brand => ({
  id: BRAND_ID,
  name: 'Samsung',
  slug: 'samsung',
  logoUrl: null,
  isEnabled: true,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const buildFamily = (overrides: Partial<Family> = {}): Family => ({
  id: FAMILY_ID,
  name: 'Screens',
  slug: 'screens',
  iconUrl: null,
  parentId: null,
  isUniversal: false,
  isFeatured: false,
  isEnabled: true,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const buildDeviceModel = (overrides: Partial<DeviceModel> = {}): DeviceModel => ({
  id: MODEL_ID,
  brandId: BRAND_ID,
  name: 'Galaxy S21',
  slug: 'galaxy-s21',
  isEnabled: true,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const IMAGE_ID = '66666666-6666-4666-8666-666666666666';

const buildImage = (overrides: Partial<ProductImage> = {}): ProductImage => ({
  id: IMAGE_ID,
  productId: PRODUCT_ID,
  url: 'https://example.com/image.jpg',
  alt: null,
  position: 0,
  isPrimary: true,
  ...overrides,
});

type ProductWithRelationsOverrides = Partial<Product> & {
  brand?: Brand;
  deviceModel?: DeviceModel | null;
  family?: Family;
  images?: ProductImage[];
};

const buildProduct = (overrides: ProductWithRelationsOverrides = {}) => {
  const { brand, deviceModel, family, images, ...productOverrides } = overrides;
  return {
    id: PRODUCT_ID,
    sku: 'SKU-1',
    barcode: null,
    name: 'Screen Protector',
    description: null,
    familyId: FAMILY_ID,
    brandId: BRAND_ID,
    deviceModelId: MODEL_ID,
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
    ...productOverrides,
    brand: brand ?? buildBrand(),
    deviceModel: deviceModel === undefined ? buildDeviceModel() : deviceModel,
    family: family ?? buildFamily(),
    images: images ?? [],
  };
};

const CATEGORY_ID = '55555555-5555-4555-8555-555555555555';

const buildClientCategory = (overrides: Partial<ClientCategory> = {}): ClientCategory => ({
  id: CATEGORY_ID,
  name: 'Wholesale',
  isEnabled: true,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

describe('CatalogMapper', () => {
  describe('toProductImageDto', () => {
    it('omits alt when null', () => {
      const dto = CatalogMapper.toProductImageDto(buildImage({ alt: null }));
      expect('alt' in dto).toBe(false);
    });

    it('includes alt when set', () => {
      const dto = CatalogMapper.toProductImageDto(buildImage({ alt: 'front view' }));
      expect(dto.alt).toBe('front view');
    });
  });

  describe('toProductWithPricingDto', () => {
    it('converts createdAt to an ISO string', () => {
      const dto = CatalogMapper.toProductWithPricingDto(
        buildProduct(),
        { priceHidden: false },
        { inStock: true, inCart: false },
      );
      expect(dto.createdAt).toBe(now.toISOString());
    });

    it('leaks no cost, exact/reserved quantity, or margin', () => {
      const dto = CatalogMapper.toProductWithPricingDto(
        buildProduct({ averageCost: new Prisma.Decimal(5000), quantityOnHand: 20, quantityReserved: 3 }),
        { priceHidden: false, currentPrice: 2000 },
        { inStock: true, inCart: false },
      );
      expect(dto).not.toHaveProperty('averageCost');
      expect(dto).not.toHaveProperty('quantityOnHand');
      expect(dto).not.toHaveProperty('quantityReserved');
      expect(dto).not.toHaveProperty('sku');
    });

    it('omits model when the product has none (universal part)', () => {
      const dto = CatalogMapper.toProductWithPricingDto(
        buildProduct({ deviceModelId: null, deviceModel: null }),
        { priceHidden: true },
        { inStock: false, inCart: false },
      );
      expect('model' in dto).toBe(false);
    });

    it('reflects priceHidden and omits guestPrice/currentPrice when both absent', () => {
      const dto = CatalogMapper.toProductWithPricingDto(
        buildProduct(),
        { priceHidden: true },
        { inStock: true, inCart: false },
      );
      expect(dto.priceHidden).toBe(true);
      expect('guestPrice' in dto).toBe(false);
      expect('currentPrice' in dto).toBe(false);
    });

    it('inStock/inCart pass through the resolved viewer flags', () => {
      const dto = CatalogMapper.toProductWithPricingDto(
        buildProduct(),
        { priceHidden: false, guestPrice: 1000 },
        { inStock: false, inCart: true },
      );
      expect(dto.inStock).toBe(false);
      expect(dto.inCart).toBe(true);
    });
  });

  describe('toProductDetailDto', () => {
    it('extends the public DTO with relatedIds', () => {
      const dto = CatalogMapper.toProductDetailDto(
        buildProduct(),
        { priceHidden: false, currentPrice: 1000 },
        { inStock: true, inCart: false },
        [
          '77777777-7777-4777-8777-777777777777',
          '88888888-8888-4888-8888-888888888888',
        ],
      );
      expect(dto.relatedIds).toEqual([
        '77777777-7777-4777-8777-777777777777',
        '88888888-8888-4888-8888-888888888888',
      ]);
      expect(dto.currentPrice).toBe(1000);
    });
  });

  describe('toStaffProductDto', () => {
    it('exposes availableQuantity and the 4 sale prices, but no cost', () => {
      const dto = CatalogMapper.toStaffProductDto(
        buildProduct({
          quantityOnHand: 15,
          quantityReserved: 4,
          defaultSalePrice: new Prisma.Decimal(900),
          averageCost: new Prisma.Decimal(4000),
        }),
        [{ categoryId: '99999999-9999-4999-8999-999999999999', categoryName: 'Wholesale', price: 850 }],
      );
      expect(dto.availableQuantity).toBe(11);
      expect(dto.defaultSalePrice).toBe(900);
      expect(dto.categoryPrices).toEqual([{ categoryId: '99999999-9999-4999-8999-999999999999', categoryName: 'Wholesale', price: 850 }]);
      expect(dto).not.toHaveProperty('averageCost');
    });

    it('omits defaultSalePrice when null', () => {
      const dto = CatalogMapper.toStaffProductDto(buildProduct({ defaultSalePrice: null }), []);
      expect('defaultSalePrice' in dto).toBe(false);
    });
  });

  describe('toAdminProductDto', () => {
    it('exposes full visibility: exact quantities, averageCost, publish/enable flags', () => {
      const dto = CatalogMapper.toAdminProductDto(
        buildProduct({
          quantityOnHand: 20,
          quantityReserved: 5,
          averageCost: new Prisma.Decimal(3500),
          isPublished: true,
        }),
      );
      expect(dto.quantityOnHand).toBe(20);
      expect(dto.quantityReserved).toBe(5);
      expect(dto.availableQuantity).toBe(15);
      expect(dto.averageCost).toBe(3500);
      expect(dto.isPublished).toBe(true);
    });

    it('derives stockStatus: out_of_stock when available <= 0', () => {
      const dto = CatalogMapper.toAdminProductDto(
        buildProduct({ quantityOnHand: 5, quantityReserved: 5, reorderThreshold: 2 }),
      );
      expect(dto.stockStatus).toBe(StockStatus.OUT_OF_STOCK);
    });

    it('derives stockStatus: low_stock when available <= reorderThreshold', () => {
      const dto = CatalogMapper.toAdminProductDto(
        buildProduct({ quantityOnHand: 10, quantityReserved: 8, reorderThreshold: 5 }),
      );
      expect(dto.stockStatus).toBe(StockStatus.LOW_STOCK);
    });

    it('derives stockStatus: in_stock when available > reorderThreshold', () => {
      const dto = CatalogMapper.toAdminProductDto(
        buildProduct({ quantityOnHand: 50, quantityReserved: 5, reorderThreshold: 5 }),
      );
      expect(dto.stockStatus).toBe(StockStatus.IN_STOCK);
    });

    it('converts Decimal-typed money to number', () => {
      const dto = CatalogMapper.toAdminProductDto(
        buildProduct({ guestPrice: new Prisma.Decimal(1200), defaultSalePrice: new Prisma.Decimal(1500) }),
      );
      expect(dto.guestPrice).toBe(1200);
      expect(dto.defaultSalePrice).toBe(1500);
    });
  });

  describe('toClientCategoryDto', () => {
    it('carries the supplied counts', () => {
      const dto = CatalogMapper.toClientCategoryDto(buildClientCategory(), {
        memberCount: 3,
        pricedProductCount: 12,
      });
      expect(dto.memberCount).toBe(3);
      expect(dto.pricedProductCount).toBe(12);
    });
  });

  describe('toBrandDto', () => {
    it('omits logoUrl when null', () => {
      const dto = CatalogMapper.toBrandDto(buildBrand({ logoUrl: null }));
      expect('logoUrl' in dto).toBe(false);
    });

    it('includes logoUrl when set', () => {
      const dto = CatalogMapper.toBrandDto(buildBrand({ logoUrl: 'https://example.com/logo.png' }));
      expect(dto.logoUrl).toBe('https://example.com/logo.png');
    });
  });

  describe('toFamilyDto', () => {
    it('omits productCount when not supplied', () => {
      const dto = CatalogMapper.toFamilyDto(buildFamily());
      expect('productCount' in dto).toBe(false);
    });

    it('includes productCount when supplied (withCount=true)', () => {
      const dto = CatalogMapper.toFamilyDto(buildFamily(), 7);
      expect(dto.productCount).toBe(7);
    });

    it('omits parentId when null', () => {
      const dto = CatalogMapper.toFamilyDto(buildFamily({ parentId: null }));
      expect('parentId' in dto).toBe(false);
    });
  });

  describe('toDeviceModelDto', () => {
    it('flattens familyIds from the join rows', () => {
      const familyIds = [
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      ];
      const dto = CatalogMapper.toDeviceModelDto(buildDeviceModel(), familyIds);
      expect(dto.familyIds).toEqual(familyIds);
      expect(dto.brandId).toBe(BRAND_ID);
    });
  });

  describe('toProductStatsDto', () => {
    it('passes bucket counts through and parses the schema', () => {
      const dto = CatalogMapper.toProductStatsDto({ total: 10, inStock: 6, lowStock: 3, outOfStock: 1 });
      expect(dto).toEqual({ total: 10, inStock: 6, lowStock: 3, outOfStock: 1 });
    });
  });

  describe('availableQuantity', () => {
    it('computes onHand minus reserved', () => {
      expect(CatalogMapper.availableQuantity({ quantityOnHand: 10, quantityReserved: 4 })).toBe(6);
    });
  });

  describe('deriveStockStatus', () => {
    it('thresholds: <=0 out, <=reorder low, else in_stock', () => {
      expect(CatalogMapper.deriveStockStatus(0, 5)).toBe(StockStatus.OUT_OF_STOCK);
      expect(CatalogMapper.deriveStockStatus(5, 5)).toBe(StockStatus.LOW_STOCK);
      expect(CatalogMapper.deriveStockStatus(6, 5)).toBe(StockStatus.IN_STOCK);
    });
  });
});
