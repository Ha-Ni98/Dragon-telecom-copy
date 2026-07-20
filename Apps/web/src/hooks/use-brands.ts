import { useQuery } from '@tanstack/react-query';
import { BrandWithCount, CategoryWithCount } from '@/types/draft-types/main-page.types';
import { getBrands, getFamilies } from '@/services/catalog.service';
import { qkLegacy } from '@/lib/query-keys';

// Catalog stats (product counts per brand/family) aren't wired yet (Sub-02) — productCount: 0
// is the typed empty default until then.
async function getBrandsWithCount(): Promise<BrandWithCount[]> {
  const brands = await getBrands();
  return brands.map((brand) => ({ ...brand, productCount: 0 }));
}

async function getCategoriesWithCount(): Promise<CategoryWithCount[]> {
  const families = await getFamilies();
  return families.map((family) => ({ ...family, productCount: 0 }));
}

/**
 * Hook to fetch brands with product counts
 */
export const useBrands = () => {
  return useQuery({
    queryKey: qkLegacy.catalogBrandsList(),
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
    queryKey: qkLegacy.catalogFamiliesList(),
    queryFn: getCategoriesWithCount,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
};
