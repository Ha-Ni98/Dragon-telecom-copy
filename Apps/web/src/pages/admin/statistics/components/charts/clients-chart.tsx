import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Users } from "lucide-react";
import type { ChartPoint } from "@/services/statistics.service";
import { useTranslation } from "@/hooks/useTranslation";
import { useChartTheme } from "@/lib/chart-theme";

interface ClientsChartProps {
  data: ChartPoint[];
  isLoading?: boolean;
  className?: string;
}

// ADM-15 — retyped off `ChartPoint[]` (`useChart(ChartType.CLIENTS, query)`). The old view-
// model's invented growth-rate/current-total stat line has no DTO backing and is dropped
// (Sprint 3 §Risks). S14/RC-5 — colours read from useChartTheme() (literal OKLCH, both themes).
export function ClientsChart({ data, isLoading = false, className = "" }: ClientsChartProps) {
  const { t } = useTranslation();
  const chart = useChartTheme();

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {t("admin.statistics.charts.clients.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TableSkeleton rows={4} columns={1} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title={t("admin.statistics.noData")}
            body=""
          />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: chart.axis }}
                  stroke={chart.grid}
                />
                <YAxis tick={{ fontSize: 12, fill: chart.axis }} stroke={chart.grid} />
                <Tooltip
                  contentStyle={{
                    background: chart.tooltipBg,
                    color: chart.tooltipFg,
                    border: `1px solid ${chart.tooltipBorder}`,
                    borderRadius: 8,
                  }}
                  itemStyle={{ color: chart.tooltipFg }}
                  labelStyle={{ color: chart.tooltipFg }}
                />
                <Line type="monotone" dataKey="value" stroke={chart.series[0]} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
