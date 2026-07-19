import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Accessibility features interface
 */
interface AccessibilityFeatures {
  isScreenReaderActive: boolean;
  isHighContrast: boolean;
  isReducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large';
  focusVisible: boolean;
  announceMessages: string[];
}

/**
 * Accessibility state interface
 */
interface AccessibilityState {
  features: AccessibilityFeatures;
  isKeyboardNavigation: boolean;
  currentFocus: string | null;
  focusHistory: string[];
  skipLinks: string[];
}

/**
 * Custom hook for accessibility management
 */
export function useAccessibility() {
  const [state, setState] = useState<AccessibilityState>({
    features: {
      isScreenReaderActive: false,
      isHighContrast: false,
      isReducedMotion: false,
      fontSize: 'medium',
      focusVisible: false,
      announceMessages: []
    },
    isKeyboardNavigation: false,
    currentFocus: null,
    focusHistory: [],
    skipLinks: []
  });

  const announceRef = useRef<HTMLDivElement | null>(null);

  /**
   * Detect screen reader
   */
  const detectScreenReader = useCallback(() => {
    // Check for common screen reader indicators
    const hasScreenReader = 
      window.navigator.userAgent.includes('NVDA') ||
      window.navigator.userAgent.includes('JAWS') ||
      window.navigator.userAgent.includes('VoiceOver') ||
      window.navigator.userAgent.includes('TalkBack') ||
      // Check for screen reader specific properties
      (window as any).speechSynthesis ||
      (window as any).speechRecognition ||
      // Check for accessibility features
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setState(prev => ({
      ...prev,
      features: {
        ...prev.features,
        isScreenReaderActive: hasScreenReader
      }
    }));
  }, []);

  /**
   * Detect high contrast mode
   */
  const detectHighContrast = useCallback(() => {
    const isHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
    
    setState(prev => ({
      ...prev,
      features: {
        ...prev.features,
        isHighContrast
      }
    }));
  }, []);

  /**
   * Detect reduced motion preference
   */
  const detectReducedMotion = useCallback(() => {
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    setState(prev => ({
      ...prev,
      features: {
        ...prev.features,
        isReducedMotion
      }
    }));
  }, []);

  /**
   * Detect font size preference
   */
  const detectFontSize = useCallback(() => {
    const fontSize = window.matchMedia('(prefers-reduced-data: reduce)').matches ? 'small' :
                     window.matchMedia('(min-resolution: 2dppx)').matches ? 'large' : 'medium';
    
    setState(prev => ({
      ...prev,
      features: {
        ...prev.features,
        fontSize
      }
    }));
  }, []);

  /**
   * Handle keyboard navigation
   */
  const handleKeyboardNavigation = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      setState(prev => ({
        ...prev,
        isKeyboardNavigation: true
      }));
    }
  }, []);

  /**
   * Handle mouse interaction
   */
  const handleMouseInteraction = useCallback(() => {
    setState(prev => ({
      ...prev,
      isKeyboardNavigation: false
    }));
  }, []);

  /**
   * Focus management
   */
  const focusElement = useCallback((elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.focus();
      setState(prev => ({
        ...prev,
        currentFocus: elementId,
        focusHistory: [...prev.focusHistory, elementId].slice(-10) // Keep last 10
      }));
    }
  }, []);

  /**
   * Add skip link
   */
  const addSkipLink = useCallback((label: string, targetId: string) => {
    setState(prev => ({
      ...prev,
      skipLinks: [...prev.skipLinks, `${label}:${targetId}`]
    }));
  }, []);

  /**
   * Announce message to screen readers
   */
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announceRef.current) {
      // Create announcement element
      const announceElement = document.createElement('div');
      announceElement.setAttribute('aria-live', priority);
      announceElement.setAttribute('aria-atomic', 'true');
      announceElement.style.position = 'absolute';
      announceElement.style.left = '-10000px';
      announceElement.style.width = '1px';
      announceElement.style.height = '1px';
      announceElement.style.overflow = 'hidden';
      document.body.appendChild(announceElement);
      announceRef.current = announceElement;
    }

    announceRef.current.textContent = message;
    
    setState(prev => ({
      ...prev,
      features: {
        ...prev.features,
        announceMessages: [...prev.features.announceMessages, message].slice(-5) // Keep last 5
      }
    }));
  }, []);

  /**
   * Get accessibility classes
   */
  const getAccessibilityClasses = useCallback(() => {
    const classes = [];
    
    if (state.features.isHighContrast) {
      classes.push('high-contrast');
    }
    
    if (state.features.isReducedMotion) {
      classes.push('reduced-motion');
    }
    
    if (state.features.fontSize === 'large') {
      classes.push('large-text');
    }
    
    if (state.isKeyboardNavigation) {
      classes.push('keyboard-navigation');
    }
    
    return classes.join(' ');
  }, [state]);

  /**
   * Get focus styles
   */
  const getFocusStyles = useCallback(() => {
    return {
      outline: state.isKeyboardNavigation ? '2px solid #0066cc' : 'none',
      outlineOffset: '2px',
      borderRadius: '2px'
    };
  }, [state.isKeyboardNavigation]);

  /**
   * Check if element is accessible
   */
  const isAccessible = useCallback((element: HTMLElement) => {
    const hasLabel = element.getAttribute('aria-label') || element.getAttribute('aria-labelledby');
    const hasRole = element.getAttribute('role');
    const isVisible = element.offsetParent !== null;
    const hasFocusable = element.tabIndex >= 0;
    
    return hasLabel && (hasRole || hasFocusable) && isVisible;
  }, []);

  /**
   * Get accessibility summary
   */
  const getAccessibilitySummary = useCallback(() => {
    return {
      screenReader: state.features.isScreenReaderActive,
      highContrast: state.features.isHighContrast,
      reducedMotion: state.features.isReducedMotion,
      fontSize: state.features.fontSize,
      keyboardNavigation: state.isKeyboardNavigation,
      currentFocus: state.currentFocus,
      skipLinks: state.skipLinks.length,
      announcements: state.features.announceMessages.length
    };
  }, [state]);

  // Initialize accessibility detection
  useEffect(() => {
    detectScreenReader();
    detectHighContrast();
    detectReducedMotion();
    detectFontSize();

    // Listen for media query changes
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    highContrastQuery.addEventListener('change', detectHighContrast);
    reducedMotionQuery.addEventListener('change', detectReducedMotion);

    return () => {
      highContrastQuery.removeEventListener('change', detectHighContrast);
      reducedMotionQuery.removeEventListener('change', detectReducedMotion);
    };
  }, [detectScreenReader, detectHighContrast, detectReducedMotion, detectFontSize]);

  // Handle keyboard and mouse events
  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardNavigation);
    document.addEventListener('mousedown', handleMouseInteraction);
    document.addEventListener('touchstart', handleMouseInteraction);

    return () => {
      document.removeEventListener('keydown', handleKeyboardNavigation);
      document.removeEventListener('mousedown', handleMouseInteraction);
      document.removeEventListener('touchstart', handleMouseInteraction);
    };
  }, [handleKeyboardNavigation, handleMouseInteraction]);

  // Cleanup announcement element
  useEffect(() => {
    return () => {
      if (announceRef.current) {
        document.body.removeChild(announceRef.current);
      }
    };
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    focusElement,
    addSkipLink,
    announce,
    
    // Utilities
    getAccessibilityClasses,
    getFocusStyles,
    isAccessible,
    getAccessibilitySummary
  };
}
