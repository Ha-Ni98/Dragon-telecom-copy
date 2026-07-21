import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FileText } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SupplierInvoiceDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";

interface IncomingInvoicesTableProps {
  invoices?: SupplierInvoiceDto[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** Sprint 6 addition — no CRUD/edit affordance on the invoice itself (still "read-only" per
   * ADM-14 §UI), but a row click is the only entry point for "record supplier payment"
   * (acceptance criteria), since this table has no other action column. Every sibling table in
   * this cluster (Orders/Sales/Outgoing invoices) already has onRowClick; this one was the
   * outlier. */
  onRowClick?: (invoice: SupplierInvoiceDto) => void;
}

// Admin-only (ADM-14 §UI: "Incoming: read-only accounting view over supplier invoices" — no
// edit/delete on the invoice, but see onRowClick above). Dumb, props-only (Sprint 4, onRowClick
// added Sprint 6) — Sprint 6 wires usePurchasingInvoices() around this.
export function IncomingInvoicesTable({
  invoices,
  isLoading,
  isError,
  onRetry,
  onRowClick,
}: IncomingInvoicesTableProps) {
  const { t, language } = useTranslation();

  const columns = useMemo<ColumnDef<SupplierInvoiceDto>[]>(
    () => [
      { accessorKey: "supplierName", header: t("admin.invoices.incoming.table.supplier") },
      {
        accessorKey: "invoiceDate",
        header: t("staff.invoices.table.date"),
        cell: ({ row }) => formatDateTime(row.original.invoiceDate, language),
      },
      {
        accessorKey: "totalAmount",
        header: t("admin.invoices.incoming.table.total"),
        cell: ({ row }) => formatDZD(row.original.totalAmount, language),
      },
      {
        accessorKey: "paidAmount",
        header: t("admin.invoices.incoming.table.paid"),
        cell: ({ row }) => formatDZD(row.original.paidAmount, language),
      },
      {
        id: "outstanding",
        header: t("admin.invoices.incoming.table.outstanding"),
        cell: ({ row }) => formatDZD(row.original.totalAmount - row.original.paidAmount, language),
      },
      {
        accessorKey: "dueDate",
        header: t("admin.invoices.incoming.table.dueDate"),
        cell: ({ row }) => {
          const overdue =
            row.original.dueDate != null &&
            new Date(row.original.dueDate).getTime() < Date.now() &&
            row.original.paidAmount < row.original.totalAmount;
          return (
            <div className="flex items-center gap-2">
              {row.original.dueDate ? formatDateTime(row.original.dueDate, language) : "—"}
              {overdue && (
                <Badge variant="destructive">{t("admin.invoices.incoming.table.overdue")}</Badge>
              )}
            </div>
          );
        },
      },
    ],
    [t, language],
  );

  const renderMobileRow = (invoice: SupplierInvoiceDto) => (
    <div className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{invoice.supplierName}</span>
        <span className="font-medium">{formatDZD(invoice.totalAmount, language)}</span>
      </div>
      <div className="text-sm text-muted-foreground">
        {formatDateTime(invoice.invoiceDate, language)}
      </div>
    </div>
  );

  if (isLoading) return <TableSkeleton rows={8} columns={6} />;

  if (isError) {
    return (
      <NotFoundState
        title={t("staff.invoices.table.error")}
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
    <DataTable
      columns={columns}
      data={invoices ?? []}
      getRowKey={(invoice) => invoice.id}
      renderMobileRow={renderMobileRow}
      getRowClassName={onRowClick ? () => "cursor-pointer" : undefined}
      onRowClick={onRowClick}
      emptyState={
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={t("staff.invoices.table.empty")}
          body=""
        />
      }
    />
  );
}
