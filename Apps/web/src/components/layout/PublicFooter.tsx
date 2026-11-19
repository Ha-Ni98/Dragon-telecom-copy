import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Facebook, Instagram, MessageCircle } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { TikTokIcon } from "@/components/shared/icons/TikTokIcon";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTranslation } from "@/hooks/useTranslation";
import { usePublicSettings } from "@/hooks/usePlatform";
import { mailtoHref, telHref, whatsappHref } from "@/lib/contact-links";

// One contact line. 44px-high tap target (the footer is the phone user's way to call or message
// the shop), and the text wraps anywhere so a long email or address can never push the page wider
// than a 320px viewport (S37's overflow rule).
function ContactRow({
  icon,
  href,
  external = false,
  children,
}: {
  icon: ReactNode;
  href?: string;
  external?: boolean;
  children: ReactNode;
}) {
  const className =
    "flex min-h-11 items-center gap-3 py-1 text-muted-foreground transition-colors hover:text-primary";
  const body = (
    <>
      <span className="shrink-0 text-primary">{icon}</span>
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </>
  );
  if (!href) return <div className={className}>{body}</div>;
  return (
    <a
      href={href}
      className={className}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {body}
    </a>
  );
}

// S38 — the footer reads the shop's contact details from settings (GET /settings/public), so the
// owner changes them without a deploy. This deliberately REVERSES the earlier Stage-00 rule that
// "the storefront footer is front-end static". Every item renders only when it is set — while
// settings load, or when a field is empty, the footer shows no placeholder number or email.
// tel: / wa.me / mailto: links work on desktop as well as phones (the set: "tappable … on mobile
// and desktop alike"); wa.me and the social links open in a new tab.
export function PublicFooter() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { data: settings } = usePublicSettings();
  const store = settings?.store;

  // P13 — S26.1's fallbacks: repairs falls back to `phone`, sales falls back to `phone`; when both
  // resolve to the same number it is shown once as "Phone".
  const repair = store?.repairPhone || store?.phone;
  const sales = store?.salesPhone || store?.phone;
  const phones =
    repair && repair === sales
      ? [{ labelKey: "footer.phone", number: repair }]
      : [
          ...(repair ? [{ labelKey: "footer.repairPhone", number: repair }] : []),
          ...(sales ? [{ labelKey: "footer.salesPhone", number: sales }] : []),
        ];
  const whatsapp = store?.whatsappPhone ? whatsappHref(store.whatsappPhone) : null;

  const socials = [
    {
      url: store?.facebookUrl,
      labelKey: "footer.social.facebook",
      icon: <Facebook className="h-4 w-4" />,
    },
    {
      url: store?.instagramUrl,
      labelKey: "footer.social.instagram",
      icon: <Instagram className="h-4 w-4" />,
    },
    {
      url: store?.tiktokUrl,
      labelKey: "footer.social.tiktok",
      icon: <TikTokIcon className="h-4 w-4" />,
    },
  ].filter((social): social is typeof social & { url: string } => !!social.url);

  const hasContact = !!store?.address || phones.length > 0 || !!whatsapp || !!store?.email;

  return (
    <footer className="mt-16 border-t border-border bg-surface" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[2fr_1fr_1fr]">
          {/* Company info */}
          <div className="min-w-0 space-y-4">
            <Logo size={32} />
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t("footer.description")}
            </p>
            {socials.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {socials.map((social) => (
                  <Button
                    key={social.labelKey}
                    asChild
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                  >
                    <a
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t(social.labelKey)}
                    >
                      {social.icon}
                    </a>
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="min-w-0 space-y-4">
            <h3 className="font-semibold text-foreground">{t("footer.quickLinks")}</h3>
            <nav aria-label="Quick navigation">
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    to="/"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("header.home")}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/products"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("header.products")}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/orders"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("orders.title")}
                  </Link>
                </li>
                <li>
                  {isAuthenticated ? (
                    <Link
                      to="/my-account"
                      className="text-muted-foreground transition-colors hover:text-primary"
                    >
                      {t("header.account")}
                    </Link>
                  ) : (
                    <Link
                      to="/login"
                      className="text-muted-foreground transition-colors hover:text-primary"
                    >
                      {t("header.login")}
                    </Link>
                  )}
                </li>
              </ul>
            </nav>
          </div>

          {/* Contact info — settings-driven, each row only when set */}
          {hasContact && (
            <div className="min-w-0 space-y-4">
              <h3 className="font-semibold text-foreground">{t("footer.contact")}</h3>
              <div className="text-sm">
                {store?.address && (
                  <ContactRow icon={<MapPin className="h-4 w-4" />}>{store.address}</ContactRow>
                )}
                {phones.map((phone) => (
                  <ContactRow
                    key={phone.labelKey}
                    icon={<Phone className="h-4 w-4" />}
                    href={telHref(phone.number)}
                  >
                    {t(phone.labelKey)} · {phone.number}
                  </ContactRow>
                ))}
                {whatsapp && store?.whatsappPhone && (
                  <ContactRow icon={<MessageCircle className="h-4 w-4" />} href={whatsapp} external>
                    {t("footer.whatsapp")} · {store.whatsappPhone}
                  </ContactRow>
                )}
                {store?.email && (
                  <ContactRow icon={<Mail className="h-4 w-4" />} href={mailtoHref(store.email)}>
                    {store.email}
                  </ContactRow>
                )}
              </div>
            </div>
          )}
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
