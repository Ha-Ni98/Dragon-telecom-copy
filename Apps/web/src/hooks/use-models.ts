import { useQuery } from '@tanstack/react-query';
import { getModels } from '@/services/catalog.service';
import { qk } from '@/lib/query-keys';

/**
 * Hook to fetch device models
 */
export const useModels = () => {
  return useQuery({
    queryKey: qk.catalog.models(),
    queryFn: getModels,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
};
