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
import { FileBarChart } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { ReportFormat, ReportType } from "@dragon-telecom/contract";
import { useReport, useExportReport } from "@/hooks/useStatistics";
import { ExportMenu } from "@/components/shared/ExportMenu";
import { useTranslation } from "@/hooks/useTranslation";
import { downloadBlob, formatDZD } from "@/lib/utils";
import type { Language } from "@/lib/i18n";
import { useChartTheme } from "@/lib/chart-theme";
import { REPORT_COLUMN_KEY, REPORT_MONEY_KEYS } from "@/pages/admin/statistics/report-columns";

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

// S24 (A8) — key-aware: money columns render through formatDZD(value, language), matching every
// other money render in the app (was a bare `value.toLocaleString()` with no currency and no
// locale argument, so it silently followed the browser's locale rather than the app's language).
function formatReportValue(key: string, value: unknown, language: Language): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    return REPORT_MONEY_KEYS.has(key) ? formatDZD(value, language) : value.toLocaleString(language);
  }
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
  const { t, language } = useTranslation();
  const chart = useChartTheme();
  const [type, setType] = useState<ReportType>(ReportType.SALES_BY_PRODUCT);

  const reportQuery = useMemo(() => ({ from, to }), [from, to]);
  const report = useReport(type, reportQuery);
  const exportReport = useExportReport();

  const rows = useMemo(() => report.data?.rows ?? [], [report.data]);
  const drill = report.data?.drill;

  // S24 (A9) — client-browsing returns two row shapes ({kind:'search',query,count} and
  // {kind:'viewedNoPurchase',productId,productName,viewCount}). Deriving columns from rows[0]
  // alone rendered whichever shape came first and left the other group's cells blank. Columns are
  // now the union of every row's own keys, first-seen order.
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (rows.length === 0) return [];
    const buildRoute = drill ? DRILL_ROUTES[drill.entity] : undefined;
    const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    return keys.map((key) => ({
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
        return formatReportValue(key, value, language);
      },
    }));
  }, [rows, drill, t, language]);

  const handleExport = (format: ReportFormat.CSV | ReportFormat.PDF) => {
    exportReport.mutate(
      { type, query: reportQuery, format },
      { onSuccess: (blob) => downloadBlob(`${type}.${format}`, blob) },
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
          <ExportMenu
            disabled={rows.length === 0}
            isPending={exportReport.isPending}
            items={[
              {
                key: "csv",
                labelKey: "admin.statistics.reports.exportCsv",
                onSelect: () => handleExport(ReportFormat.CSV),
              },
              {
                key: "pdf",
                labelKey: "admin.statistics.reports.exportPdf",
                onSelect: () => handleExport(ReportFormat.PDF),
              },
            ]}
          />
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

        {/* S24 (A11) — ageing is a point-in-time snapshot (reportAgeing takes no range at all);
            the date filter above this card cannot affect it, which previously went unstated. */}
        {type === ReportType.AGEING && (
          <p className="text-xs text-muted-foreground">
            {t("admin.statistics.reports.ageingSnapshotNote")}
          </p>
        )}

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
                      <span>{formatReportValue(key, value, language)}</span>
                    </div>
                  ))}
                </div>
              )}
            />
            {/* S24 (A4) — every report computes a `totals` object (the repairs report's
                recognizedRevenue/Cost/Profit — its only D8-correct money — chief among them) that
                was never rendered anywhere. */}
            {report.data && Object.keys(report.data.totals).length > 0 && (
              <div className="flex flex-wrap gap-4 border-t pt-4">
                <span className="text-sm font-medium">{t("admin.statistics.reports.totals")}:</span>
                {Object.entries(report.data.totals).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="text-muted-foreground">
                      {t(REPORT_COLUMN_KEY[key] ?? key)}:{" "}
                    </span>
                    <span className="font-medium">{formatReportValue(key, value, language)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ReportPicker;
