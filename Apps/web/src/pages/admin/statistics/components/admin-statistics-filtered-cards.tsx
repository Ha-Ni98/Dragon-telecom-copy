import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  TrendingDown,
  TrendingUp as TrendingUpIcon,
  Minus,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/StatCard";
import { StatCardSkeleton } from "@/components/shared/StatCardSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import type { FilteredDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface AdminStatisticsFilteredCardsProps {
  stats?: FilteredDto;
  /** The URL-synced date-range's display label — a page-local UI concern, not part of the DTO. */
  periodLabel?: string;
  loading?: boolean;
  className?: string;
}

// ADM-15 — retyped off FilteredDto (statistics.dtos.ts): `{ revenue, profit, orders,
// revenueChangePct, profitChangePct, ordersChangePct }` (was `totalRevenue`/`totalProfit`/
// `totalOrders` + a nested `previousPeriodComparison` object) — flattened `*ChangePct` fields,
// no nesting. The view-model's own `DateRange` formatting is dropped for a plain `periodLabel`
// string (Sprint 8's URL-synced filter bar owns date formatting, not this card).
const filteredStatsConfig = [
  {
    key: "revenue" as const,
    changeKey: "revenueChangePct" as const,
    icon: DollarSign,
    labelKey: "admin.statistics.filtered.revenue",
    descriptionKey: "admin.statistics.filtered.descriptions.totalRevenue",
  },
  {
    key: "profit" as const,
    changeKey: "profitChangePct" as const,
    icon: TrendingUp,
    labelKey: "admin.statistics.filtered.profit",
    descriptionKey: "admin.statistics.filtered.descriptions.totalProfit",
  },
  {
    key: "orders" as const,
    changeKey: "ordersChangePct" as const,
    icon: ShoppingCart,
    labelKey: "admin.statistics.filtered.orders",
    descriptionKey: "admin.statistics.filtered.descriptions.totalOrders",
  },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "DZD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getComparisonIndicator(change: number) {
  if (change === 0)
    return { icon: Minus, bgColor: "bg-gray-50 dark:bg-gray-950", textColor: "text-gray-600" };
  if (change > 0)
    return {
      icon: TrendingUpIcon,
      bgColor: "bg-green-50 dark:bg-green-950",
      textColor: "text-green-600",
    };
  return { icon: TrendingDown, bgColor: "bg-red-50 dark:bg-red-950", textColor: "text-red-600" };
}

export function AdminStatisticsFilteredCards({
  stats,
  periodLabel,
  loading = false,
  className = "",
}: AdminStatisticsFilteredCardsProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t("admin.statistics.filtered.period")}: {t("admin.statistics.loading")}
          </CardTitle>
          <CardDescription>{t("admin.statistics.filtered.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {filteredStatsConfig.map((config) => (
              <StatCardSkeleton key={config.key} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t("admin.statistics.filtered.period")}: {periodLabel ?? ""}
          </CardTitle>
          <CardDescription>{t("admin.statistics.filtered.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<TrendingUp className="h-6 w-6" />}
            title={t("common.errorLoadingData")}
            body={t("admin.statistics.error")}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {t("admin.statistics.filtered.period")}: {periodLabel ?? ""}
        </CardTitle>
        <CardDescription>{t("admin.statistics.filtered.subtitleWithComparison")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {filteredStatsConfig.map((config) => {
            const Icon = config.icon;
            const value = stats[config.key];
            const change = stats[config.changeKey];
            const indicator = getComparisonIndicator(change);
            const ComparisonIcon = indicator.icon;

            return (
              <StatCard
                key={config.key}
                icon={<Icon className="h-5 w-5" />}
                label={t(config.labelKey)}
                value={config.key === "orders" ? value.toString() : formatCurrency(value)}
                trend={
                  <div className="space-y-1">
                    <Badge
                      variant="outline"
                      className={`${indicator.bgColor} ${indicator.textColor} border-0`}
                    >
                      <ComparisonIcon className="mr-1 h-3 w-3" />
                      {change > 0 ? "+" : ""}
                      {change.toFixed(1)}%
                    </Badge>
                    <p className="text-xs text-muted-foreground">{t(config.descriptionKey)}</p>
                  </div>
                }
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default AdminStatisticsFilteredCards;
