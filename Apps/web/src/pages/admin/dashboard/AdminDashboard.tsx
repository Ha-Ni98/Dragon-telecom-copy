import { Settings, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { DashboardStatsSection } from "@/pages/admin/dashboard/components/dashboard-stats-section";
import { RecentOrdersSection } from "@/pages/admin/dashboard/components/recent-orders-section";
import { RecentClientsSection } from "@/pages/admin/dashboard/components/recent-clients-section";
import { LowStockAlertSection } from "@/pages/admin/dashboard/components/low-stock-alert-section";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AdminRoutes } from "@/types/draft-types/routes";

/**
 * Admin Dashboard Page
 * Main dashboard page integrating all dashboard components
 */
export default function AdminDashboard() {
  const { t } = useTranslation();
  const { data: dashboardData, isLoading, error, refetch } = useDashboardData();
  const navigate = useNavigate();
  // Handle refresh functionality
  const handleRefresh = () => {
    refetch();
  };

  // Loading state for entire dashboard
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="p-6 border rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </div>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Content Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="p-6 border rounded-lg">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div>
            <div className="p-6 border rounded-lg">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-6 w-12" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state for entire dashboard
  if (error) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("admin.dashboard.overview")}</h1>
            <p className="text-muted-foreground">{t("admin.dashboard.welcome")}</p>
          </div>
          <Button onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("common.refresh")}
          </Button>
        </div>

        {/* Error Alert */}
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{t("admin.dashboard.error")}</span>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="ml-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t("common.retry")}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label={t("admin.dashboard.overview")}>
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" id="dashboard-title">
            {t("admin.dashboard.overview")}
          </h1>
          <p className="text-muted-foreground" id="dashboard-subtitle">
            {t("admin.dashboard.welcome")}
          </p>
        </div>
        <div
          className="flex items-center space-x-2"
          role="toolbar"
          aria-label={t("admin.dashboard.actionsAria")}
        >
          {/* <Button 
            variant="outline" 
            onClick={handleRefresh}
            aria-label={`${t('common.refresh')} dashboard data`}
            title={t('common.refresh')}
          >
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
            {t('common.refresh')}
          </Button> */}
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

      {/*
        set-02 Sprint 3: the 4 sections below were retyped off their own independent stub
        hooks onto AdminDashboardDto-shaped props (plan.md D10 — one aggregate query, not N).
        This page still calls the OLD combined useDashboardData() stub above purely for its own
        full-page gate, and its DashboardData shape (numeric idOrder, pre-formatted date
        strings, no client uuid) can't be honestly field-mapped onto the real DTO's shape
        (uuid ids, ISO datetimes) without fabricating data. Rather than a lossy fake adapter,
        this passes only what's genuinely accurate (the page's own loading/error state) and
        leaves the data props unset — each section's own "no data" fallback renders instead of
        a crash. Sprint 6 replaces useDashboardData() with the real useAdminDashboard() and
        threads its actual slices through; this is the one open item that sprint resolves.
      */}
      {/* Dashboard Statistics */}
      <section aria-labelledby="dashboard-title" aria-describedby="dashboard-subtitle">
        <DashboardStatsSection isLoading={isLoading} isError={!!error} />
      </section>

      {/* Main Content Grid */}
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        role="region"
        aria-label={t("admin.dashboard.contentAria")}
      >
        {/* Recent Orders - Takes 2 columns on large screens */}
        <section className="lg:col-span-2" aria-label={t("admin.dashboard.recentOrdersAria")}>
          <RecentOrdersSection isLoading={isLoading} isError={!!error} />
        </section>

        {/* Low Stock Alert */}
        {/* Right Column - Recent Clients and Low Stock Alert */}
        <aside className="space-y-6" aria-label={t("admin.dashboard.sidebarAria")}>
          <section aria-label={t("admin.dashboard.lowStockAria")}>
            <LowStockAlertSection isLoading={isLoading} isError={!!error} />
          </section>
        </aside>

        {/* Recent Clients */}
        <section className="lg:col-span-2" aria-label={t("admin.dashboard.recentClientsAria")}>
          <RecentClientsSection isLoading={isLoading} isError={!!error} />
        </section>
      </div>
    </div>
  );
}
