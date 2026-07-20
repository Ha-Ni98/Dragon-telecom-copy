/**
 * Custom hook for product details functionality
 * Handles fetching product data by id and managing loading/error states
 */

import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { getProductById } from "@/services/catalog.service";
import { qkLegacy } from "@/lib/query-keys";
import type { ProductDetailDto } from "@dragon-telecom/contract";

// Sub-01 scaffolding — id-based (was name-based via kebab-case reconstruction until the
// pub-pages Sprint 2 routing fix: PUB-03 requires routing "by id — never by name", D1), and
// DTO-typed (was the draft ProductDetails type until the pub-pages Sprint 3 retype). Still a
// stub underneath (getProductById always resolves null); the real replacement is
// useCatalogProduct(id) (Sub-02's useCatalogProducts.ts), wired in during the pub-pages Sprint 5
// assembly — kept as a stub rather than deleted so this page doesn't need two rewrites for the
// same interim period.
export function useProductDetails(
  id: string,
  options?: Partial<UseQueryOptions<ProductDetailDto | null>>
) {
  return useQuery({
    queryKey: qkLegacy.catalogProductById(id),
    queryFn: () => getProductById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    ...options,
  });
}
