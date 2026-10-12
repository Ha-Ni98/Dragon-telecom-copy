import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Wallet } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import type { ClientPaymentDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";

interface ClientPaymentsTableProps {
  payments?: ClientPaymentDto[];
  isLoading?: boolean;
}

// S8 J4 — the client-detail Payments tab. Reuses the existing
// `admin.invoices.payments.table.*` keys PaymentsLedger's client sub-tab already uses, but drops
// the counterpart column (every row on this page is the same client). A refund shows as a
// negative amount (D6) — never `Math.abs`'d. S30 — same document/reversal rendering as
// PaymentsLedger: an invoice-less row names its repair, and a reversal row names the payment it
// reverses (owner decision Q1).
export function ClientPaymentsTable({ payments, isLoading = false }: ClientPaymentsTableProps) {
  const { t, language } = useTranslation();

  const columns = useMemo<ColumnDef<ClientPaymentDto>[]>(
    () => [
      { accessorKey: "reference", header: t("admin.invoices.payments.table.reference") },
      {
        id: "invoice",
        header: t("admin.invoices.payments.table.invoice"),
        cell: ({ row }) =>
          row.original.invoiceNumber ??
          (row.original.repairReference
            ? t("admin.invoices.payments.table.repairRef", {
                reference: row.original.repairReference,
              })
            : t("admin.invoices.payments.table.onAccount")),
      },
      {
        accessorKey: "amount",
        header: t("admin.invoices.payments.table.amount"),
        cell: ({ row }) => (
          <div>
            <div>{formatDZD(row.original.amount, language)}</div>
            {row.original.reversesReference && (
              <div className="text-xs text-muted-foreground">
                {t("admin.invoices.payments.table.reverses", {
                  reference: row.original.reversesReference,
                })}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "creditMovement",
        header: t("admin.invoices.payments.table.creditMovement"),
        cell: ({ row }) =>
          `${formatDZD(row.original.previousCredit, language)} → ${formatDZD(row.original.newCredit, language)}`,
      },
      {
        accessorKey: "paidAt",
        header: t("staff.invoices.table.date"),
        cell: ({ row }) => formatDateTime(row.original.paidAt, language),
      },
      { accessorKey: "staffName", header: t("admin.invoices.payments.table.staff") },
    ],
    [t, language],
  );

  if (isLoading) return <TableSkeleton rows={6} columns={6} />;

  return (
    <DataTable
      columns={columns}
      data={payments ?? []}
      getRowKey={(payment) => payment.reference}
      renderMobileRow={(payment) => (
        <div className="space-y-1 p-4 text-sm">
          <div className="font-medium">{payment.reference}</div>
          <div>{formatDZD(payment.amount, language)}</div>
        </div>
      )}
      emptyState={
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title={t("staff.invoices.table.empty")}
          body=""
        />
      }
    />
  );
}
