import * as React from 'react';
import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
// Simple debounce implementation
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  const debounced = ((...args: any[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T & { cancel: () => void };
  
  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
  };
  
  return debounced;
}

// Simple throttle implementation
function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastCall = 0;
  
  const throttled = ((...args: any[]) => {
    const now = Date.now();
    if (now - lastCall >= wait) {
      lastCall = now;
      func(...args);
    } else {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        lastCall = Date.now();
        func(...args);
      }, wait - (now - lastCall));
    }
  }) as T & { cancel: () => void };
  
  throttled.cancel = () => {
    if (timeout) clearTimeout(timeout);
  };
  
  return throttled;
}

/**
 * Performance optimization utilities for the Admin Product Add form
 */

export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  bundleSize: number;
  componentCount: number;
  reRenderCount: number;
}

export interface OptimizationOptions {
  debounceDelay?: number;
  throttleDelay?: number;
  memoizationDepth?: number;
  enableProfiling?: boolean;
}

/**
 * Debounced hook for form validation
 */
export function useDebouncedValidation<T>(
  value: T,
  validationFn: (val: T) => boolean,
  delay: number = 300
): boolean {
  const [isValid, setIsValid] = useState(false);
  const debouncedValidation = useMemo(
    () => debounce((val: T) => {
      const result = validationFn(val);
      setIsValid(result);
    }, delay),
    [validationFn, delay]
  );

  useEffect(() => {
    debouncedValidation(value);
    return () => {
      debouncedValidation.cancel();
    };
  }, [value, debouncedValidation]);

  return isValid;
}

/**
 * Throttled hook for auto-save functionality
 */
export function useThrottledAutoSave<T>(
  value: T,
  saveFn: (val: T) => void,
  delay: number = 2000
): void {
  const throttledSave = useMemo(
    () => throttle((val: T) => {
      saveFn(val);
    }, delay),
    [saveFn, delay]
  );

  useEffect(() => {
    throttledSave(value);
    return () => {
      throttledSave.cancel();
    };
  }, [value, throttledSave]);
}

/**
 * Memoized form validation
 */
export function useMemoizedValidation<T>(
  formData: T,
  validationFn: (data: T) => any
): any {
  return useMemo(() => {
    return validationFn(formData);
  }, [formData, validationFn]);
}

/**
 * Optimized form field rendering
 */
export function useOptimizedFieldRendering<T>(
  fields: (keyof T)[],
  formData: T,
  renderFn: (field: keyof T, value: any) => React.ReactNode
): React.ReactNode[] {
  return useMemo(() => {
    return fields.map(field => {
      const value = formData[field];
      return renderFn(field, value);
    });
  }, [fields, formData, renderFn]);
}

/**
 * Lazy loading hook for heavy components
 */
export function useLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const [Component, setComponent] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadComponent = useCallback(async () => {
    if (Component || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const module = await importFn();
      setComponent(() => module.default);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load component'));
    } finally {
      setIsLoading(false);
    }
  }, [Component, isLoading]);

  return {
    Component,
    isLoading,
    error,
    loadComponent
  };
}

/**
 * Virtual scrolling hook for large lists
 */
export function useVirtualScrolling<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + overscan,
      items.length - 1
    );

    return {
      startIndex: Math.max(0, startIndex - overscan),
      endIndex: Math.min(endIndex, items.length - 1)
    };
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [items, visibleRange]);

  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.startIndex * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    containerRef: setContainerRef,
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    visibleRange
  };
}

/**
 * Image optimization hook
 */
export function useImageOptimization(
  files: File[],
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
  } = {}
) {
  const [optimizedFiles, setOptimizedFiles] = useState<File[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);

  const optimizeImages = useCallback(async () => {
    if (files.length === 0) return;

    setIsOptimizing(true);
    setProgress(0);

    try {
      const optimized = await Promise.all(
        files.map(async (file, index) => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();

          return new Promise<File>((resolve, reject) => {
            img.onload = () => {
              const { maxWidth = 1920, maxHeight = 1080, quality = 0.8 } = options;
              
              let { width, height } = img;
              
              // Calculate new dimensions
              if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;
              }

              canvas.width = width;
              canvas.height = height;

              ctx?.drawImage(img, 0, 0, width, height);

              canvas.toBlob(
                (blob) => {
                  if (blob) {
                    const optimizedFile = new File([blob], file.name, {
                      type: `image/${options.format || 'jpeg'}`,
                      lastModified: Date.now()
                    });
                    resolve(optimizedFile);
                  } else {
                    reject(new Error('Failed to optimize image'));
                  }
                },
                `image/${options.format || 'jpeg'}`,
                quality
              );
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
          });
        })
      );

      setOptimizedFiles(optimized);
    } catch (error) {
      console.error('Image optimization failed:', error);
    } finally {
      setIsOptimizing(false);
    }
  }, [files, options]);

  useEffect(() => {
    optimizeImages();
  }, [optimizeImages]);

  return {
    optimizedFiles,
    isOptimizing,
    progress,
    optimizeImages
  };
}

/**
 * Bundle size optimization
 */
export const bundleOptimizations = {
  // Lazy load heavy components
  lazyComponents: [
    'ImageManagement',
    'ValidationMessages',
    'SubmissionSuccess'
  ],

  // Code splitting points
  codeSplittingPoints: [
    'src/components/admin/image-management.tsx',
    'src/components/admin/validation-messages.tsx',
    'src/components/admin/submission-success.tsx',
    'src/lib/validation/form-validation.ts',
    'src/lib/utils/form-reset.ts'
  ],

  // Tree shaking optimizations
  treeShaking: {
    // Only import what's needed from lodash
    lodash: {
      debounce: 'lodash-es/debounce',
      throttle: 'lodash-es/throttle'
    },
    
    // Only import specific icons
    lucide: {
      icons: [
        'Loader2', 'Package', 'Calculator', 'Image', 'Save', 'RotateCcw',
        'CheckCircle', 'AlertCircle', 'Info', 'AlertTriangle'
      ]
    }
  }
};

/**
 * Performance monitoring
 */
export function usePerformanceMonitoring() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    bundleSize: 0,
    componentCount: 0,
    reRenderCount: 0
  });

  const renderCountRef = useRef(0);
  const startTimeRef = useRef(performance.now());

  useEffect(() => {
    const startTime = performance.now();
    
    // Monitor render time
    const measureRenderTime = () => {
      const endTime = performance.now();
      setMetrics(prev => ({
        ...prev,
        renderTime: endTime - startTime
      }));
    };

    // Monitor memory usage
    const measureMemoryUsage = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMetrics(prev => ({
          ...prev,
          memoryUsage: memory.usedJSHeapSize / 1024 / 1024 // MB
        }));
      }
    };

    // Monitor bundle size
    const measureBundleSize = () => {
      const scripts = document.querySelectorAll('script[src]');
      let totalSize = 0;
      
      scripts.forEach(script => {
        const src = script.getAttribute('src');
        if (src && src.includes('assets')) {
          // This is a simplified measurement
          totalSize += 100; // Approximate size per script
        }
      });
      
      setMetrics(prev => ({
        ...prev,
        bundleSize: totalSize
      }));
    };

    // Monitor component count
    const measureComponentCount = () => {
      const components = document.querySelectorAll('[data-component]');
      setMetrics(prev => ({
        ...prev,
        componentCount: components.length
      }));
    };

    // Monitor re-render count
    const measureReRenderCount = () => {
      renderCountRef.current += 1;
      setMetrics(prev => ({
        ...prev,
        reRenderCount: renderCountRef.current
      }));
    };

    measureRenderTime();
    measureMemoryUsage();
    measureBundleSize();
    measureComponentCount();
    measureReRenderCount();

    // Set up performance observer
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        if (entry.entryType === 'measure') {
          console.log(`Performance: ${entry.name} took ${entry.duration}ms`);
        }
      });
    });

    observer.observe({ entryTypes: ['measure'] });

    return () => {
      observer.disconnect();
    };
  }, []);

  return metrics;
}

/**
 * Form performance optimization
 */
export function useFormPerformanceOptimization<T>(
  formData: T,
  validationFn: (data: T) => any,
  saveFn: (data: T) => void
) {
  // Debounced validation
  const isValid = useDebouncedValidation(formData, validationFn, 300);
  
  // Throttled auto-save
  useThrottledAutoSave(formData, saveFn, 2000);
  
  // Memoized validation results
  const validationResults = useMemoizedValidation(formData, validationFn);
  
  // Performance monitoring
  const performanceMetrics = usePerformanceMonitoring();

  return {
    isValid,
    validationResults,
    performanceMetrics
  };
}

/**
 * Component memoization utilities
 */
export function useComponentMemoization<T extends React.ComponentType<any>>(
  Component: T,
  props: any,
  dependencies: any[]
): T {
  return useMemo(() => {
    return React.memo(Component);
  }, dependencies) as unknown as T;
}

/**
 * Callback memoization utilities
 */
export function useCallbackMemoization<T extends (...args: any[]) => any>(
  callback: T,
  dependencies: any[]
): T {
  return useCallback(callback, dependencies);
}

/**
 * Value memoization utilities
 */
export function useValueMemoization<T>(
  value: T,
  dependencies: any[]
): T {
  return useMemo(() => value, dependencies);
}

/**
 * Performance optimization hook for forms
 */
export function useFormOptimization<T>(
  formData: T,
  options: OptimizationOptions = {}
) {
  const {
    debounceDelay = 300,
    throttleDelay = 2000,
    memoizationDepth = 3,
    enableProfiling = false
  } = options;

  // Performance metrics
  const metrics = usePerformanceMonitoring();

  // Memoized form data
  const memoizedFormData = useValueMemoization(formData, [formData]);

  // Optimized callbacks
  const optimizedCallbacks = useCallbackMemoization(() => ({
    // Add optimized callbacks here
  }), [memoizedFormData]);

  // Performance profiling
  useEffect(() => {
    if (enableProfiling) {
      console.log('Form Performance Metrics:', metrics);
    }
  }, [metrics, enableProfiling]);

  return {
    memoizedFormData,
    optimizedCallbacks,
    metrics
  };
}