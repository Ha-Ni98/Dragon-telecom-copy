import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { Package, Download } from "lucide-react";
import type { StockRowDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface StockLevelsTableProps {
  data: StockRowDto[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  lowStockOnly: boolean;
  onLowStockOnlyChange: (value: boolean) => void;
  onExportCsv?: () => void;
}

// ADM-06 Stock levels tab — StockRowDto (inventory.dtos.ts): productId/name/quantityOnHand/
// quantityReserved/availableQuantity/averageCost/stockValue/reorderThreshold/isLow.
export function StockLevelsTable({
  data,
  isLoading = false,
  isError = false,
  onRetry,
  lowStockOnly,
  onLowStockOnlyChange,
  onExportCsv,
}: StockLevelsTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<StockRowDto>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("admin.inventory.stock.table.product"),
        cell: ({ row }) => (
          <span className={row.original.isLow ? "font-medium text-destructive" : "font-medium"}>
            {row.original.name}
          </span>
        ),
      },
      { accessorKey: "quantityOnHand", header: t("admin.inventory.stock.table.quantity") },
      { accessorKey: "quantityReserved", header: t("admin.inventory.reservations.table.quantity") },
      { accessorKey: "availableQuantity", header: t("common.units.inStock") },
      {
        accessorKey: "averageCost",
        header: t("admin.inventory.adjustment.unitCost"),
        cell: ({ row }) => row.original.averageCost.toLocaleString(),
      },
      {
        accessorKey: "isLow",
        header: t("admin.inventory.stock.table.lowStock"),
        cell: ({ row }) =>
          row.original.isLow ? <span className="text-destructive">●</span> : null,
      },
    ],
    [t],
  );

  const renderMobileRow = (row: StockRowDto) => (
    <div className="space-y-1 p-4">
      <div className={row.isLow ? "font-medium text-destructive" : "font-medium"}>{row.name}</div>
      <div className="text-sm text-muted-foreground">
        {row.quantityOnHand} / {row.availableQuantity} {t("common.units.inStock")}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id="low-stock-only"
            checked={lowStockOnly}
            onCheckedChange={onLowStockOnlyChange}
          />
          <Label htmlFor="low-stock-only">{t("admin.inventory.stock.lowStockOnly")}</Label>
        </div>
        {onExportCsv && (
          <Button variant="outline" size="sm" onClick={onExportCsv}>
            <Download className="mr-2 h-4 w-4" />
            {t("admin.inventory.stock.exportCsv")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : isError ? (
        <NotFoundState
          title={t("admin.inventory.error")}
          body=""
          action={
            onRetry && (
              <Button variant="outline" onClick={onRetry}>
                {t("common.actions.tryAgain")}
              </Button>
            )
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          getRowKey={(row) => row.productId}
          renderMobileRow={renderMobileRow}
          emptyState={
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title={t("admin.inventory.stock.empty")}
              body=""
            />
          }
        />
      )}
    </div>
  );
}
