import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for debounced search functionality
 * Prevents excessive API calls while user is typing
 */
export function useDebouncedSearch(
  initialValue: string = '',
  delay: number = 500
) {
  const [searchQuery, setSearchQuery] = useState(initialValue);
  const [debouncedQuery, setDebouncedQuery] = useState(initialValue);
  const [isTyping, setIsTyping] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Update the search query immediately (for UI)
   */
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setIsTyping(true);
    
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // Set new timer
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(value);
      setIsTyping(false);
      timerRef.current = null;
    }, delay);
  }, [delay]);

  /**
   * Cleanup timer on unmount
   */
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  /**
   * Clear the search query
   */
  const clearSearch = useCallback(() => {
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    setSearchQuery('');
    setDebouncedQuery('');
    setIsTyping(false);
  }, []);

  /**
   * Reset to initial value
   */
  const resetSearch = useCallback(() => {
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    setSearchQuery(initialValue);
    setDebouncedQuery(initialValue);
    setIsTyping(false);
  }, [initialValue]);

  return {
    searchQuery,        // Current input value (immediate)
    debouncedQuery,     // Debounced value (for API calls)
    isTyping,          // Whether user is currently typing
    handleSearchChange, // Function to update search query
    clearSearch,       // Function to clear search
    resetSearch        // Function to reset to initial value
  };
}
