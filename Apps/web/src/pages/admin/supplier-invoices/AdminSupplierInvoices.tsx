import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SupplierInvoicesTable } from "@/pages/admin/supplier-invoices/components/supplier-invoices-table";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-08 (list) — page-local primitives assembled (Sprint 4, no data yet). Sprint 6 wires
// `usePurchasingInvoices`.
export default function AdminSupplierInvoices() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);

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

      <SupplierInvoicesTable data={undefined} isLoading={false} onPageChange={setCurrentPage} />
    </div>
  );
}
