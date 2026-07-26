import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { AdminSuppliersStatsCards } from "@/pages/admin/suppliers/components/admin-suppliers-stats-cards";
import { AdminSuppliersTable } from "@/pages/admin/suppliers/components/admin-suppliers-table";
import { AdminSupplierAddDialog } from "@/pages/admin/suppliers/components/admin-supplier-add-dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { CreateSupplierFormValues } from "@/pages/admin/suppliers/components/supplier.schema";
import {
  usePurchasingSuppliers,
  usePurchasingSupplierStats,
  useCreatePurchasingSupplier,
  useUpdatePurchasingSupplier,
} from "@/hooks/usePurchasingSuppliers";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-07 (list) — Sprint 6 rewire onto `usePurchasingSuppliers`. The Sprint-3 scaffold called
// `useDebouncedValue` but never captured its return value (a no-op) — fixed here now that the
// debounced term actually feeds a query.
export default function AdminSuppliers() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const suppliersQuery = useMemo(
    () => ({ search: debouncedSearch || undefined, page: currentPage, limit: 10 }),
    [debouncedSearch, currentPage],
  );
  const suppliers = usePurchasingSuppliers(suppliersQuery);
  const stats = usePurchasingSupplierStats();
  const createSupplier = useCreatePurchasingSupplier();
  const updateSupplier = useUpdatePurchasingSupplier();

  const handleEdit = useCallback(
    (supplierId: string) => navigate(`/admin/suppliers/${supplierId}`),
    [navigate],
  );

  const handleDisable = useCallback(
    (supplierId: string) => {
      updateSupplier.mutate(
        { id: supplierId, command: { isEnabled: false } },
        { onSuccess: () => toast.success(t("admin.suppliers.disableSuccess")) },
      );
    },
    [updateSupplier, t],
  );

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  const handleAddSupplierSave = useCallback(
    async (data: CreateSupplierFormValues) => {
      try {
        await createSupplier.mutateAsync(data);
        toast.success(t("admin.suppliers.createSuccess"));
        setIsAddDialogOpen(false);
      } catch {
        // Global mutationCache toast (query-client.ts) already surfaces the failure; keep the
        // dialog open so the admin can retry without re-filling the form.
      }
    },
    [createSupplier, t],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <PageHeader
          title={t("admin.suppliers.title")}
          subtitle={t("admin.suppliers.description")}
        />
        <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("admin.suppliers.addSupplier")}
        </Button>
      </div>

      <AdminSuppliersStatsCards
        stats={stats.data}
        loading={stats.isLoading}
        error={stats.isError ? t("admin.suppliers.statsError") : null}
        onRetry={() => stats.refetch()}
      />

      <AdminSuppliersTable
        data={suppliers.data}
        loading={suppliers.isLoading}
        error={suppliers.isError ? t("admin.suppliers.error") : null}
        onRetry={() => suppliers.refetch()}
        onEdit={handleEdit}
        onDisable={handleDisable}
        onPageChange={setCurrentPage}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
      />

      <AdminSupplierAddDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSave={handleAddSupplierSave}
        loading={createSupplier.isPending}
      />
    </div>
  );
}
