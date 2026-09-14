import type { Brand, ClientCategory, DeviceModel, Family, Prisma, Product, ProductImage } from '@prisma/client';
import {
  AdminProductResponseSchema,
  BrandResponseSchema,
  ClientCategoryResponseSchema,
  DeviceModelResponseSchema,
  FamilyResponseSchema,
  ProductDetailResponseSchema,
  ProductImageResponseSchema,
  ProductStatsResponseSchema,
  ProductWithPricingResponseSchema,
  StaffProductResponseSchema,
  StockStatus,
  type AdminProductDto,
  type BrandDto,
  type ClientCategoryDto,
  type DeviceModelDto,
  type FamilyDto,
  type ProductDetailDto,
  type ProductImageDto,
  type ProductStatsDto,
  type ProductWithPricingDto,
  type StaffProductDto,
} from '@dragon-telecom/contract';

type Money = Prisma.Decimal | number;

// Field named `deviceModel` (not `model`) to match Prisma's actual relation name on `Product`
// exactly — callers pass through their `include: { deviceModel: true }` query result as-is,
// with no rename/translation step. The DTO's own `model` field is a mapper output, unrelated.
type ProductWithRelations = Product & {
  brand: Brand;
  deviceModel?: DeviceModel | null;
  family: Family;
  images: ProductImage[];
};

export type ResolvedPricing = { currentPrice?: number; guestPrice?: number; priceHidden: boolean };
export type ViewerFlags = { inStock: boolean; inCart: boolean };
export type CategoryPriceRow = { categoryId: string; categoryName: string; price: number };
export type ClientCategoryCounts = { memberCount: number; pricedProductCount: number };
export type ProductStatsCounts = { total: number; inStock: number; lowStock: number; outOfStock: number };

export class CatalogMapper {
  static toProductImageDto(image: ProductImage): ProductImageDto {
    const dto: ProductImageDto = {
      id: image.id,
      url: image.url,
      ...(image.thumbnailUrl != null ? { thumbnailUrl: image.thumbnailUrl } : {}),
      ...(image.alt != null ? { alt: image.alt } : {}),
      position: image.position,
      isPrimary: image.isPrimary,
    };
    return ProductImageResponseSchema.parse(dto);
  }

  // Public — leaks nothing beyond `ProductWithPricingResponseSchema`'s fields: no cost, no
  // exact/reserved quantities, no margin (rules §4 "exclude by listing what you return").
  static toProductWithPricingDto(
    product: ProductWithRelations,
    priced: ResolvedPricing,
    viewer: ViewerFlags,
  ): ProductWithPricingDto {
    const dto: ProductWithPricingDto = {
      id: product.id,
      name: product.name,
      ...(product.description != null ? { description: product.description } : {}),
      ...(product.barcode != null ? { barcode: product.barcode } : {}),
      createdAt: product.createdAt.toISOString(),
      brand: { id: product.brand.id, name: product.brand.name },
      ...(product.deviceModel != null ? { model: { id: product.deviceModel.id, name: product.deviceModel.name } } : {}),
      family: {
        id: product.family.id,
        name: product.family.name,
        ...(product.family.iconUrl != null ? { iconUrl: product.family.iconUrl } : {}),
      },
      images: product.images.map((image) => CatalogMapper.toProductImageDto(image)),
      ...(priced.currentPrice != null ? { currentPrice: priced.currentPrice } : {}),
      ...(priced.guestPrice != null ? { guestPrice: priced.guestPrice } : {}),
      priceHidden: priced.priceHidden,
      inStock: viewer.inStock,
      inCart: viewer.inCart,
    };
    return ProductWithPricingResponseSchema.parse(dto);
  }

  // Detail view: the public DTO plus related-product ids (spec API Interface, plan §8 #1).
  static toProductDetailDto(
    product: ProductWithRelations,
    priced: ResolvedPricing,
    viewer: ViewerFlags,
    relatedIds: string[],
  ): ProductDetailDto {
    const dto: ProductDetailDto = {
      ...CatalogMapper.toProductWithPricingDto(product, priced, viewer),
      relatedIds,
    };
    return ProductDetailResponseSchema.parse(dto);
  }

  // Staff — read-only qty + the 4 sale prices, still no cost (spec BL#3).
  static toStaffProductDto(product: ProductWithRelations, categoryPrices: CategoryPriceRow[]): StaffProductDto {
    const dto: StaffProductDto = {
      id: product.id,
      name: product.name,
      ...(product.barcode != null ? { barcode: product.barcode } : {}),
      family: { id: product.family.id, name: product.family.name },
      brand: { id: product.brand.id, name: product.brand.name },
      ...(product.deviceModel != null ? { model: { id: product.deviceModel.id, name: product.deviceModel.name } } : {}),
      availableQuantity: CatalogMapper.availableQuantity(product),
      ...(product.defaultSalePrice != null
        ? { defaultSalePrice: CatalogMapper.toMoney(product.defaultSalePrice) }
        : {}),
      categoryPrices,
    };
    return StaffProductResponseSchema.parse(dto);
  }

  // Admin — full visibility: exact quantities, dual average costs (D10), publish/enable flags.
  // `categoryPrices` param mirrors toStaffProductDto (set-03 A1 — ADM-04's pricing card needs
  // these to render/prefill margins the same way the staff view already does).
  static toAdminProductDto(product: ProductWithRelations, categoryPrices: CategoryPriceRow[]): AdminProductDto {
    const available = CatalogMapper.availableQuantity(product);
    const dto: AdminProductDto = {
      id: product.id,
      sku: product.sku,
      ...(product.barcode != null ? { barcode: product.barcode } : {}),
      name: product.name,
      ...(product.description != null ? { description: product.description } : {}),
      family: { id: product.family.id, name: product.family.name, isEnabled: product.family.isEnabled },
      brand: { id: product.brand.id, name: product.brand.name, isEnabled: product.brand.isEnabled },
      ...(product.deviceModel != null ? { model: { id: product.deviceModel.id, name: product.deviceModel.name } } : {}),
      ...(product.guestPrice != null ? { guestPrice: CatalogMapper.toMoney(product.guestPrice) } : {}),
      ...(product.defaultSalePrice != null
        ? { defaultSalePrice: CatalogMapper.toMoney(product.defaultSalePrice) }
        : {}),
      categoryPrices,
      images: product.images.map((image) => CatalogMapper.toProductImageDto(image)),
      createdAt: product.createdAt.toISOString(),
      quantityOnHand: product.quantityOnHand,
      quantityReserved: product.quantityReserved,
      availableQuantity: available,
      avgStockPrice: CatalogMapper.toMoney(product.avgStockPrice),
      avgPrice: CatalogMapper.toMoney(product.avgPrice),
      reorderThreshold: product.reorderThreshold,
      stockStatus: CatalogMapper.deriveStockStatus(available, product.reorderThreshold),
      isPublished: product.isPublished,
      isEnabled: product.isEnabled,
    };
    return AdminProductResponseSchema.parse(dto);
  }

  static toClientCategoryDto(category: ClientCategory, counts: ClientCategoryCounts): ClientCategoryDto {
    const dto: ClientCategoryDto = {
      id: category.id,
      name: category.name,
      isEnabled: category.isEnabled,
      memberCount: counts.memberCount,
      pricedProductCount: counts.pricedProductCount,
    };
    return ClientCategoryResponseSchema.parse(dto);
  }

  static toBrandDto(brand: Brand): BrandDto {
    const dto: BrandDto = {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      ...(brand.logoUrl != null ? { logoUrl: brand.logoUrl } : {}),
      isEnabled: brand.isEnabled,
    };
    return BrandResponseSchema.parse(dto);
  }

  // `productCount` stays absent unless the caller resolved it (FAMILIES?withCount=true only —
  // plan §8 #2); omitting it (rather than passing 0) keeps every other caller's shape unchanged.
  static toFamilyDto(family: Family, productCount?: number): FamilyDto {
    const dto: FamilyDto = {
      id: family.id,
      name: family.name,
      slug: family.slug,
      ...(family.iconUrl != null ? { iconUrl: family.iconUrl } : {}),
      ...(family.parentId != null ? { parentId: family.parentId } : {}),
      isUniversal: family.isUniversal,
      isFeatured: family.isFeatured,
      isEnabled: family.isEnabled,
      ...(productCount != null ? { productCount } : {}),
    };
    return FamilyResponseSchema.parse(dto);
  }

  static toDeviceModelDto(model: DeviceModel, familyIds: string[]): DeviceModelDto {
    const dto: DeviceModelDto = {
      id: model.id,
      name: model.name,
      slug: model.slug,
      brandId: model.brandId,
      familyIds,
      isEnabled: model.isEnabled,
    };
    return DeviceModelResponseSchema.parse(dto);
  }

  static toProductStatsDto(counts: ProductStatsCounts): ProductStatsDto {
    return ProductStatsResponseSchema.parse(counts);
  }

  // Public: the service's productStats/listAdminProducts call this directly on raw quantity
  // columns without building a full DTO first (mirrors identity's public `effectivePages`).
  static availableQuantity(product: Pick<Product, 'quantityOnHand' | 'quantityReserved'>): number {
    return product.quantityOnHand - product.quantityReserved;
  }

  // available <= 0 => out_of_stock; <= reorderThreshold => low_stock; else in_stock (spec BL / plan §1.3).
  static deriveStockStatus(available: number, reorderThreshold: number): StockStatus {
    if (available <= 0) return StockStatus.OUT_OF_STOCK;
    if (available <= reorderThreshold) return StockStatus.LOW_STOCK;
    return StockStatus.IN_STOCK;
  }

  private static toMoney(value: Money): number {
    return typeof value === 'number' ? value : value.toNumber();
  }
}
