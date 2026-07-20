import { PageKey } from "@dragon-telecom/contract";

// PageKey → route, in PageKey's own declaration order (mirrors PageGroup's sidebar grouping:
// POS → POS clients → products → orders → sales → invoices → repairs). Destination pages ship
// in a later page set (scope confinement — pub-pages plan.md D4 plans only the `/staff`
// redirect/landing, not the pages behind it); entries are added here as each page lands. Until
// then this stays empty and StaffLanding renders its own "no permitted pages" state instead of
// navigating to a route that doesn't exist yet.
export const STAFF_PAGE_ORDER: PageKey[] = [
  PageKey.STAFF_POS,
  PageKey.STAFF_POS_CLIENTS,
  PageKey.STAFF_PRODUCTS,
  PageKey.STAFF_ORDERS,
  PageKey.STAFF_SALES,
  PageKey.STAFF_INVOICES,
  PageKey.STAFF_REPAIRS,
];

export const STAFF_PAGE_ROUTES: Partial<Record<PageKey, string>> = {};

// First permitted page that also has a shipped route, in canonical order — or undefined if the
// staff member's permitted pages don't include any page this app has shipped yet.
export function firstPermittedStaffRoute(permissions: string[]): string | undefined {
  const permitted = new Set(permissions);
  for (const key of STAFF_PAGE_ORDER) {
    const route = STAFF_PAGE_ROUTES[key];
    if (route && permitted.has(key)) return route;
  }
  return undefined;
}
