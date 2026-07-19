/**
 * Admin Top Selling Products Component
 * Displays best-selling products with rankings and period filtering
 */

import React, { useMemo, useState, memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Trophy, 
  Medal, 
  Award, 
  TrendingUp, 
  DollarSign, 
  ShoppingCart,
  AlertTriangle, 
  RefreshCw,
  Filter,
  Star,
  Eye
} from 'lucide-react';
import { TopSellingProduct, DateRange } from '@/types/draft-types/admin-statistics.types';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Props for the Admin Top Selling Products component
 */
export interface AdminTopSellingProductsProps {
  products: TopSellingProduct[];
  dateRange: DateRange;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Period filter options for top products
 */
const periodFilters = [
  { key: 'all-time', label: 'admin.statistics.topProducts.filters.allTime' },
  { key: 'month', label: 'admin.statistics.topProducts.filters.month' },
  { key: 'custom', label: 'admin.statistics.topProducts.filters.custom' },
];

/**
 * Get rank icon based on position
 */
function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return { icon: Trophy, color: 'text-yellow-500', bgColor: 'bg-yellow-50 dark:bg-yellow-950' };
    case 2:
      return { icon: Medal, color: 'text-gray-400', bgColor: 'bg-gray-50 dark:bg-gray-950' };
    case 3:
      return { icon: Award, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950' };
    default:
      return { icon: TrendingUp, color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950' };
  }
}

/**
 * Format currency value with proper localization
 */
function formatCurrency(value: number, locale: string = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format large numbers with appropriate suffixes
 */
function formatLargeNumber(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  } else if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  return value.toString();
}

/**
 * Individual product card component
 */
interface ProductCardProps {
  product: TopSellingProduct;
  t: (key: string) => string;
}

const ProductCard = memo<ProductCardProps>(({ product, t }) => {
  const rankIcon = getRankIcon(product.rank);
  const RankIcon = rankIcon.icon;

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Rank Badge */}
          <div className={`flex-shrink-0 w-12 h-12 rounded-full ${rankIcon.bgColor} flex items-center justify-center`}>
            <RankIcon className={`h-6 w-6 ${rankIcon.color}`} />
          </div>

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-foreground truncate">
                  {product.productName}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {product.brandName} • {product.familyName}
                </p>
              </div>
              <Badge variant="outline" className="flex-shrink-0">
                #{product.rank}
              </Badge>
            </div>

            {/* Product Stats */}
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <ShoppingCart className="h-3 w-3" />
                  <span>{t('admin.statistics.topProducts.sold')}</span>
                </div>
                <div className="font-medium text-foreground">
                  {formatLargeNumber(product.totalSold)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  <span>{t('admin.statistics.topProducts.revenue')}</span>
                </div>
                <div className="font-medium text-foreground">
                  {formatCurrency(product.revenue)}
                </div>
              </div>
            </div>

            {/* Average Price */}
            <div className="mt-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t('admin.statistics.topProducts.averagePrice')}
                </span>
                <span className="font-medium text-foreground">
                  {formatCurrency(product.averagePrice)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ProductCard.displayName = 'ProductCard';

/**
 * Loading skeleton for top products
 */
function TopProductsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Error state for top products
 */
interface TopProductsErrorProps {
  error: string;
  onRetry?: () => void;
  t: (key: string) => string;
}

function TopProductsError({ error, onRetry, t }: TopProductsErrorProps) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>{error}</span>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="ml-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('admin.statistics.retry')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Admin Top Selling Products Component
 * Displays best-selling products with rankings and period filtering
 */
export const AdminTopSellingProducts = memo<AdminTopSellingProductsProps>(({
  products,
  dateRange,
  loading = false,
  error,
  onRetry,
  className = '',
}) => {
  const { t } = useTranslation();
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all-time');

  // Filter products based on selected period
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    // For now, we'll use all products since the filtering is handled by the data source
    // In a real implementation, you might want to filter based on the selected period
    return products.slice(0, 10); // Show top 10 products
  }, [products, selectedPeriod]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (filteredProducts.length === 0) return null;
    
    const totalSold = filteredProducts.reduce((sum, product) => sum + product.totalSold, 0);
    const totalRevenue = filteredProducts.reduce((sum, product) => sum + product.revenue, 0);
    const averagePrice = filteredProducts.reduce((sum, product) => sum + product.averagePrice, 0) / filteredProducts.length;
    const topProduct = filteredProducts[0];
    
    return {
      totalSold,
      totalRevenue,
      averagePrice,
      topProduct,
      productCount: filteredProducts.length,
    };
  }, [filteredProducts]);

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {t('admin.statistics.topProducts.title')}
          </CardTitle>
          <CardDescription>
            {t('admin.statistics.topProducts.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TopProductsSkeleton />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {t('admin.statistics.topProducts.title')}
          </CardTitle>
          <CardDescription>
            {t('admin.statistics.topProducts.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TopProductsError 
            error={error}
            onRetry={onRetry}
            t={t}
          />
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!filteredProducts || filteredProducts.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {t('admin.statistics.topProducts.title')}
          </CardTitle>
          <CardDescription>
            {t('admin.statistics.topProducts.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('admin.statistics.topProducts.noData')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {t('admin.statistics.topProducts.title')}
            </CardTitle>
            <CardDescription>
              {t('admin.statistics.topProducts.description')}
            </CardDescription>
          </div>
          {stats && (
            <div className="text-right text-sm text-muted-foreground">
              <div>{t('admin.statistics.topProducts.totalSold')}: {formatLargeNumber(stats.totalSold)}</div>
              <div>{t('admin.statistics.topProducts.totalRevenue')}: {formatCurrency(stats.totalRevenue)}</div>
              <div>{t('admin.statistics.topProducts.topProduct')}: {stats.topProduct.productName}</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Period Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {periodFilters.map((filter) => (
            <Button
              key={filter.key}
              variant={selectedPeriod === filter.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod(filter.key)}
              className="flex items-center gap-2"
            >
              <Filter className="h-3 w-3" />
              {t(filter.label)}
            </Button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.idProduct}
              product={product}
              t={t}
            />
          ))}
        </div>

        {/* View All Button */}
        <div className="mt-6 text-center">
          <Button variant="outline" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            {t('admin.statistics.topProducts.viewAll')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

AdminTopSellingProducts.displayName = 'AdminTopSellingProducts';
