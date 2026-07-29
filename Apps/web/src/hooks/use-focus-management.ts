import { useEffect, useCallback, useRef, useState } from 'react';

export interface FocusManagementOptions {
  trapFocus?: boolean;
  restoreFocus?: boolean;
  initialFocus?: string;
  focusOnMount?: boolean;
  focusOnUnmount?: boolean;
}

export interface FocusState {
  isTrapped: boolean;
  currentFocus: HTMLElement | null;
  previousFocus: HTMLElement | null;
  focusHistory: HTMLElement[];
}

/**
 * Hook for managing focus in forms and components
 */
export function useFocusManagement(options: FocusManagementOptions = {}) {
  const {
    trapFocus = false,
    restoreFocus = true,
    initialFocus,
    focusOnMount = false,
    focusOnUnmount = false
  } = options;

  const [focusState, setFocusState] = useState<FocusState>({
    isTrapped: false,
    currentFocus: null,
    previousFocus: null,
    focusHistory: []
  });

  const containerRef = useRef<HTMLElement | null>(null);
  const focusableElementsRef = useRef<HTMLElement[]>([]);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Get focusable elements within container
  const getFocusableElements = useCallback((container: HTMLElement): HTMLElement[] => {
    const selector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
  }, []);

  // Update focusable elements
  const updateFocusableElements = useCallback(() => {
    if (containerRef.current) {
      focusableElementsRef.current = getFocusableElements(containerRef.current);
    }
  }, [getFocusableElements]);

  // Focus first element
  const focusFirst = useCallback(() => {
    updateFocusableElements();
    if (focusableElementsRef.current.length > 0) {
      const firstElement = focusableElementsRef.current[0];
      firstElement.focus();
      setFocusState(prev => ({
        ...prev,
        currentFocus: firstElement,
        previousFocus: prev.currentFocus
      }));
    }
  }, [updateFocusableElements]);

  // Focus last element
  const focusLast = useCallback(() => {
    updateFocusableElements();
    if (focusableElementsRef.current.length > 0) {
      const lastElement = focusableElementsRef.current[focusableElementsRef.current.length - 1];
      lastElement.focus();
      setFocusState(prev => ({
        ...prev,
        currentFocus: lastElement,
        previousFocus: prev.currentFocus
      }));
    }
  }, [updateFocusableElements]);

  // Focus next element
  const focusNext = useCallback(() => {
    updateFocusableElements();
    const currentIndex = focusableElementsRef.current.indexOf(document.activeElement as HTMLElement);
    const nextIndex = (currentIndex + 1) % focusableElementsRef.current.length;
    const nextElement = focusableElementsRef.current[nextIndex];
    
    if (nextElement) {
      nextElement.focus();
      setFocusState(prev => ({
        ...prev,
        currentFocus: nextElement,
        previousFocus: prev.currentFocus
      }));
    }
  }, [updateFocusableElements]);

  // Focus previous element
  const focusPrevious = useCallback(() => {
    updateFocusableElements();
    const currentIndex = focusableElementsRef.current.indexOf(document.activeElement as HTMLElement);
    const prevIndex = currentIndex === 0 
      ? focusableElementsRef.current.length - 1 
      : currentIndex - 1;
    const prevElement = focusableElementsRef.current[prevIndex];
    
    if (prevElement) {
      prevElement.focus();
      setFocusState(prev => ({
        ...prev,
        currentFocus: prevElement,
        previousFocus: prev.currentFocus
      }));
    }
  }, [updateFocusableElements]);

  // Focus specific element
  const focusElement = useCallback((element: HTMLElement) => {
    element.focus();
    setFocusState(prev => ({
      ...prev,
      currentFocus: element,
      previousFocus: prev.currentFocus
    }));
  }, []);

  // Focus element by ID
  const focusElementById = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      focusElement(element);
    }
  }, [focusElement]);

  // Focus element by selector
  const focusElementBySelector = useCallback((selector: string) => {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      focusElement(element);
    }
  }, [focusElement]);

  // Trap focus within container
  const handleTrapFocus = useCallback((event: KeyboardEvent) => {
    if (!trapFocus || !containerRef.current) return;

    const { key, shiftKey } = event;
    
    if (key === 'Tab') {
      event.preventDefault();
      
      if (shiftKey) {
        focusPrevious();
      } else {
        focusNext();
      }
    }
  }, [trapFocus, focusNext, focusPrevious]);

  // Handle focus changes
  const handleFocusChange = useCallback((event: FocusEvent) => {
    const target = event.target as HTMLElement;
    
    if (containerRef.current && containerRef.current.contains(target)) {
      setFocusState(prev => ({
        ...prev,
        currentFocus: target,
        previousFocus: prev.currentFocus,
        focusHistory: [...prev.focusHistory, target].slice(-10) // Keep last 10 focus changes
      }));
    }
  }, []);

  // Restore previous focus
  const restorePreviousFocus = useCallback(() => {
    if (restoreFocus && previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [restoreFocus]);

  // Set up focus management
  useEffect(() => {
    if (containerRef.current) {
      updateFocusableElements();
      
      // Store previous focus
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      // Set up event listeners
      document.addEventListener('keydown', handleTrapFocus);
      document.addEventListener('focusin', handleFocusChange);
      
      // Focus initial element
      if (focusOnMount) {
        if (initialFocus) {
          focusElementById(initialFocus);
        } else {
          focusFirst();
        }
      }
    }

    return () => {
      document.removeEventListener('keydown', handleTrapFocus);
      document.removeEventListener('focusin', handleFocusChange);
      
      if (focusOnUnmount) {
        restorePreviousFocus();
      }
    };
  }, [trapFocus, handleFocusChange, focusOnMount, focusOnUnmount, initialFocus, focusElementById, focusFirst, restorePreviousFocus, updateFocusableElements]);

  // Update focusable elements when container changes
  useEffect(() => {
    updateFocusableElements();
  }, [updateFocusableElements]);

  return {
    containerRef,
    focusState,
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
    focusElement,
    focusElementById,
    focusElementBySelector,
    restorePreviousFocus,
    updateFocusableElements
  };
}

/**
 * Hook for managing focus in forms
 */
export function useFormFocusManagement() {
  const focusManagement = useFocusManagement({
    trapFocus: false,
    restoreFocus: true,
    focusOnMount: false,
    focusOnUnmount: false
  });

  // Focus next form field
  const focusNextField = useCallback(() => {
    focusManagement.focusNext();
  }, [focusManagement]);

  // Focus previous form field
  const focusPreviousField = useCallback(() => {
    focusManagement.focusPrevious();
  }, [focusManagement]);

  // Focus specific form field
  const focusFormField = useCallback((fieldName: string) => {
    focusManagement.focusElementById(fieldName);
  }, [focusManagement]);

  // Focus first form field
  const focusFirstField = useCallback(() => {
    focusManagement.focusFirst();
  }, [focusManagement]);

  // Focus last form field
  const focusLastField = useCallback(() => {
    focusManagement.focusLast();
  }, [focusManagement]);

  // Focus form field by index
  const focusFieldByIndex = useCallback((index: number) => {
    const elements = focusManagement.focusState.currentFocus?.parentElement?.querySelectorAll('input, select, textarea, button') as NodeListOf<HTMLElement>;
    if (elements && elements[index]) {
      focusManagement.focusElement(elements[index]);
    }
  }, [focusManagement]);

  return {
    ...focusManagement,
    focusNextField,
    focusPreviousField,
    focusFormField,
    focusFirstField,
    focusLastField,
    focusFieldByIndex
  };
}

/**
 * Hook for managing focus in modal dialogs
 */
export function useModalFocusManagement() {
  const focusManagement = useFocusManagement({
    trapFocus: true,
    restoreFocus: true,
    focusOnMount: true,
    focusOnUnmount: true
  });

  return focusManagement;
}

/**
 * Hook for managing focus in dropdown menus
 */
export function useDropdownFocusManagement() {
  const focusManagement = useFocusManagement({
    trapFocus: true,
    restoreFocus: true,
    focusOnMount: true,
    focusOnUnmount: true
  });

  // Focus dropdown item
  const focusDropdownItem = useCallback((index: number) => {
    const items = focusManagement.focusState.currentFocus?.parentElement?.querySelectorAll('[role="menuitem"]') as NodeListOf<HTMLElement>;
    if (items && items[index]) {
      focusManagement.focusElement(items[index]);
    }
  }, [focusManagement]);

  // Focus next dropdown item
  const focusNextDropdownItem = useCallback(() => {
    focusManagement.focusNext();
  }, [focusManagement]);

  // Focus previous dropdown item
  const focusPreviousDropdownItem = useCallback(() => {
    focusManagement.focusPrevious();
  }, [focusManagement]);

  return {
    ...focusManagement,
    focusDropdownItem,
    focusNextDropdownItem,
    focusPreviousDropdownItem
  };
}

/**
 * Hook for managing focus in image galleries
 */
export function useImageGalleryFocusManagement() {
  const focusManagement = useFocusManagement({
    trapFocus: false,
    restoreFocus: true,
    focusOnMount: false,
    focusOnUnmount: false
  });

  // Focus image by index
  const focusImage = useCallback((index: number) => {
    const images = focusManagement.focusState.currentFocus?.parentElement?.querySelectorAll('[role="img"]') as NodeListOf<HTMLElement>;
    if (images && images[index]) {
      focusManagement.focusElement(images[index]);
    }
  }, [focusManagement]);

  // Focus next image
  const focusNextImage = useCallback(() => {
    focusManagement.focusNext();
  }, [focusManagement]);

  // Focus previous image
  const focusPreviousImage = useCallback(() => {
    focusManagement.focusPrevious();
  }, [focusManagement]);

  return {
    ...focusManagement,
    focusImage,
    focusNextImage,
    focusPreviousImage
  };
}
