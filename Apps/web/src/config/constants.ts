// App-wide UI constants.
// EXTENSION POINT: hardcoded, non-DTO-derived values shared across pages go here.

// S37 — currency suffix of the storefront/client price format ("3 200 DA"). A symbol, identical
// in both locales, so a constant rather than a translation key. Back-office screens keep
// formatDZD (lib/utils.ts) and are not affected.
export const PRICE_CURRENCY_SUFFIX = "DA";
// S37 — the single storefront search input (PublicHeader). The bottom nav's Search item focuses
// it by id; the header is sticky, so the input is always on screen.
export const STOREFRONT_SEARCH_INPUT_ID = "storefront-search-input";
