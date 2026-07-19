/**
 * Hook for modifying client information
 * Provides mutation functionality for client updates
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClientModificationData } from '@/types/draft-types/client.types';
import { AdminClientsService } from '@/lib/services/admin-clients.service';
import { adminClientsQueryKeys } from './use-admin-clients';

/**
 * Hook for modifying client information
 * Provides mutation functionality with optimistic updates
 */
export function useModifyClient() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ clientId, updates }: { clientId: number; updates: ClientModificationData }) =>
      AdminClientsService.modifyClient(clientId, updates),
    
    onMutate: async ({ clientId, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: adminClientsQueryKeys.all });

      // Snapshot the previous value
      const previousClients = queryClient.getQueriesData({ queryKey: adminClientsQueryKeys.all });

      // Optimistically update the cache
      queryClient.setQueriesData({ queryKey: adminClientsQueryKeys.all }, (old: any) => {
        if (!old) return old;
        
        return {
          ...old,
          clients: old.clients?.map((client: any) => 
            client.idClient === clientId 
              ? { 
                  ...client, 
                  clientStatus: updates.status,
                  clientCredit: updates.credit,
                  clientUserName: updates.username || client.clientUserName,
                  displayStatus: getDisplayStatus(updates.status)
                }
              : client
          ) || []
        };
      });

      // Return a context object with the snapshotted value
      return { previousClients };
    },

    onError: (err, { clientId }, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousClients) {
        context.previousClients.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      
      toast.error('Failed to update client', {
        description: 'There was an error updating the client information. Please try again.',
      });
    },

    onSuccess: (data, { clientId, updates }) => {
      // Invalidate and refetch client data
      queryClient.invalidateQueries({ queryKey: adminClientsQueryKeys.all });
      
      toast.success('Client updated successfully', {
        description: 'The client information has been updated.',
      });
    },

    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: adminClientsQueryKeys.all });
    },
  });

  return {
    modifyClient: mutation.mutate,
    modifyClientAsync: mutation.mutateAsync,
    isModifying: mutation.isPending,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    reset: mutation.reset,
  };
}

/**
 * Get display status from status code
 */
function getDisplayStatus(status: number): string {
  const statusMap: Record<number, string> = {
    0: 'Active',
    1: 'Pending',
    2: 'Disabled',
    3: 'Refused',
  };
  return statusMap[status] || 'Unknown';
}
