import { Box } from "lucide-react";

// EXTENSION POINT (branding): swap this icon + wordmark for your app's logo asset.
export function Logo({ size = 32, withText = true, className = "" }: { size?: number; withText?: boolean; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Box style={{ width: size, height: size }} className="text-primary" />
      {withText && (
        <span className="font-extrabold tracking-tight text-foreground" style={{ fontSize: size * 0.55 }}>
          Dragon Telecom
        </span>
      )}
    </div>
  );
}
