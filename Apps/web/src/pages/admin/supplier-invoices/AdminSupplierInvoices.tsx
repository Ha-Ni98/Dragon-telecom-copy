import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SupplierInvoicesTable } from "@/pages/admin/supplier-invoices/components/supplier-invoices-table";
import { BarcodeLabelsDialog } from "@/pages/admin/supplier-invoices/components/barcode-labels-dialog";
import { usePurchasingInvoices } from "@/hooks/usePurchasingInvoices";
import { useTranslation } from "@/hooks/useTranslation";
import type { SupplierInvoiceDto } from "@dragon-telecom/contract";

// ADM-08 (list) — Sprint 6 wires `usePurchasingInvoices`. No filter primitive was built in
// Sprint 4 for this page (only the table + editor clusters) — left for a later polish pass
// rather than inventing new UI structure inside a wiring sprint (phase-file hard rule:
// primitives precede wiring, not the other way around).
// S26: each row also carries a print-barcodes action, opening the same dialog ADM-08's editor page
// uses — the list rows already hold the full DTO, so nothing extra is fetched.
export default function AdminSupplierInvoices() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  // S26 — which row's labels are being printed; null closes the dialog. The list rows already carry
  // the complete SupplierInvoiceDto (listInvoices uses the same INVOICE_INCLUDE as getInvoice), so
  // the row action reuses the detail page's dialog verbatim rather than fetching anything.
  const [labelsInvoice, setLabelsInvoice] = useState<SupplierInvoiceDto | null>(null);

  const invoicesQuery = useMemo(() => ({ page: currentPage, limit: 20 }), [currentPage]);
  const invoices = usePurchasingInvoices(invoicesQuery);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <PageHeader
          title={t("admin.supplierInvoices.title")}
          subtitle={t("admin.supplierInvoices.description")}
        />
        <Button asChild>
          <Link to="/admin/supplier-invoices/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("admin.supplierInvoices.addInvoice")}
          </Link>
        </Button>
      </div>

      <SupplierInvoicesTable
        data={invoices.data}
        isLoading={invoices.isLoading}
        isError={invoices.isError}
        onRetry={() => invoices.refetch()}
        onPageChange={setCurrentPage}
        onPrintBarcodes={setLabelsInvoice}
      />

      {labelsInvoice && (
        <BarcodeLabelsDialog
          // Fresh mount per invoice, same reason the editor page keys it.
          key={labelsInvoice.id}
          invoice={labelsInvoice}
          open={labelsInvoice !== null}
          onOpenChange={(open) => !open && setLabelsInvoice(null)}
        />
      )}
    </div>
  );
}
