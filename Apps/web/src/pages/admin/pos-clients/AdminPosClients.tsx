import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PosClientsTable } from "@/pages/admin/pos-clients/components/pos-clients-table";
import { AddPosClientDialog } from "@/pages/admin/pos-clients/components/add-pos-client-dialog";
import { EditPosClientDialog } from "@/pages/admin/pos-clients/components/edit-pos-client-dialog";
import { PosClientDetailDrawer } from "@/pages/admin/pos-clients/components/pos-client-detail-drawer";
import type { AutocompleteOption } from "@/components/shared/autocomplete-input";
import type { PosClientDto } from "@dragon-telecom/contract";
import type {
  CreatePosClientFormValues,
  UpdatePosClientFormValues,
} from "@/pages/admin/pos-clients/components/pos-client.schema";
import { usePosClientsList, useCreatePosClient, useUpdatePosClient } from "@/hooks/usePosClients";
import { useSales } from "@/hooks/useSales";
import { useClientPayments } from "@/hooks/useBilling";
import { useCatalogClientCategories } from "@/hooks/useClientCategories";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-11 — Sprint 5 wiring. Sales/payments both fetch as soon as a row is clicked (see
// pos-client-detail-drawer.tsx's header comment — Credit history needs both regardless of
// which sub-tab is open). `onRecordPayment` is left unwired — the payment-recording flow has no
// page in this set (scope confinement, same rule the reservations holder chip follows).
export default function AdminPosClients() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<PosClientDto | null>(null);
  const [detailClient, setDetailClient] = useState<PosClientDto | null>(null);

  const clientsQuery = useMemo(() => ({ page: currentPage, limit: 10 }), [currentPage]);
  const clients = usePosClientsList(clientsQuery);
  const categories = useCatalogClientCategories();
  const createPosClient = useCreatePosClient();
  const updatePosClient = useUpdatePosClient();

  const categoryOptions: AutocompleteOption[] = useMemo(
    () => (categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    [categories.data],
  );

  const detailQuery = useMemo(
    () => ({ posClientId: detailClient?.id, page: 1, limit: 50 }),
    [detailClient?.id],
  );
  const sales = useSales("admin", detailQuery, { enabled: !!detailClient });
  const payments = useClientPayments(detailQuery, { enabled: !!detailClient });

  const creditHistory = useMemo(() => {
    const saleRows = (sales.data?.items ?? [])
      .filter((s) => s.previousCredit !== undefined && s.newCredit !== undefined && s.soldAt)
      .map((s) => ({
        id: `sale-${s.id}`,
        date: s.soldAt as string,
        previousCredit: s.previousCredit as number,
        newCredit: s.newCredit as number,
      }));
    const paymentRows = (payments.data?.items ?? []).map((p) => ({
      id: `payment-${p.reference}`,
      date: p.paidAt,
      previousCredit: p.previousCredit,
      newCredit: p.newCredit,
    }));
    return [...saleRows, ...paymentRows].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
    );
  }, [sales.data, payments.data]);

  const handleAdd = (values: CreatePosClientFormValues) => {
    createPosClient.mutate(values, {
      onSuccess: () => {
        toast.success(t("admin.posClients.createSuccess"));
        setIsAddOpen(false);
      },
    });
  };

  const handleEdit = (values: UpdatePosClientFormValues) => {
    if (!editingClient) return;
    updatePosClient.mutate(
      { id: editingClient.id, command: values },
      {
        onSuccess: () => {
          toast.success(t("admin.posClients.updateSuccess"));
          setEditingClient(null);
        },
      },
    );
  };

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
        data={clients.data}
        isLoading={clients.isLoading}
        isError={clients.isError}
        onRetry={() => clients.refetch()}
        onRowClick={setDetailClient}
        onEdit={setEditingClient}
        onPageChange={setCurrentPage}
      />

      <AddPosClientDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        categoryOptions={categoryOptions}
        onSave={handleAdd}
        isSaving={createPosClient.isPending}
      />

      <EditPosClientDialog
        open={!!editingClient}
        onOpenChange={(open) => !open && setEditingClient(null)}
        client={editingClient}
        categoryOptions={categoryOptions}
        onSave={handleEdit}
        isSaving={updatePosClient.isPending}
      />

      <PosClientDetailDrawer
        open={!!detailClient}
        onOpenChange={(open) => !open && setDetailClient(null)}
        client={detailClient}
        sales={sales.data?.items}
        salesLoading={sales.isLoading}
        salesError={sales.isError}
        payments={payments.data?.items}
        paymentsLoading={payments.isLoading}
        paymentsError={payments.isError}
        creditHistory={creditHistory}
      />
    </div>
  );
}
