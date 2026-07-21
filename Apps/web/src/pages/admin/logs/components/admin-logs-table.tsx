import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  FileText,
  RefreshCw,
  AlertTriangle,
  User,
  Calendar,
  Activity,
  MessageSquare,
} from "lucide-react";
import type { AuditLogDto, PaginatedResult } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface AdminLogsTableProps {
  data?: PaginatedResult<AuditLogDto>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRefresh?: () => void;
  showRefresh?: boolean;
  onPageChange: (page: number) => void;
  className?: string;
}

// Known entity types this admin app has a route for — everything else renders as plain text
// (scope confinement, no destination page built here for entities without an admin route).
const ENTITY_ROUTES: Record<string, (id: string) => string> = {
  PRODUCT: (id) => `/admin/products/${id}`,
  SUPPLIER: (id) => `/admin/suppliers/${id}`,
  CLIENT: (id) => `/admin/clients/${id}`,
};

function LogsErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>{t("admin.logs.title")}</span>
        </CardTitle>
        <CardDescription>{t("admin.logs.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="ml-2">
                {t("common.retry")}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

// ADM-18 — retyped off AuditLogDto (observability.dtos.ts): `id` (uuid, was `idLog: number`),
// `user?.username` (was `user.userName`/`user.idUser`, and the user is now optional — a
// system-initiated action has no acting user), `actionType`/`description` (was
// `actionTypeLabel`/`actionDetails`), `entityType`/`entityId` (new — the plan's "entity links
// where a route exists"). Strictly read-only — no mutation UI (append-only log).
export const AdminLogsTable = memo(function AdminLogsTable({
  data,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = true,
  onPageChange,
  className = "",
}: AdminLogsTableProps) {
  const { t, language } = useTranslation();
  const logs = data?.items ?? [];
  const pagination = data?.meta;

  const entityCell = (log: AuditLogDto) => {
    const buildRoute = ENTITY_ROUTES[log.entityType];
    return buildRoute ? (
      <Link to={buildRoute(log.entityId)} className="text-primary hover:underline">
        {log.entityType} #{log.entityId}
      </Link>
    ) : (
      <span>
        {log.entityType} #{log.entityId}
      </span>
    );
  };

  const columns = useMemo<ColumnDef<AuditLogDto>[]>(
    () => [
      {
        id: "user",
        header: () => (
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>{t("admin.logs.user")}</span>
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="text-sm font-medium">
              {row.original.user?.username ?? t("common.labels.notAssigned")}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "actionType",
        header: () => (
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span>{t("admin.logs.actionType")}</span>
          </div>
        ),
        cell: ({ row }) => <Badge variant="secondary">{row.original.actionType}</Badge>,
      },
      {
        id: "entity",
        header: t("admin.logs.entity"),
        cell: ({ row }) => entityCell(row.original),
      },
      {
        accessorKey: "description",
        header: () => (
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4" />
            <span>{t("admin.logs.actionDescription")}</span>
          </div>
        ),
        cell: ({ row }) => (
          <p className="line-clamp-2 max-w-[400px] text-sm text-foreground">
            {row.original.description}
          </p>
        ),
      },
      {
        accessorKey: "createdAt",
        header: () => (
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>{t("admin.logs.dateTime")}</span>
          </div>
        ),
        cell: ({ row }) => (
          <time dateTime={row.original.createdAt} className="text-sm text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleString(language)}
          </time>
        ),
      },
    ],
    [t, language],
  );

  const renderMobileRow = (log: AuditLogDto) => (
    <div className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          {log.user?.username ?? t("common.labels.notAssigned")}
        </div>
        <Badge variant="secondary">{log.actionType}</Badge>
      </div>
      <p className="line-clamp-2 text-sm text-foreground">{log.description}</p>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {entityCell(log)}
        <time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString(language)}</time>
      </div>
    </div>
  );

  const header = (
    <div className="flex items-center justify-between">
      <div>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>{t("admin.logs.title")}</span>
        </CardTitle>
        <CardDescription>
          {pagination
            ? `${t("admin.logs.description")} • ${pagination.total} ${t("admin.logs.totalLogs")}`
            : t("admin.logs.description")}
        </CardDescription>
      </div>
      {showRefresh && onRefresh && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
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
      <Card className={className}>
        <CardHeader>{header}</CardHeader>
        <CardContent>
          <TableSkeleton rows={5} columns={5} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return <LogsErrorState error={error} onRetry={onRetry} />;
  }

  return (
    <Card className={className}>
      <CardHeader>{header}</CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={logs}
          getRowKey={(log) => log.id}
          renderMobileRow={renderMobileRow}
          emptyState={
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={t("admin.logs.empty.title")}
              body={t("admin.logs.empty.description")}
            />
          }
        />

        {pagination && (
          <div className="mt-6">
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

export default AdminLogsTable;
