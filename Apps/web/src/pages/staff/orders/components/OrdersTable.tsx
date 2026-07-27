import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ShoppingCart } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { AgeFlag } from "@/components/shared/AgeFlag";
import { Button } from "@/components/ui/button";
import { OrderStatus, type OrderDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";
import { ORDER_STATUS_LABEL_KEY } from "@/pages/staff/orders/order-status-labels";

interface OrdersTableProps {
  orders?: OrderDto[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onRowClick?: (order: OrderDto) => void;
}

// Dumb, props-only (Sprint 4) — Sprint 6 wires useOrdersList(scope, query) around this.
export function OrdersTable({ orders, isLoading, isError, onRetry, onRowClick }: OrdersTableProps) {
  const { t, language } = useTranslation();

  const columns = useMemo<ColumnDef<OrderDto>[]>(
    () => [
      {
        accessorKey: "reference",
        header: t("staff.orders.table.reference"),
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.reference}</span>,
      },
      {
        id: "contact",
        header: t("staff.orders.table.client"),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.contactName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.contactPhone} · {row.original.wilaya?.frName ?? "—"}
            </div>
          </div>
        ),
      },
      {
        id: "productName",
        header: t("staff.orders.table.product"),
        cell: ({ row }) => (
          <span className="line-clamp-2">
            {row.original.lines.map((l) => l.productName).join(", ")}
          </span>
        ),
      },
      {
        id: "quantity",
        header: t("staff.orders.table.quantity"),
        cell: ({ row }) => row.original.lines.reduce((sum, l) => sum + l.quantity, 0),
      },
      {
        accessorKey: "orderType",
        header: t("staff.orders.table.type"),
      },
      {
        accessorKey: "totalAmount",
        header: t("staff.orders.table.total"),
        cell: ({ row }) => formatDZD(row.original.totalAmount, language),
      },
      {
        accessorKey: "status",
        header: t("staff.orders.table.status"),
        cell: ({ row }) => t(ORDER_STATUS_LABEL_KEY[row.original.status]),
      },
      {
        accessorKey: "placedAt",
        header: t("staff.orders.table.date"),
        cell: ({ row }) => formatDateTime(row.original.placedAt, language),
      },
      {
        id: "age",
        header: t("staff.orders.table.age"),
        cell: ({ row }) =>
          row.original.status === OrderStatus.PENDING ? (
            <AgeFlag since={row.original.placedAt} thresholdHours={24} />
          ) : null,
      },
    ],
    [t, language],
  );

  const renderMobileRow = (order: OrderDto) => (
    <div className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-medium">{order.reference}</span>
        <span className="font-medium">{formatDZD(order.totalAmount, language)}</span>
      </div>
      <div className="text-sm">
        <div className="font-medium">{order.contactName}</div>
        <div className="text-muted-foreground">{order.contactPhone}</div>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{order.lines.map((l) => l.productName).join(", ")}</span>
        <span>{t(ORDER_STATUS_LABEL_KEY[order.status])}</span>
      </div>
      {order.status === OrderStatus.PENDING && (
        <AgeFlag since={order.placedAt} thresholdHours={24} />
      )}
    </div>
  );

  if (isLoading) return <TableSkeleton rows={8} columns={9} />;

  if (isError) {
    return (
      <NotFoundState
        title={t("staff.orders.table.error")}
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
      data={orders ?? []}
      getRowKey={(order) => order.id}
      renderMobileRow={renderMobileRow}
      getRowClassName={onRowClick ? () => "cursor-pointer" : undefined}
      onRowClick={onRowClick}
      emptyState={
        <EmptyState
          icon={<ShoppingCart className="h-6 w-6" />}
          title={t("staff.orders.table.empty")}
          body=""
        />
      }
    />
  );
}
