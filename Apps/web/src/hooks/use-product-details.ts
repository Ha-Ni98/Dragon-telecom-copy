/**
 * Custom hook for product details functionality
 * Handles fetching product data by name and managing loading/error states
 */

import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { getProductByName } from "@/services/catalog.service";
import { qkLegacy } from "@/lib/query-keys";
import type { ProductDetails } from "@/types/draft-types/product.types";

/**
 * Hook to fetch product details by name (kebab-case)
 */
export function useProductDetails(
  productName: string,
  options?: Partial<UseQueryOptions<ProductDetails | null>>
) {
  return useQuery({
    queryKey: qkLegacy.catalogProductByName(productName),
    queryFn: () => getProductByName(productName),
    enabled: !!productName,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    ...options,
  });
}
