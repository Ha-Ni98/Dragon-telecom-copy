import { useCallback, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Wallet } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import type { ClientPaymentDto, SupplierPaymentDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";

interface PaymentsLedgerProps {
  clientPayments?: ClientPaymentDto[];
  isClientLoading?: boolean;
  supplierPayments?: SupplierPaymentDto[];
  isSupplierLoading?: boolean;
}

// Admin-only, two ledgers (ADM-14 §UI). Dumb, props-only (Sprint 4) — Sprint 6 wires
// useClientPayments()/usePurchasingPayments() around this.
export function PaymentsLedger({
  clientPayments,
  isClientLoading,
  supplierPayments,
  isSupplierLoading,
}: PaymentsLedgerProps) {
  const { t, language } = useTranslation();

  // S30 — a row with no invoice yet (a repair's on-account payment, or its refund on
  // cancellation) names its repair instead of a bare "On account"; a reversal row (Q1) also
  // names the payment it reverses, so what was taken and what was returned read side by side.
  const clientPaymentDocument = useCallback(
    (payment: ClientPaymentDto) =>
      payment.invoiceNumber ??
      (payment.repairReference
        ? t("admin.invoices.payments.table.repairRef", { reference: payment.repairReference })
        : t("admin.invoices.payments.table.onAccount")),
    [t],
  );
  const clientPaymentAmount = useCallback(
    (payment: ClientPaymentDto) => (
      <div>
        <div>{formatDZD(payment.amount, language)}</div>
        {payment.reversesReference && (
          <div className="text-xs text-muted-foreground">
            {t("admin.invoices.payments.table.reverses", { reference: payment.reversesReference })}
          </div>
        )}
      </div>
    ),
    [t, language],
  );

  const clientColumns = useMemo<ColumnDef<ClientPaymentDto>[]>(
    () => [
      { accessorKey: "reference", header: t("admin.invoices.payments.table.reference") },
      { accessorKey: "posClientName", header: t("admin.invoices.payments.table.counterpart") },
      {
        id: "invoice",
        header: t("admin.invoices.payments.table.invoice"),
        cell: ({ row }) => clientPaymentDocument(row.original),
      },
      {
        accessorKey: "amount",
        header: t("admin.invoices.payments.table.amount"),
        cell: ({ row }) => clientPaymentAmount(row.original),
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
    [t, language, clientPaymentDocument, clientPaymentAmount],
  );

  const supplierColumns = useMemo<ColumnDef<SupplierPaymentDto>[]>(
    () => [
      { accessorKey: "reference", header: t("admin.invoices.payments.table.reference") },
      { accessorKey: "supplierName", header: t("admin.invoices.payments.table.counterpart") },
      {
        id: "invoice",
        header: t("admin.invoices.payments.table.invoice"),
        cell: ({ row }) =>
          row.original.supplierInvoiceReference ?? t("admin.invoices.payments.table.onAccount"),
      },
      {
        accessorKey: "amount",
        header: t("admin.invoices.payments.table.amount"),
        cell: ({ row }) => formatDZD(row.original.amount, language),
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

  return (
    <Tabs defaultValue="client">
      <TabsList>
        <TabsTrigger value="client">{t("admin.invoices.payments.tabs.client")}</TabsTrigger>
        <TabsTrigger value="supplier">{t("admin.invoices.payments.tabs.supplier")}</TabsTrigger>
      </TabsList>
      <TabsContent value="client">
        {isClientLoading ? (
          <TableSkeleton rows={6} columns={7} />
        ) : (
          <DataTable
            columns={clientColumns}
            data={clientPayments ?? []}
            getRowKey={(payment) => payment.reference}
            renderMobileRow={(payment) => (
              <div className="space-y-1 p-4 text-sm">
                <div className="font-medium">{payment.posClientName}</div>
                <div className="text-muted-foreground">{clientPaymentDocument(payment)}</div>
                {clientPaymentAmount(payment)}
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
        )}
      </TabsContent>
      <TabsContent value="supplier">
        {isSupplierLoading ? (
          <TableSkeleton rows={6} columns={7} />
        ) : (
          <DataTable
            columns={supplierColumns}
            data={supplierPayments ?? []}
            getRowKey={(payment) => payment.reference}
            renderMobileRow={(payment) => (
              <div className="space-y-1 p-4 text-sm">
                <div className="font-medium">{payment.supplierName}</div>
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
        )}
      </TabsContent>
    </Tabs>
  );
}
