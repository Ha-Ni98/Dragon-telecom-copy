import type { Family as BaseFamily } from "@/types/draft-types/product.types";

// Local shape — this mock service's own literal data includes a `description` field the
// real Family type doesn't declare. Scoped to this file (deleted with the rest of the mock
// layer in Sprint 4) rather than editing the shared type.
interface Family extends BaseFamily {
  description?: string;
}

/**
 * Families service for data fetching and management
 */
class FamiliesService {
  private baseUrl = '/api/families';
  private cache = new Map<string, any>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Get all families
   */
  async getFamilies(): Promise<Family[]> {
    const cacheKey = 'families';
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
      const mockFamilies: Family[] = [
        { idFamily: 1, familyName: 'Smartphones', description: 'Mobile phones and smartphones' },
        { idFamily: 2, familyName: 'Tablets', description: 'Tablet computers and devices' },
        { idFamily: 3, familyName: 'Laptops', description: 'Laptop computers and notebooks' },
        { idFamily: 4, familyName: 'Accessories', description: 'Phone and device accessories' },
        { idFamily: 5, familyName: 'Parts', description: 'Replacement parts and components' }
      ];

      this.setCache(cacheKey, mockFamilies);
      return mockFamilies;
    } catch (error) {
      console.error('Error fetching families:', error);
      throw new Error('Failed to fetch families');
    }
  }

  /**
   * Get family by ID
   */
  async getFamilyById(id: number): Promise<Family | null> {
    const cacheKey = `family_${id}`;
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
      const families = await this.getFamilies();
      const family = families.find(f => f.idFamily === id) || null;

      if (family) {
        this.setCache(cacheKey, family);
      }

      return family;
    } catch (error) {
      console.error('Error fetching family:', error);
      throw new Error('Failed to fetch family');
    }
  }

  /**
   * Search families by name
   */
  async searchFamilies(query: string): Promise<Family[]> {
    try {
      const families = await this.getFamilies();
      return families.filter(family => 
        family.familyName.toLowerCase().includes(query.toLowerCase()) ||
        family.description?.toLowerCase().includes(query.toLowerCase())
      );
    } catch (error) {
      console.error('Error searching families:', error);
      throw new Error('Failed to search families');
    }
  }

  /**
   * Create new family
   */
  async createFamily(family: Omit<Family, 'idFamily'>): Promise<Family> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`${this.baseUrl}`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(family),
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const data = await response.json();

      // Mock data for development
      const newFamily: Family = {
        idFamily: Date.now(),
        familyName: family.familyName,
        description: family.description
      };

      // Clear cache to force refresh
      this.clearCache();
      
      return newFamily;
    } catch (error) {
      console.error('Error creating family:', error);
      throw new Error('Failed to create family');
    }
  }

  /**
   * Update family
   */
  async updateFamily(id: number, family: Partial<Family>): Promise<Family> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`${this.baseUrl}/${id}`, {
      //   method: 'PUT',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(family),
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const data = await response.json();

      // Mock data for development
      const existingFamily = await this.getFamilyById(id);
      if (!existingFamily) {
        throw new Error('Family not found');
      }

      const updatedFamily: Family = {
        ...existingFamily,
        ...family
      };

      // Clear cache to force refresh
      this.clearCache();
      
      return updatedFamily;
    } catch (error) {
      console.error('Error updating family:', error);
      throw new Error('Failed to update family');
    }
  }

  /**
   * Delete family
   */
  async deleteFamily(id: number): Promise<void> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`${this.baseUrl}/${id}`, {
      //   method: 'DELETE',
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }

      // Mock data for development
      const family = await this.getFamilyById(id);
      if (!family) {
        throw new Error('Family not found');
      }

      // Clear cache to force refresh
      this.clearCache();
    } catch (error) {
      console.error('Error deleting family:', error);
      throw new Error('Failed to delete family');
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

export const familiesService = new FamiliesService();
