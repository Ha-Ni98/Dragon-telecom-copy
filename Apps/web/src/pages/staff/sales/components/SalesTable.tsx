import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Receipt } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { Button } from "@/components/ui/button";
import { SaleStatus, type SaleDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";

const STATUS_LABEL_KEY: Record<SaleStatus, string> = {
  [SaleStatus.DRAFT]: "staff.sales.status.draft",
  [SaleStatus.COMPLETED]: "staff.sales.status.completed",
  [SaleStatus.RETURNED]: "orders.returned",
  [SaleStatus.PARTIALLY_RETURNED]: "orders.returned",
  [SaleStatus.CANCELLED]: "orders.cancelled",
};

interface SalesTableProps {
  sales?: SaleDto[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onRowClick?: (sale: SaleDto) => void;
  /** ADM-10 §UI — seller column + footer totals over the filtered set, admin only. */
  scope?: "staff" | "admin";
}

// Dumb, props-only (Sprint 4) — Sprint 6 wires useSales(scope, query) around this.
export function SalesTable({
  sales,
  isLoading,
  isError,
  onRetry,
  onRowClick,
  scope = "staff",
}: SalesTableProps) {
  const { t, language } = useTranslation();

  const columns = useMemo<ColumnDef<SaleDto>[]>(() => {
    const base: ColumnDef<SaleDto>[] = [
      {
        accessorKey: "reference",
        header: t("staff.sales.table.reference"),
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.reference}</span>,
      },
      {
        accessorKey: "soldAt",
        header: t("staff.sales.table.date"),
        cell: ({ row }) =>
          row.original.soldAt ? formatDateTime(row.original.soldAt, language) : "—",
      },
      {
        id: "client",
        header: t("staff.sales.table.client"),
        cell: ({ row }) => row.original.posClientName ?? t("staff.sales.table.counter"),
      },
    ];
    if (scope === "admin") {
      base.push({
        accessorKey: "staffName",
        header: t("admin.sales.table.seller"),
      });
    }
    base.push(
      {
        accessorKey: "totalAmount",
        header: t("staff.sales.table.total"),
        cell: ({ row }) => formatDZD(row.original.totalAmount, language),
      },
      {
        accessorKey: "paidAmount",
        header: t("staff.sales.table.paid"),
        cell: ({ row }) => formatDZD(row.original.paidAmount, language),
      },
      {
        accessorKey: "status",
        header: t("staff.sales.table.status"),
        cell: ({ row }) => t(STATUS_LABEL_KEY[row.original.status]),
      },
    );
    return base;
  }, [t, language, scope]);

  const renderMobileRow = (sale: SaleDto) => (
    <div className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-medium">{sale.reference}</span>
        <span className="font-medium">{formatDZD(sale.totalAmount, language)}</span>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{sale.posClientName ?? t("staff.sales.table.counter")}</span>
        <span>{t(STATUS_LABEL_KEY[sale.status])}</span>
      </div>
    </div>
  );

  // Sprint 8 polish — memoized so the filtered-set sum isn't recomputed on every render.
  const footerTotal = useMemo(
    () =>
      scope === "admin" && sales
        ? sales.reduce((sum, sale) => sum + sale.totalAmount, 0)
        : undefined,
    [scope, sales],
  );

  if (isLoading) return <TableSkeleton rows={8} columns={scope === "admin" ? 7 : 6} />;

  if (isError) {
    return (
      <NotFoundState
        title={t("staff.sales.table.error")}
        body=""
        action={
          onRetry && (
            <Button variant="outline" onClick={onRetry}>
              {t("common.actions.tryAgain")}
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      <DataTable
        columns={columns}
        data={sales ?? []}
        getRowKey={(sale) => sale.id}
        renderMobileRow={renderMobileRow}
        getRowClassName={onRowClick ? () => "cursor-pointer" : undefined}
        onRowClick={onRowClick}
        emptyState={
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title={t("staff.sales.table.empty")}
            body=""
          />
        }
      />
      {footerTotal != null && sales && sales.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3 text-sm font-semibold">
          <span>{t("admin.sales.table.footerTotal")}</span>
          <span>{formatDZD(footerTotal, language)}</span>
        </div>
      )}
    </div>
  );
}
