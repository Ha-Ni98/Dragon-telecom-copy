import { FileEdit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionRetryChip } from "./SectionRetryChip";
import type { AdminDashboardDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

// Dumb, props-only (Sprint 4). Sprint 6 wires useAdminDashboard() around this.
type DraftSales = AdminDashboardDto["draftSalesByStaff"][number];

interface DraftSalesByStaffWidgetProps {
  drafts?: DraftSales[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function DraftSalesByStaffWidget({
  drafts,
  isLoading = false,
  isError = false,
  onRetry,
}: DraftSalesByStaffWidgetProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{t("admin.dashboard.draftSalesByStaff")}</CardTitle>
        {isError && <SectionRetryChip onRetry={onRetry} />}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)
        ) : isError ? null : !drafts || drafts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
            <FileEdit className="h-6 w-6" />
            <p className="text-sm">{t("admin.dashboard.noDraftSales")}</p>
          </div>
        ) : (
          drafts.map((entry) => (
            <div key={entry.staffId} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{entry.staffName}</span>
              <span className="font-medium">{entry.draftCount}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
