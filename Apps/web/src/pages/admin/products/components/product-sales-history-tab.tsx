import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Receipt } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import type { MovementDto } from "@dragon-telecom/contract";
import { useProductSalesHistory } from "@/hooks/useProductHistory";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";

// ADM-04 "Sales history" tab (§UI: "date, document, qty, resolved vs charged, profit"). No new
// endpoint — set-03 A4 resolution: useMovements' OUT rows via useProductSalesHistory.
//
// Known residual gap (flagged in Sprint 2's report, not fixed here): MovementDto carries
// costOfGoods/profit for OUT rows but no resolved-vs-charged price pair — that lives on the
// originating Sale/Order line, not the movement itself. This tab renders cost + profit (what
// the DTO has) instead of resolved-vs-charged; joining back to the source sale/order per row
// is a separate follow-up, not part of this sprint's scope.
export function ProductSalesHistoryTab({ productId }: { productId: string }) {
  const { t, language } = useTranslation();
  const { data, isLoading, isError } = useProductSalesHistory(productId);

  const columns = useMemo<ColumnDef<MovementDto>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: t("staff.invoices.table.date"),
        cell: ({ row }) => formatDateTime(row.original.createdAt, language),
      },
      {
        id: "document",
        header: t("admin.productInfo.salesHistory.document"),
        cell: ({ row }) => row.original.referenceLabel,
      },
      { accessorKey: "quantity", header: t("staff.orders.table.quantity") },
      {
        accessorKey: "costOfGoods",
        header: t("admin.productInfo.movements.costOfGoods"),
        cell: ({ row }) => formatDZD(row.original.costOfGoods ?? 0, language),
      },
      {
        accessorKey: "profit",
        header: t("admin.productInfo.movements.profit"),
        cell: ({ row }) => formatDZD(row.original.profit ?? 0, language),
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
          icon={<Receipt className="h-6 w-6" />}
          title={t("staff.invoices.table.empty")}
          body=""
        />
      }
    />
  );
}
