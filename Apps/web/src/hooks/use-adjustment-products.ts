import { useMemo } from "react";
import type { AdminProductDto } from "@dragon-telecom/contract";
import { useAdminCatalogProducts } from "@/hooks/useCatalogProducts";
import type { AutocompleteOption } from "@/components/shared/autocomplete-input";

export interface AdjustmentProductFacts {
  systemQuantityByProductId: Record<string, number>;
  avgStockPriceByProductId: Record<string, number>;
  currentPricesByProductId: Record<
    string,
    {
      guestPrice?: number;
      defaultSalePrice?: number;
      categoryPrices: { categoryId: string; price: number }[];
    }
  >;
}

// S28 — the Adjustments tab's product picker used to offer only the first 100 admin products
// (`useAdminCatalogProducts({ page: 1, limit: 100 })`), so anything outside that page was
// unreachable. This hook replaces it with a server-side search of the whole catalogue, following
// the same debounced-search pattern StaffPos.tsx uses for its own product search.
//
// Two AutocompleteInput behaviours (autocomplete-input.tsx) are why this hook fetches TWO result
// sets and merges them, rather than just wiring the search query straight through:
//
// 1. AutocompleteInput re-derives the input's displayed text from
//    `suggestions.find(s => s.value === value)` — if the suggestion list is re-fetched for a
//    different search term, an already-selected product drops out of the list and the field goes
//    blank. The `ids` query below re-resolves every currently selected product so it always stays
//    in `options`, regardless of what the user has since typed.
// 2. AutocompleteInput also filters `suggestions` locally against the typed text, matched against
//    `label` OR `description` — never `value`. A server-side BARCODE match returns a product whose
//    NAME does not contain the typed digits, so if the barcode were not surfaced in `description`
//    the local filter would immediately hide the very row the search just found. Putting the
//    barcode in `description` keeps it visible for a barcode search and shows it to the user too.
//
// `ids` is a comma-separated string, not an array — Express 5's `querystring` parser would turn
// `ids[]=` into a key literally named `"ids[]"` (S15, catalog.query.ts:8-19).
export function useAdjustmentProducts(
  search: string,
  selectedProductIds: string[],
): { options: AutocompleteOption[]; isLoading: boolean } & AdjustmentProductFacts {
  const searchQuery = useAdminCatalogProducts({
    search: search.trim() || undefined,
    page: 1,
    limit: 20,
  });

  const uniqueSelectedIds = useMemo(
    () => [...new Set(selectedProductIds.filter(Boolean))],
    [selectedProductIds],
  );
  const selectionQuery = useAdminCatalogProducts(
    { ids: uniqueSelectedIds.join(","), page: 1, limit: 100 },
    { enabled: uniqueSelectedIds.length > 0 },
  );

  const productsById = useMemo(() => {
    const map = new Map<string, AdminProductDto>();
    for (const product of searchQuery.data?.items ?? []) map.set(product.id, product);
    // Selection wins on collision — it is the authoritative row for a product the user actually
    // picked, and it must never disappear just because the search result page changed.
    for (const product of selectionQuery.data?.items ?? []) map.set(product.id, product);
    return map;
  }, [searchQuery.data, selectionQuery.data]);

  const products = useMemo(() => [...productsById.values()], [productsById]);

  const options = useMemo<AutocompleteOption[]>(
    () => products.map((p) => ({ value: p.id, label: p.name, description: p.barcode })),
    [products],
  );
  const systemQuantityByProductId = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p.quantityOnHand])),
    [products],
  );
  // D10 — the adjustment default and every margin read avgStockPrice (the quantity-weighted
  // figure), never avgPrice (which is supplier-invoice context only).
  const avgStockPriceByProductId = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p.avgStockPrice])),
    [products],
  );
  const currentPricesByProductId = useMemo(
    () =>
      Object.fromEntries(
        products.map((p) => [
          p.id,
          {
            guestPrice: p.guestPrice,
            defaultSalePrice: p.defaultSalePrice,
            categoryPrices: p.categoryPrices.map((cp) => ({
              categoryId: cp.categoryId,
              price: cp.price,
            })),
          },
        ]),
      ),
    [products],
  );

  return {
    options,
    isLoading: searchQuery.isLoading || selectionQuery.isLoading,
    systemQuantityByProductId,
    avgStockPriceByProductId,
    currentPricesByProductId,
  };
}
