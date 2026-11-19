import { Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { FamilyDto } from "@dragon-telecom/contract";

interface FamilyQuickPickGridProps {
  families?: FamilyDto[];
  isLoading?: boolean;
  onSelect: (family: FamilyDto) => void;
}

// Dumb, props-only (Sprint 4) — the left-pane quick-pick grid (STF-02 §UI). Sprint 7 wires
// useCatalogFamilies() around this and treats a click as a family-filter on the product search.
export function FamilyQuickPickGrid({ families, isLoading, onSelect }: FamilyQuickPickGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {(families ?? []).map((family) => (
        <button
          key={family.id}
          type="button"
          onClick={() => onSelect(family)}
          className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3 text-center hover:ring-2 hover:ring-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
        >
          <Package className="h-5 w-5 text-primary" />
          <span className="truncate text-xs font-medium">{family.name}</span>
        </button>
      ))}
    </div>
  );
}
