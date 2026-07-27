import type { Prisma, PrismaClient } from '@prisma/client';
import {
  InvoiceSource as PrismaInvoiceSource,
  MovementDirection as PrismaMovementDirection,
  OrderStatus as PrismaOrderStatus,
} from '@prisma/client';
import {
  DocType,
  InvoiceSource,
  MovementType,
  OrderResponseSchema,
  OrderStatus,
  OrderType,
  ORDER_PRICE_EDIT_STATUS,
  UserType,
  isOrderStatusTerminal,
  isOrderTransitionAllowed,
  orderTransitionAllowsPriceEdit,
  paginated,
  type BackofficeOrdersQuery,
  type BillingEvents,
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
import { SystemStaffResolver } from '@common/utils/system-staff.utils';
import type { ConsumptionLine, IInventoryService } from '../inventory/inventory.interface';
import type { IDeliveryFeeService, ISequenceService } from '../platform/platform.interface';
import type { CancelOrderCommand, IBillingIssuePort, ICatalogViewerPricingPort, IOrderCreditPort, IOrdersService } from './orders.interface';
import { OrdersMapper, type OrderRow } from './orders.mapper';

const ORDER_INCLUDE = {
  wilaya: { select: { id: true, frName: true, arName: true } },
  commune: { select: { id: true, frName: true, arName: true } },
  // D1 (S9) — stable order so the DTO's lines never reshuffle between reads.
  lines: { orderBy: { id: 'asc' } },
} satisfies Prisma.OrderInclude;

// A plain-number view of an OrderLine, computed with any command-supplied price override already
// applied — the shape completeOrder/applyLinePrices pass around so downstream FIFO/invoice code
// never has to re-derive it.
type EffectiveLine = {
  id: string;
  productId: string;
  productNameSnapshot: string;
  quantity: number;
  resolvedPrice: number;
  unitPrice: number;
  lineTotal: number;
  serialNumbers: string | null;
};

export class OrdersService implements IOrdersService {
  private readonly systemStaff: SystemStaffResolver;

  constructor(
    private prisma: PrismaClient,
    private deliveryFee: IDeliveryFeeService,
    private inventory: IInventoryService,
    private sequence: ISequenceService,
    private catalogPricing: ICatalogViewerPricingPort,
    private clientCredit: IOrderCreditPort,
    private billing: IBillingIssuePort,
  ) {
    this.systemStaff = new SystemStaffResolver(prisma);
  }

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

    // D1 (S9) — one resolved-price lookup for every line; getCartProducts does not guarantee
    // input order, so callers key off a Map rather than positional zipping.
    const productIds = cmd.lines.map((line) => line.productId);
    const pricedRows = await this.catalogPricing.getCartProducts(productIds, actor);
    const pricedById = new Map(pricedRows.map((row) => [row.id, row]));
    const lines = cmd.lines.map((line) => {
      const priced = pricedById.get(line.productId);
      if (!priced) throw new NotFoundError('Product');
      if (priced.priceHidden || priced.currentPrice == null) {
        throw new ForbiddenError('GUEST_PRICE_HIDDEN');
      }
      return { productId: line.productId, productName: priced.name, resolvedPrice: priced.currentPrice, quantity: line.quantity };
    });

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
        lines,
        fee,
        clientId,
      });
      // Order row created first so its generated id is available for reserve()'s
      // referenceId — same create-then-reference-the-new-id ordering catalog's own
      // createProduct uses for addLayer.
      const order = await tx.order.create({ data });
      orderId = order.id;

      // Stock conflict throws here (ConflictError, 409) — the whole transaction rolls back,
      // so the just-created Order row (and its lines) never survive either (plan: "nothing
      // written"). One reservation per line (D2 — stock stays reserved through every
      // intermediate state).
      for (const line of lines) {
        await this.inventory.reserve(tx, line.productId, line.quantity, {
          referenceType: 'ORDER',
          referenceId: order.id,
          staffId,
        });
      }
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

  // D4/R4 (S10) — widened from PENDING-only: the client may cancel any order except a completed
  // one (isOrderStatusTerminal already excludes CANCELLED/CANCELLED_BY_CLIENT/RETURNED, and
  // COMPLETED is terminal too, so this single check enforces exactly that rule). Writes
  // CANCELLED_BY_CLIENT, a distinct terminal status from admin's CANCELLED (D4).
  async cancelMyOrder(id: string, clientId: string): Promise<OrderDto> {
    const existing = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!existing) throw new NotFoundError('Order');
    if (existing.clientId !== clientId) throw new ForbiddenError();
    if (isOrderStatusTerminal(existing.status as OrderStatus)) {
      throw new ConflictError('Order is not cancellable');
    }

    const staffId = await this.systemStaff.resolve();
    let capturedTx: Prisma.TransactionClient | undefined;

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      // D2 (S10) — a non-terminal order's stock is always still reserved (nothing is consumed
      // before COMPLETED any more), so every cancellable state releases every line.
      for (const line of existing.lines) {
        await this.inventory.release(tx, line.productId, line.quantity, {
          referenceType: 'ORDER',
          referenceId: existing.id,
          staffId,
        });
      }
      await tx.order.update({ where: { id }, data: { status: PrismaOrderStatus.CANCELLED_BY_CLIENT, cancelledAt: new Date() } });
    });

    this.inventory.flushEvents(capturedTx!);
    eventBus.emit('order.cancelled', { orderId: id, byClient: true });
    eventBus.emit('order.statusChanged', {
      orderId: id,
      fromStatus: existing.status as OrderStatus,
      toStatus: OrderStatus.CANCELLED_BY_CLIENT,
    });

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
      // set-03 A2 — STF-04/ADM-09's date-range filter, on the same `placedAt` column the list
      // already sorts by.
      ...(query.from != null || query.to != null
        ? {
            placedAt: {
              ...(query.from != null ? { gte: new Date(query.from) } : {}),
              ...(query.to != null ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      // S8 J4 — the admin client-detail Orders tab scopes the same list to one registered client.
      ...(query.clientId != null ? { clientId: query.clientId } : {}),
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

  // The single forward-transition driver (S10/R3 — the separate confirm endpoint is gone).
  // Drives the per-type machine (orders.constants.ts's ORDER_STATUS_TRANSITIONS): every terminal
  // status is unreachable by construction (isOrderTransitionAllowed returns false for them, since
  // no map entry lists them as a source). COMPLETED is the money moment (D2/D3/D5) — handled by
  // the private completeOrder; every other target is a plain forward move.
  async updateStatus(id: string, cmd: UpdateOrderStatusCommand, actor: JWTPayload): Promise<OrderDto> {
    const existing = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!existing) throw new NotFoundError('Order');

    const from = existing.status as OrderStatus;
    const type = existing.orderType as OrderType;
    if (!isOrderTransitionAllowed(type, from, cmd.status)) {
      throw new BadRequestError('Illegal order status transition');
    }

    // CANCELLED is offered from the same action menu as every forward move, but it is
    // admin-only and routed to the dedicated cancel path (its own guard, its own event shape).
    if (cmd.status === OrderStatus.CANCELLED) {
      if (actor.type !== UserType.ADMIN) throw new ForbiddenError();
      return this.cancelOrder(id, { ...(cmd.reason != null ? { reason: cmd.reason } : {}) }, actor);
    }

    // IN_DELIVERY -> RETURNED (D2/R1): nothing was ever consumed or invoiced at this point, so
    // this is a pure release. The admin restock-and-refund RETURN document (returnOrder) is the
    // separate action for a COMPLETED order, where stock and money genuinely moved.
    if (cmd.status === OrderStatus.RETURNED) {
      return this.releaseOrderToReturned(existing, actor);
    }

    if (cmd.status === OrderStatus.IN_DELIVERY && (cmd.deliveryCompany == null || cmd.trackingNumber == null)) {
      throw new BadRequestError('deliveryCompany and trackingNumber are required for IN_DELIVERY');
    }

    // D11 — a line price edit is only legal at this order type's designated status (pickup:
    // COMPLETED; delivery: PACKAGED).
    const priceEditAllowed = orderTransitionAllowsPriceEdit(type, cmd.status);
    if (cmd.lines != null && !priceEditAllowed) {
      throw new BadRequestError(`Line prices may only be set at ${ORDER_PRICE_EDIT_STATUS[type]}`);
    }

    if (cmd.status === OrderStatus.COMPLETED) {
      return this.completeOrder(existing, cmd, actor);
    }

    // CONFIRMED / PACKAGED / IN_DELIVERY — forward, no money and no stock movement (D2/D3):
    // nothing accrues before COMPLETED.
    const staffId = await this.movementStaffId(actor);
    await this.prisma.$transaction(async (tx) => {
      if (priceEditAllowed && cmd.lines != null) {
        await this.applyLinePrices(tx, existing, cmd.lines);
      }
      await tx.order.update({
        where: { id },
        data: {
          status: cmd.status,
          ...(cmd.deliveryCompany != null ? { deliveryCompany: cmd.deliveryCompany } : {}),
          ...(cmd.trackingNumber != null ? { trackingNumber: cmd.trackingNumber } : {}),
          ...(cmd.status === OrderStatus.CONFIRMED
            ? {
                confirmedAt: new Date(),
                // ADMIN and STAFF actors both carry a real staffId (audit fix A2 — admins get a
                // real Staff row from identity.service.ts's createUser). No fallback to the
                // system staff here: this column stays nullable only to support a hypothetical
                // actor-less confirm, which the route guard (staffOrdersOrAdmin) never allows.
                ...(actor.staffId != null ? { confirmedByStaffId: actor.staffId } : {}),
              }
            : {}),
        },
      });
    });

    eventBus.emit('order.statusChanged', { orderId: id, fromStatus: from, toStatus: cmd.status });
    if (cmd.status === OrderStatus.CONFIRMED) {
      eventBus.emit('order.confirmed', {
        orderId: id,
        ...(existing.clientId != null ? { clientId: existing.clientId } : {}),
        confirmedByStaffId: staffId,
      });
    }

    return this.getOrderDto(id, { includeMargins: actor.type === UserType.ADMIN });
  }

  // D2/D3/D5/D11 (S10) — the money moment. Stock is released and consumed (FIFO, per line), the
  // invoice is issued and the payment captured, all inside one transaction, for every order type.
  private async completeOrder(existing: OrderRow, cmd: UpdateOrderStatusCommand, actor: JWTPayload): Promise<OrderDto> {
    const staffId = await this.movementStaffId(actor);
    const type = existing.orderType as OrderType;

    // §C-3 mirror: resolve posClientId via the client's own Client.posClientId (auto-created at
    // approval). When the order has a registered clientId but no posClientId (never approved),
    // there is no PosClient to charge (D5's "no known client" is about money only) — but the
    // invoice should still show that client's real name, not "Walk-in Customer" (F9).
    let posClientId: string | undefined;
    let clientNameSnapshot: string | undefined;
    let clientAddressSnapshot: string | undefined;
    if (existing.clientId != null) {
      const client = await this.prisma.client.findUnique({
        where: { id: existing.clientId },
        select: { posClientId: true, firstName: true, lastName: true, address: true },
      });
      posClientId = client?.posClientId ?? undefined;
      if (posClientId == null && client != null) {
        clientNameSnapshot = `${client.firstName} ${client.lastName}`;
        if (client.address != null) clientAddressSnapshot = client.address;
      }
    }

    const priceEditAllowed = orderTransitionAllowsPriceEdit(type, OrderStatus.COMPLETED);
    const effectiveTotalAmount = this.simulateLinePrices(existing, priceEditAllowed ? cmd.lines : undefined);
    const paidAmount = cmd.paidAmount ?? 0;

    // R2 — a guest (or never-approved client) order must be paid in full; there is no PosClient
    // to record a debt against. Checked before the transaction opens (fail fast, no wasted FIFO
    // work), same discipline sales' confirm CREDIT_REQUIRES_CLIENT guard uses.
    if (posClientId == null && paidAmount !== effectiveTotalAmount) {
      throw new BadRequestError('CREDIT_REQUIRES_CLIENT');
    }

    let capturedTx: Prisma.TransactionClient | undefined;
    let totalCost = 0;
    let totalProfit = 0;
    let subtotal = existing.subtotal.toNumber();
    let totalAmount = existing.totalAmount.toNumber();
    let previousCredit = 0;
    let invoiceNumber = '';
    let capturedPayment: { paymentId: string; previousCredit: number; newCredit: number } | undefined;

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;

      let lines: EffectiveLine[];
      if (priceEditAllowed && cmd.lines != null) {
        const result = await this.applyLinePrices(tx, existing, cmd.lines);
        lines = result.lines;
        subtotal = result.subtotal;
        totalAmount = result.totalAmount;
      } else {
        lines = existing.lines.map((line) => ({
          id: line.id,
          productId: line.productId,
          productNameSnapshot: line.productNameSnapshot,
          quantity: line.quantity,
          resolvedPrice: line.resolvedPrice.toNumber(),
          unitPrice: line.unitPrice.toNumber(),
          lineTotal: line.lineTotal.toNumber(),
          serialNumbers: line.serialNumbers,
        }));
      }

      // D2 — released and consumed only here, per line, at COMPLETED. Loud 409 on FIFO shortfall
      // (ConflictError thrown by consumeFifo) rolls back the whole transaction — order stays at
      // its pre-completion status.
      const ref = { referenceType: 'ORDER', referenceId: existing.id, staffId };
      const lineFigures = new Map<string, { costOfGoods: number; profit: number }>();
      for (const line of lines) {
        await this.inventory.release(tx, line.productId, line.quantity, ref);
        const result = await this.inventory.consumeFifo(tx, line.productId, line.quantity, line.lineTotal, MovementType.ORDER_OUT, ref);
        totalCost += result.costOfGoods;
        totalProfit += result.profit ?? 0;
        lineFigures.set(line.id, { costOfGoods: result.costOfGoods, profit: result.profit ?? 0 });
        await tx.orderLine.update({ where: { id: line.id }, data: { costOfGoods: result.costOfGoods, profit: result.profit } });
      }

      // D5/F1 — the document charges the full total onto the account; the money taken is applied
      // separately by the ledger call below. Composed: credit += (total − paid), same arithmetic
      // S5's report verified for sales.
      if (posClientId != null) {
        ({ previousCredit } = await this.clientCredit.applyDocumentCharge(tx, posClientId, {
          totalSoldDelta: totalAmount,
          creditDelta: totalAmount,
        }));
      }
      // Guest/never-approved (posClientId == null): previousCredit/newCredit stay 0 — R2 already
      // forces paidAmount === totalAmount, so there is nothing to record on any ledger.

      // D3 — the invoice is issued here, at COMPLETED, never at confirm.
      const issued = await this.billing.issueInvoiceInTx(tx, {
        ...(posClientId != null ? { posClientId } : {}),
        ...(clientNameSnapshot != null ? { clientNameSnapshot } : {}),
        ...(clientAddressSnapshot != null ? { clientAddressSnapshot } : {}),
        sourceType: InvoiceSource.ORDER,
        sourceId: existing.id,
        totalAmount,
        // A known client's invoice is paid through the ledger (below), which recomputes this
        // field from Σ ClientPayment.amount; a guest/never-approved order carries the captured
        // amount directly (D5).
        paidAmount: posClientId != null ? 0 : paidAmount,
        previousCredit,
        newCredit: previousCredit + (totalAmount - paidAmount),
        totalCost,
        totalProfit,
        staffId,
        lines: lines.map((line) => {
          const figures = lineFigures.get(line.id)!;
          return {
            label: line.productNameSnapshot,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            costSnapshot: figures.costOfGoods,
            profit: figures.profit,
            lineTotal: line.lineTotal,
            ...(line.serialNumbers != null ? { serialNumbers: line.serialNumbers } : {}),
          };
        }),
      });
      invoiceNumber = issued.number;

      // D5 — captured only when a known client actually paid something; a guest/never-approved
      // order's money is recorded on the invoice/order directly, never as a ledger row.
      if (posClientId != null && paidAmount > 0) {
        const captured = await this.billing.captureClientPaymentInTx(tx, {
          posClientId,
          invoiceId: issued.invoiceId,
          amount: paidAmount,
          staffId,
        });
        capturedPayment = captured;
      }

      await tx.order.update({
        where: { id: existing.id },
        data: {
          status: PrismaOrderStatus.COMPLETED,
          deliveredAt: new Date(),
          paidAmount,
          subtotal,
          totalAmount,
          totalCost,
          totalProfit,
        },
      });
    });

    this.inventory.flushEvents(capturedTx!);

    eventBus.emit('invoice.issued', { invoiceNumber, sourceType: InvoiceSource.ORDER, sourceReference: existing.reference });
    eventBus.emit('order.statusChanged', {
      orderId: existing.id,
      fromStatus: existing.status as OrderStatus,
      toStatus: OrderStatus.COMPLETED,
    });
    if (capturedPayment != null && posClientId != null) {
      eventBus.emit('payment.clientRecorded', {
        paymentId: capturedPayment.paymentId,
        posClientId,
        invoiceNumber,
        amount: paidAmount,
        previousCredit: capturedPayment.previousCredit,
        newCredit: capturedPayment.newCredit,
      });
    }

    return this.getOrderDto(existing.id, { includeMargins: actor.type === UserType.ADMIN });
  }

  // Writes each command-supplied unitPrice/serialNumbers override onto its OrderLine (D11),
  // recomputes and writes the order's own subtotal/totalAmount, and returns a plain-number view
  // of every line for the caller to use without a second read. resolvedPrice is never rewritten —
  // it stays frozen at what the viewer saw at placement (BL#1), which is exactly what the
  // storefront-vs-order-page price distinction (D11) depends on.
  private async applyLinePrices(
    tx: Prisma.TransactionClient,
    existing: OrderRow,
    cmdLines: NonNullable<UpdateOrderStatusCommand['lines']>,
  ): Promise<{ subtotal: number; totalAmount: number; lines: EffectiveLine[] }> {
    const overrideById = new Map(cmdLines.map((l) => [l.orderLineId, l]));
    for (const cmdLine of cmdLines) {
      if (!existing.lines.some((line) => line.id === cmdLine.orderLineId)) {
        throw new BadRequestError(`Unknown orderLineId ${cmdLine.orderLineId}`);
      }
    }

    const lines: EffectiveLine[] = [];
    for (const line of existing.lines) {
      const override = overrideById.get(line.id);
      const unitPrice = override?.unitPrice ?? line.unitPrice.toNumber();
      const lineTotal = unitPrice * line.quantity;
      const serialNumbers = override?.serialNumbers != null ? override.serialNumbers.join(',') : line.serialNumbers;

      if (override != null) {
        await tx.orderLine.update({
          where: { id: line.id },
          data: { unitPrice, lineTotal, ...(serialNumbers != null ? { serialNumbers } : {}) },
        });
      }

      lines.push({
        id: line.id,
        productId: line.productId,
        productNameSnapshot: line.productNameSnapshot,
        quantity: line.quantity,
        resolvedPrice: line.resolvedPrice.toNumber(),
        unitPrice,
        lineTotal,
        serialNumbers,
      });
    }

    const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
    const totalAmount = subtotal + existing.deliveryFee.toNumber();
    await tx.order.update({ where: { id: existing.id }, data: { subtotal, totalAmount } });

    return { subtotal, totalAmount, lines };
  }

  // The non-writing half of applyLinePrices — used to compute the R2 guard's totalAmount before
  // the transaction opens (fail fast), without touching the database.
  private simulateLinePrices(existing: OrderRow, cmdLines?: UpdateOrderStatusCommand['lines']): number {
    const overrideById = new Map((cmdLines ?? []).map((l) => [l.orderLineId, l]));
    const subtotal = existing.lines.reduce((sum, line) => {
      const unitPrice = overrideById.get(line.id)?.unitPrice ?? line.unitPrice.toNumber();
      return sum + unitPrice * line.quantity;
    }, 0);
    return subtotal + existing.deliveryFee.toNumber();
  }

  // IN_DELIVERY -> RETURNED (D2/R1) — a pure release, since nothing was ever consumed or
  // invoiced at this point. Mirrors cancelOrder's release loop exactly; the only difference is
  // the resulting status and event.
  private async releaseOrderToReturned(existing: OrderRow, actor: JWTPayload): Promise<OrderDto> {
    const staffId = await this.movementStaffId(actor);
    let capturedTx: Prisma.TransactionClient | undefined;

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      for (const line of existing.lines) {
        await this.inventory.release(tx, line.productId, line.quantity, {
          referenceType: 'ORDER',
          referenceId: existing.id,
          staffId,
        });
      }
      await tx.order.update({ where: { id: existing.id }, data: { status: PrismaOrderStatus.RETURNED } });
    });

    this.inventory.flushEvents(capturedTx!);
    eventBus.emit('order.statusChanged', {
      orderId: existing.id,
      fromStatus: existing.status as OrderStatus,
      toStatus: OrderStatus.RETURNED,
    });
    eventBus.emit('order.returned', { orderId: existing.id, refundAmount: 0 });

    return this.getOrderDto(existing.id, { includeMargins: actor.type === UserType.ADMIN });
  }

  // admin-only — any non-terminal status; every non-terminal order's stock is still reserved
  // under D2 (nothing consumes before COMPLETED any more), so every cancellable state releases
  // every line. A COMPLETED order's reversal is the separate RETURN document action, below.
  async cancelOrder(id: string, cmd: CancelOrderCommand, actor: JWTPayload): Promise<OrderDto> {
    const existing = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!existing) throw new NotFoundError('Order');
    if (isOrderStatusTerminal(existing.status as OrderStatus)) {
      throw new ConflictError('Order cannot be cancelled from its current status');
    }

    const staffId = await this.movementStaffId(actor);
    let capturedTx: Prisma.TransactionClient | undefined;

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      for (const line of existing.lines) {
        await this.inventory.release(tx, line.productId, line.quantity, {
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

  // admin-only — from COMPLETED only (R1); restock reconstructs the original FIFO consumption at
  // its true consumed cost (plan §D-7), mirroring sales' buildOriginalConsumptions. D1 (S9) — one
  // return per order (the order flips to RETURNED), with a quantity per OrderLine. D6/D7 (S10) —
  // the refund is a negative-amount ClientPayment row capped at cash actually collected; a
  // partial return leaves credit untouched, a full return additionally reverses this order's own
  // credit delta. Mirrors sales.service.ts's createReturn exactly.
  async returnOrder(id: string, cmd: ReturnOrderCommand, actor: JWTPayload): Promise<OrderDto> {
    const existing = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!existing) throw new NotFoundError('Order');
    if (existing.status !== PrismaOrderStatus.COMPLETED) {
      throw new ConflictError('Order is not eligible for return (not COMPLETED)');
    }

    const lineById = new Map(existing.lines.map((line) => [line.id, line]));
    for (const cmdLine of cmd.lines) {
      const line = lineById.get(cmdLine.orderLineId);
      if (!line) throw new BadRequestError(`Unknown orderLineId ${cmdLine.orderLineId}`);
      if (cmdLine.quantity > line.quantity) {
        throw new BadRequestError(`Return quantity for line ${cmdLine.orderLineId} exceeds the ordered amount`);
      }
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { sourceType_sourceId: { sourceType: PrismaInvoiceSource.ORDER, sourceId: existing.id } },
      select: { id: true, number: true },
    });
    const posClientId =
      existing.clientId != null
        ? (await this.prisma.client.findUnique({ where: { id: existing.clientId }, select: { posClientId: true } }))
            ?.posClientId ?? undefined
        : undefined;
    // R3 (S5) — a return can never invent cash that was never collected. An order is returned
    // once (the order flips straight to RETURNED), so there is no "already refunded so far" term
    // to subtract the way sales' cumulative-returns case needs.
    const cashRefundable = existing.paidAmount.toNumber();
    const cashRefunded = Math.min(cmd.refundAmount, cashRefundable);

    const staffId = await this.movementStaffId(actor);
    let capturedTx: Prisma.TransactionClient | undefined;
    let refundPayment: { paymentId: string; previousCredit: number; newCredit: number } | undefined;

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      if (cmd.restock) {
        for (const cmdLine of cmd.lines) {
          const line = lineById.get(cmdLine.orderLineId)!;
          const originalConsumptions = await this.buildOriginalConsumptions(tx, existing.id, line.productId, cmdLine.quantity);
          await this.inventory.returnIn(tx, originalConsumptions, cmdLine.quantity, {
            referenceType: 'RETURN',
            referenceId: existing.id,
            staffId,
          });
        }
      }

      const returnedByLineId = new Map(cmd.lines.map((l) => [l.orderLineId, l.quantity]));
      const allFullyReturned = existing.lines.every((line) => (returnedByLineId.get(line.id) ?? 0) >= line.quantity);

      if (posClientId != null) {
        // D6 — the refund is a NEGATIVE-amount ClientPayment row, so totalPaid stays Σ ledger by
        // construction. Skipped when no cash is refundable (an order taken wholly on credit).
        if (cashRefunded > 0 && invoice != null) {
          const captured = await this.billing.captureClientPaymentInTx(tx, {
            posClientId,
            invoiceId: invoice.id,
            amount: -cashRefunded,
            staffId,
          });
          refundPayment = captured;
        }

        // D7 — totalSold always falls by the refunded goods. Credit is deliberately left where it
        // was on a PARTIAL return (the -cashRefunded term below exactly cancels the credit rise
        // the negative ledger row above just applied). A FULL return additionally reverses this
        // order's own credit delta (totalAmount - paidAmount, the amount COMPLETED put on credit).
        const orderCreditDelta = existing.totalAmount.toNumber() - existing.paidAmount.toNumber();
        const creditEffect = -cashRefunded + (allFullyReturned ? -orderCreditDelta : 0);
        await this.clientCredit.applyDocumentCharge(tx, posClientId, {
          totalSoldDelta: -cmd.refundAmount,
          creditDelta: creditEffect,
        });
      }

      await tx.order.update({ where: { id }, data: { status: PrismaOrderStatus.RETURNED } });
    });

    this.inventory.flushEvents(capturedTx!);

    if (refundPayment != null && posClientId != null) {
      eventBus.emit('payment.clientRecorded', {
        paymentId: refundPayment.paymentId,
        posClientId,
        ...(invoice != null ? { invoiceNumber: invoice.number } : {}),
        amount: -cashRefunded,
        previousCredit: refundPayment.previousCredit,
        newCredit: refundPayment.newCredit,
      });
    }

    eventBus.emit('order.returned', { orderId: id, refundAmount: cmd.refundAmount });
    eventBus.emit('order.statusChanged', {
      orderId: id,
      fromStatus: existing.status as OrderStatus,
      toStatus: OrderStatus.RETURNED,
    });

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
  // falls back to the shared system placeholder (@common/utils/system-staff.utils).
  private async movementStaffId(actor?: JWTPayload): Promise<string> {
    return actor?.staffId ?? this.systemStaff.resolve();
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
