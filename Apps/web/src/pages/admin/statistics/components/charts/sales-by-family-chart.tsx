import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { PieChart as PieChartIcon } from "lucide-react";
import type { ChartPoint } from "@/services/statistics.service";
import { useTranslation } from "@/hooks/useTranslation";

interface SalesByFamilyChartProps {
  data: ChartPoint[];
  isLoading?: boolean;
  className?: string;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

// ADM-15 — retyped off `ChartPoint[]` (`useChart(ChartType.SALES_BY_FAMILY, query)`). The old
// view-model's top-family/percentage/total-revenue stat rows have no DTO backing (a single
// `{ label, value }` pair per family) and are dropped (Sprint 3 §Risks).
export function SalesByFamilyChart({
  data,
  isLoading = false,
  className = "",
}: SalesByFamilyChartProps) {
  const { t } = useTranslation();

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChartIcon className="h-5 w-5" />
          {t("admin.statistics.charts.salesByFamily.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TableSkeleton rows={4} columns={1} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={<PieChartIcon className="h-6 w-6" />}
            title={t("admin.statistics.noData")}
            body=""
          />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {data.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
