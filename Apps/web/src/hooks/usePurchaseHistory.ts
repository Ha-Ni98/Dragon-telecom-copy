import { useQuery } from "@tanstack/react-query";
import type { PurchasedProductsQuery } from "@dragon-telecom/contract";
import * as clientsService from "@/services/clients.service";
import { qk } from "@/lib/query-keys";
import type { PurchaseHistoryOwner } from "@/types/purchase-history.types";

// S36 — the "Products bought" tab. No invalidation is wired: the tab mounts only when opened
// (inactive TabsContent unmounts) and the default staleTime of 0 refetches on every mount.
export function usePurchasedProducts(owner: PurchaseHistoryOwner, query: PurchasedProductsQuery) {
  return useQuery({
    queryKey: qk.purchaseHistory.products(owner, query),
    queryFn: () => clientsService.listPurchasedProducts(owner, query),
    enabled: !!owner.id,
  });
}

export function usePurchasedProductDocuments(
  owner: PurchaseHistoryOwner,
  productId: string | null,
  query: PurchasedProductsQuery,
) {
  return useQuery({
    queryKey: qk.purchaseHistory.documents(owner, productId ?? "", query),
    queryFn: () => clientsService.listPurchasedProductDocuments(owner, productId!, query),
    enabled: !!owner.id && !!productId,
  });
}
