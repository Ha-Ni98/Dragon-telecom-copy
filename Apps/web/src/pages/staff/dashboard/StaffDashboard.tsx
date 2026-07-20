import { MySalesTodayCard } from "@/pages/staff/dashboard/components/MySalesTodayCard";
import { MyDraftsList } from "@/pages/staff/dashboard/components/MyDraftsList";
import { PendingOrdersWidget } from "@/pages/staff/dashboard/components/PendingOrdersWidget";
import { LowStockAlert } from "@/pages/admin/dashboard/components/low-stock-alert";
import { useStaffDashboard } from "@/hooks/useStatistics";
import { usePermissions } from "@/hooks/usePermissions";
import { useTranslation } from "@/hooks/useTranslation";
import { PageKey } from "@dragon-telecom/contract";

// STF-01 — a single useStaffDashboard() query (plan.md D10), decomposed into 4 independently-
// skeletoned widgets. "Silent-hide on error" (STF-01 §3) means the widget disappears entirely on
// a failed fetch, not that it renders its own visible error state — distinct from ADM-01's 4 new
// widgets, which show a SectionRetryChip instead.
//
// LowStockAlert is reused directly, not a separate "LowStockList" (Sprint 4 finding —
// StaffDashboardDto.lowStock and AdminDashboardDto.lowStockProducts are the same
// DashboardLowStockItemSchema[]).
export default function StaffDashboard() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useStaffDashboard();
  const { data: permissions } = usePermissions();

  // Belt-and-suspenders per plan.md: myPendingOrdersCount is already server-gated on
  // STAFF_ORDERS (statistics.dtos.ts), but the widget is also gated on the frontend's own
  // permission read, in case the two ever diverge (e.g. a permission just revoked while the
  // dashboard query is still cached).
  const hasStaffOrders = permissions?.includes(PageKey.STAFF_ORDERS) ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("staff.dashboard.title")}</h1>
        <p className="text-muted-foreground">{t("staff.dashboard.subtitle")}</p>
      </div>

      {!isError && (
        <MySalesTodayCard
          salesCount={data?.mySalesToday}
          revenue={data?.myRevenueToday}
          isLoading={isLoading}
        />
      )}

      {!isError && hasStaffOrders && (
        <PendingOrdersWidget count={data?.myPendingOrdersCount} isLoading={isLoading} />
      )}

      {!isError && <MyDraftsList drafts={data?.myDrafts} isLoading={isLoading} />}

      {!isError && (
        <LowStockAlert products={data?.lowStock} loading={isLoading} showRefresh={false} />
      )}
    </div>
  );
}
