import { Skeleton } from "@/components/ui/skeleton";

// Sprint 2 placeholder — routing/tsc scaffold only. No hooks, no text. Sprint 4 replaces this
// with the real StaffProductFilters + TableSkeleton shape; Sprint 6 wires useStaffProducts()
// + the cascading taxonomy filters + useSendStaffSearch().
export default function StaffProducts() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>
      <div className="rounded-2xl border border-border">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border p-4 last:border-0">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
