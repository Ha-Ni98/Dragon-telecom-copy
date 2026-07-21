import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Search } from "lucide-react";
import type { StaffSearchDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface StaffSearchesTableProps {
  data: StaffSearchDto[];
  isLoading?: boolean;
}

// ADM-19 — StaffSearchDto (observability.dtos.ts). Matched-product links to ADM-06's movements
// tab (plan §Page 10).
export function StaffSearchesTable({ data, isLoading = false }: StaffSearchesTableProps) {
  const { t, language } = useTranslation();

  const columns = useMemo<ColumnDef<StaffSearchDto>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: t("admin.staffSearches.table.date"),
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(language),
      },
      { accessorKey: "userName", header: t("admin.staffSearches.table.user") },
      { accessorKey: "query", header: t("admin.staffSearches.table.query") },
      {
        id: "product",
        header: t("admin.staffSearches.table.product"),
        cell: ({ row }) =>
          row.original.matchedProduct ? (
            <Link to="/admin/inventory" className="text-primary hover:underline">
              {row.original.matchedProduct.name}
            </Link>
          ) : (
            "-"
          ),
      },
    ],
    [t, language],
  );

  const renderMobileRow = (row: StaffSearchDto) => (
    <div className="space-y-1 p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium">{row.userName}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(row.createdAt).toLocaleString(language)}
        </span>
      </div>
      <div className="text-sm text-muted-foreground">{row.query}</div>
    </div>
  );

  if (isLoading) return <TableSkeleton rows={5} columns={4} />;

  return (
    <DataTable
      columns={columns}
      data={data}
      getRowKey={(row) => `${row.userId}-${row.createdAt}`}
      renderMobileRow={renderMobileRow}
      emptyState={
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title={t("admin.staffSearches.empty")}
          body=""
        />
      }
    />
  );
}
