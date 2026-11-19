import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { StaffProductFilters } from "@/pages/staff/products/components/StaffProductFilters";
import { StaffProductsTable } from "@/pages/staff/products/components/StaffProductsTable";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { useStaffProducts } from "@/hooks/useCatalogProducts";
import { useCatalogFamilies, useCatalogBrands, useCatalogModels } from "@/hooks/useCatalogTaxonomy";
import { useSendStaffSearch } from "@/hooks/useObservability";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTranslation } from "@/hooks/useTranslation";
import { ProductListQuerySchema, type ProductListQuery } from "@dragon-telecom/contract";
import { SectionTitle } from "@/components/shared/SectionTitle";

// STF-03 — read-only staff catalog lookup. URL-as-state (same ProductListQuerySchema Catalog
// validates against, D2: no image/cost/margin/actions). Every executed search fires the
// STAFF_SEARCH beacon (the "looked it up, never rang it up" inventory audit) — debounced +
// non-empty, mirroring Catalog's own SEARCH beacon in Products.tsx.
export default function StaffProducts() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: ProductListQuery = useMemo(() => {
    const raw = Object.fromEntries(searchParams.entries());
    const parsed = ProductListQuerySchema.safeParse(raw);
    return parsed.success ? parsed.data : { page: 1, limit: 15 };
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

  const { data: productsResult, isLoading, isError, refetch } = useStaffProducts(filters);
  const { data: familiesData } = useCatalogFamilies();
  const { data: brandsData } = useCatalogBrands();
  const { data: modelsData } = useCatalogModels({ brandId: filters.brandId }, false, {
    enabled: !!filters.brandId,
  });

  const products = productsResult?.items;
  const families = familiesData ?? [];
  const brands = brandsData ?? [];
  const models = modelsData ?? [];

  const sendStaffSearch = useSendStaffSearch();
  useEffect(() => {
    if (debouncedSearch.trim()) {
      sendStaffSearch.mutate({ query: debouncedSearch.trim() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

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
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);
  const handlePageChange = useCallback(
    (page: number) => updateParams({ page: page <= 1 ? undefined : String(page) }),
    [updateParams],
  );

  return (
    <div className="space-y-4">
      <div>
        <SectionTitle as="h1" className="text-2xl font-bold">
          {t("staff.products.title")}
        </SectionTitle>
        <p className="text-muted-foreground">{t("staff.products.subtitle")}</p>
      </div>

      <StaffProductFilters
        search={searchInput}
        onSearchChange={setSearchInput}
        families={families}
        familyId={filters.familyId}
        onFamilyChange={handleFamilyChange}
        brands={brands}
        brandId={filters.brandId}
        onBrandChange={handleBrandChange}
        models={models}
        modelId={filters.modelId}
        onModelChange={handleModelChange}
        onClearFilters={handleClearFilters}
      />

      <StaffProductsTable
        products={products}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onClearFilters={handleClearFilters}
      />

      {productsResult && productsResult.meta.totalPages > 1 && (
        <SimplePagination
          page={productsResult.meta.page}
          totalPages={productsResult.meta.totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
