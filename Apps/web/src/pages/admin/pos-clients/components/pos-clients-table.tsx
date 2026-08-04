import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { EnabledBadge } from "@/components/shared/StatusBadge";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Users, Pencil, ArrowUpRight, CreditCard } from "lucide-react";
import type { PaginatedResult, PosClientDto, AdminClientDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface PosClientsTableProps {
  data?: PaginatedResult<PosClientDto>;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onRowClick: (client: PosClientDto) => void;
  onEdit?: (client: PosClientDto) => void;
  onPageChange: (page: number) => void;
  onRecordPayment: (client: PosClientDto) => void;
  /** S18/D-5 — the linked-account arrow opens `/admin/clients/:id`, which has no staff twin;
   *  shown only in admin scope. */
  scope?: "staff" | "admin";
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString()} DZD`;
}

// ADM-11 — PosClientDto (clients.dtos.ts). Sprint 5 wires `usePosClientsList`. S18 made this the
// shared staff/admin twin (full parity, D-5).
export function PosClientsTable({
  data,
  isLoading = false,
  isError = false,
  onRetry,
  onRowClick,
  onEdit,
  onPageChange,
  onRecordPayment,
  scope = "admin",
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
        cell: ({ row }) =>
          scope === "admin" && row.original.linkedClientId ? (
            <Link
              to={`/admin/clients/${row.original.linkedClientId}`}
              onClick={(e) => e.stopPropagation()}
              aria-label={t("admin.posClients.table.viewLinkedAccount")}
              className="inline-flex text-primary hover:underline"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ) : (
            "—"
          ),
      },
      {
        accessorKey: "isEnabled",
        header: t("admin.posClients.table.status"),
        cell: ({ row }) => <EnabledBadge isEnabled={row.original.isEnabled} />,
      },
      {
        id: "actions",
        header: () => <div className="text-center">{t("admin.clients.table.actions")}</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => onRowClick(row.original)}>
              {t("common.view")}
            </Button>
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(row.original);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={!row.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRecordPayment(row.original);
                      }}
                      aria-label={t("admin.clients.recordPayment.action")}
                    >
                      <CreditCard className="h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                {!row.original.id && (
                  <TooltipContent>{t("admin.clients.recordPayment.needsApproval")}</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        ),
      },
    ],
    [t, onRowClick, onEdit, onRecordPayment, scope],
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

  if (isError) {
    return (
      <NotFoundState
        title={t("admin.posClients.error")}
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
