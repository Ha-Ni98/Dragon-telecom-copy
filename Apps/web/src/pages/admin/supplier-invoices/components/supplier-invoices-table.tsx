import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { Button } from "@/components/ui/button";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { SupplierInvoiceStatusBadge } from "@/components/shared/StatusBadge";
import { FileText, Printer } from "lucide-react";
import type { PaginatedResult, SupplierInvoiceDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDateTime } from "@/lib/utils";

interface SupplierInvoicesTableProps {
  data?: PaginatedResult<SupplierInvoiceDto>;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onPageChange: (page: number) => void;
  /** S26 — the page owns the dialog (the table stays dumb); this only reports which row was
   *  picked. Available on every row regardless of status, exactly like the detail page's own
   *  action — labels are about the goods received, not the money. */
  onPrintBarcodes: (invoice: SupplierInvoiceDto) => void;
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString()} DZD`;
}

// ADM-08 list — SupplierInvoiceDto (purchasing.dtos.ts). Sprint 5 wires `usePurchasingInvoices`.
export function SupplierInvoicesTable({
  data,
  isLoading = false,
  isError = false,
  onRetry,
  onPageChange,
  onPrintBarcodes,
}: SupplierInvoicesTableProps) {
  const { t, language } = useTranslation();
  const invoices = data?.items ?? [];
  const pagination = data?.meta;

  const columns = useMemo<ColumnDef<SupplierInvoiceDto>[]>(
    () => [
      {
        accessorKey: "reference",
        header: t("admin.supplierInvoices.table.reference"),
        cell: ({ row }) => (
          <Link
            to={`/admin/supplier-invoices/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.reference}
          </Link>
        ),
      },
      { accessorKey: "supplierName", header: t("admin.supplierInvoices.table.supplier") },
      {
        accessorKey: "supplierReference",
        header: t("admin.supplierInvoices.table.supplierReference"),
        cell: ({ row }) => row.original.supplierReference ?? "-",
      },
      { accessorKey: "invoiceDate", header: t("admin.supplierInvoices.table.date") },
      {
        accessorKey: "status",
        header: t("admin.supplierInvoices.table.status"),
        cell: ({ row }) => <SupplierInvoiceStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "totalAmount",
        header: t("admin.supplierInvoices.table.amount"),
        cell: ({ row }) => formatCurrency(row.original.totalAmount),
      },
      {
        accessorKey: "paidAmount",
        header: t("admin.supplierInvoices.table.paidAmount"),
        cell: ({ row }) => formatCurrency(row.original.paidAmount),
      },
      {
        accessorKey: "paidDate",
        header: t("admin.supplierInvoices.table.paidDate"),
        cell: ({ row }) =>
          row.original.paidDate ? formatDateTime(row.original.paidDate, language) : "-",
      },
      {
        id: "actions",
        header: t("admin.supplierInvoices.table.actions"),
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPrintBarcodes(row.original)}
            aria-label={t("admin.supplierInvoices.table.printLabels")}
            title={t("admin.supplierInvoices.table.printLabels")}
          >
            <Printer className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [t, language, onPrintBarcodes],
  );

  const renderMobileRow = (invoice: SupplierInvoiceDto) => (
    <div className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <Link
          to={`/admin/supplier-invoices/${invoice.id}`}
          className="font-medium text-primary hover:underline"
        >
          {invoice.reference}
        </Link>
        <SupplierInvoiceStatusBadge status={invoice.status} />
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {invoice.supplierName} · {formatCurrency(invoice.totalAmount)}
        </div>
        <button
          type="button"
          className="text-sm text-primary"
          onClick={() => onPrintBarcodes(invoice)}
        >
          {t("admin.supplierInvoices.table.printLabels")}
        </button>
      </div>
    </div>
  );

  if (isLoading) return <TableSkeleton rows={6} columns={9} />;

  if (isError) {
    return (
      <NotFoundState
        title={t("admin.supplierInvoices.error")}
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
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={invoices}
        getRowKey={(invoice) => invoice.id}
        renderMobileRow={renderMobileRow}
        emptyState={
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title={t("admin.supplierInvoices.empty")}
            body=""
          />
        }
      />
      {pagination && (
        <SimplePagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
