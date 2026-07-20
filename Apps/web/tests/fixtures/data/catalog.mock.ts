import {
  ProductWithPricingResponseSchema,
  ProductDetailResponseSchema,
  StaffProductResponseSchema,
  AdminProductResponseSchema,
  BrandResponseSchema,
  FamilyResponseSchema,
  DeviceModelResponseSchema,
  ClientCategoryResponseSchema,
  ProductStatsResponseSchema,
  StockStatus,
  paginated,
  type ProductWithPricingDto,
  type ProductDetailDto,
  type StaffProductDto,
  type AdminProductDto,
  type BrandDto,
  type FamilyDto,
  type DeviceModelDto,
  type ClientCategoryDto,
  type ProductStatsDto,
  type PaginatedResult,
} from "@dragon-telecom/contract";

const PAGE_META = { page: 1, limit: 15, total: 1, totalPages: 1 };

export const mockBrand: BrandDto = BrandResponseSchema.parse({
  id: "b1000000-0000-4000-8000-000000000001",
  name: "Samsung",
  slug: "samsung",
  isEnabled: true,
});

export const mockFamily: FamilyDto = FamilyResponseSchema.parse({
  id: "f1000000-0000-4000-8000-000000000001",
  name: "Screens",
  slug: "screens",
  isUniversal: false,
  isFeatured: true,
  isEnabled: true,
});

// `withCount=true` variant — productCount is omitted unless that query flag is set.
export const mockFamilyWithCount: FamilyDto = FamilyResponseSchema.parse({
  ...mockFamily,
  productCount: 12,
});

export const mockModel: DeviceModelDto = DeviceModelResponseSchema.parse({
  id: "de000000-0000-4000-8000-000000000001",
  name: "Galaxy S21",
  slug: "galaxy-s21",
  brandId: mockBrand.id,
  familyIds: [mockFamily.id],
  isEnabled: true,
});

export const mockClientCategory: ClientCategoryDto = ClientCategoryResponseSchema.parse({
  id: "c1000000-0000-4000-8000-000000000001",
  name: "Repair Shops",
  isEnabled: true,
  memberCount: 4,
  pricedProductCount: 20,
});

// Guest/logged-out viewer: priceHidden true, no currentPrice — the price matrix's other pole.
export const mockProductGuestHidden: ProductWithPricingDto = ProductWithPricingResponseSchema.parse(
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Galaxy S21 Screen",
    createdAt: "2026-01-01T00:00:00.000Z",
    brand: { id: mockBrand.id, name: mockBrand.name },
    family: { id: mockFamily.id, name: mockFamily.name },
    images: [],
    priceHidden: true,
    inStock: true,
    inCart: false,
  },
);

// Authenticated viewer: resolved price visible, cart membership true.
export const mockProductWithPricing: ProductWithPricingDto = ProductWithPricingResponseSchema.parse(
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "Galaxy S21 Battery",
    barcode: "6000000000002",
    createdAt: "2026-01-02T00:00:00.000Z",
    brand: { id: mockBrand.id, name: mockBrand.name },
    model: { id: mockModel.id, name: mockModel.name },
    family: { id: mockFamily.id, name: mockFamily.name, iconUrl: "https://example.com/icon.png" },
    images: [
      {
        id: "1a000000-0000-4000-8000-000000000001",
        url: "https://example.com/1.jpg",
        position: 0,
        isPrimary: true,
      },
    ],
    currentPrice: 4500,
    guestPrice: 5000,
    priceHidden: false,
    inStock: true,
    inCart: true,
  },
);

export const mockProductsList: ProductWithPricingDto[] = [
  mockProductGuestHidden,
  mockProductWithPricing,
];

export const mockProductsPaginated: PaginatedResult<ProductWithPricingDto> = paginated(
  ProductWithPricingResponseSchema,
).parse({ items: mockProductsList, meta: { ...PAGE_META, total: mockProductsList.length } });

export const mockProductsEmptyPaginated: PaginatedResult<ProductWithPricingDto> = paginated(
  ProductWithPricingResponseSchema,
).parse({ items: [], meta: { ...PAGE_META, total: 0, totalPages: 0 } });

export const mockProductDetail: ProductDetailDto = ProductDetailResponseSchema.parse({
  ...mockProductWithPricing,
  relatedIds: [mockProductGuestHidden.id],
});

export const mockStaffProduct: StaffProductDto = StaffProductResponseSchema.parse({
  id: mockProductWithPricing.id,
  name: mockProductWithPricing.name,
  family: { id: mockFamily.id, name: mockFamily.name },
  brand: { id: mockBrand.id, name: mockBrand.name },
  availableQuantity: 8,
  defaultSalePrice: 4500,
  categoryPrices: [
    { categoryId: mockClientCategory.id, categoryName: mockClientCategory.name, price: 4200 },
  ],
});

export const mockStaffProductsPaginated: PaginatedResult<StaffProductDto> = paginated(
  StaffProductResponseSchema,
).parse({ items: [mockStaffProduct], meta: { ...PAGE_META, total: 1 } });

export const mockAdminProduct: AdminProductDto = AdminProductResponseSchema.parse({
  id: mockProductWithPricing.id,
  sku: "SKU-0001",
  name: mockProductWithPricing.name,
  family: { id: mockFamily.id, name: mockFamily.name },
  brand: { id: mockBrand.id, name: mockBrand.name },
  guestPrice: 5000,
  defaultSalePrice: 4500,
  // set-03 A1 — AdminProductDto now carries categoryPrices (mirrors mockStaffProduct's).
  categoryPrices: [
    { categoryId: mockClientCategory.id, categoryName: mockClientCategory.name, price: 4200 },
  ],
  createdAt: "2026-01-02T00:00:00.000Z",
  quantityOnHand: 10,
  quantityReserved: 2,
  availableQuantity: 8,
  averageCost: 3000,
  reorderThreshold: 3,
  stockStatus: StockStatus.IN_STOCK,
  isPublished: true,
  isEnabled: true,
});

export const mockAdminProductsPaginated: PaginatedResult<AdminProductDto> = paginated(
  AdminProductResponseSchema,
).parse({ items: [mockAdminProduct], meta: { ...PAGE_META, total: 1 } });

export const mockProductStats: ProductStatsDto = ProductStatsResponseSchema.parse({
  total: 42,
  inStock: 30,
  lowStock: 8,
  outOfStock: 4,
});
