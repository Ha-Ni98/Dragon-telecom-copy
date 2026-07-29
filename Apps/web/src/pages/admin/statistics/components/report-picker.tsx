import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { FileBarChart, Download } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { ReportType } from "@dragon-telecom/contract";
import { useReport, useExportReportCsv } from "@/hooks/useStatistics";
import { useTranslation } from "@/hooks/useTranslation";
import { downloadBlob } from "@/lib/utils";
import { useChartTheme } from "@/lib/chart-theme";
import { REPORT_COLUMN_KEY } from "@/pages/admin/statistics/report-columns";

interface ReportPickerProps {
  from?: string;
  to?: string;
  className?: string;
}

// S14/F3 — known drill entities this admin app has a route for. The service also emits
// `posClient`/`clientCategory`/`staff`/`stockMovement`/`repair`/`invoice` as drill entities;
// none of those have a per-record admin detail route, so they render as plain text (same
// scope-confinement convention as AdminLogsTable's ENTITY_ROUTES). `client` was removed — no
// report ever actually emits it (the service emits `posClient`), so the entry was dead.
const DRILL_ROUTES: Record<string, (id: string) => string> = {
  product: (id) => `/admin/products/${id}`,
  supplier: (id) => `/admin/suppliers/${id}`,
};

const REPORT_TYPES = Object.values(ReportType);

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

// ADM-15 — new (Sprint 8): one report at a time (chart + table + CSV), independent of the
// overview/filtered/charts widgets above it — its own `useReport`/`useExportReportCsv` calls,
// its own loading/error state, so a report failure never blanks the rest of the page.
// S14/F2 — the `groupBy` text input is gone: ReportQuery.groupBy was validated by the backend
// but never read by any report method, so the box did nothing. Removed from the UI only —
// the contract schema and service signature are untouched (same "remove from the UI only"
// precedent S7 applied to save-draft).
export function ReportPicker({ from, to, className = "" }: ReportPickerProps) {
  const { t } = useTranslation();
  const chart = useChartTheme();
  const [type, setType] = useState<ReportType>(ReportType.SALES_BY_PRODUCT);

  const reportQuery = useMemo(() => ({ from, to }), [from, to]);
  const report = useReport(type, reportQuery);
  const exportCsv = useExportReportCsv();

  const rows = useMemo(() => report.data?.rows ?? [], [report.data]);
  const drill = report.data?.drill;

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (rows.length === 0) return [];
    const buildRoute = drill ? DRILL_ROUTES[drill.entity] : undefined;
    return Object.keys(rows[0]).map((key) => ({
      accessorKey: key,
      header: t(REPORT_COLUMN_KEY[key] ?? key),
      cell: ({ row }) => {
        const value = row.original[key];
        if (drill && key === drill.idField && buildRoute && typeof value === "string") {
          return (
            <Link to={buildRoute(value)} className="text-primary hover:underline">
              {value}
            </Link>
          );
        }
        return formatCellValue(value);
      },
    }));
  }, [rows, drill, t]);

  const handleExport = () => {
    exportCsv.mutate(
      { type, query: reportQuery },
      { onSuccess: (blob) => downloadBlob(`${type}.csv`, blob) },
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileBarChart className="h-5 w-5" />
              {t("admin.statistics.reports.title")}
            </CardTitle>
            <CardDescription>{t("admin.statistics.reports.description")}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exportCsv.isPending || rows.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            {t("admin.statistics.reports.exportCsv")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
          <SelectTrigger className="w-full md:w-72">
            <SelectValue placeholder={t("admin.statistics.reports.selectType")} />
          </SelectTrigger>
          <SelectContent>
            {REPORT_TYPES.map((reportType) => (
              <SelectItem key={reportType} value={reportType}>
                {t(`admin.statistics.reports.types.${reportType}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {report.isLoading ? (
          <TableSkeleton rows={5} columns={4} />
        ) : report.isError ? (
          <NotFoundState
            icon={<FileBarChart className="h-6 w-6" />}
            title={t("admin.statistics.reports.error")}
            body={t("admin.statistics.error")}
            action={
              <Button variant="outline" size="sm" onClick={() => report.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileBarChart className="h-6 w-6" />}
            title={t("admin.statistics.reports.empty")}
            body=""
          />
        ) : (
          <div className="space-y-4">
            {report.data && report.data.chart.length > 0 && (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.data.chart}>
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
                    <Bar dataKey="value" fill={chart.series[0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <DataTable
              columns={columns}
              data={rows}
              getRowKey={(row) =>
                drill && row[drill.idField] ? String(row[drill.idField]) : JSON.stringify(row)
              }
              renderMobileRow={(row) => (
                <div className="space-y-1 p-4 text-sm">
                  {Object.entries(row).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        {t(REPORT_COLUMN_KEY[key] ?? key)}
                      </span>
                      <span>{formatCellValue(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ReportPicker;
