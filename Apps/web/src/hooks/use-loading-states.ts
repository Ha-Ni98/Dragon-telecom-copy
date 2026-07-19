import { useState, useCallback, useEffect } from "react";

/**
 * Loading operation type enumeration
 */
export enum LoadingOperation {
  BARCODE_GENERATION = 'barcode_generation',
  PRODUCT_NAME_GENERATION = 'product_name_generation',
  IMAGE_UPLOAD = 'image_upload',
  IMAGE_COMPRESSION = 'image_compression',
  FORM_SUBMISSION = 'form_submission',
  DATA_FETCHING = 'data_fetching',
  VALIDATION = 'validation',
  SUGGESTION_FETCHING = 'suggestion_fetching'
}

/**
 * Loading state interface
 */
interface LoadingState {
  operation: LoadingOperation;
  isActive: boolean;
  progress?: number;
  message?: string;
  startTime: Date;
  estimatedDuration?: number;
}

/**
 * Loading states management hook
 */
export function useLoadingStates() {
  const [loadingStates, setLoadingStates] = useState<Map<LoadingOperation, LoadingState>>(new Map());
  const [globalLoading, setGlobalLoading] = useState(false);

  /**
   * Start loading for an operation
   */
  const startLoading = useCallback((
    operation: LoadingOperation,
    message?: string,
    estimatedDuration?: number
  ) => {
    setLoadingStates(prev => {
      const newMap = new Map(prev);
      newMap.set(operation, {
        operation,
        isActive: true,
        message,
        startTime: new Date(),
        estimatedDuration
      });
      return newMap;
    });

    setGlobalLoading(true);
  }, []);

  /**
   * Update loading progress
   */
  const updateProgress = useCallback((
    operation: LoadingOperation,
    progress: number,
    message?: string
  ) => {
    setLoadingStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(operation);
      if (currentState) {
        newMap.set(operation, {
          ...currentState,
          progress: Math.min(100, Math.max(0, progress)),
          message: message || currentState.message
        });
      }
      return newMap;
    });
  }, []);

  /**
   * Stop loading for an operation
   */
  const stopLoading = useCallback((operation: LoadingOperation) => {
    setLoadingStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(operation);
      return newMap;
    });

    // Check if any operations are still loading
    setLoadingStates(current => {
      const hasActiveOperations = Array.from(current.values()).some(state => state.isActive);
      setGlobalLoading(hasActiveOperations);
      return current;
    });
  }, []);

  /**
   * Check if an operation is loading
   */
  const isLoading = useCallback((operation: LoadingOperation) => {
    return loadingStates.has(operation) && loadingStates.get(operation)?.isActive;
  }, [loadingStates]);

  /**
   * Get loading state for an operation
   */
  const getLoadingState = useCallback((operation: LoadingOperation) => {
    return loadingStates.get(operation);
  }, [loadingStates]);

  /**
   * Get all active loading operations
   */
  const getActiveOperations = useCallback(() => {
    return Array.from(loadingStates.values()).filter(state => state.isActive);
  }, [loadingStates]);

  /**
   * Get loading summary
   */
  const getLoadingSummary = useCallback(() => {
    const activeOperations = getActiveOperations();
    const totalOperations = activeOperations.length;
    const operationsWithProgress = activeOperations.filter(op => op.progress !== undefined);
    const averageProgress = operationsWithProgress.length > 0 
      ? operationsWithProgress.reduce((sum, op) => sum + (op.progress || 0), 0) / operationsWithProgress.length
      : 0;

    return {
      totalOperations,
      averageProgress,
      operations: activeOperations.map(op => ({
        operation: op.operation,
        progress: op.progress,
        message: op.message,
        duration: Date.now() - op.startTime.getTime()
      }))
    };
  }, [getActiveOperations]);

  /**
   * Clear all loading states
   */
  const clearAllLoading = useCallback(() => {
    setLoadingStates(new Map());
    setGlobalLoading(false);
  }, []);

  /**
   * Get loading message for an operation
   */
  const getLoadingMessage = useCallback((operation: LoadingOperation) => {
    const state = getLoadingState(operation);
    if (!state) return null;

    if (state.message) return state.message;

    // Default messages based on operation
    switch (operation) {
      case LoadingOperation.BARCODE_GENERATION:
        return 'Generating unique barcode...';
      case LoadingOperation.PRODUCT_NAME_GENERATION:
        return 'Generating product name...';
      case LoadingOperation.IMAGE_UPLOAD:
        return 'Uploading images...';
      case LoadingOperation.IMAGE_COMPRESSION:
        return 'Compressing images...';
      case LoadingOperation.FORM_SUBMISSION:
        return 'Submitting form...';
      case LoadingOperation.DATA_FETCHING:
        return 'Fetching data...';
      case LoadingOperation.VALIDATION:
        return 'Validating form...';
      case LoadingOperation.SUGGESTION_FETCHING:
        return 'Loading suggestions...';
      default:
        return 'Processing...';
    }
  }, [getLoadingState]);

  /**
   * Get estimated time remaining
   */
  const getEstimatedTimeRemaining = useCallback((operation: LoadingOperation) => {
    const state = getLoadingState(operation);
    if (!state || !state.estimatedDuration) return null;

    const elapsed = Date.now() - state.startTime.getTime();
    const remaining = state.estimatedDuration - elapsed;
    
    if (remaining <= 0) return 'Almost done...';
    
    const seconds = Math.ceil(remaining / 1000);
    if (seconds < 60) return `${seconds}s remaining`;
    
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}m remaining`;
  }, [getLoadingState]);

  /**
   * Check if operation is taking too long
   */
  const isOperationStuck = useCallback((operation: LoadingOperation, timeoutMs: number = 30000) => {
    const state = getLoadingState(operation);
    if (!state) return false;

    const elapsed = Date.now() - state.startTime.getTime();
    return elapsed > timeoutMs;
  }, [getLoadingState]);

  /**
   * Auto-stop stuck operations
   */
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingStates(prev => {
        const newMap = new Map(prev);
        let hasChanges = false;

        for (const [operation, state] of newMap.entries()) {
          if (state.isActive && isOperationStuck(operation)) {
            newMap.delete(operation);
            hasChanges = true;
          }
        }

        if (hasChanges) {
          // Check if any operations are still loading
          const hasActiveOperations = Array.from(newMap.values()).some(state => state.isActive);
          setGlobalLoading(hasActiveOperations);
        }

        return newMap;
      });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [isOperationStuck]);

  return {
    // State
    globalLoading,
    loadingStates: Array.from(loadingStates.values()),
    
    // Actions
    startLoading,
    updateProgress,
    stopLoading,
    clearAllLoading,
    
    // Utilities
    isLoading,
    getLoadingState,
    getActiveOperations,
    getLoadingSummary,
    getLoadingMessage,
    getEstimatedTimeRemaining,
    isOperationStuck
  };
}
