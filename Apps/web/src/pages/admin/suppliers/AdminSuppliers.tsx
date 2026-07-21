import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { AdminSuppliersStatsCards } from "@/pages/admin/suppliers/components/admin-suppliers-stats-cards";
import { AdminSuppliersTable } from "@/pages/admin/suppliers/components/admin-suppliers-table";
import { AdminSupplierAddDialog } from "@/pages/admin/suppliers/components/admin-supplier-add-dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { CreateSupplierFormValues } from "@/pages/admin/suppliers/components/supplier.schema";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-07 — retyped onto SupplierDto/SupplierStatsDto (Sprint 3, presentational only). Data is a
// local placeholder (`undefined`/`isLoading: false`) instead of the incompatible stub hook
// `use-admin-suppliers` (numeric-id view-models) — Sprint 6 swaps this for
// `usePurchasingSuppliers`/`usePurchasingSupplierStats`/`useCreatePurchasingSupplier`, at which
// point the shell below needs no further prop-shape changes.
export default function AdminSuppliers() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  useDebouncedValue(searchQuery, 300);

  const handleEdit = useCallback(
    (supplierId: string) => navigate(`/admin/suppliers/${supplierId}`),
    [navigate],
  );
  const handleDisable = useCallback((_supplierId: string) => {}, []);
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);
  const handleAddSupplierSave = useCallback(async (_data: CreateSupplierFormValues) => {
    setIsAddDialogOpen(false);
  }, []);

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

      <AdminSuppliersStatsCards stats={undefined} loading={false} error={null} />

      <AdminSuppliersTable
        data={undefined}
        loading={false}
        error={null}
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
        loading={false}
      />
    </div>
  );
}
