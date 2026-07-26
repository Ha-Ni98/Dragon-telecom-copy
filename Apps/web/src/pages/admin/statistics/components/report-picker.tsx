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
import { Input } from "@/components/ui/input";
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

interface ReportPickerProps {
  from?: string;
  to?: string;
  className?: string;
}

// Known drill entities this admin app has a route for — everything else renders as plain
// text (same scope-confinement convention as AdminLogsTable's ENTITY_ROUTES).
const DRILL_ROUTES: Record<string, (id: string) => string> = {
  product: (id) => `/admin/products/${id}`,
  client: (id) => `/admin/clients/${id}`,
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
export function ReportPicker({ from, to, className = "" }: ReportPickerProps) {
  const { t } = useTranslation();
  const [type, setType] = useState<ReportType>(ReportType.SALES_BY_PRODUCT);
  const [groupBy, setGroupBy] = useState("");

  const reportQuery = useMemo(
    () => ({ from, to, groupBy: groupBy.trim() || undefined }),
    [from, to, groupBy],
  );
  const report = useReport(type, reportQuery);
  const exportCsv = useExportReportCsv();

  const rows = useMemo(() => report.data?.rows ?? [], [report.data]);
  const drill = report.data?.drill;

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (rows.length === 0) return [];
    const buildRoute = drill ? DRILL_ROUTES[drill.entity] : undefined;
    return Object.keys(rows[0]).map((key) => ({
      accessorKey: key,
      header: key,
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
  }, [rows, drill]);

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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
            <SelectTrigger>
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
          <Input
            placeholder={t("admin.statistics.reports.groupBy")}
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
          />
        </div>

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
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
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
                      <span className="text-muted-foreground">{key}</span>
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
