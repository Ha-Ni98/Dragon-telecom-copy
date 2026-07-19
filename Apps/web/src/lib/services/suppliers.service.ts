// Local shape — this mock service's own literal data uses fields (contactPerson, address,
// isActive) that neither of the codebase's two real `Supplier` types declare. Scoped to this
// file rather than editing a shared type, since this whole mock layer is deleted in Sprint 4.
interface Supplier {
  idSupplier: number;
  supplierName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
}

/**
 * Suppliers service for data fetching and management
 */
class SuppliersService {
  private baseUrl = '/api/suppliers';
  private cache = new Map<string, any>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Get all suppliers
   */
  async getSuppliers(): Promise<Supplier[]> {
    const cacheKey = 'suppliers';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`${this.baseUrl}`);
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const data = await response.json();

      // Mock data for development
      const mockSuppliers: Supplier[] = [
        { 
          idSupplier: 1, 
          supplierName: 'TechDistributors Ltd', 
          contactPerson: 'John Smith',
          email: 'john@techdistributors.com',
          phone: '+1-555-0123',
          address: '123 Tech Street, Silicon Valley, CA 94000',
          isActive: true
        },
        { 
          idSupplier: 2, 
          supplierName: 'MobileParts Inc', 
          contactPerson: 'Sarah Johnson',
          email: 'sarah@mobileparts.com',
          phone: '+1-555-0456',
          address: '456 Mobile Ave, Austin, TX 73301',
          isActive: true
        },
        { 
          idSupplier: 3, 
          supplierName: 'GlobalElectronics', 
          contactPerson: 'Mike Chen',
          email: 'mike@globalelectronics.com',
          phone: '+1-555-0789',
          address: '789 Global Blvd, New York, NY 10001',
          isActive: true
        },
        { 
          idSupplier: 4, 
          supplierName: 'PartsDirect', 
          contactPerson: 'Lisa Brown',
          email: 'lisa@partsdirect.com',
          phone: '+1-555-0321',
          address: '321 Parts Lane, Miami, FL 33101',
          isActive: false
        },
        { 
          idSupplier: 5, 
          supplierName: 'TechSupply Co', 
          contactPerson: 'David Wilson',
          email: 'david@techsupply.com',
          phone: '+1-555-0654',
          address: '654 Supply St, Seattle, WA 98101',
          isActive: true
        }
      ];

      this.setCache(cacheKey, mockSuppliers);
      return mockSuppliers;
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      throw new Error('Failed to fetch suppliers');
    }
  }

  /**
   * Get supplier by ID
   */
  async getSupplierById(id: number): Promise<Supplier | null> {
    const cacheKey = `supplier_${id}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`${this.baseUrl}/${id}`);
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const data = await response.json();

      // Mock data for development
      const suppliers = await this.getSuppliers();
      const supplier = suppliers.find(s => s.idSupplier === id) || null;

      if (supplier) {
        this.setCache(cacheKey, supplier);
      }

      return supplier;
    } catch (error) {
      console.error('Error fetching supplier:', error);
      throw new Error('Failed to fetch supplier');
    }
  }

  /**
   * Search suppliers by name
   */
  async searchSuppliers(query: string): Promise<Supplier[]> {
    try {
      const suppliers = await this.getSuppliers();
      return suppliers.filter(supplier => 
        supplier.supplierName.toLowerCase().includes(query.toLowerCase()) ||
        (supplier.contactPerson?.toLowerCase().includes(query.toLowerCase()) ?? false) ||
        (supplier.email?.toLowerCase().includes(query.toLowerCase()) ?? false)
      );
    } catch (error) {
      console.error('Error searching suppliers:', error);
      throw new Error('Failed to search suppliers');
    }
  }

  /**
   * Get active suppliers only
   */
  async getActiveSuppliers(): Promise<Supplier[]> {
    try {
      const suppliers = await this.getSuppliers();
      return suppliers.filter(supplier => supplier.isActive);
    } catch (error) {
      console.error('Error fetching active suppliers:', error);
      throw new Error('Failed to fetch active suppliers');
    }
  }

  /**
   * Create new supplier
   */
  async createSupplier(supplier: Omit<Supplier, 'idSupplier'>): Promise<Supplier> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`${this.baseUrl}`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(supplier),
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const data = await response.json();

      // Mock data for development
      const newSupplier: Supplier = {
        idSupplier: Date.now(),
        supplierName: supplier.supplierName,
        contactPerson: supplier.contactPerson,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        isActive: supplier.isActive
      };

      // Clear cache to force refresh
      this.clearCache();
      
      return newSupplier;
    } catch (error) {
      console.error('Error creating supplier:', error);
      throw new Error('Failed to create supplier');
    }
  }

  /**
   * Update supplier
   */
  async updateSupplier(id: number, supplier: Partial<Supplier>): Promise<Supplier> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`${this.baseUrl}/${id}`, {
      //   method: 'PUT',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(supplier),
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const data = await response.json();

      // Mock data for development
      const existingSupplier = await this.getSupplierById(id);
      if (!existingSupplier) {
        throw new Error('Supplier not found');
      }

      const updatedSupplier: Supplier = {
        ...existingSupplier,
        ...supplier
      };

      // Clear cache to force refresh
      this.clearCache();
      
      return updatedSupplier;
    } catch (error) {
      console.error('Error updating supplier:', error);
      throw new Error('Failed to update supplier');
    }
  }

  /**
   * Delete supplier
   */
  async deleteSupplier(id: number): Promise<void> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`${this.baseUrl}/${id}`, {
      //   method: 'DELETE',
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }

      // Mock data for development
      const supplier = await this.getSupplierById(id);
      if (!supplier) {
        throw new Error('Supplier not found');
      }

      // Clear cache to force refresh
      this.clearCache();
    } catch (error) {
      console.error('Error deleting supplier:', error);
      throw new Error('Failed to delete supplier');
    }
  }

  /**
   * Toggle supplier active status
   */
  async toggleSupplierStatus(id: number): Promise<Supplier> {
    try {
      const supplier = await this.getSupplierById(id);
      if (!supplier) {
        throw new Error('Supplier not found');
      }

      return await this.updateSupplier(id, { isActive: !supplier.isActive });
    } catch (error) {
      console.error('Error toggling supplier status:', error);
      throw new Error('Failed to toggle supplier status');
    }
  }

  /**
   * Get cache entry
   */
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set cache entry
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  private clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export const suppliersService = new SuppliersService();
