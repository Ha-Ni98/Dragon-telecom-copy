import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { useTranslation } from "@/hooks/useTranslation";

// S39 — the one compact header every home section uses: marker title on the left, an optional
// "See all" link on the right. No description paragraph under the title — it cost about 100px per
// section, and first-screen height is what the home page is being tuned for.
export function HomeSectionHeader({ title, seeAllTo }: { title: string; seeAllTo?: string }) {
  const { t } = useTranslation();
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <SectionTitle className="min-w-0 text-xl font-bold md:text-2xl">{title}</SectionTitle>
      {seeAllTo && (
        <Link
          to={seeAllTo}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t("home.rows.seeAll")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
