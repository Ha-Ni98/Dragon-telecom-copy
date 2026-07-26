import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Package } from "lucide-react";
import type { SupplierDetailDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

type ProductHistoryRow = SupplierDetailDto["productHistory"][number];

interface SupplierProductHistoryTableProps {
  productHistory: ProductHistoryRow[];
  isLoading?: boolean;
}

// ADM-07 detail — retyped off SupplierDetailDto's `productHistory` array (purchasing.dtos.ts:
// `{ productId, productName, totalQuantity, lastPurchaseAt }`). Read-only; rows link to the
// product (scope confinement — no destination page built here).
export function SupplierProductHistoryTable({
  productHistory,
  isLoading = false,
}: SupplierProductHistoryTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<ProductHistoryRow>[]>(
    () => [
      {
        accessorKey: "productName",
        header: t("admin.suppliers.productName"),
        cell: ({ row }) => (
          <Link
            to={`/admin/products/${row.original.productId}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.productName}
          </Link>
        ),
      },
      {
        accessorKey: "totalQuantity",
        header: t("admin.suppliers.quantitySupplied"),
      },
      {
        accessorKey: "lastPurchaseAt",
        header: t("admin.suppliers.supplyDate"),
      },
    ],
    [t],
  );

  const renderMobileRow = (row: ProductHistoryRow) => (
    <div className="space-y-1 p-4">
      <Link
        to={`/admin/products/${row.productId}`}
        className="font-medium text-primary hover:underline"
      >
        {row.productName}
      </Link>
      <div className="text-sm text-muted-foreground">
        {row.totalQuantity} · {row.lastPurchaseAt}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t("admin.suppliers.productHistory")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={3} columns={3} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          {t("admin.suppliers.productHistory")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={productHistory}
          getRowKey={(row) => row.productId}
          renderMobileRow={renderMobileRow}
          emptyState={
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title={t("admin.suppliers.noProductHistory")}
              body={t("admin.suppliers.noProductHistoryDescription")}
            />
          }
        />
      </CardContent>
    </Card>
  );
}
