import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ValidatePhoneCommand,
  RegisterClientCommand,
  UpdateMeCommand,
  ChangeMyPasswordCommand,
  AddCartItemCommand,
} from "@dragon-telecom/contract";
import * as clientsService from "@/services/clients.service";
import { qk } from "@/lib/query-keys";

// --- Web identity (public + client) ---
// Names deliberately distinct from the Sub-01 stub hooks (useMyAccount/useRegistration/…) in
// use-my-account.ts/use-registration.ts — those still serve MyAccount.tsx/Register.tsx until
// Sub-03 rewires those pages onto these real hooks (integration sprints.md Sprint 4).

export function useValidatePhone() {
  return useMutation({
    mutationFn: (command: ValidatePhoneCommand) => clientsService.validatePhone(command),
  });
}

export function useRegisterClient() {
  return useMutation({
    mutationFn: (command: RegisterClientCommand) => clientsService.register(command),
  });
}

export function useClientMe() {
  return useQuery({
    queryKey: qk.clients.me(),
    queryFn: clientsService.getMe,
  });
}

export function useUpdateClientMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: UpdateMeCommand) => clientsService.updateMe(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.clients.me() });
    },
  });
}

export function useChangeClientPassword() {
  return useMutation({
    mutationFn: (command: ChangeMyPasswordCommand) => clientsService.changeMyPassword(command),
  });
}

// --- Cart (client) — favorites, no quantity ---

export function useClientCart() {
  return useQuery({
    queryKey: qk.clients.cart(),
    queryFn: clientsService.getCart,
  });
}

export function useAddToCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: AddCartItemCommand) => clientsService.addToCart(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.clients.cart() });
    },
  });
}

export function useRemoveFromCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => clientsService.removeFromCart(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.clients.cart() });
    },
  });
}
