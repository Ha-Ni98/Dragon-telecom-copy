import { useState, useCallback } from "react";
import { AdminClientsStatsCards } from "@/pages/admin/clients/components/admin-clients-stats-cards";
import { AdminClientsFilters } from "@/pages/admin/clients/components/admin-clients-filters";
import { AdminClientsTable } from "@/pages/admin/clients/components/admin-clients-table";
import { AdminClientModifyDialog } from "@/pages/admin/clients/components/admin-client-modify-dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import type { UpdateClientFormValues } from "@/pages/admin/clients/components/admin-client-modify-dialog.schema";
import type { AdminClientDto } from "@dragon-telecom/contract";
import { ClientStatus } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

type StatusFilterValue = ClientStatus | "all";

// ADM-12 (list) — retyped onto AdminClientDto/ClientStatsDto (Sprint 3, presentational only).
// Data is a local placeholder instead of the incompatible stub hooks `use-admin-clients*`
// (numeric-id view-models) — Sprint 7 swaps this for `useClientDirectory`/
// `useClientDirectoryStats`/`useUpdateClientDirectoryEntry`, at which point the shell below
// needs no further prop-shape changes. No create button (registration-only, per plan) — the
// approval queue/dialog itself is built in Sprint 7, not here.
export default function AdminClients() {
  const { t } = useTranslation();

  const [selectedClient, setSelectedClient] = useState<AdminClientDto | null>(null);
  const [isModifyDialogOpen, setIsModifyDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilterValue>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const handleEdit = useCallback((_clientId: string) => {
    setIsModifyDialogOpen(true);
  }, []);
  const handleCloseDialog = useCallback(() => {
    setIsModifyDialogOpen(false);
    setSelectedClient(null);
  }, []);
  const handleSaveClient = useCallback(async (_updates: UpdateClientFormValues) => {
    setIsModifyDialogOpen(false);
    setSelectedClient(null);
  }, []);
  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedStatus("all");
    setCurrentPage(1);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.clients.title")} subtitle={t("admin.clients.description")} />

      <AdminClientsStatsCards stats={undefined} loading={false} error={null} />

      <AdminClientsFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        onClearFilters={handleClearFilters}
        hasActiveFilters={searchQuery !== "" || selectedStatus !== "all"}
      />

      <AdminClientsTable
        data={undefined}
        loading={false}
        error={null}
        onEdit={handleEdit}
        onPageChange={setCurrentPage}
      />

      {selectedClient && (
        <AdminClientModifyDialog
          client={selectedClient}
          isOpen={isModifyDialogOpen}
          onClose={handleCloseDialog}
          onSave={handleSaveClient}
          isSaving={false}
        />
      )}
    </div>
  );
}
