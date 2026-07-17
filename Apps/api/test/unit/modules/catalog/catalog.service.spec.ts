import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import type { AppError } from '../../../../src/common/errors';
import { CatalogCategoryService, CatalogTaxonomyService } from '../../../../src/modules/catalog/catalog.service';

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
  productPrice: { count: productPriceCountMock },
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
