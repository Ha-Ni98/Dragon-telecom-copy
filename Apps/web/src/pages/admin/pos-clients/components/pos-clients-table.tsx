import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { EnabledBadge } from "@/components/shared/StatusBadge";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import type { PaginatedResult, PosClientDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface PosClientsTableProps {
  data?: PaginatedResult<PosClientDto>;
  isLoading?: boolean;
  onRowClick: (client: PosClientDto) => void;
  onPageChange: (page: number) => void;
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString()} DZD`;
}

// ADM-11 — PosClientDto (clients.dtos.ts). Sprint 5 wires `usePosClientsList`.
export function PosClientsTable({
  data,
  isLoading = false,
  onRowClick,
  onPageChange,
}: PosClientsTableProps) {
  const { t } = useTranslation();
  const clients = data?.items ?? [];
  const pagination = data?.meta;

  const columns = useMemo<ColumnDef<PosClientDto>[]>(
    () => [
      { accessorKey: "code", header: t("admin.posClients.table.code") },
      { accessorKey: "name", header: t("admin.posClients.table.name") },
      {
        accessorKey: "phone",
        header: t("admin.posClients.table.phone"),
        cell: ({ row }) => row.original.phone ?? "-",
      },
      {
        accessorKey: "categoryName",
        header: t("admin.posClients.table.category"),
        cell: ({ row }) => row.original.categoryName ?? "-",
      },
      {
        accessorKey: "credit",
        header: t("admin.posClients.table.credit"),
        cell: ({ row }) => formatCurrency(row.original.credit),
      },
      {
        accessorKey: "totalPaid",
        header: t("admin.posClients.table.totalPaid"),
        cell: ({ row }) => formatCurrency(row.original.totalPaid),
      },
      {
        accessorKey: "totalSold",
        header: t("admin.posClients.table.totalSold"),
        cell: ({ row }) => formatCurrency(row.original.totalSold),
      },
      {
        accessorKey: "linkedClientId",
        header: t("admin.posClients.table.linkedAccount"),
        cell: ({ row }) => row.original.linkedClientId ?? "—",
      },
      {
        accessorKey: "isEnabled",
        header: t("admin.posClients.table.status"),
        cell: ({ row }) => <EnabledBadge isEnabled={row.original.isEnabled} />,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" onClick={() => onRowClick(row.original)}>
            {t("common.view")}
          </Button>
        ),
      },
    ],
    [t, onRowClick],
  );

  const renderMobileRow = (client: PosClientDto) => (
    <button
      type="button"
      onClick={() => onRowClick(client)}
      className="w-full space-y-1 p-4 text-left"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{client.name}</span>
        <EnabledBadge isEnabled={client.isEnabled} />
      </div>
      <div className="text-sm text-muted-foreground">
        {client.code} · {formatCurrency(client.credit)}
      </div>
    </button>
  );

  if (isLoading) return <TableSkeleton rows={6} columns={9} />;

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={clients}
        getRowKey={(client) => client.id}
        renderMobileRow={renderMobileRow}
        onRowClick={onRowClick}
        emptyState={
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title={t("admin.posClients.empty")}
            body=""
          />
        }
      />
      {pagination && (
        <SimplePagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
