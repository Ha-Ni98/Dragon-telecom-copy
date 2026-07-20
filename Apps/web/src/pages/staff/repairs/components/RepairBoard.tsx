import { useState } from "react";
import { Wrench } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { AgeFlag } from "@/components/shared/AgeFlag";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RepairStatus, type RepairDto, type TechnicianDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { REPAIR_STATUS_LABEL_KEY } from "@/pages/staff/repairs/repair-status-labels";

const LANES = [
  RepairStatus.INTAKE,
  RepairStatus.PROCESSING,
  RepairStatus.COMPLETED,
  RepairStatus.PICKED_UP,
  RepairStatus.CANCELLED,
] as const;

interface RepairBoardProps {
  repairs?: RepairDto[];
  isLoading?: boolean;
  isError?: boolean;
  technicians?: TechnicianDto[];
  technicianFilter?: string;
  onTechnicianFilterChange: (technicianId?: string) => void;
  onCardClick: (repair: RepairDto) => void;
  /** A rejected drop snaps back (STF-07/ADM-13 §Interactions) — the caller decides success/
   * failure (server-validated), this only fires the intent. */
  onDropOnLane: (repair: RepairDto, toStatus: RepairStatus) => void;
  /** ADM-13 §UI — profit/cost columns are admin-only; staff cards omit them (this board has
   * none inline, so `scope` only gates future per-card additions the parent may pass via
   * children — kept for API symmetry with the rest of this cluster). */
  scope?: "staff" | "admin";
}

// Dumb, props-only (Sprint 4) — Sprint 7 wires useRepairs(scope, query)/useTechnicians()
// and the drag-drop → useUpdateRepairStatus() call around this. Native HTML5 drag-and-drop
// (no DnD library is on the approved-libraries list, front-end-rules.md §6A).
export function RepairBoard({
  repairs,
  isLoading,
  isError,
  technicians,
  technicianFilter,
  onTechnicianFilterChange,
  onCardClick,
  onDropOnLane,
}: RepairBoardProps) {
  const { t } = useTranslation();
  const [dragOverLane, setDragOverLane] = useState<RepairStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {LANES.map((lane) => (
          <div key={lane} className="space-y-3">
            <Skeleton className="h-6 w-24" />
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<Wrench className="h-6 w-6" />}
        title={t("staff.repairs.board.error")}
        body=""
      />
    );
  }

  if ((repairs?.length ?? 0) === 0) {
    return (
      <EmptyState
        icon={<Wrench className="h-6 w-6" />}
        title={t("staff.repairs.board.empty")}
        body=""
      />
    );
  }

  return (
    <div className="space-y-4">
      {technicians && (
        <Select
          value={technicianFilter ?? "all"}
          onValueChange={(v) => onTechnicianFilterChange(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder={t("staff.repairs.board.technicianFilter")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("staff.orders.tabs.all")}</SelectItem>
            {technicians.map((technician) => (
              <SelectItem key={technician.id} value={technician.id}>
                {technician.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {LANES.map((lane) => {
          const laneRepairs = (repairs ?? []).filter((r) => r.status === lane);
          return (
            <div
              key={lane}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverLane(lane);
              }}
              onDragLeave={() => setDragOverLane((current) => (current === lane ? null : current))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverLane(null);
                const repair = repairs?.find((r) => r.id === draggingId);
                if (repair && repair.status !== lane) onDropOnLane(repair, lane);
                setDraggingId(null);
              }}
              className={cn(
                "min-h-[8rem] space-y-2 rounded-xl p-2",
                dragOverLane === lane && "bg-primary-light/50",
              )}
            >
              <h3 className="text-sm font-semibold text-muted-foreground">
                {t(REPAIR_STATUS_LABEL_KEY[lane])}
              </h3>
              {laneRepairs.map((repair) => {
                const unpaid = repair.paidAmount < repair.totalAmount;
                return (
                  <div
                    key={repair.id}
                    draggable
                    onDragStart={() => setDraggingId(repair.id)}
                    onClick={() => onCardClick(repair)}
                    className="cursor-pointer space-y-1 rounded-2xl border border-border bg-card p-3 text-sm shadow-[var(--shadow-card)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{repair.reference}</span>
                      {unpaid && (
                        <Badge variant="destructive">{t("staff.repairs.board.unpaidBadge")}</Badge>
                      )}
                    </div>
                    <div className="font-medium">{repair.customerName}</div>
                    <div className="text-xs text-muted-foreground">
                      {repair.device.brand?.name} {repair.device.model?.name}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{repair.technician?.name ?? "—"}</span>
                      <AgeFlag since={repair.intakeAt} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
