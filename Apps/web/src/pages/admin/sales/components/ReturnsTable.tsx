import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Undo2 } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { Button } from "@/components/ui/button";
import { ReturnType, type ReturnDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";

// Reuses the existing return-dialog type labels (admin.sales.returnDialog.typeRefund/typeExchange)
// rather than declaring new ones — same EXTENSION POINT-adjacent convention SalesTable's own
// STATUS_LABEL_KEY follows for its status column.
const RETURN_TYPE_LABEL_KEY: Record<ReturnType, string> = {
  [ReturnType.REFUND]: "admin.sales.returnDialog.typeRefund",
  [ReturnType.EXCHANGE]: "admin.sales.returnDialog.typeExchange",
};

interface ReturnsTableProps {
  returns?: ReturnDto[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onRowClick?: (item: ReturnDto) => void;
}

// Dumb, props-only — admin-only (S12, mirrors SalesTable's shape). Row click opens
// ReturnDetailDialog, fed entirely from the row's own `lines` (no second fetch, R1).
export function ReturnsTable({
  returns,
  isLoading,
  isError,
  onRetry,
  onRowClick,
}: ReturnsTableProps) {
  const { t, language } = useTranslation();

  const columns = useMemo<ColumnDef<ReturnDto>[]>(
    () => [
      {
        accessorKey: "reference",
        header: t("admin.sales.returnsTable.reference"),
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.reference}</span>,
      },
      {
        accessorKey: "saleReference",
        header: t("admin.sales.returnsTable.saleReference"),
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.saleReference}</span>,
      },
      {
        accessorKey: "returnedAt",
        header: t("admin.sales.returnsTable.date"),
        cell: ({ row }) => formatDateTime(row.original.returnedAt, language),
      },
      {
        id: "client",
        header: t("admin.sales.returnsTable.client"),
        cell: ({ row }) => row.original.posClientName ?? t("staff.sales.table.counter"),
      },
      {
        accessorKey: "staffName",
        header: t("admin.sales.returnsTable.user"),
      },
      {
        accessorKey: "totalQuantity",
        header: t("admin.sales.returnsTable.quantity"),
      },
      {
        accessorKey: "refundAmount",
        header: t("admin.sales.returnsTable.total"),
        cell: ({ row }) => formatDZD(row.original.refundAmount, language),
      },
      {
        accessorKey: "type",
        header: t("admin.sales.returnsTable.type"),
        cell: ({ row }) => t(RETURN_TYPE_LABEL_KEY[row.original.type]),
      },
    ],
    [t, language],
  );

  const renderMobileRow = (item: ReturnDto) => (
    <div className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-medium">{item.reference}</span>
        <span className="font-medium">{formatDZD(item.refundAmount, language)}</span>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{item.posClientName ?? t("staff.sales.table.counter")}</span>
        <span>{formatDateTime(item.returnedAt, language)}</span>
      </div>
    </div>
  );

  if (isLoading) return <TableSkeleton rows={8} columns={8} />;

  if (isError) {
    return (
      <NotFoundState
        title={t("admin.sales.returnsTable.error")}
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
      data={returns ?? []}
      getRowKey={(item) => item.id}
      renderMobileRow={renderMobileRow}
      getRowClassName={onRowClick ? () => "cursor-pointer" : undefined}
      onRowClick={onRowClick}
      emptyState={
        <EmptyState
          icon={<Undo2 className="h-6 w-6" />}
          title={t("admin.sales.returnsTable.empty")}
          body=""
        />
      }
    />
  );
}
