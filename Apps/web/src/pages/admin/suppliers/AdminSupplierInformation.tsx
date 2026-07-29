import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";
import { SupplierInformationHeader } from "@/pages/admin/suppliers/components/supplier-information-header";
import { SupplierDetailsSection } from "@/pages/admin/suppliers/components/supplier-details-section";
import { SupplierFinancialSummary } from "@/pages/admin/suppliers/components/supplier-financial-summary";
import { SupplierInvoicesTable } from "@/pages/admin/suppliers/components/supplier-invoices-table";
import { SupplierProductHistoryTable } from "@/pages/admin/suppliers/components/supplier-product-history-table";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { Skeleton } from "@/components/ui/skeleton";
import type { UpdateSupplierFormValues } from "@/pages/admin/suppliers/components/supplier.schema";
import {
  usePurchasingSupplierDetail,
  useUpdatePurchasingSupplier,
} from "@/hooks/usePurchasingSuppliers";

// ADM-07 detail — Sprint 6 rewire onto `usePurchasingSupplierDetail`/`useUpdatePurchasingSupplier`.
export default function AdminSupplierInformation() {
  const { idSupplier: id } = useParams<{ idSupplier: string }>();
  const { t } = useTranslation();

  const { data, isLoading, isError, refetch } = usePurchasingSupplierDetail(id ?? "");
  const updateSupplier = useUpdatePurchasingSupplier();

  const handleSave = async (values: UpdateSupplierFormValues) => {
    if (!id) return;
    try {
      await updateSupplier.mutateAsync({ id, command: values });
      toast.success(t("admin.suppliers.updateSuccess"));
    } catch {
      // Global mutationCache toast (query-client.ts) already surfaces the failure.
    }
  };

  // S7 I12 — re-enable from the detail page too, mirroring the list's toggle.
  const handleEnable = () => {
    if (!id) return;
    updateSupplier.mutate(
      { id, command: { isEnabled: true } },
      { onSuccess: () => toast.success(t("admin.suppliers.enableSuccess")) },
    );
  };

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

  const isDisabled = !data.supplier.isEnabled;

  return (
    <main className="space-y-6">
      <SupplierInformationHeader
        supplier={data.supplier}
        onRefresh={() => refetch()}
        onEnable={isDisabled ? handleEnable : undefined}
      />
      <SupplierDetailsSection
        supplier={data.supplier}
        onSave={handleSave}
        saving={updateSupplier.isPending}
        readOnly={isDisabled}
      />
      <SupplierFinancialSummary supplier={data.supplier} />
      <SupplierInvoicesTable invoices={data.invoices} />
      <SupplierProductHistoryTable productHistory={data.productHistory} />
    </main>
  );
}
