import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { History } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { MovementDirection, type MovementDto } from "@dragon-telecom/contract";
import { useMovements } from "@/hooks/useInventory";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";

// ADM-04 "Movements" tab (§UI: "IN rows show the layer's remaining qty; OUT rows show cost of
// goods + profit; each row links to its source document"). No new endpoint — set-03 A4
// resolution: useMovements({ productId }) already supports this filter.
export function ProductMovementsTab({ productId }: { productId: string }) {
  const { t, language } = useTranslation();
  const { data, isLoading, isError } = useMovements({ productId, page: 1, limit: 20 });

  const columns = useMemo<ColumnDef<MovementDto>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: t("staff.invoices.table.date"),
        cell: ({ row }) => formatDateTime(row.original.createdAt, language),
      },
      { accessorKey: "type", header: t("admin.productsList.table.taxonomy") },
      { accessorKey: "quantity", header: t("staff.orders.table.quantity") },
      {
        id: "detail",
        header: t("admin.productInfo.movements.remainingQty"),
        cell: ({ row }) =>
          row.original.direction === MovementDirection.IN
            ? (row.original.remainingQuantity ?? "—")
            : `${t("admin.productInfo.movements.costOfGoods")}: ${formatDZD(row.original.costOfGoods ?? 0, language)} · ${t("admin.productInfo.movements.profit")}: ${formatDZD(row.original.profit ?? 0, language)}`,
      },
      {
        id: "source",
        header: t("admin.productInfo.movements.sourceDocument"),
        cell: ({ row }) => row.original.referenceLabel,
      },
      { accessorKey: "staffName", header: t("admin.invoices.payments.table.staff") },
    ],
    [t, language],
  );

  if (isLoading) return <TableSkeleton rows={6} columns={6} />;

  if (isError) {
    return <NotFoundState title={t("admin.productInfo.error")} body="" />;
  }

  return (
    <DataTable
      columns={columns}
      data={data?.items ?? []}
      getRowKey={(movement) => movement.id}
      renderMobileRow={(movement) => (
        <div className="space-y-1 p-4 text-sm">
          <div className="font-medium">{movement.referenceLabel}</div>
          <div className="text-muted-foreground">
            {formatDateTime(movement.createdAt, language)}
          </div>
        </div>
      )}
      emptyState={
        <EmptyState
          icon={<History className="h-6 w-6" />}
          title={t("staff.invoices.table.empty")}
          body=""
        />
      }
    />
  );
}
