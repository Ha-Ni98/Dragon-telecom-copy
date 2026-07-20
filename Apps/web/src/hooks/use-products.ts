import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { getFeaturedProducts, getProducts } from "@/services/catalog.service";
import { qkLegacy } from "@/lib/query-keys";
import type { ProductWithPricingDto } from "@dragon-telecom/contract";

export function useProducts(options?: Partial<UseQueryOptions<ProductWithPricingDto[]>>) {
  return useQuery({
    queryKey: qkLegacy.catalogProductsList(),
    queryFn: getProducts,
    staleTime: 1000 * 60,
    ...options,
  });
}

export function useFeaturedProducts(limit: number = 4, options?: Partial<UseQueryOptions<ProductWithPricingDto[]>>) {
  return useQuery({
    queryKey: qkLegacy.catalogFeaturedProducts(limit),
    queryFn: () => getFeaturedProducts(limit),
    staleTime: 1000 * 60,
    ...options,
  });
}
