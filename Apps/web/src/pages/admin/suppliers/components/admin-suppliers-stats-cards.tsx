import { memo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Truck, DollarSign, FileText, AlertTriangle } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { StatCardSkeleton } from "@/components/shared/StatCardSkeleton";
import type { SupplierStatsDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface AdminSuppliersStatsCardsProps {
  stats?: SupplierStatsDto;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "DZD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

// ADM-07 — retyped off SupplierStatsDto (purchasing.dtos.ts): `{ totalSuppliers, totalCredit,
// totalInvoiced }` — the old stub view-model's `totalDue`/`totalPaid` cards have no DTO
// backing (fix at the presentational layer per Sprint 3 §Risks, not a cast) and are dropped.
export const AdminSuppliersStatsCards = memo(function AdminSuppliersStatsCards({
  stats,
  loading = false,
  error = null,
  onRetry,
  className = "",
}: AdminSuppliersStatsCardsProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-3 ${className}`}>
        {Array.from({ length: 3 }).map((_, index) => (
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
              {t("common.retry")}
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-3 ${className}`}>
      <StatCard
        icon={<Truck className="h-5 w-5" />}
        label={t("admin.suppliers.stats.totalSuppliers")}
        value={formatNumber(stats?.totalSuppliers ?? 0)}
      />
      <StatCard
        icon={<DollarSign className="h-5 w-5" />}
        label={t("admin.suppliers.stats.totalCredit")}
        value={formatCurrency(stats?.totalCredit ?? 0)}
      />
      <StatCard
        icon={<FileText className="h-5 w-5" />}
        label={t("admin.suppliers.stats.totalInvoiced")}
        value={formatCurrency(stats?.totalInvoiced ?? 0)}
      />
    </div>
  );
});

export default AdminSuppliersStatsCards;
