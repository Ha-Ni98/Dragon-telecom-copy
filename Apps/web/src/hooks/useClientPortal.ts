import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type {
  ValidatePhoneCommand,
  RegisterClientCommand,
  UpdateMeCommand,
  ChangeMyPasswordCommand,
  AddCartItemCommand,
  ProductWithPricingDto,
  ProductDetailDto,
  PaginatedResult,
} from "@dragon-telecom/contract";
import * as clientsService from "@/services/clients.service";
import { qk } from "@/lib/query-keys";

// --- Web identity (public + client) ---
// The Sub-01 stub hooks these once stayed deliberately distinct from (useMyAccount/
// useRegistration in use-my-account.ts/use-registration.ts) were retired in the pub-pages
// Sprint 6 rewire — MyAccount.tsx/Register.tsx consume these directly now.

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

// `enabled` lets a public page (e.g. product detail) call this only when the viewer is actually
// a signed-in client — calling it unconditionally for a guest would fire a doomed, 401-bound
// request straight into the axios interceptor's redirect-to-login (axios.ts has no per-request
// opt-out for that).
export function useClientMe(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.clients.me(),
    queryFn: clientsService.getMe,
    enabled: options?.enabled,
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

// Toggling the cart doesn't just invalidate ['clients','cart'] — every ProductCard reads its
// heart state off `inCart` on the *catalog* product it was handed (list or detail query), so
// PUB-01/02's "patches inCart in product caches" requires patching those too, or the heart won't
// flip until an unrelated refetch happens to occur. Handles both cached shapes under
// qk.catalog.products.all(): a PaginatedResult (list) or a bare DTO (detail).
function patchInCartInProductCaches(queryClient: QueryClient, productId: string, inCart: boolean) {
  queryClient.setQueriesData<PaginatedResult<ProductWithPricingDto> | ProductDetailDto | undefined>(
    { queryKey: qk.catalog.products.all() },
    (old) => {
      if (!old) return old;
      if ("items" in old) {
        return {
          ...old,
          items: old.items.map((p) => (p.id === productId ? { ...p, inCart } : p)),
        };
      }
      return old.id === productId ? { ...old, inCart } : old;
    },
  );
}

export function useAddToCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: AddCartItemCommand) => clientsService.addToCart(command),
    onSuccess: (_data, command) => {
      queryClient.invalidateQueries({ queryKey: qk.clients.cart() });
      patchInCartInProductCaches(queryClient, command.productId, true);
    },
  });
}

export function useRemoveFromCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => clientsService.removeFromCart(productId),
    onSuccess: (_data, productId) => {
      queryClient.invalidateQueries({ queryKey: qk.clients.cart() });
      patchInCartInProductCaches(queryClient, productId, false);
    },
  });
}
