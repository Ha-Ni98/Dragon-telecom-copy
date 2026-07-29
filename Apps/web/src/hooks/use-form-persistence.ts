import { useState, useEffect, useCallback, useRef } from 'react';
import { ProductAddFormData } from '@/types/draft-types/admin-product-add.types';

export interface PersistenceOptions {
  storageKey: string;
  autoSave: boolean;
  saveInterval: number; // in milliseconds
  maxRetries: number;
  retryDelay: number; // in milliseconds
}

export interface PersistenceState {
  isSaving: boolean;
  isLoading: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  error: string | null;
  retryCount: number;
}

/**
 * Hook for managing form data persistence and recovery
 */
export function useFormPersistence(
  formData: ProductAddFormData,
  options: PersistenceOptions = {
    storageKey: 'product-add-form',
    autoSave: true,
    saveInterval: 30000, // 30 seconds
    maxRetries: 3,
    retryDelay: 1000
  }
) {
  const [persistenceState, setPersistenceState] = useState<PersistenceState>({
    isSaving: false,
    isLoading: false,
    lastSaved: null,
    hasUnsavedChanges: false,
    error: null,
    retryCount: 0
  });

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedDataRef = useRef<string>('');

  // Check if data has changed
  const hasDataChanged = useCallback((currentData: ProductAddFormData) => {
    const currentDataString = JSON.stringify(currentData);
    return currentDataString !== lastSavedDataRef.current;
  }, []);

  // Save data to localStorage
  const saveData = useCallback(async (data: ProductAddFormData): Promise<boolean> => {
    try {
      setPersistenceState(prev => ({
        ...prev,
        isSaving: true,
        error: null
      }));

      // Convert form data to serializable format
      const serializableData = {
        ...data,
        images: data.images?.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        })) || []
      };

      // Save to localStorage
      localStorage.setItem(options.storageKey, JSON.stringify(serializableData));
      
      // Update last saved data reference
      lastSavedDataRef.current = JSON.stringify(data);
      
      setPersistenceState(prev => ({
        ...prev,
        isSaving: false,
        lastSaved: new Date(),
        hasUnsavedChanges: false,
        retryCount: 0
      }));

      return true;
    } catch (error) {
      console.error('Failed to save form data:', error);
      
      setPersistenceState(prev => ({
        ...prev,
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to save form data'
      }));

      return false;
    }
  }, [options.storageKey]);

  // Load data from localStorage
  const loadData = useCallback((): ProductAddFormData | null => {
    try {
      setPersistenceState(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));

      const savedData = localStorage.getItem(options.storageKey);
      if (!savedData) {
        setPersistenceState(prev => ({
          ...prev,
          isLoading: false
        }));
        return null;
      }

      const parsedData = JSON.parse(savedData);
      
      // Note: Images cannot be fully restored from localStorage
      // as File objects cannot be serialized
      const restoredData: ProductAddFormData = {
        ...parsedData,
        images: [] // Images will need to be re-uploaded
      };

      setPersistenceState(prev => ({
        ...prev,
        isLoading: false,
        lastSaved: new Date(parsedData._lastSaved || Date.now())
      }));

      return restoredData;
    } catch (error) {
      console.error('Failed to load form data:', error);
      
      setPersistenceState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load form data'
      }));

      return null;
    }
  }, [options.storageKey]);

  // Clear saved data
  const clearData = useCallback(() => {
    try {
      localStorage.removeItem(options.storageKey);
      lastSavedDataRef.current = '';
      
      setPersistenceState(prev => ({
        ...prev,
        lastSaved: null,
        hasUnsavedChanges: false,
        error: null
      }));
    } catch (error) {
      console.error('Failed to clear form data:', error);
    }
  }, [options.storageKey]);

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (!options.autoSave || persistenceState.isSaving) return;

    if (hasDataChanged(formData)) {
      const success = await saveData(formData);
      
      if (!success && persistenceState.retryCount < options.maxRetries) {
        // Retry after delay
        setPersistenceState(prev => ({
          ...prev,
          retryCount: prev.retryCount + 1
        }));

        retryTimeoutRef.current = setTimeout(() => {
          autoSave();
        }, options.retryDelay);
      }
    }
  }, [
    formData,
    options.autoSave,
    options.maxRetries,
    options.retryDelay,
    persistenceState.isSaving,
    persistenceState.retryCount,
    hasDataChanged,
    saveData
  ]);

  // Set up auto-save interval
  useEffect(() => {
    if (options.autoSave) {
      saveTimeoutRef.current = setInterval(autoSave, options.saveInterval);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearInterval(saveTimeoutRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [options.autoSave, options.saveInterval, autoSave]);

  // Check for unsaved changes
  useEffect(() => {
    const hasChanges = hasDataChanged(formData);
    setPersistenceState(prev => ({
      ...prev,
      hasUnsavedChanges: hasChanges
    }));
  }, [formData, hasDataChanged]);

  // Manual save
  const manualSave = useCallback(async () => {
    return await saveData(formData);
  }, [formData, saveData]);

  // Force save (ignores auto-save settings)
  const forceSave = useCallback(async () => {
    return await saveData(formData);
  }, [formData, saveData]);

  // Check if there's saved data
  const hasSavedData = useCallback(() => {
    return localStorage.getItem(options.storageKey) !== null;
  }, [options.storageKey]);

  // Get saved data info
  const getSavedDataInfo = useCallback(() => {
    try {
      const savedData = localStorage.getItem(options.storageKey);
      if (!savedData) return null;

      const parsedData = JSON.parse(savedData);
      return {
        lastSaved: new Date(parsedData._lastSaved || Date.now()),
        size: savedData.length,
        hasImages: parsedData.images && parsedData.images.length > 0
      };
    } catch (error) {
      console.error('Failed to get saved data info:', error);
      return null;
    }
  }, [options.storageKey]);

  // Restore form data
  const restoreData = useCallback(() => {
    const savedData = loadData();
    if (savedData) {
      // Clear the saved data after restoration
      clearData();
    }
    return savedData;
  }, [loadData, clearData]);

  // Check for unsaved changes before navigation
  const checkUnsavedChanges = useCallback(() => {
    return persistenceState.hasUnsavedChanges;
  }, [persistenceState.hasUnsavedChanges]);

  // Warn about unsaved changes
  const warnUnsavedChanges = useCallback(() => {
    if (persistenceState.hasUnsavedChanges) {
      return window.confirm(
        'You have unsaved changes. Are you sure you want to leave this page?'
      );
    }
    return true;
  }, [persistenceState.hasUnsavedChanges]);

  return {
    // State
    persistenceState,
    isSaving: persistenceState.isSaving,
    isLoading: persistenceState.isLoading,
    lastSaved: persistenceState.lastSaved,
    hasUnsavedChanges: persistenceState.hasUnsavedChanges,
    error: persistenceState.error,
    
    // Actions
    saveData: manualSave,
    forceSave,
    loadData,
    clearData,
    restoreData,
    
    // Utilities
    hasSavedData,
    getSavedDataInfo,
    checkUnsavedChanges,
    warnUnsavedChanges,
    
    // Auto-save control
    enableAutoSave: () => {
      setPersistenceState(prev => ({ ...prev, isSaving: false }));
    },
    disableAutoSave: () => {
      if (saveTimeoutRef.current) {
        clearInterval(saveTimeoutRef.current);
      }
    }
  };
}
