import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { NotFoundState } from "@/components/shared/NotFoundState";
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  CreditCard,
  Search,
  ShoppingBag,
} from "lucide-react";
import { ClientDetailHeader } from "@/pages/admin/clients/components/client-detail-header";
import { ApprovalDialog } from "@/pages/admin/clients/components/approval-dialog";
import { ResetPasswordDialog } from "@/pages/admin/clients/components/reset-password-dialog";
import { BrowsingActivityTable } from "@/pages/admin/clients/components/browsing-activity-table";
import { ClientOverviewPanel } from "@/pages/admin/clients/components/client-overview-panel";
import { ClientPaymentsTable } from "@/pages/admin/clients/components/client-payments-table";
import { ClientPurchasedProductsTab } from "@/pages/admin/clients/components/client-purchased-products-tab";
import { OrdersTable } from "@/pages/staff/orders/components/OrdersTable";
import { InvoicesTable } from "@/pages/staff/invoices/components/InvoicesTable";
import type { ApproveClientFormValues } from "@/pages/admin/clients/components/approve-client.schema";
import type { ResetClientPasswordFormValues } from "@/pages/admin/clients/components/reset-client-password.schema";
import type { AutocompleteOption } from "@/components/shared/autocomplete-input";
import type { PurchaseHistoryOwner } from "@/types/purchase-history.types";
import type {
  BackofficeOrdersQuery,
  InvoiceListQuery,
  ClientPaymentListQuery,
} from "@dragon-telecom/contract";
import {
  useClientDirectoryEntry,
  useClientOverview,
  useApproveClient,
  useRejectClient,
  useResetClientPassword,
} from "@/hooks/useClientDirectory";
import { useOrdersList } from "@/hooks/useOrdersDirectory";
import { useInvoices, useClientPayments } from "@/hooks/useBilling";
import { useClientActivity } from "@/hooks/useObservability";
import { useCatalogClientCategories } from "@/hooks/useClientCategories";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-12b — Sprint 7 wiring, S8 J4 fills in the four previously-empty tabs. `useClientActivity`
// (and, per the same precedent, `useOrdersList`/`useClientOverview`) has no per-tab `enabled`
// option (unlike `useInvoices`/`useClientPayments`), so it fires once the client id is known
// rather than strictly on tab activation — harmless, since Overview/Orders load instantly and
// are cheap single-client reads. Invoices/Payments are genuinely gated on `client?.posClientId`
// being known (a client who has never been approved has none), not on tab activation.
// S36 — sixth tab "Products bought" (ClientPurchasedProductsTab, keyed by this web Client id; the
// API also reads the linked POS client's sales). It fetches only when the tab opens.
export default function AdminClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [usernameError, setUsernameError] = useState<string | undefined>();

  const clientEntry = useClientDirectoryEntry(id ?? "");
  const client = clientEntry.data;
  const isLoading = clientEntry.isLoading;

  const activityQuery = useMemo(() => ({}), []);
  const activity = useClientActivity(id ?? "", activityQuery);

  const overview = useClientOverview(id ?? "");

  // Part of the purchase-history query key, so kept referentially stable.
  const purchaseOwner = useMemo<PurchaseHistoryOwner>(
    () => ({ kind: "client", id: id ?? "" }),
    [id],
  );

  const ordersQuery = useMemo(
    () => ({ clientId: id, page: 1, limit: 20 }) as BackofficeOrdersQuery,
    [id],
  );
  const orders = useOrdersList("admin", ordersQuery);

  const invoicesQuery = useMemo(
    () => ({ posClientId: client?.posClientId, page: 1, limit: 20 }) as InvoiceListQuery,
    [client?.posClientId],
  );
  const invoices = useInvoices("admin", invoicesQuery, { enabled: !!client?.posClientId });

  const paymentsQuery = useMemo(
    () => ({ posClientId: client?.posClientId, page: 1, limit: 20 }) as ClientPaymentListQuery,
    [client?.posClientId],
  );
  const payments = useClientPayments("admin", paymentsQuery, { enabled: !!client?.posClientId });

  const categories = useCatalogClientCategories();
  const categoryOptions: AutocompleteOption[] = useMemo(
    () => (categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    [categories.data],
  );

  const approveClient = useApproveClient();
  const rejectClient = useRejectClient();
  const resetPassword = useResetClientPassword();

  const handleApprove = (values: ApproveClientFormValues) => {
    if (!id) return;
    setUsernameError(undefined);
    approveClient.mutate(
      { id, command: values },
      {
        onSuccess: () => {
          toast.success(t("admin.clients.approval.success"));
          setIsApprovalOpen(false);
        },
        onError: (err) => {
          if (axios.isAxiosError(err) && err.response?.status === 409) {
            setUsernameError(t("admin.clients.approval.usernameTaken"));
          }
        },
      },
    );
  };

  const handleReject = () => {
    if (!id) return;
    rejectClient.mutate(
      { id, command: {} },
      {
        onSuccess: () => {
          toast.success(t("admin.clients.approval.rejectSuccess"));
          setIsApprovalOpen(false);
        },
      },
    );
  };

  const handleResetPassword = (values: ResetClientPasswordFormValues) => {
    if (!id) return;
    resetPassword.mutate(
      { id, command: { newPassword: values.newPassword } },
      {
        onSuccess: () => {
          toast.success(t("admin.clients.resetPassword.success"));
          setIsResetPasswordOpen(false);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <TableSkeleton rows={2} />
        <TableSkeleton rows={4} />
      </div>
    );
  }

  if (!id || !client) {
    return (
      <NotFoundState
        title={t("admin.clients.detail.notFound")}
        body={t("common.errors.notFoundBody")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ClientDetailHeader
        client={client}
        onApprove={() => setIsApprovalOpen(true)}
        onResetPassword={() => setIsResetPasswordOpen(true)}
      />

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.clients.detail.tabs.overview")}</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.clients.detail.tabs.orders")}</span>
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.clients.detail.tabs.invoices")}</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.clients.detail.tabs.payments")}</span>
          </TabsTrigger>
          <TabsTrigger value="browsing" className="gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.clients.detail.tabs.browsing")}</span>
          </TabsTrigger>
          <TabsTrigger value="purchased" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t("admin.clients.detail.tabs.purchasedProducts")}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ClientOverviewPanel overview={overview.data} isLoading={overview.isLoading} />
        </TabsContent>
        <TabsContent value="orders">
          <OrdersTable
            orders={orders.data?.items}
            isLoading={orders.isLoading}
            isError={orders.isError}
            onRetry={() => orders.refetch()}
          />
        </TabsContent>
        <TabsContent value="invoices">
          <InvoicesTable
            invoices={invoices.data?.items}
            isLoading={invoices.isLoading}
            isError={invoices.isError}
            onRetry={() => invoices.refetch()}
          />
        </TabsContent>
        <TabsContent value="payments">
          <ClientPaymentsTable payments={payments.data?.items} isLoading={payments.isLoading} />
        </TabsContent>
        <TabsContent value="browsing">
          <BrowsingActivityTable data={activity.data ?? []} isLoading={activity.isLoading} />
        </TabsContent>
        <TabsContent value="purchased">
          <ClientPurchasedProductsTab owner={purchaseOwner} />
        </TabsContent>
      </Tabs>

      <ApprovalDialog
        open={isApprovalOpen}
        onOpenChange={(open) => {
          setIsApprovalOpen(open);
          if (!open) setUsernameError(undefined);
        }}
        client={client}
        categoryOptions={categoryOptions}
        onApprove={handleApprove}
        onReject={handleReject}
        isSubmitting={approveClient.isPending || rejectClient.isPending}
        usernameError={usernameError}
      />

      <ResetPasswordDialog
        open={isResetPasswordOpen}
        onOpenChange={setIsResetPasswordOpen}
        onSave={handleResetPassword}
        isSaving={resetPassword.isPending}
      />
    </div>
  );
}
