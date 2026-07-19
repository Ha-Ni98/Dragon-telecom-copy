import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

/**
 * Error type enumeration
 */
export enum ErrorType {
  VALIDATION = 'validation',
  NETWORK = 'network',
  SERVER = 'server',
  UPLOAD = 'upload',
  GENERATION = 'generation',
  UNKNOWN = 'unknown'
}

/**
 * Error severity enumeration
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Form error interface
 */
interface FormError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  field?: string;
  timestamp: Date;
  resolved: boolean;
  retryable: boolean;
}

/**
 * Error handling state interface
 */
interface ErrorHandlingState {
  errors: FormError[];
  hasErrors: boolean;
  criticalErrors: number;
  retryableErrors: number;
}

/**
 * Custom hook for comprehensive error handling
 */
export function useFormErrorHandling() {
  const [state, setState] = useState<ErrorHandlingState>({
    errors: [],
    hasErrors: false,
    criticalErrors: 0,
    retryableErrors: 0
  });

  /**
   * Add error to the error list
   */
  const addError = useCallback((
    type: ErrorType,
    message: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    field?: string,
    retryable: boolean = false
  ) => {
    const error: FormError = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      field,
      timestamp: new Date(),
      resolved: false,
      retryable
    };

    setState(prev => {
      const newErrors = [...prev.errors, error];
      const criticalErrors = newErrors.filter(e => e.severity === ErrorSeverity.CRITICAL && !e.resolved).length;
      const retryableErrors = newErrors.filter(e => e.retryable && !e.resolved).length;

      return {
        errors: newErrors,
        hasErrors: newErrors.some(e => !e.resolved),
        criticalErrors,
        retryableErrors
      };
    });

    // Show toast notification based on severity
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        toast.error(message, { duration: 10000 });
        break;
      case ErrorSeverity.HIGH:
        toast.error(message, { duration: 8000 });
        break;
      case ErrorSeverity.MEDIUM:
        toast.error(message, { duration: 5000 });
        break;
      case ErrorSeverity.LOW:
        toast.warning(message, { duration: 3000 });
        break;
    }

    return error.id;
  }, []);

  /**
   * Resolve error by ID
   */
  const resolveError = useCallback((errorId: string) => {
    setState(prev => {
      const newErrors = prev.errors.map(error => 
        error.id === errorId ? { ...error, resolved: true } : error
      );
      const criticalErrors = newErrors.filter(e => e.severity === ErrorSeverity.CRITICAL && !e.resolved).length;
      const retryableErrors = newErrors.filter(e => e.retryable && !e.resolved).length;

      return {
        errors: newErrors,
        hasErrors: newErrors.some(e => !e.resolved),
        criticalErrors,
        retryableErrors
      };
    });
  }, []);

  /**
   * Resolve all errors of a specific type
   */
  const resolveErrorsByType = useCallback((type: ErrorType) => {
    setState(prev => {
      const newErrors = prev.errors.map(error => 
        error.type === type ? { ...error, resolved: true } : error
      );
      const criticalErrors = newErrors.filter(e => e.severity === ErrorSeverity.CRITICAL && !e.resolved).length;
      const retryableErrors = newErrors.filter(e => e.retryable && !e.resolved).length;

      return {
        errors: newErrors,
        hasErrors: newErrors.some(e => !e.resolved),
        criticalErrors,
        retryableErrors
      };
    });
  }, []);

  /**
   * Clear all errors
   */
  const clearAllErrors = useCallback(() => {
    setState({
      errors: [],
      hasErrors: false,
      criticalErrors: 0,
      retryableErrors: 0
    });
  }, []);

  /**
   * Get errors by type
   */
  const getErrorsByType = useCallback((type: ErrorType) => {
    return state.errors.filter(error => error.type === type && !error.resolved);
  }, [state.errors]);

  /**
   * Get errors by severity
   */
  const getErrorsBySeverity = useCallback((severity: ErrorSeverity) => {
    return state.errors.filter(error => error.severity === severity && !error.resolved);
  }, [state.errors]);

  /**
   * Get errors by field
   */
  const getErrorsByField = useCallback((field: string) => {
    return state.errors.filter(error => error.field === field && !error.resolved);
  }, [state.errors]);

  /**
   * Check if form can be submitted
   */
  const canSubmit = useCallback(() => {
    return !state.hasErrors && state.criticalErrors === 0;
  }, [state.hasErrors, state.criticalErrors]);

  /**
   * Get error summary
   */
  const getErrorSummary = useCallback(() => {
    const unresolvedErrors = state.errors.filter(error => !error.resolved);
    
    return {
      total: unresolvedErrors.length,
      byType: {
        validation: unresolvedErrors.filter(e => e.type === ErrorType.VALIDATION).length,
        network: unresolvedErrors.filter(e => e.type === ErrorType.NETWORK).length,
        server: unresolvedErrors.filter(e => e.type === ErrorType.SERVER).length,
        upload: unresolvedErrors.filter(e => e.type === ErrorType.UPLOAD).length,
        generation: unresolvedErrors.filter(e => e.type === ErrorType.GENERATION).length,
        unknown: unresolvedErrors.filter(e => e.type === ErrorType.UNKNOWN).length
      },
      bySeverity: {
        low: unresolvedErrors.filter(e => e.severity === ErrorSeverity.LOW).length,
        medium: unresolvedErrors.filter(e => e.severity === ErrorSeverity.MEDIUM).length,
        high: unresolvedErrors.filter(e => e.severity === ErrorSeverity.HIGH).length,
        critical: unresolvedErrors.filter(e => e.severity === ErrorSeverity.CRITICAL).length
      }
    };
  }, [state.errors]);

  /**
   * Handle specific error types
   */
  const handleValidationError = useCallback((message: string, field?: string) => {
    return addError(ErrorType.VALIDATION, message, ErrorSeverity.MEDIUM, field);
  }, [addError]);

  const handleNetworkError = useCallback((message: string) => {
    return addError(ErrorType.NETWORK, message, ErrorSeverity.HIGH, undefined, true);
  }, [addError]);

  const handleServerError = useCallback((message: string) => {
    return addError(ErrorType.SERVER, message, ErrorSeverity.CRITICAL, undefined, true);
  }, [addError]);

  const handleUploadError = useCallback((message: string, field?: string) => {
    return addError(ErrorType.UPLOAD, message, ErrorSeverity.MEDIUM, field, true);
  }, [addError]);

  const handleGenerationError = useCallback((message: string, field?: string) => {
    return addError(ErrorType.GENERATION, message, ErrorSeverity.LOW, field, true);
  }, [addError]);

  /**
   * Retry failed operations
   */
  const retryFailedOperations = useCallback(() => {
    const retryableErrors = state.errors.filter(error => error.retryable && !error.resolved);
    
    if (retryableErrors.length > 0) {
      toast.info(`Retrying ${retryableErrors.length} failed operations...`);
      
      // Clear retryable errors
      retryableErrors.forEach(error => resolveError(error.id));
    }
  }, [state.errors, resolveError]);

  // Auto-clear old errors after 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      setState(prev => {
        const newErrors = prev.errors.filter(error => 
          error.timestamp > fiveMinutesAgo || !error.resolved
        );
        
        if (newErrors.length !== prev.errors.length) {
          const criticalErrors = newErrors.filter(e => e.severity === ErrorSeverity.CRITICAL && !e.resolved).length;
          const retryableErrors = newErrors.filter(e => e.retryable && !e.resolved).length;

          return {
            errors: newErrors,
            hasErrors: newErrors.some(e => !e.resolved),
            criticalErrors,
            retryableErrors
          };
        }
        
        return prev;
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    addError,
    resolveError,
    resolveErrorsByType,
    clearAllErrors,
    
    // Utilities
    getErrorsByType,
    getErrorsBySeverity,
    getErrorsByField,
    canSubmit,
    getErrorSummary,
    retryFailedOperations,
    
    // Specific handlers
    handleValidationError,
    handleNetworkError,
    handleServerError,
    handleUploadError,
    handleGenerationError
  };
}
