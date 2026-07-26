import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Plus, Tag, Trash2, Edit, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { EnabledBadge } from "@/components/shared/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import type { ClientCategoryDto } from "@dragon-telecom/contract";
import {
  useCatalogClientCategories,
  useCreateCatalogClientCategory,
  useUpdateCatalogClientCategory,
} from "@/hooks/useClientCategories";
import type {
  CreateClientCategoryFormValues,
  UpdateClientCategoryFormValues,
} from "@/pages/admin/settings/components/client-category.schema";
import { ClientCategoryDialog } from "./client-category-dialog";

interface ClientCategoriesSectionProps {
  className?: string;
}

// ADM-17 Settings Categories tab — retyped off ClientCategoryDto (catalog.dtos.ts): `id` (uuid,
// was `idCategory: number`), `isEnabled` (was a local `CategoryStatusCode` enum),
// `memberCount`/`pricedProductCount` (the plan's "member/priced-product warning columns" — the
// old view-model had neither). Sprint 8 wiring: `useCatalogClientCategories`/`useCreate/
// UpdateCatalogClientCategory` (useClientCategories.ts). Delete is disable-only (no
// `useDeleteClientCategory` on the real hook — categories are never hard-deleted).
export function ClientCategoriesSection({ className }: ClientCategoriesSectionProps) {
  const { t } = useTranslation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ClientCategoryDto | null>(null);

  const categoriesQuery = useCatalogClientCategories();
  const createCategory = useCreateCatalogClientCategory();
  const updateCategory = useUpdateCatalogClientCategory();

  const categories = categoriesQuery.data ?? [];
  const isLoading = categoriesQuery.isLoading;
  const isError = categoriesQuery.isError;

  const openEditDialog = useCallback((category: ClientCategoryDto) => {
    setSelectedCategory(category);
    setIsEditDialogOpen(true);
  }, []);

  const handleCreate = (values: CreateClientCategoryFormValues) => {
    createCategory.mutate(values, {
      onSuccess: () => {
        toast.success(t("admin.settings.categories.createSuccess"));
        setIsAddDialogOpen(false);
      },
    });
  };

  const handleUpdate = (values: UpdateClientCategoryFormValues) => {
    if (!selectedCategory) return;
    updateCategory.mutate(
      { id: selectedCategory.id, command: values },
      {
        onSuccess: () => {
          toast.success(t("admin.settings.categories.updateSuccess"));
          setIsEditDialogOpen(false);
          setSelectedCategory(null);
        },
      },
    );
  };

  const handleDisable = useCallback(
    (category: ClientCategoryDto) => {
      updateCategory.mutate({ id: category.id, command: { isEnabled: false } });
    },
    [updateCategory],
  );

  const columns = useMemo<ColumnDef<ClientCategoryDto>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("admin.clients.categories.name"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-medium">
            <Tag className="h-4 w-4 text-muted-foreground" />
            {row.original.name}
          </div>
        ),
      },
      {
        accessorKey: "isEnabled",
        header: t("common.labels.status"),
        cell: ({ row }) => <EnabledBadge isEnabled={row.original.isEnabled} />,
      },
      {
        accessorKey: "memberCount",
        header: t("admin.settings.categories.memberCount"),
        cell: ({ row }) => row.original.memberCount,
      },
      {
        accessorKey: "pricedProductCount",
        header: t("admin.settings.categories.pricedProductCount"),
        cell: ({ row }) => row.original.pricedProductCount,
      },
      {
        id: "actions",
        header: () => <div className="text-right">{t("common.actions.action")}</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => openEditDialog(row.original)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={!row.original.isEnabled}
              onClick={() => handleDisable(row.original)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [t, openEditDialog, handleDisable],
  );

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                {t("admin.clients.categories.title")}
              </CardTitle>
              <CardDescription>{t("admin.clients.categories.description")}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => categoriesQuery.refetch()}
                disabled={isLoading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("common.actions.refresh")}
              </Button>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("admin.clients.categories.add")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={3} columns={4} />
          ) : isError ? (
            <NotFoundState
              icon={<Tag className="h-6 w-6" />}
              title={t("admin.clients.categories.loadError")}
              body={t("admin.clients.categories.description")}
              action={
                <Button variant="outline" size="sm" onClick={() => categoriesQuery.refetch()}>
                  {t("common.retry")}
                </Button>
              }
            />
          ) : (
            <DataTable
              columns={columns}
              data={categories}
              getRowKey={(category) => category.id}
              renderMobileRow={(category) => (
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      {category.name}
                    </div>
                    <EnabledBadge isEnabled={category.isEnabled} />
                  </div>
                  <div className="flex justify-end gap-2 border-t pt-2">
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(category)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              emptyState={
                <EmptyState
                  icon={<Tag className="h-6 w-6" />}
                  title={t("admin.clients.categories.noCategoriesFound")}
                  body={t("admin.clients.categories.description")}
                />
              }
            />
          )}
        </CardContent>
      </Card>

      <ClientCategoryDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSave={(data) => handleCreate(data as CreateClientCategoryFormValues)}
        isSaving={createCategory.isPending}
      />

      {selectedCategory && (
        <ClientCategoryDialog
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setSelectedCategory(null);
          }}
          onSave={(data) => handleUpdate(data as UpdateClientCategoryFormValues)}
          category={selectedCategory}
          isSaving={updateCategory.isPending}
        />
      )}
    </div>
  );
}
