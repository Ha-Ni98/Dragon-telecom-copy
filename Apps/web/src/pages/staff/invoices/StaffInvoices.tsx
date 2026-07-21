import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { InvoicesTable } from "@/pages/staff/invoices/components/InvoicesTable";
import { InvoiceSnapshotView } from "@/pages/staff/invoices/components/InvoiceSnapshotView";
import { RecordPaymentDialog } from "@/pages/staff/invoices/components/RecordPaymentDialog";
import { IncomingInvoicesTable } from "@/pages/admin/invoices/components/IncomingInvoicesTable";
import { PaymentsLedger } from "@/pages/admin/invoices/components/PaymentsLedger";
import { SupplierPaymentDialog } from "@/pages/admin/invoices/components/SupplierPaymentDialog";
import { CancelInvoiceDialog } from "@/pages/admin/invoices/components/CancelInvoiceDialog";
import {
  useMyInvoices,
  useMyInvoice,
  useMyInvoicePdf,
  useInvoices,
  useInvoice,
  useInvoicePdf,
  useCancelInvoice,
  useCreateClientPayment,
  useClientPayments,
} from "@/hooks/useBilling";
import { usePurchasingInvoices } from "@/hooks/usePurchasingInvoices";
import { usePurchasingPayments, useCreatePurchasingPayment } from "@/hooks/usePurchasingPayments";
import { useTranslation } from "@/hooks/useTranslation";
import { downloadBlob } from "@/lib/utils";
import type { InvoiceListQuery, SupplierInvoiceDto } from "@dragon-telecom/contract";
import type { RecordClientPaymentFormValues } from "@/pages/staff/invoices/record-client-payment.schema";
import type { RecordSupplierPaymentFormValues } from "@/pages/admin/invoices/components/record-supplier-payment.schema";
import type { CancelInvoiceFormValues } from "@/pages/admin/invoices/components/cancel-invoice.schema";

interface Props {
  scope?: "staff" | "admin";
}

type AdminTab = "outgoing" | "incoming" | "payments";

// STF-06 `/staff/invoices` (single outgoing-mine table) = ADM-14 `/admin/invoices` (adds
// Incoming + Payments tabs). set-03 Sprint 6 wiring. Two Sprint-4 gaps filled here (documented
// in report-sprint-06.md, same "small + acceptance-criteria-required" precedent as OrderShowDialog's
// action footer): InvoiceSnapshotView had no cancel/record-payment buttons, and
// IncomingInvoicesTable had no onRowClick — the only entry point for "record supplier payment"
// once the table is kept read-only for invoice edits themselves.
export default function StaffInvoices({ scope = "staff" }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AdminTab>("outgoing");
  const [page, setPage] = useState(1);

  const outgoingQuery: InvoiceListQuery = useMemo(() => ({ page, limit: 20 }), [page]);

  const myInvoices = useMyInvoices(outgoingQuery);
  const adminInvoices = useInvoices("admin", outgoingQuery, {
    enabled: scope === "admin" && activeTab === "outgoing",
  });
  const outgoing = scope === "admin" ? adminInvoices : myInvoices;

  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const myInvoiceDetail = useMyInvoice(scope === "staff" ? (selectedNumber ?? "") : "");
  const adminInvoiceDetail = useInvoice("admin", scope === "admin" ? (selectedNumber ?? "") : "");
  const selectedInvoice = scope === "admin" ? adminInvoiceDetail.data : myInvoiceDetail.data;

  const myPdfMutation = useMyInvoicePdf();
  const adminPdfMutation = useInvoicePdf();

  const handleDownloadPdf = () => {
    if (!selectedNumber) return;
    if (scope === "admin") {
      adminPdfMutation.mutate(
        { scope: "admin", number: selectedNumber },
        {
          onSuccess: (blob) => downloadBlob(`${selectedNumber}.pdf`, blob),
          onError: () => toast.error(t("staff.invoices.table.error")),
        },
      );
    } else {
      myPdfMutation.mutate(selectedNumber, {
        onSuccess: (blob) => downloadBlob(`${selectedNumber}.pdf`, blob),
        onError: () => toast.error(t("staff.invoices.table.error")),
      });
    }
  };

  const cancelMutation = useCancelInvoice();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const handleCancelSubmit = (values: CancelInvoiceFormValues) => {
    if (!selectedNumber) return;
    cancelMutation.mutate(
      { number: selectedNumber, command: values },
      { onSuccess: () => setCancelDialogOpen(false) },
    );
  };

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const createClientPayment = useCreateClientPayment();
  const handleRecordPaymentSubmit = (values: RecordClientPaymentFormValues) => {
    createClientPayment.mutate(
      { scope, command: values },
      { onSuccess: () => setPaymentDialogOpen(false) },
    );
  };

  const incomingQuery = useMemo(() => ({ page: 1, limit: 20 }), []);
  const incoming = usePurchasingInvoices(incomingQuery, {
    enabled: scope === "admin" && activeTab === "incoming",
  });

  const paymentsQuery = useMemo(() => ({ page: 1, limit: 20 }), []);
  const clientPayments = useClientPayments(paymentsQuery, {
    enabled: scope === "admin" && activeTab === "payments",
  });
  const supplierPayments = usePurchasingPayments(paymentsQuery, {
    enabled: scope === "admin" && activeTab === "payments",
  });

  const [supplierPaymentTarget, setSupplierPaymentTarget] = useState<SupplierInvoiceDto | null>(
    null,
  );
  const [supplierPaymentAmount, setSupplierPaymentAmount] = useState(0);
  const createSupplierPayment = useCreatePurchasingPayment();
  const handleSupplierPaymentSubmit = (values: RecordSupplierPaymentFormValues) => {
    createSupplierPayment.mutate(values, { onSuccess: () => setSupplierPaymentTarget(null) });
  };

  const outgoingTable = (
    <>
      <InvoicesTable
        invoices={outgoing.data?.items}
        isLoading={outgoing.isLoading}
        isError={outgoing.isError}
        onRetry={() => outgoing.refetch()}
        onRowClick={(invoice) => setSelectedNumber(invoice.number)}
      />
      {outgoing.data && outgoing.data.meta.totalPages > 1 && (
        <SimplePagination
          page={outgoing.data.meta.page}
          totalPages={outgoing.data.meta.totalPages}
          onPageChange={setPage}
        />
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={scope === "admin" ? t("admin.invoices.pageTitle") : t("staff.invoices.pageTitle")}
      />

      {scope === "admin" ? (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AdminTab)}>
          <TabsList>
            <TabsTrigger value="outgoing">{t("admin.invoices.tabs.outgoing")}</TabsTrigger>
            <TabsTrigger value="incoming">{t("admin.invoices.tabs.incoming")}</TabsTrigger>
            <TabsTrigger value="payments">{t("admin.invoices.tabs.payments")}</TabsTrigger>
          </TabsList>
          <TabsContent value="outgoing" className="space-y-4">
            {outgoingTable}
          </TabsContent>
          <TabsContent value="incoming">
            <IncomingInvoicesTable
              invoices={incoming.data?.items}
              isLoading={incoming.isLoading}
              isError={incoming.isError}
              onRetry={() => incoming.refetch()}
              onRowClick={setSupplierPaymentTarget}
            />
          </TabsContent>
          <TabsContent value="payments">
            <PaymentsLedger
              clientPayments={clientPayments.data?.items}
              isClientLoading={clientPayments.isLoading}
              supplierPayments={supplierPayments.data?.items}
              isSupplierLoading={supplierPayments.isLoading}
            />
          </TabsContent>
        </Tabs>
      ) : (
        outgoingTable
      )}

      <Dialog open={!!selectedNumber} onOpenChange={(open) => !open && setSelectedNumber(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("staff.invoices.snapshot.title")}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <InvoiceSnapshotView
              invoice={selectedInvoice}
              onDownloadPdf={handleDownloadPdf}
              onPrint={() => window.print()}
              scope={scope}
              onCancel={scope === "admin" ? () => setCancelDialogOpen(true) : undefined}
              onRecordPayment={() => setPaymentDialogOpen(true)}
            />
          )}
        </DialogContent>
      </Dialog>

      {selectedInvoice?.posClientId && (
        <RecordPaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          posClientId={selectedInvoice.posClientId}
          invoiceNumber={selectedInvoice.number}
          previousCredit={selectedInvoice.newCredit ?? 0}
          amount={paymentAmount}
          onAmountChange={setPaymentAmount}
          onSubmit={handleRecordPaymentSubmit}
          isSubmitting={createClientPayment.isPending}
        />
      )}

      {scope === "admin" && (
        <CancelInvoiceDialog
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
          invoice={selectedInvoice ?? null}
          onSubmit={handleCancelSubmit}
          isSubmitting={cancelMutation.isPending}
        />
      )}

      {scope === "admin" && (
        <SupplierPaymentDialog
          open={!!supplierPaymentTarget}
          onOpenChange={(open) => !open && setSupplierPaymentTarget(null)}
          supplierId={supplierPaymentTarget?.supplierId ?? ""}
          supplierInvoiceReference={supplierPaymentTarget?.reference}
          previousCredit={supplierPaymentTarget?.newCredit ?? 0}
          amount={supplierPaymentAmount}
          onAmountChange={setSupplierPaymentAmount}
          onSubmit={handleSupplierPaymentSubmit}
          isSubmitting={createSupplierPayment.isPending}
        />
      )}
    </div>
  );
}
