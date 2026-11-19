import {
  LayoutDashboard,
  Package,
  Users,
  Truck,
  ShoppingCart,
  BarChart3,
  Settings,
  FileText,
  ClipboardList,
  Receipt,
  Wrench,
  CreditCard,
  FileSpreadsheet,
  Boxes,
  FileStack,
  Contact,
  ShieldCheck,
  Search,
  Wallet,
  Home,
  LayoutGrid,
  User,
  type LucideIcon,
} from "lucide-react";
import { PageKey } from "@dragon-telecom/contract";

export interface NavLink {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

// A collapsible group in the admin sidebar (e.g. "Catalog ▾"). Additive to NavLink.
export interface NavGroup {
  labelKey: string;
  icon: LucideIcon;
  children: NavLink[];
}

export type AdminNavItem = NavLink | NavGroup;

export function isNavGroup(item: AdminNavItem): item is NavGroup {
  return "children" in item;
}

// EXTENSION POINT (modules): add one nav entry (or a NavGroup) per admin section.
// Routes below aren't wired into App.tsx yet — that's Sprint 3 (Layouts & Boundaries); this
// declares the intended paths the ported pages/admin/<feature>/ pages will mount at.
export const ADMIN_NAV_LINKS: AdminNavItem[] = [
  { to: "/admin", labelKey: "admin.nav.dashboard", icon: LayoutDashboard },
  { to: "/admin/pos", labelKey: "admin.nav.pos", icon: CreditCard },
  { to: "/admin/pos-clients", labelKey: "admin.nav.posClients", icon: Contact },
  { to: "/admin/products", labelKey: "admin.nav.products", icon: Package },
  { to: "/admin/inventory", labelKey: "admin.nav.inventory", icon: Boxes },
  { to: "/admin/clients", labelKey: "admin.nav.clients", icon: Users },
  { to: "/admin/suppliers", labelKey: "admin.nav.suppliers", icon: Truck },
  { to: "/admin/supplier-invoices", labelKey: "admin.nav.supplierInvoices", icon: FileStack },
  { to: "/admin/orders", labelKey: "admin.nav.orders", icon: ShoppingCart },
  { to: "/admin/sales", labelKey: "admin.nav.sales", icon: Receipt },
  // S33 — the Caisse (admin only; this sidebar is the admin one).
  { to: "/admin/cash-register", labelKey: "admin.nav.cashRegister", icon: Wallet },
  { to: "/admin/invoices", labelKey: "admin.nav.invoices", icon: FileSpreadsheet },
  { to: "/admin/repairs", labelKey: "admin.nav.repairs", icon: Wrench },
  { to: "/admin/statistics", labelKey: "admin.nav.statistics", icon: BarChart3 },
  { to: "/admin/users", labelKey: "admin.nav.users", icon: ShieldCheck },
  { to: "/admin/logs", labelKey: "admin.nav.logs", icon: FileText },
  {
    to: "/admin/activity/staff-searches",
    labelKey: "admin.nav.staffSearches",
    icon: Search,
  },
  { to: "/admin/settings", labelKey: "admin.nav.settings", icon: Settings },
];

// set-02 D4/D11 — the staff sidebar, unlike ADMIN_NAV_LINKS, is permission-filtered (StaffLayout
// serves both STAFF, who only see their granted pages, and ADMIN, who — per the backend's
// `effectivePages` — always holds every PageKey). `pageKey: undefined` marks the one entry with
// no gate: the dashboard itself, StaffLayout's fixed landing (mirrors admin.nav.dashboard's own
// ungated first entry). `to` is intentionally omitted — StaffSidebarNav resolves each gated
// entry's route from `lib/staff-pages.ts`'s STAFF_PAGE_ROUTES at render time, so a permitted-but-
// unshipped page (every entry except products, this set) renders disabled instead of a dead link.
export interface StaffNavLink {
  labelKey: string;
  icon: LucideIcon;
  pageKey?: PageKey;
}

export const STAFF_NAV_LINKS: StaffNavLink[] = [
  { labelKey: "staff.nav.dashboard", icon: LayoutDashboard },
  { labelKey: "staff.nav.pos", icon: ShoppingCart, pageKey: PageKey.STAFF_POS },
  { labelKey: "staff.nav.posClients", icon: Users, pageKey: PageKey.STAFF_POS_CLIENTS },
  { labelKey: "staff.nav.products", icon: Package, pageKey: PageKey.STAFF_PRODUCTS },
  { labelKey: "staff.nav.orders", icon: ClipboardList, pageKey: PageKey.STAFF_ORDERS },
  { labelKey: "staff.nav.sales", icon: Receipt, pageKey: PageKey.STAFF_SALES },
  { labelKey: "staff.nav.invoices", icon: FileText, pageKey: PageKey.STAFF_INVOICES },
  { labelKey: "staff.nav.repairs", icon: Wrench, pageKey: PageKey.STAFF_REPAIRS },
];

// S37 — storefront mobile bottom nav (phones only, md:hidden). Order is the set's: Home,
// Categories, Search, Cart, Account. Behaviour per key lives in StorefrontBottomNav.
export const StorefrontBottomNavKey = {
  HOME: "home",
  CATEGORIES: "categories",
  SEARCH: "search",
  CART: "cart",
  ACCOUNT: "account",
} as const;
export type StorefrontBottomNavKey =
  (typeof StorefrontBottomNavKey)[keyof typeof StorefrontBottomNavKey];

export const STOREFRONT_BOTTOM_NAV: {
  key: StorefrontBottomNavKey;
  labelKey: string;
  icon: LucideIcon;
}[] = [
  { key: StorefrontBottomNavKey.HOME, labelKey: "storefront.bottomNav.home", icon: Home },
  {
    key: StorefrontBottomNavKey.CATEGORIES,
    labelKey: "storefront.bottomNav.categories",
    icon: LayoutGrid,
  },
  { key: StorefrontBottomNavKey.SEARCH, labelKey: "storefront.bottomNav.search", icon: Search },
  { key: StorefrontBottomNavKey.CART, labelKey: "storefront.bottomNav.cart", icon: ShoppingCart },
  { key: StorefrontBottomNavKey.ACCOUNT, labelKey: "storefront.bottomNav.account", icon: User },
];

// Pages the Account item counts as "active" for (account area + auth screens).
export const STOREFRONT_ACCOUNT_PATHS = [
  "/my-account",
  "/orders",
  "/invoices",
  "/login",
  "/register",
];
