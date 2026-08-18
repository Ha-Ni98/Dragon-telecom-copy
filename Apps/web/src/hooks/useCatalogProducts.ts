import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ProductListQuery,
  CreateProductCommand,
  UpdateProductCommand,
  UpdatePricingCommand,
  AddProductImagesCommand,
  UpdateProductImagesCommand,
  GenerateBarcodeCommand,
  BarcodeLabelSheetCommand,
  BarcodeLookupCommand,
} from "@dragon-telecom/contract";
import * as catalogService from "@/services/catalog.service";
import { qk } from "@/lib/query-keys";

// --- Reads ---

// `options.enabled` (S15) — the header's StorefrontSearch only wants this to fire once the
// visitor has typed something, matching useStaffProducts' precedent below; omitting `options`
// keeps every existing caller's always-on behavior (react-query treats `enabled: undefined` as
// enabled).
export function useCatalogProducts(query: ProductListQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.catalog.products.list(query),
    queryFn: () => catalogService.listProducts(query),
    enabled: options?.enabled,
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

// `options.enabled` (S17) — the Settings featured-products chip-resolution query must not fire
// with an empty `ids` string. Every existing single-argument caller keeps its always-on behavior
// (react-query treats `enabled: undefined` as enabled).
export function useAdminCatalogProducts(query: ProductListQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.catalog.adminProducts.list(query),
    queryFn: () => catalogService.listAdminProducts(query),
    enabled: options?.enabled,
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
// Create/update/pricing/images all cross-invalidate inventory (plan.md §3) — avgStockPrice,
// avgPrice, quantities, and low-stock status are inventory-owned but rendered on the admin product list.

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

export function useDeleteProductImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, imageId }: { id: string; imageId: string }) =>
      catalogService.deleteImage(id, imageId),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.detail(id) });
      // The public/product lists render the primary image, and deleting one can promote a new
      // primary — so both list caches are stale, not just this product's detail.
      queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.all() });
      queryClient.invalidateQueries({ queryKey: qk.catalog.products.all() });
    },
  });
}

// A mutation, not a query (S19): every click must produce a *fresh* candidate, and a `useQuery`
// keyed on {familyId, brandId} would hand the same barcode to two consecutive products from cache.
// Nothing is written server-side, so there is no cache to invalidate and no query key to define —
// which is also why this hook takes no queryClient.
export function useGenerateBarcode() {
  return useMutation({
    mutationFn: (command: GenerateBarcodeCommand) => catalogService.generateBarcode(command),
  });
}

// S22 — a query, unlike useGenerateBarcode above: the same {invoice lines} genuinely should be
// served from cache, and the dialog needs it declaratively on open rather than imperatively. A
// POST only because the id list is too long for a query string.
export function useBarcodeLookup(productIds: string[], options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.catalog.barcodeLookup(productIds),
    queryFn: () => catalogService.lookupBarcodes({ productIds }),
    enabled: (options?.enabled ?? true) && productIds.length > 0,
  });
}

// Imperative (triggers a file download) rather than a query — returns a Blob, not cacheable domain
// data. Same shape as useInvoicePdf (useBilling.ts) and useExportReportCsv.
export function usePrintBarcodeLabels() {
  return useMutation({
    mutationFn: (command: BarcodeLabelSheetCommand) => catalogService.renderBarcodeLabels(command),
  });
}
