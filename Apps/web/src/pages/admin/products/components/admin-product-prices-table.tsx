import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Package } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { Button } from "@/components/ui/button";
import type { AdminProductDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";

interface AdminProductPricesTableProps {
  products?: AdminProductDto[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onClearFilters?: () => void;
}

// S3 (R3) — Admin twin of StaffProductsTable, typed to AdminProductDto and adding the one
// column staff deliberately never sees: guestPrice. Category columns are data-driven (one per
// distinct {categoryId, categoryName} seen across `products`), same as the staff table, so a
// change to the client-category set never needs a code change here.
export function AdminProductPricesTable({
  products,
  isLoading = false,
  isError = false,
  onRetry,
  onClearFilters,
}: AdminProductPricesTableProps) {
  const { t, language } = useTranslation();

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of products ?? []) {
      for (const c of p.categoryPrices) seen.set(c.categoryId, c.categoryName);
    }
    return Array.from(seen, ([categoryId, categoryName]) => ({ categoryId, categoryName }));
  }, [products]);

  const columns = useMemo<ColumnDef<AdminProductDto>[]>(() => {
    const base: ColumnDef<AdminProductDto>[] = [
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
      { accessorKey: "availableQuantity", header: t("admin.productsList.table.available") },
      {
        accessorKey: "guestPrice",
        header: t("admin.productsList.table.guestPrice"),
        cell: ({ row }) =>
          row.original.guestPrice != null ? formatDZD(row.original.guestPrice, language) : "—",
      },
      {
        accessorKey: "defaultSalePrice",
        header: t("admin.productsList.table.defaultPrice"),
        cell: ({ row }) =>
          row.original.defaultSalePrice != null
            ? formatDZD(row.original.defaultSalePrice, language)
            : "—",
      },
    ];

    const categoryColumns: ColumnDef<AdminProductDto>[] = categories.map(
      ({ categoryId, categoryName }) => ({
        id: `category-${categoryId}`,
        header: categoryName,
        cell: ({ row }) => {
          const price = row.original.categoryPrices.find((c) => c.categoryId === categoryId)?.price;
          return (
            <span className="text-sm">
              {price !== undefined ? formatDZD(price, language) : "—"}
            </span>
          );
        },
      }),
    );

    return [...base, ...categoryColumns];
  }, [t, language, categories]);

  const renderMobileRow = (product: AdminProductDto) => (
    <div className="p-4 space-y-1">
      <p className="text-sm font-medium">{product.name}</p>
      <p className="text-xs text-muted-foreground">
        {[product.family.name, product.brand.name, product.model?.name].filter(Boolean).join(" / ")}
      </p>
      <div className="flex items-center justify-between text-sm">
        <span>
          {t("admin.productsList.table.available")}: {product.availableQuantity}
        </span>
        <span className="font-medium">
          {product.defaultSalePrice != null ? formatDZD(product.defaultSalePrice, language) : "—"}
        </span>
      </div>
    </div>
  );

  if (isLoading) return <TableSkeleton rows={8} columns={6} />;

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
      data={products ?? []}
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
