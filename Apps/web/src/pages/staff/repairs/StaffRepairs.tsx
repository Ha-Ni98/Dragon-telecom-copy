import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RepairBoard } from "@/pages/staff/repairs/components/RepairBoard";
import { IntakeDialog } from "@/pages/staff/repairs/components/IntakeDialog";
import { RepairTicketDetail } from "@/pages/staff/repairs/components/RepairTicketDetail";
import { RepairStatusDialog } from "@/pages/staff/repairs/components/RepairStatusDialog";
import { TechniciansTab } from "@/pages/admin/repairs/components/TechniciansTab";
import {
  useRepairs,
  useRepair,
  useCreateRepair,
  useUpdateRepair,
  useAddRepairPart,
  useRemoveRepairPart,
  useUpdateRepairStatus,
  useRecordRepairPayment,
  useReturnRepair,
} from "@/hooks/useRepairs";
import { useTechnicians } from "@/hooks/useIdentity";
import { useStaffProducts } from "@/hooks/useCatalogProducts";
import { usePublicSettings } from "@/hooks/usePlatform";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTranslation } from "@/hooks/useTranslation";
import { RepairStatus, type RepairDto, type ReturnRepairCommand } from "@dragon-telecom/contract";
import type { IntakeRepairFormValues } from "@/pages/staff/repairs/intake-repair.schema";
import type { AddRepairPartFormValues } from "@/pages/staff/repairs/add-repair-part.schema";
import type { RepairStatusFormValues } from "@/pages/staff/repairs/repair-status.schema";
import type { RecordRepairPaymentFormValues } from "@/pages/staff/repairs/record-repair-payment.schema";

interface Props {
  scope?: "staff" | "admin";
}

// STF-07 `/staff/repairs` = ADM-13 `/admin/repairs` (scope-driven twin). set-03 Sprint 7 wiring.
// Board drag is faithful to the plan's own wording ("board drag = status transition, snap-back
// + toast on server reject") — it always fires the bare `{toStatus}` command and lets the
// server be the judge, rather than pre-routing PROCESSING/PICKED_UP/post-completion-CANCELLED
// drops to a form first. Those three transitions need extra fields (technician/paymentAmount
// or refundAmount) the drag gesture can't supply, so they'll 400 and toast — the same
// transitions done via the ticket detail's "Update status" button (which opens
// RepairStatusDialog) succeed normally. This is a real, intentional UX gap: dragging onto
// Processing/Picked-up/Cancelled(with money collected) always bounces; only the click flow
// works for those three. Documented in report-S13.md rather than built around with speculative
// dialog-routing logic. S30 — dropping a card on Returned always bounces too: a return needs
// per-part restock choices, so it goes through the ticket's own Return action (RepairReturnDialog).
export default function StaffRepairs({ scope = "staff" }: Props) {
  const { t } = useTranslation();

  const [technicianFilter, setTechnicianFilter] = useState<string | undefined>();
  const [dateFrom, setDateFrom] = useState<string | undefined>();
  const [dateTo, setDateTo] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const handleDateRangeChange = (from?: string, to?: string) => {
    setDateFrom(from);
    setDateTo(to);
    setPage(1);
  };
  const handleTechnicianFilterChange = (technicianId?: string) => {
    setTechnicianFilter(technicianId);
    setPage(1);
  };

  const {
    data: repairsPage,
    isLoading: repairsLoading,
    isError: repairsIsError,
  } = useRepairs(scope, {
    technicianId: technicianFilter,
    from: dateFrom,
    to: dateTo,
    page,
    limit: 10,
  });
  const { data: technicians } = useTechnicians(scope === "admin");
  // S25 — the repair receipt's store header. Public because /staff/repairs is a staff page and
  // GET /platform/settings is adminOnly.
  const publicSettings = usePublicSettings();

  const [intakeOpen, setIntakeOpen] = useState(false);

  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(null);
  const { data: selectedRepair } = useRepair(scope, selectedRepairId ?? "");

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  const [partSearchQuery, setPartSearchQuery] = useState("");
  const debouncedPartSearch = useDebouncedValue(partSearchQuery, 300);
  const { data: partSearchResult } = useStaffProducts(
    { search: debouncedPartSearch || undefined, page: 1, limit: 10 },
    { enabled: !!debouncedPartSearch.trim() },
  );

  const createRepair = useCreateRepair();
  const updateRepair = useUpdateRepair();
  const addPart = useAddRepairPart();
  const removePart = useRemoveRepairPart();
  const updateStatus = useUpdateRepairStatus();
  const recordPayment = useRecordRepairPayment();
  const returnRepair = useReturnRepair();

  const handleIntakeSubmit = (values: IntakeRepairFormValues) => {
    createRepair.mutate(
      { scope, command: values },
      {
        onSuccess: (repair) => {
          setIntakeOpen(false);
          setSelectedRepairId(repair.id);
          toast.success(t("staff.repairs.intake.submit"));
        },
      },
    );
  };

  const handleDropOnLane = (repair: RepairDto, toStatus: RepairStatus) => {
    updateStatus.mutate(
      { scope, id: repair.id, command: { toStatus } },
      { onError: () => toast.error(t("staff.repairs.statusDialog.dragRejected")) },
    );
  };

  const handleDiagnosisChange = (diagnosis: string) => {
    if (!selectedRepairId) return;
    updateRepair.mutate({ scope, id: selectedRepairId, command: { diagnosis } });
  };

  const handleLabourPriceChange = (labourPrice: number) => {
    if (!selectedRepairId) return;
    updateRepair.mutate({ scope, id: selectedRepairId, command: { labourPrice } });
  };

  const handleAddPart = (values: AddRepairPartFormValues) => {
    if (!selectedRepairId) return;
    addPart.mutate({ scope, id: selectedRepairId, command: values });
  };

  const handleRemovePart = (partId: string) => {
    if (!selectedRepairId) return;
    removePart.mutate({ scope, id: selectedRepairId, partId });
  };

  // technicianId isn't part of RepairStatusCommand (repair-status.schema.ts's own note) — it
  // rides a separate useUpdateRepair PATCH fired first, then the status transition.
  const handleStatusSubmit = (values: RepairStatusFormValues) => {
    if (!selectedRepairId) return;
    const { technicianId, ...statusCommand } = values;
    const submitStatus = () =>
      updateStatus.mutate(
        { scope, id: selectedRepairId, command: statusCommand },
        { onSuccess: () => setStatusDialogOpen(false) },
      );
    if (statusCommand.toStatus === RepairStatus.PROCESSING && technicianId) {
      updateRepair.mutate(
        { scope, id: selectedRepairId, command: { technicianId } },
        { onSuccess: submitStatus },
      );
    } else {
      submitStatus();
    }
  };

  const handleRecordPayment = (values: RecordRepairPaymentFormValues) => {
    if (!selectedRepairId) return;
    recordPayment.mutate(
      { scope, id: selectedRepairId, command: values },
      { onSuccess: () => toast.success(t("staff.repairs.payments.success")) },
    );
  };

  // S30 — PICKED_UP → RETURNED from the ticket's Return action.
  const handleReturn = (command: ReturnRepairCommand) => {
    if (!selectedRepairId) return;
    returnRepair.mutate(
      { scope, id: selectedRepairId, command },
      { onSuccess: () => toast.success(t("staff.repairs.return.success")) },
    );
  };

  const board = (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setIntakeOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("staff.repairs.intake.title")}
        </Button>
      </div>

      <RepairBoard
        repairs={repairsPage?.items}
        isLoading={repairsLoading}
        isError={repairsIsError}
        technicians={technicians}
        technicianFilter={technicianFilter}
        onTechnicianFilterChange={handleTechnicianFilterChange}
        from={dateFrom}
        to={dateTo}
        onDateRangeChange={handleDateRangeChange}
        page={page}
        totalPages={repairsPage?.meta.totalPages ?? 1}
        onPageChange={setPage}
        onCardClick={(repair) => setSelectedRepairId(repair.id)}
        onDropOnLane={handleDropOnLane}
        scope={scope}
      />

      <IntakeDialog
        open={intakeOpen}
        onOpenChange={setIntakeOpen}
        technicians={technicians}
        onSubmit={handleIntakeSubmit}
        isSubmitting={createRepair.isPending}
        scope={scope}
      />

      <RepairTicketDetail
        open={!!selectedRepairId}
        onOpenChange={(open) => !open && setSelectedRepairId(null)}
        repair={selectedRepair ?? null}
        isDiagnosisEditable={selectedRepair?.status === RepairStatus.PROCESSING}
        onDiagnosisChange={handleDiagnosisChange}
        onLabourPriceChange={handleLabourPriceChange}
        productSearchResults={partSearchResult?.items}
        onProductSearch={setPartSearchQuery}
        onAddPart={handleAddPart}
        onRemovePart={handleRemovePart}
        onOpenStatusDialog={() => setStatusDialogOpen(true)}
        onRecordPayment={handleRecordPayment}
        isRecordingPayment={recordPayment.isPending}
        onReturn={handleReturn}
        isReturning={returnRepair.isPending}
        scope={scope}
        store={publicSettings.data?.store}
      />

      <RepairStatusDialog
        // Forces a fresh mount per ticket — same defaultValues-frozen-at-first-render bug as
        // OrderConfirmDialog (StaffOrders.tsx), found while writing set-03 Sprint 9's tests.
        key={selectedRepair?.id ?? "none"}
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        repair={selectedRepair ?? null}
        technicians={technicians}
        onSubmit={handleStatusSubmit}
        isSubmitting={updateStatus.isPending || updateRepair.isPending}
      />
    </div>
  );

  // S13/R1, opened to staff by S18/D-3 — the Technicians tab is now shared (stats only; adding a
  // technician stays admin-only, gated inside TechniciansTab itself). PageHeader-above-Tabs shape
  // matches S12's StaffSales.tsx (the header sits above the tab bar, not inside either tab's
  // content).
  return (
    <div className="space-y-6">
      <PageHeader
        title={scope === "admin" ? t("admin.repairs.pageTitle") : t("staff.repairs.pageTitle")}
      />
      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">{t("admin.repairs.tabs.board")}</TabsTrigger>
          <TabsTrigger value="technicians">{t("admin.repairs.tabs.technicians")}</TabsTrigger>
        </TabsList>
        <TabsContent value="board" className="space-y-6">
          {board}
        </TabsContent>
        <TabsContent value="technicians" className="space-y-6">
          <TechniciansTab scope={scope} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
