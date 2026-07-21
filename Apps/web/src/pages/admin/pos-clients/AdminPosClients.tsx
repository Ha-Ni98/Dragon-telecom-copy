import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PosClientsTable } from "@/pages/admin/pos-clients/components/pos-clients-table";
import { AddPosClientDialog } from "@/pages/admin/pos-clients/components/add-pos-client-dialog";
import { EditPosClientDialog } from "@/pages/admin/pos-clients/components/edit-pos-client-dialog";
import { PosClientDetailDrawer } from "@/pages/admin/pos-clients/components/pos-client-detail-drawer";
import type { PosClientDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-11 — page-local primitives assembled (Sprint 4, no data yet). Sprint 5 wires
// `usePosClientsList`/`useCreatePosClient`/`useUpdatePosClient`/`useSales`/`useClientPayments`.
export default function AdminPosClients() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<PosClientDto | null>(null);
  const [detailClient, setDetailClient] = useState<PosClientDto | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <PageHeader
          title={t("admin.posClients.title")}
          subtitle={t("admin.posClients.description")}
        />
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("admin.posClients.addClient")}
        </Button>
      </div>

      <PosClientsTable
        data={undefined}
        isLoading={false}
        onRowClick={setDetailClient}
        onPageChange={setCurrentPage}
      />

      <AddPosClientDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        categoryOptions={[]}
        onSave={() => setIsAddOpen(false)}
      />

      <EditPosClientDialog
        open={!!editingClient}
        onOpenChange={(open) => !open && setEditingClient(null)}
        client={editingClient}
        categoryOptions={[]}
        onSave={() => setEditingClient(null)}
      />

      <PosClientDetailDrawer
        open={!!detailClient}
        onOpenChange={(open) => !open && setDetailClient(null)}
        client={detailClient}
      />
    </div>
  );
}
