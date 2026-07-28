import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/useTranslation";
import { OrderStatus, orderTransitionsFrom, type OrderDto } from "@dragon-telecom/contract";
import { ORDER_STATUS_LABEL_KEY } from "@/lib/order-status-labels";

interface OrderActionsMenuProps {
  order: OrderDto;
  /** target === RETURNED on a COMPLETED order means the admin return document (S10/R1), not a
   * machine transition — the caller routes it to ReturnOrderDialog. Every other target routes to
   * OrderStatusDialog (forward moves, IN_DELIVERY -> RETURNED) or AdminCancelOrderDialog
   * (CANCELLED). */
  onAction: (order: OrderDto, target: OrderStatus) => void;
}

// S11 — the one place the legal-action list is computed for the admin orders table. Built from
// S10's contract constants (orderTransitionsFrom), never a hand-written list, plus two additions
// the machine itself doesn't encode: CANCELLED (offered whenever order.canBeCancelled, since the
// machine omits it as a target of IN_DELIVERY even though cancelOrder accepts it there — F3, kept
// consistent with OrderShowDialog's own Cancel button) and RETURNED on a COMPLETED order (the
// admin return *document* action, S10/R1 — orderTransitionsFrom returns [] for a terminal status).
export function OrderActionsMenu({ order, onAction }: OrderActionsMenuProps) {
  const { t } = useTranslation();

  const targets: OrderStatus[] = [...orderTransitionsFrom(order.orderType, order.status)];
  if (order.canBeCancelled && !targets.includes(OrderStatus.CANCELLED)) {
    targets.push(OrderStatus.CANCELLED);
  }
  if (order.status === OrderStatus.COMPLETED && !targets.includes(OrderStatus.RETURNED)) {
    targets.push(OrderStatus.RETURNED);
  }

  if (targets.length === 0) return null;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={t("admin.orders.table.actionsAria")}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {targets.map((target) => (
            <DropdownMenuItem
              key={target}
              onSelect={() => onAction(order, target)}
              className={target === OrderStatus.CANCELLED ? "text-destructive" : undefined}
            >
              {target === OrderStatus.RETURNED && order.status === OrderStatus.COMPLETED
                ? t("admin.orders.returnDialog.title")
                : t(ORDER_STATUS_LABEL_KEY[target])}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
