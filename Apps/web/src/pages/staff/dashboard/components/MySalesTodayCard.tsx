import { ShoppingBag, Wallet } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { StatCardSkeleton } from "@/components/shared/StatCardSkeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";

// Dumb, props-only (Sprint 4). Sprint 6 wires useStaffDashboard() around this.
interface MySalesTodayCardProps {
  salesCount?: number;
  revenue?: number;
  isLoading?: boolean;
}

export function MySalesTodayCard({
  salesCount,
  revenue,
  isLoading = false,
}: MySalesTodayCardProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <StatCard
        icon={<ShoppingBag className="h-5 w-5" />}
        label={t("staff.dashboard.mySalesToday")}
        value={String(salesCount ?? 0)}
      />
      <StatCard
        icon={<Wallet className="h-5 w-5" />}
        label={t("staff.dashboard.myRevenueToday")}
        value={formatDZD(revenue ?? 0)}
      />
    </div>
  );
}
