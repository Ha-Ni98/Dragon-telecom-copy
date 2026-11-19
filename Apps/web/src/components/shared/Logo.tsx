import { Box } from "lucide-react";
import { usePublicSettings } from "@/hooks/usePlatform";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

// Falls back to the Box icon until a store logo is uploaded (Settings → Store → Logos).
// S38 — the wordmark is the store name from settings (one source of truth, shared with the
// document title and the footer); "Dragon Telecom" (common.brand.pageTitle) only until it is set.
export function Logo({
  size = 32,
  withText = true,
  className = "",
  textClassName,
}: {
  size?: number;
  withText?: boolean;
  className?: string;
  /** S37 — lets the storefront header hide the wordmark on very narrow phones (mark only). */
  textClassName?: string;
}) {
  const { t } = useTranslation();
  const { data: settings } = usePublicSettings();
  const logoUrl = settings?.store.logoUrl;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={settings?.store.name ?? ""}
          style={{ height: size, maxWidth: size * 3 }}
          className="w-auto object-contain"
        />
      ) : (
        <Box style={{ width: size, height: size }} className="text-primary" />
      )}
      {withText && (
        <span
          className={cn("font-extrabold tracking-tight text-foreground", textClassName)}
          style={{ fontSize: size * 0.55 }}
        >
          {settings?.store.name || t("common.brand.pageTitle")}
        </span>
      )}
    </div>
  );
}
