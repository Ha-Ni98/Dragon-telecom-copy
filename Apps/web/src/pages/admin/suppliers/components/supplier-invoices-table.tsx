import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { SupplierInvoiceStatusBadge } from "@/components/shared/StatusBadge";
import { FileText } from "lucide-react";
import type { SupplierInvoiceDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface SupplierInvoicesTableProps {
  invoices: SupplierInvoiceDto[];
  isLoading?: boolean;
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString()} DZD`;
}

// ADM-07 detail — retyped off SupplierInvoiceDto. Read-only here (delete/cancel now belongs to
// ADM-08's editor, plan §Page 3) — each row links to the real invoice editor rather than
// duplicating its mutation UI.
export function SupplierInvoicesTable({ invoices, isLoading = false }: SupplierInvoicesTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<SupplierInvoiceDto>[]>(
    () => [
      {
        accessorKey: "reference",
        header: t("admin.suppliers.invoiceId"),
        cell: ({ row }) => (
          <Link
            to={`/admin/supplier-invoices/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.reference}
          </Link>
        ),
      },
      {
        accessorKey: "invoiceDate",
        header: t("admin.suppliers.date"),
      },
      {
        accessorKey: "totalAmount",
        header: t("admin.suppliers.due"),
        cell: ({ row }) => formatCurrency(row.original.totalAmount),
      },
      {
        accessorKey: "paidAmount",
        header: t("admin.suppliers.paid"),
        cell: ({ row }) => formatCurrency(row.original.paidAmount),
      },
      {
        accessorKey: "status",
        header: t("admin.suppliers.status"),
        cell: ({ row }) => <SupplierInvoiceStatusBadge status={row.original.status} />,
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
      <div className="grid grid-cols-2 gap-2 text-sm">
        <span>{formatCurrency(invoice.totalAmount)}</span>
        <span>{formatCurrency(invoice.paidAmount)}</span>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t("admin.suppliers.invoices")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={3} columns={5} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t("admin.suppliers.invoices")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={invoices}
          getRowKey={(invoice) => invoice.id}
          renderMobileRow={renderMobileRow}
          emptyState={
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={t("admin.suppliers.noInvoices")}
              body={t("admin.suppliers.noInvoicesDescription")}
            />
          }
        />
      </CardContent>
    </Card>
  );
}
