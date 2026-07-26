import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Shape-matched to OrderCard.tsx's real layout (header: reference + status badge, date/type/
// product row; content: price summary + action row) so resolving from loading never shifts
// layout.
export function OrderCardSkeleton() {
  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="space-y-2 text-right">
            <Skeleton className="ml-auto h-5 w-20" />
            <Skeleton className="ml-auto h-5 w-16 rounded-full" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <div className="flex items-center justify-between border-t pt-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}
