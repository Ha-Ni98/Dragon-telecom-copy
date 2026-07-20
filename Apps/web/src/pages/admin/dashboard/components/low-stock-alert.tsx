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
import type { AdminDashboardDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

// set-02 Sprint 3 retype — was ProductWithStock (draft: productName, brand.brandName,
// stockQuantity, isCritical boolean). AdminDashboardDto['lowStockProducts']
// (DashboardLowStockItemSchema) is {productId, name, availableQuantity, reorderThreshold} — no
// brand, no server-computed isCritical flag. "Critical" is derived here as out-of-stock
// (availableQuantity === 0); everything else in this list is already ≤ reorderThreshold by
// definition (that's why the server put it here), so a finer "Low"/"Warning" split isn't
// meaningful data — collapsed to the two tiers the UI actually distinguishes (critical vs low).
// Also fixes 4 reachable hardcoded English strings ("Critical"/"Low"/"Showing N products…") and
// drops the dead, never-called getStockLevelDescription helper.
type LowStockProduct = AdminDashboardDto["lowStockProducts"][number];

interface LowStockAlertProps {
  products?: LowStockProduct[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRefresh?: () => void;
  showRefresh?: boolean;
  limit?: number;
}

function isCritical(product: LowStockProduct): boolean {
  return product.availableQuantity === 0;
}

function getStockBadgeVariant(product: LowStockProduct) {
  return isCritical(product) ? ("destructive" as const) : ("secondary" as const);
}

function getStockBadgeColor(product: LowStockProduct): string {
  return isCritical(product)
    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
}

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

function StockErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>{error}</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="ml-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("common.retry")}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

function StockEmptyState() {
  const { t } = useTranslation();

  return (
    <div className="text-center py-8">
      <div className="flex flex-col items-center space-y-4">
        <div className="p-4 rounded-full bg-green-50 dark:bg-green-950">
          <Package className="h-8 w-8 text-green-600" />
        </div>
        <div className="text-muted-foreground">
          <p className="text-lg font-medium">{t("admin.dashboard.lowStock.allWellStocked")}</p>
          <p className="text-sm">{t("admin.dashboard.lowStock.noAlerts")}</p>
        </div>
      </div>
    </div>
  );
}

function ProductRow({ product, t }: { product: LowStockProduct; t: (key: string) => string }) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-lg bg-muted">
          <Package className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="font-medium text-sm">{product.name}</p>
      </div>
      <div className="flex items-center space-x-2">
        <Badge variant={getStockBadgeVariant(product)} className={getStockBadgeColor(product)}>
          {product.availableQuantity} {t("admin.dashboard.left")}
        </Badge>
        {isCritical(product) && <AlertTriangle className="h-4 w-4 text-red-500" />}
      </div>
    </div>
  );
}

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

  const header = (showBadges: { criticalCount: number } | null) => (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <AlertTriangle className="h-5 w-5 text-yellow-600" />
        <div>
          <CardTitle className="flex items-center space-x-2">
            <span>{t("admin.dashboard.lowStockAlert")}</span>
            {showBadges && showBadges.criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {t("admin.dashboard.lowStock.criticalCount", { count: showBadges.criticalCount })}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>{t("admin.dashboard.productsRunningLow")}</CardDescription>
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
          <span>{t("common.refresh")}</span>
        </Button>
      )}
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>{header(null)}</CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>{header(null)}</CardHeader>
        <CardContent>
          <StockErrorState error={error} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }

  if (!products || products.length === 0) {
    return (
      <Card>
        <CardHeader>{header(null)}</CardHeader>
        <CardContent>
          <StockEmptyState />
        </CardContent>
      </Card>
    );
  }

  const displayProducts = products.slice(0, limit);
  const criticalCount = displayProducts.filter(isCritical).length;
  const lowCount = displayProducts.length - criticalCount;

  return (
    <Card>
      <CardHeader>{header({ criticalCount })}</CardHeader>
      <CardContent className="space-y-4">
        {displayProducts.map((product) => (
          <ProductRow key={product.productId} product={product} t={t} />
        ))}

        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <TrendingDown className="h-4 w-4" />
              <span>
                {t("admin.dashboard.lowStock.showingCount", { count: displayProducts.length })}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              {criticalCount > 0 && (
                <span className="text-red-600 font-medium">
                  {t("admin.dashboard.lowStock.criticalCount", { count: criticalCount })}
                </span>
              )}
              {lowCount > 0 && (
                <span className="text-yellow-600 font-medium">
                  {t("admin.dashboard.lowStock.lowCount", { count: lowCount })}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
