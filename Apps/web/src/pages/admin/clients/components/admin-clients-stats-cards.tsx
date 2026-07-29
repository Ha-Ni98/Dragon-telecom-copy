import { memo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, Clock, UserPlus, RefreshCw, AlertTriangle } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { StatCardSkeleton } from "@/components/shared/StatCardSkeleton";
import type { ClientStatsDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface AdminClientsStatsCardsProps {
  stats?: ClientStatsDto;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

// ADM-12 — retyped off ClientStatsDto (clients.dtos.ts, gap A2): `{ totalClients, pending,
// approved, rejected, newThisMonth }`. `total`/`pendingApprovals`/`newThisMonth` map cleanly;
// the 3rd card relabels "active" → `approved` (plan §A2) since there's no separate "active"
// counter. The old view-model's `averageOrdersPerClient` has no DTO field and is dropped.
export const AdminClientsStatsCards = memo(function AdminClientsStatsCards({
  stats,
  loading = false,
  error = null,
  onRetry,
  className = "",
}: AdminClientsStatsCardsProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
        {Array.from({ length: 4 }).map((_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("common.retry")}
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
      <StatCard
        icon={<Users className="h-5 w-5" />}
        label={t("admin.clients.totalClients")}
        value={formatNumber(stats?.totalClients ?? 0)}
      />
      <StatCard
        icon={<Clock className="h-5 w-5" />}
        label={t("admin.clients.pending")}
        value={formatNumber(stats?.pending ?? 0)}
      />
      <StatCard
        icon={<UserCheck className="h-5 w-5" />}
        label={t("admin.clients.activeClients")}
        value={formatNumber(stats?.approved ?? 0)}
      />
      <StatCard
        icon={<UserPlus className="h-5 w-5" />}
        label={t("admin.clients.newThisMonth")}
        value={formatNumber(stats?.newThisMonth ?? 0)}
      />
    </div>
  );
});

export default AdminClientsStatsCards;
