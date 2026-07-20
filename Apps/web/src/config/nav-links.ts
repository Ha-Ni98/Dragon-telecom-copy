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
  { to: "/admin/products", labelKey: "admin.nav.products", icon: Package },
  { to: "/admin/clients", labelKey: "admin.nav.clients", icon: Users },
  { to: "/admin/suppliers", labelKey: "admin.nav.suppliers", icon: Truck },
  { to: "/admin/orders", labelKey: "admin.nav.orders", icon: ShoppingCart },
  { to: "/admin/statistics", labelKey: "admin.nav.statistics", icon: BarChart3 },
  { to: "/admin/logs", labelKey: "admin.nav.logs", icon: FileText },
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
