/**
 * Custom hook for low stock products
 * Handles fetching and caching of low stock products data
 */

import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { ProductWithStock } from "@/types/draft-types/dashboard.types";
import { dashboardService } from "@/services/dashboard.service";

/**
 * Hook to fetch low stock products
 * Uses TanStack Query for caching and state management
 */
export function useLowStockProducts(
  limit: number = 5,
  options?: Partial<UseQueryOptions<ProductWithStock[]>>
) {
  return useQuery({
    queryKey: ["dashboard", "low-stock-products", limit],
    queryFn: () => dashboardService.getLowStockProducts(limit),
    staleTime: 1000 * 60 * 10, // 10 minutes (stock changes less frequently)
    gcTime: 1000 * 60 * 15, // 15 minutes
    retry: 2,
    refetchOnWindowFocus: false,
    ...options,
  });
}
