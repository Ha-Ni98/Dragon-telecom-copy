import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useTranslation';
import { 
  ChevronDown, 
  Plus, 
  Check, 
  X, 
  Search,
  Loader2
} from 'lucide-react';

export interface AutocompleteOption {
  value: string;
  label: string;
  id?: string | number;
  description?: string;
  isNew?: boolean;
  disabled?: boolean;
}

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: AutocompleteOption[];
  placeholder?: string;
  label?: string;
  description?: string;
  onCreateNew?: (value: string) => void;
  onSearch?: (query: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
  maxSuggestions?: number;
  showCreateNew?: boolean;
  createNewLabel?: string;
  emptyMessage?: string;
}

/**
 * Reusable autocomplete input component with search, filter, and create new functionality
 */
export function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  label,
  description,
  onCreateNew,
  onSearch,
  isLoading = false,
  disabled = false,
  required = false,
  error,
  className = "",
  maxSuggestions = 10,
  showCreateNew = true,
  createNewLabel,
  emptyMessage
}: AutocompleteInputProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on search query
  const filteredSuggestions = suggestions
    .filter(suggestion => 
      suggestion.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      suggestion.value.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice(0, maxSuggestions);

  // Check if we should show "create new" option
  const shouldShowCreateNew = showCreateNew && 
    searchQuery.trim().length > 0 && 
    !suggestions.some(s => s.value.toLowerCase() === searchQuery.toLowerCase());

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    onChange(newValue);
    
    if (onSearch) {
      onSearch(newValue);
    }
    
    if (!isOpen) {
      setIsOpen(true);
    }
  }, [onChange, onSearch, isOpen]);

  // Handle option selection
  const handleOptionSelect = useCallback((option: AutocompleteOption) => {
    if (option.isNew && onCreateNew) {
      onCreateNew(option.value);
    } else {
      onChange(option.value);
    }
    setSearchQuery(option.value);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  }, [onChange, onCreateNew]);

  // Handle create new
  const handleCreateNew = useCallback(() => {
    if (onCreateNew && searchQuery.trim()) {
      onCreateNew(searchQuery.trim());
      setSearchQuery(searchQuery.trim());
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  }, [onCreateNew, searchQuery]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        return;
      }
    }

    const totalOptions = filteredSuggestions.length + (shouldShowCreateNew ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < totalOptions - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : totalOptions - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
          handleOptionSelect(filteredSuggestions[highlightedIndex]);
        } else if (highlightedIndex === filteredSuggestions.length && shouldShowCreateNew) {
          handleCreateNew();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  }, [isOpen, filteredSuggestions, shouldShowCreateNew, highlightedIndex, handleOptionSelect, handleCreateNew]);

  // Handle input focus
  const handleFocus = useCallback(() => {
    if (!disabled) {
      setIsOpen(true);
    }
  }, [disabled]);

  // Handle input blur
  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Delay to allow option selection
    setTimeout(() => {
      if (!listRef.current?.contains(e.relatedTarget as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }, 150);
  }, []);

  // Update search query when value changes externally
  useEffect(() => {
    setSearchQuery(value);
  }, [value]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  return (
    <div className={`relative ${className}`}>
      {/* Label */}
      {label && (
        <Label htmlFor="autocomplete-input" className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      {/* Input */}
      <div className="relative">
        <Input
          ref={inputRef}
          id="autocomplete-input"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`pr-10 ${error ? 'border-destructive' : ''}`}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />
        
        {/* Input Icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground" />
          )}
          <ChevronDown 
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`} 
          />
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}

      {/* Suggestions Dropdown */}
      {isOpen && (
        <Card 
          ref={listRef}
          className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto"
          role="listbox"
        >
          <CardContent className="p-0">
            {/* Suggestions */}
            {filteredSuggestions.length > 0 ? (
              filteredSuggestions.map((suggestion, index) => (
                <Button
                  key={suggestion.id || suggestion.value}
                  type="button"
                  variant="ghost"
                  className={`w-full justify-start text-left h-auto p-3 rounded-none border-b last:border-b-0 ${
                    highlightedIndex === index ? 'bg-accent' : ''
                  } ${suggestion.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !suggestion.disabled && handleOptionSelect(suggestion)}
                  disabled={suggestion.disabled}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{suggestion.label}</div>
                      {suggestion.description && (
                        <div className="text-sm text-muted-foreground truncate">
                          {suggestion.description}
                        </div>
                      )}
                    </div>
                    {highlightedIndex === index && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </Button>
              ))
            ) : (
              <div className="p-3 text-sm text-muted-foreground text-center">
                {emptyMessage || t('common.noResults')}
              </div>
            )}

            {/* Create New Option */}
            {shouldShowCreateNew && (
              <Button
                type="button"
                variant="ghost"
                className={`w-full justify-start text-left h-auto p-3 rounded-none border-t ${
                  highlightedIndex === filteredSuggestions.length ? 'bg-accent' : ''
                }`}
                onClick={handleCreateNew}
              >
                <div className="flex items-center gap-2 w-full">
                  <Plus className="h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <div className="font-medium">
                      {createNewLabel || t('common.createNew')} "{searchQuery}"
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('common.createNewDescription')}
                    </div>
                  </div>
                  {highlightedIndex === filteredSuggestions.length && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
