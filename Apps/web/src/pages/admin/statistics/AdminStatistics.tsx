import { useCallback, useState } from "react";
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
import { generateDateRangeData } from "@/lib/date-utils";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-15 — retyped onto OverviewDto/FilteredDto/ChartPoint[]/TopProductDto (Sprint 3,
// presentational only). Data is local placeholders instead of the incompatible stub hooks
// `use-admin-statistics*` (numeric-id view-models) — Sprint 8 swaps these for
// `useOverview`/`useFiltered`/`useChart`/`useTopProducts`, each independently loaded per widget
// (plan §Page 6 "one widget's error never blanks the others"), at which point this shell needs
// no further prop-shape changes. The URL-synced dateRange/family filter state is a genuine UI
// concern (not DTO-shaped) and is kept as-is.
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

  const updateURLParams = useCallback(
    (dateRange: DateRangeFilter, family: string) => {
      const next = new URLSearchParams(searchParams);
      if (dateRange.type !== "monthly") next.set("dateRange", dateRange.type);
      else next.delete("dateRange");
      if (family !== "all") next.set("family", family);
      else next.delete("family");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleDateRangeChange = useCallback(
    (range: DateRangeFilter) => {
      setSelectedDateRange(range);
      updateURLParams(range, selectedFamily);
    },
    [selectedFamily, updateURLParams],
  );
  const handleFamilyChange = useCallback(
    (family: string) => {
      setSelectedFamily(family);
      updateURLParams(selectedDateRange, family);
    },
    [selectedDateRange, updateURLParams],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.statistics.title")}
        subtitle={t("admin.statistics.description")}
      />

      <AdminStatisticsOverviewCards stats={undefined} loading={false} />

      <AdminStatisticsFilters
        selectedDateRange={selectedDateRange}
        onDateRangeChange={handleDateRangeChange}
        selectedFamily={selectedFamily}
        onFamilyChange={handleFamilyChange}
        families={[]}
      />

      <AdminStatisticsFilteredCards
        stats={undefined}
        periodLabel={selectedDateRange.label}
        loading={false}
      />

      <AdminStatisticsCharts />

      <AdminTopSellingProducts products={[]} loading={false} />
    </div>
  );
}
