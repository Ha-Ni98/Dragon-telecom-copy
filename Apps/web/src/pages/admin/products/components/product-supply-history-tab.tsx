import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Truck } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { useProductSupplyHistory, type ProductSupplyHistoryRow } from "@/hooks/useProductHistory";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";

// ADM-04 "Supply history" tab (§UI: "supplier, qty, unit cost, landed cost, date"). No new
// endpoint — set-03 A4 resolution: SupplierInvoiceListQuery's new `productId` filter (contract),
// flattened to this product's own line per invoice by useProductSupplyHistory.
export function ProductSupplyHistoryTab({ productId }: { productId: string }) {
  const { t, language } = useTranslation();
  const { data, isLoading, isError } = useProductSupplyHistory(productId);

  const columns = useMemo<ColumnDef<ProductSupplyHistoryRow>[]>(
    () => [
      { accessorKey: "supplierName", header: t("admin.invoices.incoming.table.supplier") },
      {
        accessorKey: "date",
        header: t("staff.invoices.table.date"),
        cell: ({ row }) => formatDateTime(row.original.date, language),
      },
      { accessorKey: "quantity", header: t("admin.productInfo.supplyHistory.quantity") },
      {
        accessorKey: "unitCost",
        header: t("admin.productInfo.supplyHistory.unitCost"),
        cell: ({ row }) => formatDZD(row.original.unitCost, language),
      },
      {
        accessorKey: "landedCost",
        header: t("admin.productInfo.supplyHistory.landedCost"),
        cell: ({ row }) => formatDZD(row.original.landedCost, language),
      },
    ],
    [t, language],
  );

  if (isLoading) return <TableSkeleton rows={5} columns={5} />;

  if (isError) {
    return <NotFoundState title={t("admin.productInfo.error")} body="" />;
  }

  return (
    <DataTable
      columns={columns}
      data={data ?? []}
      getRowKey={(row) => `${row.invoiceId}-${row.supplierName}`}
      renderMobileRow={(row) => (
        <div className="space-y-1 p-4 text-sm">
          <div className="font-medium">{row.supplierName}</div>
          <div className="text-muted-foreground">{formatDateTime(row.date, language)}</div>
        </div>
      )}
      emptyState={
        <EmptyState
          icon={<Truck className="h-6 w-6" />}
          title={t("staff.invoices.table.empty")}
          body=""
        />
      }
    />
  );
}
