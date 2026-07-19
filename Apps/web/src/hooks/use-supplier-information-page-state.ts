import { useState, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/use-toast';
import { SupplierFormData } from '@/types/draft-types/admin-suppliers.types';

/**
 * Hook for managing supplier information page state
 * Handles edit mode, form state, and validation
 */
export function useSupplierInformationPageState() {
  const { t } = useTranslation();
  const { toast } = useToast();

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<SupplierFormData | null>(null);
  const [originalData, setOriginalData] = useState<SupplierFormData | null>(null);

  /**
   * Initialize form data from supplier
   */
  const initializeFormData = useCallback((supplierData: any) => {
    const initialData: SupplierFormData = {
      supplierName: supplierData.supplierName || '',
      supplierPersonName: supplierData.supplierPersonName || '',
      supplierPhone: supplierData.supplierPhone || '',
      supplierEmail: supplierData.supplierEmail || '',
      supplierLocation: supplierData.supplierLocation || '',
      supplierCredit: supplierData.supplierCredit || 0,
    };

    setFormData(initialData);
    setOriginalData(initialData);
    setHasUnsavedChanges(false);
    setError(null);
  }, []);

  /**
   * Update form data
   */
  const updateFormData = useCallback((updates: Partial<SupplierFormData>) => {
    setFormData(prev => {
      if (!prev) return prev;
      const newData = { ...prev, ...updates };
      
      // Check if there are unsaved changes
      const hasChanges = originalData ? 
        JSON.stringify(newData) !== JSON.stringify(originalData) : 
        true;
      setHasUnsavedChanges(hasChanges);
      
      return newData;
    });
  }, [originalData]);

  /**
   * Enter edit mode
   */
  const enterEditMode = useCallback(() => {
    setIsEditMode(true);
    setError(null);
  }, []);

  /**
   * Exit edit mode
   */
  const exitEditMode = useCallback(() => {
    if (hasUnsavedChanges) {
      // Show confirmation dialog
      const confirmed = window.confirm(
        t('admin.suppliers.unsavedChangesConfirm')
      );
      if (!confirmed) return;
    }

    setIsEditMode(false);
    setHasUnsavedChanges(false);
    setError(null);
    
    // Reset form data to original
    if (originalData) {
      setFormData(originalData);
    }
  }, [hasUnsavedChanges, originalData, t]);

  /**
   * Save changes
   */
  const saveChanges = useCallback(async (onSave: (data: SupplierFormData) => Promise<void>) => {
    if (!formData) return;

    setIsSaving(true);
    setError(null);

    try {
      await onSave(formData);
      
      // Update original data
      setOriginalData(formData);
      setHasUnsavedChanges(false);
      setIsEditMode(false);
      
      toast({
        title: t('common.success'),
        description: t('admin.suppliers.updateSuccess'),
        variant: 'default',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('admin.suppliers.updateError');
      setError(errorMessage);
      
      toast({
        title: t('common.error'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [formData, toast, t]);

  /**
   * Cancel changes
   */
  const cancelChanges = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        t('admin.suppliers.unsavedChangesConfirm')
      );
      if (!confirmed) return;
    }

    // Reset to original data
    if (originalData) {
      setFormData(originalData);
    }
    setHasUnsavedChanges(false);
    setIsEditMode(false);
    setError(null);
  }, [hasUnsavedChanges, originalData, t]);

  /**
   * Reset form to original data
   */
  const resetForm = useCallback(() => {
    if (originalData) {
      setFormData(originalData);
      setHasUnsavedChanges(false);
      setError(null);
    }
  }, [originalData]);

  /**
   * Clear all state
   */
  const clearState = useCallback(() => {
    setIsEditMode(false);
    setIsSaving(false);
    setHasUnsavedChanges(false);
    setError(null);
    setFormData(null);
    setOriginalData(null);
  }, []);

  return {
    // State
    isEditMode,
    isSaving,
    hasUnsavedChanges,
    error,
    formData,
    originalData,

    // Actions
    initializeFormData,
    updateFormData,
    enterEditMode,
    exitEditMode,
    saveChanges,
    cancelChanges,
    resetForm,
    clearState,

    // Computed
    canSave: hasUnsavedChanges && !isSaving && formData !== null,
    canCancel: isEditMode,
    canEdit: !isEditMode && !isSaving,
  };
}
