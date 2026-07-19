/**
 * Admin Search Input Component
 * Isolated search input that doesn't cause parent re-renders
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/useTranslation';

interface AdminSearchInputProps {
  /** Current search query */
  value: string;
  /** Callback when debounced search query changes */
  onDebouncedChange: (query: string) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Custom className */
  className?: string;
  /** Debounce delay in milliseconds */
  delay?: number;
}

/**
 * Admin Search Input Component
 * Provides a search input with debouncing that doesn't cause parent re-renders
 */
export const AdminSearchInput: React.FC<AdminSearchInputProps> = ({
  value,
  onDebouncedChange,
  disabled = false,
  className = '',
  delay = 500
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Handle input change
   */
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Set new timer for debounced update
    timerRef.current = setTimeout(() => {
      console.log('AdminSearchInput: Calling onDebouncedChange with:', newValue);
      onDebouncedChange(newValue);
      timerRef.current = null;
    }, delay);
  }, [onDebouncedChange, delay]);

  /**
   * Update local value when prop value changes
   */
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

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

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
      <Input
        ref={inputRef}
        placeholder={t('admin.products.searchPlaceholder')}
        value={localValue}
        onChange={handleChange}
        className={`pl-10 ${className}`}
        disabled={disabled}
        aria-label="Search products"
        autoComplete="off"
      />
    </div>
  );
};
