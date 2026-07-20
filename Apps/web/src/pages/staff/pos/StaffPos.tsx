import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  /** Admin mounts this same tree unscoped (ADM-05 — "the exact STF-02 component, mounted
   * unscoped"); everything below reads this to decide staff-self vs all-staff data + actions. */
  scope?: "staff" | "admin";
}

// Placeholder shell (Sprint 2 — routing/tsc only). Pure Skeleton markup, no hooks, no text —
// Sprint 4 replaces this with the real two-pane primitives (search + ticket), Sprint 7 wires them.
export default function StaffPos({ scope: _scope = "staff" }: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
      <div className="space-y-4">
        <Skeleton className="h-11 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}
