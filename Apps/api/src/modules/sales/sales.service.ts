import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient, ReturnType as PrismaReturnType } from '@prisma/client';
import { MovementDirection as PrismaMovementDirection, SaleStatus as PrismaSaleStatus } from '@prisma/client';
import {
  DocType,
  MovementType,
  SaleResponseSchema,
  UserType,
  paginated,
  type ConfirmSaleCommand,
  type CreateReturnCommand,
  type JWTPayload,
  type PaginatedResult,
  type ReceiptDto,
  type SaleDraftCommand,
  type SaleDto,
  type SaleListQuery,
  type UpdateSaleDraftCommand,
} from '@dragon-telecom/contract';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@common/errors';
import { eventBus } from '@common/events/event-bus';
import type { ConsumptionLine, IInventoryService } from '../inventory/inventory.interface';
import type { ISequenceService } from '../platform/platform.interface';
import type { ICatalogPosPricingPort, IClientCreditPort, ISalesService } from './sales.interface';
import { SalesMapper, type SaleRow } from './sales.mapper';

const SALE_INCLUDE = {
  posClient: { select: { name: true, categoryId: true } },
  staff: { select: { firstName: true, lastName: true } },
  lines: true,
} satisfies Prisma.SaleInclude;

export class SalesService implements ISalesService {
  constructor(
    private prisma: PrismaClient,
    private sequence: ISequenceService,
    private inventory: IInventoryService,
    private catalogPricing: ICatalogPosPricingPort,
    private clientCredit: IClientCreditPort,
  ) {}

  async createDraft(cmd: SaleDraftCommand, staffId: string): Promise<SaleDto> {
    const productNames = await this.resolveProductNames(cmd.lines.map((line) => line.productId));
    const data = SalesMapper.toPersistenceDraft(cmd, { staffId, reference: this.draftReference(), productNames });
    const sale = await this.prisma.sale.create({ data, include: SALE_INCLUDE });
    // DRAFT margins are always 0 (placeholder) regardless of who reads it back.
    return SalesMapper.toSaleDto(sale as SaleRow, { includeMargins: false });
  }

  async updateDraft(id: string, cmd: UpdateSaleDraftCommand, actor: JWTPayload): Promise<SaleDto> {
    const existing = await this.prisma.sale.findUnique({ where: { id }, include: SALE_INCLUDE });
    if (!existing) throw new NotFoundError('Sale');
    const isAdmin = actor.type === UserType.ADMIN;
    if (!isAdmin && existing.staffId !== actor.staffId) throw new ForbiddenError();
    if (existing.status !== PrismaSaleStatus.DRAFT) throw new ConflictError('Sale is no longer editable (not DRAFT)');

    let lineWrites: Prisma.SaleUpdateInput['lines'];
    if (cmd.lines) {
      const productNames = await this.resolveProductNames(cmd.lines.map((line) => line.productId));
      lineWrites = { deleteMany: {}, create: cmd.lines.map((line) => SalesMapper.toLineCreateInput(line, productNames)) };
    }

    const updated = await this.prisma.sale.update({
      where: { id },
      data: {
        ...(cmd.posClientId != null ? { posClientId: cmd.posClientId } : {}),
        ...(cmd.discountAmount != null ? { discountAmount: cmd.discountAmount } : {}),
        ...(cmd.note != null ? { note: cmd.note } : {}),
        ...(lineWrites ? { lines: lineWrites } : {}),
      },
      include: SALE_INCLUDE,
    });

    return SalesMapper.toSaleDto(updated as SaleRow, { includeMargins: isAdmin });
  }

  // The transaction (spec BL#2), one prisma.$transaction, idempotent (no second consumption/
  // event on an already-COMPLETED sale — that's surfaced as a 409 instead, per plan §D-5).
  async confirm(id: string, cmd: ConfirmSaleCommand, actor: JWTPayload): Promise<ReceiptDto> {
    const existing = await this.prisma.sale.findUnique({ where: { id }, include: SALE_INCLUDE });
    if (!existing) throw new NotFoundError('Sale');
    const isAdmin = actor.type === UserType.ADMIN;
    if (!isAdmin && existing.staffId !== actor.staffId) throw new ForbiddenError();
    if (existing.status !== PrismaSaleStatus.DRAFT) {
      throw new ConflictError('Sale is not confirmable (not DRAFT)');
    }

    // subtotal/totalAmount only depend on the already-stored lines (unitPrice/quantity never
    // change between draft and confirm) — computable, and the CREDIT_REQUIRES_CLIENT gate
    // checkable, before touching the catalog or inventory at all (fail fast, no wasted FIFO work).
    const subtotal = existing.lines.reduce((sum, line) => sum + line.lineTotal.toNumber(), 0);
    const totalAmount = subtotal - existing.discountAmount.toNumber();

    if (totalAmount > cmd.paidAmount && existing.posClientId == null) {
      throw new BadRequestError('CREDIT_REQUIRES_CLIENT');
    }

    const categoryId = existing.posClient?.categoryId ?? null;
    const productIds = existing.lines.map((line) => line.productId);
    const priceRows = await this.catalogPricing.resolvePosPrices(productIds, categoryId);
    const priceMap = new Map(priceRows.map((row) => [row.productId, row.resolvedPrice]));
    for (const line of existing.lines) {
      if (priceMap.get(line.productId) == null) {
        throw new BadRequestError(`No resolvable POS price for product ${line.productId}`);
      }
    }

    let capturedTx: Prisma.TransactionClient | undefined;
    let previousCredit = 0;
    let newCredit = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let reference = '';
    const actingStaffId = actor.staffId!;

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;

      if (existing.posClientId != null) {
        // Written here, inside this same locked transaction, via the injected credit port
        // (credit-serialization fix, plan §C3) — no post-commit listener applies it.
        ({ previousCredit, newCredit } = await this.clientCredit.applySaleCharge(tx, existing.posClientId, {
          totalAmount,
          paidAmount: cmd.paidAmount,
        }));
      } else {
        // No linked PosClient — nothing to charge (the CREDIT_REQUIRES_CLIENT guard above
        // already guarantees paidAmount >= totalAmount here); previousCredit/newCredit are
        // still stored on the Sale row itself, same formula as the posClientId branch.
        newCredit = previousCredit + (totalAmount - cmd.paidAmount);
      }

      for (const line of existing.lines) {
        const resolvedPrice = priceMap.get(line.productId)!;
        const revenue = line.unitPrice.toNumber() * line.quantity;
        // Stock exhaustion throws (ConflictError, 409) inside this loop — the whole transaction
        // rolls back and the sale stays DRAFT (spec test scenario).
        const result = await this.inventory.consumeFifo(tx, line.productId, line.quantity, revenue, MovementType.SALE, {
          referenceType: 'SALE',
          referenceId: existing.id,
          staffId: actingStaffId,
        });
        totalCost += result.costOfGoods;
        totalProfit += result.profit ?? 0;
        await tx.saleLine.update({
          where: { id: line.id },
          data: { resolvedPrice, costOfGoods: result.costOfGoods, profit: result.profit ?? 0 },
        });
      }

      reference = await this.sequence.nextNumber(tx, DocType.SALE);

      await tx.sale.update({
        where: { id },
        data: {
          reference,
          status: PrismaSaleStatus.COMPLETED,
          soldAt: new Date(),
          subtotal,
          totalAmount,
          paidAmount: cmd.paidAmount,
          previousCredit,
          newCredit,
          totalCost,
          totalProfit,
        },
      });
    });

    this.inventory.flushEvents(capturedTx!);

    eventBus.emit('sale.confirmed', {
      saleId: id,
      ...(existing.posClientId != null ? { posClientId: existing.posClientId } : {}),
      totalAmount,
      paidAmount: cmd.paidAmount,
      previousCredit,
      newCredit,
      snapshotLines: existing.lines.map((line) => ({
        productId: line.productId,
        productName: line.productNameSnapshot,
        quantity: line.quantity,
        unitPrice: line.unitPrice.toNumber(),
        lineTotal: line.lineTotal.toNumber(),
      })),
    });

    const confirmed = await this.prisma.sale.findUniqueOrThrow({ where: { id }, include: SALE_INCLUDE });
    return SalesMapper.toReceiptDto(confirmed as SaleRow);
  }

  async listStaffSales(query: SaleListQuery, staffId: string): Promise<PaginatedResult<SaleDto>> {
    return this.listSales(query, { includeMargins: false, extraWhere: { staffId } });
  }

  async listAdminSales(query: SaleListQuery): Promise<PaginatedResult<SaleDto>> {
    return this.listSales(query, { includeMargins: true });
  }

  async getSale(reference: string, actor: JWTPayload): Promise<SaleDto> {
    const sale = await this.prisma.sale.findUnique({ where: { reference }, include: SALE_INCLUDE });
    if (!sale) throw new NotFoundError('Sale');
    const isAdmin = actor.type === UserType.ADMIN;
    if (!isAdmin && sale.staffId !== actor.staffId) throw new ForbiddenError();
    return SalesMapper.toSaleDto(sale as SaleRow, { includeMargins: isAdmin });
  }

  // Admin-only route (contract) — quantity ≤ sold − already-returned is checked before opening
  // the transaction; restock lines reconstruct the original FIFO consumption from the stored
  // StockMovement/StockMovementConsumption rows (see buildOriginalConsumptions) and hand it to
  // the injected engine's returnIn, at the line's consumed cost (spec BL#3).
  async createReturn(cmd: CreateReturnCommand, staffId: string): Promise<SaleDto> {
    const sale = await this.prisma.sale.findUnique({ where: { id: cmd.saleId }, include: SALE_INCLUDE });
    if (!sale) throw new NotFoundError('Sale');
    if (sale.status !== PrismaSaleStatus.COMPLETED && sale.status !== PrismaSaleStatus.PARTIALLY_RETURNED) {
      throw new ConflictError('Sale is not eligible for a return');
    }

    const saleLineById = new Map(sale.lines.map((line) => [line.id, line]));
    const existingReturnLines = await this.prisma.returnLine.findMany({
      where: { saleLine: { saleId: sale.id } },
      select: { saleLineId: true, quantity: true },
    });
    const returnedSoFar = new Map<string, number>();
    for (const returnLine of existingReturnLines) {
      returnedSoFar.set(returnLine.saleLineId, (returnedSoFar.get(returnLine.saleLineId) ?? 0) + returnLine.quantity);
    }

    let refundAmount = 0;
    for (const line of cmd.lines) {
      const saleLine = saleLineById.get(line.saleLineId);
      if (!saleLine) throw new BadRequestError(`Unknown saleLineId: ${line.saleLineId}`);
      const alreadyReturned = returnedSoFar.get(line.saleLineId) ?? 0;
      if (line.quantity > saleLine.quantity - alreadyReturned) {
        throw new BadRequestError(`Return quantity exceeds sold minus already-returned for saleLine ${line.saleLineId}`);
      }
      refundAmount += line.refundAmount;
    }

    let capturedTx: Prisma.TransactionClient | undefined;
    let returnId = '';
    // Refund reduces what the client owes (PosClient.credit is "owed to the store") — negative,
    // may push credit negative (store owes the client), mirroring purchasing's own
    // overpayment-allowed convention.
    let creditEffect = 0;

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      const reference = await this.sequence.nextNumber(tx, DocType.RETURN);

      const created = await tx.return.create({
        data: {
          reference,
          saleId: sale.id,
          type: cmd.type as PrismaReturnType,
          ...(cmd.reason != null ? { reason: cmd.reason } : {}),
          refundAmount,
          staffId,
          lines: {
            create: cmd.lines.map((line) => ({
              saleLineId: line.saleLineId,
              quantity: line.quantity,
              restock: line.restock,
              refundAmount: line.refundAmount,
            })),
          },
        },
      });
      returnId = created.id;

      for (const line of cmd.lines) {
        if (!line.restock) continue;
        const saleLine = saleLineById.get(line.saleLineId)!;
        const originalConsumptions = await this.buildOriginalConsumptions(tx, sale.id, saleLine.productId, line.quantity);
        await this.inventory.returnIn(tx, originalConsumptions, line.quantity, {
          referenceType: 'RETURN',
          referenceId: created.id,
          staffId,
        });
      }

      const cumulativeReturned = new Map(returnedSoFar);
      for (const line of cmd.lines) {
        cumulativeReturned.set(line.saleLineId, (cumulativeReturned.get(line.saleLineId) ?? 0) + line.quantity);
      }
      const allFullyReturned = sale.lines.every((line) => (cumulativeReturned.get(line.id) ?? 0) >= line.quantity);

      await tx.sale.update({
        where: { id: sale.id },
        data: { status: allFullyReturned ? PrismaSaleStatus.RETURNED : PrismaSaleStatus.PARTIALLY_RETURNED },
      });

      if (sale.posClientId != null) {
        creditEffect = -refundAmount;
        // Written here, inside this same transaction, via the injected credit port
        // (credit-serialization fix, plan §C3 — this direct tx.posClient.update was also a
        // module-boundary violation: PosClient belongs to clients, not sales). The old
        // clients-listener applied this same creditEffect a second time on every return,
        // silently double-counting every refund — deleting that handler (below) fixes it too.
        await this.clientCredit.applyReturnRefund(tx, sale.posClientId, { creditEffect });
      }
    });

    this.inventory.flushEvents(capturedTx!);

    eventBus.emit('return.created', {
      returnId,
      saleId: sale.id,
      refundAmount,
      ...(sale.posClientId != null ? { posClientId: sale.posClientId } : {}),
      ...(sale.posClientId != null ? { creditEffect } : {}),
    });

    const updated = await this.prisma.sale.findUniqueOrThrow({ where: { id: sale.id }, include: SALE_INCLUDE });
    return SalesMapper.toSaleDto(updated as SaleRow, { includeMargins: true });
  }

  private async listSales(
    query: SaleListQuery,
    opts: { includeMargins: boolean; extraWhere?: Prisma.SaleWhereInput },
  ): Promise<PaginatedResult<SaleDto>> {
    const where: Prisma.SaleWhereInput = {
      ...opts.extraWhere,
      ...(query.status != null ? { status: query.status } : {}),
      ...(query.from != null || query.to != null
        ? {
            createdAt: {
              ...(query.from != null ? { gte: new Date(query.from) } : {}),
              ...(query.to != null ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      // set-03 A3 — admin-only filters (ADM-10's seller/POS-client dropdowns); listMySales
      // never forwards these, so they can't clash with its own extraWhere.staffId scoping.
      ...(query.sellerId != null ? { staffId: query.sellerId } : {}),
      ...(query.posClientId != null ? { posClientId: query.posClientId } : {}),
    };

    const [total, sales] = await this.prisma.$transaction([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        include: SALE_INCLUDE,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return paginated(SaleResponseSchema).parse({
      items: sales.map((sale) => SalesMapper.toSaleDto(sale as SaleRow, { includeMargins: opts.includeMargins })),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }

  private async resolveProductNames(productIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(productIds)];
    const products = await this.prisma.product.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
    if (products.length !== unique.length) {
      const found = new Set(products.map((product) => product.id));
      const missing = unique.find((productId) => !found.has(productId));
      throw new BadRequestError(`Unknown productId: ${missing}`);
    }
    return new Map(products.map((product) => [product.id, product.name]));
  }

  // Reconstructs the exact FIFO layers a sale line originally drained (StockMovement +
  // StockMovementConsumption, keyed by referenceType/referenceId — the same index the schema
  // documents for this lookup), so a partial return can restock at the true original per-unit
  // cost rather than the product's current blended average. Not ordered by any timestamp
  // (StockMovementConsumption carries none) — consumptions are taken in insertion order (`id`),
  // matching the FIFO drain order consumeFifo itself wrote them in.
  private async buildOriginalConsumptions(
    tx: Prisma.TransactionClient,
    saleId: string,
    productId: string,
    qty: number,
  ): Promise<ConsumptionLine[]> {
    const outMovement = await tx.stockMovement.findFirst({
      where: { referenceType: 'SALE', referenceId: saleId, productId, direction: PrismaMovementDirection.OUT },
    });
    if (!outMovement) throw new BadRequestError(`No stock movement found for product ${productId} on sale ${saleId}`);

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
      throw new Error(`Could not reconstruct ${qty} units of consumption history for product ${productId} on sale ${saleId}`);
    }
    return result;
  }

  // DRAFT rows need *some* value for the NOT NULL/unique `reference` column before a real
  // sequence number is allocated at confirm time — same gap/solution as purchasing's own
  // draftReference().
  private draftReference(): string {
    return `DRAFT-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  }
}
