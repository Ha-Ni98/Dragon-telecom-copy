import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { fetchFeaturedProducts, fetchProducts } from "@/lib/services/products.service";
import type { Product } from "@/types/draft-types";

export function useProducts(options?: Partial<UseQueryOptions<Product[]>>) {
  return useQuery({
    queryKey: ["products", "all"],
    queryFn: fetchProducts,
    staleTime: 1000 * 60,
    ...options,
  });
}

export function useFeaturedProducts(limit: number = 4, options?: Partial<UseQueryOptions<Product[]>>) {
  return useQuery({
    queryKey: ["products", "featured", limit],
    queryFn: () => fetchFeaturedProducts(limit),
    staleTime: 1000 * 60,
    ...options,
  });
}


