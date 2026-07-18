import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { CreateProductSchema, MovementType } from '@dragon-telecom/contract';
import type { AppError } from '../../../../src/common/errors';
import {
  CatalogCategoryService,
  CatalogProductService,
  CatalogTaxonomyService,
} from '../../../../src/modules/catalog/catalog.service';
import type { IInventoryPort } from '../../../../src/modules/catalog/catalog.interface';

const {
  brandFindManyMock,
  brandCreateMock,
  brandUpdateMock,
  familyFindManyMock,
  familyFindUniqueMock,
  familyCreateMock,
  familyUpdateMock,
  familyCountMock,
  deviceModelFindManyMock,
  deviceModelFindUniqueMock,
  deviceModelCreateMock,
  deviceModelUpdateMock,
  deviceModelFamilyDeleteManyMock,
  deviceModelFamilyCreateManyMock,
  clientCategoryFindManyMock,
  clientCategoryCreateMock,
  clientCategoryUpdateMock,
  posClientCountMock,
  productPriceCountMock,
  productFindManyMock,
  productCountMock,
  productFindUniqueMock,
  productCreateMock,
  productUpdateMock,
  productPriceFindManyMock,
  productPriceCreateManyMock,
  productPriceUpsertMock,
  productImageCreateManyMock,
  productImageUpdateMock,
  clientFindUniqueMock,
  clientCartFindManyMock,
  transactionMock,
  eventBusEmitMock,
} = vi.hoisted(() => ({
  brandFindManyMock: vi.fn(),
  brandCreateMock: vi.fn(),
  brandUpdateMock: vi.fn(),
  familyFindManyMock: vi.fn(),
  familyFindUniqueMock: vi.fn(),
  familyCreateMock: vi.fn(),
  familyUpdateMock: vi.fn(),
  familyCountMock: vi.fn(),
  deviceModelFindManyMock: vi.fn(),
  deviceModelFindUniqueMock: vi.fn(),
  deviceModelCreateMock: vi.fn(),
  deviceModelUpdateMock: vi.fn(),
  deviceModelFamilyDeleteManyMock: vi.fn(),
  deviceModelFamilyCreateManyMock: vi.fn(),
  clientCategoryFindManyMock: vi.fn(),
  clientCategoryCreateMock: vi.fn(),
  clientCategoryUpdateMock: vi.fn(),
  posClientCountMock: vi.fn(),
  productPriceCountMock: vi.fn(),
  productFindManyMock: vi.fn(),
  productCountMock: vi.fn(),
  productFindUniqueMock: vi.fn(),
  productCreateMock: vi.fn(),
  productUpdateMock: vi.fn(),
  productPriceFindManyMock: vi.fn(),
  productPriceCreateManyMock: vi.fn(),
  productPriceUpsertMock: vi.fn(),
  productImageCreateManyMock: vi.fn(),
  productImageUpdateMock: vi.fn(),
  clientFindUniqueMock: vi.fn(),
  clientCartFindManyMock: vi.fn(),
  transactionMock: vi.fn(),
  eventBusEmitMock: vi.fn(),
}));

vi.mock('@common/events/event-bus', () => ({ eventBus: { emit: eventBusEmitMock } }));

const prismaMock = {
  brand: { findMany: brandFindManyMock, create: brandCreateMock, update: brandUpdateMock },
  family: {
    findMany: familyFindManyMock,
    findUnique: familyFindUniqueMock,
    create: familyCreateMock,
    update: familyUpdateMock,
    count: familyCountMock,
  },
  deviceModel: {
    findMany: deviceModelFindManyMock,
    findUnique: deviceModelFindUniqueMock,
    create: deviceModelCreateMock,
    update: deviceModelUpdateMock,
  },
  deviceModelFamily: { deleteMany: deviceModelFamilyDeleteManyMock, createMany: deviceModelFamilyCreateManyMock },
  clientCategory: {
    findMany: clientCategoryFindManyMock,
    create: clientCategoryCreateMock,
    update: clientCategoryUpdateMock,
  },
  posClient: { count: posClientCountMock },
  product: {
    findMany: productFindManyMock,
    count: productCountMock,
    findUnique: productFindUniqueMock,
    create: productCreateMock,
    update: productUpdateMock,
  },
  productPrice: {
    count: productPriceCountMock,
    findMany: productPriceFindManyMock,
    createMany: productPriceCreateManyMock,
    upsert: productPriceUpsertMock,
  },
  productImage: { createMany: productImageCreateManyMock, update: productImageUpdateMock },
  client: { findUnique: clientFindUniqueMock },
  clientCart: { findMany: clientCartFindManyMock },
  $transaction: transactionMock,
};

const BRAND_ID = '11111111-1111-4111-8111-111111111111';
const FAMILY_ID = '22222222-2222-4222-8222-222222222222';
const PARENT_FAMILY_ID = '33333333-3333-4333-8333-333333333333';
const MODEL_ID = '44444444-4444-4444-8444-444444444444';
const CATEGORY_ID = '55555555-5555-4555-8555-555555555555';

const prismaKnownError = (code: string, message = 'mock prisma error') =>
  new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: '6.19.3' });

const now = new Date('2026-01-01T00:00:00.000Z');

describe('CatalogTaxonomyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
  });

  const service = () => new CatalogTaxonomyService(prismaMock as never);

  describe('listBrands', () => {
    it('filters to enabled-only by default (public)', async () => {
      brandFindManyMock.mockResolvedValueOnce([
        { id: BRAND_ID, name: 'Samsung', slug: 'samsung', logoUrl: null, isEnabled: true, createdAt: now, updatedAt: now },
      ]);

      await service().listBrands();

      expect(brandFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isEnabled: true } }),
      );
    });

    it('includes disabled brands when includeDisabled=true (admin)', async () => {
      brandFindManyMock.mockResolvedValueOnce([]);

      await service().listBrands(true);

      expect(brandFindManyMock).toHaveBeenCalledWith(expect.not.objectContaining({ where: { isEnabled: true } }));
    });
  });

  describe('createBrand', () => {
    it('emits taxonomy.changed after commit', async () => {
      brandCreateMock.mockResolvedValueOnce({
        id: BRAND_ID,
        name: 'Apple',
        slug: 'apple',
        logoUrl: null,
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
      });

      await service().createBrand({ name: 'Apple' });

      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'taxonomy.changed',
        expect.objectContaining({ entityType: 'Brand', entityId: BRAND_ID }),
      );
    });

    it('maps a duplicate-name P2002 to 409 ConflictError', async () => {
      brandCreateMock.mockRejectedValueOnce(prismaKnownError('P2002'));

      await expect(service().createBrand({ name: 'Apple' })).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('createFamily — one nesting level', () => {
    it('rejects a parentId whose own parent is set (2-level nesting)', async () => {
      familyFindUniqueMock.mockResolvedValueOnce({
        id: PARENT_FAMILY_ID,
        parentId: 'grandparent-id',
      });

      await expect(
        service().createFamily({ name: 'Sub-sub family', parentId: PARENT_FAMILY_ID }),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(familyCreateMock).not.toHaveBeenCalled();
    });

    it('accepts a parentId that is itself top-level', async () => {
      familyFindUniqueMock.mockResolvedValueOnce({ id: PARENT_FAMILY_ID, parentId: null });
      familyCreateMock.mockResolvedValueOnce({
        id: FAMILY_ID,
        name: 'Sub family',
        slug: 'sub-family',
        iconUrl: null,
        parentId: PARENT_FAMILY_ID,
        isUniversal: false,
        isFeatured: false,
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
      });

      const dto = await service().createFamily({ name: 'Sub family', parentId: PARENT_FAMILY_ID });

      expect(dto.parentId).toBe(PARENT_FAMILY_ID);
    });
  });

  describe('createFamily — featured cap', () => {
    it('rejects the 7th enabled+featured family with 409', async () => {
      familyCountMock.mockResolvedValueOnce(6);

      await expect(service().createFamily({ name: 'Featured 7', isFeatured: true })).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(familyCreateMock).not.toHaveBeenCalled();
    });

    it('allows the 6th featured family', async () => {
      familyCountMock.mockResolvedValueOnce(5);
      familyCreateMock.mockResolvedValueOnce({
        id: FAMILY_ID,
        name: 'Featured 6',
        slug: 'featured-6',
        iconUrl: null,
        parentId: null,
        isUniversal: false,
        isFeatured: true,
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
      });

      const dto = await service().createFamily({ name: 'Featured 6', isFeatured: true });

      expect(dto.isFeatured).toBe(true);
    });
  });

  describe('createModel — duplicate name in brand', () => {
    it('maps P2002 to 409 ConflictError', async () => {
      deviceModelCreateMock.mockRejectedValueOnce(prismaKnownError('P2002'));

      await expect(service().createModel({ brandId: BRAND_ID, name: 'Galaxy S21' })).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  describe('setModelFamilies', () => {
    it('replaces the DeviceModelFamily set (delete then create) and emits taxonomy.changed', async () => {
      deviceModelFindUniqueMock.mockResolvedValueOnce({
        id: MODEL_ID,
        name: 'Galaxy S21',
        slug: 'galaxy-s21',
        brandId: BRAND_ID,
        isEnabled: true,
      });

      const familyIds = [FAMILY_ID, PARENT_FAMILY_ID];
      const dto = await service().setModelFamilies(MODEL_ID, { familyIds });

      expect(deviceModelFamilyDeleteManyMock).toHaveBeenCalledWith({ where: { deviceModelId: MODEL_ID } });
      expect(deviceModelFamilyCreateManyMock).toHaveBeenCalledWith({
        data: familyIds.map((familyId) => ({ deviceModelId: MODEL_ID, familyId })),
      });
      expect(dto.familyIds).toEqual(familyIds);
      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'taxonomy.changed',
        expect.objectContaining({ entityType: 'DeviceModel', entityId: MODEL_ID }),
      );
    });

    it('404s when the model does not exist', async () => {
      deviceModelFindUniqueMock.mockResolvedValueOnce(null);

      await expect(service().setModelFamilies(MODEL_ID, { familyIds: [] })).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});

describe('CatalogCategoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const service = () => new CatalogCategoryService(prismaMock as never);

  describe('createCategory', () => {
    it('creates with zero members/priced products and emits clientCategory.changed', async () => {
      clientCategoryCreateMock.mockResolvedValueOnce({
        id: CATEGORY_ID,
        name: 'Wholesale',
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
      });

      const dto = await service().createCategory({ name: 'Wholesale' });

      expect(dto.memberCount).toBe(0);
      expect(dto.pricedProductCount).toBe(0);
      expect(posClientCountMock).not.toHaveBeenCalled();
      expect(productPriceCountMock).not.toHaveBeenCalled();
      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'clientCategory.changed',
        expect.objectContaining({ categoryId: CATEGORY_ID }),
      );
    });

    it('maps a duplicate-name P2002 to 409 ConflictError', async () => {
      clientCategoryCreateMock.mockRejectedValueOnce(prismaKnownError('P2002'));

      await expect(service().createCategory({ name: 'Wholesale' })).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('updateCategory — disable guard', () => {
    it('rejects disabling with 409 CATEGORY_IN_USE when enabled members exist', async () => {
      posClientCountMock.mockResolvedValueOnce(3);

      const error = await service()
        .updateCategory(CATEGORY_ID, { isEnabled: false })
        .catch((err: unknown) => err as AppError);

      expect(error).toMatchObject({ statusCode: 409 });
      expect(clientCategoryUpdateMock).not.toHaveBeenCalled();
    });

    it('allows disabling when zero enabled members', async () => {
      posClientCountMock.mockResolvedValueOnce(0);
      clientCategoryUpdateMock.mockResolvedValueOnce({
        id: CATEGORY_ID,
        name: 'Wholesale',
        isEnabled: false,
        createdAt: now,
        updatedAt: now,
      });
      posClientCountMock.mockResolvedValueOnce(0);
      productPriceCountMock.mockResolvedValueOnce(0);

      const dto = await service().updateCategory(CATEGORY_ID, { isEnabled: false });

      expect(dto.isEnabled).toBe(false);
      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'clientCategory.changed',
        expect.objectContaining({ categoryId: CATEGORY_ID }),
      );
    });
  });
});

const PRODUCT_ID = '77777777-7777-4777-8777-777777777777';
const CLIENT_ID = '88888888-8888-4888-8888-888888888888';
const CATEGORY_TIER_ID = '99999999-9999-4999-8999-999999999999';
const STAFF_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const buildProductRow = (overrides: Record<string, unknown> = {}) => ({
  id: PRODUCT_ID,
  sku: 'SKU-1',
  barcode: null,
  name: 'Screen Protector',
  description: null,
  familyId: FAMILY_ID,
  brandId: BRAND_ID,
  deviceModelId: null,
  guestPrice: null,
  defaultSalePrice: null,
  averageCost: new Prisma.Decimal(0),
  quantityOnHand: 10,
  quantityReserved: 0,
  reorderThreshold: 0,
  isPublished: true,
  isEnabled: true,
  createdAt: now,
  updatedAt: now,
  brand: { id: BRAND_ID, name: 'Samsung', slug: 'samsung', logoUrl: null, isEnabled: true, createdAt: now, updatedAt: now },
  family: {
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
  },
  deviceModel: null,
  images: [],
  ...overrides,
});

describe('CatalogProductService', () => {
  const inventoryMock: IInventoryPort = { addLayer: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
  });

  const service = () => new CatalogProductService(prismaMock as never, inventoryMock);

  describe('price resolution matrix', () => {
    it('CLIENT + tier: uses the category ProductPrice row over guestPrice', async () => {
      const product = buildProductRow({ guestPrice: new Prisma.Decimal(1000) });
      productCountMock.mockResolvedValueOnce(1);
      productFindManyMock.mockResolvedValueOnce([product]);
      clientFindUniqueMock.mockResolvedValueOnce({ posClient: { categoryId: CATEGORY_TIER_ID } });
      productPriceFindManyMock.mockResolvedValueOnce([
        { productId: PRODUCT_ID, price: new Prisma.Decimal(750) },
      ]);
      clientCartFindManyMock.mockResolvedValueOnce([]);

      const result = await service().listProducts(
        { page: 1, limit: 15 } as never,
        { sub: CLIENT_ID, type: 'CLIENT', clientId: CLIENT_ID } as never,
      );

      expect(result.items[0]?.currentPrice).toBe(750);
      expect(result.items[0]?.guestPrice).toBe(1000);
      expect(result.items[0]?.priceHidden).toBe(false);
    });

    it('CLIENT, no tier: falls back to guestPrice', async () => {
      const product = buildProductRow({ guestPrice: new Prisma.Decimal(1200) });
      productCountMock.mockResolvedValueOnce(1);
      productFindManyMock.mockResolvedValueOnce([product]);
      clientFindUniqueMock.mockResolvedValueOnce({ posClient: null });
      clientCartFindManyMock.mockResolvedValueOnce([]);

      const result = await service().listProducts(
        { page: 1, limit: 15 } as never,
        { sub: CLIENT_ID, type: 'CLIENT', clientId: CLIENT_ID } as never,
      );

      expect(result.items[0]?.currentPrice).toBe(1200);
      expect(result.items[0]?.priceHidden).toBe(false);
    });

    it('Guest, priced: currentPrice mirrors guestPrice', async () => {
      const product = buildProductRow({ guestPrice: new Prisma.Decimal(900) });
      productCountMock.mockResolvedValueOnce(1);
      productFindManyMock.mockResolvedValueOnce([product]);

      const result = await service().listProducts({ page: 1, limit: 15 } as never, undefined);

      expect(result.items[0]?.currentPrice).toBe(900);
      expect(result.items[0]?.priceHidden).toBe(false);
    });

    it('Guest, null guestPrice: hidden, no currentPrice', async () => {
      const product = buildProductRow({ guestPrice: null });
      productCountMock.mockResolvedValueOnce(1);
      productFindManyMock.mockResolvedValueOnce([product]);

      const result = await service().listProducts({ page: 1, limit: 15 } as never, undefined);

      expect(result.items[0]?.priceHidden).toBe(true);
      expect('currentPrice' in result.items[0]!).toBe(false);
    });
  });

  describe('storefront DTO leak check', () => {
    it('a guest listing never carries cost/reserved/exact-quantity fields', async () => {
      const product = buildProductRow({ quantityOnHand: 40, quantityReserved: 12, averageCost: new Prisma.Decimal(5000) });
      productCountMock.mockResolvedValueOnce(1);
      productFindManyMock.mockResolvedValueOnce([product]);

      const result = await service().listProducts({ page: 1, limit: 15 } as never, undefined);

      expect(result.items[0]).not.toHaveProperty('averageCost');
      expect(result.items[0]).not.toHaveProperty('quantityOnHand');
      expect(result.items[0]).not.toHaveProperty('quantityReserved');
      expect(result.items[0]).not.toHaveProperty('sku');
    });
  });

  describe('product.searched', () => {
    it('emits with userId on a staff search', async () => {
      const product = buildProductRow();
      productCountMock.mockResolvedValueOnce(1);
      productFindManyMock.mockResolvedValueOnce([{ ...product, prices: [] }]);

      await service().listStaffProducts(
        { page: 1, limit: 15, search: 'screen' } as never,
        { sub: 'staff-1', type: 'STAFF' } as never,
      );

      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'product.searched',
        expect.objectContaining({ userId: 'staff-1', query: 'screen', matchedProductId: PRODUCT_ID }),
      );
    });

    it('does not emit on a guest storefront search', async () => {
      const product = buildProductRow();
      productCountMock.mockResolvedValueOnce(1);
      productFindManyMock.mockResolvedValueOnce([product]);

      await service().listProducts({ page: 1, limit: 15, search: 'screen' } as never, undefined);

      expect(eventBusEmitMock).not.toHaveBeenCalledWith('product.searched', expect.anything());
    });
  });

  describe('createProduct', () => {
    it('qty>0 calls inventory.addLayer once with INITIAL_STOCK inside the transaction and emits product.created', async () => {
      productCreateMock.mockResolvedValueOnce({ id: PRODUCT_ID, name: 'New Product' });
      productFindUniqueMock.mockResolvedValueOnce(buildProductRow({ name: 'New Product' }));

      const cmd = CreateProductSchema.parse({
        name: 'New Product',
        familyId: FAMILY_ID,
        brandId: BRAND_ID,
        initialQuantity: 5,
        initialUnitCost: 1000,
      });

      await service().createProduct(cmd, [], STAFF_ID);

      expect(inventoryMock.addLayer).toHaveBeenCalledTimes(1);
      expect(inventoryMock.addLayer).toHaveBeenCalledWith(
        prismaMock,
        expect.objectContaining({
          productId: PRODUCT_ID,
          quantity: 5,
          unitCost: 1000,
          type: MovementType.INITIAL_STOCK,
          staffId: STAFF_ID,
        }),
      );
      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'product.created',
        expect.objectContaining({ productId: PRODUCT_ID, name: 'New Product' }),
      );
    });

    it('qty=0 never calls inventory.addLayer', async () => {
      productCreateMock.mockResolvedValueOnce({ id: PRODUCT_ID, name: 'Priceless Product' });
      productFindUniqueMock.mockResolvedValueOnce(buildProductRow({ name: 'Priceless Product' }));

      const cmd = CreateProductSchema.parse({
        name: 'Priceless Product',
        familyId: FAMILY_ID,
        brandId: BRAND_ID,
        initialQuantity: 0,
      });

      await service().createProduct(cmd, [], STAFF_ID);

      expect(inventoryMock.addLayer).not.toHaveBeenCalled();
    });
  });

  describe('contract enforcement (regression — the service trusts these, it does not re-check them)', () => {
    it('rejects initialQuantity=0 with pricing fields (PRICING_REQUIRES_STOCK)', () => {
      expect(() =>
        CreateProductSchema.parse({
          name: 'X',
          familyId: FAMILY_ID,
          brandId: BRAND_ID,
          initialQuantity: 0,
          guestPrice: 100,
        }),
      ).toThrow();
    });

    it('rejects initialQuantity>0 without initialUnitCost', () => {
      expect(() =>
        CreateProductSchema.parse({
          name: 'X',
          familyId: FAMILY_ID,
          brandId: BRAND_ID,
          initialQuantity: 5,
        }),
      ).toThrow();
    });
  });

  describe('updatePricing', () => {
    it('emits product.repriced', async () => {
      productFindUniqueMock.mockResolvedValueOnce(buildProductRow());
      productFindUniqueMock.mockResolvedValueOnce(buildProductRow());

      await service().updatePricing(PRODUCT_ID, { guestPrice: 1500 });

      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'product.repriced',
        expect.objectContaining({ productId: PRODUCT_ID }),
      );
    });

    it('404s when the product does not exist', async () => {
      productFindUniqueMock.mockResolvedValueOnce(null);

      await expect(service().updatePricing(PRODUCT_ID, { guestPrice: 1500 })).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
