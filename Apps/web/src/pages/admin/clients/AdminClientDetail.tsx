import { useState } from "react";
import { useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { LayoutDashboard, ShoppingCart, FileText, CreditCard, Search } from "lucide-react";
import { ClientDetailHeader } from "@/pages/admin/clients/components/client-detail-header";
import { ApprovalDialog } from "@/pages/admin/clients/components/approval-dialog";
import { ResetPasswordDialog } from "@/pages/admin/clients/components/reset-password-dialog";
import { BrowsingActivityTable } from "@/pages/admin/clients/components/browsing-activity-table";
import type { AdminClientDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-12b — page-local primitives assembled (Sprint 4, no data yet). Sprint 7 wires
// `useClientDirectoryEntry` + `useClientActivity` (lazy per tab) +
// `useApproveClient`/`useRejectClient`/`useResetClientPassword`.
export default function AdminClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const [client] = useState<AdminClientDto | undefined>(undefined);
  const [isLoading] = useState(false);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);

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
          <BrowsingActivityTable data={[]} isLoading={false} />
        </TabsContent>
      </Tabs>

      <ApprovalDialog
        open={isApprovalOpen}
        onOpenChange={setIsApprovalOpen}
        client={client}
        categoryOptions={[]}
        onApprove={() => setIsApprovalOpen(false)}
        onReject={() => setIsApprovalOpen(false)}
      />

      <ResetPasswordDialog
        open={isResetPasswordOpen}
        onOpenChange={setIsResetPasswordOpen}
        onSave={() => setIsResetPasswordOpen(false)}
      />
    </div>
  );
}
