import { Skeleton } from "@/components/ui/skeleton";

// Sprint 2 placeholder — routing/tsc scaffold only. No hooks, no text. Sprint 4 replaces this
// with the real per-widget skeletons (StatCardSkeleton ×2, drafts list, pending-orders,
// low-stock); Sprint 6 wires useStaffDashboard() + usePermissions() widget gating.
export default function StaffDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}
