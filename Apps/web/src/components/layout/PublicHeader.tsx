import { Link } from "react-router-dom";
import { Logo } from "@/components/shared/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export function PublicHeader() {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center">
          <Logo size={36} />
        </Link>
        <nav className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
          <Button asChild size="sm">
            <Link to="/login">{t("auth.login.submit")}</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
