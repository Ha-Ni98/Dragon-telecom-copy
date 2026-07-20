import { StatCardSkeleton } from "@/components/shared/StatCardSkeleton";
import { TableSkeleton } from "@/components/shared/TableSkeleton";

interface Props {
  scope?: "staff" | "admin";
}

// Placeholder shell (Sprint 2 — routing/tsc only). Pure Skeleton markup, no hooks, no text.
// The existing AdminOrders.tsx (Sub-01, admin/orders) is untouched here — Sprint 6 rewires it
// off the stub hooks; this file is the new STF-04 tree, wired in the same sprint.
export default function StaffOrders({ scope: _scope = "staff" }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <TableSkeleton rows={8} columns={9} />
    </div>
  );
}
