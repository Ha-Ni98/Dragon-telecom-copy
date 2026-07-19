/**
 * Client Category Dialog Component
 * Reusable dialog for adding/editing client categories
 */

import React from 'react';
import { Save, X, Tag, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/hooks/useTranslation';
import { ClientCategory } from '@/types/draft-types';
import { CategoryStatusCode } from '@/types/draft-types/enums.types';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Validation schema for client category form
const clientCategorySchema = z.object({
  categoryName: z.string()
    .min(2, 'Category name must be at least 2 characters')
    .max(50, 'Category name must be less than 50 characters')
    .regex(/^[a-zA-Z0-9\s-]+$/, 'Category name can only contain letters, numbers, spaces, and hyphens'),
  categoryStatus: z.number().min(0).max(1), // CategoryStatusCode
});

type ClientCategoryFormData = z.infer<typeof clientCategorySchema>;

interface ClientCategoryDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when client category is saved */
  onSave: (data: ClientCategoryFormData) => void;
  /** Client category data for edit mode */
  category?: ClientCategory;
  /** Whether a save operation is in progress */
  isSaving: boolean;
}

/**
 * Client Category Dialog Component
 * Handles both add and edit modes for client categories
 */
export function ClientCategoryDialog({
  isOpen,
  onClose,
  onSave,
  category,
  isSaving,
}: ClientCategoryDialogProps) {
  const { t } = useTranslation();
  const isEditMode = !!category;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<ClientCategoryFormData>({
    resolver: zodResolver(clientCategorySchema),
    mode: 'onChange',
    defaultValues: {
      categoryName: category?.categoryName || '',
      categoryStatus: category?.categoryStatus ?? CategoryStatusCode.active,
    },
  });

  /**
   * Handle form submission
   */
  const onSubmit = (data: ClientCategoryFormData) => {
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            {isEditMode ? 'Edit Client Category' : 'Add New Client Category'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Update the client category information below.'
              : 'Create a new client category with the required information.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Category Information Card (Edit Mode) */}
          {isEditMode && category && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  {t('admin.clients.categories.currentInfo')}
                </CardTitle>
                <CardDescription>
                  {t('admin.clients.categories.viewCurrentDetails')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">{t('admin.clients.categories.categoryId')}</Label>
                    <p className="text-sm">{category.idCategory}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">{t('admin.clients.modifyDialog.currentStatus')}</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(category.categoryStatus)}>
                        {getStatusLabel(category.categoryStatus)}
                      </Badge>
                    </div>
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
                  <Tag className="h-4 w-4" />
                  {t('admin.clients.categories.categoryDetails')}
                </CardTitle>
                <CardDescription>
                  {isEditMode
                    ? t('admin.clients.categories.updateBelow')
                    : t('admin.clients.categories.enterBelow')
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Category Name Field */}
                <div className="space-y-2">
                  <Label htmlFor="categoryName">{t('admin.clients.categories.name')} *</Label>
                  <Controller
                    name="categoryName"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="categoryName"
                        placeholder={t('admin.clients.categories.namePlaceholder')}
                        className={errors.categoryName ? 'border-destructive' : ''}
                        disabled={isSaving}
                      />
                    )}
                  />
                  {errors.categoryName && (
                    <p className="text-sm text-destructive">{errors.categoryName.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t('admin.clients.categories.nameHelp')}
                  </p>
                </div>

                {/* Status Field */}
                <div className="space-y-2">
                  <Label htmlFor="categoryStatus" className="flex items-center gap-2">
                    {control._formValues.categoryStatus === CategoryStatusCode.active ? (
                      <ToggleRight className="h-4 w-4 text-green-600" />
                    ) : (
                      <ToggleLeft className="h-4 w-4 text-gray-400" />
                    )}
                    {t('common.labels.status')}
                  </Label>
                  <Controller
                    name="categoryStatus"
                    control={control}
                    render={({ field }) => (
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="categoryStatus"
                          checked={field.value === CategoryStatusCode.active}
                          onCheckedChange={(checked) => 
                            field.onChange(checked ? CategoryStatusCode.active : CategoryStatusCode.disabled)
                          }
                          disabled={isSaving}
                        />
                        <Label htmlFor="categoryStatus" className="text-sm">
                          {field.value === CategoryStatusCode.active ? t('common.status.active') : t('common.status.disabled')}
                        </Label>
                      </div>
                    )}
                  />
                  {errors.categoryStatus && (
                    <p className="text-sm text-destructive">{errors.categoryStatus.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t('admin.clients.categories.statusHelp')}
                  </p>
                </div>

                {/* Status Preview */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t('common.labels.preview')}:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {control._formValues.categoryName || t('admin.clients.categories.name')}
                      </span>
                      <Badge variant={getStatusBadgeVariant(control._formValues.categoryStatus)}>
                        {getStatusLabel(control._formValues.categoryStatus)}
                      </Badge>
                    </div>
                  </div>
                </div>
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
                    {isEditMode ? 'Update Category' : 'Create Category'}
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
