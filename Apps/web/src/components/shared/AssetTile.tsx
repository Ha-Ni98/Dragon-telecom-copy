import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// S39 — the ONE light tile behind every transparent asset (brand logos, family icons, the store
// logo, product photos), in both themes. No per-brand override and no admin control exist or
// should be added: the tile is what guarantees no logo can disappear, and a newly added brand
// cannot break. The border keeps the tile's edge visible on a white page in light mode. Children
// are typically an <img object-contain> or a fallback that inherits text-asset-tile-foreground.
export function AssetTile({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-xl border border-border bg-asset-tile text-asset-tile-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
