import { RevenueChart } from "./charts/revenue-chart";
import { OrdersTrendChart } from "./charts/orders-trend-chart";
import { ClientsChart } from "./charts/clients-chart";
import { SalesByFamilyChart } from "./charts/sales-by-family-chart";
import type { ChartPoint } from "@/services/statistics.service";

interface AdminStatisticsChartsProps {
  revenueData?: ChartPoint[];
  revenueLoading?: boolean;
  ordersData?: ChartPoint[];
  ordersLoading?: boolean;
  clientsData?: ChartPoint[];
  clientsLoading?: boolean;
  salesByFamilyData?: ChartPoint[];
  salesByFamilyLoading?: boolean;
  className?: string;
}

// ADM-15 — retyped: each chart now takes its own `data`/`isLoading` pair (all four share the
// same `ChartPoint[]` shape, per `useChart`), and each fetches/loads independently (plan §Page
// 6 "each widget loads independently... one widget's error never blanks the others") — the old
// config-driven `ChartWrapper` that fanned one shared loading/error prop out to heterogeneous
// chart-specific shapes no longer has a reason to exist.
export function AdminStatisticsCharts({
  revenueData = [],
  revenueLoading = false,
  ordersData = [],
  ordersLoading = false,
  clientsData = [],
  clientsLoading = false,
  salesByFamilyData = [],
  salesByFamilyLoading = false,
  className = "",
}: AdminStatisticsChartsProps) {
  return (
    <div className={`grid grid-cols-1 gap-6 lg:grid-cols-2 ${className}`}>
      <RevenueChart data={revenueData} isLoading={revenueLoading} />
      <OrdersTrendChart data={ordersData} isLoading={ordersLoading} />
      <ClientsChart data={clientsData} isLoading={clientsLoading} />
      <SalesByFamilyChart data={salesByFamilyData} isLoading={salesByFamilyLoading} />
    </div>
  );
}

export default AdminStatisticsCharts;
