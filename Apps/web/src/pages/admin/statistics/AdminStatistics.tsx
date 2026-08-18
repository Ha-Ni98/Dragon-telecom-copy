import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  AdminStatisticsFilters,
  type DateRangeFilter,
} from "@/pages/admin/statistics/components/admin-statistics-filters";
import { AdminStatisticsOverviewCards } from "@/pages/admin/statistics/components/admin-statistics-overview-cards";
import { AdminStatisticsFilteredCards } from "@/pages/admin/statistics/components/admin-statistics-filtered-cards";
import { AdminStatisticsCharts } from "@/pages/admin/statistics/components/admin-statistics-charts";
import { AdminTopSellingProducts } from "@/pages/admin/products/components/admin-top-selling-products";
import { ReportPicker } from "@/pages/admin/statistics/components/report-picker";
import { generateDateRangeData } from "@/lib/date-utils";
import { ChartType, RevenueSource } from "@dragon-telecom/contract";
import { useOverview, useFiltered, useChart, useTopProducts } from "@/hooks/useStatistics";
import { useCatalogFamilies } from "@/hooks/useCatalogTaxonomy";
import { useTranslation } from "@/hooks/useTranslation";

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ADM-15 — Sprint 8 wiring. Every widget below loads independently (its own hook, its own
// isLoading/isError) so one widget's failure never blanks the others (plan §Page 6). The
// URL-synced dateRange/family filter state predates this sprint (Sprint 3) and is kept as-is —
// it now also drives the `from`/`to`/`familyId` query object shared by useFiltered/useChart.
export default function AdminStatistics() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeFilter>(() => {
    const type = (searchParams.get("dateRange") as DateRangeFilter["type"]) || "monthly";
    return generateDateRangeData(type);
  });
  const [selectedFamily, setSelectedFamily] = useState<string>(
    () => searchParams.get("family") || "all",
  );
  // S24 — revenue-source filter (all / products / repairs), URL-synced like family.
  const [selectedSource, setSelectedSource] = useState<RevenueSource>(
    () => (searchParams.get("source") as RevenueSource | null) || RevenueSource.ALL,
  );

  const filterQuery = useMemo(
    () => ({
      from: toISODate(selectedDateRange.startDate),
      to: toISODate(selectedDateRange.endDate),
      familyId: selectedFamily !== "all" ? selectedFamily : undefined,
      source: selectedSource !== RevenueSource.ALL ? selectedSource : undefined,
    }),
    [selectedDateRange, selectedFamily, selectedSource],
  );

  const overview = useOverview();
  const filtered = useFiltered(filterQuery);
  const revenueChart = useChart(ChartType.REVENUE, filterQuery);
  const ordersChart = useChart(ChartType.ORDERS, filterQuery);
  const clientsChart = useChart(ChartType.CLIENTS, filterQuery);
  const salesByFamilyChart = useChart(ChartType.SALES_BY_FAMILY, filterQuery);
  const topProducts = useTopProducts({});
  const families = useCatalogFamilies({}, false);
  const familyOptions = useMemo(
    () => (families.data ?? []).map((f) => ({ id: f.id, name: f.name })),
    [families.data],
  );

  const updateURLParams = useCallback(
    (dateRange: DateRangeFilter, family: string, source: RevenueSource) => {
      const next = new URLSearchParams(searchParams);
      if (dateRange.type !== "monthly") next.set("dateRange", dateRange.type);
      else next.delete("dateRange");
      if (family !== "all") next.set("family", family);
      else next.delete("family");
      if (source !== RevenueSource.ALL) next.set("source", source);
      else next.delete("source");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleDateRangeChange = useCallback(
    (range: DateRangeFilter) => {
      setSelectedDateRange(range);
      updateURLParams(range, selectedFamily, selectedSource);
    },
    [selectedFamily, selectedSource, updateURLParams],
  );
  const handleFamilyChange = useCallback(
    (family: string) => {
      setSelectedFamily(family);
      updateURLParams(selectedDateRange, family, selectedSource);
    },
    [selectedDateRange, selectedSource, updateURLParams],
  );
  const handleSourceChange = useCallback(
    (source: RevenueSource) => {
      setSelectedSource(source);
      updateURLParams(selectedDateRange, selectedFamily, source);
    },
    [selectedDateRange, selectedFamily, updateURLParams],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.statistics.title")}
        subtitle={t("admin.statistics.description")}
      />

      <AdminStatisticsOverviewCards stats={overview.data} loading={overview.isLoading} />

      <AdminStatisticsFilters
        selectedDateRange={selectedDateRange}
        onDateRangeChange={handleDateRangeChange}
        selectedFamily={selectedFamily}
        onFamilyChange={handleFamilyChange}
        families={familyOptions}
        selectedSource={selectedSource}
        onSourceChange={handleSourceChange}
      />

      <AdminStatisticsFilteredCards
        stats={filtered.data}
        periodLabel={selectedDateRange.label}
        loading={filtered.isLoading}
      />

      <AdminStatisticsCharts
        revenueData={revenueChart.data}
        revenueLoading={revenueChart.isLoading}
        ordersData={ordersChart.data}
        ordersLoading={ordersChart.isLoading}
        clientsData={clientsChart.data}
        clientsLoading={clientsChart.isLoading}
        salesByFamilyData={salesByFamilyChart.data}
        salesByFamilyLoading={salesByFamilyChart.isLoading}
      />

      <div className="space-y-1">
        <AdminTopSellingProducts
          products={topProducts.data ?? []}
          loading={topProducts.isLoading}
          error={topProducts.isError ? t("admin.statistics.error") : undefined}
          onRetry={() => topProducts.refetch()}
        />
        {/* S24 (A12) — TopProductsQuery carries no from/to/familyId/source, so this widget cannot
            follow the date-range/family/source filters above it. Called out explicitly rather
            than left to read as filtered. */}
        <p className="px-1 text-xs text-muted-foreground">
          {t("admin.statistics.topProducts.allTimeNote")}
        </p>
      </div>

      <ReportPicker from={filterQuery.from} to={filterQuery.to} />
    </div>
  );
}
