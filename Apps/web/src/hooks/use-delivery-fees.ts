/**
 * Custom hook for delivery fees functionality
 * Handles fetching delivery fees data and calculations
 */

import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { 
  fetchDeliveryFees, 
  fetchAvailableWilayas, 
  fetchCommunesForWilaya,
  calculateDeliveryFeeAsync,
  getDeliveryFeeDetails,
  validateDeliveryAddress,
  getDeliveryFeeStatistics
} from "@/lib/services/delivery.service";
import type { DeliveryFee } from "@/mocks/delivery-fees";

/**
 * Hook to fetch all delivery fees
 */
export function useDeliveryFees(
  options?: Partial<UseQueryOptions<DeliveryFee[]>>
) {
  return useQuery({
    queryKey: ["delivery", "fees"],
    queryFn: fetchDeliveryFees,
    staleTime: 1000 * 60 * 30, // 30 minutes (delivery fees don't change often)
    retry: 2,
    ...options,
  });
}

/**
 * Hook to fetch available wilayas
 */
export function useAvailableWilayas(
  options?: Partial<UseQueryOptions<string[]>>
) {
  return useQuery({
    queryKey: ["delivery", "wilayas"],
    queryFn: fetchAvailableWilayas,
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
    queryFn: () => fetchCommunesForWilaya(wilaya),
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
    queryFn: () => calculateDeliveryFeeAsync(wilaya, commune, mode),
    enabled: !!wilaya && !!commune,
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: 1,
    ...options,
  });
}

/**
 * Hook to get delivery fee details
 */
export function useDeliveryFeeDetails(
  wilaya: string,
  commune: string,
  options?: Partial<UseQueryOptions<DeliveryFee | null>>
) {
  return useQuery({
    queryKey: ["delivery", "details", wilaya, commune],
    queryFn: () => getDeliveryFeeDetails(wilaya, commune),
    enabled: !!wilaya && !!commune,
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: 1,
    ...options,
  });
}

/**
 * Hook to validate delivery address
 */
export function useDeliveryAddressValidation(
  wilaya: string,
  commune: string,
  options?: Partial<UseQueryOptions<boolean>>
) {
  return useQuery({
    queryKey: ["delivery", "validation", wilaya, commune],
    queryFn: () => validateDeliveryAddress(wilaya, commune),
    enabled: !!wilaya && !!commune,
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: 1,
    ...options,
  });
}

/**
 * Hook to get delivery fee statistics
 */
export function useDeliveryFeeStatistics(
  options?: Partial<UseQueryOptions<{
    totalWilayas: number;
    totalCommunes: number;
    averageHomeFee: number;
    averageOfficeFee: number;
    minHomeFee: number;
    maxHomeFee: number;
    minOfficeFee: number;
    maxOfficeFee: number;
  }>>
) {
  return useQuery({
    queryKey: ["delivery", "statistics"],
    queryFn: getDeliveryFeeStatistics,
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
    ...options,
  });
}
