import { useMemo, memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Trophy,
  Medal,
  Award,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import type { TopProductDto } from "@/services/statistics.service";
import { useTranslation } from "@/hooks/useTranslation";

export interface AdminTopSellingProductsProps {
  products: TopProductDto[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  className?: string;
}

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return { icon: Trophy, color: "text-yellow-500", bgColor: "bg-yellow-50 dark:bg-yellow-950" };
    case 2:
      return { icon: Medal, color: "text-gray-400", bgColor: "bg-muted" };
    case 3:
      return { icon: Award, color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-950" };
    default:
      return { icon: TrendingUp, color: "text-primary", bgColor: "bg-primary-light" };
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "DZD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLargeNumber(value: number): string {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
  if (value >= 1000) return (value / 1000).toFixed(1) + "K";
  return value.toString();
}

const ProductCard = memo(function ProductCard({
  product,
  rank,
}: {
  product: TopProductDto;
  rank: number;
}) {
  const { t } = useTranslation();
  const rankIcon = getRankIcon(rank);
  const RankIcon = rankIcon.icon;

  return (
    <Card className="transition-shadow duration-200 hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${rankIcon.bgColor}`}
          >
            <RankIcon className={`h-6 w-6 ${rankIcon.color}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-semibold text-foreground">{product.productName}</h4>
                <p className="text-sm text-muted-foreground">
                  {product.brandName} • {product.familyName}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">
                #{rank}
              </Badge>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <ShoppingCart className="h-3 w-3" />
                  <span>{t("admin.statistics.topProducts.sold")}</span>
                </div>
                <div className="font-medium text-foreground">
                  {formatLargeNumber(product.quantitySold)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  <span>{t("admin.statistics.topProducts.revenue")}</span>
                </div>
                <div className="font-medium text-foreground">{formatCurrency(product.revenue)}</div>
              </div>
            </div>

            <div className="mt-2 border-t border-border pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("admin.statistics.topProducts.averagePrice")}
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

// ADM-15 — retyped off TopProductDto (services/statistics.service.ts — the endpoint has no
// dedicated contract schema, so this locally-declared type IS the source of truth): `productId`
// (was `idProduct`), `quantitySold` (was `totalSold`), no `rank` field on the DTO (rank is the
// row's position in the already-sorted array, derived here via `.map((_, i) => i + 1)`, not
// stored). The old view-model's period-filter buttons/invented aggregate stat line are dropped
// (Sprint 3 §Risks) — `useTopProducts(query)`'s own `period` param drives filtering server-side.
export function AdminTopSellingProducts({
  products,
  loading = false,
  error,
  onRetry,
  className = "",
}: AdminTopSellingProductsProps) {
  const { t } = useTranslation();
  const topTen = useMemo(() => products.slice(0, 10), [products]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {t("admin.statistics.topProducts.title")}
          </CardTitle>
          <CardDescription>{t("admin.statistics.topProducts.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={4} columns={2} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {t("admin.statistics.topProducts.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry} className="ml-4">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("admin.statistics.retry")}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          {t("admin.statistics.topProducts.title")}
        </CardTitle>
        <CardDescription>{t("admin.statistics.topProducts.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {topTen.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-6 w-6" />}
            title={t("admin.statistics.topProducts.noData")}
            body=""
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {topTen.map((product, index) => (
              <ProductCard key={product.productId} product={product} rank={index + 1} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
