import React, { useState } from 'react';
import { DollarSign, Edit3, Lock, History, Calculator, Save, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  const getCategoryName = (categoryId: number) => {
    return `Category ${categoryId}`;
  };

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
              {isEditMode ? 'Manage product pricing with bulk operations' : 'Current pricing for different client categories'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" aria-label="View pricing history">
                  <History className="h-4 w-4 mr-2" />
                  History
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Pricing History</DialogTitle>
                  <DialogDescription>
                    Recent changes to product pricing
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
                        {entry.type === 'bulk_discount' ? 'Bulk Update' : 'Price Update'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            
            {isEditMode && (
              <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" aria-label="Bulk pricing operations">
                    <Calculator className="h-4 w-4 mr-2" />
                    Bulk Update
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Bulk Pricing Update</DialogTitle>
                    <DialogDescription>
                      Apply bulk changes to all pricing categories
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit(handleBulkUpdate)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bulkDiscountPercentage">Bulk Discount Percentage</Label>
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
                        Enter a percentage to apply a discount to all prices
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowBulkDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={!isValid}>
                        Apply Bulk Update
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
                No User Price (Base Price)
                {isEditMode && <Badge variant="secondary" className="text-xs">Editable</Badge>}
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
                Category Prices
                {isEditMode && <Badge variant="secondary" className="text-xs">Editable</Badge>}
              </Label>
              
              {product.categoryPrices.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Current Price</TableHead>
                        {isEditMode && <TableHead>New Price</TableHead>}
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {product.categoryPrices.slice(0, 3).map((categoryPrice) => (
                        <TableRow key={categoryPrice.idCategory}>
                          <TableCell className="font-medium">
                            {getCategoryName(categoryPrice.idCategory)}
                          </TableCell>
                          <TableCell className="font-mono">
                            {categoryPrice.price} DZ
                          </TableCell>
                          {isEditMode && (
                            <TableCell>
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
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge variant="outline">Active</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No category pricing configured</p>
                  <p className="text-xs">Category prices will be added when suppliers are configured</p>
                </div>
              )}
            </div>

            {/* Form validation summary */}
            {isEditMode && !isValid && (
              <Alert variant="destructive">
                <AlertDescription>
                  Please fix the pricing errors above before saving.
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
                  Reset Changes
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || !isValid}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Pricing'}
                </Button>
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
