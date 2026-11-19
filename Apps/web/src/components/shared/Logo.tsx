import { Box } from "lucide-react";
import { usePublicSettings } from "@/hooks/usePlatform";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { AssetTile } from "@/components/shared/AssetTile";

// Falls back to the Box icon until a store logo is uploaded (Settings → Store → Logos).
// S38 — the wordmark is the store name from settings (one source of truth, shared with the
// document title and the footer); "Dragon Telecom" (common.brand.pageTitle) only until it is set.
// S39 — the uploaded logo sits on the light asset tile in every theme and every header (storefront
// and back-office): a dark transparent logo would otherwise vanish on a dark header.
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
        <AssetTile className="rounded-md p-1">
          <img
            src={logoUrl}
            alt={settings?.store.name ?? ""}
            // The tile adds 4px padding + 2px border each side: keep the overall height at `size`.
            style={{ height: size - 10, maxWidth: size * 3 }}
            className="w-auto object-contain"
          />
        </AssetTile>
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
