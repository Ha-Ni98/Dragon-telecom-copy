import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Facebook, Twitter, Instagram, Youtube } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTranslation } from "@/hooks/useTranslation";

export function PublicFooter() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  return (
    <footer className="mt-16 border-t border-border bg-surface" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[2fr_1fr_1fr]">
          {/* Company info */}
          <div className="space-y-4">
            <Logo size={32} />
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t("footer.description")}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Facebook">
                <Facebook className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Twitter">
                <Twitter className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Instagram">
                <Instagram className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label="YouTube">
                <Youtube className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Quick links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">{t("footer.quickLinks")}</h3>
            <nav aria-label="Quick navigation">
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/" className="text-muted-foreground transition-colors hover:text-primary">
                    {t("header.home")}
                  </Link>
                </li>
                <li>
                  <Link to="/products" className="text-muted-foreground transition-colors hover:text-primary">
                    {t("header.products")}
                  </Link>
                </li>
                <li>
                  <Link to="/orders" className="text-muted-foreground transition-colors hover:text-primary">
                    {t("orders.title")}
                  </Link>
                </li>
                <li>
                  {isAuthenticated ? (
                    <Link to="/my-account" className="text-muted-foreground transition-colors hover:text-primary">
                      {t("header.account")}
                    </Link>
                  ) : (
                    <Link to="/login" className="text-muted-foreground transition-colors hover:text-primary">
                      {t("header.login")}
                    </Link>
                  )}
                </li>
              </ul>
            </nav>
          </div>

          {/* Contact info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">{t("footer.contact")}</h3>
            <div className="space-y-3 text-sm">
              <a
                href="tel:+213XXXXXXXXX"
                className="flex items-center gap-3 text-muted-foreground transition-colors hover:text-primary"
              >
                <Phone className="h-4 w-4 flex-shrink-0 text-primary" />
                +213 XXX XXX XXX
              </a>
              <a
                href="mailto:info@dragontelecom.dz"
                className="flex items-center gap-3 text-muted-foreground transition-colors hover:text-primary"
              >
                <Mail className="h-4 w-4 flex-shrink-0 text-primary" />
                info@dragontelecom.dz
              </a>
              <div className="flex items-start gap-3 text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <span>Algiers, Algeria</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 text-center">
          <span className="text-xs text-muted-foreground">
            {t("common.legal.copyright", { year: new Date().getFullYear() })}
          </span>
        </div>
      </div>
    </footer>
  );
}
