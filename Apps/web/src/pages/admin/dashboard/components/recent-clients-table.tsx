/**
 * Recent Clients Table Component
 * Displays the last 5 registered clients in a read-only table
 */

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { RecentClient } from "@/types/draft-types/dashboard.types";
import { ClientStatusCode } from "@/types/draft-types/enums.types";
import { useTranslation } from "@/hooks/useTranslation";

interface RecentClientsTableProps {
  /** Recent clients data */
  clients?: RecentClient[];
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: string | null;
  /** Retry function for error handling */
  onRetry?: () => void;
  /** Refresh function */
  onRefresh?: () => void;
  /** Whether to show refresh button */
  showRefresh?: boolean;
  /** Maximum number of clients to display */
  limit?: number;
}

/**
 * Get client status badge variant and color
 */
function getClientStatusBadgeVariant(status: ClientStatusCode) {
  switch (status) {
    case ClientStatusCode.active:
      return "default" as const;
    case ClientStatusCode.pending:
      return "secondary" as const;
    case ClientStatusCode.disabled:
      return "outline" as const;
    case ClientStatusCode.refused:
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

/**
 * Get client status badge color class
 */
function getClientStatusBadgeColor(status: ClientStatusCode) {
  switch (status) {
    case ClientStatusCode.active:
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case ClientStatusCode.pending:
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case ClientStatusCode.disabled:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    case ClientStatusCode.refused:
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
}

/**
 * Format phone number for display
 */
function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('213')) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  } else if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  } else if (digits.length === 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  return phone;
}

/**
 * Error state component
 */
function ClientsErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>{error}</span>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="ml-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('common.retry')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Main Recent Clients Table Component
 */
export function RecentClientsTable({
  clients,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = true,
  limit = 5,
}: RecentClientsTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<RecentClient>[]>(() => [
    {
      accessorKey: 'fullName',
      header: t('admin.dashboard.fullName'),
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded-full bg-muted">
            <User className="h-3 w-3 text-muted-foreground" />
          </div>
          <span className="font-medium text-sm">{row.original.fullName}</span>
        </div>
      ),
    },
    {
      accessorKey: 'phoneNumber',
      header: t('admin.dashboard.phoneNumber'),
      cell: ({ row }) => <span className="text-sm font-mono">{formatPhoneNumber(row.original.phoneNumber)}</span>,
    },
    {
      accessorKey: 'wilaya',
      header: t('admin.dashboard.wilaya'),
      cell: ({ row }) => <span className="text-sm">{row.original.wilaya}</span>,
    },
    {
      accessorKey: 'commune',
      header: t('admin.dashboard.commune'),
      cell: ({ row }) => <span className="text-sm">{row.original.commune}</span>,
    },
    {
      accessorKey: 'status',
      header: t('admin.dashboard.status'),
      cell: ({ row }) => (
        <Badge
          variant={getClientStatusBadgeVariant(row.original.status)}
          className={getClientStatusBadgeColor(row.original.status)}
        >
          {row.original.statusLabel}
        </Badge>
      ),
    },
  ], [t]);

  const renderMobileRow = (client: RecentClient) => (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded-full bg-muted">
            <User className="h-3 w-3 text-muted-foreground" />
          </div>
          <span className="font-medium text-sm">{client.fullName}</span>
        </div>
        <Badge
          variant={getClientStatusBadgeVariant(client.status)}
          className={getClientStatusBadgeColor(client.status)}
        >
          {client.statusLabel}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
        <span className="font-mono">{formatPhoneNumber(client.phoneNumber)}</span>
        <span>{client.wilaya}</span>
        <span>{client.commune}</span>
      </div>
    </div>
  );

  const header = (
    <div className="flex items-center justify-between">
      <div>
        <CardTitle>{t('admin.dashboard.recentClients')}</CardTitle>
        <CardDescription>{t('admin.dashboard.lastRegistered')}</CardDescription>
      </div>
      {showRefresh && onRefresh && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="flex items-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>{t('common.refresh')}</span>
        </Button>
      )}
    </div>
  );

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>{header}</CardHeader>
        <CardContent>
          <TableSkeleton rows={3} columns={5} />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>{header}</CardHeader>
        <CardContent>
          <ClientsErrorState error={error} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }

  // Limit clients to specified number
  const displayClients = (clients ?? []).slice(0, limit);

  return (
    <Card>
      <CardHeader>{header}</CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={displayClients}
          getRowKey={(client) => String(client.idClient)}
          renderMobileRow={renderMobileRow}
          emptyState={
            <EmptyState
              icon={<User className="h-6 w-6" />}
              title={t('admin.clients.noClientsFound')}
              body={t('admin.clients.noClientsFoundBody')}
            />
          }
        />
      </CardContent>
    </Card>
  );
}
