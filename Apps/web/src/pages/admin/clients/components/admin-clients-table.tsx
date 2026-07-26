import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { ClientStatusBadge } from "@/components/shared/StatusBadge";
import {
  Users,
  RefreshCw,
  AlertTriangle,
  Edit,
  Phone,
  Mail,
  Calendar,
  CreditCard,
} from "lucide-react";
import type { AdminClientDto, PaginatedResult } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface AdminClientsTableProps {
  data?: PaginatedResult<AdminClientDto>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRefresh?: () => void;
  showRefresh?: boolean;
  onEdit: (clientId: string) => void;
  onPageChange: (page: number) => void;
  className?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "DZD",
    minimumFractionDigits: 0,
  }).format(amount);
}

function ClientsTableError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

// ADM-12 — retyped off AdminClientDto (clients.dtos.ts): `id` is a uuid string (was
// `idClient: number`), `fullName`/`email`/`phone`/`credit`... wait — the DTO field is actually
// `phone`/`email` (was `clientPhoneNumber`/`clientEmail`), `status: ClientStatus` (was a
// `displayStatus` free string) rendered via the shared `ClientStatusBadge`. The DTO carries no
// `credit` field (clients don't hold a running credit balance — only POS clients do, per
// clients.dtos.ts) — the credit column is dropped rather than fabricated (Sprint 3 §Risks).
export const AdminClientsTable = memo(function AdminClientsTable({
  data,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = true,
  onEdit,
  onPageChange,
  className = "",
}: AdminClientsTableProps) {
  const { t } = useTranslation();
  const clients = data?.items ?? [];
  const pagination = data?.meta;

  const columns = useMemo<ColumnDef<AdminClientDto>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: t("admin.clients.table.name"),
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="text-sm font-semibold leading-tight">{row.original.fullName}</div>
            <div className="text-xs text-muted-foreground">{row.original.code}</div>
          </div>
        ),
      },
      {
        id: "contact",
        header: t("admin.clients.table.contact"),
        cell: ({ row }) => (
          <div className="space-y-1">
            {row.original.email && (
              <div className="flex items-start gap-1 text-xs">
                <Mail className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="break-words">{row.original.email}</span>
              </div>
            )}
            <div className="flex items-start gap-1 text-xs">
              <Phone className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="break-words">{row.original.phone}</span>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "totalOrders",
        header: () => <div className="text-center">{t("admin.clients.table.orders")}</div>,
        cell: ({ row }) => (
          <div className="text-center text-sm font-semibold">{row.original.totalOrders}</div>
        ),
      },
      {
        accessorKey: "totalSpent",
        header: t("admin.clients.totalSpent"),
        cell: ({ row }) => (
          <div className="flex items-start gap-1">
            <CreditCard className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="break-words text-sm font-semibold">
              {formatCurrency(row.original.totalSpent)}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: t("admin.clients.table.status"),
        cell: ({ row }) => <ClientStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "lastOrderDate",
        header: t("admin.clients.table.createdDate"),
        cell: ({ row }) => (
          <div className="flex items-start gap-1 text-muted-foreground">
            <Calendar className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="break-words text-xs">{row.original.lastOrderDate ?? "-"}</span>
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-center">{t("admin.clients.table.actions")}</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(row.original.id)}
              className="h-8 w-8"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link to={`/admin/clients/${row.original.id}`}>
                <Users className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [t, onEdit],
  );

  const renderMobileRow = (client: AdminClientDto) => (
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{client.fullName}</h3>
          <p className="text-sm text-muted-foreground">{client.code}</p>
        </div>
        <ClientStatusBadge status={client.status} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Phone className="h-4 w-4" />
          <span>{client.phone}</span>
        </div>
        {client.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4" />
            <span className="break-words">{client.email}</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 border-t pt-2">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{t("admin.clients.table.orders")}</p>
          <p className="font-semibold">{client.totalOrders}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{t("admin.clients.totalSpent")}</p>
          <p className="font-semibold">{formatCurrency(client.totalSpent)}</p>
        </div>
      </div>
    </div>
  );

  const header = (
    <div className="flex items-center justify-between">
      <div>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {t("admin.clients.table.title")}
        </CardTitle>
        <CardDescription>
          {pagination
            ? t("admin.clients.table.itemsFound", { count: pagination.total })
            : t("admin.clients.table.description")}
        </CardDescription>
      </div>
      {showRefresh && onRefresh && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          {t("common.refresh")}
        </Button>
      )}
    </div>
  );

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>{header}</CardHeader>
        <CardContent>
          <TableSkeleton rows={5} columns={7} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>{header}</CardHeader>
        <CardContent>
          <ClientsTableError error={error} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>{header}</CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={clients}
          getRowKey={(client) => client.id}
          renderMobileRow={renderMobileRow}
          emptyState={
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title={t("admin.clients.table.noClientsFound")}
              body={t("admin.clients.table.noClientsDescription")}
            />
          }
        />

        {pagination && (
          <div className="mt-4 border-t pt-4">
            <SimplePagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={onPageChange}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default AdminClientsTable;
