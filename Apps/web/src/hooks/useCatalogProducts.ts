import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ProductListQuery,
  CreateProductCommand,
  UpdateProductCommand,
  UpdatePricingCommand,
  AddProductImagesCommand,
  UpdateProductImagesCommand,
} from "@dragon-telecom/contract";
import * as catalogService from "@/services/catalog.service";
import { qk } from "@/lib/query-keys";

// --- Reads ---

export function useCatalogProducts(query: ProductListQuery) {
  return useQuery({
    queryKey: qk.catalog.products.list(query),
    queryFn: () => catalogService.listProducts(query),
  });
}

export function useCatalogProduct(id: string) {
  return useQuery({
    queryKey: qk.catalog.products.detail(id),
    queryFn: () => catalogService.getProduct(id),
    enabled: !!id,
  });
}

// `options.enabled` (set-03 Sprint 7) — the repairs parts-editor reuses this for its product
// picker and only wants it to fire once the tech has typed something, unlike POS's own product
// grid which lists everything up front; omitting `options` keeps every existing caller's
// always-on behavior (react-query treats `enabled: undefined` as enabled).
export function useStaffProducts(query: ProductListQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.catalog.staffProducts.list(query),
    queryFn: () => catalogService.listStaffProducts(query),
    enabled: options?.enabled,
  });
}

export function useAdminCatalogProducts(query: ProductListQuery) {
  return useQuery({
    queryKey: qk.catalog.adminProducts.list(query),
    queryFn: () => catalogService.listAdminProducts(query),
  });
}

export function useAdminCatalogProduct(id: string) {
  return useQuery({
    queryKey: qk.catalog.adminProducts.detail(id),
    queryFn: () => catalogService.getAdminProduct(id),
    enabled: !!id,
  });
}

export function useProductStats() {
  return useQuery({
    queryKey: qk.catalog.productStats(),
    queryFn: catalogService.productStats,
  });
}

// --- Mutations ---
// Create/update/pricing/images all cross-invalidate inventory (plan.md §3) — averageCost,
// quantities, and low-stock status are inventory-owned but rendered on the admin product list.

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ command, images }: { command: CreateProductCommand; images: File[] }) =>
      catalogService.createProduct(command, images),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.all() });
      queryClient.invalidateQueries({ queryKey: qk.catalog.products.all() });
      queryClient.invalidateQueries({ queryKey: qk.inventory.all() });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: UpdateProductCommand }) =>
      catalogService.updateProduct(id, command),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.detail(id) });
      queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.all() });
      queryClient.invalidateQueries({ queryKey: qk.catalog.products.all() });
    },
  });
}

export function useUpdatePricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: UpdatePricingCommand }) =>
      catalogService.updatePricing(id, command),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.detail(id) });
      queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.all() });
      queryClient.invalidateQueries({ queryKey: qk.catalog.products.all() });
    },
  });
}

export function useAddProductImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      command,
      images,
    }: {
      id: string;
      command: AddProductImagesCommand;
      images: File[];
    }) => catalogService.addImages(id, command, images),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.detail(id) });
    },
  });
}

export function useUpdateProductImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: UpdateProductImagesCommand }) =>
      catalogService.updateImages(id, command),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.detail(id) });
    },
  });
}
