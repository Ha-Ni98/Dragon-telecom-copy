/**
 * Client Categories Section Component
 * Manages client categories with status management functionality
 */

import { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Tag, ToggleLeft, ToggleRight, Trash2, Edit, AlertTriangle, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { DataTable } from '@/components/shared/DataTable';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { useTranslation } from '@/hooks/useTranslation';
import { ClientCategory, ClientCategoryFormData } from '@/types/draft-types';
import { CategoryStatusCode } from '@/types/draft-types/enums.types';
import { ClientCategoryDialog } from './client-category-dialog';
import {
  useClientCategories,
  useCreateClientCategory,
  useUpdateClientCategory,
  useDeleteClientCategory,
} from '@/hooks/use-admin-settings';

/**
 * Props for ClientCategoriesSection component
 */
interface ClientCategoriesSectionProps {
  /** Custom className for styling */
  className?: string;
}

/**
 * Client Categories Section Component
 * Displays client categories in a data table with CRUD operations
 */
export function ClientCategoriesSection({ className }: ClientCategoriesSectionProps) {
  const { t } = useTranslation();

  // State management
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ClientCategory | null>(null);

  // Data fetching hooks
  const { data: clientCategories, isLoading, error, refetch } = useClientCategories();
  const createCategoryMutation = useCreateClientCategory();
  const updateCategoryMutation = useUpdateClientCategory();
  const deleteCategoryMutation = useDeleteClientCategory();

  /**
   * Handle add client category
   */
  const handleAddCategory = (data: ClientCategoryFormData) => {
    createCategoryMutation.mutate(data, {
      onSuccess: () => {
        setIsAddDialogOpen(false);
      },
    });
  };

  /**
   * Handle edit client category
   */
  const handleEditCategory = (data: ClientCategoryFormData) => {
    if (selectedCategory) {
      updateCategoryMutation.mutate(
        { id: selectedCategory.idCategory, data },
        {
          onSuccess: () => {
            setIsEditDialogOpen(false);
            setSelectedCategory(null);
          },
        }
      );
    }
  };

  /**
   * Handle delete client category
   */
  const handleDeleteCategory = () => {
    if (selectedCategory) {
      deleteCategoryMutation.mutate(selectedCategory.idCategory, {
        onSuccess: () => {
          setIsDeleteDialogOpen(false);
          setSelectedCategory(null);
        },
      });
    }
  };

  /**
   * Handle status toggle
   */
  const handleStatusToggle = (category: ClientCategory) => {
    const newStatus = category.categoryStatus === CategoryStatusCode.active
      ? CategoryStatusCode.disabled
      : CategoryStatusCode.active;

    updateCategoryMutation.mutate({
      id: category.idCategory,
      data: {
        categoryName: category.categoryName,
        categoryStatus: newStatus,
      },
    });
  };

  /**
   * Open edit dialog
   */
  const openEditDialog = (category: ClientCategory) => {
    setSelectedCategory(category);
    setIsEditDialogOpen(true);
  };

  /**
   * Open delete dialog
   */
  const openDeleteDialog = (category: ClientCategory) => {
    setSelectedCategory(category);
    setIsDeleteDialogOpen(true);
  };

  /**
   * Get status label
   */
  const getStatusLabel = (status: CategoryStatusCode) => {
    switch (status) {
      case CategoryStatusCode.active:
        return t('common.status.active');
      case CategoryStatusCode.disabled:
        return t('common.status.disabled');
      default:
        return t('common.status.unknown');
    }
  };

  /**
   * Get status badge variant
   */
  const getStatusBadgeVariant = (status: CategoryStatusCode) => {
    switch (status) {
      case CategoryStatusCode.active:
        return 'default' as const;
      case CategoryStatusCode.disabled:
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  /**
   * Get status badge color
   */
  const getStatusBadgeColor = (status: CategoryStatusCode) => {
    switch (status) {
      case CategoryStatusCode.active:
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case CategoryStatusCode.disabled:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  /**
   * Check if any operation is in progress
   */
  const isAnyOperationInProgress =
    createCategoryMutation.isPending ||
    updateCategoryMutation.isPending ||
    deleteCategoryMutation.isPending;

  /**
   * Calculate category statistics
   */
  const categoryStats = useMemo(() => {
    if (!clientCategories) return { total: 0, active: 0, disabled: 0 };

    return {
      total: clientCategories.length,
      active: clientCategories.filter(cat => cat.categoryStatus === CategoryStatusCode.active).length,
      disabled: clientCategories.filter(cat => cat.categoryStatus === CategoryStatusCode.disabled).length,
    };
  }, [clientCategories]);

  const columns: ColumnDef<ClientCategory>[] = [
    {
      accessorKey: 'categoryName',
      header: t('admin.clients.categories.name'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 font-medium">
          <Tag className="h-4 w-4 text-muted-foreground" />
          {row.original.categoryName}
        </div>
      ),
    },
    {
      accessorKey: 'categoryStatus',
      header: t('common.labels.status'),
      cell: ({ row }) => (
        <Badge
          variant={getStatusBadgeVariant(row.original.categoryStatus)}
          className={getStatusBadgeColor(row.original.categoryStatus)}
        >
          {getStatusLabel(row.original.categoryStatus)}
        </Badge>
      ),
    },
    {
      id: 'toggle',
      header: t('admin.clients.categories.toggle'),
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <Switch
            checked={row.original.categoryStatus === CategoryStatusCode.active}
            onCheckedChange={() => handleStatusToggle(row.original)}
            disabled={isAnyOperationInProgress}
          />
          <span className="text-sm text-muted-foreground">
            {getStatusLabel(row.original.categoryStatus)}
          </span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: () => <div className="text-right">{t('common.actions.action')}</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEditDialog(row.original)}
            disabled={isAnyOperationInProgress}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openDeleteDialog(row.original)}
            disabled={isAnyOperationInProgress}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const renderMobileRow = (category: ClientCategory) => (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          <Tag className="h-4 w-4 text-muted-foreground" />
          {category.categoryName}
        </div>
        <Badge
          variant={getStatusBadgeVariant(category.categoryStatus)}
          className={getStatusBadgeColor(category.categoryStatus)}
        >
          {getStatusLabel(category.categoryStatus)}
        </Badge>
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          checked={category.categoryStatus === CategoryStatusCode.active}
          onCheckedChange={() => handleStatusToggle(category)}
          disabled={isAnyOperationInProgress}
        />
        <span className="text-sm text-muted-foreground">{getStatusLabel(category.categoryStatus)}</span>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => openEditDialog(category)}
          disabled={isAnyOperationInProgress}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => openDeleteDialog(category)}
          disabled={isAnyOperationInProgress}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className={className}>
      {/* Section Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                {t('admin.clients.categories.title')}
              </CardTitle>
              <CardDescription>
                {t('admin.clients.categories.description')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading || isAnyOperationInProgress}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {t('common.actions.refresh')}
              </Button>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                disabled={isAnyOperationInProgress}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('admin.clients.categories.add')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Error State */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('admin.clients.categories.loadError')}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={() => refetch()}
                >
                  {t('common.retry')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && <TableSkeleton rows={3} columns={4} />}

          {/* Data Table */}
          {!isLoading && !error && clientCategories && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {t('admin.clients.categories.totalCount', { count: categoryStats.total })}
                </span>
                <span className="flex items-center gap-1">
                  <ToggleRight className="h-4 w-4 text-green-600" />
                  {t('admin.clients.categories.activeCount', { count: categoryStats.active })}
                </span>
                <span className="flex items-center gap-1">
                  <ToggleLeft className="h-4 w-4 text-gray-400" />
                  {t('admin.clients.categories.disabledCount', { count: categoryStats.disabled })}
                </span>
              </div>

              {/* Table */}
              <DataTable
                columns={columns}
                data={clientCategories}
                getRowKey={(category) => String(category.idCategory)}
                renderMobileRow={renderMobileRow}
                emptyState={
                  <EmptyState
                    icon={<Tag className="h-6 w-6" />}
                    title={t('admin.clients.categories.noCategoriesFound')}
                    body={t('admin.clients.categories.description')}
                  />
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Category Dialog */}
      <ClientCategoryDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSave={handleAddCategory}
        isSaving={createCategoryMutation.isPending}
      />

      {/* Edit Category Dialog */}
      <ClientCategoryDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setSelectedCategory(null);
        }}
        onSave={handleEditCategory}
        category={selectedCategory || undefined}
        isSaving={updateCategoryMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('admin.clients.categories.deleteTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('admin.clients.categories.deleteConfirm', { name: selectedCategory?.categoryName ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleteCategoryMutation.isPending}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCategory}
              disabled={deleteCategoryMutation.isPending}
            >
              {deleteCategoryMutation.isPending ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-foreground" />
                  {t('common.deleting')}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('common.delete')}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
