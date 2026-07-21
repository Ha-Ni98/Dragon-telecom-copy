import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { Button } from "@/components/ui/button";
import { StatusPill, type BadgeTone } from "@/components/shared/StatusBadge";
import { ClipboardList } from "lucide-react";
import { MovementDirection, type MovementDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface MovementLedgerTableProps {
  data: MovementDto[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

const DIRECTION_TONE: Record<MovementDirection, BadgeTone> = {
  [MovementDirection.IN]: "success",
  [MovementDirection.OUT]: "destructive",
  [MovementDirection.PENDING]: "warning",
};

// Reference links to the movement's source document — the plan's own scope confinement notes
// no destination pages are built here beyond the ones this set already owns, so only the
// staff-searches route (also this set) is linked; everything else renders as plain text.
function referenceCell(movement: MovementDto) {
  if (movement.referenceType === "STAFF_SEARCH") {
    return (
      <Link to="/admin/activity/staff-searches" className="text-primary hover:underline">
        {movement.referenceLabel}
      </Link>
    );
  }
  return <span>{movement.referenceLabel}</span>;
}

// ADM-06 Movement ledger tab — MovementDto (inventory.dtos.ts). `type` is a closed enum with 11
// members (SUPPLIER_INVOICE/INITIAL_STOCK/ADJUSTMENT_IN/.../PENDING_RELEASE) — rendered as its
// raw value rather than 11 new translation keys, matching `referenceType`'s own "open string,
// not a fabricated union" contract convention.
export function MovementLedgerTable({
  data,
  isLoading = false,
  isError = false,
  onRetry,
}: MovementLedgerTableProps) {
  const { t, language } = useTranslation();

  const columns = useMemo<ColumnDef<MovementDto>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: t("admin.inventory.movements.table.date"),
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(language),
      },
      { accessorKey: "productName", header: t("admin.inventory.movements.table.product") },
      {
        accessorKey: "direction",
        header: t("admin.inventory.movements.table.type"),
        cell: ({ row }) => (
          <StatusPill tone={DIRECTION_TONE[row.original.direction]} label={row.original.type} />
        ),
      },
      {
        accessorKey: "quantity",
        header: t("admin.inventory.movements.table.quantity"),
        cell: ({ row }) =>
          row.original.direction === "OUT"
            ? `-${Math.abs(row.original.quantity)}`
            : row.original.quantity,
      },
      {
        id: "cogsProfit",
        header: t("admin.inventory.movements.table.cogs"),
        cell: ({ row }) =>
          row.original.costOfGoods !== undefined ? (
            <span>
              {row.original.costOfGoods.toLocaleString()} /{" "}
              {row.original.profit?.toLocaleString() ?? "-"}
            </span>
          ) : (
            "-"
          ),
      },
      {
        id: "reference",
        header: t("admin.inventory.movements.table.reference"),
        cell: ({ row }) => referenceCell(row.original),
      },
      { accessorKey: "staffName", header: t("admin.inventory.movements.table.staff") },
    ],
    [t, language],
  );

  const renderMobileRow = (row: MovementDto) => (
    <div className="space-y-1 p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium">{row.productName}</span>
        <StatusPill tone={DIRECTION_TONE[row.direction]} label={row.type} />
      </div>
      <div className="text-sm text-muted-foreground">
        {row.quantity} · {referenceCell(row)}
      </div>
    </div>
  );

  if (isLoading) return <TableSkeleton rows={6} columns={7} />;

  if (isError) {
    return (
      <NotFoundState
        title={t("admin.inventory.error")}
        body=""
        action={
          onRetry && (
            <Button variant="outline" onClick={onRetry}>
              {t("common.actions.tryAgain")}
            </Button>
          )
        }
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      getRowKey={(row) => row.id}
      renderMobileRow={renderMobileRow}
      emptyState={
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title={t("admin.inventory.movements.empty")}
          body=""
        />
      }
    />
  );
}
