import React from 'react';
import { Package, TrendingUp, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * ProductListHeader component props
 */
interface ProductListHeaderProps {
  /** Page title */
  title: string;
  /** Page description */
  description: string;
  /** Total number of products available */
  totalProducts: number;
  /** Number of products currently displayed (after filtering) */
  filteredCount: number;
  /** Whether the component is in loading state */
  isLoading?: boolean;
  /** Custom className for styling */
  className?: string;
  /** Whether to show product statistics */
  showStats?: boolean;
  /** Average rating of displayed products */
  averageRating?: number;
  /** Number of featured products */
  featuredCount?: number;
}

/**
 * ProductListHeader component for displaying page title, description, and results count
 * Provides context about the current product listing state
 */
export const ProductListHeader: React.FC<ProductListHeaderProps> = ({
  title,
  description,
  totalProducts,
  filteredCount,
  isLoading = false,
  className = '',
  showStats = true,
  averageRating,
  featuredCount
}) => {
  const { t } = useTranslation();

  /**
   * Check if filters are active
   */
  const hasActiveFilters = filteredCount < totalProducts;

  /**
   * Get results count text
   */
  const getResultsText = (): string => {
    if (isLoading) {
      return t('products.loading');
    }
    
    if (hasActiveFilters) {
      return t('products.results.count')
        .replace('{count}', filteredCount.toString())
        .replace('{total}', totalProducts.toString());
    }
    
    return `${totalProducts} ${totalProducts === 1 ? 'product' : 'products'} available`;
  };

  /**
   * Render loading skeleton
   */
  const renderSkeleton = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-6 w-32" />
        {showStats && (
          <>
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-28" />
          </>
        )}
      </div>
    </div>
  );

  /**
   * Render statistics badges
   */
  const renderStats = () => {
    if (!showStats) return null;

    return (
      <div className="flex flex-wrap gap-2">
        {hasActiveFilters && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Package className="h-3 w-3" />
            {filteredCount} of {totalProducts}
          </Badge>
        )}
        
        {featuredCount && featuredCount > 0 && (
          <Badge variant="default" className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            {featuredCount} Featured
          </Badge>
        )}
        
        {averageRating && averageRating > 0 && (
          <Badge variant="outline" className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {averageRating.toFixed(1)}★ Avg Rating
          </Badge>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        {renderSkeleton()}
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Title and Description */}
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            {title}
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            {description}
          </p>
        </div>
        
        {/* Results Count */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {getResultsText()}
          </p>
          
          {/* Statistics */}
          {renderStats()}
        </div>
      </div>

      {/* Filter Status */}
      {hasActiveFilters && (
        <div className="p-3 bg-muted/50 rounded-lg border">
          <p className="text-sm text-muted-foreground">
            <strong>Filters applied:</strong> Showing {filteredCount} of {totalProducts} products. 
            Clear filters to see all products.
          </p>
        </div>
      )}
    </div>
  );
};

export default ProductListHeader;
