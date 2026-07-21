import { PageHeader } from "@/components/shared/PageHeader";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-08 (list) — route + shell only (Sprint 2, Foundation). Wires onto `usePurchasingInvoices`
// in Sprint 6, after the primitive sprints (3-4) build the real table/filters.
export default function AdminSupplierInvoices() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.supplierInvoices.title")}
        subtitle={t("admin.supplierInvoices.description")}
      />
      <TableSkeleton />
    </div>
  );
}
