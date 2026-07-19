/**
 * Admin Products Supply Dialog Component
 * Dialog for adding stock to existing products with form validation and supplier management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Plus, Calculator, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { mockSuppliers } from '@/mocks/suppliers';
import { SupplyFormData, SupplyValidationErrors, ExistingStockWarning } from '@/types/draft-types/admin-supply.types';

interface AdminProductsSupplyDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Product ID for the supply */
  productId: number;
  /** Product name for display */
  productName: string;
  /** Current stock quantity */
  currentStock: number;
  /** Callback when supply is saved */
  onSave: (supplyData: SupplyFormData) => Promise<void>;
  /** Loading state */
  loading?: boolean;
}

/**
 * Calculate revenue percentage
 */
function calculateRevenue(purchasePrice: number, sellingPrice: number): string {
  if (purchasePrice === 0) return "0%";
  const revenue = ((sellingPrice - purchasePrice) / purchasePrice) * 100;
  return `${revenue.toFixed(1)}%`;
}

/**
 * Admin Products Supply Dialog Component
 */
export function AdminProductsSupplyDialog({
  open,
  onClose,
  productId,
  productName,
  currentStock,
  onSave,
  loading = false
}: AdminProductsSupplyDialogProps) {
  const { t } = useTranslation();
  
  // Form state
  const [formData, setFormData] = useState<SupplyFormData>({
    quantity: 0,
    supplierName: '',
    unitPrice: 0,
    noUserPrice: 0,
    categoryPrices: {}
  });
  
  // Validation errors
  const [errors, setErrors] = useState<SupplyValidationErrors>({});
  
  // Supplier dropdown state
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  
  // Category prices state
  const [categoryPrices, setCategoryPrices] = useState<Record<number, number>>({});
  
  // Existing stock warning
  const [stockWarning, setStockWarning] = useState<ExistingStockWarning>({
    hasExistingStock: false,
    currentQuantity: 0,
    message: ''
  });

  // Check for existing stock when dialog opens
  useEffect(() => {
    if (open && currentStock > 0) {
      setStockWarning({
        hasExistingStock: true,
        currentQuantity: currentStock,
        message: t('admin.supply.existingStockWarning', { quantity: currentStock })
      });
    } else {
      setStockWarning({
        hasExistingStock: false,
        currentQuantity: 0,
        message: ''
      });
    }
  }, [open, currentStock, t]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        quantity: 0,
        supplierName: '',
        unitPrice: 0,
        noUserPrice: 0,
        categoryPrices: {}
      });
      setCategoryPrices({});
      setErrors({});
      setSupplierSearch('');
    }
  }, [open]);

  /**
   * Validate form data
   */
  const validateForm = useCallback((): boolean => {
    const newErrors: SupplyValidationErrors = {};
    
    if (!formData.quantity || formData.quantity <= 0) {
      newErrors.quantity = t('admin.supply.validation.quantityRequired');
    }
    
    if (!formData.supplierName || formData.supplierName.trim() === '') {
      newErrors.supplierName = t('admin.supply.validation.supplierRequired');
    }
    
    if (!formData.unitPrice || formData.unitPrice <= 0) {
      newErrors.unitPrice = t('admin.supply.validation.unitPriceRequired');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, t]);

  /**
   * Handle input changes
   */
  const handleInputChange = useCallback((field: keyof SupplyFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field as keyof SupplyValidationErrors] && value) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  /**
   * Handle category price changes
   */
  const handleCategoryPriceChange = useCallback((categoryId: number, value: number) => {
    setCategoryPrices(prev => ({ ...prev, [categoryId]: value }));
    setFormData(prev => ({ ...prev, categoryPrices: { ...prev.categoryPrices, [categoryId]: value } }));
  }, []);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      return;
    }
    
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save supply:', error);
    }
  }, [formData, validateForm, onSave, onClose]);

  /**
   * Handle supplier selection
   */
  const handleSupplierSelect = useCallback((supplierName: string) => {
    setFormData(prev => ({ ...prev, supplierName }));
    setSupplierOpen(false);
    setSupplierSearch('');
  }, []);

  /**
   * Handle create new supplier
   */
  const handleCreateNewSupplier = useCallback(() => {
    if (supplierSearch.trim()) {
      setFormData(prev => ({ ...prev, supplierName: supplierSearch.trim() }));
      setSupplierOpen(false);
      setSupplierSearch('');
    }
  }, [supplierSearch]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {t('admin.supply.title')}
          </DialogTitle>
          <DialogDescription>
            {t('admin.supply.description', { productName })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Existing Stock Warning */}
          {stockWarning.hasExistingStock && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {stockWarning.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Supply Form */}
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.supply.supplyInfo')}</CardTitle>
              <CardDescription>{t('admin.supply.supplyInfoDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quantity and Supplier */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">{t('admin.supply.quantity')} *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={formData.quantity || ''}
                    onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 0)}
                    placeholder={t('admin.supply.quantityPlaceholder')}
                    className={errors.quantity ? 'border-red-500' : ''}
                  />
                  {errors.quantity && <p className="text-sm text-red-500">{errors.quantity}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplier">{t('admin.supply.supplier')} *</Label>
                  <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={supplierOpen}
                        className={cn(
                          "w-full justify-between",
                          errors.supplierName && "border-red-500"
                        )}
                      >
                        {formData.supplierName || t('admin.supply.selectSupplier')}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput
                          placeholder={t('admin.supply.searchSupplier')}
                          value={supplierSearch}
                          onValueChange={setSupplierSearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            <div className="flex items-center justify-center p-2">
                              <span className="text-sm text-muted-foreground">{t('admin.supply.noSuppliersFound')}</span>
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {/* Create new supplier option */}
                            {supplierSearch.trim() && (
                              <CommandItem
                                onSelect={handleCreateNewSupplier}
                                className="text-blue-600"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                {t('admin.supply.createNew')} "{supplierSearch}"
                              </CommandItem>
                            )}
                            {mockSuppliers
                              .filter(supplier => 
                                supplier.supplierName.toLowerCase().includes(supplierSearch.toLowerCase())
                              )
                              .map((supplier) => (
                                <CommandItem
                                  key={supplier.idSupplier}
                                  value={supplier.supplierName}
                                  onSelect={() => handleSupplierSelect(supplier.supplierName)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.supplierName === supplier.supplierName ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {supplier.supplierName}
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {errors.supplierName && <p className="text-sm text-red-500">{errors.supplierName}</p>}
                </div>
              </div>

              {/* Pricing */}
              <div className="space-y-4">
                <h4 className="font-medium">{t('admin.supply.pricing')}</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unitPrice">{t('admin.supply.unitPrice')} (DA) *</Label>
                    <Input
                      id="unitPrice"
                      type="number"
                      value={formData.unitPrice || ''}
                      onChange={(e) => handleInputChange('unitPrice', parseFloat(e.target.value) || 0)}
                      placeholder={t('admin.supply.unitPricePlaceholder')}
                      className={errors.unitPrice ? 'border-red-500' : ''}
                    />
                    {errors.unitPrice && <p className="text-sm text-red-500">{errors.unitPrice}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="noUserPrice">{t('admin.supply.noUserPrice')} (DA)</Label>
                    <Input
                      id="noUserPrice"
                      type="number"
                      value={formData.noUserPrice || ''}
                      onChange={(e) => handleInputChange('noUserPrice', parseFloat(e.target.value) || 0)}
                      placeholder={t('admin.supply.noUserPricePlaceholder')}
                    />
                    {formData.unitPrice && formData.noUserPrice && (
                      <p className="text-sm text-muted-foreground">
                        {t('admin.supply.revenueCalculation').replace('{percentage}', calculateRevenue(formData.unitPrice, formData.noUserPrice))}
                      </p>
                    )}
                  </div>
                </div>

                {/* Category Prices */}
                <div className="space-y-4">
                  <h4 className="font-medium">{t('admin.supply.categoryPrices')}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="premiumPrice">{t('admin.supply.premiumPrice')} (DA)</Label>
                      <Input
                        id="premiumPrice"
                        type="number"
                        value={categoryPrices[1] || ''}
                        onChange={(e) => handleCategoryPriceChange(1, parseFloat(e.target.value) || 0)}
                        placeholder={t('admin.supply.premiumPricePlaceholder')}
                      />
                      {formData.unitPrice && categoryPrices[1] && (
                        <p className="text-xs text-green-600">
                          +{calculateRevenue(formData.unitPrice, categoryPrices[1])}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="standardPrice">{t('admin.supply.standardPrice')} (DA)</Label>
                      <Input
                        id="standardPrice"
                        type="number"
                        value={categoryPrices[2] || ''}
                        onChange={(e) => handleCategoryPriceChange(2, parseFloat(e.target.value) || 0)}
                        placeholder={t('admin.supply.standardPricePlaceholder')}
                      />
                      {formData.unitPrice && categoryPrices[2] && (
                        <p className="text-xs text-green-600">
                          +{calculateRevenue(formData.unitPrice, categoryPrices[2])}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="basicPrice">{t('admin.supply.basicPrice')} (DA)</Label>
                      <Input
                        id="basicPrice"
                        type="number"
                        value={categoryPrices[3] || ''}
                        onChange={(e) => handleCategoryPriceChange(3, parseFloat(e.target.value) || 0)}
                        placeholder={t('admin.supply.basicPricePlaceholder')}
                      />
                      {formData.unitPrice && categoryPrices[3] && (
                        <p className="text-xs text-green-600">
                          +{calculateRevenue(formData.unitPrice, categoryPrices[3])}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? t('common.saving') : t('admin.supply.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
