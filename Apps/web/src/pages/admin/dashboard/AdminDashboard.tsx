import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { DashboardStatsSection } from "@/pages/admin/dashboard/components/dashboard-stats-section";
import { RecentOrdersSection } from "@/pages/admin/dashboard/components/recent-orders-section";
import { RecentClientsSection } from "@/pages/admin/dashboard/components/recent-clients-section";
import { LowStockAlertSection } from "@/pages/admin/dashboard/components/low-stock-alert-section";
import { PendingOrdersWidget } from "@/pages/admin/dashboard/components/PendingOrdersWidget";
import { PendingRegistrationsWidget } from "@/pages/admin/dashboard/components/PendingRegistrationsWidget";
import { RepairsByStatusWidget } from "@/pages/admin/dashboard/components/RepairsByStatusWidget";
import { DraftSalesByStaffWidget } from "@/pages/admin/dashboard/components/DraftSalesByStaffWidget";
import { useAdminDashboard } from "@/hooks/useStatistics";
import { useNavigate } from "react-router-dom";
import { SectionTitle } from "@/components/shared/SectionTitle";

// ADM-01 — rewired off the Sub-01 stub useDashboardData() (closes the Sprint 3 bridge note) onto
// the real useAdminDashboard(), a single aggregate query (plan.md D10) decomposed into 8
// independently-skeletoned/retryable sections. No more full-page isLoading/error gate — every
// section renders its own skeleton or SectionRetryChip, and the header/layout never unmounts.
export default function AdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useAdminDashboard();
  const isErr = !!isError;

  return (
    <div className="space-y-6" role="main" aria-label={t("admin.dashboard.overview")}>
      <header className="flex items-center justify-between">
        <div>
          <SectionTitle as="h1" id="dashboard-title" className="text-3xl font-bold">
            {t("admin.dashboard.overview")}
          </SectionTitle>
          <p className="text-muted-foreground" id="dashboard-subtitle">
            {t("admin.dashboard.welcome")}
          </p>
        </div>
        <div
          className="flex items-center space-x-2"
          role="toolbar"
          aria-label={t("admin.dashboard.actionsAria")}
        >
          <Button
            aria-label={`${t("common.settings")} page`}
            title={t("common.settings")}
            onClick={() => navigate("/admin/settings")}
          >
            <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
            {t("common.settings")}
          </Button>
        </div>
      </header>

      {/* Stats */}
      <section aria-labelledby="dashboard-title" aria-describedby="dashboard-subtitle">
        <DashboardStatsSection
          stats={data?.stats}
          isLoading={isLoading}
          isError={isErr}
          onRetry={refetch}
        />
      </section>

      {/* Work queues (ADM-01: "Pending online orders ... and Pending registrations ... — the
          two work queues") */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PendingOrdersWidget
          orders={data?.pendingOrders}
          isLoading={isLoading}
          isError={isErr}
          onRetry={refetch}
        />
        <PendingRegistrationsWidget
          clients={data?.pendingClients}
          isLoading={isLoading}
          isError={isErr}
          onRetry={refetch}
        />
      </div>

      {/* Recent activity + low stock */}
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        role="region"
        aria-label={t("admin.dashboard.contentAria")}
      >
        <section className="lg:col-span-2" aria-label={t("admin.dashboard.recentOrdersAria")}>
          <RecentOrdersSection
            orders={data?.recentOrders}
            isLoading={isLoading}
            isError={isErr}
            onRetry={refetch}
          />
        </section>

        <aside className="space-y-6" aria-label={t("admin.dashboard.sidebarAria")}>
          <section aria-label={t("admin.dashboard.lowStockAria")}>
            <LowStockAlertSection
              products={data?.lowStockProducts}
              isLoading={isLoading}
              isError={isErr}
              onRetry={refetch}
            />
          </section>
        </aside>

        <section className="lg:col-span-2" aria-label={t("admin.dashboard.recentClientsAria")}>
          <RecentClientsSection
            clients={data?.recentClients}
            isLoading={isLoading}
            isError={isErr}
            onRetry={refetch}
          />
        </section>
      </div>

      {/* Repairs + draft sales */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RepairsByStatusWidget
          repairsByStatus={data?.repairsByStatus}
          isLoading={isLoading}
          isError={isErr}
          onRetry={refetch}
        />
        <DraftSalesByStaffWidget
          drafts={data?.draftSalesByStaff}
          isLoading={isLoading}
          isError={isErr}
          onRetry={refetch}
        />
      </div>
    </div>
  );
}
