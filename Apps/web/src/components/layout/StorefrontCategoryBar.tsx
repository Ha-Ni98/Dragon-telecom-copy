import { useMemo } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import type { FamilyDto } from "@dragon-telecom/contract";
import { useCatalogFamilies } from "@/hooks/useCatalogTaxonomy";
import { usePublicSettings } from "@/hooks/usePlatform";
import { useTranslation } from "@/hooks/useTranslation";
import { CATALOG_FAMILY_PARAM, catalogFamilyLink } from "@/lib/deep-links";
import { cn } from "@/lib/utils";

const itemClass = (active: boolean) =>
  cn(
    "inline-flex items-center gap-1 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
    active
      ? "border-highlight text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );

// S37 — desktop header bar (md+ only; phones use the bottom nav's Categories item).
// Owner change after S39: after "Home" and "All products" it lists exactly the families chosen in
// Settings → Storefront → "Header bar families" (settings.storefront.navFamilyIds), in that order,
// as PLAIN links — the S37 hover dropdown of child families was removed, and a child family can be
// picked directly. No selection = only "Home" and "All products". Ids are matched against the
// PUBLIC families list, so a disabled (or deleted) family silently drops out. Links are
// exact-match family filters (S37 Q1).
export function StorefrontCategoryBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { data: families } = useCatalogFamilies();
  const { data: settings } = usePublicSettings();

  const navFamilies = useMemo(() => {
    const byId = new Map((families ?? []).map((family) => [family.id, family]));
    return (settings?.storefront.navFamilyIds ?? [])
      .map((id) => byId.get(id))
      .filter((family): family is FamilyDto => family !== undefined);
  }, [families, settings?.storefront.navFamilyIds]);

  const paramFamilyId = pathname === "/products" ? searchParams.get(CATALOG_FAMILY_PARAM) : null;
  const homeActive = pathname === "/";
  const allActive = pathname === "/products" && !paramFamilyId;

  return (
    <nav aria-label={t("header.categoryBar")} className="hidden border-t border-border md:block">
      <ul className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 px-4">
        {/* Home comes first, before "All products" (owner request after S39 review). */}
        <li>
          <Link
            to="/"
            className={itemClass(homeActive)}
            aria-current={homeActive ? "page" : undefined}
          >
            {t("header.home")}
          </Link>
        </li>
        <li>
          <Link to="/products" className={itemClass(allActive)}>
            {t("header.allProducts")}
          </Link>
        </li>
        {navFamilies.map((family) => (
          <li key={family.id}>
            <Link
              to={catalogFamilyLink(family.id)}
              className={itemClass(paramFamilyId === family.id)}
            >
              {family.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
