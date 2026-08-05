import { randomUUID } from 'node:crypto';
import type { ClientCategory, PrismaClient, Product } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  AdminProductResponseSchema,
  BARCODE_DIGITS,
  BARCODE_GENERATION_MAX_ATTEMPTS,
  BARCODE_PREFIX_CHARS,
  BARCODE_PREFIX_PAD_CHAR,
  CATALOG_ERROR,
  MovementType,
  ProductSort,
  ProductWithPricingResponseSchema,
  StaffProductResponseSchema,
  StockStatus,
  UserType,
  paginated,
  type AddProductImagesCommand,
  type AdminProductDto,
  type BrandDto,
  type ClientCategoryDto,
  type CreateBrandCommand,
  type CreateClientCategoryCommand,
  type CreateFamilyCommand,
  type CreateModelCommand,
  type CreateProductCommand,
  type DeviceModelDto,
  type FamiliesQuery,
  type FamilyDto,
  type GenerateBarcodeCommand,
  type GeneratedBarcodeDto,
  type ModelsQuery,
  type PaginatedResult,
  type ProductDetailDto,
  type ProductListQuery,
  type ProductStatsDto,
  type ProductWithPricingDto,
  type SetModelFamiliesCommand,
  type StaffProductDto,
  type UpdateBrandCommand,
  type UpdateClientCategoryCommand,
  type UpdateFamilyCommand,
  type UpdateModelCommand,
  type UpdatePricingCommand,
  type UpdateProductCommand,
  type UpdateProductImagesCommand,
} from '@dragon-telecom/contract';
import { BadRequestError, ConflictError, NotFoundError } from '@common/errors';
import { eventBus } from '@common/events/event-bus';
import { CatalogMapper, type ResolvedPricing } from './catalog.mapper';
import type {
  ICatalogCategoryService,
  ICatalogProductService,
  ICatalogTaxonomyService,
  IInventoryPort,
  Viewer,
} from './catalog.interface';
import { storageService } from '@common/storage/storage.service';

const isKnownRequestError = (err: unknown, code: string): err is Prisma.PrismaClientKnownRequestError =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

const FEATURED_FAMILIES_LIMIT = 6;

const PRODUCT_INCLUDE = {
  brand: true,
  family: true,
  deviceModel: true,
  images: { orderBy: { position: 'asc' } },
} satisfies Prisma.ProductInclude;

function generateSku(): string {
  return `SKU-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

// S19 — the two-character half of a generated barcode prefix (owner decision Q1). NFD splits an
// accented letter into base + combining mark, the mark class is dropped, and everything that is
// not A-Z or 0-9 goes with it: "Écrans" -> EC, "3M" -> 3M, "K" -> KX, "شاشة" -> XX. Right-padding
// guarantees a fixed width, so the total barcode length is constant and BARCODE_LENGTH holds.
function barcodePrefix(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip the combining marks NFD just split off
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return normalized.slice(0, BARCODE_PREFIX_CHARS).padEnd(BARCODE_PREFIX_CHARS, BARCODE_PREFIX_PAD_CHAR);
}

// Zero-padded to exactly BARCODE_DIGITS characters — "42" must render as "00042", or two barcodes
// of different lengths could share a prefix and read ambiguously off a scanner.
function randomBarcodeDigits(): string {
  return Math.floor(Math.random() * 10 ** BARCODE_DIGITS)
    .toString()
    .padStart(BARCODE_DIGITS, '0');
}

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

export class CatalogProductService implements ICatalogProductService {
  constructor(
    private prisma: PrismaClient,
    private inventory: IInventoryPort,
  ) {}

  // Composition-root wiring only (inventory plan §6, §8 #5) — swaps the placeholder
  // InventoryPortStub for the real inventory module's engine once it's constructed. Not on
  // ICatalogProductService: controllers never call this, only modules/index.ts does.
  useInventory(port: IInventoryPort): void {
    this.inventory = port;
  }

  // Public storefront: enabled + published only, viewer-resolved pricing/inStock/inCart.
  // S15 — search widened to name-or-barcode (same pair staffAdminWhere uses); `ids` lets the
  // settings-driven featured strip ask for an exact product list.
  async listProducts(query: ProductListQuery, viewer: Viewer): Promise<PaginatedResult<ProductWithPricingDto>> {
    
    // divide the search by tokens to enable search by part of the word
    const tokens = query.search
                        ?.trim()
                        .split(/\s+/)
                        .filter(Boolean);
    
    const nameSearch = tokens && tokens.length > 0
                      ? {
                          AND: tokens.map((token) => ({
                            OR: [
                              {
                                name: {
                                  startsWith: token,
                                  mode: "insensitive" as const,
                                },
                              },
                              {
                                name: {
                                  contains: ` ${token}`,
                                  mode: "insensitive" as const,
                                },
                              },
                            ],
                          })),
                        }
                      : undefined;  

    const where: Prisma.ProductWhereInput = {
      isEnabled: true,
      isPublished: true,
      ...(query.search
        ? {
            OR: [
              // { name: { contains: query.search, mode: 'insensitive' as const } },
              { barcode: { startsWith: query.search, mode: 'insensitive' as const } },
              ...(nameSearch ? [nameSearch] : []),
            ],
          }
        : {}),
      ...(query.ids ? { id: { in: query.ids.split(',') } } : {}),
      ...(query.familyId != null ? { familyId: query.familyId } : {}),
      ...(query.brandId != null ? { brandId: query.brandId } : {}),
      ...(query.modelId != null ? { deviceModelId: query.modelId } : {}),
      ...(query.featured ? { family: { isFeatured: true } } : {}),
      // Reserved stock isn't wired by any module yet — approximated via onHand only for the
      // *filter*; the returned `inStock` boolean is still the exact (onHand - reserved) value.
      ...(query.inStock ? { quantityOnHand: { gt: 0 } } : {}),
    };

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: this.resolveProductOrderBy(query.sort, { createdAt: 'desc' }),
      }),
    ]);

    const ctx = await this.resolveViewerContext(viewer);
    const productIds = products.map((product) => product.id);
    const [priceMap, cartSet] = await Promise.all([
      this.loadPriceMap(productIds, ctx.categoryId),
      this.loadCartSet(productIds, ctx.clientId),
    ]);

    const items = products.map((product) =>
      CatalogMapper.toProductWithPricingDto(product, this.resolvePricing(product, priceMap), {
        inStock: CatalogMapper.availableQuantity(product) > 0,
        inCart: cartSet.has(product.id),
      }),
    );

    return paginated(ProductWithPricingResponseSchema).parse({
      items,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }

  async getProduct(id: string, viewer: Viewer): Promise<ProductDetailDto> {
    const product = await this.prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    if (!product || !product.isEnabled || !product.isPublished) throw new NotFoundError('Product');

    const ctx = await this.resolveViewerContext(viewer);
    const [priceMap, cartSet, related] = await Promise.all([
      this.loadPriceMap([product.id], ctx.categoryId),
      this.loadCartSet([product.id], ctx.clientId),
      this.prisma.product.findMany({
        where: { familyId: product.familyId, id: { not: product.id }, isEnabled: true, isPublished: true },
        select: { id: true },
        take: 6,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return CatalogMapper.toProductDetailDto(
      product,
      this.resolvePricing(product, priceMap),
      { inStock: CatalogMapper.availableQuantity(product) > 0, inCart: cartSet.has(product.id) },
      related.map((relatedProduct) => relatedProduct.id),
    );
  }

  // Staff: read-only, sees every enabled product across all categories at once (no viewer-tier
  // filtering — staff serve any client), so the 4 sale prices come from a plain join, not the
  // storefront resolver.
  async listStaffProducts(query: ProductListQuery, viewer: Viewer): Promise<PaginatedResult<StaffProductDto>> {
    const where = this.staffAdminWhere(query, { isEnabled: true });

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: { ...PRODUCT_INCLUDE, prices: { include: { category: true } } },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: this.resolveProductOrderBy(query.sort, { name: 'asc' }),
      }),
    ]);

    this.emitProductSearched(query, viewer, products[0]?.id);

    const items = products.map((product) =>
      CatalogMapper.toStaffProductDto(
        product,
        product.prices.map((price) => ({
          categoryId: price.clientCategoryId,
          categoryName: price.category.name,
          price: price.price.toNumber(),
        })),
      ),
    );

    return paginated(StaffProductResponseSchema).parse({
      items,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }

  async listAdminProducts(query: ProductListQuery, viewer: Viewer): Promise<PaginatedResult<AdminProductDto>> {
    const where = this.staffAdminWhere(query);

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: { ...PRODUCT_INCLUDE, prices: { include: { category: true } } },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: this.resolveProductOrderBy(query.sort, { createdAt: 'desc' }),
      }),
    ]);

    this.emitProductSearched(query, viewer, products[0]?.id);

    const items = products.map((product) =>
      CatalogMapper.toAdminProductDto(
        product,
        product.prices.map((price) => ({
          categoryId: price.clientCategoryId,
          categoryName: price.category.name,
          price: price.price.toNumber(),
        })),
      ),
    );

    return paginated(AdminProductResponseSchema).parse({
      items,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }

  // qty=0 -> priceless product, pricing fields already schema-rejected (PRICING_REQUIRES_STOCK);
  // qty>0 -> cost required (schema-enforced), first FIFO layer created in the same tx via the
  // injected port, then pricing unlocked. Catalog never writes quantityOnHand/avgStockPrice/
  // avgPrice itself — inventory.addLayer owns those columns (spec BL#6).
  async createProduct(
    cmd: CreateProductCommand,
    images: Express.Multer.File[],
    staffId: string,
  ): Promise<AdminProductDto> {
    try {
      const productId = await this.prisma.$transaction(async (tx) => {
        const brandId = await this.resolveBrandId(tx, cmd);
        const familyId = await this.resolveFamilyId(tx, cmd);
        const deviceModelId = await this.resolveModelId(tx, cmd, brandId);

        const product = await tx.product.create({
          data: {
            sku: generateSku(),
            ...(cmd.barcode != null && cmd.barcode.trim() !== ''
              ? { barcode: cmd.barcode.trim() }
              : {}),
            name: cmd.name,
            ...(cmd.description != null ? { description: cmd.description } : {}),
            familyId,
            brandId,
            isPublished: true,
            ...(deviceModelId != null ? { deviceModelId } : {}),
            ...(cmd.guestPrice != null ? { guestPrice: cmd.guestPrice } : {}),
            ...(cmd.defaultSalePrice != null ? { defaultSalePrice: cmd.defaultSalePrice } : {}),
            ...(cmd.reorderThreshold != null ? { reorderThreshold: cmd.reorderThreshold } : {}),
          },
        });

        if (cmd.initialQuantity > 0) {
          await this.inventory.addLayer(tx, {
            productId: product.id,
            quantity: cmd.initialQuantity,
            unitCost: cmd.initialUnitCost!,
            type: MovementType.INITIAL_STOCK,
            staffId,
          });
        }

        if (cmd.categoryPrices?.length) {
          await tx.productPrice.createMany({
            data: cmd.categoryPrices.map((categoryPrice) => ({
              productId: product.id,
              clientCategoryId: categoryPrice.categoryId,
              price: categoryPrice.price,
            })),
          });
        }

        if (images.length > 0) {
          const uploadedImages = await Promise.all(
            images.map((file) =>
              storageService.upload(
                {
                  buffer: file.buffer,
                  originalname: file.originalname,
                  mimetype: file.mimetype,
                },
                "products",
              ),
            ),
          );

          await tx.productImage.createMany({
            data: uploadedImages.map((image, index) => ({
              productId: product.id,
              url: image.url,
              key: image.key,
              position: index,
              isPrimary: index === 0,
            })),
          });
        }

        return product.id;
      });

      eventBus.emit('product.created', { productId, name: cmd.name });
      return this.getAdminProduct(productId);
    } catch (err) {
      if (isKnownRequestError(err, 'P2002')) throw new ConflictError(CATALOG_ERROR.BARCODE_TAKEN);
      throw err;
    }
  }

  // Core fields only — quantity/avgStockPrice/avgPrice/pricing all live on other routes (spec BL#6).
  // No CatalogEvents member covers a plain product-detail update; nothing is emitted.
  async updateProduct(id: string, cmd: UpdateProductCommand): Promise<AdminProductDto> {
    try {
      await this.prisma.product.update({
        where: { id },
        data: {
          // S19 — the field is freely editable and may be *cleared*; an empty string would be
          // stored and then collide with the next cleared product under `barcode @unique`, so
          // blank maps to NULL. Trimmed for the same reason a scanned value must match exactly.
          ...(cmd.barcode != null
            ? { barcode: cmd.barcode.trim() === '' ? null : cmd.barcode.trim() }
            : {}),
          ...(cmd.name != null ? { name: cmd.name } : {}),
          ...(cmd.description != null ? { description: cmd.description } : {}),
          ...(cmd.reorderThreshold != null ? { reorderThreshold: cmd.reorderThreshold } : {}),
          ...(cmd.isPublished != null ? { isPublished: cmd.isPublished } : {}),
          ...(cmd.isEnabled != null ? { isEnabled: cmd.isEnabled } : {}),
        },
      });
    } catch (err) {
      if (isKnownRequestError(err, 'P2025')) throw new NotFoundError('Product');
      if (isKnownRequestError(err, 'P2002')) throw new ConflictError(CATALOG_ERROR.BARCODE_TAKEN);
      throw err;
    }
    return this.getAdminProduct(id);
  }

  async updatePricing(id: string, cmd: UpdatePricingCommand): Promise<AdminProductDto> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('Product');

    await this.prisma.$transaction((tx) => this.applyPricing(tx, id, cmd));

    eventBus.emit('product.repriced', { productId: id, name: product.name });
    return this.getAdminProduct(id);
  }

  // Tx-aware, no event emit inside (the caller emits after its own commit) — the seam inventory's
  // adjustment flow needs to reprice atomically in the same transaction as its stock delta
  // (inventory plan §7.2, §8 #5). Structurally satisfies inventory's ICatalogPricingPort without
  // catalog importing that type — exported as `catalogPricingService` from catalog.routes.ts.
  async applyPricing(tx: Prisma.TransactionClient, productId: string, cmd: UpdatePricingCommand): Promise<void> {
    await tx.product.update({
      where: { id: productId },
      data: {
        // `null` clears/hides the guest price; omitted leaves it untouched — distinct from
        // `!= null`, which would drop the caller's explicit null (UpdatePricingCommand.guestPrice
        // is `number | null | undefined`, each state meaningful).
        ...(cmd.guestPrice !== undefined ? { guestPrice: cmd.guestPrice } : {}),
        ...(cmd.defaultSalePrice != null ? { defaultSalePrice: cmd.defaultSalePrice } : {}),
      },
    });

    if (cmd.categoryPrices?.length) {
      await Promise.all(
        cmd.categoryPrices.map((categoryPrice) =>
          tx.productPrice.upsert({
            where: { productId_clientCategoryId: { productId, clientCategoryId: categoryPrice.categoryId } },
            create: { productId, clientCategoryId: categoryPrice.categoryId, price: categoryPrice.price },
            update: { price: categoryPrice.price },
          }),
        ),
      );
    }
  }

  async addImages(id: string, cmd: AddProductImagesCommand, files: Express.Multer.File[]): Promise<AdminProductDto> {
    if (files.length !== cmd.images.length) {
      throw new BadRequestError('Image count must match the number of files uploaded');
    }
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('Product');

    const uploadedImages = await Promise.all(
      files.map((file) =>
        storageService.upload(
          {
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
          },
          "products",
        ),
      ),
    );

    await this.prisma.productImage.createMany({
      data: cmd.images.map((meta, index) => ({
        productId: id,

        url: uploadedImages[index]!.url,

        key: uploadedImages[index]!.key,

        ...(meta.alt != null ? { alt: meta.alt } : {}),

        position: meta.position ?? index,

        isPrimary: meta.isPrimary ?? false,
      })),
    });

    return this.getAdminProduct(id);
  }

  async updateImages(id: string, cmd: UpdateProductImagesCommand): Promise<AdminProductDto> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('Product');

    await this.prisma.$transaction(
      cmd.images.map((image) =>
        this.prisma.productImage.update({
          where: { id: image.id },
          data: {
            ...(image.alt != null ? { alt: image.alt } : {}),
            ...(image.position != null ? { position: image.position } : {}),
            ...(image.isPrimary != null ? { isPrimary: image.isPrimary } : {}),
          },
        }),
      ),
    );

    return this.getAdminProduct(id);
  }

  // Deletes the row *and* the file on disk (S3). The DB row is the source of truth: if the file
  // is already gone (manual cleanup, a failed earlier delete) the unlink error is swallowed and
  // the row still goes — an orphaned row would keep rendering a broken <img>, which is worse than
  // an orphaned file. `basename()` is a path-traversal guard: `url` is written by this service as
  // `/uploads/<generated-uuid><ext>`, but it is still a stored string, so the filesystem path is
  // rebuilt from its last segment only and never from the stored value directly.
  async deleteImage(id: string, imageId: string): Promise<AdminProductDto> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('Product');

    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image || image.productId !== id) throw new NotFoundError('ProductImage');
    const imageCount = await this.prisma.productImage.count({ where: { url: image.url } });

    await this.prisma.productImage.delete({ where: { id: imageId } });

    // Deleting the primary leaves the product with no primary at all, so the storefront card and
    // every `images[0]`-style consumer would render nothing. Promote the lowest-position survivor.
    if (image.isPrimary) {
      const next = await this.prisma.productImage.findFirst({
        where: { productId: id },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      });
      if (next) {
        await this.prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    }

    if (imageCount == 1) {
      try {
        await storageService.delete(image.key);
      } catch {
        // File already absent — the row is gone, which is what the caller asked for.
      }
    }

    return this.getAdminProduct(id);
  }

  // Fetches minimal columns for every product and reduces in application code — no raw SQL for
  // the onHand-vs-reserved comparison; the catalog scale this app targets (a single store's
  // parts inventory) makes this trivially cheap.
  async productStats(): Promise<ProductStatsDto> {
    const products = await this.prisma.product.findMany({
      select: { quantityOnHand: true, quantityReserved: true, reorderThreshold: true },
    });

    const counts = products.reduce(
      (acc, product) => {
        const available = CatalogMapper.availableQuantity(product);
        const status = CatalogMapper.deriveStockStatus(available, product.reorderThreshold);
        acc.total += 1;
        if (status === StockStatus.OUT_OF_STOCK) acc.outOfStock += 1;
        else if (status === StockStatus.LOW_STOCK) acc.lowStock += 1;
        else acc.inStock += 1;
        return acc;
      },
      { total: 0, inStock: 0, lowStock: 0, outOfStock: 0 },
    );

    return CatalogMapper.toProductStatsDto(counts);
  }

  // S19 — a read-only probe: no row is written, so no transaction and no lock. Two admins
  // generating at the same instant can still be handed the same candidate; that is deliberate and
  // harmless, because `Product.barcode @unique` is the real guard and createProduct/updateProduct
  // already translate its P2002 into a CATALOG_ERROR.BARCODE_TAKEN conflict the forms put on the
  // barcode field. The returned value is a suggestion the admin may overwrite or clear.
  async generateBarcode(cmd: GenerateBarcodeCommand): Promise<GeneratedBarcodeDto> {
    const [family, brand] = await Promise.all([
      this.prisma.family.findUnique({ where: { id: cmd.familyId }, select: { name: true } }),
      this.prisma.brand.findUnique({ where: { id: cmd.brandId }, select: { name: true } }),
    ]);
    if (!family) throw new NotFoundError('Family');
    if (!brand) throw new NotFoundError('Brand');

    const prefix = `${barcodePrefix(family.name)}${barcodePrefix(brand.name)}`;

    // Only the digits are regenerated on collision (the prefix is derived, not random), bounded by
    // BARCODE_GENERATION_MAX_ATTEMPTS so the loop always terminates (owner decision Q2).
    for (let attempt = 0; attempt < BARCODE_GENERATION_MAX_ATTEMPTS; attempt += 1) {
      const candidate = `${prefix}${randomBarcodeDigits()}`;
      const taken = await this.prisma.product.findUnique({
        where: { barcode: candidate },
        select: { id: true },
      });
      if (!taken) return { barcode: candidate };
    }

    throw new ConflictError(CATALOG_ERROR.BARCODE_GENERATION_EXHAUSTED);
  }

  // Read port for clients' cart hydration (plan §C-3, §I.5) — an id-set counterpart to
  // listProducts' pagination-shaped query, reusing the exact same viewer-pricing resolution
  // (no separate price-matrix logic to keep in sync). No isEnabled/isPublished filter: a
  // favorited product staying visible in the cart even if later disabled/unpublished is the
  // safer default (silently dropping it would look like data loss to the client).
  async getCartProducts(productIds: string[], viewer: Viewer): Promise<ProductWithPricingDto[]> {
    if (productIds.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: PRODUCT_INCLUDE,
    });

    const ctx = await this.resolveViewerContext(viewer);
    const ids = products.map((product) => product.id);
    const [priceMap, cartSet] = await Promise.all([
      this.loadPriceMap(ids, ctx.categoryId),
      this.loadCartSet(ids, ctx.clientId),
    ]);

    return products.map((product) =>
      CatalogMapper.toProductWithPricingDto(product, this.resolvePricing(product, priceMap), {
        inStock: CatalogMapper.availableQuantity(product) > 0,
        inCart: cartSet.has(product.id),
      }),
    );
  }

  // Read port for purchasing's confirm step (plan §C-3, §II.5) — runs inside the *caller's*
  // transaction (`tx`) so it observes each line's `addLayer`-updated `avgStockPrice` before the
  // caller's own commit, matching the spec's "post-addLayer average" requirement for
  // ConfirmResultDto.repriceCandidates. `quantityOnHand` is S7's "qty in stock beside the avg
  // stock qty" — pure plumbing added here rather than reopening the contract twice.
  async getRepriceCandidates(
    tx: Prisma.TransactionClient,
    productIds: string[],
  ): Promise<
    {
      productId: string;
      name: string;
      avgStockPrice: number;
      quantityOnHand: number;
      current: {
        guestPrice?: number;
        defaultSalePrice?: number;
        categoryPrices: { categoryId: string; categoryName: string; price: number }[];
      };
    }[]
  > {
    if (productIds.length === 0) return [];

    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      include: { prices: { include: { category: true } } },
    });

    return products.map((product) => ({
      productId: product.id,
      name: product.name,
      avgStockPrice: product.avgStockPrice.toNumber(),
      quantityOnHand: product.quantityOnHand,
      current: {
        ...(product.guestPrice != null ? { guestPrice: product.guestPrice.toNumber() } : {}),
        ...(product.defaultSalePrice != null ? { defaultSalePrice: product.defaultSalePrice.toNumber() } : {}),
        categoryPrices: product.prices.map((price) => ({
          categoryId: price.clientCategoryId,
          categoryName: price.category.name,
          price: price.price.toNumber(),
        })),
      },
    }));
  }

  // Read port for purchasing's DRAFT-read projection (plan §C-3, §II.3 #2) — plain read (no
  // tx), feeds projectedNewAvgStockPrice + productNameSnapshot before any layer is added.
  // avgPrice (D10) is exposed here too — purchasing's Add-Invoice "avg price is …" helper
  // (S7) reads the unweighted figure, distinct from the projection which uses avgStockPrice.
  async getCostBasis(
    productIds: string[],
  ): Promise<{ productId: string; name: string; avgStockPrice: number; avgPrice: number; quantityOnHand: number }[]> {
    if (productIds.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, avgStockPrice: true, avgPrice: true, quantityOnHand: true },
    });

    return products.map((product) => ({
      productId: product.id,
      name: product.name,
      avgStockPrice: product.avgStockPrice.toNumber(),
      avgPrice: product.avgPrice.toNumber(),
      quantityOnHand: product.quantityOnHand,
    }));
  }

  // Read port for sales' confirm step (plan §C-2, §I.2) — POS-tier price (attached POS client's
  // category) else `defaultSalePrice`, never `guestPrice`/the storefront viewer split. Named
  // `resolvePosPrices` (not `getPosPrices`) to match `ICatalogPosPricingPort`'s declared method
  // exactly — structural typing needs the name, not just the shape. Mirrors
  // getRepriceCandidates/getCostBasis: a plain read, no throw — an unresolved price is simply
  // omitted from `resolvedPrice`; sales' own business rule decides what to do about it.
  async resolvePosPrices(
    productIds: string[],
    categoryId: string | null,
  ): Promise<{ productId: string; productName: string; resolvedPrice?: number }[]> {
    if (productIds.length === 0) return [];

    const [products, tierPriceRows] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, defaultSalePrice: true },
      }),
      categoryId != null
        ? this.prisma.productPrice.findMany({
            where: { productId: { in: productIds }, clientCategoryId: categoryId },
          })
        : Promise.resolve([]),
    ]);

    const tierPriceMap = new Map(tierPriceRows.map((row) => [row.productId, row.price.toNumber()]));

    return products.map((product) => {
      const resolvedPrice = tierPriceMap.get(product.id) ?? product.defaultSalePrice?.toNumber();
      return {
        productId: product.id,
        productName: product.name,
        ...(resolvedPrice != null ? { resolvedPrice } : {}),
      };
    });
  }

  private staffAdminWhere(query: ProductListQuery, extra: Prisma.ProductWhereInput = {}): Prisma.ProductWhereInput {
    
    const tokens = query.search
                        ?.trim()
                        .split(/\s+/)
                        .filter(Boolean);
    
    const nameSearch = tokens && tokens.length > 0
                      ? {
                          AND: tokens.map((token) => ({
                            OR: [
                              {
                                name: {
                                  startsWith: token,
                                  mode: "insensitive" as const,
                                },
                              },
                              {
                                name: {
                                  contains: ` ${token}`,
                                  mode: "insensitive" as const,
                                },
                              },
                            ],
                          })),
                        }
                      : undefined;  
    return {
      ...extra,
      isEnabled: true,
      // Name is a case-insensitive substring match; barcode is a prefix match so it can use the
      // `Product.barcode @unique` btree index (S1 finding F1 — a `contains` predicate could not).
      // A scanner emits a whole barcode, so `startsWith` also covers the exact-scan case.
      ...(query.search
        ? {
            OR: [
             // { name: { contains: query.search, mode: 'insensitive' as const } },
              { barcode: { startsWith: query.search, mode: 'insensitive' as const } },
              ...(nameSearch ? [nameSearch] : []),
            ],
          }
        : {}),
      // S17 — same comma-separated `ids` filter the public list already honours (S15); the
      // Settings featured-products picker resolves its saved ids to admin rows through this.
      ...(query.ids ? { id: { in: query.ids.split(',') } } : {}),
      ...(query.familyId != null ? { familyId: query.familyId } : {}),
      ...(query.brandId != null ? { brandId: query.brandId } : {}),
      ...(query.modelId != null ? { deviceModelId: query.modelId } : {}),
    };
  }

  // Stage-0 PUB-02's four server-side sort keys (audit fix B3 — the catalog is paginated
  // server-side, so client-side sorting can only reorder the current page). `fallback` lets
  // each caller keep its own no-sort-given default: the public list already defaulted to
  // newest, staff's own listing keeps its alphabetical default (owner decision) rather than
  // switching to newest just because the mapping is now shared.
  // Recorded limitation: price sort uses the public reference price (`guestPrice`), never a
  // per-viewer resolved price — a tier-priced client's resolved prices may deviate slightly
  // from this ordering. Per-viewer price sorting would require per-row resolution and is
  // explicitly out of scope.
  private resolveProductOrderBy(
    sort: ProductSort | undefined,
    fallback: Prisma.ProductOrderByWithRelationInput,
  ): Prisma.ProductOrderByWithRelationInput {
    switch (sort) {
      case ProductSort.NEWEST:
        return { createdAt: 'desc' };
      case ProductSort.NAME:
        return { name: 'asc' };
      case ProductSort.PRICE_ASC:
        return { guestPrice: { sort: 'asc', nulls: 'last' } };
      case ProductSort.PRICE_DESC:
        return { guestPrice: { sort: 'desc', nulls: 'last' } };
      default:
        return fallback;
    }
  }

  // Only staff/admin searches narrate to observability (spec: "fired by staff/admin list
  // searches") — the public storefront's listProducts never emits this, guest or not.
  private emitProductSearched(query: ProductListQuery, viewer: Viewer, matchedProductId?: string): void {
    if (!query.search || !viewer) return;
    eventBus.emit('product.searched', {
      userId: viewer.sub,
      query: query.search,
      ...(matchedProductId != null ? { matchedProductId } : {}),
    });
  }

  private async resolveViewerContext(viewer: Viewer): Promise<{ clientId?: string; categoryId?: string }> {
    if (viewer?.type !== UserType.CLIENT || viewer.clientId == null) return {};
    const client = await this.prisma.client.findUnique({
      where: { id: viewer.clientId },
      select: { posClient: { select: { categoryId: true } } },
    });
    return { clientId: viewer.clientId, ...(client?.posClient?.categoryId != null ? { categoryId: client.posClient.categoryId } : {}) };
  }

  private async loadPriceMap(productIds: string[], categoryId?: string): Promise<Map<string, number>> {
    if (categoryId == null || productIds.length === 0) return new Map();
    const rows = await this.prisma.productPrice.findMany({
      where: { productId: { in: productIds }, clientCategoryId: categoryId },
    });
    return new Map(rows.map((row) => [row.productId, row.price.toNumber()]));
  }

  private async loadCartSet(productIds: string[], clientId?: string): Promise<Set<string>> {
    if (clientId == null || productIds.length === 0) return new Set();
    const rows = await this.prisma.clientCart.findMany({
      where: { clientId, productId: { in: productIds } },
      select: { productId: true },
    });
    return new Set(rows.map((row) => row.productId));
  }

  // The one function reused by storefront/POS/orders (spec BL#1): tier price → else guestPrice;
  // `guestPrice` on the DTO is always the raw entity value (informational), independent of viewer.
  private resolvePricing(product: Pick<Product, 'id' | 'guestPrice'>, priceMap: Map<string, number>): ResolvedPricing {
    const tierPrice = priceMap.get(product.id);
    const guestPrice = product.guestPrice != null ? product.guestPrice.toNumber() : undefined;
    const currentPrice = tierPrice ?? guestPrice;
    return {
      ...(currentPrice != null ? { currentPrice } : {}),
      ...(guestPrice != null ? { guestPrice } : {}),
      priceHidden: currentPrice == null,
    };
  }

  private async resolveBrandId(tx: Prisma.TransactionClient, cmd: CreateProductCommand): Promise<string> {
    if (cmd.brandId != null) return cmd.brandId;
    const brand = await tx.brand.create({
      data: { name: cmd.newBrandName!, slug: slugify(cmd.newBrandName!) },
    });
    return brand.id;
  }

  private async resolveFamilyId(tx: Prisma.TransactionClient, cmd: CreateProductCommand): Promise<string> {
    if (cmd.familyId != null) return cmd.familyId;
    const family = await tx.family.create({
      data: { name: cmd.newFamilyName!, slug: slugify(cmd.newFamilyName!) },
    });
    return family.id;
  }

  private async resolveModelId(
    tx: Prisma.TransactionClient,
    cmd: CreateProductCommand,
    brandId: string,
  ): Promise<string | null> {
    if (cmd.modelId != null) {
      const model = await tx.deviceModel.findUnique({ where: { id: cmd.modelId } });
      if (!model) throw new NotFoundError('DeviceModel');
      if (model.brandId !== brandId) throw new BadRequestError('modelId does not belong to the resolved brand');
      return cmd.modelId;
    }
    if (cmd.newModelName != null) {
      const model = await tx.deviceModel.create({
        data: { brandId, name: cmd.newModelName, slug: slugify(cmd.newModelName) },
      });
      return model.id;
    }
    return null;
  }

  // Public: also serves ADMIN_PRODUCT_BY_ID's GET directly, not just the post-mutation reload.
  async getAdminProduct(id: string): Promise<AdminProductDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { ...PRODUCT_INCLUDE, prices: { include: { category: true } } },
    });
    if (!product) throw new NotFoundError('Product');
    return CatalogMapper.toAdminProductDto(
      product,
      product.prices.map((price) => ({
        categoryId: price.clientCategoryId,
        categoryName: price.category.name,
        price: price.price.toNumber(),
      })),
    );
  }
}
