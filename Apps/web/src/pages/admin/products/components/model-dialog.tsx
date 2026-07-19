/**
 * Model Dialog Component
 * Specialized dialog for adding/editing models with family and brand selection
 */

import React, { useMemo } from 'react';
import { Save, X, Package, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/hooks/useTranslation';
import { Model, Family, Brand } from '@/types/draft-types';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Validation schema for model form
const modelSchema = z.object({
  modelName: z.string()
    .min(2, 'Model name must be at least 2 characters')
    .max(100, 'Model name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s-_.]+$/, 'Model name can only contain letters, numbers, spaces, hyphens, underscores, and dots'),
  idFamily: z.number().min(1, 'Please select a family'),
  idBrand: z.number().min(1, 'Please select a brand'),
});

type ModelFormData = z.infer<typeof modelSchema>;

interface ModelDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when model is saved */
  onSave: (data: ModelFormData) => void;
  /** Model data for edit mode */
  model?: Model;
  /** Available families */
  families: Family[];
  /** Available brands */
  brands: Brand[];
  /** Whether a save operation is in progress */
  isSaving: boolean;
}

/**
 * Model Dialog Component
 * Handles both add and edit modes for product models with cascading dropdowns
 */
export function ModelDialog({
  isOpen,
  onClose,
  onSave,
  model,
  families,
  brands,
  isSaving,
}: ModelDialogProps) {
  const { t } = useTranslation();
  const isEditMode = !!model;

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isValid, isDirty },
  } = useForm<ModelFormData>({
    resolver: zodResolver(modelSchema),
    mode: 'onChange',
    defaultValues: {
      modelName: model?.modelName || '',
      idFamily: model?.idFamily || 0,
      idBrand: model?.idBrand || 0,
    },
  });

  // Watch form values for cascading dropdown logic
  const watchedFamilyId = watch('idFamily');
  const watchedBrandId = watch('idBrand');

  // Filter brands based on selected family
  const filteredBrands = useMemo(() => {
    if (!watchedFamilyId) return brands;
    
    // In a real application, you would filter brands based on family relationships
    // For now, we'll return all brands since our mock data doesn't have family-brand relationships
    return brands;
  }, [watchedFamilyId, brands]);

  // Get family and brand names for display
  const selectedFamily = families.find(f => f.idFamily === watchedFamilyId);
  const selectedBrand = brands.find(b => b.idBrand === watchedBrandId);

  /**
   * Handle form submission
   */
  const onSubmit = (data: ModelFormData) => {
    onSave(data);
  };

  /**
   * Handle dialog close with reset
   */
  const handleClose = () => {
    reset();
    onClose();
  };

  /**
   * Handle family selection change
   */
  const handleFamilyChange = (familyId: string) => {
    const newFamilyId = parseInt(familyId);
    setValue('idFamily', newFamilyId);
    
    // Reset brand selection when family changes
    setValue('idBrand', 0);
  };

  /**
   * Handle brand selection change
   */
  const handleBrandChange = (brandId: string) => {
    const newBrandId = parseInt(brandId);
    setValue('idBrand', newBrandId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {isEditMode ? 'Edit Product Model' : 'Add New Product Model'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Update the product model information below.'
              : 'Create a new product model with the required information.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Model Information Card (Edit Mode) */}
          {isEditMode && model && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {t('admin.products.hierarchy.currentModelInfo')}
                </CardTitle>
                <CardDescription>
                  {t('admin.clients.categories.viewCurrentDetails')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">{t('admin.products.hierarchy.modelId')}</Label>
                    <p className="text-sm">{model.idModel}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">{t('admin.products.hierarchy.currentFamily')}</Label>
                    <p className="text-sm">{selectedFamily?.familyName || t('common.unknown')}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">{t('admin.products.hierarchy.currentBrand')}</Label>
                    <p className="text-sm">{selectedBrand?.brandName || t('common.unknown')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {t('admin.products.hierarchy.modelDetails')}
                </CardTitle>
                <CardDescription>
                  {isEditMode
                    ? t('admin.products.hierarchy.updateModelBelow')
                    : t('admin.products.hierarchy.enterModelBelow')
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Model Name Field */}
                <div className="space-y-2">
                  <Label htmlFor="modelName">{t('admin.products.hierarchy.modelName')} *</Label>
                  <Controller
                    name="modelName"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="modelName"
                        placeholder={t('admin.products.hierarchy.modelNamePlaceholder')}
                        className={errors.modelName ? 'border-destructive' : ''}
                        disabled={isSaving}
                      />
                    )}
                  />
                  {errors.modelName && (
                    <p className="text-sm text-destructive">{errors.modelName.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t('admin.products.hierarchy.modelNameHelp')}
                  </p>
                </div>

                {/* Family and Brand Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Family Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="idFamily">{t('admin.products.hierarchy.productFamily')} *</Label>
                    <Controller
                      name="idFamily"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value ? field.value.toString() : ''}
                          onValueChange={handleFamilyChange}
                          disabled={isSaving}
                        >
                          <SelectTrigger className={errors.idFamily ? 'border-destructive' : ''}>
                            <SelectValue placeholder={t('admin.products.hierarchy.selectFamily')} />
                          </SelectTrigger>
                          <SelectContent>
                            {families.map((family) => (
                              <SelectItem key={family.idFamily} value={family.idFamily.toString()}>
                                {family.familyName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.idFamily && (
                      <p className="text-sm text-destructive">{errors.idFamily.message}</p>
                    )}
                  </div>

                  {/* Brand Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="idBrand">{t('admin.products.hierarchy.productBrand')} *</Label>
                    <Controller
                      name="idBrand"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value ? field.value.toString() : ''}
                          onValueChange={handleBrandChange}
                          disabled={isSaving || !watchedFamilyId}
                        >
                          <SelectTrigger className={errors.idBrand ? 'border-destructive' : ''}>
                            <SelectValue placeholder={watchedFamilyId ? t('admin.products.hierarchy.selectBrand') : t('admin.products.hierarchy.selectFamilyFirst')} />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredBrands.map((brand) => (
                              <SelectItem key={brand.idBrand} value={brand.idBrand.toString()}>
                                {brand.brandName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.idBrand && (
                      <p className="text-sm text-destructive">{errors.idBrand.message}</p>
                    )}
                    {!watchedFamilyId && (
                      <p className="text-xs text-muted-foreground">
                        {t('admin.products.hierarchy.selectFamilyFirst')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Selection Preview */}
                {(watchedFamilyId || watchedBrandId) && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t('common.labels.preview')}:</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {selectedFamily?.familyName || t('admin.products.hierarchy.noFamily')}
                        </Badge>
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline">
                          {selectedBrand?.brandName || t('admin.products.hierarchy.noBrand')}
                        </Badge>
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="default">
                          {control._formValues.modelName || 'Model Name'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isValid || isSaving || (!isDirty && isEditMode)}
              >
                {isSaving ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-foreground" />
                    {isEditMode ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {isEditMode ? 'Update Model' : 'Create Model'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
