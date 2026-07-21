import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import type { ReservationDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface ReservationsTableProps {
  data: ReservationDto[];
  isLoading?: boolean;
}

function formatAge(hours: number): string {
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

// ADM-06 Reservations tab — ReservationDto (inventory.dtos.ts): productId/productName/quantity/
// holderType/holderReference/ageHours. No dedicated destination page for orders/repairs exists
// in this set (scope confinement) — the holder chip is a plain badge, not a link.
export function ReservationsTable({ data, isLoading = false }: ReservationsTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<ReservationDto>[]>(
    () => [
      { accessorKey: "productName", header: t("admin.inventory.reservations.table.product") },
      { accessorKey: "quantity", header: t("admin.inventory.reservations.table.quantity") },
      {
        id: "holder",
        header: t("admin.inventory.reservations.table.holder"),
        cell: ({ row }) => (
          <Badge variant="outline">
            {row.original.holderType} {row.original.holderReference}
          </Badge>
        ),
      },
      {
        accessorKey: "ageHours",
        header: t("admin.inventory.reservations.table.age"),
        cell: ({ row }) => formatAge(row.original.ageHours),
      },
    ],
    [t],
  );

  const renderMobileRow = (row: ReservationDto) => (
    <div className="space-y-1 p-4">
      <div className="font-medium">{row.productName}</div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <Badge variant="outline">
          {row.holderType} {row.holderReference}
        </Badge>
        <span>{formatAge(row.ageHours)}</span>
      </div>
    </div>
  );

  if (isLoading) return <TableSkeleton rows={5} columns={4} />;

  return (
    <DataTable
      columns={columns}
      data={data}
      getRowKey={(row) => `${row.productId}-${row.holderReference}`}
      renderMobileRow={renderMobileRow}
      emptyState={
        <EmptyState
          icon={<Clock className="h-6 w-6" />}
          title={t("admin.inventory.reservations.empty")}
          body=""
        />
      }
    />
  );
}
