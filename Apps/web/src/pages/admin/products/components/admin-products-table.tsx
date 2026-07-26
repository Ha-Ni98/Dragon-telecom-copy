import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Package, Pencil } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { StatusPill, type BadgeTone } from "@/components/shared/StatusBadge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { StockStatus, type AdminProductDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";

const STOCK_STATUS_TONE: Record<StockStatus, BadgeTone> = {
  [StockStatus.IN_STOCK]: "success",
  [StockStatus.LOW_STOCK]: "warning",
  [StockStatus.OUT_OF_STOCK]: "destructive",
};

const STOCK_STATUS_LABEL_KEY: Record<StockStatus, string> = {
  [StockStatus.IN_STOCK]: "admin.productsList.stats.inStock",
  [StockStatus.LOW_STOCK]: "admin.productsList.stats.lowStock",
  [StockStatus.OUT_OF_STOCK]: "admin.productsList.stats.outOfStock",
};

interface AdminProductsTableProps {
  products?: AdminProductDto[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onClearFilters?: () => void;
  /** Optimistic overrides applied on top of the fetched row while a toggle mutation is in
   * flight (ADM-02 §Interactions: "Publish/enable optimistic toggles with rollback") — the
   * page owns the local state and rollback logic, this just renders whatever it's given. */
  optimisticOverrides?: Record<string, Partial<Pick<AdminProductDto, "isPublished" | "isEnabled">>>;
  onTogglePublished: (product: AdminProductDto, isPublished: boolean) => void;
  onToggleEnabled: (product: AdminProductDto, isEnabled: boolean) => void;
}

// Set-03 Sprint 5 rewire — was numeric-id AdminProductWithDetails w/ delete + "add stock"
// actions that don't exist in ADM-02's spec ("No stock entry here — stock arrives only via
// supplier invoices or adjustments"). Dropped both; row action is Edit only (→ ADM-04).
// S3: dropped the "image" column — it rendered a static placeholder icon on every row and
// carried no real data, and removing it gives the other columns (notably the stock-status
// pill) back the width they needed.
export function AdminProductsTable({
  products,
  isLoading,
  isError,
  onRetry,
  onClearFilters,
  optimisticOverrides = {},
  onTogglePublished,
  onToggleEnabled,
}: AdminProductsTableProps) {
  const { t, language } = useTranslation();

  const rows = useMemo(
    () => (products ?? []).map((p) => ({ ...p, ...optimisticOverrides[p.id] })),
    [products, optimisticOverrides],
  );

  const columns = useMemo<ColumnDef<AdminProductDto>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("admin.productsList.table.product"),
        cell: ({ row }) => <span className="font-medium text-sm">{row.original.name}</span>,
      },
      {
        accessorKey: "barcode",
        header: t("admin.productsList.table.barcode"),
        cell: ({ row }) => row.original.barcode ?? "—",
      },
      {
        id: "taxonomy",
        header: t("admin.productsList.table.taxonomy"),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {[row.original.family.name, row.original.brand.name, row.original.model?.name]
              .filter(Boolean)
              .join(" / ")}
          </span>
        ),
      },
      { accessorKey: "quantityOnHand", header: t("admin.productsList.table.onHand") },
      { accessorKey: "quantityReserved", header: t("admin.productsList.table.reserved") },
      { accessorKey: "availableQuantity", header: t("admin.productsList.table.available") },
      {
        accessorKey: "avgStockPrice",
        header: t("admin.productsList.table.avgCost"),
        cell: ({ row }) => formatDZD(row.original.avgStockPrice, language),
      },
      {
        accessorKey: "stockStatus",
        header: t("admin.productsList.table.stockBadge"),
        cell: ({ row }) => (
          <StatusPill
            tone={STOCK_STATUS_TONE[row.original.stockStatus]}
            label={t(STOCK_STATUS_LABEL_KEY[row.original.stockStatus])}
          />
        ),
      },
      {
        id: "published",
        header: t("admin.productsList.table.published"),
        cell: ({ row }) => (
          <Switch
            checked={row.original.isPublished}
            onCheckedChange={(checked) => onTogglePublished(row.original, checked)}
            aria-label={t("admin.productsList.table.published")}
          />
        ),
      },
      {
        id: "enabled",
        header: t("admin.productsList.table.enabled"),
        cell: ({ row }) => (
          <Switch
            checked={row.original.isEnabled}
            onCheckedChange={(checked) => onToggleEnabled(row.original, checked)}
            aria-label={t("admin.productsList.table.enabled")}
          />
        ),
      },
      {
        id: "actions",
        header: t("admin.productsList.table.edit"),
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" asChild>
            <Link
              to={`/admin/products/${row.original.id}`}
              aria-label={t("admin.productsList.table.edit")}
            >
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
        ),
      },
    ],
    [t, language, onTogglePublished, onToggleEnabled],
  );

  const renderMobileRow = (product: AdminProductDto) => (
    <div className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{product.name}</span>
        <StatusPill
          tone={STOCK_STATUS_TONE[product.stockStatus]}
          label={t(STOCK_STATUS_LABEL_KEY[product.stockStatus])}
        />
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{formatDZD(product.avgStockPrice, language)}</span>
        <Link to={`/admin/products/${product.id}`} className="text-primary">
          {t("admin.productsList.table.edit")}
        </Link>
      </div>
    </div>
  );

  if (isLoading) return <TableSkeleton rows={8} columns={10} />;

  if (isError) {
    return (
      <NotFoundState
        title={t("admin.productsList.table.error")}
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
      data={rows}
      getRowKey={(product) => product.id}
      renderMobileRow={renderMobileRow}
      emptyState={
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title={t("admin.productsList.table.empty")}
          body=""
          decoration={
            onClearFilters && (
              <Button variant="outline" size="sm" onClick={onClearFilters} className="mt-3">
                {t("admin.clients.clearFilters")}
              </Button>
            )
          }
        />
      }
    />
  );
}
