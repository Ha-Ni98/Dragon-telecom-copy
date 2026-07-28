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

// Dumb, props-only (Sprint 4). Sprint 5 wires useMyInvoices() + URL ?page= around this.
// InvoiceSource.REPAIR (S1, D9) added for exhaustiveness — no repair invoice exists yet (S13
// issues the first one), but a client's invoice list must not break the moment one does.
const SOURCE_LABEL_KEY: Record<InvoiceSource, string> = {
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

export function InvoicesTable({
  invoices,
  isLoading = false,
  isError = false,
  onRetry,
  onRowClick,
}: InvoicesTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<InvoiceDto>[]>(
    () => [
      {
        accessorKey: "number",
        header: t("invoices.table.number"),
        cell: ({ row }) => <span className="font-medium text-sm">{row.original.number}</span>,
      },
      {
        accessorKey: "issuedAt",
        header: t("invoices.table.date"),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDateTime(row.original.issuedAt)}
          </span>
        ),
      },
      {
        accessorKey: "sourceType",
        header: t("invoices.table.source"),
        cell: ({ row }) => (
          <span className="text-sm">{t(SOURCE_LABEL_KEY[row.original.sourceType])}</span>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: t("invoices.table.total"),
        cell: ({ row }) => (
          <span className="font-medium text-sm">{formatDZD(row.original.totalAmount)}</span>
        ),
      },
      {
        accessorKey: "paidAmount",
        header: t("orders.paid"),
        cell: ({ row }) => <span className="text-sm">{formatDZD(row.original.paidAmount)}</span>,
      },
      {
        accessorKey: "status",
        header: t("orders.orderStatus"),
        cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} />,
      },
    ],
    [t],
  );

  const renderMobileRow = (invoice: InvoiceDto) => (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{invoice.number}</span>
        <InvoiceStatusBadge status={invoice.status} />
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{formatDateTime(invoice.issuedAt)}</span>
        <span>{t(SOURCE_LABEL_KEY[invoice.sourceType])}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{formatDZD(invoice.totalAmount)}</span>
        <span className="text-muted-foreground">
          {t("orders.paid")}: {formatDZD(invoice.paidAmount)}
        </span>
      </div>
    </div>
  );

  if (isLoading) return <TableSkeleton rows={5} columns={6} />;

  if (isError) {
    return (
      <NotFoundState
        title={t("invoices.errorLoading")}
        body={t("invoices.errorLoadingBody")}
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
          title={t("invoices.empty")}
          body={t("invoices.emptyBody")}
        />
      }
    />
  );
}
