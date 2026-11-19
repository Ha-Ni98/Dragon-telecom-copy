import React, { useState, useRef, useEffect, useCallback, useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { ChevronDown, Plus, Check, X, Search, Loader2 } from "lucide-react";
import { FieldError } from "@/components/shared/FieldError";

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
  /** Suppresses the "create new" row even when `onCreateNew` is passed. Passing no `onCreateNew`
   *  already hides the row on its own (S6/I11 — a consumer with no handler used to still show a
   *  row that did nothing on click); this prop exists only for a consumer that has a handler
   *  available but wants the affordance hidden anyway. */
  showCreateNew?: boolean;
  createNewLabel?: string;
  emptyMessage?: string;
  /** DOM id for the input + its label's htmlFor. Defaults to a generated id — pass one
   *  explicitly when rendering several instances on one page (e.g. one per array row), so
   *  each gets its own id instead of colliding on a hardcoded one (RC-1/G2). */
  inputId?: string;
}

/**
 * Reusable autocomplete input with search, filter, and create-new functionality.
 *
 * Contract (RC-1): `value` is always the selected option's `value` (the entity id) — never
 * display text; `""` means nothing selected. The input always DISPLAYS the selected option's
 * `label`, both on first selection and on every subsequent one, including when `suggestions`
 * resolves asynchronously after `value` is already set (e.g. editing an existing record).
 * `onChange` fires only when the selection actually changes — an option's `value` on select, or
 * `""` on clear — never on every keystroke. `onSearch` still fires on every keystroke, for
 * consumers that debounce a remote fetch off the typed text.
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
  emptyMessage,
  inputId,
}: AutocompleteInputProps) {
  const { t } = useTranslation();
  const generatedId = useId();
  const resolvedId = inputId ?? generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = suggestions.find((s) => s.value === value);
  const selectedLabel = selectedOption?.label;

  // The input shows the selected entity's LABEL, never its id (RC-1). While focused the user owns
  // the text; the moment focus leaves, the text is re-derived from `value` -> its option's label,
  // so an async-loaded suggestion list resolves the display correctly on arrival too.
  useEffect(() => {
    if (!isFocused) setInputText(selectedLabel ?? "");
  }, [isFocused, selectedLabel, value]);

  // Filter suggestions based on search query — matched against label/description, never the raw
  // value (which is an id, not text a user would type).
  const filteredSuggestions = suggestions
    .filter(
      (suggestion) =>
        suggestion.label.toLowerCase().includes(inputText.toLowerCase()) ||
        (suggestion.description?.toLowerCase().includes(inputText.toLowerCase()) ?? false),
    )
    .slice(0, maxSuggestions);

  // "Create new" is only offered when the consumer actually supplied a handler for it — without
  // one the row rendered but clicking it did nothing (handleCreateNew's own `if (onCreateNew)`
  // guard swallowed it), which is exactly what the POS-client category field was showing (S6/I11).
  const shouldShowCreateNew =
    showCreateNew &&
    onCreateNew != null &&
    inputText.trim().length > 0 &&
    !suggestions.some((s) => s.label.toLowerCase() === inputText.toLowerCase());

  // Handle input change — typing no longer mutates the selection (RC-1); only onSearch (for
  // remote-fetch consumers) and the local filter react to it until an option is actually picked.
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputText(newValue);

      if (onSearch) {
        onSearch(newValue);
      }

      if (!isOpen) {
        setIsOpen(true);
      }
    },
    [onSearch, isOpen],
  );

  // Handle option selection
  const handleOptionSelect = useCallback(
    (option: AutocompleteOption) => {
      if (option.isNew && onCreateNew) {
        onCreateNew(option.value);
      } else {
        onChange(option.value);
        setInputText(option.label);
      }
      setIsOpen(false);
      setHighlightedIndex(-1);
      inputRef.current?.blur();
    },
    [onChange, onCreateNew],
  );

  // Handle create new
  const handleCreateNew = useCallback(() => {
    if (onCreateNew && inputText.trim()) {
      onCreateNew(inputText.trim());
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  }, [onCreateNew, inputText]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter") {
          setIsOpen(true);
          return;
        }
      }

      const totalOptions = filteredSuggestions.length + (shouldShowCreateNew ? 1 : 0);

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < totalOptions - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : totalOptions - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
            handleOptionSelect(filteredSuggestions[highlightedIndex]);
          } else if (highlightedIndex === filteredSuggestions.length && shouldShowCreateNew) {
            handleCreateNew();
          }
          break;
        case "Escape":
          setIsOpen(false);
          setHighlightedIndex(-1);
          setIsFocused(false);
          inputRef.current?.blur();
          break;
      }
    },
    [
      isOpen,
      filteredSuggestions,
      shouldShowCreateNew,
      highlightedIndex,
      handleOptionSelect,
      handleCreateNew,
    ],
  );

  // Handle input focus
  const handleFocus = useCallback(() => {
    if (!disabled) {
      setIsFocused(true);
      setIsOpen(true);
    }
  }, [disabled]);

  // Handle input blur
  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // Delay to allow option selection
      setTimeout(() => {
        if (!listRef.current?.contains(e.relatedTarget as Node)) {
          setIsOpen(false);
          setHighlightedIndex(-1);
          // Typing over a selection and clicking away without picking anything clears the
          // selection entirely — a half-typed label left in the field must never leave a stale
          // `value` behind for the form to submit.
          if (inputText.trim() === "" && value !== "") {
            onChange("");
          }
          setIsFocused(false);
        }
      }, 150);
    },
    [inputText, value, onChange],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onChange("");
      setInputText("");
    },
    [onChange],
  );

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  return (
    <div className={`relative ${className}`}>
      {/* Label */}
      {label && (
        <Label htmlFor={resolvedId} className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      {/* Input */}
      <div className="relative">
        <Input
          ref={inputRef}
          id={resolvedId}
          value={inputText}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`pr-16 ${error ? "border-destructive" : ""}`}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />

        {/* Input Icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value !== "" && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              aria-label={t("common.actions.clearSelection")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground" />
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* Description */}
      {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}

      {/* Error Message */}
      {error && <FieldError className="mt-1">{error}</FieldError>}

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
                    highlightedIndex === index ? "bg-accent" : ""
                  } ${suggestion.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
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
                    {highlightedIndex === index && <Check className="h-4 w-4 text-primary" />}
                  </div>
                </Button>
              ))
            ) : (
              <div className="p-3 text-sm text-muted-foreground text-center">
                {emptyMessage || t("common.noResults")}
              </div>
            )}

            {/* Create New Option */}
            {shouldShowCreateNew && (
              <Button
                type="button"
                variant="ghost"
                className={`w-full justify-start text-left h-auto p-3 rounded-none border-t ${
                  highlightedIndex === filteredSuggestions.length ? "bg-accent" : ""
                }`}
                onClick={handleCreateNew}
              >
                <div className="flex items-center gap-2 w-full">
                  <Plus className="h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <div className="font-medium">
                      {createNewLabel || t("common.createNew")} "{inputText}"
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t("common.createNewDescription")}
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
