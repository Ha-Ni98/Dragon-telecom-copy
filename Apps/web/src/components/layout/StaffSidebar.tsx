import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { usePermissions } from "@/hooks/usePermissions";
import { STAFF_NAV_LINKS } from "@/config/nav-links";
import { STAFF_PAGE_ROUTES } from "@/lib/staff-pages";

const LINK_CLASS =
  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors";
const ACTIVE_CLASS = "bg-primary-light text-primary border-l-4 border-highlight -ml-1 pl-2";
const INACTIVE_CLASS = "text-muted-foreground hover:bg-accent hover:text-foreground";

// Unlike AdminSidebarNav (static, unconditional), this is permission-filtered — StaffLayout
// serves both STAFF (only their granted PageKeys) and ADMIN (backend's effectivePages() always
// returns every PageKey for ADMIN, so this naturally shows everything for them without a
// separate branch here).
export function StaffSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const loc = useLocation();
  const { data: permissions, isLoading } = usePermissions();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {STAFF_NAV_LINKS.map((item) => {
        // The one ungated entry (dashboard) — always visible, mirrors admin.nav.dashboard.
        if (!item.pageKey) {
          const active = loc.pathname === "/staff";
          const Icon = item.icon;
          return (
            <Link
              key="/staff"
              to="/staff"
              onClick={onNavigate}
              className={cn(LINK_CLASS, active ? ACTIVE_CLASS : INACTIVE_CLASS)}
            >
              <Icon className="h-4 w-4" />
              {t(item.labelKey)}
            </Link>
          );
        }

        // Fail-closed while permissions resolve or for a page the viewer isn't granted — never
        // flash a link the click would immediately bounce from.
        if (isLoading || !permissions?.includes(item.pageKey)) return null;

        const to = STAFF_PAGE_ROUTES[item.pageKey];
        const Icon = item.icon;

        // Permitted but no destination page has shipped yet (every entry but Products, this
        // set) — shown so the sidebar reflects the real permitted set, but not a dead link.
        if (!to) {
          return (
            <span
              key={item.pageKey}
              aria-disabled="true"
              className={cn(LINK_CLASS, "cursor-default text-muted-foreground/50")}
            >
              <Icon className="h-4 w-4" />
              {t(item.labelKey)}
            </span>
          );
        }

        const active = loc.pathname === to;
        return (
          <Link
            key={item.pageKey}
            to={to}
            onClick={onNavigate}
            className={cn(LINK_CLASS, active ? ACTIVE_CLASS : INACTIVE_CLASS)}
          >
            <Icon className="h-4 w-4" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

export function StaffSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-background lg:block">
      <StaffSidebarNav />
    </aside>
  );
}
