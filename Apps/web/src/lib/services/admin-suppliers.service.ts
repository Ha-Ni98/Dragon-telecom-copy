/**
 * Admin Suppliers Service
 * Handles CRUD operations for supplier management
 */
import { Supplier } from "@/types/draft-types/supplier.types";
import { 
  AdminSuppliersFilters, 
  AdminSuppliersPaginatedResponse, 
  AdminSuppliersStats,
  SupplierWithDetails,
  SupplierFormData,
  InvoiceFormData,
  ServiceResponse,
} from "@/types/draft-types/admin-suppliers.types";
import { 
  getAdminSuppliersPaginated, 
  getAdminSuppliersStats, 
  mockSuppliers,
  mockSupplierInvoices 
} from "@/mocks/admin-suppliers";

/**
 * Admin Suppliers Service
 * Provides methods for supplier management operations
 */
export class AdminSuppliersService {
  private static cache = new Map<string, any>();
  private static cacheTimeout = 2 * 60 * 1000; // 2 minutes

  /**
   * Get suppliers with pagination and filtering
   * Returns paginated list of suppliers based on filters
   */
  static async getSuppliers(filters: AdminSuppliersFilters): Promise<AdminSuppliersPaginatedResponse> {
    const cacheKey = `admin-suppliers-${JSON.stringify(filters)}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/admin/suppliers', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(filters)
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const data = await response.json();

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock data for development
      const result = getAdminSuppliersPaginated(filters);
      
      // Cache the result
      this.setCache(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      throw new Error('Failed to fetch suppliers');
    }
  }

  /**
   * Get supplier statistics
   * Returns aggregated statistics for all suppliers
   */
  static async getSuppliersStats(): Promise<AdminSuppliersStats> {
    const cacheKey = 'admin-suppliers-stats';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/admin/suppliers/stats');
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const data = await response.json();

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));

      // Mock data for development
      const stats = getAdminSuppliersStats();
      
      // Cache the result
      this.setCache(cacheKey, stats);
      
      return stats;
    } catch (error) {
      console.error('Error fetching supplier statistics:', error);
      throw new Error('Failed to fetch supplier statistics');
    }
  }

  /**
   * Create a new supplier
   * Creates a new supplier with the provided data
   */
  static async createSupplier(data: SupplierFormData): Promise<ServiceResponse<Supplier>> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/admin/suppliers', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(data)
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const result = await response.json();

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));

      // Mock data for development
      const newSupplier: Supplier = {
        idSupplier: mockSuppliers.length + 1,
        supplierName: data.supplierName,
        supplierCredit: data.supplierCredit || 0,
        supplierPersonName: data.supplierPersonName,
        supplierPhone: data.supplierPhone,
        supplierEmail: data.supplierEmail,
        supplierLocation: data.supplierLocation,
        supplierCreatedDate: new Date().toISOString()
      };

      // Add to mock data
      mockSuppliers.push(newSupplier);

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        data: newSupplier,
        statusCode: 201
      };
    } catch (error) {
      console.error('Error creating supplier:', error);
      return {
        success: false,
        message: 'Failed to create supplier',
        statusCode: 500
      };
    }
  }

  /**
   * Update an existing supplier
   * Updates supplier data with the provided information
   */
  static async updateSupplier(id: number, data: Partial<SupplierFormData>): Promise<ServiceResponse<Supplier>> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/admin/suppliers/${id}`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(data)
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const result = await response.json();

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 600));

      // Mock data for development
      const supplierIndex = mockSuppliers.findIndex(s => s.idSupplier === id);
      if (supplierIndex === -1) {
        return {
          success: false,
          message: 'Supplier not found',
          statusCode: 404
        };
      }

      // Update supplier data
      const updatedSupplier = {
        ...mockSuppliers[supplierIndex],
        ...data,
        idSupplier: id // Ensure ID doesn't change
      };

      mockSuppliers[supplierIndex] = updatedSupplier;

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        data: updatedSupplier,
        statusCode: 200
      };
    } catch (error) {
      console.error('Error updating supplier:', error);
      return {
        success: false,
        message: 'Failed to update supplier',
        statusCode: 500
      };
    }
  }

  /**
   * Delete a supplier
   * Removes supplier and all associated data
   */
  static async deleteSupplier(id: number): Promise<ServiceResponse<void>> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/admin/suppliers/${id}`, {
      //   method: 'DELETE'
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 400));

      // Mock data for development
      const supplierIndex = mockSuppliers.findIndex(s => s.idSupplier === id);
      if (supplierIndex === -1) {
        return {
          success: false,
          message: 'Supplier not found',
          statusCode: 404
        };
      }

      // Remove supplier from mock data
      mockSuppliers.splice(supplierIndex, 1);

      // Remove associated invoices
      const invoiceIndex = mockSupplierInvoices.findIndex(inv => inv.idSupplier === id);
      if (invoiceIndex !== -1) {
        mockSupplierInvoices.splice(invoiceIndex, 1);
      }

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        statusCode: 200
      };
    } catch (error) {
      console.error('Error deleting supplier:', error);
      return {
        success: false,
        message: 'Failed to delete supplier',
        statusCode: 500
      };
    }
  }

  /**
   * Add invoice to supplier
   * Creates new invoice and updates supplier financial data
   */
  static async addInvoice(supplierId: number, data: InvoiceFormData): Promise<ServiceResponse<void>> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/admin/suppliers/${supplierId}/invoices`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(data)
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 700));

      // Mock data for development
      const supplier = mockSuppliers.find(s => s.idSupplier === supplierId);
      if (!supplier) {
        return {
          success: false,
          message: 'Supplier not found',
          statusCode: 404
        };
      }

      // Create new invoice
      const newInvoice = {
        idInvoice: mockSupplierInvoices.length + 1,
        idSupplier: supplierId,
        Due: data.newDue,
        totalDue: supplier.supplierCredit + data.newDue,
        currentSold: 0, // This would be calculated based on business logic
        paid: data.paid,
        credit: (supplier.supplierCredit + data.newDue) - data.paid,
        invoiceCreatedDate: new Date().toISOString()
      };

      // Add invoice to mock data
      mockSupplierInvoices.push(newInvoice);

      // Update supplier credit
      supplier.supplierCredit = newInvoice.credit;

      // Clear cache to force refresh
      this.clearCache();

      return {
        success: true,
        statusCode: 201
      };
    } catch (error) {
      console.error('Error adding invoice:', error);
      return {
        success: false,
        message: 'Failed to add invoice',
        statusCode: 500
      };
    }
  }

  /**
   * Get supplier by ID
   * Returns detailed supplier information
   */
  static async getSupplierById(id: number): Promise<ServiceResponse<SupplierWithDetails>> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/admin/suppliers/${id}`);
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const data = await response.json();

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));

      // Mock data for development
      const supplier = mockSuppliers.find(s => s.idSupplier === id);
      if (!supplier) {
        return {
          success: false,
          message: 'Supplier not found',
          statusCode: 404
        };
      }

      // Get supplier details with calculated fields
      const supplierInvoices = mockSupplierInvoices.filter(inv => inv.idSupplier === id);
      const totalDue = supplierInvoices.reduce((sum, inv) => sum + inv.Due, 0);
      const totalPaid = supplierInvoices.reduce((sum, inv) => sum + inv.paid, 0);
      const totalCredit = supplierInvoices.reduce((sum, inv) => sum + inv.credit, 0);

      const supplierWithDetails: SupplierWithDetails = {
        ...supplier,
        productsSuppliedCount: Math.floor(Math.random() * 50) + 1, // Mock product count
        invoicesCount: supplierInvoices.length,
        totalDue,
        totalPaid,
        totalCredit
      };

      return {
        success: true,
        data: supplierWithDetails,
        statusCode: 200
      };
    } catch (error) {
      console.error('Error fetching supplier:', error);
      return {
        success: false,
        message: 'Failed to fetch supplier',
        statusCode: 500
      };
    }
  }

  /**
   * Search suppliers
   * Returns suppliers matching search criteria
   */
  static async searchSuppliers(query: string): Promise<ServiceResponse<SupplierWithDetails[]>> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/admin/suppliers/search?q=${encodeURIComponent(query)}`);
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const data = await response.json();

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 400));

      // Mock data for development
      const filteredSuppliers = mockSuppliers.filter(supplier => 
        supplier.supplierName.toLowerCase().includes(query.toLowerCase()) ||
        supplier.supplierPersonName?.toLowerCase().includes(query.toLowerCase())
      );

      const suppliersWithDetails: SupplierWithDetails[] = filteredSuppliers.map(supplier => {
        const supplierInvoices = mockSupplierInvoices.filter(inv => inv.idSupplier === supplier.idSupplier);
        const totalDue = supplierInvoices.reduce((sum, inv) => sum + inv.Due, 0);
        const totalPaid = supplierInvoices.reduce((sum, inv) => sum + inv.paid, 0);
        const totalCredit = supplierInvoices.reduce((sum, inv) => sum + inv.credit, 0);

        return {
          ...supplier,
          productsSuppliedCount: Math.floor(Math.random() * 50) + 1,
          invoicesCount: supplierInvoices.length,
          totalDue,
          totalPaid,
          totalCredit
        };
      });

      return {
        success: true,
        data: suppliersWithDetails,
        statusCode: 200
      };
    } catch (error) {
      console.error('Error searching suppliers:', error);
      return {
        success: false,
        message: 'Failed to search suppliers',
        statusCode: 500
      };
    }
  }

  /**
   * Cache management methods
   */
  private static getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private static setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private static clearCache(): void {
    this.cache.clear();
  }
}
