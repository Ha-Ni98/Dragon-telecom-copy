import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * ProductListHeader component props
 */
interface ProductListHeaderProps {
  /** Page title */
  title: string;
  /** Page description */
  description: string;
  /** Number of products matching the current filters (`meta.total`). The catalog has no cheap
   *  unfiltered total and never did — the old totalProducts/filteredCount pair was always fed the
   *  same number, so the "showing X of Y" banner and badge never once rendered (S20 decision). */
  count: number;
  /** Whether the component is in loading state */
  isLoading?: boolean;
  /** Custom className for styling */
  className?: string;
}

/**
 * ProductListHeader component for displaying page title, description, and results count
 * Provides context about the current product listing state
 */
export function ProductListHeader({
  title,
  description,
  count,
  isLoading = false,
  className = "",
}: ProductListHeaderProps) {
  const { t } = useTranslation();

  const resultsText = isLoading
    ? t("products.loading")
    : t("products.results.available", { count });

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-6 w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Title and Description */}
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">{description}</p>
        </div>

        {/* Results Count */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <p className="text-sm text-muted-foreground">{resultsText}</p>
        </div>
      </div>
    </div>
  );
}
