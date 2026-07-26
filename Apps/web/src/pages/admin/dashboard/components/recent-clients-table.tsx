/**
 * Recent Clients Table Component
 * Displays the last 5 registered clients in a read-only table
 */

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import type { AdminDashboardDto } from "@dragon-telecom/contract";
import { formatDateTime } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

// set-02 Sprint 3 retype — was RecentClient (draft view-model: fullName, phoneNumber, wilaya,
// commune, status+statusLabel). AdminDashboardDto['recentClients']
// (DashboardClientSummarySchema) only carries {id, fullName, createdAt} — no contact/location/
// status fields — so the table drops to 2 columns. The old status-badge helpers and phone
// formatter have nothing left to key off and are dropped with it.
type RecentClient = AdminDashboardDto["recentClients"][number];

interface RecentClientsTableProps {
  clients?: RecentClient[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRefresh?: () => void;
  showRefresh?: boolean;
  limit?: number;
}

function ClientsErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>{error}</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="ml-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("common.retry")}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

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

  const columns = useMemo<ColumnDef<RecentClient>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: t("admin.dashboard.fullName"),
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
        accessorKey: "createdAt",
        header: t("account.memberSince"),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [t],
  );

  const renderMobileRow = (client: RecentClient) => (
    <div className="p-4 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <div className="p-1 rounded-full bg-muted">
          <User className="h-3 w-3 text-muted-foreground" />
        </div>
        <span className="font-medium text-sm">{client.fullName}</span>
      </div>
      <span className="text-xs text-muted-foreground">{formatDateTime(client.createdAt)}</span>
    </div>
  );

  const header = (
    <div className="flex items-center justify-between">
      <div>
        <CardTitle>{t("admin.dashboard.recentClients")}</CardTitle>
        <CardDescription>{t("admin.dashboard.lastRegistered")}</CardDescription>
      </div>
      {showRefresh && onRefresh && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="flex items-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>{t("common.refresh")}</span>
        </Button>
      )}
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>{header}</CardHeader>
        <CardContent>
          <TableSkeleton rows={3} columns={2} />
        </CardContent>
      </Card>
    );
  }

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

  const displayClients = (clients ?? []).slice(0, limit);

  return (
    <Card>
      <CardHeader>{header}</CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={displayClients}
          getRowKey={(client) => client.id}
          renderMobileRow={renderMobileRow}
          emptyState={
            <EmptyState
              icon={<User className="h-6 w-6" />}
              title={t("admin.clients.noClientsFound")}
              body={t("admin.clients.noClientsFoundBody")}
            />
          }
        />
      </CardContent>
    </Card>
  );
}
