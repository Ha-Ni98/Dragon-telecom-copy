import { useQuery } from '@tanstack/react-query';
import { BrandWithCount, CategoryWithCount, ProductWithDetails } from '@/types/draft-types/main-page.types';
import { brandsService } from '@/lib/services/brands.service';
import { familiesService } from '@/lib/services/families.service';

// brandsService/familiesService don't track product counts yet (Sub-02) — productCount: 0
// is the typed empty default until catalog stats are wired.
async function getBrandsWithCount(): Promise<BrandWithCount[]> {
  const brands = await brandsService.getBrands();
  return brands.map((brand) => ({ ...brand, productCount: 0 }));
}

async function getCategoriesWithCount(): Promise<CategoryWithCount[]> {
  const families = await familiesService.getFamilies();
  return families.map((family) => ({ ...family, productCount: 0 }));
}

/**
 * Hook to fetch brands with product counts
 */
export const useBrands = () => {
  return useQuery({
    queryKey: ['brands'],
    queryFn: getBrandsWithCount,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to fetch categories with product counts
 */
export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: getCategoriesWithCount,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to fetch products by brand ID
 */
export const useBrandProducts = (brandId: number) => {
  return useQuery({
    // Catalog-by-brand isn't wired yet (Sub-02) — [] is the typed empty default.
    queryKey: ['brand-products', brandId],
    queryFn: (): Promise<ProductWithDetails[]> => Promise.resolve([]),
    enabled: !!brandId,
    staleTime: 1000 * 60 * 3, // 3 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to fetch products by category ID
 */
export const useCategoryProducts = (categoryId: number) => {
  return useQuery({
    // Catalog-by-category isn't wired yet (Sub-02) — [] is the typed empty default.
    queryKey: ['category-products', categoryId],
    queryFn: (): Promise<ProductWithDetails[]> => Promise.resolve([]),
    enabled: !!categoryId,
    staleTime: 1000 * 60 * 3, // 3 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to get brand by ID
 */
export const useBrand = (brandId: number) => {
  const { data: brands } = useBrands();
  
  return {
    brand: brands?.find(brand => brand.idBrand === brandId),
    isLoading: !brands,
    error: null
  };
};

/**
 * Hook to get category by ID
 */
export const useCategory = (categoryId: number) => {
  const { data: categories } = useCategories();
  
  return {
    category: categories?.find(category => category.idFamily === categoryId),
    isLoading: !categories,
    error: null
  };
};

/**
 * Hook to get popular brands (top 6 by product count)
 */
export const usePopularBrands = () => {
  const { data: brands, ...rest } = useBrands();
  
  return {
    brands: brands?.slice(0, 6).sort((a, b) => b.productCount - a.productCount),
    ...rest
  };
};

/**
 * Hook to get featured brands (brands with most products)
 */
export const useFeaturedBrands = (limit: number = 4) => {
  const { data: brands, ...rest } = useBrands();
  
  return {
    brands: brands?.slice(0, limit).sort((a, b) => b.productCount - a.productCount),
    ...rest
  };
};
