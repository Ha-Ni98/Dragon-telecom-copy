import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { PosClientsTable } from "@/pages/admin/pos-clients/components/pos-clients-table";
import { AddPosClientDialog } from "@/pages/admin/pos-clients/components/add-pos-client-dialog";
import { EditPosClientDialog } from "@/pages/admin/pos-clients/components/edit-pos-client-dialog";
import { PosClientDetailDrawer } from "@/pages/admin/pos-clients/components/pos-client-detail-drawer";
import type { AutocompleteOption } from "@/components/shared/autocomplete-input";
import type { ClientPaymentDto, PosClientDto } from "@dragon-telecom/contract";
import type { RecordClientPaymentFormValues } from "@/pages/staff/invoices/record-client-payment.schema";
import { RecordPaymentDialog } from "@/pages/staff/invoices/components/RecordPaymentDialog";
import type {
  CreatePosClientFormValues,
  UpdatePosClientFormValues,
} from "@/pages/admin/pos-clients/components/pos-client.schema";
import { usePosClientsList, useCreatePosClient, useUpdatePosClient } from "@/hooks/usePosClients";
import { useSales } from "@/hooks/useSales";
import { useClientPayments, useCreateClientPayment } from "@/hooks/useBilling";
import { useCatalogClientCategories } from "@/hooks/useClientCategories";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  scope?: "staff" | "admin";
}

// ADM-11 — Sprint 5 wiring. S18/D-5 — full staff/admin parity (scope-driven twin, same shape as
// StaffOrders/StaffSales/StaffRepairs/StaffInvoices/StaffPos): the staff POS-clients page shares
// this exact tree with `/admin/pos-clients`, including the detail drawer's Sales/Payments/
// Credit-history tabs. Sales/payments both fetch as soon as a row is clicked (see
// pos-client-detail-drawer.tsx's header comment — Credit history needs both regardless of which
// sub-tab is open). S34 — Record payment works in both scopes (staff route, guarded by
// STAFF_POS_CLIENTS or STAFF_INVOICES) and echoes the ledger row's previous → new credit after
// submit; the list has a name/phone/code search.
export default function StaffPosClients({ scope = "staff" }: Props) {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<PosClientDto | null>(null);
  const [detailClient, setDetailClient] = useState<PosClientDto | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<PosClientDto | null>(null);
  const [paymentResult, setPaymentResult] = useState<ClientPaymentDto | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  // S34 — name/phone/code search, matched server-side (PosClientListQuery.search). The search box
  // lives in the page, not the table: the table swaps to a skeleton while loading, which would
  // unmount the input and drop focus on every keystroke.
  const clientsQuery = useMemo(
    () => ({ search: debouncedSearch.trim() || undefined, page: currentPage, limit: 10 }),
    [debouncedSearch, currentPage],
  );
  const clients = usePosClientsList(scope, clientsQuery);
  const categories = useCatalogClientCategories();
  const createPosClient = useCreatePosClient();
  const [paymentAmount, setPaymentAmount] = useState(0);
  const updatePosClient = useUpdatePosClient();
  const createClientPayment = useCreateClientPayment();

  const categoryOptions: AutocompleteOption[] = useMemo(
    () => (categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    [categories.data],
  );

  // S34 — sends `scope` (it was hard-coded to "admin", so every staff submit hit the admin-only
  // route and got a 403). The dialog stays open on its result view: the server's own
  // previous → new credit snapshot is echoed, not a client-side subtraction.
  const handleRecordPaymentSubmit = (values: RecordClientPaymentFormValues) => {
    createClientPayment.mutate(
      { scope, command: values },
      {
        onSuccess: (created) => {
          toast.success(t("admin.clients.recordPayment.success"));
          setPaymentResult(created);
        },
      },
    );
  };

  // Closing (Cancel, overlay, or the result view's Close) always resets the amount and the result —
  // the amount used to survive a dismissal and pre-fill the next client's dialog (report-S34 F6).
  const closePaymentDialog = () => {
    setPaymentTarget(null);
    setPaymentAmount(0);
    setPaymentResult(null);
  };

  const detailQuery = useMemo(
    () => ({ posClientId: detailClient?.id, page: 1, limit: 50 }),
    [detailClient?.id],
  );
  const sales = useSales(scope, detailQuery, { enabled: !!detailClient });
  const payments = useClientPayments(scope, detailQuery, { enabled: !!detailClient });

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
    createPosClient.mutate(
      { scope, command: values },
      {
        onSuccess: () => {
          toast.success(t("admin.posClients.createSuccess"));
          setIsAddOpen(false);
        },
      },
    );
  };

  const handleEdit = (values: UpdatePosClientFormValues) => {
    if (!editingClient) return;
    updatePosClient.mutate(
      { scope, id: editingClient.id, command: values },
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
          title={scope === "admin" ? t("admin.posClients.title") : t("staff.posClients.title")}
          subtitle={
            scope === "admin"
              ? t("admin.posClients.description")
              : t("staff.posClients.description")
          }
        />
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("admin.posClients.addClient")}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("admin.posClients.searchPlaceholder")}
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setCurrentPage(1);
          }}
          className="pl-10"
        />
      </div>

      <PosClientsTable
        data={clients.data}
        isLoading={clients.isLoading}
        isError={clients.isError}
        onRetry={() => clients.refetch()}
        onRowClick={setDetailClient}
        onEdit={setEditingClient}
        onPageChange={setCurrentPage}
        onRecordPayment={setPaymentTarget}
        scope={scope}
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
        scope={scope}
      />

      {paymentTarget?.id && (
        <RecordPaymentDialog
          key={paymentTarget.id}
          open={!!paymentTarget}
          onOpenChange={(open) => !open && closePaymentDialog()}
          posClientId={paymentTarget.id}
          previousCredit={paymentTarget?.credit ?? 0}
          amount={paymentAmount}
          onAmountChange={setPaymentAmount}
          onSubmit={handleRecordPaymentSubmit}
          isSubmitting={createClientPayment.isPending}
          result={paymentResult}
        />
      )}
    </div>
  );
}
