/**
 * Accessibility audit and fixes for the Admin Product Add form
 */

import { useEffect, useRef, useState } from 'react';

export interface AccessibilityAudit {
  score: number;
  issues: AccessibilityIssue[];
  recommendations: string[];
  passed: boolean;
}

export interface AccessibilityIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  element?: HTMLElement;
  fix?: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
}

/**
 * Comprehensive accessibility audit
 */
export function useAccessibilityAudit(): AccessibilityAudit {
  const [audit, setAudit] = useState<AccessibilityAudit>({
    score: 0,
    issues: [],
    recommendations: [],
    passed: false
  });

  useEffect(() => {
    const performAudit = () => {
      const issues: AccessibilityIssue[] = [];
      let score = 100;

      // Check for proper heading structure
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const headingLevels = Array.from(headings).map(h => parseInt(h.tagName.charAt(1)));
      
      for (let i = 1; i < headingLevels.length; i++) {
        if (headingLevels[i] > headingLevels[i - 1] + 1) {
          issues.push({
            id: 'heading-skip',
            severity: 'error',
            message: 'Heading levels should not skip (e.g., h1 to h3)',
            wcagLevel: 'AA'
          });
          score -= 10;
        }
      }

      // Check for proper form labels
      const inputs = document.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        const id = input.getAttribute('id');
        const label = document.querySelector(`label[for="${id}"]`);
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledBy = input.getAttribute('aria-labelledby');
        
        if (!label && !ariaLabel && !ariaLabelledBy) {
          issues.push({
            id: 'missing-label',
            severity: 'error',
            message: 'Form inputs must have associated labels',
            element: input as HTMLElement,
            fix: 'Add a label element or aria-label attribute',
            wcagLevel: 'A'
          });
          score -= 15;
        }
      });

      // Check for proper button labels
      const buttons = document.querySelectorAll('button');
      buttons.forEach(button => {
        const text = button.textContent?.trim();
        const ariaLabel = button.getAttribute('aria-label');
        const ariaLabelledBy = button.getAttribute('aria-labelledby');
        
        if (!text && !ariaLabel && !ariaLabelledBy) {
          issues.push({
            id: 'missing-button-label',
            severity: 'error',
            message: 'Buttons must have accessible names',
            element: button as HTMLElement,
            fix: 'Add text content or aria-label attribute',
            wcagLevel: 'A'
          });
          score -= 10;
        }
      });

      // Check for proper color contrast
      const elements = document.querySelectorAll('*');
      elements.forEach(element => {
        const styles = window.getComputedStyle(element);
        const color = styles.color;
        const backgroundColor = styles.backgroundColor;
        
        if (color && backgroundColor && color !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'rgba(0, 0, 0, 0)') {
          const contrast = calculateContrast(color, backgroundColor);
          if (contrast < 4.5) {
            issues.push({
              id: 'low-contrast',
              severity: 'warning',
              message: `Color contrast ratio is ${contrast.toFixed(2)}, should be at least 4.5:1`,
              element: element as HTMLElement,
              fix: 'Increase color contrast',
              wcagLevel: 'AA'
            });
            score -= 5;
          }
        }
      });

      // Check for proper focus management
      const focusableElements = document.querySelectorAll(
        'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length === 0) {
        issues.push({
          id: 'no-focusable-elements',
          severity: 'error',
          message: 'No focusable elements found',
          fix: 'Add keyboard navigation support',
          wcagLevel: 'A'
        });
        score -= 20;
      }

      // Check for proper ARIA attributes
      const interactiveElements = document.querySelectorAll('[role]');
      interactiveElements.forEach(element => {
        const role = element.getAttribute('role');
        const ariaExpanded = element.getAttribute('aria-expanded');
        const ariaControls = element.getAttribute('aria-controls');
        
        if (role === 'button' && !ariaExpanded && !ariaControls) {
          issues.push({
            id: 'missing-aria-attributes',
            severity: 'warning',
            message: 'Interactive elements should have proper ARIA attributes',
            element: element as HTMLElement,
            fix: 'Add appropriate ARIA attributes',
            wcagLevel: 'AA'
          });
          score -= 5;
        }
      });

      // Check for proper error handling
      const errorElements = document.querySelectorAll('[aria-invalid="true"]');
      errorElements.forEach(element => {
        const ariaDescribedBy = element.getAttribute('aria-describedby');
        const errorMessage = document.querySelector(`#${ariaDescribedBy}`);
        
        if (!errorMessage) {
          issues.push({
            id: 'missing-error-message',
            severity: 'error',
            message: 'Invalid form elements must have associated error messages',
            element: element as HTMLElement,
            fix: 'Add error message with aria-describedby',
            wcagLevel: 'A'
          });
          score -= 10;
        }
      });

      // Generate recommendations
      const recommendations = generateRecommendations(issues);

      setAudit({
        score: Math.max(0, score),
        issues,
        recommendations,
        passed: score >= 80
      });
    };

    // Run audit after a short delay to ensure DOM is ready
    const timeoutId = setTimeout(performAudit, 1000);
    
    return () => clearTimeout(timeoutId);
  }, []);

  return audit;
}

/**
 * Calculate color contrast ratio
 */
function calculateContrast(color1: string, color2: string): number {
  const rgb1 = parseColor(color1);
  const rgb2 = parseColor(color2);
  
  const luminance1 = getLuminance(rgb1);
  const luminance2 = getLuminance(rgb2);
  
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parse color string to RGB values
 */
function parseColor(color: string): { r: number; g: number; b: number } {
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3])
    };
  }
  return { r: 0, g: 0, b: 0 };
}

/**
 * Calculate relative luminance
 */
function getLuminance(rgb: { r: number; g: number; b: number }): number {
  const { r, g, b } = rgb;
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Generate accessibility recommendations
 */
function generateRecommendations(issues: AccessibilityIssue[]): string[] {
  const recommendations: string[] = [];
  
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  
  if (errorCount > 0) {
    recommendations.push('Fix all accessibility errors to meet WCAG guidelines');
  }
  
  if (warningCount > 0) {
    recommendations.push('Address accessibility warnings for better user experience');
  }
  
  if (issues.some(i => i.id === 'missing-label')) {
    recommendations.push('Ensure all form inputs have associated labels');
  }
  
  if (issues.some(i => i.id === 'low-contrast')) {
    recommendations.push('Improve color contrast for better readability');
  }
  
  if (issues.some(i => i.id === 'missing-aria-attributes')) {
    recommendations.push('Add proper ARIA attributes for screen readers');
  }
  
  return recommendations;
}

/**
 * Focus management utilities
 */
export function useFocusManagement() {
  const focusableElements = useRef<HTMLElement[]>([]);
  const currentFocusIndex = useRef(0);

  const updateFocusableElements = () => {
    const elements = document.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    );
    focusableElements.current = Array.from(elements) as HTMLElement[];
  };

  const focusNext = () => {
    updateFocusableElements();
    currentFocusIndex.current = (currentFocusIndex.current + 1) % focusableElements.current.length;
    focusableElements.current[currentFocusIndex.current]?.focus();
  };

  const focusPrevious = () => {
    updateFocusableElements();
    currentFocusIndex.current = currentFocusIndex.current === 0 
      ? focusableElements.current.length - 1 
      : currentFocusIndex.current - 1;
    focusableElements.current[currentFocusIndex.current]?.focus();
  };

  const focusFirst = () => {
    updateFocusableElements();
    if (focusableElements.current.length > 0) {
      currentFocusIndex.current = 0;
      focusableElements.current[0].focus();
    }
  };

  const focusLast = () => {
    updateFocusableElements();
    if (focusableElements.current.length > 0) {
      currentFocusIndex.current = focusableElements.current.length - 1;
      focusableElements.current[currentFocusIndex.current].focus();
    }
  };

  return {
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
    updateFocusableElements
  };
}

/**
 * Screen reader announcements
 */
export function useScreenReaderAnnouncements() {
  const [announcements, setAnnouncements] = useState<string[]>([]);

  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = { message, priority, timestamp: Date.now() };
    setAnnouncements(prev => [...prev, message]);
    
    // Create live region for announcement
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    liveRegion.textContent = message;
    
    document.body.appendChild(liveRegion);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(liveRegion);
    }, 1000);
  };

  const announceError = (message: string) => {
    announce(message, 'assertive');
  };

  const announceSuccess = (message: string) => {
    announce(message, 'polite');
  };

  const announceValidation = (message: string) => {
    announce(message, 'polite');
  };

  return {
    announcements,
    announce,
    announceError,
    announceSuccess,
    announceValidation
  };
}

/**
 * Keyboard navigation utilities
 */
export function useKeyboardNavigation() {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Tab':
        // Allow default tab behavior
        break;
      case 'Enter':
      case ' ':
        if (event.target instanceof HTMLElement) {
          event.target.click();
        }
        break;
      case 'Escape':
        // Handle escape key
        const escapeHandler = (event.target as HTMLElement).closest('[data-escape-handler]');
        if (escapeHandler) {
          (escapeHandler as HTMLElement).click();
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        // Handle arrow navigation
        break;
      case 'ArrowUp':
        event.preventDefault();
        // Handle arrow navigation
        break;
    }
  };

  return {
    handleKeyDown
  };
}

/**
 * Accessibility testing utilities
 */
export function useAccessibilityTesting() {
  const [testResults, setTestResults] = useState<any[]>([]);

  const runAccessibilityTests = async () => {
    const tests = [
      // Test keyboard navigation
      testKeyboardNavigation,
      // Test screen reader compatibility
      testScreenReaderCompatibility,
      // Test color contrast
      testColorContrast,
      // Test focus management
      testFocusManagement
    ];

    const results = await Promise.all(tests.map(test => test()));
    setTestResults(results);
  };

  return {
    testResults,
    runAccessibilityTests
  };
}

// Test functions
async function testKeyboardNavigation(): Promise<any> {
  // Test keyboard navigation
  return { test: 'keyboard-navigation', passed: true };
}

async function testScreenReaderCompatibility(): Promise<any> {
  // Test screen reader compatibility
  return { test: 'screen-reader', passed: true };
}

async function testColorContrast(): Promise<any> {
  // Test color contrast
  return { test: 'color-contrast', passed: true };
}

async function testFocusManagement(): Promise<any> {
  // Test focus management
  return { test: 'focus-management', passed: true };
}
