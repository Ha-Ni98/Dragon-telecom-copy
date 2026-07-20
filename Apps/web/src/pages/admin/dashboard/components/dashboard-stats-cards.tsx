import { Users, Package, ShoppingCart, TrendingUp, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatCard } from "@/components/shared/StatCard";
import { StatCardSkeleton } from "@/components/shared/StatCardSkeleton";
import type { AdminDashboardDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";

// set-02 Sprint 3 retype — was DashboardStats (draft view-model, clientChange/productChange/
// ordersChange/revenueChange). AdminDashboardDto['stats'] names every change field
// `${key}ChangePct`, uniformly. formatCurrency's `Intl.NumberFormat("en-US", {currency:"USD"})`
// was a pre-existing bug (this app is DZD-only everywhere else, e.g. OrderCard/ProductCard) —
// fixed to the shared formatDZD.
type DashboardStats = AdminDashboardDto["stats"];

interface DashboardStatsCardsProps {
  stats?: DashboardStats;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRefresh?: () => void;
  showRefresh?: boolean;
}

const statsConfig = [
  { key: "totalClients" as const, icon: Users, changeKey: "totalClientsChangePct" as const },
  { key: "totalProducts" as const, icon: Package, changeKey: "totalProductsChangePct" as const },
  {
    key: "ordersThisWeek" as const,
    icon: ShoppingCart,
    changeKey: "ordersThisWeekChangePct" as const,
  },
  {
    key: "revenueThisMonth" as const,
    icon: TrendingUp,
    changeKey: "revenueThisMonthChangePct" as const,
  },
];

function formatNumber(value: number): string {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
  if (value >= 1000) return (value / 1000).toFixed(1) + "K";
  return value.toString();
}

function StatsErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="col-span-full">
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
    </div>
  );
}

export function DashboardStatsCards({
  stats,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = true,
}: DashboardStatsCardsProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsConfig.map((config) => (
          <StatCardSkeleton key={config.key} />
        ))}
      </div>
    );
  }

  if (error) {
    return <StatsErrorState error={error} onRetry={onRetry} />;
  }

  if (!stats) {
    return (
      <div className="col-span-full">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{t("admin.dashboard.error")}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showRefresh && onRefresh && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("admin.dashboard.overview")}</h2>
            <p className="text-sm text-muted-foreground">{t("admin.dashboard.welcome")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>{t("common.refresh")}</span>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsConfig.map((config) => {
          const IconComponent = config.icon;
          const value = stats[config.key];
          const change = stats[config.changeKey];
          const isPositive = change >= 0;
          const formattedValue =
            config.key === "revenueThisMonth" ? formatDZD(value) : formatNumber(value);
          return (
            <StatCard
              key={config.key}
              icon={<IconComponent className="h-5 w-5" />}
              label={t(`admin.dashboard.${config.key}`)}
              value={formattedValue}
              trend={
                <span className="flex items-center gap-1 text-xs">
                  <span className={isPositive ? "text-success" : "text-destructive"}>
                    {isPositive ? "↗" : "↘"} {Math.abs(change).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">
                    {t("admin.dashboard.vsPreviousPeriod")}
                  </span>
                </span>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
