import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Search } from "lucide-react";
import { ClientActivityType, type ClientActivityDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface BrowsingActivityTableProps {
  data: ClientActivityDto[];
  isLoading?: boolean;
}

function formatDuration(seconds?: number): string {
  if (seconds === undefined) return "-";
  return seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)}m`;
}

// ADM-12b Browsing tab — ClientActivityDto (observability.dtos.ts): searches (query) and
// product views (product + durationSeconds) share the same row shape, distinguished by `type`.
export function BrowsingActivityTable({ data, isLoading = false }: BrowsingActivityTableProps) {
  const { t, language } = useTranslation();

  const columns = useMemo<ColumnDef<ClientActivityDto>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: t("admin.clients.browsing.table.date"),
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(language),
      },
      {
        id: "detail",
        header: t("admin.clients.browsing.table.query"),
        cell: ({ row }) =>
          row.original.type === ClientActivityType.SEARCH ? row.original.query : null,
      },
      {
        id: "product",
        header: t("admin.clients.browsing.table.product"),
        cell: ({ row }) =>
          row.original.product ? (
            <Link
              to={`/admin/products/${row.original.product.id}`}
              className="text-primary hover:underline"
            >
              {row.original.product.name}
            </Link>
          ) : (
            "-"
          ),
      },
      {
        accessorKey: "durationSeconds",
        header: t("admin.clients.browsing.table.timeSpent"),
        cell: ({ row }) => formatDuration(row.original.durationSeconds),
      },
    ],
    [t, language],
  );

  const rowKey = (row: ClientActivityDto) =>
    `${row.createdAt}-${row.type}-${row.query ?? row.product?.id ?? ""}`;

  const renderMobileRow = (row: ClientActivityDto) => (
    <div className="space-y-1 p-4">
      <div className="text-sm text-muted-foreground">
        {new Date(row.createdAt).toLocaleString(language)}
      </div>
      <div>{row.type === ClientActivityType.SEARCH ? row.query : row.product?.name}</div>
    </div>
  );

  if (isLoading) return <TableSkeleton rows={5} columns={4} />;

  return (
    <DataTable
      columns={columns}
      data={data}
      getRowKey={rowKey}
      renderMobileRow={renderMobileRow}
      emptyState={
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title={t("admin.clients.browsing.empty")}
          body=""
        />
      }
    />
  );
}
