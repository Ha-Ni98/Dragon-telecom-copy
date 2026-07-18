import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient, ReturnType as PrismaReturnType } from '@prisma/client';
import {
  MovementDirection as PrismaMovementDirection,
  SaleOrigin as PrismaSaleOrigin,
  SaleStatus as PrismaSaleStatus,
} from '@prisma/client';
import {
  DocType,
  MovementType,
  SaleOrigin,
  SaleResponseSchema,
  UserType,
  paginated,
  type ConfirmSaleCommand,
  type CreateReturnCommand,
  type JWTPayload,
  type PaginatedResult,
  type ReceiptDto,
  type RepairsEvents,
  type SaleDraftCommand,
  type SaleDto,
  type SaleListQuery,
  type UpdateSaleDraftCommand,
} from '@dragon-telecom/contract';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@common/errors';
import { eventBus } from '@common/events/event-bus';
import type { ConsumptionLine, IInventoryService } from '../inventory/inventory.interface';
import type { ISequenceService } from '../platform/platform.interface';
import type { ICatalogPosPricingPort, ISalesService } from './sales.interface';
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
        const locked = await this.lockPosClient(tx, existing.posClientId);
        previousCredit = locked.credit.toNumber();
      }
      newCredit = previousCredit + (totalAmount - cmd.paidAmount);

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
      origin: SaleOrigin.POS,
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
        await tx.posClient.update({ where: { id: sale.posClientId }, data: { credit: { increment: creditEffect } } });
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

  // Listener-only (never HTTP) — records a repair pickup as a COMPLETED REPAIR-origin sale, no
  // FIFO re-consumption (the repair already consumed its own parts). Idempotent by repairId via
  // the Repair.saleId @unique latch: a concurrent/replayed call either finds saleId already set
  // (short-circuits before any write) or loses the updateMany race (0 rows updated -> throws,
  // rolling back the just-created sale too).
  async recordRepairSale(payload: RepairsEvents['repair.pickedUp']): Promise<void> {
    const result = await this.prisma.$transaction(async (tx) => {
      const repair = await tx.repair.findUnique({ where: { id: payload.repairId }, select: { saleId: true } });
      if (!repair) throw new NotFoundError('Repair');
      if (repair.saleId != null) return null;

      // repair.pickedUp carries no staffId — the most recent status-history row (written by the
      // repairs module in the same moment it emitted this event) is the acting staff signal.
      const lastHistory = await tx.repairStatusHistory.findFirst({
        where: { repairId: payload.repairId },
        orderBy: { changedAt: 'desc' },
      });
      if (!lastHistory) throw new NotFoundError('RepairStatusHistory');

      let previousCredit = 0;
      if (payload.posClientId != null) {
        const locked = await this.lockPosClient(tx, payload.posClientId);
        previousCredit = locked.credit.toNumber();
      }
      const newCredit = previousCredit + (payload.totalAmount - payload.paidAmount);

      const reference = await this.sequence.nextNumber(tx, DocType.SALE);

      const sale = await tx.sale.create({
        data: {
          reference,
          ...(payload.posClientId != null ? { posClientId: payload.posClientId } : {}),
          origin: PrismaSaleOrigin.REPAIR,
          status: PrismaSaleStatus.COMPLETED,
          subtotal: payload.totalAmount,
          totalAmount: payload.totalAmount,
          paidAmount: payload.paidAmount,
          previousCredit,
          newCredit,
          totalCost: payload.totalCost,
          totalProfit: payload.totalProfit,
          soldAt: new Date(),
          staffId: lastHistory.staffId,
          lines: {
            create: payload.snapshotParts.map((part) => ({
              productId: part.productId,
              productNameSnapshot: part.productName,
              quantity: part.quantity,
              resolvedPrice: part.unitPrice,
              unitPrice: part.unitPrice,
              costOfGoods: part.costOfGoods,
              profit: part.profit,
              lineTotal: part.lineTotal,
            })),
          },
        },
      });

      const latch = await tx.repair.updateMany({ where: { id: payload.repairId, saleId: null }, data: { saleId: sale.id } });
      if (latch.count === 0) throw new ConflictError('Repair already recorded as a sale');

      return { saleId: sale.id, previousCredit, newCredit };
    });

    if (!result) return;

    eventBus.emit('sale.confirmed', {
      saleId: result.saleId,
      origin: SaleOrigin.REPAIR,
      ...(payload.posClientId != null ? { posClientId: payload.posClientId } : {}),
      totalAmount: payload.totalAmount,
      paidAmount: payload.paidAmount,
      previousCredit: result.previousCredit,
      newCredit: result.newCredit,
      snapshotLines: payload.snapshotParts.map((part) => ({
        productId: part.productId,
        productName: part.productName,
        quantity: part.quantity,
        unitPrice: part.unitPrice,
        lineTotal: part.lineTotal,
      })),
    });
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

  // Row-lock precedent mirrors purchasing's lockSupplier: the raw query only acquires the lock
  // (Prisma has no native SELECT ... FOR UPDATE), the fully-typed row is then read through a
  // normal Prisma call in the same transaction.
  private async lockPosClient(tx: Prisma.TransactionClient, posClientId: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "PosClient" WHERE id = ${posClientId} FOR UPDATE`;
    if (!rows[0]) throw new NotFoundError('PosClient');
    return tx.posClient.findUniqueOrThrow({ where: { id: posClientId } });
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
