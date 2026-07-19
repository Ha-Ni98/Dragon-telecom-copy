import {
  LayoutDashboard,
  Package,
  Users,
  Truck,
  ShoppingCart,
  BarChart3,
  Settings,
  FileText,
  type LucideIcon,
} from "lucide-react";

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
