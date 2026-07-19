import { useMemo } from 'react';
import { useProductContext } from '@/components/providers/product-provider';
import { Brand, Family } from '@/types/draft-types';

export interface NavigationCategory {
  name: string;
  href: string;
  id: number;
}

export interface NavigationBrand {
  name: string;
  href: string;
  id: number;
}

export function useProductData() {
  const context = useProductContext();

  // Format families for navigation
  const productCategories = useMemo((): NavigationCategory[] => {
    return context.families.map(family => ({
      name: family.familyName,
      href: `/products?category=${encodeURIComponent(family.idFamily)}`,
      id: family.idFamily,
    }));
  }, [context.families]);

  // Format brands for navigation
  const brands = useMemo((): NavigationBrand[] => {
    return context.brands.map(brand => ({
      name: brand.brandName,
      href: `/products?brand=${encodeURIComponent(brand.idBrand)}`,
      id: brand.idBrand,
    }));
  }, [context.brands]);

  // Combined loading state for navigation
  const isLoadingNavigation = context.isBrandsLoading || context.isFamiliesLoading;

  // Error state for navigation
  const navigationError = context.brandsError || context.familiesError || context.error;

  return {
    // Raw data from provider
    brands: context.brands,
    families: context.families,
    
    // Formatted navigation data
    productCategories,
    navigationBrands: brands,
    
    // Loading states
    isLoading: context.isLoading,
    isLoadingNavigation,
    isBrandsLoading: context.isBrandsLoading,
    isFamiliesLoading: context.isFamiliesLoading,
    
    // Error states
    error: context.error,
    navigationError,
    brandsError: context.brandsError,
    familiesError: context.familiesError,
    
    // Actions from provider
    refreshBrands: context.refreshBrands,
    refreshFamilies: context.refreshFamilies,
    refreshAll: context.refreshAll,
    
    // Utility functions
    getBrandById: context.getBrandById,
    getFamilyById: context.getFamilyById,
    
    // Convenience getters
    hasNavigationData: productCategories.length > 0 || brands.length > 0,
    isNavigationReady: !isLoadingNavigation && !navigationError,
  };
}
