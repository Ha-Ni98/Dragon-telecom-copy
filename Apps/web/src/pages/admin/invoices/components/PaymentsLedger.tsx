import { useMemo } from "react";
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

  const clientColumns = useMemo<ColumnDef<ClientPaymentDto>[]>(
    () => [
      { accessorKey: "reference", header: t("admin.invoices.payments.table.reference") },
      { accessorKey: "posClientName", header: t("admin.invoices.payments.table.counterpart") },
      {
        id: "invoice",
        header: t("admin.invoices.payments.table.invoice"),
        cell: ({ row }) =>
          row.original.invoiceNumber ?? t("admin.invoices.payments.table.onAccount"),
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
