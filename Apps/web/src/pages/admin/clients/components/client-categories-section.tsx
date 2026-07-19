/**
 * Client Categories Section Component
 * Manages client categories with status management functionality
 */

import React, { useState, useMemo } from 'react';
import { Plus, Tag, ToggleLeft, ToggleRight, Trash2, Edit, AlertTriangle, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
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
   * Close all dialogs
   */
  const closeDialogs = () => {
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
    setIsDeleteDialogOpen(false);
    setSelectedCategory(null);
  };

  /**
   * Get status label
   */
  const getStatusLabel = (status: CategoryStatusCode) => {
    switch (status) {
      case CategoryStatusCode.active:
        return 'Active';
      case CategoryStatusCode.disabled:
        return 'Disabled';
      default:
        return 'Unknown';
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

  return (
    <div className={className}>
      {/* Section Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Client Categories
              </CardTitle>
              <CardDescription>
                Manage client categories and their status
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
                Refresh
              </Button>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                disabled={isAnyOperationInProgress}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Category
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
                Failed to load client categories. Please try again.
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={() => refetch()}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-20" />
              </div>
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          )}

          {/* Data Table */}
          {!isLoading && !error && clientCategories && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  Total: {categoryStats.total}
                </span>
                <span className="flex items-center gap-1">
                  <ToggleRight className="h-4 w-4 text-green-600" />
                  Active: {categoryStats.active}
                </span>
                <span className="flex items-center gap-1">
                  <ToggleLeft className="h-4 w-4 text-gray-400" />
                  Disabled: {categoryStats.disabled}
                </span>
              </div>

              {/* Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Toggle</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientCategories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No client categories found
                        </TableCell>
                      </TableRow>
                    ) : (
                      clientCategories.map((category) => (
                        <TableRow key={category.idCategory}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Tag className="h-4 w-4 text-muted-foreground" />
                              {category.categoryName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={getStatusBadgeVariant(category.categoryStatus)}
                              className={getStatusBadgeColor(category.categoryStatus)}
                            >
                              {getStatusLabel(category.categoryStatus)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={category.categoryStatus === CategoryStatusCode.active}
                                onCheckedChange={() => handleStatusToggle(category)}
                                disabled={isAnyOperationInProgress}
                              />
                              <span className="text-sm text-muted-foreground">
                                {category.categoryStatus === CategoryStatusCode.active ? 'Active' : 'Disabled'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
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
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
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
              Delete Client Category
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the client category "{selectedCategory?.categoryName}"? 
              This action cannot be undone and may affect existing clients.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleteCategoryMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCategory}
              disabled={deleteCategoryMutation.isPending}
            >
              {deleteCategoryMutation.isPending ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-foreground" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
