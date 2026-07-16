import { LayoutDashboard, Truck, type LucideIcon } from "lucide-react";

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
export const ADMIN_NAV_LINKS: AdminNavItem[] = [
  { to: "/admin", labelKey: "admin.nav.dashboard", icon: LayoutDashboard },
  { to: "/admin/delivery-companies", labelKey: "admin.nav.deliveryCompanies", icon: Truck },
];
