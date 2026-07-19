/**
 * Product Hierarchy Section Component
 * Manages product families, brands, and models with three-column layout
 */

import React, { useState, useMemo } from 'react';
import { Plus, Package, ChevronRight, Trash2, Edit, AlertTriangle, RefreshCw, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/useTranslation';
import { Family, Brand, Model, FamilyFormData, BrandFormData, ModelFormData } from '@/types/draft-types';
import { ModelDialog } from './model-dialog';
import {
  useFamilies,
  useCreateFamily,
  useUpdateFamily,
  useDeleteFamily,
  useBrands,
  useCreateBrand,
  useUpdateBrand,
  useDeleteBrand,
  useModels,
  useCreateModel,
  useUpdateModel,
  useDeleteModel,
} from '@/hooks/use-admin-settings';

/**
 * Props for ProductHierarchySection component
 */
interface ProductHierarchySectionProps {
  /** Custom className for styling */
  className?: string;
}

/**
 * Product Hierarchy Section Component
 * Displays families, brands, and models in a three-column layout
 */
export function ProductHierarchySection({ className }: ProductHierarchySectionProps) {
  const { t } = useTranslation();
  
  // State management
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ type: 'family' | 'brand' | 'model'; item: any } | null>(null);
  
  // Family management state
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [newFamilyName, setNewFamilyName] = useState('');
  
  // Brand management state
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [newBrandName, setNewBrandName] = useState('');

  // Data fetching hooks
  const { data: families, isLoading: familiesLoading, error: familiesError, refetch: refetchFamilies } = useFamilies();
  const { data: brands, isLoading: brandsLoading, error: brandsError, refetch: refetchBrands } = useBrands();
  const { data: models, isLoading: modelsLoading, error: modelsError, refetch: refetchModels } = useModels();
  
  // Mutation hooks
  const createFamilyMutation = useCreateFamily();
  const updateFamilyMutation = useUpdateFamily();
  const deleteFamilyMutation = useDeleteFamily();
  const createBrandMutation = useCreateBrand();
  const updateBrandMutation = useUpdateBrand();
  const deleteBrandMutation = useDeleteBrand();
  const createModelMutation = useCreateModel();
  const updateModelMutation = useUpdateModel();
  const deleteModelMutation = useDeleteModel();

  /**
   * Handle add family
   */
  const handleAddFamily = () => {
    if (newFamilyName.trim()) {
      createFamilyMutation.mutate(
        { familyName: newFamilyName.trim() },
        {
          onSuccess: () => {
            setNewFamilyName('');
            refetchFamilies();
          },
        }
      );
    }
  };

  /**
   * Handle edit family
   */
  const handleEditFamily = () => {
    if (editingFamily && newFamilyName.trim()) {
      updateFamilyMutation.mutate(
        { id: editingFamily.idFamily, data: { familyName: newFamilyName.trim() } },
        {
          onSuccess: () => {
            setEditingFamily(null);
            setNewFamilyName('');
            refetchFamilies();
          },
        }
      );
    }
  };

  /**
   * Handle delete family
   */
  const handleDeleteFamily = (family: Family) => {
    setDeleteItem({ type: 'family', item: family });
    setIsDeleteDialogOpen(true);
  };

  /**
   * Handle add brand
   */
  const handleAddBrand = () => {
    if (newBrandName.trim()) {
      createBrandMutation.mutate(
        { brandName: newBrandName.trim() },
        {
          onSuccess: () => {
            setNewBrandName('');
            refetchBrands();
          },
        }
      );
    }
  };

  /**
   * Handle edit brand
   */
  const handleEditBrand = () => {
    if (editingBrand && newBrandName.trim()) {
      updateBrandMutation.mutate(
        { id: editingBrand.idBrand, data: { brandName: newBrandName.trim() } },
        {
          onSuccess: () => {
            setEditingBrand(null);
            setNewBrandName('');
            refetchBrands();
          },
        }
      );
    }
  };

  /**
   * Handle delete brand
   */
  const handleDeleteBrand = (brand: Brand) => {
    setDeleteItem({ type: 'brand', item: brand });
    setIsDeleteDialogOpen(true);
  };

  /**
   * Handle add model
   */
  const handleAddModel = () => {
    setSelectedModel(null);
    setIsModelDialogOpen(true);
  };

  /**
   * Handle edit model
   */
  const handleEditModel = (model: Model) => {
    setSelectedModel(model);
    setIsModelDialogOpen(true);
  };

  /**
   * Handle delete model
   */
  const handleDeleteModel = (model: Model) => {
    setDeleteItem({ type: 'model', item: model });
    setIsDeleteDialogOpen(true);
  };

  /**
   * Handle model dialog save
   */
  const handleModelSave = (data: ModelFormData) => {
    if (selectedModel) {
      // Edit mode
      updateModelMutation.mutate(
        { id: selectedModel.idModel, data },
        {
          onSuccess: () => {
            setIsModelDialogOpen(false);
            setSelectedModel(null);
            refetchModels();
          },
        }
      );
    } else {
      // Add mode
      createModelMutation.mutate(data, {
        onSuccess: () => {
          setIsModelDialogOpen(false);
          refetchModels();
        },
      });
    }
  };

  /**
   * Handle delete confirmation
   */
  const handleDeleteConfirm = () => {
    if (deleteItem) {
      switch (deleteItem.type) {
        case 'family':
          deleteFamilyMutation.mutate(deleteItem.item.idFamily, {
            onSuccess: () => {
              setIsDeleteDialogOpen(false);
              setDeleteItem(null);
              refetchFamilies();
            },
          });
          break;
        case 'brand':
          deleteBrandMutation.mutate(deleteItem.item.idBrand, {
            onSuccess: () => {
              setIsDeleteDialogOpen(false);
              setDeleteItem(null);
              refetchBrands();
            },
          });
          break;
        case 'model':
          deleteModelMutation.mutate(deleteItem.item.idModel, {
            onSuccess: () => {
              setIsDeleteDialogOpen(false);
              setDeleteItem(null);
              refetchModels();
            },
          });
          break;
      }
    }
  };

  /**
   * Close all dialogs
   */
  const closeDialogs = () => {
    setIsModelDialogOpen(false);
    setIsDeleteDialogOpen(false);
    setSelectedModel(null);
    setDeleteItem(null);
    setEditingFamily(null);
    setEditingBrand(null);
    setNewFamilyName('');
    setNewBrandName('');
  };

  /**
   * Check if any operation is in progress
   */
  const isAnyOperationInProgress = 
    createFamilyMutation.isPending || updateFamilyMutation.isPending || deleteFamilyMutation.isPending ||
    createBrandMutation.isPending || updateBrandMutation.isPending || deleteBrandMutation.isPending ||
    createModelMutation.isPending || updateModelMutation.isPending || deleteModelMutation.isPending;

  /**
   * Check if there are any errors
   */
  const hasError = familiesError || brandsError || modelsError;

  /**
   * Check if any data is loading
   */
  const isLoading = familiesLoading || brandsLoading || modelsLoading;

  /**
   * Get models for a specific family and brand
   */
  const getModelsForFamilyAndBrand = (familyId: number, brandId: number) => {
    if (!models) return [];
    return models.filter(model => model.idFamily === familyId && model.idBrand === brandId);
  };

  /**
   * Get brands for a specific family (in a real app, this would be filtered)
   */
  const getBrandsForFamily = (familyId: number) => {
    // In a real application, you would filter brands based on family relationships
    // For now, we return all brands since our mock data doesn't have family-brand relationships
    return brands || [];
  };

  /**
   * Get translated label for a delete-item type
   */
  const deleteItemTypeLabel = (type: 'family' | 'brand' | 'model') => {
    switch (type) {
      case 'family':
        return t('admin.products.hierarchy.typeFamily');
      case 'brand':
        return t('admin.products.hierarchy.typeBrand');
      case 'model':
        return t('admin.products.hierarchy.typeModel');
    }
  };

  return (
    <div className={className}>
      {/* Section Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                {t('admin.products.hierarchy.title')}
              </CardTitle>
              <CardDescription>
                {t('admin.products.hierarchy.description')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  refetchFamilies();
                  refetchBrands();
                  refetchModels();
                }}
                disabled={isLoading || isAnyOperationInProgress}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {t('common.actions.refresh')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Error State */}
          {hasError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('admin.products.hierarchy.loadError')}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={() => {
                    refetchFamilies();
                    refetchBrands();
                    refetchModels();
                  }}
                >
                  {t('common.retry')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-8 w-full" />
                    <div className="space-y-2">
                      {[...Array(3)].map((_, j) => (
                        <Skeleton key={j} className="h-10 w-full" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Three-Column Layout */}
          {!isLoading && !hasError && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Families Column */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {t('admin.products.hierarchy.families')}
                  </CardTitle>
                  <CardDescription>
                    {t('admin.products.hierarchy.familiesDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add Family */}
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("admin.products.hierarchy.familyNamePlaceholder")}
                      value={newFamilyName}
                      onChange={(e) => setNewFamilyName(e.target.value)}
                      disabled={isAnyOperationInProgress}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddFamily()}
                    />
                    <Button
                      size="sm"
                      onClick={handleAddFamily}
                      disabled={!newFamilyName.trim() || isAnyOperationInProgress}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Families List */}
                  <div className="space-y-2">
                    {families?.map((family) => (
                      <div
                        key={family.idFamily}
                        className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50"
                      >
                        <span className="text-sm font-medium">{family.familyName}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingFamily(family);
                              setNewFamilyName(family.familyName);
                            }}
                            disabled={isAnyOperationInProgress}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFamily(family)}
                            disabled={isAnyOperationInProgress}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Brands Column */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {t('admin.products.hierarchy.brands')}
                  </CardTitle>
                  <CardDescription>
                    {t('admin.products.hierarchy.brandsDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add Brand */}
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("admin.products.hierarchy.brandNamePlaceholder")}
                      value={newBrandName}
                      onChange={(e) => setNewBrandName(e.target.value)}
                      disabled={isAnyOperationInProgress}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddBrand()}
                    />
                    <Button
                      size="sm"
                      onClick={handleAddBrand}
                      disabled={!newBrandName.trim() || isAnyOperationInProgress}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Brands List */}
                  <div className="space-y-2">
                    {brands?.map((brand) => (
                      <div
                        key={brand.idBrand}
                        className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50"
                      >
                        <span className="text-sm font-medium">{brand.brandName}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingBrand(brand);
                              setNewBrandName(brand.brandName);
                            }}
                            disabled={isAnyOperationInProgress}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteBrand(brand)}
                            disabled={isAnyOperationInProgress}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Models Column */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {t('admin.products.hierarchy.models')}
                  </CardTitle>
                  <CardDescription>
                    {t('admin.products.hierarchy.modelsDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add Model */}
                  <Button
                    size="sm"
                    onClick={handleAddModel}
                    disabled={isAnyOperationInProgress}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('admin.products.hierarchy.addModel')}
                  </Button>

                  {/* Models List */}
                  <div className="space-y-2">
                    {models?.map((model) => {
                      const family = families?.find(f => f.idFamily === model.idFamily);
                      const brand = brands?.find(b => b.idBrand === model.idBrand);
                      
                      return (
                        <div
                          key={model.idModel}
                          className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{model.modelName}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {family?.familyName} • {brand?.brandName}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditModel(model)}
                              disabled={isAnyOperationInProgress}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteModel(model)}
                              disabled={isAnyOperationInProgress}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model Dialog */}
      <ModelDialog
        isOpen={isModelDialogOpen}
        onClose={() => {
          setIsModelDialogOpen(false);
          setSelectedModel(null);
        }}
        onSave={handleModelSave}
        model={selectedModel || undefined}
        families={families || []}
        brands={brands || []}
        isSaving={createModelMutation.isPending || updateModelMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('admin.products.hierarchy.deleteTitle', { type: deleteItem ? deleteItemTypeLabel(deleteItem.type) : '' })}
            </DialogTitle>
            <DialogDescription>
              {t('admin.products.hierarchy.deleteConfirm', { type: deleteItem ? deleteItemTypeLabel(deleteItem.type) : '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isAnyOperationInProgress}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isAnyOperationInProgress}
            >
              {isAnyOperationInProgress ? (
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
