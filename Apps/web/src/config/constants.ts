// App-wide UI constants.
// EXTENSION POINT: hardcoded, non-DTO-derived values shared across pages go here.

// S37 — currency suffix of the storefront/client price format ("3 200 DA"). A symbol, identical
// in both locales, so a constant rather than a translation key. Back-office screens keep
// formatDZD (lib/utils.ts) and are not affected.
export const PRICE_CURRENCY_SUFFIX = "DA";
// S37 — the single storefront search input (PublicHeader). The bottom nav's Search item focuses
// it by id; the header is sticky, so the input is always on screen.
export const STOREFRONT_SEARCH_INPUT_ID = "storefront-search-input";

// S38 — home hero slider autoplay interval (the set: 5 seconds).
export const HERO_AUTOPLAY_MS = 5000;
// S38 — the viewport width at which the hero swaps its mobile image for the desktop one. Keep in
// sync with Tailwind's `md` (768px) — S37 P1's single phone-layout breakpoint.
export const HERO_SWITCH_MEDIA = "(min-width: 768px)";

// S38 — the static share image (Vite serves /public at the site root). index.html points its
// og:image at it by absolute URL; useDocumentMeta falls back to it when no link-preview image or
// store logo is set.
export const DEFAULT_SHARE_IMAGE_PATH = "/og-default.jpg";

// Owner change after S39 — the storefront header and footer carry these ids so a URL can land on
// them directly: /#header (top) and /#footer (contact). ScrollToTop honours the hash.
export const STOREFRONT_HEADER_ID = "header";
export const STOREFRONT_FOOTER_ID = "footer";
