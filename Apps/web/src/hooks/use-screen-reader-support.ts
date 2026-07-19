import { useEffect, useCallback, useRef, useState } from 'react';

export interface ScreenReaderAnnouncement {
  message: string;
  priority: 'polite' | 'assertive';
  timestamp: number;
}

export interface ScreenReaderSupportOptions {
  announceValidation?: boolean;
  announceProgress?: boolean;
  announceErrors?: boolean;
  announceSuccess?: boolean;
  announceNavigation?: boolean;
}

/**
 * Hook for managing screen reader support and announcements
 */
export function useScreenReaderSupport(options: ScreenReaderSupportOptions = {}) {
  const {
    announceValidation = true,
    announceProgress = true,
    announceErrors = true,
    announceSuccess = true,
    announceNavigation = true
  } = options;

  const [announcements, setAnnouncements] = useState<ScreenReaderAnnouncement[]>([]);
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  // Create live region for announcements
  useEffect(() => {
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    liveRegion.id = 'screen-reader-announcements';
    document.body.appendChild(liveRegion);
    liveRegionRef.current = liveRegion;

    return () => {
      if (liveRegionRef.current) {
        document.body.removeChild(liveRegionRef.current);
      }
    };
  }, []);

  // Announce message to screen readers
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!liveRegionRef.current) return;

    const announcement: ScreenReaderAnnouncement = {
      message,
      priority,
      timestamp: Date.now()
    };

    setAnnouncements(prev => [...prev, announcement]);

    // Update live region
    liveRegionRef.current.setAttribute('aria-live', priority);
    liveRegionRef.current.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = '';
      }
    }, 1000);
  }, []);

  // Announce validation messages
  const announceValidationMessage = useCallback((message: string, isValid: boolean) => {
    if (!announceValidation) return;

    const prefix = isValid ? 'Valid' : 'Invalid';
    announce(`${prefix}: ${message}`, isValid ? 'polite' : 'assertive');
  }, [announce, announceValidation]);

  // Announce progress updates
  const announceProgressUpdate = useCallback((message: string, progress?: number) => {
    if (!announceProgress) return;

    const progressMessage = progress !== undefined 
      ? `${message} (${progress}% complete)`
      : message;
    
    announce(progressMessage, 'polite');
  }, [announce, announceProgress]);

  // Announce errors
  const announceError = useCallback((message: string) => {
    if (!announceErrors) return;

    announce(`Error: ${message}`, 'assertive');
  }, [announce, announceErrors]);

  // Announce success
  const announceSuccessMessage = useCallback((message: string) => {
    if (!announceSuccess) return;

    announce(`Success: ${message}`, 'polite');
  }, [announce, announceSuccess]);

  // Announce navigation
  const announceNavigationMessage = useCallback((message: string) => {
    if (!announceNavigation) return;

    announce(message, 'polite');
  }, [announce, announceNavigation]);

  // Announce form field changes
  const announceFieldChange = useCallback((fieldName: string, value: string, isValid: boolean) => {
    const message = `${fieldName} changed to ${value}`;
    announceValidationMessage(message, isValid);
  }, [announceValidationMessage]);

  // Announce form submission progress
  const announceSubmissionProgress = useCallback((step: string, progress?: number) => {
    announceProgressUpdate(`Form submission: ${step}`, progress);
  }, [announceProgressUpdate]);

  // Announce form completion
  const announceFormCompletion = useCallback((success: boolean, message: string) => {
    if (success) {
      announceSuccessMessage(message);
    } else {
      announceError(message);
    }
  }, [announceSuccessMessage, announceError]);

  // Announce image upload progress
  const announceImageUpload = useCallback((filename: string, status: 'uploading' | 'success' | 'error') => {
    switch (status) {
      case 'uploading':
        announceProgressUpdate(`Uploading ${filename}`);
        break;
      case 'success':
        announceSuccessMessage(`${filename} uploaded successfully`);
        break;
      case 'error':
        announceError(`Failed to upload ${filename}`);
        break;
    }
  }, [announceProgressUpdate, announceSuccessMessage, announceError]);

  // Announce autocomplete suggestions
  const announceAutocompleteSuggestions = useCallback((count: number, selectedIndex?: number) => {
    const message = selectedIndex !== undefined
      ? `${count} suggestions available. ${selectedIndex + 1} of ${count} selected.`
      : `${count} suggestions available.`;
    
    announce(message, 'polite');
  }, [announce]);

  // Announce focus changes
  const announceFocusChange = useCallback((elementName: string, elementType: string) => {
    announceNavigationMessage(`Focused on ${elementName} (${elementType})`);
  }, [announceNavigationMessage]);

  // Announce form state changes
  const announceFormStateChange = useCallback((state: string) => {
    announceNavigationMessage(`Form state changed to ${state}`);
  }, [announceNavigationMessage]);

  // Announce validation results
  const announceValidationResults = useCallback((errors: number, warnings: number, suggestions: number) => {
    const message = `Validation complete: ${errors} errors, ${warnings} warnings, ${suggestions} suggestions`;
    announce(message, errors > 0 ? 'assertive' : 'polite');
  }, [announce]);

  // Announce unsaved changes
  const announceUnsavedChanges = useCallback((hasChanges: boolean) => {
    if (hasChanges) {
      announce('You have unsaved changes', 'polite');
    } else {
      announce('All changes saved', 'polite');
    }
  }, [announce]);

  // Announce auto-save
  const announceAutoSave = useCallback((success: boolean) => {
    if (success) {
      announce('Form auto-saved', 'polite');
    } else {
      announce('Auto-save failed', 'assertive');
    }
  }, [announce]);

  return {
    announcements,
    announce,
    announceValidation: announceValidationMessage,
    announceProgress: announceProgressUpdate,
    announceError,
    announceSuccess: announceSuccessMessage,
    announceNavigation: announceNavigationMessage,
    announceFieldChange,
    announceSubmissionProgress,
    announceFormCompletion,
    announceImageUpload,
    announceAutocompleteSuggestions,
    announceFocusChange,
    announceFormStateChange,
    announceValidationResults,
    announceUnsavedChanges,
    announceAutoSave
  };
}

/**
 * Hook for managing screen reader support in forms
 */
export function useFormScreenReaderSupport() {
  const screenReaderSupport = useScreenReaderSupport({
    announceValidation: true,
    announceProgress: true,
    announceErrors: true,
    announceSuccess: true,
    announceNavigation: true
  });

  // Announce form field validation
  const announceFieldValidation = useCallback((
    fieldName: string, 
    value: string, 
    isValid: boolean, 
    errorMessage?: string
  ) => {
    if (isValid) {
      screenReaderSupport.announceFieldChange(fieldName, value, true);
    } else {
      screenReaderSupport.announceError(`${fieldName}: ${errorMessage || 'Invalid input'}`);
    }
  }, [screenReaderSupport]);

  // Announce form submission steps
  const announceFormSubmission = useCallback((step: string, progress?: number) => {
    screenReaderSupport.announceSubmissionProgress(step, progress);
  }, [screenReaderSupport]);

  // Announce form completion
  const announceFormCompletion = useCallback((success: boolean, message: string) => {
    screenReaderSupport.announceFormCompletion(success, message);
  }, [screenReaderSupport]);

  // Announce form reset
  const announceFormReset = useCallback(() => {
    screenReaderSupport.announceNavigation('Form reset to default values');
  }, [screenReaderSupport]);

  // Announce form save
  const announceFormSave = useCallback((success: boolean) => {
    if (success) {
      screenReaderSupport.announceSuccess('Form saved successfully');
    } else {
      screenReaderSupport.announceError('Failed to save form');
    }
  }, [screenReaderSupport]);

  return {
    ...screenReaderSupport,
    announceFieldValidation,
    announceFormSubmission,
    announceFormCompletion,
    announceFormReset,
    announceFormSave
  };
}

/**
 * Hook for managing screen reader support in image uploads
 */
export function useImageUploadScreenReaderSupport() {
  const screenReaderSupport = useScreenReaderSupport({
    announceProgress: true,
    announceErrors: true,
    announceSuccess: true
  });

  // Announce image selection
  const announceImageSelection = useCallback((count: number) => {
    const message = count === 1 ? '1 image selected' : `${count} images selected`;
    screenReaderSupport.announce(message, 'polite');
  }, [screenReaderSupport]);

  // Announce image upload progress
  const announceImageUploadProgress = useCallback((filename: string, progress: number) => {
    screenReaderSupport.announceProgress(`Uploading ${filename}`, progress);
  }, [screenReaderSupport]);

  // Announce image upload completion
  const announceImageUploadCompletion = useCallback((filename: string, success: boolean) => {
    screenReaderSupport.announceImageUpload(filename, success ? 'success' : 'error');
  }, [screenReaderSupport]);

  // Announce image deletion
  const announceImageDeletion = useCallback((filename: string) => {
    screenReaderSupport.announce(`Image ${filename} deleted`, 'polite');
  }, [screenReaderSupport]);

  // Announce image reordering
  const announceImageReordering = useCallback((fromIndex: number, toIndex: number) => {
    screenReaderSupport.announce(`Image moved from position ${fromIndex + 1} to position ${toIndex + 1}`, 'polite');
  }, [screenReaderSupport]);

  return {
    ...screenReaderSupport,
    announceImageSelection,
    announceImageUploadProgress,
    announceImageUploadCompletion,
    announceImageDeletion,
    announceImageReordering
  };
}

/**
 * Hook for managing screen reader support in autocomplete
 */
export function useAutocompleteScreenReaderSupport() {
  const screenReaderSupport = useScreenReaderSupport({
    announceNavigation: true
  });

  // Announce suggestion selection
  const announceSuggestionSelection = useCallback((suggestion: string, index: number, total: number) => {
    screenReaderSupport.announce(`Selected ${suggestion} (${index + 1} of ${total})`, 'polite');
  }, [screenReaderSupport]);

  // Announce suggestion navigation
  const announceSuggestionNavigation = useCallback((index: number, total: number) => {
    screenReaderSupport.announce(`Suggestion ${index + 1} of ${total}`, 'polite');
  }, [screenReaderSupport]);

  // Announce suggestion creation
  const announceSuggestionCreation = useCallback((suggestion: string) => {
    screenReaderSupport.announce(`Creating new suggestion: ${suggestion}`, 'polite');
  }, [screenReaderSupport]);

  return {
    ...screenReaderSupport,
    announceSuggestionSelection,
    announceSuggestionNavigation,
    announceSuggestionCreation
  };
}
