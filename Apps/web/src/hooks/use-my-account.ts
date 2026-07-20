import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyAccount, updateMyAccount, resetMyAccountPassword } from '@/services/clients.service';
import { qkLegacy } from '@/lib/query-keys';
import type { UserAccountData, PasswordResetData } from '@/types/draft-types/client.types';

export function useMyAccount() {
  return useQuery({
    queryKey: qkLegacy.clientsMyAccount(),
    queryFn: getMyAccount,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateMyAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Partial<UserAccountData>) => updateMyAccount(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qkLegacy.clientsMyAccount() });
    },
  });
}

export function useResetMyAccountPassword() {
  return useMutation({
    mutationFn: (data: PasswordResetData) => resetMyAccountPassword(data),
  });
}
