import type { Commune, Order, Prisma, Wilaya } from '@prisma/client';
import {
  OrderResponseSchema,
  OrderStatsResponseSchema,
  OrderStatus,
  OrderType,
  type OrderDto,
  type OrderStatsDto,
  type PlaceOrderCommand,
} from '@dragon-telecom/contract';

type Money = Prisma.Decimal | number;

// wilaya/commune are joined only for delivery orders — Order.wilayaId/communeId are null for
// PICKUP (plan §I.1: "wilaya/commune present only for delivery orders").
export type OrderRow = Order & {
  wilaya: Pick<Wilaya, 'id' | 'frName' | 'arName'> | null;
  commune: Pick<Commune, 'id' | 'frName' | 'arName'> | null;
};

export type OrderDtoContext = { includeMargins: boolean; now?: Date };

// Server-resolved values the service computes before persistence (viewer price, fee,
// productName snapshot, sequence-allocated reference, resolved auth clientId) — the mapper
// never re-derives any of these itself (plan §I.1).
export type PlaceOrderContext = {
  reference: string;
  productName: string;
  resolvedPrice: number;
  fee: number;
  clientId: string | null;
};

export class OrdersMapper {
  static toOrderDto(order: OrderRow, ctx: OrderDtoContext): OrderDto {
    const now = ctx.now ?? new Date();
    const serialNumbers = OrdersMapper.parseSerials(order.serialNumbers);
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
      productId: order.productId,
      productName: order.productNameSnapshot,
      quantity: order.quantity,
      resolvedPrice: OrdersMapper.toMoney(order.resolvedPrice),
      unitPrice: OrdersMapper.toMoney(order.unitPrice),
      ...(serialNumbers != null ? { serialNumbers } : {}),
      subtotal: OrdersMapper.toMoney(order.subtotal),
      deliveryFee: OrdersMapper.toMoney(order.deliveryFee),
      totalAmount: OrdersMapper.toMoney(order.totalAmount),
      paidAmount: OrdersMapper.toMoney(order.paidAmount),
      // Margin-gated (plan §I.1/§D-3): staff mapping strips these, admin keeps them. Both
      // columns are nullable (unset until confirm) *and* the DTO fields are .optional() —
      // omission is correct in both the staff-gated case and the pre-confirm case.
      ...(ctx.includeMargins && order.costOfGoods != null ? { costOfGoods: OrdersMapper.toMoney(order.costOfGoods) } : {}),
      ...(ctx.includeMargins && order.profit != null ? { profit: OrdersMapper.toMoney(order.profit) } : {}),
      placedAt: order.placedAt.toISOString(),
      ...(order.confirmedAt != null ? { confirmedAt: order.confirmedAt.toISOString() } : {}),
      ...(order.deliveredAt != null ? { deliveredAt: order.deliveredAt.toISOString() } : {}),
      ...(order.cancelledAt != null ? { cancelledAt: order.cancelledAt.toISOString() } : {}),
      // Client rule (spec BL#2): own + PENDING only.
      canBeCancelled: order.status === OrderStatus.PENDING,
      ageHours: OrdersMapper.ageHours(order.placedAt, now),
    };
    return OrderResponseSchema.parse(dto);
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
      returned: counts[OrderStatus.RETURNED] ?? 0,
    };
    return OrderStatsResponseSchema.parse(dto);
  }

  // PENDING order, resolvedPrice frozen equal to unitPrice at placement (plan §I.1 BL#1) —
  // unitPrice only diverges from resolvedPrice later, at confirm, if staff adjusts it.
  static toPersistencePlace(cmd: PlaceOrderCommand, ctx: PlaceOrderContext): Prisma.OrderUncheckedCreateInput {
    const isDelivery = cmd.orderType !== OrderType.PICKUP;
    const subtotal = ctx.resolvedPrice * cmd.quantity;
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
      productId: cmd.productId,
      productNameSnapshot: ctx.productName,
      quantity: cmd.quantity,
      resolvedPrice: ctx.resolvedPrice,
      unitPrice: ctx.resolvedPrice,
      subtotal,
      deliveryFee: ctx.fee,
      totalAmount: subtotal + ctx.fee,
      paidAmount: 0,
    };
  }

  static ageHours(since: Date, now: Date = new Date()): number {
    return (now.getTime() - since.getTime()) / 3_600_000;
  }

  private static toMoney(value: Money): number {
    return typeof value === 'number' ? value : value.toNumber();
  }

  // Order.serialNumbers is free-text (entered at confirmation, spec); the contract wants an
  // array — same comma-join/split convention sales established for SaleLine.serialNumbers.
  private static parseSerials(value: string | null): string[] | undefined {
    return value != null && value.length > 0 ? value.split(',') : undefined;
  }
}
