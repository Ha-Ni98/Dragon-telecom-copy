import { Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionRetryChip } from "./SectionRetryChip";
import type { AdminDashboardDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDateTime } from "@/lib/utils";

// Dumb, props-only (Sprint 4). Sprint 6 wires useAdminDashboard() around this. Row → /admin/clients
// (ADM-12's approval dialog lives there — plan.md scope confinement).
type PendingClient = AdminDashboardDto["pendingClients"][number];

interface PendingRegistrationsWidgetProps {
  clients?: PendingClient[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function PendingRegistrationsWidget({
  clients,
  isLoading = false,
  isError = false,
  onRetry,
}: PendingRegistrationsWidgetProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{t("admin.dashboard.pendingRegistrations")}</CardTitle>
          <CardDescription>{t("admin.clients.description")}</CardDescription>
        </div>
        {isError && <SectionRetryChip onRetry={onRetry} />}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))
        ) : isError ? null : !clients || clients.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
            <UserPlus className="h-6 w-6" />
            <p className="text-sm">{t("admin.dashboard.noPendingRegistrations")}</p>
          </div>
        ) : (
          <>
            {clients.map((client) => (
              <Link
                key={client.id}
                to="/admin/clients"
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm hover:bg-accent"
              >
                <span className="font-medium">{client.fullName}</span>
                <span className="text-muted-foreground">{formatDateTime(client.createdAt)}</span>
              </Link>
            ))}
            <Link
              to="/admin/clients"
              className="block text-center text-sm text-primary hover:underline"
            >
              {t("orders.viewAll")}
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
