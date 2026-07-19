import React, { useState, useMemo } from 'react';
import { Package, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SimplePagination } from '@/components/shared/SimplePagination';
import { useTranslation } from '@/hooks/useTranslation';
import { ProductWithDetails } from '@/types/draft-types/main-page.types';
import { ProductCard } from './ProductCard';

/**
 * ProductGrid component props
 */
interface ProductGridProps {
  /** Array of products to display */
  products: ProductWithDetails[];
  /** Whether the component is in loading state */
  isLoading?: boolean;
  /** Error message to display */
  error?: string;
  /** Callback when a product is clicked */
  onProductClick?: (productId: number) => void;
  /** Callback when a product is added to cart */
  onAddToCart?: (productId: number) => void;
  /** Whether to show prices (overrides authentication check) */
  showPrice?: boolean;
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
  /** Whether to enable pagination */
  enablePagination?: boolean;
  /** Number of products per page */
  itemsPerPage?: number;
  /** Custom pagination className */
  paginationClassName?: string;
}

/**
 * ProductGrid component for displaying products in a responsive grid layout
 * Handles loading states, error states, and empty states
 */
export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  isLoading = false,
  error,
  onProductClick,
  onAddToCart,
  showPrice,
  className = '',
  columns = {
    mobile: 1,
    tablet: 2,
    desktop: 3
  },
  showSkeletons = true,
  skeletonCount = 6,
  enablePagination = true,
  itemsPerPage = 15,
  paginationClassName = ''
}) => {
  const { t } = useTranslation();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Pagination calculations
  const paginationData = useMemo(() => {
    if (!enablePagination) {
      return {
        paginatedProducts: products,
        totalPages: 1,
        totalItems: products.length,
        hasNextPage: false,
        hasPreviousPage: false
      };
    }

    const totalItems = products.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedProducts = products.slice(startIndex, endIndex);
    
    return {
      paginatedProducts,
      totalPages,
      totalItems,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1
    };
  }, [products, currentPage, itemsPerPage, enablePagination]);

  // Reset to first page when products change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [products.length]);

  /**
   * Handle page change
   */
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of the grid when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Generate grid column classes based on responsive breakpoints
   */
  const getGridClasses = (): string => {
    const mobileCols = columns.mobile || 1;
    const tabletCols = columns.tablet || 2;
    const desktopCols = columns.desktop || 3;
    
    return `grid grid-cols-${mobileCols} sm:grid-cols-${tabletCols} lg:grid-cols-${desktopCols} gap-4 md:gap-6`;
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
   * Render error state
   */
  const renderError = () => (
    <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-semibold mb-2">Error Loading Products</h3>
      <p className="text-muted-foreground mb-4">
        {error || 'Something went wrong while loading the products.'}
      </p>
      <Button 
        variant="outline" 
        onClick={() => window.location.reload()}
        className="flex items-center gap-2"
      >
        <AlertCircle className="h-4 w-4" />
        Try Again
      </Button>
    </div>
  );

  /**
   * Render empty state
   */
  const renderEmpty = () => (
    <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
      <Package className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No Products Found</h3>
      <p className="text-muted-foreground mb-4">
        {t('products.results.none')}
      </p>
      <Button 
        variant="outline"
        onClick={() => {
          // Reset filters or navigate to all products
          window.location.href = '/products';
        }}
      >
        View All Products
      </Button>
    </div>
  );

  /**
   * Render loading state
   */
  const renderLoading = () => (
    <div className="col-span-full flex items-center justify-center py-8">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>{t('products.loading')}</span>
      </div>
    </div>
  );

  // /**
  //  * Handle product click
  //  */
  // const handleProductClick = (productId: number) => {
  //   onProductClick?.(productId);
  // };

  // /**
  //  * Handle add to cart
  //  */
  // const handleAddToCart = ( productId: number) => {
  //   onAddToCart?.(productId);
  // };

  // /**
  //  * Handle add to wishlist
  //  */
  // const handleAddToWishlist = (product: ProductWithDetails) => {
  //   onAddToWishlist?.(product);
  // };

  return (
    <div className="space-y-6">
      {/* Products Grid */}
      <div className={`${getGridClasses()} ${className}`}>
        {/* Error State */}
        {error && !isLoading && renderError()}
        
        {/* Loading State */}
        {isLoading && !error && (
          <>
            {showSkeletons ? renderSkeletons() : renderLoading()}
          </>
        )}
        
        {/* Empty State */}
        {!isLoading && !error && products.length === 0 && renderEmpty()}
        
        {/* Products Grid */}
        {!isLoading && !error && paginationData.paginatedProducts.length > 0 && (
          <>
            {paginationData.paginatedProducts.map((product) => (
              <ProductCard
                key={product.idProduct}
                product={product}
                showPrice={showPrice}
                className="h-full"
                
              />
            ))}
          </>
        )}
      </div>

      {/* Pagination Controls */}
      {enablePagination && !isLoading && !error && paginationData.totalPages > 1 && (
        <div className={`flex justify-center ${paginationClassName}`}>
          <SimplePagination
            page={currentPage}
            totalPages={paginationData.totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
};

export default ProductGrid;
