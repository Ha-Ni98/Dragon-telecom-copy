import React from 'react';
import { Package, Lock, Edit3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/useTranslation';
import { AdminProductWithFullDetails } from '@/types/draft-types/admin-product-information.types';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Validation schema for product information form
const productInformationSchema = z.object({
  productDescription: z.string().min(1, 'Description is required').max(1000, 'Description must be less than 1000 characters'),
  noUserPrice: z.number().min(0, 'Price must be positive').max(999999, 'Price must be reasonable'),
});

type ProductInformationFormData = z.infer<typeof productInformationSchema>;

interface ProductDetailsSectionProps {
  /** Product data to display and edit */
  product: AdminProductWithFullDetails;
  /** Whether the section is in edit mode */
  isEditMode: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Callback when form data changes */
  onFormChange: (data: ProductInformationFormData) => void;
  /** Callback when form is submitted */
  onFormSubmit: (data: ProductInformationFormData) => void;
}

/**
 * Product details section component
 * Displays product information with edit capabilities
 */
export function ProductDetailsSection({
  product,
  isEditMode,
  isSaving,
  onFormChange,
  onFormSubmit,
}: ProductDetailsSectionProps) {
  const { t } = useTranslation();

  // Initialize form with product data
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<ProductInformationFormData>({
    resolver: zodResolver(productInformationSchema),
    mode: 'onChange',
    defaultValues: {
      productDescription: product.productDescription || '',
      noUserPrice: product.suppliers?.[0]?.noUserPrice || 0,
    },
  });

  // Watch form changes and notify parent
  const formData = watch();
  React.useEffect(() => {
    onFormChange(formData);
  }, [formData, onFormChange]);

  // Handle form submission
  const onSubmit = (data: ProductInformationFormData) => {
    onFormSubmit(data);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Get stock status badge variant
  const getStockStatusVariant = (status: string) => {
    switch (status) {
      case 'in_stock':
        return 'default';
      case 'low_stock':
        return 'secondary';
      case 'out_of_stock':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" id="product-details-heading">
          <Package className="h-5 w-5" aria-hidden="true" />
          {t('admin.productInfo.productDetails')}
        </CardTitle>
        <CardDescription>
          {isEditMode ? 'Edit product information below' : 'Basic product information and specifications'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2" role="region" aria-labelledby="product-details-heading">
            {/* Read-only fields */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Lock className="h-3 w-3" />
                Product Name
              </Label>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{product.productName}</p>
                <Badge variant="outline" className="text-xs">
                  Read Only
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Lock className="h-3 w-3" />
                Product Code
              </Label>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono">{product.productCodeBar}</p>
                <Badge variant="outline" className="text-xs">
                  Read Only
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Lock className="h-3 w-3" />
                Brand
              </Label>
              <div className="flex items-center gap-2">
                <p className="text-sm">{product.brand.brandName}</p>
                <Badge variant="outline" className="text-xs">
                  Read Only
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Lock className="h-3 w-3" />
                Model
              </Label>
              <div className="flex items-center gap-2">
                <p className="text-sm">{product.model.modelName}</p>
                <Badge variant="outline" className="text-xs">
                  Read Only
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Lock className="h-3 w-3" />
                Family
              </Label>
              <div className="flex items-center gap-2">
                <p className="text-sm">{product.family.familyName}</p>
                <Badge variant="outline" className="text-xs">
                  Read Only
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Lock className="h-3 w-3" />
                Created Date
              </Label>
              <div className="flex items-center gap-2">
                <p className="text-sm">{formatDate(product.createdDate)}</p>
                <Badge variant="outline" className="text-xs">
                  Read Only
                </Badge>
              </div>
            </div>

            {/* Editable fields */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="productDescription" className="text-sm font-medium flex items-center gap-2">
                <Edit3 className="h-3 w-3" />
                Product Description
                {isEditMode && <Badge variant="secondary" className="text-xs">{t('common.editable')}</Badge>}
              </Label>
              {isEditMode ? (
                <Controller
                  name="productDescription"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-1">
                      <Textarea
                        {...field}
                        id="productDescription"
                        placeholder={t('admin.products.details.descriptionPlaceholder')}
                        className="min-h-[100px]"
                        disabled={isSaving}
                        aria-describedby={errors.productDescription ? 'description-error' : undefined}
                      />
                      {errors.productDescription && (
                        <p id="description-error" className="text-sm text-destructive">
                          {errors.productDescription.message}
                        </p>
                      )}
                    </div>
                  )}
                />
              ) : (
                <p className="text-sm text-muted-foreground min-h-[100px] p-3 border rounded-md bg-muted/50">
                  {product.productDescription || 'No description available'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="noUserPrice" className="text-sm font-medium flex items-center gap-2">
                <Edit3 className="h-3 w-3" />
                No User Price (DZ)
                {isEditMode && <Badge variant="secondary" className="text-xs">{t('common.editable')}</Badge>}
              </Label>
              {isEditMode ? (
                <Controller
                  name="noUserPrice"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-1">
                      <Input
                        {...field}
                        id="noUserPrice"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        disabled={isSaving}
                        aria-describedby={errors.noUserPrice ? 'price-error' : undefined}
                      />
                      {errors.noUserPrice && (
                        <p id="price-error" className="text-sm text-destructive">
                          {errors.noUserPrice.message}
                        </p>
                      )}
                    </div>
                  )}
                />
              ) : (
                <p className="text-sm font-mono p-3 border rounded-md bg-muted/50">
                  {product.suppliers?.[0]?.noUserPrice || 0} DZ
                </p>
              )}
            </div>
          </div>

          {/* Form validation summary */}
          {isEditMode && !isValid && (
            <div className="p-3 border border-destructive/20 rounded-md bg-destructive/5">
              <p className="text-sm text-destructive">
                Please fix the errors above before saving.
              </p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
