import { Logo } from "@/components/shared/Logo";
import { useTranslation } from "@/hooks/useTranslation";

export function PublicFooter() {
  const { t } = useTranslation();
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <Logo size={28} />
          <p className="text-xs text-muted-foreground">{t("common.brand.tagline")}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {t("common.legal.copyright", { year: new Date().getFullYear() })}
        </span>
      </div>
    </footer>
  );
}
