import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { ExportMenu } from "@/components/shared/ExportMenu";
import { Package, Search, SlidersHorizontal } from "lucide-react";
import type { StockRowDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";

interface StockLevelsTableProps {
  data: StockRowDto[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  lowStockOnly: boolean;
  onLowStockOnlyChange: (value: boolean) => void;
  onExport?: (format: "csv" | "pdf") => void;
  isExporting?: boolean;
  /** S28 — opens the per-product Adjust dialog (stock-adjust-dialog.tsx). Optional so the
   *  component still renders without it (and the Actions column is simply omitted). */
  onAdjust?: (row: StockRowDto) => void;
}

// ADM-06 Stock levels tab — StockRowDto (inventory.dtos.ts): productId/name/quantityOnHand/
// quantityReserved/availableQuantity/avgStockPrice/stockValue/reorderThreshold/isLow. Search is
// server-side (StockQuery.search, S4) — this component only renders the controlled input; the page
// owns the debounce. `stockValue` is on-hand × avgStockPrice (D10) and is what the "Total cost"
// column shows.
//
// S28 — the table is now server-paginated (the page owns page/limit and renders
// SimplePagination below it; this component still renders only the rows it is given). The
// Adjust action opens a dialog — it must not navigate to the Adjustments tab.
export function StockLevelsTable({
  data,
  isLoading = false,
  isError = false,
  onRetry,
  search,
  onSearchChange,
  lowStockOnly,
  onLowStockOnlyChange,
  onExport,
  isExporting,
  onAdjust,
}: StockLevelsTableProps) {
  const { t, language } = useTranslation();

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
      {
        accessorKey: "quantityReserved",
        header: t("admin.inventory.stock.table.reservedQuantity"),
      },
      {
        accessorKey: "availableQuantity",
        header: t("admin.inventory.stock.table.availableQuantity"),
      },
      {
        accessorKey: "avgStockPrice",
        header: t("admin.inventory.stock.table.avgStockPrice"),
        cell: ({ row }) => formatDZD(row.original.avgStockPrice, language),
      },
      {
        accessorKey: "stockValue",
        header: t("admin.inventory.stock.table.totalCost"),
        cell: ({ row }) => formatDZD(row.original.stockValue, language),
      },
      {
        accessorKey: "isLow",
        header: t("admin.inventory.stock.table.lowStock"),
        cell: ({ row }) =>
          row.original.isLow ? <span className="text-destructive">●</span> : null,
      },
      ...(onAdjust
        ? [
            {
              id: "adjust",
              header: t("admin.inventory.stock.table.actions"),
              cell: ({ row }) => (
                <Button variant="outline" size="sm" onClick={() => onAdjust(row.original)}>
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  {t("admin.inventory.stock.adjust")}
                </Button>
              ),
            } satisfies ColumnDef<StockRowDto>,
          ]
        : []),
    ],
    [t, language, onAdjust],
  );

  const renderMobileRow = (row: StockRowDto) => (
    <div className="space-y-1 p-4">
      <div className={row.isLow ? "font-medium text-destructive" : "font-medium"}>{row.name}</div>
      <div className="text-sm text-muted-foreground">
        {row.quantityOnHand} / {row.availableQuantity} {t("common.units.inStock")}
      </div>
      <div className="text-sm text-muted-foreground">
        {t("admin.inventory.stock.table.totalCost")}: {formatDZD(row.stockValue, language)}
      </div>
      {onAdjust && (
        <Button variant="outline" size="sm" onClick={() => onAdjust(row)}>
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          {t("admin.inventory.stock.adjust")}
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t("admin.inventory.stock.filters.search")}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="low-stock-only"
              checked={lowStockOnly}
              onCheckedChange={onLowStockOnlyChange}
            />
            <Label htmlFor="low-stock-only">{t("admin.inventory.stock.lowStockOnly")}</Label>
          </div>
        </div>
        {onExport && (
          <ExportMenu
            isPending={isExporting}
            items={[
              {
                key: "csv",
                labelKey: "admin.inventory.stock.exportCsv",
                onSelect: () => onExport("csv"),
              },
              {
                key: "pdf",
                labelKey: "admin.inventory.stock.exportPdf",
                onSelect: () => onExport("pdf"),
              },
            ]}
          />
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} columns={onAdjust ? 8 : 7} />
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
