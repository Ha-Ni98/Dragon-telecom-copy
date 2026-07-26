import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { PackageSearch } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { CopyButton } from "@/components/shared/CopyButton";
import { Button } from "@/components/ui/button";
import type { StaffProductDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";

// Dumb, props-only (Sprint 4). Sprint 6 wires useStaffProducts() + the cascading filters around
// this. No image column (plan.md D2 — StaffProductDto carries none), no cost/margin/actions
// (STF-03: "no cost, no margin"). Category-price columns are data-driven — one per distinct
// {categoryId,categoryName} seen across `products`, not a fixed 3, so the table still renders
// correctly if the client-category set ever changes.
interface StaffProductsTableProps {
  products?: StaffProductDto[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onClearFilters?: () => void;
}

export function StaffProductsTable({
  products,
  isLoading = false,
  isError = false,
  onRetry,
  onClearFilters,
}: StaffProductsTableProps) {
  const { t } = useTranslation();

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of products ?? []) {
      for (const c of p.categoryPrices) seen.set(c.categoryId, c.categoryName);
    }
    return Array.from(seen, ([categoryId, categoryName]) => ({ categoryId, categoryName }));
  }, [products]);

  const columns = useMemo<ColumnDef<StaffProductDto>[]>(() => {
    const base: ColumnDef<StaffProductDto>[] = [
      {
        accessorKey: "name",
        header: t("admin.clients.table.name"),
        cell: ({ row }) => <span className="font-medium text-sm">{row.original.name}</span>,
      },
      {
        accessorKey: "barcode",
        header: t("staff.products.table.barcode"),
        cell: ({ row }) =>
          row.original.barcode ? (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              {row.original.barcode}
              <CopyButton text={row.original.barcode} />
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      {
        id: "taxonomy",
        header: `${t("staff.products.filterFamily")} / ${t("admin.dashboard.brand")} / ${t("staff.products.filterModel")}`,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {[row.original.family.name, row.original.brand.name, row.original.model?.name]
              .filter(Boolean)
              .join(" / ")}
          </span>
        ),
      },
      {
        accessorKey: "availableQuantity",
        header: t("staff.products.table.availableQty"),
        cell: ({ row }) => <span className="text-sm">{row.original.availableQuantity}</span>,
      },
      {
        accessorKey: "defaultSalePrice",
        header: t("staff.products.table.defaultPrice"),
        cell: ({ row }) => (
          <span className="text-sm font-medium">
            {row.original.defaultSalePrice !== undefined
              ? formatDZD(row.original.defaultSalePrice)
              : "—"}
          </span>
        ),
      },
    ];

    const categoryColumns: ColumnDef<StaffProductDto>[] = categories.map(
      ({ categoryId, categoryName }) => ({
        id: `category-${categoryId}`,
        header: categoryName,
        cell: ({ row }) => {
          const price = row.original.categoryPrices.find((c) => c.categoryId === categoryId)?.price;
          return <span className="text-sm">{price !== undefined ? formatDZD(price) : "—"}</span>;
        },
      }),
    );

    return [...base, ...categoryColumns];
  }, [t, categories]);

  const renderMobileRow = (product: StaffProductDto) => (
    <div className="p-4 space-y-1">
      <p className="text-sm font-medium">{product.name}</p>
      <p className="text-xs text-muted-foreground">
        {[product.family.name, product.brand.name, product.model?.name].filter(Boolean).join(" / ")}
      </p>
      <div className="flex items-center justify-between text-sm">
        <span>
          {t("staff.products.table.availableQty")}: {product.availableQuantity}
        </span>
        <span className="font-medium">
          {product.defaultSalePrice !== undefined ? formatDZD(product.defaultSalePrice) : "—"}
        </span>
      </div>
    </div>
  );

  if (isLoading) return <TableSkeleton rows={6} columns={5} />;

  if (isError) {
    return (
      <NotFoundState
        title={t("staff.products.errorLoading")}
        body={t("staff.products.errorLoadingBody")}
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
      data={products ?? []}
      getRowKey={(product) => product.id}
      renderMobileRow={renderMobileRow}
      emptyState={
        <EmptyState
          icon={<PackageSearch className="h-6 w-6" />}
          title={t("staff.products.empty")}
          body={t("staff.products.emptyBody")}
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
