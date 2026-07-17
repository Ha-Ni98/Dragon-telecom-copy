import type { ClientCategory, PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type {
  AddProductImagesCommand,
  AdminProductDto,
  BrandDto,
  ClientCategoryDto,
  CreateBrandCommand,
  CreateClientCategoryCommand,
  CreateFamilyCommand,
  CreateModelCommand,
  CreateProductCommand,
  DeviceModelDto,
  FamiliesQuery,
  FamilyDto,
  ModelsQuery,
  PaginatedResult,
  ProductDetailDto,
  ProductListQuery,
  ProductStatsDto,
  ProductWithPricingDto,
  SetModelFamiliesCommand,
  StaffProductDto,
  UpdateBrandCommand,
  UpdateClientCategoryCommand,
  UpdateFamilyCommand,
  UpdateModelCommand,
  UpdatePricingCommand,
  UpdateProductCommand,
  UpdateProductImagesCommand,
} from '@dragon-telecom/contract';
import { BadRequestError, ConflictError, NotFoundError } from '@common/errors';
import { eventBus } from '@common/events/event-bus';
import { CatalogMapper } from './catalog.mapper';
import type {
  ICatalogCategoryService,
  ICatalogProductService,
  ICatalogTaxonomyService,
  IInventoryPort,
  Viewer,
} from './catalog.interface';

const isKnownRequestError = (err: unknown, code: string): err is Prisma.PrismaClientKnownRequestError =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

const FEATURED_FAMILIES_LIMIT = 6;

// No slug column is client-supplied anywhere in the contract — generated here from `name`.
// Two different names colliding to the same slug is an edge case the spec doesn't cover; it
// simply 409s via the DB's own unique constraint, same as any other uniqueness violation.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class CatalogTaxonomyService implements ICatalogTaxonomyService {
  constructor(private prisma: PrismaClient) {}

  async listBrands(includeDisabled = false): Promise<BrandDto[]> {
    const brands = await this.prisma.brand.findMany({
      ...(includeDisabled ? {} : { where: { isEnabled: true } }),
      orderBy: { name: 'asc' },
    });
    return brands.map((brand) => CatalogMapper.toBrandDto(brand));
  }

  async listFamilies(query: FamiliesQuery, includeDisabled = false): Promise<FamilyDto[]> {
    const families = await this.prisma.family.findMany({
      where: {
        ...(includeDisabled ? {} : { isEnabled: true }),
        ...(query.featured ? { isFeatured: true } : {}),
      },
      ...(query.limit != null ? { take: query.limit } : {}),
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return families.map((family) =>
      CatalogMapper.toFamilyDto(family, query.withCount ? family._count.products : undefined),
    );
  }

  async listModels(query: ModelsQuery, includeDisabled = false): Promise<DeviceModelDto[]> {
    const models = await this.prisma.deviceModel.findMany({
      where: {
        ...(includeDisabled ? {} : { isEnabled: true }),
        ...(query.brandId != null ? { brandId: query.brandId } : {}),
      },
      include: { families: true },
      orderBy: { name: 'asc' },
    });
    return models.map((model) =>
      CatalogMapper.toDeviceModelDto(
        model,
        model.families.map((deviceModelFamily) => deviceModelFamily.familyId),
      ),
    );
  }

  async createBrand(cmd: CreateBrandCommand): Promise<BrandDto> {
    try {
      const brand = await this.prisma.brand.create({
        data: {
          name: cmd.name,
          slug: slugify(cmd.name),
          ...(cmd.logoUrl != null ? { logoUrl: cmd.logoUrl } : {}),
        },
      });
      eventBus.emit('taxonomy.changed', {
        entityType: 'Brand',
        entityId: brand.id,
        description: `Brand ${brand.name} created`,
      });
      return CatalogMapper.toBrandDto(brand);
    } catch (err) {
      if (isKnownRequestError(err, 'P2002')) throw new ConflictError('Brand name already in use');
      throw err;
    }
  }

  async updateBrand(id: string, cmd: UpdateBrandCommand): Promise<BrandDto> {
    try {
      const brand = await this.prisma.brand.update({
        where: { id },
        data: {
          ...(cmd.name != null ? { name: cmd.name, slug: slugify(cmd.name) } : {}),
          ...(cmd.logoUrl != null ? { logoUrl: cmd.logoUrl } : {}),
          ...(cmd.isEnabled != null ? { isEnabled: cmd.isEnabled } : {}),
        },
      });
      eventBus.emit('taxonomy.changed', {
        entityType: 'Brand',
        entityId: brand.id,
        description: `Brand ${brand.name} updated`,
      });
      return CatalogMapper.toBrandDto(brand);
    } catch (err) {
      if (isKnownRequestError(err, 'P2025')) throw new NotFoundError('Brand');
      if (isKnownRequestError(err, 'P2002')) throw new ConflictError('Brand name already in use');
      throw err;
    }
  }

  async createFamily(cmd: CreateFamilyCommand): Promise<FamilyDto> {
    if (cmd.parentId != null) await this.assertOneNestingLevel(cmd.parentId);
    if (cmd.isFeatured) await this.assertFeaturedCapacity();

    try {
      const family = await this.prisma.family.create({
        data: {
          name: cmd.name,
          slug: slugify(cmd.name),
          ...(cmd.iconUrl != null ? { iconUrl: cmd.iconUrl } : {}),
          ...(cmd.parentId != null ? { parentId: cmd.parentId } : {}),
          isFeatured: cmd.isFeatured ?? false,
        },
      });
      eventBus.emit('taxonomy.changed', {
        entityType: 'Family',
        entityId: family.id,
        description: `Family ${family.name} created`,
      });
      return CatalogMapper.toFamilyDto(family);
    } catch (err) {
      if (isKnownRequestError(err, 'P2002')) throw new ConflictError('Family name already in use');
      throw err;
    }
  }

  async updateFamily(id: string, cmd: UpdateFamilyCommand): Promise<FamilyDto> {
    const existing = await this.prisma.family.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Family');

    if (cmd.parentId != null) await this.assertOneNestingLevel(cmd.parentId);

    const resultingFeatured = cmd.isFeatured ?? existing.isFeatured;
    const resultingEnabled = cmd.isEnabled ?? existing.isEnabled;
    const wasFeaturedEnabled = existing.isFeatured && existing.isEnabled;
    if (resultingFeatured && resultingEnabled && !wasFeaturedEnabled) {
      await this.assertFeaturedCapacity(id);
    }

    try {
      const family = await this.prisma.family.update({
        where: { id },
        data: {
          ...(cmd.name != null ? { name: cmd.name, slug: slugify(cmd.name) } : {}),
          ...(cmd.iconUrl != null ? { iconUrl: cmd.iconUrl } : {}),
          ...(cmd.parentId != null ? { parentId: cmd.parentId } : {}),
          ...(cmd.isFeatured != null ? { isFeatured: cmd.isFeatured } : {}),
          ...(cmd.isEnabled != null ? { isEnabled: cmd.isEnabled } : {}),
        },
      });
      eventBus.emit('taxonomy.changed', {
        entityType: 'Family',
        entityId: family.id,
        description: `Family ${family.name} updated`,
      });
      return CatalogMapper.toFamilyDto(family);
    } catch (err) {
      if (isKnownRequestError(err, 'P2025')) throw new NotFoundError('Family');
      if (isKnownRequestError(err, 'P2002')) throw new ConflictError('Family name already in use');
      throw err;
    }
  }

  async createModel(cmd: CreateModelCommand): Promise<DeviceModelDto> {
    try {
      const model = await this.prisma.deviceModel.create({
        data: { brandId: cmd.brandId, name: cmd.name, slug: slugify(cmd.name) },
      });
      eventBus.emit('taxonomy.changed', {
        entityType: 'DeviceModel',
        entityId: model.id,
        description: `Model ${model.name} created`,
      });
      return CatalogMapper.toDeviceModelDto(model, []);
    } catch (err) {
      if (isKnownRequestError(err, 'P2002')) throw new ConflictError('Model name already in use for this brand');
      throw err;
    }
  }

  async updateModel(id: string, cmd: UpdateModelCommand): Promise<DeviceModelDto> {
    try {
      const model = await this.prisma.deviceModel.update({
        where: { id },
        data: {
          ...(cmd.name != null ? { name: cmd.name, slug: slugify(cmd.name) } : {}),
          ...(cmd.isEnabled != null ? { isEnabled: cmd.isEnabled } : {}),
        },
        include: { families: true },
      });
      eventBus.emit('taxonomy.changed', {
        entityType: 'DeviceModel',
        entityId: model.id,
        description: `Model ${model.name} updated`,
      });
      return CatalogMapper.toDeviceModelDto(
        model,
        model.families.map((deviceModelFamily) => deviceModelFamily.familyId),
      );
    } catch (err) {
      if (isKnownRequestError(err, 'P2025')) throw new NotFoundError('DeviceModel');
      if (isKnownRequestError(err, 'P2002')) throw new ConflictError('Model name already in use for this brand');
      throw err;
    }
  }

  async setModelFamilies(id: string, cmd: SetModelFamiliesCommand): Promise<DeviceModelDto> {
    const model = await this.prisma.deviceModel.findUnique({ where: { id } });
    if (!model) throw new NotFoundError('DeviceModel');

    await this.prisma.$transaction([
      this.prisma.deviceModelFamily.deleteMany({ where: { deviceModelId: id } }),
      ...(cmd.familyIds.length > 0
        ? [
            this.prisma.deviceModelFamily.createMany({
              data: cmd.familyIds.map((familyId) => ({ deviceModelId: id, familyId })),
            }),
          ]
        : []),
    ]);

    eventBus.emit('taxonomy.changed', {
      entityType: 'DeviceModel',
      entityId: id,
      description: `Model ${model.name} families replaced`,
    });
    return CatalogMapper.toDeviceModelDto(model, cmd.familyIds);
  }

  private async assertOneNestingLevel(parentId: string): Promise<void> {
    const parent = await this.prisma.family.findUnique({ where: { id: parentId } });
    if (!parent) throw new NotFoundError('Family');
    if (parent.parentId != null) throw new BadRequestError('Only one level of family nesting is allowed');
  }

  private async assertFeaturedCapacity(excludeId?: string): Promise<void> {
    const count = await this.prisma.family.count({
      where: { isFeatured: true, isEnabled: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (count >= FEATURED_FAMILIES_LIMIT) {
      throw new ConflictError('FEATURED_FAMILIES_LIMIT_REACHED', { limit: FEATURED_FAMILIES_LIMIT });
    }
  }
}

export class CatalogCategoryService implements ICatalogCategoryService {
  constructor(private prisma: PrismaClient) {}

  async listCategories(): Promise<ClientCategoryDto[]> {
    const categories = await this.prisma.clientCategory.findMany({ orderBy: { name: 'asc' } });
    return Promise.all(categories.map((category) => this.toDtoWithCounts(category)));
  }

  async createCategory(cmd: CreateClientCategoryCommand): Promise<ClientCategoryDto> {
    try {
      const category = await this.prisma.clientCategory.create({ data: { name: cmd.name } });
      eventBus.emit('clientCategory.changed', {
        categoryId: category.id,
        description: `Category ${category.name} created`,
      });
      // A freshly created category has no members/priced products yet (spec BL#5: "creating
      // one creates no prices") — skip the two count queries the general path needs.
      return CatalogMapper.toClientCategoryDto(category, { memberCount: 0, pricedProductCount: 0 });
    } catch (err) {
      if (isKnownRequestError(err, 'P2002')) throw new ConflictError('Category name already in use');
      throw err;
    }
  }

  async updateCategory(id: string, cmd: UpdateClientCategoryCommand): Promise<ClientCategoryDto> {
    if (cmd.isEnabled === false) {
      const memberCount = await this.prisma.posClient.count({ where: { categoryId: id, isEnabled: true } });
      if (memberCount > 0) throw new ConflictError('CATEGORY_IN_USE', { memberCount });
    }

    try {
      const category = await this.prisma.clientCategory.update({
        where: { id },
        data: {
          ...(cmd.name != null ? { name: cmd.name } : {}),
          ...(cmd.isEnabled != null ? { isEnabled: cmd.isEnabled } : {}),
        },
      });
      eventBus.emit('clientCategory.changed', {
        categoryId: category.id,
        description: `Category ${category.name} updated`,
      });
      return this.toDtoWithCounts(category);
    } catch (err) {
      if (isKnownRequestError(err, 'P2025')) throw new NotFoundError('ClientCategory');
      if (isKnownRequestError(err, 'P2002')) throw new ConflictError('Category name already in use');
      throw err;
    }
  }

  // `memberCount` counts enabled PosClient rows — the same population the disable-guard above
  // checks, so the DTO number always matches what would block a disable attempt.
  private async toDtoWithCounts(category: ClientCategory): Promise<ClientCategoryDto> {
    const [memberCount, pricedProductCount] = await Promise.all([
      this.prisma.posClient.count({ where: { categoryId: category.id, isEnabled: true } }),
      this.prisma.productPrice.count({ where: { clientCategoryId: category.id } }),
    ]);
    return CatalogMapper.toClientCategoryDto(category, { memberCount, pricedProductCount });
  }
}

// Sprint 4 implements the real logic (price resolution, create-with-stock, pricing, images,
// stats). Stubbed here only so this file compiles its `implements` clause end-to-end.
export class CatalogProductService implements ICatalogProductService {
  constructor(
    private prisma: PrismaClient,
    private inventory: IInventoryPort,
  ) {}

  listProducts(_query: ProductListQuery, _viewer: Viewer): Promise<PaginatedResult<ProductWithPricingDto>> {
    return this.notImplemented('listProducts');
  }

  getProduct(_id: string, _viewer: Viewer): Promise<ProductDetailDto> {
    return this.notImplemented('getProduct');
  }

  listStaffProducts(_query: ProductListQuery, _viewer: Viewer): Promise<PaginatedResult<StaffProductDto>> {
    return this.notImplemented('listStaffProducts');
  }

  listAdminProducts(_query: ProductListQuery, _viewer: Viewer): Promise<PaginatedResult<AdminProductDto>> {
    return this.notImplemented('listAdminProducts');
  }

  createProduct(_cmd: CreateProductCommand, _images: Express.Multer.File[]): Promise<AdminProductDto> {
    return this.notImplemented('createProduct');
  }

  updateProduct(_id: string, _cmd: UpdateProductCommand): Promise<AdminProductDto> {
    return this.notImplemented('updateProduct');
  }

  updatePricing(_id: string, _cmd: UpdatePricingCommand): Promise<AdminProductDto> {
    return this.notImplemented('updatePricing');
  }

  addImages(_id: string, _cmd: AddProductImagesCommand, _files: Express.Multer.File[]): Promise<AdminProductDto> {
    return this.notImplemented('addImages');
  }

  updateImages(_id: string, _cmd: UpdateProductImagesCommand): Promise<AdminProductDto> {
    return this.notImplemented('updateImages');
  }

  productStats(): Promise<ProductStatsDto> {
    return this.notImplemented('productStats');
  }

  private notImplemented(method: string): never {
    throw new Error(`CatalogProductService.${method}() is not implemented yet (see Sprint 4)`);
  }
}
