import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { FileStack } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";
import type { SaleDto } from "@dragon-telecom/contract";

interface MyDraftsDrawerProps {
  trigger: React.ReactNode;
  drafts?: SaleDto[];
  isLoading?: boolean;
  onOpenDraft: (draft: SaleDto) => void;
  /** ADM-05 — admin sees every staff's drafts, grouped by staff (unscoped mount). */
  groupByStaff?: boolean;
}

// Dumb, props-only (Sprint 4) — Sprint 7 wires useSales(scope, { status: 'DRAFT' }) around this.
export function MyDraftsDrawer({
  trigger,
  drafts,
  isLoading,
  onOpenDraft,
  groupByStaff,
}: MyDraftsDrawerProps) {
  const { t, language } = useTranslation();

  const groups = groupByStaff
    ? Object.entries(
        (drafts ?? []).reduce<Record<string, SaleDto[]>>((acc, draft) => {
          (acc[draft.staffName] ??= []).push(draft);
          return acc;
        }, {}),
      )
    : [["", drafts ?? []] as const];

  return (
    <Drawer>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {groupByStaff ? t("admin.pos.drafts.title") : t("staff.pos.drafts.title")}
          </DrawerTitle>
        </DrawerHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4">
          {isLoading && <TableSkeleton rows={3} columns={2} />}

          {!isLoading && (drafts?.length ?? 0) === 0 && (
            <EmptyState
              icon={<FileStack className="h-6 w-6" />}
              title={t("staff.pos.drafts.empty")}
              body=""
            />
          )}

          {!isLoading &&
            groups.map(([staffName, staffDrafts]) => (
              <div key={staffName || "all"} className="space-y-1">
                {groupByStaff && staffDrafts.length > 0 && (
                  <div className="text-xs font-semibold uppercase text-muted-foreground">
                    {staffName}
                  </div>
                )}
                {staffDrafts.map((draft) => (
                  <button
                    key={draft.id}
                    type="button"
                    onClick={() => onOpenDraft(draft)}
                    className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left text-sm hover:bg-accent"
                  >
                    <div>
                      <div className="font-medium">{draft.reference}</div>
                      {draft.soldAt && (
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(draft.soldAt, language)}
                        </div>
                      )}
                    </div>
                    <div className="font-semibold">{formatDZD(draft.totalAmount, language)}</div>
                  </button>
                ))}
              </div>
            ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
