import type { Commune, Order, OrderLine, Prisma, Wilaya } from '@prisma/client';
import {
  OrderResponseSchema,
  OrderStatsResponseSchema,
  OrderStatus,
  OrderType,
  isOrderStatusTerminal,
  type OrderDto,
  type OrderLineDto,
  type OrderStatsDto,
  type PlaceOrderCommand,
} from '@dragon-telecom/contract';

type Money = Prisma.Decimal | number;

// wilaya/commune are joined only for delivery orders — Order.wilayaId/communeId are null for
// PICKUP (plan §I.1: "wilaya/commune present only for delivery orders"). D1 (S9) — lines is the
// order's OrderLine rows, ordered stably by id (orders.service.ts's ORDER_INCLUDE).
export type OrderRow = Order & {
  wilaya: Pick<Wilaya, 'id' | 'frName' | 'arName'> | null;
  commune: Pick<Commune, 'id' | 'frName' | 'arName'> | null;
  lines: OrderLine[];
};

export type OrderDtoContext = { includeMargins: boolean; now?: Date };

// Server-resolved values the service computes before persistence (viewer prices, fee,
// sequence-allocated reference, resolved auth clientId) — the mapper never re-derives any of
// this itself (plan §I.1). D1 (S9) — one entry per placed line.
export type PlaceOrderContext = {
  reference: string;
  lines: { productId: string; productName: string; resolvedPrice: number; quantity: number }[];
  fee: number;
  clientId: string | null;
};

export class OrdersMapper {
  static toOrderDto(order: OrderRow, ctx: OrderDtoContext): OrderDto {
    const now = ctx.now ?? new Date();
    const dto: OrderDto = {
      id: order.id,
      reference: order.reference,
      // Prisma's generated $Enums.OrderStatus/OrderType and the contract's enums are distinct
      // nominal types with identical string values (schema.prisma's own invariant, same cast
      // used by sales/purchasing mappers).
      status: order.status as OrderStatus,
      orderType: order.orderType as OrderType,
      contactName: order.contactName,
      contactPhone: order.contactPhone,
      ...(order.wilaya != null
        ? { wilaya: { id: order.wilaya.id, frName: order.wilaya.frName, arName: order.wilaya.arName } }
        : {}),
      ...(order.commune != null
        ? { commune: { id: order.commune.id, frName: order.commune.frName, arName: order.commune.arName } }
        : {}),
      ...(order.address != null ? { address: order.address } : {}),
      ...(order.deliveryCompany != null ? { deliveryCompany: order.deliveryCompany } : {}),
      ...(order.trackingNumber != null ? { trackingNumber: order.trackingNumber } : {}),
      lines: order.lines.map((line) => OrdersMapper.toLineDto(line, ctx)),
      subtotal: OrdersMapper.toMoney(order.subtotal),
      deliveryFee: OrdersMapper.toMoney(order.deliveryFee),
      totalAmount: OrdersMapper.toMoney(order.totalAmount),
      paidAmount: OrdersMapper.toMoney(order.paidAmount),
      // Margin-gated (plan §I.1/§D-3): staff mapping strips these, admin keeps them. Both
      // columns are nullable (unset until COMPLETED, D2/S10) *and* the DTO fields are
      // .optional() — omission is correct in both the staff-gated case and the pre-completion case.
      ...(ctx.includeMargins && order.totalCost != null ? { totalCost: OrdersMapper.toMoney(order.totalCost) } : {}),
      ...(ctx.includeMargins && order.totalProfit != null ? { totalProfit: OrdersMapper.toMoney(order.totalProfit) } : {}),
      placedAt: order.placedAt.toISOString(),
      ...(order.confirmedAt != null ? { confirmedAt: order.confirmedAt.toISOString() } : {}),
      ...(order.deliveredAt != null ? { deliveredAt: order.deliveredAt.toISOString() } : {}),
      ...(order.cancelledAt != null ? { cancelledAt: order.cancelledAt.toISOString() } : {}),
      // D4/R4 (S10) — any non-terminal order is cancellable by its client (COMPLETED is terminal
      // too, so it's already excluded). Was "own + PENDING only" (spec BL#2) before this set.
      canBeCancelled: !isOrderStatusTerminal(order.status as OrderStatus),
      ageHours: OrdersMapper.ageHours(order.placedAt, now),
    };
    return OrderResponseSchema.parse(dto);
  }

  // D1 (S9) — one line per OrderLine row. Same margin gate and serial-number convention the
  // order-level fields used before this set (plan §I.1/§D-3).
  private static toLineDto(line: OrderLine, ctx: OrderDtoContext): OrderLineDto {
    const serialNumbers = OrdersMapper.parseSerials(line.serialNumbers);
    return {
      id: line.id,
      productId: line.productId,
      productName: line.productNameSnapshot,
      quantity: line.quantity,
      resolvedPrice: OrdersMapper.toMoney(line.resolvedPrice),
      unitPrice: OrdersMapper.toMoney(line.unitPrice),
      ...(serialNumbers != null ? { serialNumbers } : {}),
      ...(ctx.includeMargins && line.costOfGoods != null ? { costOfGoods: OrdersMapper.toMoney(line.costOfGoods) } : {}),
      ...(ctx.includeMargins && line.profit != null ? { profit: OrdersMapper.toMoney(line.profit) } : {}),
      lineTotal: OrdersMapper.toMoney(line.lineTotal),
    };
  }

  // groupBy-style counts keyed by OrderStatus — missing statuses (no rows yet) default to 0
  // rather than being absent, since every OrderStatsDto field is a required `.min(0)` int.
  static toStatsDto(counts: Partial<Record<OrderStatus, number>>): OrderStatsDto {
    const dto: OrderStatsDto = {
      pending: counts[OrderStatus.PENDING] ?? 0,
      confirmed: counts[OrderStatus.CONFIRMED] ?? 0,
      packaged: counts[OrderStatus.PACKAGED] ?? 0,
      inDelivery: counts[OrderStatus.IN_DELIVERY] ?? 0,
      completed: counts[OrderStatus.COMPLETED] ?? 0,
      cancelled: counts[OrderStatus.CANCELLED] ?? 0,
      cancelledByClient: counts[OrderStatus.CANCELLED_BY_CLIENT] ?? 0,
      returned: counts[OrderStatus.RETURNED] ?? 0,
    };
    return OrderStatsResponseSchema.parse(dto);
  }

  // PENDING order, each line's resolvedPrice frozen equal to unitPrice at placement (plan §I.1
  // BL#1) — unitPrice only diverges from resolvedPrice later (D11/S10) if staff adjusts it.
  static toPersistencePlace(cmd: PlaceOrderCommand, ctx: PlaceOrderContext): Prisma.OrderUncheckedCreateInput {
    const isDelivery = cmd.orderType !== OrderType.PICKUP;
    const subtotal = ctx.lines.reduce((sum, line) => sum + line.resolvedPrice * line.quantity, 0);
    return {
      reference: ctx.reference,
      clientId: ctx.clientId,
      status: OrderStatus.PENDING,
      orderType: cmd.orderType,
      contactName: cmd.contact.fullName,
      contactPhone: cmd.contact.phone,
      ...(isDelivery && cmd.delivery != null
        ? {
            wilayaId: cmd.delivery.wilayaId,
            communeId: cmd.delivery.communeId,
            ...(cmd.delivery.address != null ? { address: cmd.delivery.address } : {}),
          }
        : {}),
      subtotal,
      deliveryFee: ctx.fee,
      totalAmount: subtotal + ctx.fee,
      paidAmount: 0,
      lines: {
        create: ctx.lines.map((line) => ({
          productId: line.productId,
          productNameSnapshot: line.productName,
          quantity: line.quantity,
          resolvedPrice: line.resolvedPrice,
          unitPrice: line.resolvedPrice, // frozen equal at placement (BL#1)
          lineTotal: line.resolvedPrice * line.quantity,
        })),
      },
    };
  }

  static ageHours(since: Date, now: Date = new Date()): number {
    return (now.getTime() - since.getTime()) / 3_600_000;
  }

  private static toMoney(value: Money): number {
    return typeof value === 'number' ? value : value.toNumber();
  }

  // OrderLine.serialNumbers is free-text (entered at confirmation, spec); the contract wants an
  // array — same comma-join/split convention sales established for SaleLine.serialNumbers.
  private static parseSerials(value: string | null): string[] | undefined {
    return value != null && value.length > 0 ? value.split(',') : undefined;
  }
}
