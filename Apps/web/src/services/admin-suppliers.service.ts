// Purchasing domain (admin supplier management) — Sub-01 scaffolding. See catalog.service.ts's
// header comment for the numeric-id/view-model scope decision this follows.
import {
  AdminSuppliersFilters,
  AdminSuppliersPaginatedResponse,
  AdminSuppliersStats,
  SupplierWithDetails,
  SupplierFormData,
  InvoiceFormData,
  ServiceResponse,
} from "@/types/draft-types/admin-suppliers.types";

export class AdminSuppliersService {
  static async getSuppliers(filters: AdminSuppliersFilters): Promise<AdminSuppliersPaginatedResponse> {
    return {
      suppliers: [],
      pagination: {
        currentPage: filters.page || 1,
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: filters.limit || 10,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }

  static async getSuppliersStats(): Promise<AdminSuppliersStats> {
    return { totalSuppliers: 0, totalDue: 0, totalPaid: 0, totalCredit: 0 };
  }

  static async createSupplier(_data: SupplierFormData): Promise<ServiceResponse<SupplierWithDetails>> {
    return { success: true };
  }

  static async updateSupplier(_id: number, _data: Partial<SupplierFormData>): Promise<ServiceResponse<SupplierWithDetails>> {
    return { success: true };
  }

  static async deleteSupplier(_id: number): Promise<ServiceResponse<void>> {
    return { success: true };
  }

  static async addInvoice(_supplierId: number, _data: InvoiceFormData): Promise<ServiceResponse<void>> {
    return { success: true };
  }

  static async getSupplierById(_id: number): Promise<ServiceResponse<SupplierWithDetails>> {
    return { success: false, message: 'Supplier not found' };
  }

  static async searchSuppliers(_query: string): Promise<ServiceResponse<SupplierWithDetails[]>> {
    return { success: true, data: [] };
  }
}
