/**
 * Low Stock Alert Component
 * Displays 5 products with lowest stock in an alert-style design
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw, Package, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductWithStock } from "@/types/draft-types/dashboard.types";
import { useTranslation } from "@/hooks/useTranslation";

interface LowStockAlertProps {
  /** Low stock products data */
  products?: ProductWithStock[];
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: string | null;
  /** Retry function for error handling */
  onRetry?: () => void;
  /** Refresh function */
  onRefresh?: () => void;
  /** Whether to show refresh button */
  showRefresh?: boolean;
  /** Maximum number of products to display */
  limit?: number;
}

/**
 * Get stock badge variant and color based on stock level
 */
function getStockBadgeVariant(stockQuantity: number, isCritical: boolean) {
  if (isCritical || stockQuantity <= 5) {
    return "destructive" as const;
  } else if (stockQuantity <= 10) {
    return "secondary" as const;
  } else {
    return "outline" as const;
  }
}

/**
 * Get stock badge color class
 */
function getStockBadgeColor(stockQuantity: number, isCritical: boolean) {
  if (isCritical || stockQuantity <= 5) {
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
  } else if (stockQuantity <= 10) {
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
  } else {
    return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
  }
}

/**
 * Get stock level description
 */
function getStockLevelDescription(stockQuantity: number, isCritical: boolean) {
  if (isCritical || stockQuantity <= 5) {
    return "Critical";
  } else if (stockQuantity <= 10) {
    return "Low";
  } else {
    return "Warning";
  }
}

/**
 * Loading skeleton for product cards
 */
function ProductCardSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center space-x-3">
        <Skeleton className="h-8 w-8 rounded" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  );
}

/**
 * Error state component
 */
function StockErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  
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
            {t('common.retry')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Empty state component
 */
function StockEmptyState() {
  const { t } = useTranslation();
  
  return (
    <div className="text-center py-8">
      <div className="flex flex-col items-center space-y-4">
        <div className="p-4 rounded-full bg-green-50 dark:bg-green-950">
          <Package className="h-8 w-8 text-green-600" />
        </div>
        <div className="text-muted-foreground">
          <p className="text-lg font-medium">All products well stocked</p>
          <p className="text-sm">No low stock alerts at this time</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual product card component
 */
function ProductCard({ product, t }: { product: ProductWithStock; t: (key: string) => string }) {
  const stockLevel = getStockLevelDescription(product.stockQuantity, product.isCritical);
  const badgeColor = getStockBadgeColor(product.stockQuantity, product.isCritical);
  
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-lg bg-muted">
          <Package className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-sm">{product.productName}</p>
          <p className="text-xs text-muted-foreground">{product.brand.brandName}</p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Badge 
          variant={getStockBadgeVariant(product.stockQuantity, product.isCritical)}
          className={badgeColor}
        >
          {product.stockQuantity} {t('admin.dashboard.left')}
        </Badge>
        {product.isCritical && (
          <AlertTriangle className="h-4 w-4 text-red-500" />
        )}
      </div>
    </div>
  );
}

/**
 * Main Low Stock Alert Component
 */
export function LowStockAlert({
  products,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = true,
  limit = 5,
}: LowStockAlertProps) {
  const { t } = useTranslation();

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <CardTitle>{t('admin.dashboard.lowStockAlert')}</CardTitle>
                <CardDescription>{t('admin.dashboard.productsRunningLow')}</CardDescription>
              </div>
            </div>
            {showRefresh && onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>{t('common.refresh')}</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <CardTitle>{t('admin.dashboard.lowStockAlert')}</CardTitle>
              <CardDescription>{t('admin.dashboard.productsRunningLow')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <StockErrorState error={error} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!products || products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <CardTitle>{t('admin.dashboard.lowStockAlert')}</CardTitle>
              <CardDescription>{t('admin.dashboard.productsRunningLow')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <StockEmptyState />
        </CardContent>
      </Card>
    );
  }

  // Limit products to specified number
  const displayProducts = products.slice(0, limit);
  
  // Count critical products
  const criticalCount = displayProducts.filter(p => p.isCritical).length;
  const lowCount = displayProducts.filter(p => !p.isCritical && p.stockQuantity <= 10).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <CardTitle className="flex items-center space-x-2">
                <span>{t('admin.dashboard.lowStockAlert')}</span>
                {criticalCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {criticalCount} Critical
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {t('admin.dashboard.productsRunningLow')}
                {criticalCount > 0 && (
                  <span className="text-red-600 font-medium ml-1">
                    ({criticalCount} critical, {lowCount} low)
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
          {showRefresh && onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>{t('common.refresh')}</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayProducts.map((product) => (
          <ProductCard
            key={product.idProduct}
            product={product}
            t={t}
          />
        ))}
        
        {/* Summary footer */}
        {displayProducts.length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <TrendingDown className="h-4 w-4" />
                <span>Showing {displayProducts.length} products with lowest stock</span>
              </div>
              <div className="flex items-center space-x-4">
                {criticalCount > 0 && (
                  <span className="text-red-600 font-medium">
                    {criticalCount} Critical
                  </span>
                )}
                {lowCount > 0 && (
                  <span className="text-yellow-600 font-medium">
                    {lowCount} Low
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
