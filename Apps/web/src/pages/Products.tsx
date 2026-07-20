import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { useCatalogProducts } from "@/hooks/useCatalogProducts";
import { useCatalogFamilies, useCatalogBrands, useCatalogModels } from "@/hooks/useCatalogTaxonomy";
import { useSendClientActivity } from "@/hooks/useObservability";
import { useSession } from "@/hooks/useSession";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ProductFilters } from "@/components/shared/ProductFilters";
import { ProductGrid } from "@/components/shared/ProductGrid";
import { ProductListHeader } from "@/components/shared/ProductListHeader";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import {
  ProductListQuerySchema,
  ClientActivityType,
  UserType,
  type ProductListQuery,
} from "@dragon-telecom/contract";

/**
 * Products (Catalog) page — PUB-02. The URL is the single source of truth for every filter;
 * this page never mirrors it into local state (beyond the debounced search input buffer).
 */
export default function Products() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: session } = useSession();
  const isClient = session?.type === UserType.CLIENT;
  const sendActivity = useSendClientActivity();

  // Parse + validate the URL into a ProductListQuery — a bad/missing param falls back to
  // page 1 / the default limit rather than fielding a malformed request (PUB-02: "ProductListQuery
  // validates the parsed URL params before the query fires").
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

  // Local, debounced search input — the URL (and the query it drives) only updates once typing
  // settles, so the grid doesn't refetch on every keystroke.
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  useEffect(() => {
    if (debouncedSearch !== (filters.search ?? "")) {
      updateParams({ search: debouncedSearch || undefined, page: undefined });
    }
    // Only the settled debounced value should trigger a URL write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);
  // Re-sync the local buffer when the URL changes from elsewhere (back/forward navigation).
  useEffect(() => {
    setSearchInput(filters.search ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  const {
    data: productsResult,
    isLoading: productsLoading,
    isError: productsIsError,
    error: productsError,
    refetch: refetchProducts,
  } = useCatalogProducts(filters);
  const { data: familiesData } = useCatalogFamilies();
  const { data: brandsData } = useCatalogBrands();
  const { data: modelsData } = useCatalogModels(
    { brandId: filters.brandId },
    false,
    { enabled: !!filters.brandId },
  );

  const products = productsResult?.items ?? [];
  const families = familiesData ?? [];
  const brands = brandsData ?? [];
  const models = modelsData ?? [];

  // Beacon: each executed search (debounced, non-empty), signed-in clients only.
  useEffect(() => {
    if (isClient && debouncedSearch.trim()) {
      sendActivity.mutate({ type: ClientActivityType.SEARCH, query: debouncedSearch.trim() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, debouncedSearch]);

  // Beacon: catalog session duration on unmount, signed-in clients only.
  const mountedAt = useRef(Date.now());
  useEffect(() => {
    return () => {
      if (isClient) {
        const durationSeconds = Math.round((Date.now() - mountedAt.current) / 1000);
        sendActivity.mutate({ type: ClientActivityType.CATALOG_SESSION, durationSeconds });
      }
    };
    // Fires once on unmount with whatever `isClient` is current at that point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Event handlers — every filter writes the URL directly (PUB-02).
  const handleSearchChange = useCallback((query: string) => {
    setSearchInput(query);
  }, []);

  const handleBrandChange = useCallback(
    (brandId: string) => {
      // Brand change resets model (PUB-02).
      updateParams({ brandId: brandId === "all" ? undefined : brandId, modelId: undefined, page: undefined });
    },
    [updateParams],
  );

  const handleCategoryChange = useCallback(
    (familyId: string) => {
      updateParams({ familyId: familyId === "all" ? undefined : familyId, page: undefined });
    },
    [updateParams],
  );

  const handleModelChange = useCallback(
    (modelId: string) => {
      updateParams({ modelId: modelId === "all" ? undefined : modelId, page: undefined });
    },
    [updateParams],
  );

  const handleInStockChange = useCallback(
    (inStock: boolean) => {
      updateParams({ inStock: inStock ? "true" : undefined, page: undefined });
    },
    [updateParams],
  );

  const handleSortChange = useCallback(
    (sort: string) => {
      updateParams({ sort: sort === "default" ? undefined : sort, page: undefined });
    },
    [updateParams],
  );

  const handleClearFilters = useCallback(() => {
    setSearchInput("");
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const handlePageChange = useCallback(
    (page: number) => {
      updateParams({ page: page === 1 ? undefined : String(page) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [updateParams],
  );

  const meta = productsResult?.meta;

  return (
    <div>
      <main className="py-8 px-4 sm:px-8 md:px-12">
        <div className="container mx-auto px-4">
          <ErrorBoundary>
            {/* Page Header */}
            <ProductListHeader
              title={t('products.page.title')}
              description={t('products.page.description')}
              totalProducts={meta?.total ?? 0}
              filteredCount={meta?.total ?? 0}
              isLoading={productsLoading}
              showStats={true}
            />
          </ErrorBoundary>

          <ErrorBoundary>
            {/* Filters */}
            <div className="mb-8">
              <ProductFilters
                searchQuery={searchInput}
                onSearchChange={handleSearchChange}
                selectedBrand={filters.brandId ?? "all"}
                onBrandChange={handleBrandChange}
                selectedCategory={filters.familyId ?? "all"}
                onCategoryChange={handleCategoryChange}
                selectedModel={filters.modelId ?? "all"}
                onModelChange={handleModelChange}
                inStock={filters.inStock ?? false}
                onInStockChange={handleInStockChange}
                sort={filters.sort ?? "default"}
                onSortChange={handleSortChange}
                brands={brands}
                categories={families}
                models={models}
                isLoading={productsLoading}
                showClearFilters={true}
                onClearFilters={handleClearFilters}
              />
            </div>
          </ErrorBoundary>

          <ErrorBoundary>
            {/* Products Grid */}
            <ProductGrid
              products={products}
              isLoading={productsLoading}
              error={productsIsError ? (productsError?.message ?? undefined) : undefined}
              onRetry={() => refetchProducts()}
              onClearFilters={handleClearFilters}
              columns={{
                mobile: 1,
                tablet: 2,
                desktop: 4
              }}
              showSkeletons={true}
              skeletonCount={15}
              enablePagination={false}
            />

            {/* Server-side pagination — the grid's own internal pagination is disabled above
                since useCatalogProducts already returns one page at a time. */}
            {meta && meta.totalPages > 1 && (
              <div className="flex justify-center mt-8">
                <SimplePagination
                  page={meta.page}
                  totalPages={meta.totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
