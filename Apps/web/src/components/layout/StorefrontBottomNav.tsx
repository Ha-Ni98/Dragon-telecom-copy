import { Link, useLocation, useNavigate } from "react-router-dom";
import { UserType } from "@dragon-telecom/contract";
import { CartCountBubble } from "@/components/shared/CartCountBubble";
import { useCartCount } from "@/hooks/useClientPortal";
import { useSession } from "@/hooks/useSession";
import { useTranslation } from "@/hooks/useTranslation";
import { STOREFRONT_SEARCH_INPUT_ID } from "@/config/constants";
import {
  STOREFRONT_ACCOUNT_PATHS,
  STOREFRONT_BOTTOM_NAV,
  StorefrontBottomNavKey,
} from "@/config/nav-links";
import type { CatalogLocationState } from "@/types/storefront-nav.types";
import { cn } from "@/lib/utils";

// S37 — storefront mobile bottom nav (phones only, md:hidden): Home, Categories, Search, Cart,
// Account; the active item carries the highlight underline.
// - Categories opens the catalog with its filter drawer already open (P6), via router state — not
//   a new page, and not a UI flag in the URL (Products.tsx clears the state after reading it).
// - Account goes to the session's own home (P5): /my-account is CLIENT-only, so staff/admin are
//   sent to their back-office instead of being bounced by RoleGuard.
// - z-40: above page content and the header's search dropdown, BELOW every overlay (Sheet,
//   Dialog, AlertDialog and Drawer are z-50 with a dark overlay), so an open drawer covers it.
//   Do not raise it. PublicLayout pads its bottom by --bottom-nav-height so the footer clears it,
//   and index.css derives the toast offset from the same variable.
export function StorefrontBottomNav() {
  const { t } = useTranslation();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const cartCount = useCartCount();

  const accountHref =
    session?.type === UserType.CLIENT
      ? "/my-account"
      : session?.type === UserType.ADMIN
        ? "/admin"
        : session?.type === UserType.STAFF
          ? "/staff"
          : "/login";

  const isActive = (key: StorefrontBottomNavKey): boolean => {
    switch (key) {
      case StorefrontBottomNavKey.HOME:
        return pathname === "/";
      case StorefrontBottomNavKey.CATEGORIES:
        return pathname.startsWith("/products");
      case StorefrontBottomNavKey.CART:
        return pathname === "/cart";
      case StorefrontBottomNavKey.ACCOUNT:
        return STOREFRONT_ACCOUNT_PATHS.some((path) => pathname.startsWith(path));
      default:
        return false;
    }
  };

  const openCategories = () => {
    const state: CatalogLocationState = { openFamilyFilter: true };
    navigate({ pathname: "/products", search: pathname === "/products" ? search : "" }, { state });
  };

  const focusSearch = () => {
    const input = document.getElementById(STOREFRONT_SEARCH_INPUT_ID);
    input?.scrollIntoView({ block: "nearest" });
    input?.focus();
  };

  return (
    <nav
      data-storefront-bottom-nav=""
      aria-label={t("storefront.bottomNav.label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid h-[var(--bottom-nav-height)] grid-cols-5">
        {STOREFRONT_BOTTOM_NAV.map(({ key, labelKey, icon: Icon }) => {
          const active = isActive(key);
          const itemClass = cn(
            "relative flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
            active ? "text-foreground" : "text-muted-foreground",
          );
          const content = (
            <>
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {key === StorefrontBottomNavKey.CART && <CartCountBubble count={cartCount} />}
              </span>
              <span className="max-w-full truncate px-1">{t(labelKey)}</span>
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-1.5 h-0.5 w-6 rounded-full bg-highlight"
                />
              )}
            </>
          );
          const ariaCurrent = active ? ("page" as const) : undefined;

          return (
            <li key={key} className="min-w-0">
              {key === StorefrontBottomNavKey.CATEGORIES ? (
                <button
                  type="button"
                  className={itemClass}
                  aria-current={ariaCurrent}
                  onClick={openCategories}
                >
                  {content}
                </button>
              ) : key === StorefrontBottomNavKey.SEARCH ? (
                <button type="button" className={itemClass} onClick={focusSearch}>
                  {content}
                </button>
              ) : (
                <Link
                  to={
                    key === StorefrontBottomNavKey.HOME
                      ? "/"
                      : key === StorefrontBottomNavKey.CART
                        ? "/cart"
                        : accountHref
                  }
                  className={itemClass}
                  aria-current={ariaCurrent}
                  aria-label={
                    key === StorefrontBottomNavKey.CART
                      ? t("header.cartWithCount", { count: cartCount })
                      : undefined
                  }
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
