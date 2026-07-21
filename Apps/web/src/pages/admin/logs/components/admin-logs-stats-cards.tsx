import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FileText, RefreshCw, AlertTriangle, Calendar, TrendingUp, Activity } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { StatCardSkeleton } from "@/components/shared/StatCardSkeleton";
import type { LogStatsDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface AdminLogsStatsCardsProps {
  stats?: LogStatsDto;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRefresh?: () => void;
  showRefresh?: boolean;
  className?: string;
}

// ADM-18 — retyped off LogStatsDto (observability.dtos.ts): `{ total, today, week, month }`
// (was `totalLogs`/`logsToday`/`logsThisWeek`/`logsThisMonth`) — field names shortened, existing
// `admin.logs.stats.*` translation keys reused as-is via an explicit labelKey map (not derived
// from the field name anymore, since the names no longer match 1:1).
const statsConfig = [
  { key: "total" as keyof LogStatsDto, icon: FileText, labelKey: "admin.logs.stats.totalLogs" },
  { key: "today" as keyof LogStatsDto, icon: Calendar, labelKey: "admin.logs.stats.logsToday" },
  { key: "week" as keyof LogStatsDto, icon: TrendingUp, labelKey: "admin.logs.stats.logsThisWeek" },
  { key: "month" as keyof LogStatsDto, icon: Activity, labelKey: "admin.logs.stats.logsThisMonth" },
];

function StatsErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>{t("admin.logs.stats.title")}</span>
        </CardTitle>
        <CardDescription>{t("admin.logs.stats.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="ml-2">
                {t("common.retry")}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

export const AdminLogsStatsCards = memo(function AdminLogsStatsCards({
  stats,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = true,
  className = "",
}: AdminLogsStatsCardsProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 ${className}`}>
        {statsConfig.map((config) => (
          <StatCardSkeleton key={config.key} />
        ))}
      </div>
    );
  }

  if (error) {
    return <StatsErrorState error={error} onRetry={onRetry} />;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("admin.logs.stats.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("admin.logs.stats.description")}</p>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsConfig.map((config) => {
          const Icon = config.icon;
          const value = stats?.[config.key] ?? 0;
          return (
            <StatCard
              key={config.key}
              icon={<Icon className="h-5 w-5" />}
              label={t(`${config.labelKey}.title`)}
              value={value.toLocaleString()}
              trend={
                <span className="text-xs text-muted-foreground">
                  {t(`${config.labelKey}.description`)}
                </span>
              }
            />
          );
        })}
      </div>
    </div>
  );
});

export default AdminLogsStatsCards;
