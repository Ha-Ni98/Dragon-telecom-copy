import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  InvoiceSource as PrismaInvoiceSource,
  MovementDirection as PrismaMovementDirection,
  OrderStatus as PrismaOrderStatus,
  UserType as PrismaUserType,
} from '@prisma/client';
import {
  DocType,
  MovementType,
  OrderResponseSchema,
  OrderStatus,
  OrderType,
  UserType,
  paginated,
  type BackofficeOrdersQuery,
  type BillingEvents,
  type ConfirmOrderCommand,
  type JWTPayload,
  type MyOrdersQuery,
  type OrderDto,
  type OrderStatsDto,
  type PaginatedResult,
  type PlaceOrderCommand,
  type ReturnOrderCommand,
  type UpdateOrderStatusCommand,
} from '@dragon-telecom/contract';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@common/errors';
import { eventBus } from '@common/events/event-bus';
import { hashPassword } from '@common/utils/password.utils';
import type { ConsumptionLine, IInventoryService } from '../inventory/inventory.interface';
import type { IDeliveryFeeService, ISequenceService } from '../platform/platform.interface';
import type { CancelOrderCommand, ICatalogViewerPricingPort, IOrdersService } from './orders.interface';
import { OrdersMapper } from './orders.mapper';

const ORDER_INCLUDE = {
  wilaya: { select: { id: true, frName: true, arName: true } },
  commune: { select: { id: true, frName: true, arName: true } },
} satisfies Prisma.OrderInclude;

// Forward-only machine up to COMPLETED (spec BL#4) — CANCELLED/RETURNED are terminal states
// reached only through their own dedicated methods, never through updateStatus.
const STATUS_SEQUENCE: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PACKAGED,
  OrderStatus.IN_DELIVERY,
  OrderStatus.COMPLETED,
];

export class OrdersService implements IOrdersService {
  // Lazily resolved once per process and cached — see resolveSystemStaffId below.
  private systemStaffId?: string;
  private static readonly SYSTEM_USERNAME = 'system.storefront';

  constructor(
    private prisma: PrismaClient,
    private deliveryFee: IDeliveryFeeService,
    private inventory: IInventoryService,
    private sequence: ISequenceService,
    private catalogPricing: ICatalogViewerPricingPort,
  ) {}

  // public|client — actor absent for a guest (plan §I.1 BL#1, §D-2).
  async placeOrder(cmd: PlaceOrderCommand, actor?: JWTPayload): Promise<OrderDto> {
    const isPickup = cmd.orderType === OrderType.PICKUP;

    if (isPickup && actor?.clientId == null) {
      throw new BadRequestError('PICKUP requires an authenticated client');
    }
    // Never trust the body's clientId over the token's (an authed placement's clientId must
    // match; a guest forces clientId=null regardless of what the body carries).
    if (actor?.clientId != null && cmd.clientId != null && cmd.clientId !== actor.clientId) {
      throw new ForbiddenError();
    }
    const clientId = actor?.clientId ?? null;

    const [priced] = await this.catalogPricing.getCartProducts([cmd.productId], actor);
    if (!priced) throw new NotFoundError('Product');
    if (priced.priceHidden || priced.currentPrice == null) {
      throw new ForbiddenError('GUEST_PRICE_HIDDEN');
    }
    const resolvedPrice = priced.currentPrice;

    // cmd.delivery is guaranteed present here by PlaceOrderSchema's own refinement (required
    // unless PICKUP) — zod's refine can't narrow the TS type, same `!`-on-a-route-guaranteed-
    // field precedent as sales.service.ts's `actor.staffId!`.
    const fee = isPickup
      ? 0
      : await this.deliveryFee.resolve(
          cmd.delivery!.wilayaId,
          cmd.delivery!.communeId,
          cmd.orderType === OrderType.DELIVERY_HOME ? 'home' : 'office',
        );

    const staffId = await this.movementStaffId(actor);

    let capturedTx: Prisma.TransactionClient | undefined;
    let orderId = '';

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      const reference = await this.sequence.nextNumber(tx, DocType.ORDER);
      const data = OrdersMapper.toPersistencePlace(cmd, {
        reference,
        productName: priced.name,
        resolvedPrice,
        fee,
        clientId,
      });
      // Order row created first so its generated id is available for reserve()'s
      // referenceId — same create-then-reference-the-new-id ordering catalog's own
      // createProduct uses for addLayer.
      const order = await tx.order.create({ data });
      orderId = order.id;

      // Stock conflict throws here (ConflictError, 409) — the whole transaction rolls back,
      // so the just-created Order row never survives either (plan: "nothing written").
      await this.inventory.reserve(tx, cmd.productId, cmd.quantity, {
        referenceType: 'ORDER',
        referenceId: order.id,
        staffId,
      });
    });

    this.inventory.flushEvents(capturedTx!);
    eventBus.emit('order.placed', { orderId, ...(clientId != null ? { clientId } : {}) });

    return this.getOrderDto(orderId, { includeMargins: false });
  }

  async listMyOrders(query: MyOrdersQuery, clientId: string): Promise<OrderDto[]> {
    const orders = await this.prisma.order.findMany({
      where: { clientId, ...(query.status != null ? { status: query.status } : {}) },
      include: ORDER_INCLUDE,
      orderBy: { placedAt: 'desc' },
    });
    return orders.map((order) => OrdersMapper.toOrderDto(order, { includeMargins: false }));
  }

  async cancelMyOrder(id: string, clientId: string): Promise<OrderDto> {
    const existing = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!existing) throw new NotFoundError('Order');
    if (existing.clientId !== clientId) throw new ForbiddenError();
    if (existing.status !== PrismaOrderStatus.PENDING) {
      throw new ConflictError('Order is not cancellable (not PENDING)');
    }

    const staffId = await this.resolveSystemStaffId();
    let capturedTx: Prisma.TransactionClient | undefined;

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      await this.inventory.release(tx, existing.productId, existing.quantity, {
        referenceType: 'ORDER',
        referenceId: existing.id,
        staffId,
      });
      await tx.order.update({ where: { id }, data: { status: PrismaOrderStatus.CANCELLED, cancelledAt: new Date() } });
    });

    this.inventory.flushEvents(capturedTx!);
    eventBus.emit('order.cancelled', { orderId: id });

    return this.getOrderDto(id, { includeMargins: false });
  }

  // staff(STAFF_ORDERS)|admin — same data (orders have no owner staff, plan §I.2/§D-1).
  async listBackoffice(query: BackofficeOrdersQuery, actor: JWTPayload): Promise<PaginatedResult<OrderDto>> {
    const isAdmin = actor.type === UserType.ADMIN;
    const where: Prisma.OrderWhereInput = {
      ...(query.status != null ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { reference: { contains: query.search, mode: 'insensitive' } },
              { contactName: { contains: query.search, mode: 'insensitive' } },
              { contactPhone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { placedAt: 'desc' },
      }),
    ]);

    return paginated(OrderResponseSchema).parse({
      items: orders.map((order) => OrdersMapper.toOrderDto(order, { includeMargins: isAdmin })),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }

  // The confirm transaction (plan §I.2 BL#3), idempotent: an already-CONFIRMED-or-later order
  // returns its current state untouched — no re-consumption, no duplicate emit ("double
  // confirm: one consumption, one invoice").
  async confirmOrder(id: string, cmd: ConfirmOrderCommand, actor: JWTPayload): Promise<OrderDto> {
    const existing = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!existing) throw new NotFoundError('Order');
    const isAdmin = actor.type === UserType.ADMIN;

    if (existing.status !== PrismaOrderStatus.PENDING) {
      return OrdersMapper.toOrderDto(existing, { includeMargins: isAdmin });
    }

    // resolvedPrice stays frozen (BL#3) — only the charged unitPrice may be adjusted.
    const unitPrice = cmd.unitPrice ?? existing.unitPrice.toNumber();
    const revenue = unitPrice * existing.quantity;
    const staffId = await this.movementStaffId(actor);

    let capturedTx: Prisma.TransactionClient | undefined;
    let costOfGoods = 0;
    let profit: number | null = null;

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      const ref = { referenceType: 'ORDER', referenceId: existing.id, staffId };

      // Loud 409 on FIFO shortfall (ConflictError thrown by consumeFifo) rolls back both the
      // release and any partial write — order stays PENDING.
      await this.inventory.release(tx, existing.productId, existing.quantity, ref);
      const result = await this.inventory.consumeFifo(tx, existing.productId, existing.quantity, revenue, MovementType.ORDER_OUT, ref);
      costOfGoods = result.costOfGoods;
      profit = result.profit;

      await tx.order.update({
        where: { id },
        data: {
          unitPrice,
          costOfGoods,
          profit,
          status: PrismaOrderStatus.CONFIRMED,
          confirmedAt: new Date(),
          // No fallback to the system staff here — an admin with no Staff row leaves this
          // nullable column null (schema supports it), correctly reflecting "an admin, not a
          // specific staff member, confirmed this" rather than misattributing to the system
          // placeholder.
          ...(actor.staffId != null ? { confirmedByStaffId: actor.staffId } : {}),
          ...(cmd.paidAmount != null ? { paidAmount: cmd.paidAmount } : {}),
        },
      });
    });

    this.inventory.flushEvents(capturedTx!);

    // §C-3: Order stores only clientId — resolve posClientId via the client's own
    // Client.posClientId (auto-created at approval) so billing/clients' dormant handlers get
    // what they each need; guests (clientId null) resolve neither.
    const posClientId =
      existing.clientId != null
        ? (await this.prisma.client.findUnique({ where: { id: existing.clientId }, select: { posClientId: true } }))
            ?.posClientId ?? undefined
        : undefined;

    const paidAmount = cmd.paidAmount ?? existing.paidAmount.toNumber();

    eventBus.emit('order.confirmed', {
      orderId: id,
      ...(existing.clientId != null ? { clientId: existing.clientId } : {}),
      ...(posClientId != null ? { posClientId } : {}),
      snapshotLine: {
        productId: existing.productId,
        productName: existing.productNameSnapshot,
        quantity: existing.quantity,
        unitPrice,
        lineTotal: unitPrice * existing.quantity,
      },
      totals: {
        subtotal: existing.subtotal.toNumber(),
        deliveryFee: existing.deliveryFee.toNumber(),
        totalAmount: existing.totalAmount.toNumber(),
        paidAmount,
      },
      confirmedByStaffId: staffId,
    });

    return this.getOrderDto(id, { includeMargins: isAdmin });
  }

  // Forward-only ≤ COMPLETED (plan §I.2 BL#4) — CANCELLED/RETURNED are unreachable through
  // this method (STATUS_SEQUENCE.indexOf returns -1 for them, rejected below).
  async updateStatus(id: string, cmd: UpdateOrderStatusCommand, actor: JWTPayload): Promise<OrderDto> {
    const existing = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!existing) throw new NotFoundError('Order');

    const fromIndex = STATUS_SEQUENCE.indexOf(existing.status as OrderStatus);
    const toIndex = STATUS_SEQUENCE.indexOf(cmd.status);
    if (fromIndex === -1 || toIndex === -1 || toIndex <= fromIndex) {
      throw new BadRequestError('Order status can only move forward, up to COMPLETED');
    }
    if (cmd.status === OrderStatus.IN_DELIVERY && (cmd.deliveryCompany == null || cmd.trackingNumber == null)) {
      throw new BadRequestError('deliveryCompany and trackingNumber are required for IN_DELIVERY');
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: cmd.status,
        ...(cmd.deliveryCompany != null ? { deliveryCompany: cmd.deliveryCompany } : {}),
        ...(cmd.trackingNumber != null ? { trackingNumber: cmd.trackingNumber } : {}),
        ...(cmd.status === OrderStatus.COMPLETED ? { deliveredAt: new Date() } : {}),
      },
      include: ORDER_INCLUDE,
    });

    eventBus.emit('order.statusChanged', {
      orderId: id,
      fromStatus: existing.status as OrderStatus,
      toStatus: cmd.status,
    });

    return OrdersMapper.toOrderDto(updated, { includeMargins: actor.type === UserType.ADMIN });
  }

  // admin-only — any pre-COMPLETED state; release only if still reserved (PENDING). The plan
  // deliberately scopes no stock reversal for a cancel from CONFIRMED/PACKAGED/IN_DELIVERY
  // (stock was already consumed at confirm, not reserved) — restocking those is RETURN's job.
  async cancelOrder(id: string, cmd: CancelOrderCommand, actor: JWTPayload): Promise<OrderDto> {
    const existing = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!existing) throw new NotFoundError('Order');
    if (
      existing.status === PrismaOrderStatus.COMPLETED ||
      existing.status === PrismaOrderStatus.CANCELLED ||
      existing.status === PrismaOrderStatus.RETURNED
    ) {
      throw new ConflictError('Order cannot be cancelled from its current status');
    }

    const staffId = await this.movementStaffId(actor);
    let capturedTx: Prisma.TransactionClient | undefined;

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      if (existing.status === PrismaOrderStatus.PENDING) {
        await this.inventory.release(tx, existing.productId, existing.quantity, {
          referenceType: 'ORDER',
          referenceId: existing.id,
          staffId,
        });
      }
      await tx.order.update({
        where: { id },
        data: {
          status: PrismaOrderStatus.CANCELLED,
          cancelledAt: new Date(),
          ...(cmd.reason != null ? { cancellationReason: cmd.reason } : {}),
        },
      });
    });

    this.inventory.flushEvents(capturedTx!);
    eventBus.emit('order.cancelled', { orderId: id, ...(cmd.reason != null ? { reason: cmd.reason } : {}) });

    return this.getOrderDto(id, { includeMargins: true });
  }

  // admin-only — from COMPLETED only; restock reconstructs the original FIFO consumption at
  // its true consumed cost (plan §D-7), mirroring sales' buildOriginalConsumptions.
  async returnOrder(id: string, cmd: ReturnOrderCommand, actor: JWTPayload): Promise<OrderDto> {
    const existing = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!existing) throw new NotFoundError('Order');
    if (existing.status !== PrismaOrderStatus.COMPLETED) {
      throw new ConflictError('Order is not eligible for return (not COMPLETED)');
    }

    const staffId = await this.movementStaffId(actor);
    let capturedTx: Prisma.TransactionClient | undefined;

    // cmd.reason is contract-valid input but Order has no column for a return's reason
    // (cancellationReason is CANCELLED-specific — reusing it here would misattribute a
    // return's note as a cancellation in any later audit read); accepted and silently
    // dropped, same "flagged, not fixed" precedent as PlaceOrderCommand.note (Sprint 1).
    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      if (cmd.restock) {
        const originalConsumptions = await this.buildOriginalConsumptions(tx, existing.id, existing.productId, cmd.quantity);
        await this.inventory.returnIn(tx, originalConsumptions, cmd.quantity, {
          referenceType: 'RETURN',
          referenceId: existing.id,
          staffId,
        });
      }
      await tx.order.update({ where: { id }, data: { status: PrismaOrderStatus.RETURNED } });
    });

    this.inventory.flushEvents(capturedTx!);
    eventBus.emit('order.returned', { orderId: id, refundAmount: cmd.refundAmount });

    return this.getOrderDto(id, { includeMargins: true });
  }

  async getStats(): Promise<OrderStatsDto> {
    const groups = await this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } });
    const counts: Partial<Record<OrderStatus, number>> = {};
    for (const group of groups) counts[group.status as OrderStatus] = group._count._all;
    return OrdersMapper.toStatsDto(counts);
  }

  // §C-2: the frozen payment.clientRecorded payload carries invoiceNumber but no
  // orderId/sourceId — resolved here via a cross-module read of Invoice(sourceType, sourceId).
  // Absolute mirror (not an increment) so replay and listener-order (this handler vs. billing's
  // own) are both self-healing.
  async applyClientPaymentRecorded(payload: BillingEvents['payment.clientRecorded']): Promise<void> {
    if (payload.invoiceNumber == null) return;

    const invoice = await this.prisma.invoice.findUnique({
      where: { number: payload.invoiceNumber },
      select: { sourceType: true, sourceId: true, paidAmount: true },
    });
    if (!invoice || invoice.sourceType !== PrismaInvoiceSource.ORDER) return;

    await this.prisma.order.update({ where: { id: invoice.sourceId }, data: { paidAmount: invoice.paidAmount } });
  }

  private async getOrderDto(id: string, ctx: { includeMargins: boolean }): Promise<OrderDto> {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE });
    return OrdersMapper.toOrderDto(order, ctx);
  }

  // A STAFF actor's own staffId; an ADMIN (no Staff row) or a guest/client (no actor at all)
  // falls back to the system placeholder (resolveSystemStaffId).
  private async movementStaffId(actor?: JWTPayload): Promise<string> {
    return actor?.staffId ?? this.resolveSystemStaffId();
  }

  // Genuine gap, not covered by plan §C: StockMovement.staffId is NOT NULL, but PLACE (guest/
  // client) and an ADMIN-initiated confirm/cancel/return have no natural Staff row at all. No
  // schema/seed change — a dedicated "system" Staff is lazily bootstrapped once (User.username
  // is @unique, so `upsert` is race-safe under concurrency) and cached on the instance. See the
  // Sprint 2 report for the full reasoning and alternatives considered.
  private async resolveSystemStaffId(): Promise<string> {
    if (this.systemStaffId != null) return this.systemStaffId;

    const passwordHash = await hashPassword(randomUUID());
    const user = await this.prisma.user.upsert({
      where: { username: OrdersService.SYSTEM_USERNAME },
      update: {},
      create: {
        username: OrdersService.SYSTEM_USERNAME,
        passwordHash,
        type: PrismaUserType.STAFF,
        isEnabled: false,
        staff: { create: { firstName: 'System', lastName: 'Storefront' } },
      },
      include: { staff: true },
    });
    if (!user.staff) throw new Error('resolveSystemStaffId: system User exists without a linked Staff row');

    this.systemStaffId = user.staff.id;
    return user.staff.id;
  }

  // Reconstructs the exact FIFO layers an order's placement originally drained (StockMovement +
  // StockMovementConsumption, keyed by referenceType/referenceId), so a partial/full return
  // restocks at the true original per-unit cost — mirrors sales.service.ts's own
  // buildOriginalConsumptions (plan §D-7).
  private async buildOriginalConsumptions(
    tx: Prisma.TransactionClient,
    orderId: string,
    productId: string,
    qty: number,
  ): Promise<ConsumptionLine[]> {
    const outMovement = await tx.stockMovement.findFirst({
      where: { referenceType: 'ORDER', referenceId: orderId, productId, direction: PrismaMovementDirection.OUT },
    });
    if (!outMovement) throw new BadRequestError(`No stock movement found for product ${productId} on order ${orderId}`);

    const consumptions = await tx.stockMovementConsumption.findMany({
      where: { outMovementId: outMovement.id },
      orderBy: { id: 'asc' },
    });

    const result: ConsumptionLine[] = [];
    let remaining = qty;
    for (const consumption of consumptions) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, consumption.quantityConsumed);
      result.push({ inMovementId: consumption.inMovementId, qty: take, unitCost: consumption.unitCost.toNumber() });
      remaining -= take;
    }
    if (remaining > 0) {
      throw new Error(`Could not reconstruct ${qty} units of consumption history for product ${productId} on order ${orderId}`);
    }
    return result;
  }
}
