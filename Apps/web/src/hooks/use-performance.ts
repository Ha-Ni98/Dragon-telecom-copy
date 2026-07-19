import * as React from 'react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

/**
 * Performance metrics interface
 */
interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  networkRequests: number;
  cacheHitRate: number;
  bundleSize: number;
  imageOptimization: number;
}

/**
 * Performance optimization options interface
 */
interface PerformanceOptions {
  enableVirtualization?: boolean;
  enableLazyLoading?: boolean;
  enableImageOptimization?: boolean;
  enableCodeSplitting?: boolean;
  enableMemoization?: boolean;
  enableDebouncing?: boolean;
  debounceDelay?: number;
}

/**
 * Performance state interface
 */
interface PerformanceState {
  metrics: PerformanceMetrics;
  isOptimized: boolean;
  optimizationLevel: 'low' | 'medium' | 'high';
  warnings: string[];
  recommendations: string[];
}

/**
 * Custom hook for performance optimization
 */
export function usePerformance(options: PerformanceOptions = {}) {
  const {
    enableVirtualization = true,
    enableLazyLoading = true,
    enableImageOptimization = true,
    enableCodeSplitting = true,
    enableMemoization = true,
    enableDebouncing = true,
    debounceDelay = 300
  } = options;

  const [state, setState] = useState<PerformanceState>({
    metrics: {
      renderTime: 0,
      memoryUsage: 0,
      networkRequests: 0,
      cacheHitRate: 0,
      bundleSize: 0,
      imageOptimization: 0
    },
    isOptimized: false,
    optimizationLevel: 'medium',
    warnings: [],
    recommendations: []
  });

  const renderStartTime = useRef<number>(0);
  const performanceObserver = useRef<PerformanceObserver | null>(null);

  /**
   * Measure render time
   */
  const measureRenderTime = useCallback(() => {
    renderStartTime.current = performance.now();
  }, []);

  /**
   * End render time measurement
   */
  const endRenderTimeMeasurement = useCallback(() => {
    const renderTime = performance.now() - renderStartTime.current;
    
    setState(prev => ({
      ...prev,
      metrics: {
        ...prev.metrics,
        renderTime
      }
    }));
  }, []);

  /**
   * Measure memory usage
   */
  const measureMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const memoryUsage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      
      setState(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          memoryUsage
        }
      }));
    }
  }, []);

  /**
   * Monitor network requests
   */
  const monitorNetworkRequests = useCallback(() => {
    if (performanceObserver.current) {
      performanceObserver.current.disconnect();
    }

    performanceObserver.current = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const networkRequests = entries.filter(entry => 
        entry.entryType === 'navigation' || entry.entryType === 'resource'
      ).length;

      setState(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          networkRequests
        }
      }));
    });

    performanceObserver.current.observe({ entryTypes: ['navigation', 'resource'] });
  }, []);

  /**
   * Calculate cache hit rate
   */
  const calculateCacheHitRate = useCallback(() => {
    // Mock cache hit rate calculation
    const cacheHitRate = Math.random() * 100;
    
    setState(prev => ({
      ...prev,
      metrics: {
        ...prev.metrics,
        cacheHitRate
      }
    }));
  }, []);

  /**
   * Optimize images
   */
  const optimizeImages = useCallback(() => {
    const images = document.querySelectorAll('img');
    let optimizedCount = 0;

    images.forEach(img => {
      // Check if image has proper attributes
      if (!img.loading || img.loading !== 'lazy') {
        img.loading = 'lazy';
        optimizedCount++;
      }

      // Check if image has proper sizing
      if (!img.sizes && !img.width && !img.height) {
        img.sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';
        optimizedCount++;
      }
    });

    setState(prev => ({
      ...prev,
      metrics: {
        ...prev.metrics,
        imageOptimization: optimizedCount
      }
    }));
  }, []);

  /**
   * Debounce function
   */
  const debounce = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    delay: number = debounceDelay
  ): T => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    return ((...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    }) as T;
  }, [debounceDelay]);

  /**
   * Throttle function
   */
  const throttle = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    delay: number = 100
  ): T => {
    let lastCall = 0;
    
    return ((...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return func(...args);
      }
    }) as T;
  }, []);

  /**
   * Memoize function
   */
  const memoize = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    deps: any[] = []
  ): T => {
    const cache = new Map();
    
    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args);
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const result = func(...args);
      cache.set(key, result);
      return result;
    }) as T;
  }, []);

  /**
   * Lazy load component
   */
  const lazyLoad = useCallback((importFunc: () => Promise<any>) => {
    return React.lazy(importFunc);
  }, []);

  /**
   * Virtualize list
   */
  const virtualizeList = useCallback((
    items: any[],
    itemHeight: number,
    containerHeight: number,
    scrollTop: number
  ) => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );

    return {
      startIndex,
      endIndex,
      visibleItems: items.slice(startIndex, endIndex),
      totalHeight: items.length * itemHeight,
      offsetY: startIndex * itemHeight
    };
  }, []);

  /**
   * Check performance warnings
   */
  const checkPerformanceWarnings = useCallback(() => {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check render time
    if (state.metrics.renderTime > 16) {
      warnings.push('Render time exceeds 16ms (60fps threshold)');
      recommendations.push('Consider using React.memo or useMemo for expensive calculations');
    }

    // Check memory usage
    if (state.metrics.memoryUsage > 0.8) {
      warnings.push('High memory usage detected');
      recommendations.push('Consider implementing memory cleanup and garbage collection');
    }

    // Check network requests
    if (state.metrics.networkRequests > 50) {
      warnings.push('High number of network requests');
      recommendations.push('Consider implementing request batching and caching');
    }

    // Check cache hit rate
    if (state.metrics.cacheHitRate < 50) {
      warnings.push('Low cache hit rate');
      recommendations.push('Consider implementing better caching strategies');
    }

    setState(prev => ({
      ...prev,
      warnings,
      recommendations
    }));
  }, [state.metrics]);

  /**
   * Get optimization level
   */
  const getOptimizationLevel = useCallback(() => {
    const { renderTime, memoryUsage, networkRequests, cacheHitRate } = state.metrics;
    
    let score = 0;
    
    if (renderTime < 16) score += 25;
    if (memoryUsage < 0.5) score += 25;
    if (networkRequests < 20) score += 25;
    if (cacheHitRate > 80) score += 25;
    
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }, [state.metrics]);

  /**
   * Get performance summary
   */
  const getPerformanceSummary = useCallback(() => {
    return {
      ...state.metrics,
      optimizationLevel: getOptimizationLevel(),
      isOptimized: getOptimizationLevel() === 'high',
      warnings: state.warnings.length,
      recommendations: state.recommendations.length
    };
  }, [state, getOptimizationLevel]);

  // Initialize performance monitoring
  useEffect(() => {
    measureRenderTime();
    measureMemoryUsage();
    monitorNetworkRequests();
    calculateCacheHitRate();

    if (enableImageOptimization) {
      optimizeImages();
    }

    return () => {
      if (performanceObserver.current) {
        performanceObserver.current.disconnect();
      }
    };
  }, [measureRenderTime, measureMemoryUsage, monitorNetworkRequests, calculateCacheHitRate, optimizeImages, enableImageOptimization]);

  // End render time measurement
  useEffect(() => {
    endRenderTimeMeasurement();
  }, [endRenderTimeMeasurement]);

  // Check performance warnings
  useEffect(() => {
    checkPerformanceWarnings();
  }, [checkPerformanceWarnings]);

  return {
    // State
    ...state,
    
    // Actions
    measureRenderTime,
    endRenderTimeMeasurement,
    measureMemoryUsage,
    optimizeImages,
    
    // Utilities
    debounce,
    throttle,
    memoize,
    lazyLoad,
    virtualizeList,
    getPerformanceSummary
  };
}
