import { Clock, CheckCircle, Truck } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { StatCardSkeleton } from "@/components/shared/StatCardSkeleton";
import { useTranslation } from "@/hooks/useTranslation";
import type { OrderStatsDto } from "@dragon-telecom/contract";

interface OrderStatsRowProps {
  stats?: OrderStatsDto;
  isLoading?: boolean;
}

// Dumb, props-only (Sprint 4) — Sprint 6 wires useOrderStats(scope) around this.
export function OrderStatsRow({ stats, isLoading }: OrderStatsRowProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        icon={<Clock className="h-5 w-5" />}
        label={t("staff.orders.stats.pending")}
        value={String(stats?.pending ?? 0)}
      />
      <StatCard
        icon={<CheckCircle className="h-5 w-5" />}
        label={t("staff.orders.stats.confirmed")}
        value={String(stats?.confirmed ?? 0)}
      />
      <StatCard
        icon={<Truck className="h-5 w-5" />}
        label={t("staff.orders.stats.inDelivery")}
        value={String(stats?.inDelivery ?? 0)}
      />
    </div>
  );
}
