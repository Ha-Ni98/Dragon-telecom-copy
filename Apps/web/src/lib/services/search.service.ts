import { SearchResponse } from "@/types";
import { mockHeroProduct, mockPopularSearches } from "@/mocks/search";
import { HeroProduct } from "@/types/draft-types";
/**
 * Search service API interface
 * Handles communication with backend search endpoints
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export interface SearchApiResponse<SearchResponse> {
  success: boolean;
  data: SearchResponse[];
  count: number;
}

export const searchService = {
  /**
   * Get search suggestions based on query from backend API
   */
  getSuggestions: async (query: string, idClient: number | null, limit: number = 4): Promise<SearchResponse[]> => {
    if (!query || query.length < 2) {
      return [];
    }

    const queryRequest = `${API_BASE_URL}/api/products/search?query=${encodeURIComponent(query)}&limit=${limit}` + (idClient ? `&idClient=${idClient}` : '');
    const response = await fetch(queryRequest, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch search suggestions: ${response.statusText}`);
    }

    const result: SearchApiResponse<SearchResponse> = await response.json();
    
    // Transform backend data to frontend format
    return result.data.map((product: SearchResponse) => ({
      idProduct: product.idProduct,
      productName: product.productName,
      brandName: product.brandName,
      price: product.price,
      image: product.image ? API_BASE_URL + product.image : '',
    })).slice(0, limit);
  },

  /**
   * Search products with full results from backend API
   */
  searchProducts:  async (query: string, idClient: number | null, limit: number = 4): Promise<SearchResponse[]> => {
    if (!query || query.length < 2) {
      return [];
    }

    const queryRequest = `${API_BASE_URL}/api/products/search?query=${encodeURIComponent(query)}&limit=${limit}` + (idClient ? `&idClient=${idClient}` : '');
    const response = await fetch(queryRequest, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch search suggestions: ${response.statusText}`);
    }

    const result: SearchApiResponse<SearchResponse> = await response.json();
    
    // Transform backend data to frontend format
    return result.data.map((product: SearchResponse) => ({
      idProduct: product.idProduct,
      productName: product.productName,
      brandName: product.brandName,
      price: product.price,
      image: product.image,
    })).slice(0, limit);
  },

  /**
   * Get popular search terms
   */
  getPopularSearches: async (): Promise<string[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return mockPopularSearches;
  },

  /**
   * Get hero product for main page showcase
   */
  getHeroProduct: async (): Promise<HeroProduct> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 150));
    
    return mockHeroProduct;
  },

  /**
   * Get recent searches (from localStorage)
   */
  getRecentSearches: (): string[] => {
    try {
      const recentSearches = localStorage.getItem('recent-searches');
      return recentSearches ? JSON.parse(recentSearches) : [];
    } catch (error) {
      console.error('Error getting recent searches:', error);
      return [];
    }
  },

  /**
   * Save search to recent searches
   */
  saveRecentSearch: (query: string): void => {
    try {
      const recentSearches = searchService.getRecentSearches();
      const updatedSearches = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
      localStorage.setItem('recent-searches', JSON.stringify(updatedSearches));
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  }
};
