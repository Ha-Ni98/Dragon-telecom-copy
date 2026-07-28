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
import { TrendingUp } from "lucide-react";
import type { ChartPoint } from "@/services/statistics.service";
import { useTranslation } from "@/hooks/useTranslation";
import { useChartTheme } from "@/lib/chart-theme";

interface RevenueChartProps {
  data: ChartPoint[];
  isLoading?: boolean;
  className?: string;
}

// ADM-15 — retyped off `ChartPoint[]` (`useChart(ChartType.REVENUE, query)`), the contract's
// only shape for this endpoint (`{ label, value }[]`, reused from `ReportDto.chart` — no
// dedicated schema exists). The old view-model's per-point `date`/`family` fields and the
// invented total/average stat line have no DTO backing and are dropped (Sprint 3 §Risks).
// S14/RC-5 — colours read from useChartTheme() (literal OKLCH, both themes), not
// `hsl(var(--primary))`, which never resolved to a real colour on this project's token format.
export function RevenueChart({ data, isLoading = false, className = "" }: RevenueChartProps) {
  const { t } = useTranslation();
  const chart = useChartTheme();

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {t("admin.statistics.charts.revenue.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TableSkeleton rows={4} columns={1} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="h-6 w-6" />}
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
