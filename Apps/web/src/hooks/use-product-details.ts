/**
 * Custom hook for product details functionality
 * Handles fetching product data by name and managing loading/error states
 */

import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { fetchProductByName, fetchProductWithDetails, fetchRelatedProducts } from "@/lib/services/products.service";
import type { ProductDetails } from "@/types/draft-types";

/**
 * Hook to fetch product details by name (kebab-case)
 */
export function useProductDetails(
  productName: string,
  options?: Partial<UseQueryOptions<ProductDetails | null>>
) {
  return useQuery({
    queryKey: ["product", "details", productName],
    queryFn: () => fetchProductByName(productName),
    enabled: !!productName,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    ...options,
  });
}

/**
 * Hook to fetch product details by ID
 */
export function useProductDetailsById(
  productId: number,
  options?: Partial<UseQueryOptions<ProductDetails | null>>
) {
  return useQuery({
    queryKey: ["product", "details", "id", productId],
    queryFn: () => fetchProductWithDetails(productId),
    enabled: !!productId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    ...options,
  });
}

/**
 * Hook to fetch related products
 */
export function useRelatedProducts(
  productId: number,
  limit: number = 4,
  options?: Partial<UseQueryOptions<ProductDetails[]>>
) {
  return useQuery({
    queryKey: ["product", "related", productId, limit],
    queryFn: () => fetchRelatedProducts(productId, limit),
    enabled: !!productId,
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: 1,
    ...options,
  });
}

/**
 * Hook to check if product exists by name
 */
export function useProductExists(productName: string) {
  return useQuery({
    queryKey: ["product", "exists", productName],
    queryFn: async () => {
      const product = await fetchProductByName(productName);
      return !!product;
    },
    enabled: !!productName,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}
