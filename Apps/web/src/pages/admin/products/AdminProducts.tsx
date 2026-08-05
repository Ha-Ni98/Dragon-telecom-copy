import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminProductsStatsCards } from "@/pages/admin/products/components/admin-products-stats-cards";
import { AdminProductsFilters } from "@/pages/admin/products/components/admin-products-filters";
import { AdminProductsTable } from "@/pages/admin/products/components/admin-products-table";
import { AdminProductPricesTable } from "@/pages/admin/products/components/admin-product-prices-table";
import { BarcodeLabelDialog } from "@/pages/admin/products/components/barcode-label-dialog";
import {
  useAdminCatalogProducts,
  useProductStats,
  useUpdateProduct,
} from "@/hooks/useCatalogProducts";
import { useCatalogFamilies, useCatalogBrands, useCatalogModels } from "@/hooks/useCatalogTaxonomy";
import { useSendStaffSearch } from "@/hooks/useObservability";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTranslation } from "@/hooks/useTranslation";
import {
  ProductListQuerySchema,
  StockStatus,
  type ProductListQuery,
  type AdminProductDto,
} from "@dragon-telecom/contract";

// ADM-02 — set-03 Sprint 5 rewire (was numeric-id use-admin-products stub hooks + a delete/
// add-stock flow that isn't in the spec: "No stock entry here — stock arrives only via
// supplier invoices (ADM-08) or adjustments (ADM-06)"). URL-as-state mirrors
// StaffProducts.tsx's precedent (set-02); the admin search also fires the STAFF_SEARCH beacon
// (ADM-02 §Interactions: "admin searches are audited too").
export default function AdminProducts() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: ProductListQuery = useMemo(() => {
    const raw = Object.fromEntries(searchParams.entries());
    const parsed = ProductListQuerySchema.safeParse(raw);
    return parsed.success ? parsed.data : { page: 1, limit: 20 };
  }, [searchParams]);

  const updateParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === "") next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  useEffect(() => {
    if (debouncedSearch !== (filters.search ?? "")) {
      updateParams({ search: debouncedSearch || undefined, page: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);
  useEffect(() => {
    setSearchInput(filters.search ?? "");
  }, [filters.search]);

  const sendStaffSearch = useSendStaffSearch();
  useEffect(() => {
    if (debouncedSearch.trim()) sendStaffSearch.mutate({ query: debouncedSearch.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Client-side only — ProductListQuery has no stockStatus param (just a boolean inStock).
  const [stockStatus, setStockStatus] = useState<StockStatus | undefined>();

  const {
    data: productsResult,
    isLoading: productsLoading,
    isError: productsError,
    refetch: refetchProducts,
  } = useAdminCatalogProducts(filters);
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useProductStats();
  const { data: families } = useCatalogFamilies({}, true);
  const { data: brands } = useCatalogBrands(true);
  const { data: models } = useCatalogModels({ brandId: filters.brandId }, true, {
    enabled: !!filters.brandId,
  });

  const products = useMemo(() => {
    const items = productsResult?.items ?? [];
    return stockStatus ? items.filter((p) => p.stockStatus === stockStatus) : items;
  }, [productsResult, stockStatus]);

  const handleFamilyChange = useCallback(
    (id: string | undefined) => updateParams({ familyId: id, page: undefined }),
    [updateParams],
  );
  const handleBrandChange = useCallback(
    (id: string | undefined) => updateParams({ brandId: id, modelId: undefined, page: undefined }),
    [updateParams],
  );
  const handleModelChange = useCallback(
    (id: string | undefined) => updateParams({ modelId: id, page: undefined }),
    [updateParams],
  );
  const handleClearFilters = useCallback(() => {
    setSearchInput("");
    setStockStatus(undefined);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);
  const handlePageChange = useCallback(
    (page: number) => updateParams({ page: page <= 1 ? undefined : String(page) }),
    [updateParams],
  );
  const handleRetry = useCallback(() => {
    if (productsError) refetchProducts();
    if (statsError) refetchStats();
  }, [productsError, statsError, refetchProducts, refetchStats]);

  // Optimistic publish/enable toggles with rollback (ADM-02 §Interactions) — local override
  // state rather than cache surgery, since useUpdateProduct() is a shared, generic mutation
  // also used by ADM-04's full-form save (which doesn't want optimistic list-row behavior).
  const [optimisticOverrides, setOptimisticOverrides] = useState<
    Record<string, Partial<Pick<AdminProductDto, "isPublished" | "isEnabled">>>
  >({});
  const updateProduct = useUpdateProduct();

  // S19 — which row's labels are being printed; null closes the dialog. Lives on the page, not the
  // table, so both the stock tab's table and the dialog read one source of truth.
  const [labelProduct, setLabelProduct] = useState<AdminProductDto | null>(null);

  const applyToggle = useCallback(
    (
      product: AdminProductDto,
      patch: Partial<Pick<AdminProductDto, "isPublished" | "isEnabled">>,
    ) => {
      setOptimisticOverrides((prev) => ({ ...prev, [product.id]: patch }));
      updateProduct.mutate(
        { id: product.id, command: patch },
        {
          onSuccess: () => {
            setOptimisticOverrides((prev) => {
              const { [product.id]: _dropped, ...rest } = prev;
              return rest;
            });
          },
          onError: () => {
            setOptimisticOverrides((prev) => {
              const { [product.id]: _dropped, ...rest } = prev;
              return rest;
            });
          },
        },
      );
    },
    [updateProduct],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title={t("admin.productsList.pageTitle")} />
        <Button asChild>
          <Link to="/admin/products/add">
            <Plus className="mr-2 h-4 w-4" />
            {t("admin.productsList.addButton")}
          </Link>
        </Button>
      </div>

      <AdminProductsStatsCards stats={stats} isLoading={statsLoading} />

      <AdminProductsFilters
        search={searchInput}
        onSearchChange={setSearchInput}
        families={families ?? []}
        familyId={filters.familyId}
        onFamilyChange={handleFamilyChange}
        brands={brands ?? []}
        brandId={filters.brandId}
        onBrandChange={handleBrandChange}
        models={models ?? []}
        modelId={filters.modelId}
        onModelChange={handleModelChange}
        stockStatus={stockStatus}
        onStockStatusChange={setStockStatus}
        onClearFilters={handleClearFilters}
      />

      {/* Filters/stats/pagination above stay outside the tabs (S3) — both tabs render the same
          `products` array from the same query, so search/family/brand/model/stock-status
          filtering and paging apply to both without duplicating the query or its state. */}
      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">{t("admin.productsList.tabs.stock")}</TabsTrigger>
          <TabsTrigger value="prices">{t("admin.productsList.tabs.prices")}</TabsTrigger>
        </TabsList>
        <TabsContent value="stock">
          <AdminProductsTable
            products={products}
            isLoading={productsLoading}
            isError={productsError}
            onRetry={handleRetry}
            onClearFilters={handleClearFilters}
            optimisticOverrides={optimisticOverrides}
            onTogglePublished={(product, isPublished) => applyToggle(product, { isPublished })}
            onToggleEnabled={(product, isEnabled) => applyToggle(product, { isEnabled })}
            onPrintBarcode={setLabelProduct}
          />
        </TabsContent>
        <TabsContent value="prices">
          <AdminProductPricesTable
            products={products}
            isLoading={productsLoading}
            isError={productsError}
            onRetry={handleRetry}
            onClearFilters={handleClearFilters}
          />
        </TabsContent>
      </Tabs>

      {productsResult && productsResult.meta.totalPages > 1 && (
        <SimplePagination
          page={productsResult.meta.page}
          totalPages={productsResult.meta.totalPages}
          onPageChange={handlePageChange}
        />
      )}

      <BarcodeLabelDialog
        product={labelProduct}
        open={!!labelProduct}
        onOpenChange={(open) => !open && setLabelProduct(null)}
      />
    </div>
  );
}
