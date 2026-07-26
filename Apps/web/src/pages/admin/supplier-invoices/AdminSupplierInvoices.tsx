import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SupplierInvoicesTable } from "@/pages/admin/supplier-invoices/components/supplier-invoices-table";
import { usePurchasingInvoices } from "@/hooks/usePurchasingInvoices";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-08 (list) — Sprint 6 wires `usePurchasingInvoices`. No filter primitive was built in
// Sprint 4 for this page (only the table + editor clusters) — left for a later polish pass
// rather than inventing new UI structure inside a wiring sprint (phase-file hard rule:
// primitives precede wiring, not the other way around).
export default function AdminSupplierInvoices() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);

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
      />
    </div>
  );
}
