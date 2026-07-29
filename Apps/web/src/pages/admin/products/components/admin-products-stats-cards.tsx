import { Package, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { StatCardSkeleton } from "@/components/shared/StatCardSkeleton";
import { useTranslation } from "@/hooks/useTranslation";
import type { ProductStatsDto } from "@dragon-telecom/contract";

interface AdminProductsStatsCardsProps {
  stats?: ProductStatsDto;
  isLoading?: boolean;
}

// Dumb, props-only — set-03 Sprint 5 rewire (was numeric-id AdminProductsStats, arbitrary
// config-array over any DTO shape). ADM-02 §UI names exactly these 4 cards, in this order.
export function AdminProductsStatsCards({ stats, isLoading }: AdminProductsStatsCardsProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<Package className="h-5 w-5" />}
        label={t("admin.productsList.stats.total")}
        value={String(stats?.total ?? 0)}
      />
      <StatCard
        icon={<CheckCircle className="h-5 w-5" />}
        label={t("admin.productsList.stats.inStock")}
        value={String(stats?.inStock ?? 0)}
      />
      <StatCard
        icon={<AlertTriangle className="h-5 w-5" />}
        label={t("admin.productsList.stats.lowStock")}
        value={String(stats?.lowStock ?? 0)}
      />
      <StatCard
        icon={<XCircle className="h-5 w-5" />}
        label={t("admin.productsList.stats.outOfStock")}
        value={String(stats?.outOfStock ?? 0)}
      />
    </div>
  );
}
