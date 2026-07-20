import { PageKey } from "@dragon-telecom/contract";

// PageKey → route, in PageKey's own declaration order (mirrors PageGroup's sidebar grouping:
// POS → POS clients → products → orders → sales → invoices → repairs).
//
// set-02 D1/D11 repurposing: this module used to back a first-permitted-page landing redirect
// (`firstPermittedStaffRoute`, retired this sprint — `/staff` is now the fixed StaffDashboard,
// not a redirect target, so "first permitted page" no longer means anything). What's still
// load-bearing: STAFF_PAGE_ROUTES is now the single source of truth `StaffSidebarNav`
// (components/layout/StaffSidebar.tsx) reads to decide whether a permitted nav entry is a real
// `<Link>` or a disabled "not shipped yet" row — entries are added here as each destination page
// lands in a later page set (scope confinement, same as before).
export const STAFF_PAGE_ORDER: PageKey[] = [
  PageKey.STAFF_POS,
  PageKey.STAFF_POS_CLIENTS,
  PageKey.STAFF_PRODUCTS,
  PageKey.STAFF_ORDERS,
  PageKey.STAFF_SALES,
  PageKey.STAFF_INVOICES,
  PageKey.STAFF_REPAIRS,
];

export const STAFF_PAGE_ROUTES: Partial<Record<PageKey, string>> = {
  [PageKey.STAFF_PRODUCTS]: "/staff/products",
};
