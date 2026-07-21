import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { SupplierInvoiceStatusBadge } from "@/components/shared/StatusBadge";
import { FileText } from "lucide-react";
import type { PaginatedResult, SupplierInvoiceDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface SupplierInvoicesTableProps {
  data?: PaginatedResult<SupplierInvoiceDto>;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString()} DZD`;
}

// ADM-08 list — SupplierInvoiceDto (purchasing.dtos.ts). Sprint 5 wires `usePurchasingInvoices`.
export function SupplierInvoicesTable({
  data,
  isLoading = false,
  onPageChange,
}: SupplierInvoicesTableProps) {
  const { t } = useTranslation();
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
    ],
    [t],
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
      <div className="text-sm text-muted-foreground">
        {invoice.supplierName} · {formatCurrency(invoice.totalAmount)}
      </div>
    </div>
  );

  if (isLoading) return <TableSkeleton rows={6} columns={5} />;

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
