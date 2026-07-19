import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Brand, Family } from '@/types/draft-types';
import { productApiService } from '@/services/product.service.api';

export interface ProductContextValue {
  // Data
  brands: Brand[];
  families: Family[];
  
  // Loading states
  isLoading: boolean;
  isBrandsLoading: boolean;
  isFamiliesLoading: boolean;
  
  // Error states
  error: string | null;
  brandsError: string | null;
  familiesError: string | null;
  
  // Actions
  refreshBrands: () => Promise<void>;
  refreshFamilies: () => Promise<void>;
  refreshAll: () => Promise<void>;
  
  // Utility functions
  getBrandById: (id: number) => Brand | undefined;
  getFamilyById: (id: number) => Family | undefined;
}

const ProductContext = createContext<ProductContextValue | undefined>(undefined);

interface ProductProviderProps {
  children: ReactNode;
}

export function ProductProvider({ children }: ProductProviderProps) {
  // Data state
  const [brands, setBrands] = useState<Brand[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  
  // Loading states
  const [isBrandsLoading, setIsBrandsLoading] = useState(false);
  const [isFamiliesLoading, setIsFamiliesLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Error states
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [familiesError, setFamiliesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load brands
  const loadBrands = async () => {
    setIsBrandsLoading(true);
    setBrandsError(null);
    
    try {
      const brandsData = await productApiService.getBrands();
      setBrands(brandsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load brands';
      setBrandsError(errorMessage);
      setError(errorMessage);
    } finally {
      setIsBrandsLoading(false);
    }
  };

  // Load families
  const loadFamilies = async () => {
    setIsFamiliesLoading(true);
    setFamiliesError(null);
    
    try {
      const familiesData = await productApiService.getFamilies();
      setFamilies(familiesData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load families';
      setFamiliesError(errorMessage);
      setError(errorMessage);
    } finally {
      setIsFamiliesLoading(false);
    }
  };

  // Load all data
  const loadAll = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await Promise.all([loadBrands(), loadFamilies()]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load product data';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh functions
  const refreshBrands = async () => {
    await loadBrands();
  };

  const refreshFamilies = async () => {
    await loadFamilies();
  };

  const refreshAll = async () => {
    await loadAll();
  };

  // Utility functions
  const getBrandById = (id: number): Brand | undefined => {
    return brands.find(brand => brand.idBrand === id);
  };

  const getFamilyById = (id: number): Family | undefined => {
    return families.find(family => family.idFamily === id);
  };

  // Load data on mount
  useEffect(() => {
    loadAll();
  }, []);

  const value: ProductContextValue = {
    // Data
    brands,
    families,
    
    // Loading states
    isLoading,
    isBrandsLoading,
    isFamiliesLoading,
    
    // Error states
    error,
    brandsError,
    familiesError,
    
    // Actions
    refreshBrands,
    refreshFamilies,
    refreshAll,
    
    // Utility functions
    getBrandById,
    getFamilyById,
  };

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProductContext(): ProductContextValue {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProductContext must be used within a ProductProvider');
  }
  return context;
}
