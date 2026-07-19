import { 
  SupplierWithDetails, 
  SupplierFormData, 
  ProductSupplyHistory 
} from '@/types/draft-types/admin-suppliers.types';
import { SupplierInvoice } from '@/types/draft-types/supplier.types';
import { 
  getSupplierWithDetails, 
  getSupplierInvoices, 
  getSupplierProductHistory,
  sleep 
} from '@/mocks/admin-suppliers';

/**
 * Supplier Information Service
 * Handles all API operations for supplier information page
 */
class SupplierInformationService {
  private baseUrl = '/api/suppliers';
  private cache = new Map<string, any>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Get cached data if available and not expired
   */
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * Set data in cache with timestamp
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get supplier with detailed information
   */
  async getSupplierWithDetails(id: number): Promise<SupplierWithDetails | null> {
    const cacheKey = `supplier-details-${id}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // Simulate API delay
      await sleep(500);

      // TODO: Replace with actual API call
      // const response = await fetch(`${this.baseUrl}/${id}/details`);
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const data = await response.json();

      // Use mock data for development
      const data = getSupplierWithDetails(id);
      
      if (data) {
        this.setCache(cacheKey, data);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching supplier details:', error);
      throw new Error('Failed to fetch supplier details');
    }
  }

  /**
   * Update supplier information
   */
  async updateSupplier(id: number, data: SupplierFormData): Promise<SupplierWithDetails> {
    try {
      // Simulate API delay
      await sleep(800);

      // TODO: Replace with actual API call
      // const response = await fetch(`${this.baseUrl}/${id}`, {
      //   method: 'PUT',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(data),
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const result = await response.json();

      // Mock update - in real app, this would update the database
      const existingSupplier = getSupplierWithDetails(id);
      if (!existingSupplier) {
        throw new Error('Supplier not found');
      }

      const updatedSupplier: SupplierWithDetails = {
        ...existingSupplier,
        supplierName: data.supplierName,
        supplierPersonName: data.supplierPersonName,
        supplierPhone: data.supplierPhone,
        supplierEmail: data.supplierEmail,
        supplierLocation: data.supplierLocation,
        supplierCredit: data.supplierCredit ?? existingSupplier.supplierCredit,
      };

      // Clear cache for this supplier
      this.cache.delete(`supplier-details-${id}`);
      
      return updatedSupplier;
    } catch (error) {
      console.error('Error updating supplier:', error);
      throw new Error('Failed to update supplier information');
    }
  }

  /**
   * Get supplier invoices
   */
  async getSupplierInvoices(id: number): Promise<SupplierInvoice[]> {
    const cacheKey = `supplier-invoices-${id}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // Simulate API delay
      await sleep(300);

      // TODO: Replace with actual API call
      // const response = await fetch(`${this.baseUrl}/${id}/invoices`);
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const data = await response.json();

      // Use mock data for development
      const data = getSupplierInvoices(id);
      
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching supplier invoices:', error);
      throw new Error('Failed to fetch supplier invoices');
    }
  }

  /**
   * Delete supplier invoice (only last invoice allowed)
   */
  async deleteSupplierInvoice(invoiceId: number): Promise<void> {
    try {
      // Simulate API delay
      await sleep(600);

      // TODO: Replace with actual API call
      // const response = await fetch(`${this.baseUrl}/invoices/${invoiceId}`, {
      //   method: 'DELETE',
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }

      // Mock deletion - in real app, this would delete from database
      console.log(`Mock: Deleted invoice ${invoiceId}`);
      
      // Clear related caches
      this.cache.clear();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      throw new Error('Failed to delete invoice');
    }
  }

  /**
   * Get supplier product supply history
   */
  async getSupplierProductHistory(id: number): Promise<ProductSupplyHistory[]> {
    const cacheKey = `supplier-product-history-${id}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // Simulate API delay
      await sleep(400);

      // TODO: Replace with actual API call
      // const response = await fetch(`${this.baseUrl}/${id}/product-history`);
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const data = await response.json();

      // Use mock data for development
      const data = getSupplierProductHistory(id);
      
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching supplier product history:', error);
      throw new Error('Failed to fetch supplier product history');
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for specific supplier
   */
  clearSupplierCache(id: number): void {
    this.cache.delete(`supplier-details-${id}`);
    this.cache.delete(`supplier-invoices-${id}`);
    this.cache.delete(`supplier-product-history-${id}`);
  }
}

// Export singleton instance
export const supplierInformationService = new SupplierInformationService();
