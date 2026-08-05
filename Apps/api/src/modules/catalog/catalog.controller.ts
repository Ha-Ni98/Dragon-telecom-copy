import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@common/http/response';
import { AuthError } from '@common/errors';
import type {
  AddProductImagesCommand,
  BrandIdParams,
  CategoryIdParams,
  CreateBrandCommand,
  CreateClientCategoryCommand,
  CreateFamilyCommand,
  CreateModelCommand,
  CreateProductCommand,
  FamiliesQuery,
  FamilyIdParams,
  GenerateBarcodeCommand,
  ModelIdParams,
  ModelsQuery,
  ProductIdParams,
  ProductImageParams,
  ProductListQuery,
  SetModelFamiliesCommand,
  UpdateBrandCommand,
  UpdateClientCategoryCommand,
  UpdateFamilyCommand,
  UpdateModelCommand,
  UpdatePricingCommand,
  UpdateProductCommand,
  UpdateProductImagesCommand,
} from '@dragon-telecom/contract';
import type { ICatalogCategoryService, ICatalogProductService, ICatalogTaxonomyService } from './catalog.interface';

// `req.files` is only populated on multipart routes (Multer `.array(...)`); every other route
// never sets it, hence the fallback to an empty array rather than throwing.
const filesOf = (req: Request): Express.Multer.File[] => (req.files as Express.Multer.File[] | undefined) ?? [];

export class CatalogController {
  constructor(
    private products: ICatalogProductService,
    private taxonomy: ICatalogTaxonomyService,
    private categories: ICatalogCategoryService,
  ) {}

  // --- Public taxonomy ---

  listBrands = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.taxonomy.listBrands());
    } catch (error) {
      next(error);
    }
  };

  listFamilies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.taxonomy.listFamilies(req.validated.query as FamiliesQuery));
    } catch (error) {
      next(error);
    }
  };

  listModels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.taxonomy.listModels(req.validated.query as ModelsQuery));
    } catch (error) {
      next(error);
    }
  };

  // --- Public / viewer-resolved products ---

  listProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.products.listProducts(req.validated.query as ProductListQuery, req.user));
    } catch (error) {
      next(error);
    }
  };

  getProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as ProductIdParams;
      sendSuccess(res, await this.products.getProduct(id, req.user));
    } catch (error) {
      next(error);
    }
  };

  // --- Staff ---

  listStaffProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.products.listStaffProducts(req.validated.query as ProductListQuery, req.user));
    } catch (error) {
      next(error);
    }
  };

  listCategories = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.categories.listCategories());
    } catch (error) {
      next(error);
    }
  };

  // --- Admin: products ---

  listAdminProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.products.listAdminProducts(req.validated.query as ProductListQuery, req.user));
    } catch (error) {
      next(error);
    }
  };

  createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const staffId = req.user?.staffId;
      if (!staffId) throw new AuthError('Admin user has no staff profile');
      const result = await this.products.createProduct(req.validated.body as CreateProductCommand, filesOf(req), staffId);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  getAdminProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as ProductIdParams;
      sendSuccess(res, await this.products.getAdminProduct(id));
    } catch (error) {
      next(error);
    }
  };

  updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as ProductIdParams;
      sendSuccess(res, await this.products.updateProduct(id, req.validated.body as UpdateProductCommand));
    } catch (error) {
      next(error);
    }
  };

  updatePricing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as ProductIdParams;
      sendSuccess(res, await this.products.updatePricing(id, req.validated.body as UpdatePricingCommand));
    } catch (error) {
      next(error);
    }
  };

  addImages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as ProductIdParams;
      const result = await this.products.addImages(id, req.validated.body as AddProductImagesCommand, filesOf(req));
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  updateImages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as ProductIdParams;
      sendSuccess(res, await this.products.updateImages(id, req.validated.body as UpdateProductImagesCommand));
    } catch (error) {
      next(error);
    }
  };

  deleteImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, imageId } = req.validated.params as ProductImageParams;
      sendSuccess(res, await this.products.deleteImage(id, imageId));
    } catch (err) {
      next(err);
    }
  };

  productStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.products.productStats());
    } catch (error) {
      next(error);
    }
  };

  generateBarcode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.products.generateBarcode(req.validated.body as GenerateBarcodeCommand));
    } catch (error) {
      next(error);
    }
  };

  // --- Admin: taxonomy ---

  listAdminBrands = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.taxonomy.listBrands(true));
    } catch (error) {
      next(error);
    }
  };

  createBrand = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.taxonomy.createBrand(req.validated.body as CreateBrandCommand);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  updateBrand = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as BrandIdParams;
      sendSuccess(res, await this.taxonomy.updateBrand(id, req.validated.body as UpdateBrandCommand));
    } catch (error) {
      next(error);
    }
  };

  listAdminFamilies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.taxonomy.listFamilies(req.validated.query as FamiliesQuery, true));
    } catch (error) {
      next(error);
    }
  };

  createFamily = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.taxonomy.createFamily(req.validated.body as CreateFamilyCommand);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  updateFamily = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as FamilyIdParams;
      sendSuccess(res, await this.taxonomy.updateFamily(id, req.validated.body as UpdateFamilyCommand));
    } catch (error) {
      next(error);
    }
  };

  listAdminModels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.taxonomy.listModels(req.validated.query as ModelsQuery, true));
    } catch (error) {
      next(error);
    }
  };

  createModel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.taxonomy.createModel(req.validated.body as CreateModelCommand);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  updateModel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as ModelIdParams;
      sendSuccess(res, await this.taxonomy.updateModel(id, req.validated.body as UpdateModelCommand));
    } catch (error) {
      next(error);
    }
  };

  setModelFamilies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as ModelIdParams;
      sendSuccess(res, await this.taxonomy.setModelFamilies(id, req.validated.body as SetModelFamiliesCommand));
    } catch (error) {
      next(error);
    }
  };

  // --- Admin: client categories ---

  createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.categories.createCategory(req.validated.body as CreateClientCategoryCommand);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  updateCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as CategoryIdParams;
      sendSuccess(res, await this.categories.updateCategory(id, req.validated.body as UpdateClientCategoryCommand));
    } catch (error) {
      next(error);
    }
  };
}
