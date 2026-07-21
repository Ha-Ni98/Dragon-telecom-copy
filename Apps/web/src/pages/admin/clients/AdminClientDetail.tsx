import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { LayoutDashboard, ShoppingCart, FileText, CreditCard, Search } from "lucide-react";
import { ClientDetailHeader } from "@/pages/admin/clients/components/client-detail-header";
import { ApprovalDialog } from "@/pages/admin/clients/components/approval-dialog";
import { ResetPasswordDialog } from "@/pages/admin/clients/components/reset-password-dialog";
import { BrowsingActivityTable } from "@/pages/admin/clients/components/browsing-activity-table";
import type { ApproveClientFormValues } from "@/pages/admin/clients/components/approve-client.schema";
import type { ResetClientPasswordFormValues } from "@/pages/admin/clients/components/reset-client-password.schema";
import type { AutocompleteOption } from "@/components/shared/autocomplete-input";
import {
  useClientDirectoryEntry,
  useApproveClient,
  useRejectClient,
  useResetClientPassword,
} from "@/hooks/useClientDirectory";
import { useClientActivity } from "@/hooks/useObservability";
import { useCatalogClientCategories } from "@/hooks/useClientCategories";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-12b — Sprint 7 wiring. `useClientActivity` has no per-tab `enabled` option (unlike
// `useSales`/`useInvoices`), so it fires once the client id is known rather than strictly on
// Browsing-tab activation — harmless here since it's the only tab that consumes it (Overview/
// Orders/Invoices/Payments stay EmptyState placeholders; no scoped hook exists for them per the
// plan's resolve-first section).
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
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
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
        </TabsList>

        <TabsContent value="overview">
          <EmptyState
            icon={<LayoutDashboard className="h-6 w-6" />}
            title={t("common.noDataAvailable")}
            body=""
          />
        </TabsContent>
        <TabsContent value="orders">
          <EmptyState
            icon={<ShoppingCart className="h-6 w-6" />}
            title={t("common.noDataAvailable")}
            body=""
          />
        </TabsContent>
        <TabsContent value="invoices">
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title={t("common.noDataAvailable")}
            body=""
          />
        </TabsContent>
        <TabsContent value="payments">
          <EmptyState
            icon={<CreditCard className="h-6 w-6" />}
            title={t("common.noDataAvailable")}
            body=""
          />
        </TabsContent>
        <TabsContent value="browsing">
          <BrowsingActivityTable data={activity.data ?? []} isLoading={activity.isLoading} />
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
