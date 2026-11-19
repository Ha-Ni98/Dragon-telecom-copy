import { useMemo } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import type { FamilyDto } from "@dragon-telecom/contract";
import { useCatalogFamilies } from "@/hooks/useCatalogTaxonomy";
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

// S37 — desktop category bar: top-level families, each with a hover/focus dropdown of its child
// families (one nesting level, catalog.service assertOneNestingLevel). Links are exact-match
// family filters (Q1). Children of a disabled parent don't surface (S21 Q5 / plan-S37 P7): the
// public families list omits the disabled parent, so its children have no parent in the list and
// are skipped. Phones use the bottom nav's Categories item instead (this bar is md+ only).
export function StorefrontCategoryBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { data: families } = useCatalogFamilies();

  const { tops, childrenByParent } = useMemo(() => {
    const list = families ?? [];
    const byParent = new Map<string, FamilyDto[]>();
    for (const family of list) {
      if (!family.parentId) continue;
      byParent.set(family.parentId, [...(byParent.get(family.parentId) ?? []), family]);
    }
    return { tops: list.filter((family) => !family.parentId), childrenByParent: byParent };
  }, [families]);

  const paramFamilyId = pathname === "/products" ? searchParams.get(CATALOG_FAMILY_PARAM) : null;
  const homeActive = pathname === "/";
  const allActive = pathname === "/products" && !paramFamilyId;
  const isTopActive = (family: FamilyDto, kids: FamilyDto[]) =>
    paramFamilyId !== null &&
    (paramFamilyId === family.id || kids.some((child) => child.id === paramFamilyId));

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
        {tops.map((family) => {
          const kids = childrenByParent.get(family.id) ?? [];
          return (
            <li key={family.id} className="group relative">
              <Link
                to={catalogFamilyLink(family.id)}
                className={itemClass(isTopActive(family, kids))}
                aria-haspopup={kids.length > 0 ? "true" : undefined}
              >
                {family.name}
                {kids.length > 0 && <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
              </Link>
              {kids.length > 0 && (
                <div className="invisible absolute left-0 top-full z-40 min-w-48 pt-1 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <ul
                    aria-label={t("header.subFamiliesOf", { name: family.name })}
                    className="rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
                  >
                    {kids.map((child) => (
                      <li key={child.id}>
                        <Link
                          to={catalogFamilyLink(child.id)}
                          className={cn(
                            "block rounded-sm px-3 py-1.5 text-sm hover:bg-muted",
                            paramFamilyId === child.id && "font-semibold text-foreground",
                          )}
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
