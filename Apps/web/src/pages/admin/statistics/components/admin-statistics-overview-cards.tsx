/**
 * Admin Statistics Overview Cards Component
 * Displays general statistics in responsive cards with proper formatting
 */

import { DollarSign, TrendingUp, Package, Users, Truck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/StatCard";
import { StatCardSkeleton } from "@/components/shared/StatCardSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import type { OverviewDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface AdminStatisticsOverviewCardsProps {
  stats?: OverviewDto;
  loading?: boolean;
  className?: string;
}

// ADM-15 — retyped off OverviewDto (statistics.dtos.ts): `stockValue` (was the view-model's
// `totalProductValue` — reusing the same translation keys since the copy still describes
// "value of products in stock").
const statsConfig = [
  {
    key: "totalRevenue" as keyof OverviewDto,
    icon: DollarSign,
    labelKey: "admin.statistics.overview.totalRevenue",
    descriptionKey: "admin.statistics.overview.descriptions.totalRevenue",
  },
  {
    key: "totalProfit" as keyof OverviewDto,
    icon: TrendingUp,
    labelKey: "admin.statistics.overview.totalProfit",
    descriptionKey: "admin.statistics.overview.descriptions.totalProfit",
  },
  {
    key: "stockValue" as keyof OverviewDto,
    icon: Package,
    labelKey: "admin.statistics.overview.totalProductValue",
    descriptionKey: "admin.statistics.overview.descriptions.totalProductValue",
  },
  {
    key: "totalClientCredit" as keyof OverviewDto,
    icon: Users,
    labelKey: "admin.statistics.overview.totalClientCredit",
    descriptionKey: "admin.statistics.overview.descriptions.totalClientCredit",
  },
  {
    key: "totalSupplierCredit" as keyof OverviewDto,
    icon: Truck,
    labelKey: "admin.statistics.overview.totalSupplierCredit",
    descriptionKey: "admin.statistics.overview.descriptions.totalSupplierCredit",
  },
];

/**
 * Format currency value with proper localization
 */
function formatCurrency(value: number, locale: string = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "DZD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function AdminStatisticsOverviewCards({
  stats,
  loading = false,
  className = "",
}: AdminStatisticsOverviewCardsProps) {
  const { t } = useTranslation();

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t("admin.statistics.overview")}
          </CardTitle>
          <CardDescription>{t("admin.statistics.overview.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {statsConfig.map((config) => (
              <StatCardSkeleton key={config.key} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (!stats) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t("admin.statistics.overview")}
          </CardTitle>
          <CardDescription>{t("admin.statistics.overview.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<Package className="h-6 w-6" />}
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
          <Package className="h-5 w-5" />
          {t("admin.statistics.overview")}
        </CardTitle>
        <CardDescription>{t("admin.statistics.overview.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {statsConfig.map((config) => {
            const Icon = config.icon;
            return (
              <StatCard
                key={config.key}
                icon={<Icon className="h-5 w-5" />}
                label={t(config.labelKey)}
                value={formatCurrency(stats[config.key])}
                trend={
                  <span className="text-xs text-muted-foreground">{t(config.descriptionKey)}</span>
                }
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default AdminStatisticsOverviewCards;
