import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardNavigationOptions {
  onEnter?: () => void;
  onEscape?: () => void;
  onTab?: (direction: 'forward' | 'backward') => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onSpace?: () => void;
  onDelete?: () => void;
  onBackspace?: () => void;
  onHome?: () => void;
  onEnd?: () => void;
  onPageUp?: () => void;
  onPageDown?: () => void;
  enabled?: boolean;
}

/**
 * Hook for managing keyboard navigation in forms
 */
export function useKeyboardNavigation(options: KeyboardNavigationOptions = {}) {
  const {
    onEnter,
    onEscape,
    onTab,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onSpace,
    onDelete,
    onBackspace,
    onHome,
    onEnd,
    onPageUp,
    onPageDown,
    enabled = true
  } = options;

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!enabled) return;

    const { key, ctrlKey, altKey, shiftKey, metaKey } = event;

    // Prevent default behavior for handled keys
    const preventDefault = () => event.preventDefault();

    switch (key) {
      case 'Enter':
        if (onEnter) {
          preventDefault();
          onEnter();
        }
        break;

      case 'Escape':
        if (onEscape) {
          preventDefault();
          onEscape();
        }
        break;

      case 'Tab':
        if (onTab) {
          preventDefault();
          onTab(shiftKey ? 'backward' : 'forward');
        }
        break;

      case 'ArrowUp':
        if (onArrowUp) {
          preventDefault();
          onArrowUp();
        }
        break;

      case 'ArrowDown':
        if (onArrowDown) {
          preventDefault();
          onArrowDown();
        }
        break;

      case 'ArrowLeft':
        if (onArrowLeft) {
          preventDefault();
          onArrowLeft();
        }
        break;

      case 'ArrowRight':
        if (onArrowRight) {
          preventDefault();
          onArrowRight();
        }
        break;

      case ' ':
        if (onSpace) {
          preventDefault();
          onSpace();
        }
        break;

      case 'Delete':
        if (onDelete) {
          preventDefault();
          onDelete();
        }
        break;

      case 'Backspace':
        if (onBackspace) {
          preventDefault();
          onBackspace();
        }
        break;

      case 'Home':
        if (onHome) {
          preventDefault();
          onHome();
        }
        break;

      case 'End':
        if (onEnd) {
          preventDefault();
          onEnd();
        }
        break;

      case 'PageUp':
        if (onPageUp) {
          preventDefault();
          onPageUp();
        }
        break;

      case 'PageDown':
        if (onPageDown) {
          preventDefault();
          onPageDown();
        }
        break;
    }
  }, [
    enabled,
    onEnter,
    onEscape,
    onTab,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onSpace,
    onDelete,
    onBackspace,
    onHome,
    onEnd,
    onPageUp,
    onPageDown
  ]);

  return {
    handleKeyDown,
    enabled
  };
}

/**
 * Hook for managing focus in forms
 */
export function useFocusManagement() {
  const focusableElements = useRef<HTMLElement[]>([]);
  const currentFocusIndex = useRef(0);

  const updateFocusableElements = useCallback(() => {
    const elements = document.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    );
    focusableElements.current = Array.from(elements) as HTMLElement[];
  }, []);

  const focusNext = useCallback(() => {
    updateFocusableElements();
    if (focusableElements.current.length === 0) return;

    currentFocusIndex.current = (currentFocusIndex.current + 1) % focusableElements.current.length;
    focusableElements.current[currentFocusIndex.current]?.focus();
  }, [updateFocusableElements]);

  const focusPrevious = useCallback(() => {
    updateFocusableElements();
    if (focusableElements.current.length === 0) return;

    currentFocusIndex.current = currentFocusIndex.current === 0 
      ? focusableElements.current.length - 1 
      : currentFocusIndex.current - 1;
    focusableElements.current[currentFocusIndex.current]?.focus();
  }, [updateFocusableElements]);

  const focusFirst = useCallback(() => {
    updateFocusableElements();
    if (focusableElements.current.length > 0) {
      currentFocusIndex.current = 0;
      focusableElements.current[0].focus();
    }
  }, [updateFocusableElements]);

  const focusLast = useCallback(() => {
    updateFocusableElements();
    if (focusableElements.current.length > 0) {
      currentFocusIndex.current = focusableElements.current.length - 1;
      focusableElements.current[currentFocusIndex.current].focus();
    }
  }, [updateFocusableElements]);

  const focusElement = useCallback((element: HTMLElement) => {
    element.focus();
    const index = focusableElements.current.indexOf(element);
    if (index !== -1) {
      currentFocusIndex.current = index;
    }
  }, []);

  const focusElementById = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      focusElement(element);
    }
  }, [focusElement]);

  const focusElementBySelector = useCallback((selector: string) => {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      focusElement(element);
    }
  }, [focusElement]);

  return {
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
    focusElement,
    focusElementById,
    focusElementBySelector,
    updateFocusableElements,
    getCurrentFocusIndex: () => currentFocusIndex.current,
    getFocusableElements: () => focusableElements.current
  };
}

/**
 * Hook for managing keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const { key, ctrlKey, altKey, shiftKey, metaKey } = event;
    
    // Create shortcut key
    const shortcutKey = [
      ctrlKey && 'ctrl',
      altKey && 'alt',
      shiftKey && 'shift',
      metaKey && 'meta',
      key.toLowerCase()
    ].filter(Boolean).join('+');

    // Check if shortcut exists
    if (shortcuts[shortcutKey]) {
      event.preventDefault();
      shortcuts[shortcutKey]();
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Hook for managing form keyboard navigation
 */
export function useFormKeyboardNavigation() {
  const focusManagement = useFocusManagement();

  const keyboardNavigation = useKeyboardNavigation({
    onTab: (direction) => {
      if (direction === 'forward') {
        focusManagement.focusNext();
      } else {
        focusManagement.focusPrevious();
      }
    },
    onEnter: () => {
      // Handle form submission or field completion
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLButtonElement && activeElement.type === 'submit') {
        activeElement.click();
      } else if (activeElement instanceof HTMLInputElement) {
        // Move to next field
        focusManagement.focusNext();
      }
    },
    onEscape: () => {
      // Handle form reset or cancel
      const resetButton = document.querySelector('[data-reset-form]') as HTMLButtonElement;
      if (resetButton) {
        resetButton.click();
      }
    },
    onArrowUp: () => {
      // Navigate to previous field in form
      focusManagement.focusPrevious();
    },
    onArrowDown: () => {
      // Navigate to next field in form
      focusManagement.focusNext();
    }
  });

  return {
    ...keyboardNavigation,
    ...focusManagement
  };
}

/**
 * Hook for managing keyboard navigation in autocomplete components
 */
export function useAutocompleteKeyboardNavigation(
  suggestions: any[],
  selectedIndex: number,
  onSelect: (index: number) => void,
  onClose: () => void
) {
  const keyboardNavigation = useKeyboardNavigation({
    onArrowDown: () => {
      if (suggestions.length > 0) {
        const nextIndex = (selectedIndex + 1) % suggestions.length;
        onSelect(nextIndex);
      }
    },
    onArrowUp: () => {
      if (suggestions.length > 0) {
        const prevIndex = selectedIndex === 0 ? suggestions.length - 1 : selectedIndex - 1;
        onSelect(prevIndex);
      }
    },
    onEnter: () => {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        onSelect(selectedIndex);
      }
    },
    onEscape: () => {
      onClose();
    }
  });

  return keyboardNavigation;
}

/**
 * Hook for managing keyboard navigation in image management
 */
export function useImageKeyboardNavigation(
  images: any[],
  selectedIndex: number,
  onSelect: (index: number) => void,
  onDelete: (index: number) => void,
  onMove: (fromIndex: number, toIndex: number) => void
) {
  const keyboardNavigation = useKeyboardNavigation({
    onArrowLeft: () => {
      if (images.length > 0) {
        const prevIndex = selectedIndex === 0 ? images.length - 1 : selectedIndex - 1;
        onSelect(prevIndex);
      }
    },
    onArrowRight: () => {
      if (images.length > 0) {
        const nextIndex = (selectedIndex + 1) % images.length;
        onSelect(nextIndex);
      }
    },
    onDelete: () => {
      if (selectedIndex >= 0 && selectedIndex < images.length) {
        onDelete(selectedIndex);
      }
    },
    onArrowUp: () => {
      if (selectedIndex > 0) {
        onMove(selectedIndex, selectedIndex - 1);
      }
    },
    onArrowDown: () => {
      if (selectedIndex < images.length - 1) {
        onMove(selectedIndex, selectedIndex + 1);
      }
    }
  });

  return keyboardNavigation;
}
