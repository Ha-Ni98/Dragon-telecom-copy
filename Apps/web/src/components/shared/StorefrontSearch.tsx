import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import { useCatalogProducts } from "@/hooks/useCatalogProducts";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useRecentSearches } from "@/hooks/use-search";
import { useSession } from "@/hooks/useSession";
import { useSendClientActivity } from "@/hooks/useObservability";
import { ClientActivityType, UserType } from "@dragon-telecom/contract";
import { formatDZD } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface StorefrontSearchProps {
  variant: "desktop" | "mobile";
  onDone?: () => void;
  autoFocus?: boolean;
}

const MAX_RESULTS = 5;

// S15/R1 — the header search is a typeahead, not a submit box: typing shows a dropdown of at
// most 5 matching products (name, resolved price, family · brand), with a trailing "see all
// results" row. Product rows go straight to /products/:id; the trailing row (and Enter) go to
// /products?search=. Shared by the desktop inline input and the mobile expand-in-place input —
// one component, two renderings, never forked state (ProductFilters' established precedent for
// desktop/mobile-Sheet controls).
export function StorefrontSearch({ variant, onDone, autoFocus }: StorefrontSearchProps) {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const { addRecentSearch } = useRecentSearches();
  const { data: session } = useSession();
  const isClient = session?.type === UserType.CLIENT;
  const sendActivity = useSendClientActivity();

  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(input, 300);
  const trimmed = debouncedQuery.trim();
  const enabled = trimmed.length >= 2;

  const { data: productsResult, isFetching } = useCatalogProducts(
    { search: trimmed, page: 1, limit: MAX_RESULTS },
    { enabled },
  );
  const items = productsResult?.items ?? [];
  const showDropdown = isOpen && input.trim().length >= 2;

  // Close on outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const goToProduct = (productId: string) => {
    addRecentSearch(input.trim());
    // Emitted here only when the user jumps straight to a product — the "see all" / Enter path
    // lands on /products, whose own debounced effect (Products.tsx) already logs the same query.
    // Logging in both places would double-count every header search.
    if (isClient && input.trim()) {
      sendActivity.mutate({ type: ClientActivityType.SEARCH, query: input.trim() });
    }
    navigate(`/products/${productId}`);
    reset();
  };

  const goToAllResults = () => {
    if (!input.trim()) return;
    addRecentSearch(input.trim());
    navigate(`/products?search=${encodeURIComponent(input.trim())}`);
    reset();
  };

  const reset = () => {
    setInput("");
    setIsOpen(false);
    setHighlightedIndex(-1);
    onDone?.();
  };

  const rowCount = items.length + 1; // + "see all results" row

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % rowCount);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? rowCount - 1 : prev - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < items.length) {
        goToProduct(items[highlightedIndex].id);
      } else {
        goToAllResults();
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative", variant === "desktop" ? "w-full max-w-sm" : "w-full flex-1")}
    >
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="storefront-search-listbox"
          placeholder={t("header.search")}
          className="w-full pl-10"
          value={input}
          autoFocus={autoFocus}
          onChange={(e) => {
            setInput(e.target.value);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          aria-label={t("accessibility.search")}
        />
        {variant === "mobile" && (
          <button
            type="button"
            onClick={reset}
            aria-label={t("header.closeSearch")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          id="storefront-search-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
        >
          {isFetching ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">{t("search.loading")}</div>
          ) : enabled && items.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">{t("search.noResults")}</div>
          ) : (
            items.map((product, index) => {
              const resolvedPrice = product.currentPrice ?? product.guestPrice;
              const priceLabel =
                !product.priceHidden && resolvedPrice !== undefined
                  ? formatDZD(resolvedPrice, language)
                  : t("cart.priceOnRequest");
              return (
                <button
                  key={product.id}
                  type="button"
                  role="option"
                  aria-selected={highlightedIndex === index}
                  onClick={() => goToProduct(product.id)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b border-border px-4 py-2 text-left last:border-b-0 hover:bg-accent",
                    highlightedIndex === index && "bg-accent",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {product.name}
                    </span>
                    <span className="shrink-0 text-sm text-primary">{priceLabel}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {product.family.name} · {product.brand.name}
                  </span>
                </button>
              );
            })
          )}

          <button
            type="button"
            role="option"
            aria-selected={highlightedIndex === items.length}
            onClick={goToAllResults}
            className={cn(
              "w-full px-4 py-2 text-left text-sm font-medium text-primary hover:bg-accent",
              highlightedIndex === items.length && "bg-accent",
            )}
          >
            {t("search.seeAllResults")}
          </button>
        </div>
      )}
    </div>
  );
}
