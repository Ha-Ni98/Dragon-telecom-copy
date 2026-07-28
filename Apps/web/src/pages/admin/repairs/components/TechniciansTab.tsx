import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Wrench, Plus } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { TechnicianRepairStatsDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { useQueryClient } from "@tanstack/react-query";
import { formatDZD } from "@/lib/utils";
import { qk } from "@/lib/query-keys";
import { useTechnicianRepairStats } from "@/hooks/useRepairs";
import { useCreateTechnician } from "@/hooks/useIdentity";
import { REPAIR_STATUS_LABEL_KEY } from "@/pages/staff/repairs/repair-status-labels";
import {
  addTechnicianSchema,
  type AddTechnicianFormValues,
} from "@/pages/admin/repairs/add-technician.schema";
import { RepairStatus } from "@dragon-telecom/contract";

// S13/R1 — admin-only. Counts per status plus revenue (Σ totalAmount over PICKED_UP repairs
// only, the single status at which repair revenue is recognised, D8). No profit or turnaround
// column (owner decision).
export function TechniciansTab() {
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();
  const { data: technicians, isLoading, isError, refetch } = useTechnicianRepairStats();
  const createTechnician = useCreateTechnician();
  const [addOpen, setAddOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddTechnicianFormValues>({
    resolver: zodResolver(addTechnicianSchema(t)),
    defaultValues: { name: "", phone: "" },
  });

  const handleAdd = handleSubmit((values) => {
    createTechnician.mutate(values, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: qk.repairs.technicianStats() });
        toast.success(t("admin.repairs.technicians.success"));
        setAddOpen(false);
        reset();
      },
    });
  });

  const columns = useMemo<ColumnDef<TechnicianRepairStatsDto>[]>(
    () => [
      {
        accessorKey: "technicianName",
        header: t("admin.repairs.technicians.nameLabel"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.technicianName}</span>
            {!row.original.isEnabled && (
              <Badge variant="secondary">{t("admin.repairs.technicians.disabled")}</Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: "totalRepairs",
        header: t("admin.repairs.technicians.columns.total"),
      },
      {
        accessorKey: "intakeCount",
        header: t(REPAIR_STATUS_LABEL_KEY[RepairStatus.INTAKE]),
      },
      {
        accessorKey: "processingCount",
        header: t(REPAIR_STATUS_LABEL_KEY[RepairStatus.PROCESSING]),
      },
      {
        accessorKey: "completedCount",
        header: t(REPAIR_STATUS_LABEL_KEY[RepairStatus.COMPLETED]),
      },
      {
        accessorKey: "pickedUpCount",
        header: t(REPAIR_STATUS_LABEL_KEY[RepairStatus.PICKED_UP]),
      },
      {
        accessorKey: "cancelledCount",
        header: t(REPAIR_STATUS_LABEL_KEY[RepairStatus.CANCELLED]),
      },
      {
        accessorKey: "revenue",
        header: t("admin.repairs.technicians.columns.revenue"),
        cell: ({ row }) => formatDZD(row.original.revenue, language),
      },
    ],
    [t, language],
  );

  const renderMobileRow = (item: TechnicianRepairStatsDto) => (
    <div className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium">{item.technicianName}</span>
        <span className="font-medium">{formatDZD(item.revenue, language)}</span>
      </div>
      <div className="text-sm text-muted-foreground">
        {t("admin.repairs.technicians.columns.total")}: {item.totalRepairs}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("admin.repairs.technicians.title")}</h3>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("admin.repairs.technicians.add")}
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} columns={8} />
      ) : isError ? (
        <NotFoundState
          title={t("admin.repairs.technicians.error")}
          body=""
          action={
            <Button variant="outline" onClick={() => refetch()}>
              {t("common.actions.tryAgain")}
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={technicians ?? []}
          getRowKey={(item) => item.technicianId}
          renderMobileRow={renderMobileRow}
          emptyState={
            <EmptyState
              icon={<Wrench className="h-6 w-6" />}
              title={t("admin.repairs.technicians.empty")}
              body=""
            />
          }
        />
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.repairs.technicians.add")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="technician-name">{t("admin.repairs.technicians.nameLabel")}</Label>
              <Input id="technician-name" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="technician-phone">{t("admin.repairs.technicians.phoneLabel")}</Label>
              <Input id="technician-phone" {...register("phone")} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createTechnician.isPending}>
                {t("admin.repairs.technicians.submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
