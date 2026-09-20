import { Box } from "lucide-react";
import { usePublicSettings } from "@/hooks/usePlatform";

// Falls back to the Box icon until a store logo is uploaded (Settings → Store → Logos).
export function Logo({
  size = 32,
  withText = true,
  className = "",
}: {
  size?: number;
  withText?: boolean;
  className?: string;
}) {
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
          className="font-extrabold tracking-tight text-foreground"
          style={{ fontSize: size * 0.55 }}
        >
          Dragon Telecom
        </span>
      )}
    </div>
  );
}
