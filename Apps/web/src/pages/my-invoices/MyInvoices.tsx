import { Skeleton } from "@/components/ui/skeleton";

// Sprint 2 placeholder — routing/tsc scaffold only. No hooks, no text. Sprint 4 replaces this
// with the real TableSkeleton-backed DataTable shape; Sprint 5 wires useMyInvoices/
// useMyInvoice/useMyInvoicePdf.
export default function MyInvoices() {
  return (
    <div className="mx-auto max-w-5xl space-y-3 px-4 py-8">
      <Skeleton className="h-8 w-48" />
      <div className="rounded-2xl border border-border">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border p-4 last:border-0">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
