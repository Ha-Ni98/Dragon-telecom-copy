import type { Prisma } from '@prisma/client';
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
  JWTPayload,
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
  MovementType,
} from '@dragon-telecom/contract';

// `undefined` = guest (no/invalid token) — `optional`-guarded routes (§7.2 of the plan) call
// through with no viewer; the resolver/mapper branch on this exactly like the price matrix.
export type Viewer = JWTPayload | undefined;

export interface ICatalogProductService {
  listProducts(query: ProductListQuery, viewer: Viewer): Promise<PaginatedResult<ProductWithPricingDto>>;
  getProduct(id: string, viewer: Viewer): Promise<ProductDetailDto>;
  listStaffProducts(query: ProductListQuery, viewer: Viewer): Promise<PaginatedResult<StaffProductDto>>;
  listAdminProducts(query: ProductListQuery, viewer: Viewer): Promise<PaginatedResult<AdminProductDto>>;
  createProduct(cmd: CreateProductCommand, images: Express.Multer.File[]): Promise<AdminProductDto>;
  updateProduct(id: string, cmd: UpdateProductCommand): Promise<AdminProductDto>;
  updatePricing(id: string, cmd: UpdatePricingCommand): Promise<AdminProductDto>;
  addImages(id: string, cmd: AddProductImagesCommand, files: Express.Multer.File[]): Promise<AdminProductDto>;
  updateImages(id: string, cmd: UpdateProductImagesCommand): Promise<AdminProductDto>;
  productStats(): Promise<ProductStatsDto>;
}

export interface ICatalogTaxonomyService {
  listBrands(): Promise<BrandDto[]>;
  listFamilies(query: FamiliesQuery): Promise<FamilyDto[]>;
  listModels(query: ModelsQuery): Promise<DeviceModelDto[]>;
  createBrand(cmd: CreateBrandCommand): Promise<BrandDto>;
  updateBrand(id: string, cmd: UpdateBrandCommand): Promise<BrandDto>;
  createFamily(cmd: CreateFamilyCommand): Promise<FamilyDto>;
  updateFamily(id: string, cmd: UpdateFamilyCommand): Promise<FamilyDto>;
  createModel(cmd: CreateModelCommand): Promise<DeviceModelDto>;
  updateModel(id: string, cmd: UpdateModelCommand): Promise<DeviceModelDto>;
  setModelFamilies(id: string, cmd: SetModelFamiliesCommand): Promise<DeviceModelDto>;
}

export interface ICatalogCategoryService {
  listCategories(): Promise<ClientCategoryDto[]>;
  createCategory(cmd: CreateClientCategoryCommand): Promise<ClientCategoryDto>;
  updateCategory(id: string, cmd: UpdateClientCategoryCommand): Promise<ClientCategoryDto>;
}

// Injected port (dependency inversion, plan §2.1/§7.1) — the real implementation lives in the
// inventory module. `addLayer` must run *inside* the caller's own transaction, since
// `createProduct`'s first FIFO layer has to commit atomically with the product row.
export interface IInventoryPort {
  addLayer(
    tx: Prisma.TransactionClient,
    input: { productId: string; quantity: number; unitCost: number; type: MovementType },
  ): Promise<void>;
}
