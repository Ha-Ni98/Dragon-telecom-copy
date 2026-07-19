import { Brand } from "@/types/draft-types/product.types";

/**
 * Brands service for data fetching and management
 */
class BrandsService {
  private baseUrl = '/api/brands';
  private cache = new Map<string, any>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Get all brands
   */
  async getBrands(): Promise<Brand[]> {
    const cacheKey = 'brands';
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
      const mockBrands = [
        { idBrand: 1, brandName: 'Samsung', description: 'Samsung Electronics', logoUrl: '/logos/samsung.png' },
        { idBrand: 2, brandName: 'Apple', description: 'Apple Inc.', logoUrl: '/logos/apple.png' },
        { idBrand: 3, brandName: 'Huawei', description: 'Huawei Technologies', logoUrl: '/logos/huawei.png' },
        { idBrand: 4, brandName: 'Xiaomi', description: 'Xiaomi Corporation', logoUrl: '/logos/xiaomi.png' },
        { idBrand: 5, brandName: 'OnePlus', description: 'OnePlus Technology', logoUrl: '/logos/oneplus.png' },
        { idBrand: 6, brandName: 'Google', description: 'Google LLC', logoUrl: '/logos/google.png' },
        { idBrand: 7, brandName: 'Sony', description: 'Sony Corporation', logoUrl: '/logos/sony.png' },
        { idBrand: 8, brandName: 'LG', description: 'LG Electronics', logoUrl: '/logos/lg.png' }
      ];

      this.setCache(cacheKey, mockBrands);
      return mockBrands;
    } catch (error) {
      console.error('Error fetching brands:', error);
      throw new Error('Failed to fetch brands');
    }
  }

  /**
   * Get brand by ID
   */
  async getBrandById(id: number): Promise<Brand | null> {
    const cacheKey = `brand_${id}`;
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
      const brands = await this.getBrands();
      const brand = brands.find(b => b.idBrand === id) || null;

      if (brand) {
        this.setCache(cacheKey, brand);
      }

      return brand;
    } catch (error) {
      console.error('Error fetching brand:', error);
      throw new Error('Failed to fetch brand');
    }
  }

  /**
   * Search brands by name
   */
  async searchBrands(query: string): Promise<Brand[]> {
    try {
      const brands = await this.getBrands();
      return brands.filter(brand => 
        brand.brandName.toLowerCase().includes(query.toLowerCase())
        
      );
    } catch (error) {
      console.error('Error searching brands:', error);
      throw new Error('Failed to search brands');
    }
  }

  /**
   * Get brands by family
   */
  async getBrandsByFamily(familyId: number): Promise<Brand[]> {
    try {
      const brands = await this.getBrands();
      // Mock filtering by family - in real app, this would be a separate API call
      return brands.filter(brand => {
        // Mock logic: certain brands are associated with certain families
        const familyBrandMap: Record<number, number[]> = {
          1: [1, 2, 3, 4, 5, 6], // Smartphones: Samsung, Apple, Huawei, Xiaomi, OnePlus, Google
          2: [1, 2, 3, 4, 5, 6], // Tablets: Same as smartphones
          3: [1, 2, 7, 8], // Laptops: Samsung, Apple, Sony, LG
          4: [1, 2, 3, 4, 5, 6, 7, 8], // Accessories: All brands
          5: [1, 2, 3, 4, 5, 6, 7, 8] // Parts: All brands
        };
        return familyBrandMap[familyId]?.includes(brand.idBrand) || false;
      });
    } catch (error) {
      console.error('Error fetching brands by family:', error);
      throw new Error('Failed to fetch brands by family');
    }
  }

  /**
   * Create new brand
   */
  async createBrand(brand: Omit<Brand, 'idBrand'>): Promise<Brand> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`${this.baseUrl}`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(brand),
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const data = await response.json();

      // Mock data for development
      const newBrand: Brand = {
        idBrand: Date.now(),
        brandName: brand.brandName,

      };

      // Clear cache to force refresh
      this.clearCache();
      
      return newBrand;
    } catch (error) {
      console.error('Error creating brand:', error);
      throw new Error('Failed to create brand');
    }
  }

  /**
   * Update brand
   */
  async updateBrand(id: number, brand: Partial<Brand>): Promise<Brand> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`${this.baseUrl}/${id}`, {
      //   method: 'PUT',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(brand),
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const data = await response.json();

      // Mock data for development
      const existingBrand = await this.getBrandById(id);
      if (!existingBrand) {
        throw new Error('Brand not found');
      }

      const updatedBrand: Brand = {
        ...existingBrand,
        ...brand
      };

      // Clear cache to force refresh
      this.clearCache();
      
      return updatedBrand;
    } catch (error) {
      console.error('Error updating brand:', error);
      throw new Error('Failed to update brand');
    }
  }

  /**
   * Delete brand
   */
  async deleteBrand(id: number): Promise<void> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`${this.baseUrl}/${id}`, {
      //   method: 'DELETE',
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }

      // Mock data for development
      const brand = await this.getBrandById(id);
      if (!brand) {
        throw new Error('Brand not found');
      }

      // Clear cache to force refresh
      this.clearCache();
    } catch (error) {
      console.error('Error deleting brand:', error);
      throw new Error('Failed to delete brand');
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

export const brandsService = new BrandsService();