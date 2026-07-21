import { useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { AdminClientsStatsCards } from "@/pages/admin/clients/components/admin-clients-stats-cards";
import { AdminClientsFilters } from "@/pages/admin/clients/components/admin-clients-filters";
import { AdminClientsTable } from "@/pages/admin/clients/components/admin-clients-table";
import { AdminClientModifyDialog } from "@/pages/admin/clients/components/admin-client-modify-dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import type { UpdateClientFormValues } from "@/pages/admin/clients/components/admin-client-modify-dialog.schema";
import type { AdminClientDto } from "@dragon-telecom/contract";
import { ClientStatus } from "@dragon-telecom/contract";
import {
  useClientDirectory,
  useClientDirectoryStats,
  useUpdateClientDirectoryEntry,
} from "@/hooks/useClientDirectory";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTranslation } from "@/hooks/useTranslation";

type StatusFilterValue = ClientStatus | "all";

// ADM-12 (list) — Sprint 7 rewire onto `useClientDirectory`/`useClientDirectoryStats`/
// `useUpdateClientDirectoryEntry`. Approval lives on the detail page only (ADM-12b) — this list
// never imports `ApprovalDialog`, matching the existing shell (no create button, registration-
// only). **Real bug found and fixed:** the Sprint-3 scaffold's `handleEdit` opened the dialog but
// never called `setSelectedClient`, so `{selectedClient && <AdminClientModifyDialog .../>}` could
// never actually render — clicking Edit was a silent no-op.
export default function AdminClients() {
  const { t } = useTranslation();

  const [selectedClient, setSelectedClient] = useState<AdminClientDto | null>(null);
  const [isModifyDialogOpen, setIsModifyDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilterValue>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const clientsQuery = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: selectedStatus === "all" ? undefined : selectedStatus,
      page: currentPage,
      limit: 10,
    }),
    [debouncedSearch, selectedStatus, currentPage],
  );
  const clients = useClientDirectory(clientsQuery);
  const stats = useClientDirectoryStats();
  const updateClient = useUpdateClientDirectoryEntry();

  const handleEdit = useCallback(
    (clientId: string) => {
      const client = clients.data?.items.find((c) => c.id === clientId);
      if (!client) return;
      setSelectedClient(client);
      setIsModifyDialogOpen(true);
    },
    [clients.data],
  );
  const handleCloseDialog = useCallback(() => {
    setIsModifyDialogOpen(false);
    setSelectedClient(null);
  }, []);
  const handleSaveClient = useCallback(
    async (updates: UpdateClientFormValues) => {
      if (!selectedClient) return;
      try {
        await updateClient.mutateAsync({ id: selectedClient.id, command: updates });
        toast.success(t("admin.clients.modifySuccess"));
        setIsModifyDialogOpen(false);
        setSelectedClient(null);
      } catch {
        // Global mutationCache toast (query-client.ts) already surfaces the failure; keep the
        // dialog open so the admin can retry without re-filling the form.
      }
    },
    [selectedClient, updateClient, t],
  );
  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedStatus("all");
    setCurrentPage(1);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.clients.title")} subtitle={t("admin.clients.description")} />

      <AdminClientsStatsCards
        stats={stats.data}
        loading={stats.isLoading}
        error={stats.isError ? t("admin.clients.errorLoadingStats") : null}
        onRetry={() => stats.refetch()}
      />

      <AdminClientsFilters
        searchQuery={searchQuery}
        onSearchChange={(query) => {
          setSearchQuery(query);
          setCurrentPage(1);
        }}
        selectedStatus={selectedStatus}
        onStatusChange={(status) => {
          setSelectedStatus(status);
          setCurrentPage(1);
        }}
        onClearFilters={handleClearFilters}
        hasActiveFilters={searchQuery !== "" || selectedStatus !== "all"}
        loading={clients.isLoading}
      />

      <AdminClientsTable
        data={clients.data}
        loading={clients.isLoading}
        error={clients.isError ? t("admin.clients.error") : null}
        onRetry={() => clients.refetch()}
        onEdit={handleEdit}
        onPageChange={setCurrentPage}
      />

      {selectedClient && (
        <AdminClientModifyDialog
          client={selectedClient}
          isOpen={isModifyDialogOpen}
          onClose={handleCloseDialog}
          onSave={handleSaveClient}
          isSaving={updateClient.isPending}
        />
      )}
    </div>
  );
}
