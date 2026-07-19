// Admin settings domain (accounts, client categories, families/brands/models, delivery fees) —
// Sub-01 scaffolding. Reads return typed empty defaults; writes that only need to acknowledge
// success return `{ success: true }` (every ServiceResponse<T>'s `data` is optional) rather than
// fabricate an entity — real persistence lands in Sub-02. See catalog.service.ts's header comment
// for the numeric-id/view-model scope decision this follows.
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
  ExcelImportResult,
  ServiceResponse
} from '@/types/draft-types';

/**
 * Admin Settings Service
 */
export class AdminSettingsService {
  // --- Admin accounts ---
  static async getAdminAccounts(): Promise<AdminAccountWithDetails[]> {
    return [];
  }
  static async createAdminAccount(_data: AdminAccountFormData): Promise<ServiceResponse<AdminAccountWithDetails>> {
    return { success: true };
  }
  static async updateAdminAccount(_id: number, _data: AdminAccountFormData): Promise<ServiceResponse<AdminAccountWithDetails>> {
    return { success: true };
  }
  static async deleteAdminAccount(_id: number): Promise<ServiceResponse<void>> {
    return { success: true };
  }

  // --- Client categories ---
  static async getClientCategories(): Promise<ClientCategory[]> {
    return [];
  }
  static async createClientCategory(_data: ClientCategoryFormData): Promise<ServiceResponse<ClientCategory>> {
    return { success: true };
  }
  static async updateClientCategory(_id: number, _data: ClientCategoryFormData): Promise<ServiceResponse<ClientCategory>> {
    return { success: true };
  }
  static async deleteClientCategory(_id: number): Promise<ServiceResponse<void>> {
    return { success: true };
  }

  // --- Product families ---
  static async getFamilies(): Promise<Family[]> {
    return [];
  }
  static async createFamily(_data: FamilyFormData): Promise<ServiceResponse<Family>> {
    return { success: true };
  }
  static async updateFamily(_id: number, _data: FamilyFormData): Promise<ServiceResponse<Family>> {
    return { success: true };
  }
  static async deleteFamily(_id: number): Promise<ServiceResponse<void>> {
    return { success: true };
  }

  // --- Product brands ---
  static async getBrands(): Promise<Brand[]> {
    return [];
  }
  static async createBrand(_data: BrandFormData): Promise<ServiceResponse<Brand>> {
    return { success: true };
  }
  static async updateBrand(_id: number, _data: BrandFormData): Promise<ServiceResponse<Brand>> {
    return { success: true };
  }
  static async deleteBrand(_id: number): Promise<ServiceResponse<void>> {
    return { success: true };
  }

  // --- Device models ---
  static async getModels(): Promise<Model[]> {
    return [];
  }
  static async createModel(_data: ModelFormData): Promise<ServiceResponse<Model>> {
    return { success: true };
  }
  static async updateModel(_id: number, _data: ModelFormData): Promise<ServiceResponse<Model>> {
    return { success: true };
  }
  static async deleteModel(_id: number): Promise<ServiceResponse<void>> {
    return { success: true };
  }

  // --- Delivery fees ---
  static async getDeliveryFees(): Promise<DeliveryFee[]> {
    return [];
  }
  static async importDeliveryFees(_file: File): Promise<ExcelImportResult> {
    return { success: true };
  }
  static async exportDeliveryFees(): Promise<void> {}
}
