import { PageHeader } from "@/components/shared/PageHeader";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-08 (editor) — route + shell only (Sprint 2, Foundation). Mounted at
// `/admin/supplier-invoices/:id`, where `id === "new"` is the create-flow sentinel (no separate
// `/new` route, to avoid a route-order clash — Sprint 2 §Risks) and a real id is the DRAFT/
// CONFIRMED edit flow; `?supplierId=` preselects the supplier on create (from ADM-07's "Add
// invoice" link). Both flows + `usePurchasingInvoiceDetail` land in Sprint 6.
export default function AdminSupplierInvoiceEditor() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.supplierInvoices.editor.title")} />
      <TableSkeleton rows={3} />
    </div>
  );
}
