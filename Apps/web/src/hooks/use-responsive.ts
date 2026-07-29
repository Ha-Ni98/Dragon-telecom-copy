import { useState, useEffect, useCallback } from 'react';

/**
 * Breakpoint definitions
 */
export const breakpoints = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
} as const;

/**
 * Breakpoint type
 */
export type Breakpoint = keyof typeof breakpoints;

/**
 * Responsive state interface
 */
interface ResponsiveState {
  width: number;
  height: number;
  currentBreakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeScreen: boolean;
  orientation: 'portrait' | 'landscape';
  pixelRatio: number;
  isTouch: boolean;
  isHover: boolean;
}

/**
 * Responsive options interface
 */
interface ResponsiveOptions {
  enableOrientation?: boolean;
  enablePixelRatio?: boolean;
  enableTouch?: boolean;
  enableHover?: boolean;
  debounceDelay?: number;
}

/**
 * Custom hook for responsive design
 */
export function useResponsive(options: ResponsiveOptions = {}) {
  const {
    enableOrientation = true,
    enablePixelRatio = true,
    enableTouch = true,
    enableHover = true,
    debounceDelay = 100
  } = options;

  const [state, setState] = useState<ResponsiveState>({
    width: 0,
    height: 0,
    currentBreakpoint: 'xs',
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    isLargeScreen: false,
    orientation: 'portrait',
    pixelRatio: 1,
    isTouch: false,
    isHover: false
  });

  /**
   * Get current breakpoint
   */
  const getCurrentBreakpoint = useCallback((width: number): Breakpoint => {
    if (width >= breakpoints['2xl']) return '2xl';
    if (width >= breakpoints.xl) return 'xl';
    if (width >= breakpoints.lg) return 'lg';
    if (width >= breakpoints.md) return 'md';
    if (width >= breakpoints.sm) return 'sm';
    return 'xs';
  }, []);

  /**
   * Get device type
   */
  const getDeviceType = useCallback((width: number) => {
    return {
      isMobile: width < breakpoints.md,
      isTablet: width >= breakpoints.md && width < breakpoints.lg,
      isDesktop: width >= breakpoints.lg,
      isLargeScreen: width >= breakpoints.xl
    };
  }, []);

  /**
   * Get orientation
   */
  const getOrientation = useCallback((width: number, height: number): 'portrait' | 'landscape' => {
    return width > height ? 'landscape' : 'portrait';
  }, []);

  /**
   * Get pixel ratio
   */
  const getPixelRatio = useCallback((): number => {
    if (typeof window === 'undefined') return 1;
    return window.devicePixelRatio || 1;
  }, []);

  /**
   * Detect touch capability
   */
  const detectTouch = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  /**
   * Detect hover capability
   */
  const detectHover = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(hover: hover)').matches;
  }, []);

  /**
   * Update responsive state
   */
  const updateResponsiveState = useCallback(() => {
    if (typeof window === 'undefined') return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const currentBreakpoint = getCurrentBreakpoint(width);
    const deviceType = getDeviceType(width);
    const orientation = getOrientation(width, height);
    const pixelRatio = getPixelRatio();
    const isTouch = detectTouch();
    const isHover = detectHover();

    setState({
      width,
      height,
      currentBreakpoint,
      ...deviceType,
      orientation,
      pixelRatio,
      isTouch,
      isHover
    });
  }, [getCurrentBreakpoint, getDeviceType, getOrientation, getPixelRatio, detectTouch, detectHover]);

  /**
   * Debounced update function
   */
  const debouncedUpdate = useCallback(() => {
    const timeoutId = setTimeout(updateResponsiveState, debounceDelay);
    return () => clearTimeout(timeoutId);
  }, [updateResponsiveState, debounceDelay]);

  /**
   * Handle resize event
   */
  const handleResize = useCallback(() => {
    debouncedUpdate();
  }, [debouncedUpdate]);

  /**
   * Handle orientation change
   */
  const handleOrientationChange = useCallback(() => {
    if (enableOrientation) {
      debouncedUpdate();
    }
  }, [enableOrientation, debouncedUpdate]);

  /**
   * Get responsive classes
   */
  const getResponsiveClasses = useCallback(() => {
    const classes = [];
    
    classes.push(`breakpoint-${state.currentBreakpoint}`);
    
    if (state.isMobile) {
      classes.push('mobile');
    }
    
    if (state.isTablet) {
      classes.push('tablet');
    }
    
    if (state.isDesktop) {
      classes.push('desktop');
    }
    
    if (state.isLargeScreen) {
      classes.push('large-screen');
    }
    
    if (state.orientation === 'portrait') {
      classes.push('portrait');
    } else {
      classes.push('landscape');
    }
    
    if (state.isTouch) {
      classes.push('touch');
    }
    
    if (state.isHover) {
      classes.push('hover');
    }
    
    return classes.join(' ');
  }, [state]);

  /**
   * Get responsive styles
   */
  const getResponsiveStyles = useCallback(() => {
    return {
      '--viewport-width': `${state.width}px`,
      '--viewport-height': `${state.height}px`,
      '--pixel-ratio': state.pixelRatio,
      '--breakpoint': state.currentBreakpoint
    } as React.CSSProperties;
  }, [state]);

  /**
   * Check if breakpoint matches
   */
  const matchesBreakpoint = useCallback((breakpoint: Breakpoint): boolean => {
    return state.currentBreakpoint === breakpoint;
  }, [state.currentBreakpoint]);

  /**
   * Check if breakpoint is above
   */
  const isAboveBreakpoint = useCallback((breakpoint: Breakpoint): boolean => {
    return state.width >= breakpoints[breakpoint];
  }, [state.width]);

  /**
   * Check if breakpoint is below
   */
  const isBelowBreakpoint = useCallback((breakpoint: Breakpoint): boolean => {
    return state.width < breakpoints[breakpoint];
  }, [state.width]);

  /**
   * Get responsive value
   */
  const getResponsiveValue = useCallback(<T>(values: Partial<Record<Breakpoint, T>>, defaultValue: T): T => {
    const sortedBreakpoints = Object.keys(breakpoints).reverse() as Breakpoint[];
    
    for (const breakpoint of sortedBreakpoints) {
      if (isAboveBreakpoint(breakpoint) && values[breakpoint] !== undefined) {
        return values[breakpoint] as T;
      }
    }
    
    return defaultValue;
  }, [isAboveBreakpoint]);

  /**
   * Get responsive summary
   */
  const getResponsiveSummary = useCallback(() => {
    return {
      width: state.width,
      height: state.height,
      breakpoint: state.currentBreakpoint,
      deviceType: {
        mobile: state.isMobile,
        tablet: state.isTablet,
        desktop: state.isDesktop,
        largeScreen: state.isLargeScreen
      },
      orientation: state.orientation,
      capabilities: {
        touch: state.isTouch,
        hover: state.isHover
      },
      pixelRatio: state.pixelRatio
    };
  }, [state]);

  // Initialize responsive state
  useEffect(() => {
    updateResponsiveState();
  }, [updateResponsiveState]);

  // Listen for resize events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.addEventListener('resize', handleResize);
    
    if (enableOrientation) {
      window.addEventListener('orientationchange', handleOrientationChange);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (enableOrientation) {
        window.removeEventListener('orientationchange', handleOrientationChange);
      }
    };
  }, [handleResize, handleOrientationChange, enableOrientation]);

  return {
    // State
    ...state,
    
    // Utilities
    getResponsiveClasses,
    getResponsiveStyles,
    matchesBreakpoint,
    isAboveBreakpoint,
    isBelowBreakpoint,
    getResponsiveValue,
    getResponsiveSummary
  };
}
