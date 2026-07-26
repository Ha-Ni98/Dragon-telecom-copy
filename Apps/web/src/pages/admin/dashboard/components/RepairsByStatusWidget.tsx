import { Wrench } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionRetryChip } from "./SectionRetryChip";
import { RepairStatus } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

// Dumb, props-only (Sprint 4). Sprint 6 wires useAdminDashboard() around this.
// AdminDashboardDto.repairsByStatus is an open string-keyed record (statistics.dtos.ts
// deliberately avoids importing RepairStatus, to not add a repairs→statistics dependency edge)
// — rendered here in RepairStatus's own canonical order, falling back to 0 for any status with
// no repairs recorded, so a status is never silently missing from the list.
const STATUS_ORDER = [
  RepairStatus.INTAKE,
  RepairStatus.PROCESSING,
  RepairStatus.COMPLETED,
  RepairStatus.PICKED_UP,
  RepairStatus.CANCELLED,
];

const STATUS_LABEL_KEY: Record<RepairStatus, string> = {
  [RepairStatus.INTAKE]: "repairs.status.intake",
  [RepairStatus.PROCESSING]: "repairs.status.processing",
  [RepairStatus.COMPLETED]: "repairs.status.completed",
  [RepairStatus.PICKED_UP]: "repairs.status.pickedUp",
  [RepairStatus.CANCELLED]: "repairs.status.cancelled",
};

interface RepairsByStatusWidgetProps {
  repairsByStatus?: Record<string, number>;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function RepairsByStatusWidget({
  repairsByStatus,
  isLoading = false,
  isError = false,
  onRetry,
}: RepairsByStatusWidgetProps) {
  const { t } = useTranslation();
  const total = repairsByStatus ? Object.values(repairsByStatus).reduce((sum, n) => sum + n, 0) : 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{t("admin.dashboard.repairsByStatus")}</CardTitle>
        {isError && <SectionRetryChip onRetry={onRetry} />}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)
        ) : isError ? null : !repairsByStatus || total === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
            <Wrench className="h-6 w-6" />
            <p className="text-sm">{t("admin.dashboard.noRepairs")}</p>
          </div>
        ) : (
          STATUS_ORDER.map((status) => (
            <div key={status} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t(STATUS_LABEL_KEY[status])}</span>
              <span className="font-medium">{repairsByStatus[status] ?? 0}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
