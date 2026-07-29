import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Receipt } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { InvoiceStatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { InvoiceSource, type InvoiceDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";

// InvoiceSource.REPAIR (S1, D9) added for exhaustiveness — no repair invoice exists yet (S13
// issues the first one), but the staff/admin invoice list must not break the moment one does.
export const SOURCE_LABEL_KEY: Record<InvoiceSource, string> = {
  [InvoiceSource.SALE]: "invoices.source.sale",
  [InvoiceSource.ORDER]: "invoices.source.order",
  [InvoiceSource.REPAIR]: "invoices.source.repair",
};

interface InvoicesTableProps {
  invoices?: InvoiceDto[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onRowClick?: (invoice: InvoiceDto) => void;
}

// Staff back-office outgoing-invoices table (STF-06, reused unscoped by ADM-14's Outgoing tab).
// Distinct from pages/my-invoices/components/InvoicesTable.tsx (the client's own read-only
// view, no client column) — this one always shows who the invoice is for. Dumb, props-only
// (Sprint 4) — Sprint 6 wires useMyInvoices()/useInvoices('admin', ...) around this.
export function InvoicesTable({
  invoices,
  isLoading,
  isError,
  onRetry,
  onRowClick,
}: InvoicesTableProps) {
  const { t, language } = useTranslation();

  const columns = useMemo<ColumnDef<InvoiceDto>[]>(
    () => [
      {
        accessorKey: "number",
        header: t("staff.invoices.table.number"),
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.number}</span>,
      },
      {
        accessorKey: "issuedAt",
        header: t("staff.invoices.table.date"),
        cell: ({ row }) => formatDateTime(row.original.issuedAt, language),
      },
      {
        accessorKey: "clientNameSnapshot",
        header: t("staff.invoices.table.client"),
      },
      {
        accessorKey: "sourceType",
        header: t("staff.invoices.table.source"),
        cell: ({ row }) => t(SOURCE_LABEL_KEY[row.original.sourceType]),
      },
      {
        accessorKey: "totalAmount",
        header: t("staff.invoices.table.total"),
        cell: ({ row }) => formatDZD(row.original.totalAmount, language),
      },
      {
        accessorKey: "paidAmount",
        header: t("staff.invoices.table.paid"),
        cell: ({ row }) => formatDZD(row.original.paidAmount, language),
      },
      {
        accessorKey: "status",
        header: t("staff.invoices.table.status"),
        cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} />,
      },
    ],
    [t, language],
  );

  const renderMobileRow = (invoice: InvoiceDto) => (
    <div className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{invoice.number}</span>
        <InvoiceStatusBadge status={invoice.status} />
      </div>
      <div className="text-sm text-muted-foreground">{invoice.clientNameSnapshot}</div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{formatDZD(invoice.totalAmount, language)}</span>
        <span className="text-muted-foreground">{formatDateTime(invoice.issuedAt, language)}</span>
      </div>
    </div>
  );

  if (isLoading) return <TableSkeleton rows={8} columns={7} />;

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
      getRowKey={(invoice) => invoice.number}
      renderMobileRow={renderMobileRow}
      getRowClassName={onRowClick ? () => "cursor-pointer" : undefined}
      onRowClick={onRowClick}
      emptyState={
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title={t("staff.invoices.table.empty")}
          body=""
        />
      }
    />
  );
}
