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
