import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { getFeaturedProducts, getProducts } from "@/services/catalog.service";
import { qk } from "@/lib/query-keys";
import type { ProductWithDetails } from "@/types/draft-types/main-page.types";

export function useProducts(options?: Partial<UseQueryOptions<ProductWithDetails[]>>) {
  return useQuery({
    queryKey: qk.catalog.products(),
    queryFn: getProducts,
    staleTime: 1000 * 60,
    ...options,
  });
}

export function useFeaturedProducts(limit: number = 4, options?: Partial<UseQueryOptions<ProductWithDetails[]>>) {
  return useQuery({
    queryKey: qk.catalog.featuredProducts(limit),
    queryFn: () => getFeaturedProducts(limit),
    staleTime: 1000 * 60,
    ...options,
  });
}
