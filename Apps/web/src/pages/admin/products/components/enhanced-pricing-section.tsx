import React, { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DollarSign, Edit3, History, Calculator, Save, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/DataTable';
import { EmptyState } from '@/components/shared/EmptyState';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from '@/hooks/useTranslation';
import { AdminProductWithFullDetails, PricingUpdates } from '@/types/draft-types/admin-product-information.types';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Enhanced validation schema for pricing with business rules
const enhancedPricingSchema = z.object({
  noUserPrice: z.number().min(0, 'Price must be positive').max(999999, 'Price must be reasonable'),
  categoryPrices: z.record(z.string(), z.number().min(0, 'Price must be positive').max(999999, 'Price must be reasonable')),
  bulkDiscountPercentage: z.number().min(0, 'Discount must be positive').max(100, 'Discount cannot exceed 100%').optional(),
});

type EnhancedPricingFormData = z.infer<typeof enhancedPricingSchema>;

interface EnhancedPricingSectionProps {
  /** Product data to display and edit */
  product: AdminProductWithFullDetails;
  /** Whether the section is in edit mode */
  isEditMode: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Callback when pricing data changes */
  onPricingChange: (data: PricingUpdates) => void;
  /** Callback when pricing is submitted */
  onPricingSubmit: (data: PricingUpdates) => void;
  /** Callback for bulk pricing updates */
  onBulkPricingUpdate: (updates: { noUserPrice?: number; categoryPrices?: Record<number, number> }) => void;
}

type CategoryPriceRow = AdminProductWithFullDetails['categoryPrices'][number];

/**
 * Enhanced product pricing section component
 * Includes bulk operations, pricing history, and advanced validation
 */
export function EnhancedPricingSection({
  product,
  isEditMode,
  isSaving,
  onPricingChange,
  onPricingSubmit,
  onBulkPricingUpdate,
}: EnhancedPricingSectionProps) {
  const { t } = useTranslation();
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  // Initialize form with pricing data
  const defaultCategoryPrices = product.categoryPrices.reduce((acc, price) => {
    acc[price.idCategory.toString()] = price.price;
    return acc;
  }, {} as Record<string, number>);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<EnhancedPricingFormData>({
    resolver: zodResolver(enhancedPricingSchema),
    mode: 'onChange',
    defaultValues: {
      noUserPrice: product.suppliers?.[0]?.noUserPrice || 0,
      categoryPrices: defaultCategoryPrices,
      bulkDiscountPercentage: 0,
    },
  });

  // Watch form changes and notify parent
  const formData = watch();
  React.useEffect(() => {
    // categoryPrices shapes differ (form: {categoryId: price} map; entity: array) — no
    // transform exists in the source MVP (Sub-01 Sprint 1 finding); a real mapping lands
    // with the Sub-02 catalog-pricing integration.
    onPricingChange({
      categoryPrices: formData.categoryPrices as unknown as PricingUpdates['categoryPrices'],
    });
  }, [formData, onPricingChange]);

  // Handle form submission
  const onSubmit = (data: EnhancedPricingFormData) => {
    onPricingSubmit({
      categoryPrices: data.categoryPrices as unknown as PricingUpdates['categoryPrices'],
    });
  };

  // Handle bulk pricing update
  const handleBulkUpdate = (data: EnhancedPricingFormData) => {
    if (data.bulkDiscountPercentage && data.bulkDiscountPercentage > 0) {
      const discountMultiplier = 1 - (data.bulkDiscountPercentage / 100);
      const updatedCategoryPrices: Record<number, number> = {};

      Object.entries(data.categoryPrices).forEach(([categoryId, price]) => {
        updatedCategoryPrices[parseInt(categoryId)] = price * discountMultiplier;
      });

      onBulkPricingUpdate({
        noUserPrice: data.noUserPrice * discountMultiplier,
        categoryPrices: updatedCategoryPrices,
      });
    } else {
      onBulkPricingUpdate({
        noUserPrice: data.noUserPrice,
        categoryPrices: Object.fromEntries(
          Object.entries(data.categoryPrices).map(([id, price]) => [parseInt(id), price])
        ),
      });
    }
    setShowBulkDialog(false);
  };

  // Get category name by ID (this would typically come from a categories service)
  const getCategoryName = (categoryId: number) => t('admin.productInfo.pricing.categoryLabel', { id: categoryId });

  // Mock pricing history data
  const pricingHistory = [
    {
      id: 1,
      date: '2024-01-15',
      user: 'Admin User',
      changes: 'Updated Category 1 price from 100 to 120 DZ',
      type: 'price_update',
    },
    {
      id: 2,
      date: '2024-01-10',
      user: 'Admin User',
      changes: 'Applied 10% bulk discount to all categories',
      type: 'bulk_discount',
    },
    {
      id: 3,
      date: '2024-01-05',
      user: 'Admin User',
      changes: 'Updated no-user price from 150 to 160 DZ',
      type: 'price_update',
    },
  ];

  const categoryPriceRows = product.categoryPrices.slice(0, 3);

  const columns = useMemo<ColumnDef<CategoryPriceRow>[]>(() => {
    const base: ColumnDef<CategoryPriceRow>[] = [
      {
        accessorKey: 'idCategory',
        header: t('admin.productInfo.pricing.category'),
        cell: ({ row }) => <span className="font-medium">{getCategoryName(row.original.idCategory)}</span>,
      },
      {
        accessorKey: 'price',
        header: t('admin.productInfo.pricing.currentPrice'),
        cell: ({ row }) => <span className="font-mono">{row.original.price} DZ</span>,
      },
    ];

    if (isEditMode) {
      base.push({
        id: 'newPrice',
        header: t('admin.productInfo.pricing.newPrice'),
        cell: ({ row }) => (
          <Controller
            name={`categoryPrices.${row.original.idCategory}`}
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                disabled={isSaving}
                className="w-24"
              />
            )}
          />
        ),
      });
    }

    base.push({
      id: 'status',
      header: t('common.labels.status'),
      cell: () => <Badge variant="outline">{t('common.status.active')}</Badge>,
    });

    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, isEditMode, isSaving, control]);

  const renderMobileRow = (categoryPrice: CategoryPriceRow) => (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">{getCategoryName(categoryPrice.idCategory)}</span>
        <Badge variant="outline">{t('common.status.active')}</Badge>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-mono">{categoryPrice.price} DZ</span>
        {isEditMode && (
          <Controller
            name={`categoryPrices.${categoryPrice.idCategory}`}
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                disabled={isSaving}
                className="w-24"
              />
            )}
          />
        )}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2" id="pricing-heading">
              <DollarSign className="h-5 w-5" aria-hidden="true" />
              {t('admin.productInfo.pricing')}
            </CardTitle>
            <CardDescription>
              {isEditMode ? t('admin.productInfo.pricing.manageBulk') : t('admin.productInfo.pricing.currentPricing')}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" aria-label={t('admin.productInfo.pricing.viewHistory')}>
                  <History className="h-4 w-4 mr-2" />
                  {t('admin.productInfo.pricing.history')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t('admin.productInfo.pricing.pricingHistory')}</DialogTitle>
                  <DialogDescription>
                    {t('admin.productInfo.pricing.recentChanges')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {pricingHistory.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{entry.changes}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.date} • {entry.user}
                        </p>
                      </div>
                      <Badge variant={entry.type === 'bulk_discount' ? 'secondary' : 'outline'}>
                        {entry.type === 'bulk_discount' ? t('admin.productInfo.pricing.bulkUpdate') : t('admin.productInfo.pricing.priceUpdate')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            {isEditMode && (
              <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" aria-label={t('admin.productInfo.pricing.bulkOperationsAria')}>
                    <Calculator className="h-4 w-4 mr-2" />
                    {t('admin.productInfo.pricing.bulkUpdate')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{t('admin.productInfo.pricing.bulkPricingUpdate')}</DialogTitle>
                    <DialogDescription>
                      {t('admin.productInfo.pricing.applyBulkChanges')}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit(handleBulkUpdate)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bulkDiscountPercentage">{t('admin.productInfo.pricing.bulkDiscountPercentage')}</Label>
                      <Controller
                        name="bulkDiscountPercentage"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="bulkDiscountPercentage"
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            placeholder="0"
                            aria-describedby={errors.bulkDiscountPercentage ? 'bulk-discount-error' : undefined}
                          />
                        )}
                      />
                      {errors.bulkDiscountPercentage && (
                        <p id="bulk-discount-error" className="text-sm text-destructive">
                          {errors.bulkDiscountPercentage.message}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {t('admin.productInfo.pricing.bulkDiscountHelp')}
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowBulkDialog(false)}
                      >
                        {t('common.actions.cancel')}
                      </Button>
                      <Button type="submit" disabled={!isValid}>
                        {t('admin.productInfo.pricing.applyBulkUpdate')}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4" role="region" aria-labelledby="pricing-heading">
            {/* No User Price */}
            <div className="space-y-2">
              <Label htmlFor="noUserPrice" className="text-sm font-medium flex items-center gap-2">
                <Edit3 className="h-3 w-3" />
                {t('admin.productInfo.pricing.noUserPrice')}
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
                        aria-describedby={errors.noUserPrice ? 'no-user-price-error' : undefined}
                      />
                      {errors.noUserPrice && (
                        <p id="no-user-price-error" className="text-sm text-destructive">
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

            {/* Category Prices Table */}
            <div className="space-y-4">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Edit3 className="h-3 w-3" />
                {t('admin.productInfo.pricing.categoryPrices')}
                {isEditMode && <Badge variant="secondary" className="text-xs">{t('common.editable')}</Badge>}
              </Label>

              <DataTable
                columns={columns}
                data={categoryPriceRows}
                getRowKey={(categoryPrice) => String(categoryPrice.idCategory)}
                renderMobileRow={renderMobileRow}
                emptyState={
                  <EmptyState
                    icon={<DollarSign className="h-6 w-6" />}
                    title={t('admin.productInfo.pricing.noCategoryPricing')}
                    body={t('admin.productInfo.pricing.noCategoryPricingBody')}
                  />
                }
              />
            </div>

            {/* Form validation summary */}
            {isEditMode && !isValid && (
              <Alert variant="destructive">
                <AlertDescription>
                  {t('admin.productInfo.pricing.fixErrorsBeforeSaving')}
                </AlertDescription>
              </Alert>
            )}

            {/* Save button for edit mode */}
            {isEditMode && (
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setValue('categoryPrices', defaultCategoryPrices)}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 mr-2" />
                  {t('admin.productInfo.pricing.resetChanges')}
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || !isValid}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? t('admin.productInfo.pricing.saving') : t('admin.productInfo.pricing.savePricing')}
                </Button>
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
