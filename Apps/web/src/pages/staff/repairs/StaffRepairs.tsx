import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  scope?: "staff" | "admin";
}

// Placeholder shell (Sprint 2 — routing/tsc only). Pure Skeleton markup, no hooks, no text —
// Sprint 4 adds the real kanban board/intake/ticket-detail primitives, Sprint 7 wires them.
export default function StaffRepairs({ scope: _scope = "staff" }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }, (_, col) => (
        <div key={col} className="space-y-3">
          <Skeleton className="h-6 w-24" />
          {Array.from({ length: 3 }, (_, card) => (
            <Skeleton key={card} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ))}
    </div>
  );
}
