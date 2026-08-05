import { Package, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { useTranslation } from "@/hooks/useTranslation";
import type { ProductWithPricingDto } from "@dragon-telecom/contract";
import { ProductCard } from "./ProductCard";

// Tailwind's JIT scanner only picks up complete, literal class names — `grid-cols-${n}` is
// never emitted for any `n` because the scanner can't see past the template-literal split.
// These lookups keep every possible class name literal in the source so the CSS always ships.
const MOBILE_COLS_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};
const TABLET_COLS_CLASS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};
const DESKTOP_COLS_CLASS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

/**
 * ProductGrid component props
 */
interface ProductGridProps {
  /** Array of products to display */
  products: ProductWithPricingDto[];
  /** Whether the component is in loading state */
  isLoading?: boolean;
  /** Booleans + callbacks, matching AdminProductsTable/StaffProductsTable — the grid owns its own
   *  error copy rather than receiving a pre-formatted string. */
  isError?: boolean;
  /** Retries the failed query — falls back to a hard reload if the caller doesn't wire one. */
  onRetry?: () => void;
  /** Clears active filters — shown as the empty-state action when provided. */
  onClearFilters?: () => void;
  /** Custom className for styling */
  className?: string;
  /** Number of products per row on different screen sizes */
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  /** Whether to show loading skeletons */
  showSkeletons?: boolean;
  /** Number of skeleton items to show while loading */
  skeletonCount?: number;
}

/**
 * ProductGrid component for displaying products in a responsive grid layout
 * Handles loading states, error states, and empty states
 */
export function ProductGrid({
  products,
  isLoading = false,
  isError = false,
  onRetry,
  onClearFilters,
  className = "",
  columns = {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  },
  showSkeletons = true,
  skeletonCount = 6,
}: ProductGridProps) {
  const { t } = useTranslation();

  /**
   * Generate grid column classes based on responsive breakpoints
   */
  const getGridClasses = (): string => {
    const mobileCols = MOBILE_COLS_CLASS[columns.mobile ?? 1] ?? MOBILE_COLS_CLASS[1];
    const tabletCols = TABLET_COLS_CLASS[columns.tablet ?? 2] ?? TABLET_COLS_CLASS[2];
    const desktopCols = DESKTOP_COLS_CLASS[columns.desktop ?? 3] ?? DESKTOP_COLS_CLASS[3];

    return `grid ${mobileCols} ${tabletCols} ${desktopCols} gap-4 md:gap-6`;
  };

  /**
   * Render loading skeletons
   */
  const renderSkeletons = () => {
    if (!showSkeletons) return null;

    return Array.from({ length: skeletonCount }, (_, index) => (
      <Card key={`skeleton-${index}`} className="border-0 shadow-card">
        <CardContent className="p-0">
          <div className="space-y-4 p-4">
            {/* Image skeleton */}
            <Skeleton className="aspect-square w-full rounded-lg" />

            {/* Content skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>

            {/* Features skeleton */}
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>

            {/* Button skeleton */}
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    ));
  };

  /**
   * Render error state — local to the grid so a failed query never takes the rest of the page
   * (filters, header) down with it.
   */
  const renderError = () => (
    <div className="col-span-full">
      <NotFoundState
        icon={<AlertCircle className="h-6 w-6" />}
        title={t("products.errorLoading")}
        body={t("products.errorLoadingBody")}
        action={
          <Button
            variant="outline"
            onClick={() => (onRetry ? onRetry() : window.location.reload())}
          >
            {t("common.actions.tryAgain")}
          </Button>
        }
      />
    </div>
  );

  /**
   * Render empty state — offers a clear-filters action when the caller supplies one (Catalog),
   * otherwise falls back to a plain "browse all products" link.
   */
  const renderEmpty = () => (
    <div className="col-span-full">
      <EmptyState
        icon={<Package className="h-6 w-6" />}
        title={t("products.noProductsFound")}
        body={t("products.results.none")}
        decoration={
          <Button
            variant="outline"
            className="mt-4"
            onClick={() =>
              onClearFilters ? onClearFilters() : (window.location.href = "/products")
            }
          >
            {onClearFilters ? t("products.filters.clearAll") : t("products.viewAll")}
          </Button>
        }
      />
    </div>
  );

  /**
   * Render loading state
   */
  const renderLoading = () => (
    <div className="col-span-full flex items-center justify-center py-8">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>{t("products.loading")}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Products Grid */}
      <div className={`${getGridClasses()} ${className}`}>
        {/* Error State */}
        {isError && !isLoading && renderError()}

        {/* Loading State */}
        {isLoading && !isError && <>{showSkeletons ? renderSkeletons() : renderLoading()}</>}

        {/* Empty State */}
        {!isLoading && !isError && products.length === 0 && renderEmpty()}

        {/* Products Grid */}
        {!isLoading && !isError && products.length > 0 && (
          <>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} className="h-full" />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
