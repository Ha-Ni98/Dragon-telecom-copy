import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ShoppingBag } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { PurchasedProductDocumentsDialog } from "@/pages/admin/clients/components/purchased-product-documents-dialog";
import { usePurchasedProducts } from "@/hooks/usePurchaseHistory";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";
import type { PurchasedProductDto } from "@dragon-telecom/contract";
import type { PurchaseHistoryOwner } from "@/types/purchase-history.types";

const PAGE_SIZE = 10;

// S36 — "Products bought": every product the client bought (completed POS sales + completed online
// orders, never repair parts), aggregated in SQL and paginated server-side. Returns shown
// separately, never netted. No cost/profit, on either side. Rows open the documents behind the
// product. Shared by the admin client page (web Client id) and the POS-client drawer (both scopes).
export function ClientPurchasedProductsTab({ owner }: { owner: PurchaseHistoryOwner }) {
  const { t, language } = useTranslation();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PurchasedProductDto | null>(null);

  const query = useMemo(() => ({ page, limit: PAGE_SIZE }), [page]);
  const { data, isLoading, isError } = usePurchasedProducts(owner, query);

  const columns = useMemo<ColumnDef<PurchasedProductDto>[]>(
    () => [
      { accessorKey: "productName", header: t("admin.clients.purchasedProducts.product") },
      {
        accessorKey: "quantityBought",
        header: t("admin.clients.purchasedProducts.quantityBought"),
      },
      {
        accessorKey: "totalAmount",
        header: t("admin.clients.purchasedProducts.totalAmount"),
        cell: ({ row }) => formatDZD(row.original.totalAmount, language),
      },
      {
        accessorKey: "quantityReturned",
        header: t("admin.clients.purchasedProducts.quantityReturned"),
      },
      {
        accessorKey: "amountRefunded",
        header: t("admin.clients.purchasedProducts.amountRefunded"),
        cell: ({ row }) => formatDZD(row.original.amountRefunded, language),
      },
    ],
    [t, language],
  );

  if (isLoading) return <TableSkeleton rows={5} columns={5} />;

  if (isError) {
    return <NotFoundState title={t("admin.clients.purchasedProducts.error")} body="" />;
  }

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        getRowKey={(row) => row.productId}
        onRowClick={setSelected}
        renderMobileRow={(row) => (
          <div className="space-y-1 p-1 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{row.productName}</span>
              <span className="font-semibold">{formatDZD(row.totalAmount, language)}</span>
            </div>
            <div className="text-muted-foreground">
              {t("admin.clients.purchasedProducts.mobileSummary", {
                bought: row.quantityBought,
                returned: row.quantityReturned,
              })}
            </div>
          </div>
        )}
        emptyState={
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title={t("admin.clients.purchasedProducts.empty")}
            body=""
          />
        }
      />

      {data && data.items.length > 0 && (
        <p className="text-xs text-muted-foreground">{t("admin.clients.purchasedProducts.note")}</p>
      )}

      {data && data.meta.totalPages > 1 && (
        <SimplePagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          onPageChange={setPage}
        />
      )}

      <PurchasedProductDocumentsDialog
        owner={owner}
        product={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
