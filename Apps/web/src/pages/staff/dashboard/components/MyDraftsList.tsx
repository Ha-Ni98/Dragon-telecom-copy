import { FileEdit } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import type { StaffDashboardDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";

// Dumb, props-only (Sprint 4). Sprint 6 wires useStaffDashboard() around this. "Finish in POS"
// is a scope-confined, non-interactive affordance — /staff/pos hasn't shipped (out of set,
// lib/staff-pages.ts), so this stays disabled-styled rather than a dead <Link>, matching the
// StaffSidebarNav precedent (Sprint 2) for the same unshipped destination.
type Draft = StaffDashboardDto["myDrafts"][number];

interface MyDraftsListProps {
  drafts?: Draft[];
  isLoading?: boolean;
}

function DraftRow({ draft }: { draft: Draft }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 p-3 border rounded-lg">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{draft.reference}</p>
        <p className="truncate text-xs text-muted-foreground">
          {draft.clientName ?? "—"} · {formatDZD(draft.total)} · {t("staff.dashboard.age")}:{" "}
          {Math.round(draft.ageHours)}h
        </p>
      </div>
      <span className="shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground/60">
        <FileEdit className="h-3.5 w-3.5" />
        {t("staff.dashboard.finishInPos")}
      </span>
    </div>
  );
}

export function MyDraftsList({ drafts, isLoading = false }: MyDraftsListProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("staff.dashboard.myDrafts")}</CardTitle>
        <CardDescription>{t("staff.dashboard.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))
        ) : !drafts || drafts.length === 0 ? (
          <EmptyState
            icon={<FileEdit className="h-6 w-6" />}
            title={t("staff.dashboard.draftsEmpty")}
            body={t("staff.dashboard.draftsEmptyBody")}
          />
        ) : (
          drafts.map((draft) => <DraftRow key={draft.reference} draft={draft} />)
        )}
      </CardContent>
    </Card>
  );
}
