/**
 * Custom hook for checkout-flow delivery fee lookups
 */

import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import {
  getAvailableWilayas,
  getCommunesForWilaya,
  calculateDeliveryFee,
} from "@/services/checkout-delivery.service";

/**
 * Hook to fetch available wilayas
 */
export function useAvailableWilayas(
  options?: Partial<UseQueryOptions<string[]>>
) {
  return useQuery({
    queryKey: ["delivery", "wilayas"],
    queryFn: getAvailableWilayas,
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: 2,
    ...options,
  });
}

/**
 * Hook to fetch communes for a specific wilaya
 */
export function useCommunesForWilaya(
  wilaya: string,
  options?: Partial<UseQueryOptions<string[]>>
) {
  return useQuery({
    queryKey: ["delivery", "communes", wilaya],
    queryFn: () => getCommunesForWilaya(wilaya),
    enabled: !!wilaya,
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: 2,
    ...options,
  });
}

/**
 * Hook to calculate delivery fee
 */
export function useDeliveryFeeCalculation(
  wilaya: string,
  commune: string,
  mode: 'home' | 'office',
  options?: Partial<UseQueryOptions<number>>
) {
  return useQuery({
    queryKey: ["delivery", "fee", wilaya, commune, mode],
    queryFn: () => calculateDeliveryFee(wilaya, commune, mode),
    enabled: !!wilaya && !!commune,
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: 1,
    ...options,
  });
}
