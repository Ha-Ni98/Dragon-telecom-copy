// S36 — links that open one sale or one order from elsewhere (the "Products bought" documents).
// The sales page opens that sale's detail drawer; the orders page opens on All, searched to that
// reference (there is no single-order endpoint — the list's reference search finds it).
export type BackofficeScope = "staff" | "admin";

export const SALE_DEEP_LINK_PARAM = "sale";
export const ORDER_SEARCH_DEEP_LINK_PARAM = "search";

export const saleDeepLink = (scope: BackofficeScope, reference: string): string =>
  `/${scope}/sales?${SALE_DEEP_LINK_PARAM}=${encodeURIComponent(reference)}`;

export const orderDeepLink = (scope: BackofficeScope, reference: string): string =>
  `/${scope}/orders?${ORDER_SEARCH_DEEP_LINK_PARAM}=${encodeURIComponent(reference)}`;

// S37 — the catalog filtered to one family (category bar, bottom-nav, home family tiles). Exact
// family match — a parent does NOT include its children's products (S37 Q1).
export const CATALOG_FAMILY_PARAM = "familyId";

export const catalogFamilyLink = (familyId: string): string =>
  `/products?${CATALOG_FAMILY_PARAM}=${encodeURIComponent(familyId)}`;
