import { Skeleton } from "@/components/ui/skeleton";

// Sprint 2 placeholder — routing/tsc scaffold only. No hooks, no text. Sprint 4 replaces this
// with the real success-icon/reference/line/fee/total/mode body; Sprint 5 wires the
// `useLocation().state.order` read + the no-state redirect to `/`.
export default function OrderConfirmation() {
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-12 text-center">
      <Skeleton className="mx-auto h-16 w-16 rounded-full" />
      <Skeleton className="mx-auto h-6 w-48" />
      <Skeleton className="mx-auto h-4 w-64" />
      <div className="space-y-2 pt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
