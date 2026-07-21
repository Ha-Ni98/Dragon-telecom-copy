import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { SupplierInformationHeader } from "@/pages/admin/suppliers/components/supplier-information-header";
import { SupplierDetailsSection } from "@/pages/admin/suppliers/components/supplier-details-section";
import { SupplierFinancialSummary } from "@/pages/admin/suppliers/components/supplier-financial-summary";
import { SupplierInvoicesTable } from "@/pages/admin/suppliers/components/supplier-invoices-table";
import { SupplierProductHistoryTable } from "@/pages/admin/suppliers/components/supplier-product-history-table";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { Skeleton } from "@/components/ui/skeleton";
import type { UpdateSupplierFormValues } from "@/pages/admin/suppliers/components/supplier.schema";
import type { SupplierDetailDto } from "@dragon-telecom/contract";

// ADM-07 detail — retyped off SupplierDetailDto (Sprint 3, presentational only). `data` is a
// local placeholder instead of the incompatible stub hook `use-supplier-information`
// (numeric-id view-model) — Sprint 6 swaps this for `usePurchasingSupplierDetail(id)`, at which
// point the shell below needs no further prop-shape changes.
export default function AdminSupplierInformation() {
  const { idSupplier: id } = useParams<{ idSupplier: string }>();
  const { t } = useTranslation();

  // useState (not a literal `const`) so the placeholder value doesn't collapse the branches
  // below to unreachable/`never` under TS control-flow narrowing — Sprint 6 replaces these
  // three lines with `usePurchasingSupplierDetail(id)`'s real return.
  const [data] = useState<SupplierDetailDto | undefined>(undefined);
  const [isLoading] = useState(false);
  const [isError] = useState(false);

  const handleSave = async (_data: UpdateSupplierFormValues) => {};
  const handleRefresh = () => {};

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !id || !data) {
    return (
      <NotFoundState title={t("admin.suppliers.notFound")} body={t("common.errors.notFoundBody")} />
    );
  }

  return (
    <main className="space-y-6">
      <SupplierInformationHeader supplier={data.supplier} onRefresh={handleRefresh} />
      <SupplierDetailsSection supplier={data.supplier} onSave={handleSave} />
      <SupplierFinancialSummary supplier={data.supplier} />
      <SupplierInvoicesTable invoices={data.invoices} />
      <SupplierProductHistoryTable productHistory={data.productHistory} />
    </main>
  );
}
