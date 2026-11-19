import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { useCatalogProducts } from "@/hooks/useCatalogProducts";
import { useCatalogFamilies, useCatalogBrands, useCatalogModels } from "@/hooks/useCatalogTaxonomy";
import { useSendClientActivity } from "@/hooks/useObservability";
import { useSession } from "@/hooks/useSession";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ProductFilters } from "@/pages/products/components/ProductFilters";
import { ProductListHeader } from "@/pages/products/components/ProductListHeader";
import { ProductGrid } from "@/components/shared/ProductGrid";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import type { CatalogLocationState } from "@/types/storefront-nav.types";
import {
  ProductListQuerySchema,
  ClientActivityType,
  UserType,
  type ProductListQuery,
  type ProductSort,
} from "@dragon-telecom/contract";

/**
 * Products (Catalog) page — PUB-02. The URL is the single source of truth for every filter;
 * this page never mirrors it into local state (beyond the debounced search input buffer).
 * S20: filter components own their own "no selection" sentinel, so every handler here passes
 * `undefined` straight through to the URL writer — the page never compares against "all".
 */
export default function Products() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
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

  // S37 P6 — the bottom nav's "Categories" item lands here with { openFamilyFilter: true } in
  // router state: open the filter drawer once, then drop the state (replace) so Back/refresh
  // doesn't reopen it. Keyed on location.key: tapping Categories again while already here pushes
  // a new entry, so it reopens.
  useEffect(() => {
    const state = location.state as CatalogLocationState | null;
    if (!state?.openFamilyFilter) return;
    setFiltersSheetOpen(true);
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: null },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

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
  // Records what this page last pushed into the URL, so the re-sync effect below can tell its own
  // echo apart from a genuinely external URL change.
  const lastWrittenSearch = useRef<string | null>(null);
  useEffect(() => {
    if (debouncedSearch !== (filters.search ?? "")) {
      lastWrittenSearch.current = debouncedSearch;
      updateParams({ search: debouncedSearch || undefined, page: undefined });
    }
    // Only the settled debounced value should trigger a URL write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);
  // Re-sync the local buffer when the URL changes from elsewhere (back/forward navigation, a
  // cleared filter). The echo of our *own* write is skipped: the debounced value lands in the URL
  // a render after it settles, and adopting it unconditionally would revert any character typed in
  // between — the input would silently drop keystrokes instead of losing focus.
  useEffect(() => {
    const urlSearch = filters.search ?? "";
    if (urlSearch === lastWrittenSearch.current) {
      lastWrittenSearch.current = null;
      return;
    }
    setSearchInput(urlSearch);
  }, [filters.search]);

  const {
    data: productsResult,
    isLoading: productsLoading,
    isError: productsIsError,
    refetch: refetchProducts,
  } = useCatalogProducts(filters);
  const { data: familiesData } = useCatalogFamilies();
  const { data: brandsData } = useCatalogBrands();
  const { data: modelsData } = useCatalogModels({ brandId: filters.brandId }, false, {
    enabled: !!filters.brandId,
  });

  const products = useMemo(() => productsResult?.items ?? [], [productsResult]);
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
  const handleFamilyChange = useCallback(
    (familyId: string | undefined) => updateParams({ familyId, page: undefined }),
    [updateParams],
  );

  const handleBrandChange = useCallback(
    // Brand change resets model (PUB-02).
    (brandId: string | undefined) => updateParams({ brandId, modelId: undefined, page: undefined }),
    [updateParams],
  );

  const handleModelChange = useCallback(
    (modelId: string | undefined) => updateParams({ modelId, page: undefined }),
    [updateParams],
  );

  const handleInStockChange = useCallback(
    (inStock: boolean) => {
      updateParams({ inStock: inStock ? "true" : undefined, page: undefined });
    },
    [updateParams],
  );

  const handleSortChange = useCallback(
    (sort: ProductSort | undefined) => updateParams({ sort, page: undefined }),
    [updateParams],
  );

  const handleClearFilters = useCallback(() => {
    setSearchInput("");
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const handlePageChange = useCallback(
    (page: number) => {
      updateParams({ page: page <= 1 ? undefined : String(page) });
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
              title={t("products.page.title")}
              description={t("products.page.description")}
              count={meta?.total ?? 0}
              isLoading={productsLoading}
            />
          </ErrorBoundary>

          <ErrorBoundary>
            {/* Filters */}
            <div className="mb-8">
              <ProductFilters
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
                inStock={filters.inStock ?? false}
                onInStockChange={handleInStockChange}
                sort={filters.sort}
                onSortChange={handleSortChange}
                isLoading={productsLoading}
                onClearFilters={handleClearFilters}
                sheetOpen={filtersSheetOpen}
                onSheetOpenChange={setFiltersSheetOpen}
              />
            </div>
          </ErrorBoundary>

          <ErrorBoundary>
            {/* Products Grid */}
            <ProductGrid
              products={products}
              isLoading={productsLoading}
              isError={productsIsError}
              onRetry={() => refetchProducts()}
              onClearFilters={handleClearFilters}
              // S39 — two cards per row on a phone: the card is now sized for the home rows'
              // 2.3-per-row strip, so one-per-row would be a full-width square per product.
              columns={{
                mobile: 2,
                tablet: 3,
                desktop: 4,
              }}
              showSkeletons={true}
              skeletonCount={15}
            />

            {/* Server-side pagination — useCatalogProducts already returns one page at a time. */}
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
