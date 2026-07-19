/**
 * Admin Settings Service
 * Handles CRUD operations for admin settings functionality
 */

import {
  AdminAccountWithDetails,
  AdminAccountFormData,
  ClientCategory,
  ClientCategoryFormData,
  Family,
  FamilyFormData,
  Brand,
  BrandFormData,
  Model,
  ModelFormData,
  DeliveryFee,
  DeliveryFeeFormData,
  ExcelImportResult,
  ServiceResponse
} from '@/types/draft-types';
import {
  mockAdminAccounts,
  mockClientCategories,
  mockFamilies,
  mockBrands,
  mockModels,
  mockDeliveryFees,
  getNextId,
  sleep,
  generateMockAdminAccount,
  generateMockClientCategory,
  generateMockFamily,
  generateMockBrand,
  generateMockModel,
  generateMockDeliveryFee
} from '@/mocks/admin-settings';

/**
 * Admin Settings Service
 * Provides methods for all admin settings management operations
 */
export class AdminSettingsService {
  private static cache = new Map<string, any>();
  private static cacheTimeout = 2 * 60 * 1000; // 2 minutes

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /**
   * Get data from cache
   */
  private static getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * Set data in cache
   */
  private static setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all cache
   */
  private static clearCache(): void {
    this.cache.clear();
  }

  // ============================================================================
  // ADMIN ACCOUNTS MANAGEMENT
  // ============================================================================

  /**
   * Get all admin accounts
   */
  static async getAdminAccounts(): Promise<AdminAccountWithDetails[]> {
    const cacheKey = 'admin-accounts';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // Simulate API delay
      await sleep(300);

      // Mock data for development
      const result = [...mockAdminAccounts];
      
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching admin accounts:', error);
      throw new Error('Failed to fetch admin accounts');
    }
  }

  /**
   * Create a new admin account
   */
  static async createAdminAccount(data: AdminAccountFormData): Promise<ServiceResponse<AdminAccountWithDetails>> {
    try {
      // Simulate API delay
      await sleep(800);

      // Validate password confirmation
      if (data.password !== data.confirmPassword) {
        return {
          success: false,
          message: 'Password confirmation does not match',
          statusCode: 400
        };
      }

      // Check if username already exists
      const existingAdmin = mockAdminAccounts.find(admin => admin.userName === data.userName);
      if (existingAdmin) {
        return {
          success: false,
          message: 'Username already exists',
          statusCode: 409
        };
      }

      // Create new admin account
      const newAdmin = generateMockAdminAccount(data.userName, data.userRole, true);
      
      // Add to mock data
      mockAdminAccounts.push(newAdmin);

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        data: newAdmin,
        statusCode: 201
      };
    } catch (error) {
      console.error('Error creating admin account:', error);
      return {
        success: false,
        message: 'Failed to create admin account',
        statusCode: 500
      };
    }
  }

  /**
   * Update an existing admin account
   */
  static async updateAdminAccount(id: number, data: AdminAccountFormData): Promise<ServiceResponse<AdminAccountWithDetails>> {
    try {
      // Simulate API delay
      await sleep(800);

      // Find the admin account
      const adminIndex = mockAdminAccounts.findIndex(admin => admin.idUser === id);
      if (adminIndex === -1) {
        return {
          success: false,
          message: 'Admin account not found',
          statusCode: 404
        };
      }

      // Validate password confirmation if password is being changed
      if (data.password && data.password !== data.confirmPassword) {
        return {
          success: false,
          message: 'Password confirmation does not match',
          statusCode: 400
        };
      }

      // Check if username already exists (excluding current admin)
      const existingAdmin = mockAdminAccounts.find(admin => 
        admin.userName === data.userName && admin.idUser !== id
      );
      if (existingAdmin) {
        return {
          success: false,
          message: 'Username already exists',
          statusCode: 409
        };
      }

      // Update admin account
      const updatedAdmin: AdminAccountWithDetails = {
        ...mockAdminAccounts[adminIndex],
        userName: data.userName,
        userRole: data.userRole,
        ...(data.password && { userPassword: `hashed_${data.password}_${Date.now()}` })
      };

      mockAdminAccounts[adminIndex] = updatedAdmin;

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        data: updatedAdmin,
        statusCode: 200
      };
    } catch (error) {
      console.error('Error updating admin account:', error);
      return {
        success: false,
        message: 'Failed to update admin account',
        statusCode: 500
      };
    }
  }

  /**
   * Delete an admin account
   */
  static async deleteAdminAccount(id: number): Promise<ServiceResponse<void>> {
    try {
      // Simulate API delay
      await sleep(800);

      // Find the admin account
      const adminIndex = mockAdminAccounts.findIndex(admin => admin.idUser === id);
      if (adminIndex === -1) {
        return {
          success: false,
          message: 'Admin account not found',
          statusCode: 404
        };
      }

      // Check if admin can be deleted (current user cannot be deleted)
      const admin = mockAdminAccounts[adminIndex];
      if (!admin.canBeDeleted) {
        return {
          success: false,
          message: 'Cannot delete current user account',
          statusCode: 403
        };
      }

      // Remove from mock data
      mockAdminAccounts.splice(adminIndex, 1);

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        statusCode: 200
      };
    } catch (error) {
      console.error('Error deleting admin account:', error);
      return {
        success: false,
        message: 'Failed to delete admin account',
        statusCode: 500
      };
    }
  }

  // ============================================================================
  // CLIENT CATEGORIES MANAGEMENT
  // ============================================================================

  /**
   * Get all client categories
   */
  static async getClientCategories(): Promise<ClientCategory[]> {
    const cacheKey = 'client-categories';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // Simulate API delay
      await sleep(300);

      // Mock data for development
      const result = [...mockClientCategories];
      
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching client categories:', error);
      throw new Error('Failed to fetch client categories');
    }
  }

  /**
   * Create a new client category
   */
  static async createClientCategory(data: ClientCategoryFormData): Promise<ServiceResponse<ClientCategory>> {
    try {
      // Simulate API delay
      await sleep(800);

      // Check if category name already exists
      const existingCategory = mockClientCategories.find(category => 
        category.categoryName.toLowerCase() === data.categoryName.toLowerCase()
      );
      if (existingCategory) {
        return {
          success: false,
          message: 'Category name already exists',
          statusCode: 409
        };
      }

      // Create new category
      const newCategory = generateMockClientCategory(data.categoryName, data.categoryStatus);
      
      // Add to mock data
      mockClientCategories.push(newCategory);

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        data: newCategory,
        statusCode: 201
      };
    } catch (error) {
      console.error('Error creating client category:', error);
      return {
        success: false,
        message: 'Failed to create client category',
        statusCode: 500
      };
    }
  }

  /**
   * Update an existing client category
   */
  static async updateClientCategory(id: number, data: ClientCategoryFormData): Promise<ServiceResponse<ClientCategory>> {
    try {
      // Simulate API delay
      await sleep(800);

      // Find the category
      const categoryIndex = mockClientCategories.findIndex(category => category.idCategory === id);
      if (categoryIndex === -1) {
        return {
          success: false,
          message: 'Client category not found',
          statusCode: 404
        };
      }

      // Check if category name already exists (excluding current category)
      const existingCategory = mockClientCategories.find(category => 
        category.categoryName.toLowerCase() === data.categoryName.toLowerCase() && 
        category.idCategory !== id
      );
      if (existingCategory) {
        return {
          success: false,
          message: 'Category name already exists',
          statusCode: 409
        };
      }

      // Update category
      const updatedCategory: ClientCategory = {
        ...mockClientCategories[categoryIndex],
        categoryName: data.categoryName,
        categoryStatus: data.categoryStatus
      };

      mockClientCategories[categoryIndex] = updatedCategory;

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        data: updatedCategory,
        statusCode: 200
      };
    } catch (error) {
      console.error('Error updating client category:', error);
      return {
        success: false,
        message: 'Failed to update client category',
        statusCode: 500
      };
    }
  }

  /**
   * Delete a client category
   */
  static async deleteClientCategory(id: number): Promise<ServiceResponse<void>> {
    try {
      // Simulate API delay
      await sleep(800);

      // Find the category
      const categoryIndex = mockClientCategories.findIndex(category => category.idCategory === id);
      if (categoryIndex === -1) {
        return {
          success: false,
          message: 'Client category not found',
          statusCode: 404
        };
      }

      // TODO: Check for existing client dependencies
      // For now, we'll allow deletion

      // Remove from mock data
      mockClientCategories.splice(categoryIndex, 1);

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        statusCode: 200
      };
    } catch (error) {
      console.error('Error deleting client category:', error);
      return {
        success: false,
        message: 'Failed to delete client category',
        statusCode: 500
      };
    }
  }

  // ============================================================================
  // PRODUCT HIERARCHY MANAGEMENT
  // ============================================================================

  /**
   * Get all product families
   */
  static async getFamilies(): Promise<Family[]> {
    const cacheKey = 'families';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // Simulate API delay
      await sleep(300);

      // Mock data for development
      const result = [...mockFamilies];
      
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching families:', error);
      throw new Error('Failed to fetch families');
    }
  }

  /**
   * Create a new product family
   */
  static async createFamily(data: FamilyFormData): Promise<ServiceResponse<Family>> {
    try {
      // Simulate API delay
      await sleep(800);

      // Check if family name already exists
      const existingFamily = mockFamilies.find(family => 
        family.familyName.toLowerCase() === data.familyName.toLowerCase()
      );
      if (existingFamily) {
        return {
          success: false,
          message: 'Family name already exists',
          statusCode: 409
        };
      }

      // Create new family
      const newFamily = generateMockFamily(data.familyName);
      
      // Add to mock data
      mockFamilies.push(newFamily);

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        data: newFamily,
        statusCode: 201
      };
    } catch (error) {
      console.error('Error creating family:', error);
      return {
        success: false,
        message: 'Failed to create family',
        statusCode: 500
      };
    }
  }

  /**
   * Update an existing product family
   */
  static async updateFamily(id: number, data: FamilyFormData): Promise<ServiceResponse<Family>> {
    try {
      // Simulate API delay
      await sleep(800);

      // Find the family
      const familyIndex = mockFamilies.findIndex(family => family.idFamily === id);
      if (familyIndex === -1) {
        return {
          success: false,
          message: 'Family not found',
          statusCode: 404
        };
      }

      // Check if family name already exists (excluding current family)
      const existingFamily = mockFamilies.find(family => 
        family.familyName.toLowerCase() === data.familyName.toLowerCase() && 
        family.idFamily !== id
      );
      if (existingFamily) {
        return {
          success: false,
          message: 'Family name already exists',
          statusCode: 409
        };
      }

      // Update family
      const updatedFamily: Family = {
        ...mockFamilies[familyIndex],
        familyName: data.familyName
      };

      mockFamilies[familyIndex] = updatedFamily;

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        data: updatedFamily,
        statusCode: 200
      };
    } catch (error) {
      console.error('Error updating family:', error);
      return {
        success: false,
        message: 'Failed to update family',
        statusCode: 500
      };
    }
  }

  /**
   * Delete a product family
   */
  static async deleteFamily(id: number): Promise<ServiceResponse<void>> {
    try {
      // Simulate API delay
      await sleep(800);

      // Find the family
      const familyIndex = mockFamilies.findIndex(family => family.idFamily === id);
      if (familyIndex === -1) {
        return {
          success: false,
          message: 'Family not found',
          statusCode: 404
        };
      }

      // Check for existing model dependencies
      const dependentModels = mockModels.filter(model => model.idFamily === id);
      if (dependentModels.length > 0) {
        return {
          success: false,
          message: `Cannot delete family. ${dependentModels.length} models depend on this family.`,
          statusCode: 409
        };
      }

      // Remove from mock data
      mockFamilies.splice(familyIndex, 1);

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        statusCode: 200
      };
    } catch (error) {
      console.error('Error deleting family:', error);
      return {
        success: false,
        message: 'Failed to delete family',
        statusCode: 500
      };
    }
  }

  /**
   * Get all product brands
   */
  static async getBrands(): Promise<Brand[]> {
    const cacheKey = 'brands';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // Simulate API delay
      await sleep(300);

      // Mock data for development
      const result = [...mockBrands];
      
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching brands:', error);
      throw new Error('Failed to fetch brands');
    }
  }

  /**
   * Create a new product brand
   */
  static async createBrand(data: BrandFormData): Promise<ServiceResponse<Brand>> {
    try {
      // Simulate API delay
      await sleep(800);

      // Check if brand name already exists
      const existingBrand = mockBrands.find(brand => 
        brand.brandName.toLowerCase() === data.brandName.toLowerCase()
      );
      if (existingBrand) {
        return {
          success: false,
          message: 'Brand name already exists',
          statusCode: 409
        };
      }

      // Create new brand
      const newBrand = generateMockBrand(data.brandName);
      
      // Add to mock data
      mockBrands.push(newBrand);

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        data: newBrand,
        statusCode: 201
      };
    } catch (error) {
      console.error('Error creating brand:', error);
      return {
        success: false,
        message: 'Failed to create brand',
        statusCode: 500
      };
    }
  }

  /**
   * Update an existing product brand
   */
  static async updateBrand(id: number, data: BrandFormData): Promise<ServiceResponse<Brand>> {
    try {
      // Simulate API delay
      await sleep(800);

      // Find the brand
      const brandIndex = mockBrands.findIndex(brand => brand.idBrand === id);
      if (brandIndex === -1) {
        return {
          success: false,
          message: 'Brand not found',
          statusCode: 404
        };
      }

      // Check if brand name already exists (excluding current brand)
      const existingBrand = mockBrands.find(brand => 
        brand.brandName.toLowerCase() === data.brandName.toLowerCase() && 
        brand.idBrand !== id
      );
      if (existingBrand) {
        return {
          success: false,
          message: 'Brand name already exists',
          statusCode: 409
        };
      }

      // Update brand
      const updatedBrand: Brand = {
        ...mockBrands[brandIndex],
        brandName: data.brandName
      };

      mockBrands[brandIndex] = updatedBrand;

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        data: updatedBrand,
        statusCode: 200
      };
    } catch (error) {
      console.error('Error updating brand:', error);
      return {
        success: false,
        message: 'Failed to update brand',
        statusCode: 500
      };
    }
  }

  /**
   * Delete a product brand
   */
  static async deleteBrand(id: number): Promise<ServiceResponse<void>> {
    try {
      // Simulate API delay
      await sleep(800);

      // Find the brand
      const brandIndex = mockBrands.findIndex(brand => brand.idBrand === id);
      if (brandIndex === -1) {
        return {
          success: false,
          message: 'Brand not found',
          statusCode: 404
        };
      }

      // Check for existing model dependencies
      const dependentModels = mockModels.filter(model => model.idBrand === id);
      if (dependentModels.length > 0) {
        return {
          success: false,
          message: `Cannot delete brand. ${dependentModels.length} models depend on this brand.`,
          statusCode: 409
        };
      }

      // Remove from mock data
      mockBrands.splice(brandIndex, 1);

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        statusCode: 200
      };
    } catch (error) {
      console.error('Error deleting brand:', error);
      return {
        success: false,
        message: 'Failed to delete brand',
        statusCode: 500
      };
    }
  }

  /**
   * Get all product models
   */
  static async getModels(): Promise<Model[]> {
    const cacheKey = 'models';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // Simulate API delay
      await sleep(300);

      // Mock data for development
      const result = [...mockModels];
      
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching models:', error);
      throw new Error('Failed to fetch models');
    }
  }

  /**
   * Create a new product model
   */
  static async createModel(data: ModelFormData): Promise<ServiceResponse<Model>> {
    try {
      // Simulate API delay
      await sleep(800);

      // Validate family and brand exist
      const family = mockFamilies.find(f => f.idFamily === data.idFamily);
      const brand = mockBrands.find(b => b.idBrand === data.idBrand);

      if (!family) {
        return {
          success: false,
          message: 'Selected family does not exist',
          statusCode: 400
        };
      }

      if (!brand) {
        return {
          success: false,
          message: 'Selected brand does not exist',
          statusCode: 400
        };
      }

      // Check if model name already exists for this brand
      const existingModel = mockModels.find(model => 
        model.modelName.toLowerCase() === data.modelName.toLowerCase() && 
        model.idBrand === data.idBrand
      );
      if (existingModel) {
        return {
          success: false,
          message: 'Model name already exists for this brand',
          statusCode: 409
        };
      }

      // Create new model
      const newModel = generateMockModel(data.modelName, data.idFamily, data.idBrand);
      
      // Add to mock data
      mockModels.push(newModel);

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        data: newModel,
        statusCode: 201
      };
    } catch (error) {
      console.error('Error creating model:', error);
      return {
        success: false,
        message: 'Failed to create model',
        statusCode: 500
      };
    }
  }

  /**
   * Update an existing product model
   */
  static async updateModel(id: number, data: ModelFormData): Promise<ServiceResponse<Model>> {
    try {
      // Simulate API delay
      await sleep(800);

      // Find the model
      const modelIndex = mockModels.findIndex(model => model.idModel === id);
      if (modelIndex === -1) {
        return {
          success: false,
          message: 'Model not found',
          statusCode: 404
        };
      }

      // Validate family and brand exist
      const family = mockFamilies.find(f => f.idFamily === data.idFamily);
      const brand = mockBrands.find(b => b.idBrand === data.idBrand);

      if (!family) {
        return {
          success: false,
          message: 'Selected family does not exist',
          statusCode: 400
        };
      }

      if (!brand) {
        return {
          success: false,
          message: 'Selected brand does not exist',
          statusCode: 400
        };
      }

      // Check if model name already exists for this brand (excluding current model)
      const existingModel = mockModels.find(model => 
        model.modelName.toLowerCase() === data.modelName.toLowerCase() && 
        model.idBrand === data.idBrand &&
        model.idModel !== id
      );
      if (existingModel) {
        return {
          success: false,
          message: 'Model name already exists for this brand',
          statusCode: 409
        };
      }

      // Update model
      const updatedModel: Model = {
        ...mockModels[modelIndex],
        modelName: data.modelName,
        idFamily: data.idFamily,
        idBrand: data.idBrand
      };

      mockModels[modelIndex] = updatedModel;

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        data: updatedModel,
        statusCode: 200
      };
    } catch (error) {
      console.error('Error updating model:', error);
      return {
        success: false,
        message: 'Failed to update model',
        statusCode: 500
      };
    }
  }

  /**
   * Delete a product model
   */
  static async deleteModel(id: number): Promise<ServiceResponse<void>> {
    try {
      // Simulate API delay
      await sleep(800);

      // Find the model
      const modelIndex = mockModels.findIndex(model => model.idModel === id);
      if (modelIndex === -1) {
        return {
          success: false,
          message: 'Model not found',
          statusCode: 404
        };
      }

      // TODO: Check for existing product dependencies
      // For now, we'll allow deletion

      // Remove from mock data
      mockModels.splice(modelIndex, 1);

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        statusCode: 200
      };
    } catch (error) {
      console.error('Error deleting model:', error);
      return {
        success: false,
        message: 'Failed to delete model',
        statusCode: 500
      };
    }
  }

  // ============================================================================
  // DELIVERY FEES MANAGEMENT
  // ============================================================================

  /**
   * Get all delivery fees
   */
  static async getDeliveryFees(): Promise<DeliveryFee[]> {
    const cacheKey = 'delivery-fees';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // Simulate API delay
      await sleep(300);

      // Mock data for development
      const result = [...mockDeliveryFees];
      
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching delivery fees:', error);
      throw new Error('Failed to fetch delivery fees');
    }
  }

  /**
   * Import delivery fees from Excel file
   */
  static async importDeliveryFees(file: File): Promise<ExcelImportResult> {
    try {
      // Simulate API delay
      await sleep(1500);

      // TODO: Implement actual Excel file parsing
      // For now, we'll simulate a successful import
      
      // Simulate parsing the file
      const mockImportedData: DeliveryFeeFormData[] = [
        { wilaya: "Test Wilaya", commune: "Test Commune", deliveryOffice: 400, deliveryHome: 600 },
        { wilaya: "Test Wilaya", commune: "Rest", deliveryOffice: 500, deliveryHome: 700 }
      ];

      // Validate the imported data
      const errors: string[] = [];
      const validData: DeliveryFeeFormData[] = [];

      for (const row of mockImportedData) {
        if (!row.wilaya || !row.commune) {
          errors.push(`Row missing required fields: Wilaya and Commune are required`);
          continue;
        }

        if (typeof row.deliveryOffice !== 'number' || row.deliveryOffice < 0) {
          errors.push(`Invalid delivery office fee for ${row.wilaya} - ${row.commune}`);
          continue;
        }

        if (typeof row.deliveryHome !== 'number' || row.deliveryHome < 0) {
          errors.push(`Invalid delivery home fee for ${row.wilaya} - ${row.commune}`);
          continue;
        }

        validData.push(row);
      }

      if (errors.length > 0) {
        return {
          success: false,
          errors,
          message: 'File validation failed'
        };
      }

      // Update mock data with imported fees
      mockDeliveryFees.length = 0; // Clear existing data
      mockDeliveryFees.push(...validData.map(fee => ({
        wilaya: fee.wilaya,
        commune: fee.commune,
        deliveryOffice: fee.deliveryOffice,
        deliveryHome: fee.deliveryHome
      })));

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        data: validData,
        message: `Successfully imported ${validData.length} delivery fee entries`
      };
    } catch (error) {
      console.error('Error importing delivery fees:', error);
      return {
        success: false,
        errors: ['Failed to process Excel file'],
        message: 'Import failed due to file processing error'
      };
    }
  }

  /**
   * Export delivery fees to Excel file
   */
  static async exportDeliveryFees(): Promise<void> {
    try {
      // Simulate API delay
      await sleep(1000);

      // TODO: Implement actual Excel file generation
      // For now, we'll simulate the export
      
      console.log('Exporting delivery fees:', mockDeliveryFees);
      
      // In a real implementation, this would generate and download an Excel file
      // For now, we'll just log the data
    } catch (error) {
      console.error('Error exporting delivery fees:', error);
      throw new Error('Failed to export delivery fees');
    }
  }
}
