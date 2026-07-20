import { Skeleton } from "@/components/ui/skeleton";

// Sprint 2 placeholder — routing/tsc scaffold only. No hooks, no text (nothing to translate
// yet), no real shape. Sprint 4 replaces this with the real shape-matched CartItemRow skeleton
// list; Sprint 5 wires useClientCart().
export default function Cart() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl border border-border p-4">
          <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/4" />
          </div>
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
