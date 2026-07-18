import type { Prisma, PrismaClient, Product } from '@prisma/client';
import { MovementType } from '@dragon-telecom/contract';
import type {
  AdjustmentResultDto,
  CreateAdjustmentCommand,
  MovementDto,
  MovementsQuery,
  PaginatedResult,
  ReservationDto,
  ReservationsQuery,
  StockQuery,
  StockRowDto,
} from '@dragon-telecom/contract';
import { ConflictError, NotFoundError } from '@common/errors';
import { eventBus } from '@common/events/event-bus';
import { InventoryMapper } from './inventory.mapper';
import type {
  AddLayerResult,
  ConsumeFifoResult,
  ConsumptionLine,
  ExportResult,
  IInventoryReadService,
  IInventoryService,
  MovementRef,
  ReturnInResult,
} from './inventory.interface';

type BufferedEvent =
  | { name: 'inventory.stockChanged'; payload: { productId: string; onHand: number; reserved: number } }
  | { name: 'inventory.lowStock'; payload: { productId: string; available: number; threshold: number } };

// The FIFO ledger engine — the injected service every document module receives (spec "Injected
// service [CONTRACT]"). Every method runs inside the *caller's* `tx`; the engine never opens its
// own transaction. `prisma` is injected but unused directly (every DB call goes through the
// passed `tx`) — kept for constructor-shape consistency with SequenceService, which has the
// identical property (plan §5 item 3, platform.service.ts precedent).
export class InventoryService implements IInventoryService {
  private readonly eventBuffers = new WeakMap<Prisma.TransactionClient, BufferedEvent[]>();

  constructor(private prisma: PrismaClient) {}

  async reserve(tx: Prisma.TransactionClient, productId: string, qty: number, ref: MovementRef): Promise<void> {
    const product = await this.lockProduct(tx, productId);
    const preAvailable = InventoryMapper.availableQuantity(product);
    if (qty > preAvailable) {
      throw new ConflictError('INSUFFICIENT_STOCK', { productId, requested: qty, available: preAvailable });
    }

    const type = InventoryService.reservationType(ref.referenceType);
    const newReserved = product.quantityReserved + qty;

    await tx.stockMovement.create({
      data: {
        productId,
        direction: 'PENDING',
        type,
        quantity: qty,
        balanceAfter: product.quantityOnHand,
        referenceType: ref.referenceType,
        referenceId: ref.referenceId,
        ...(ref.reason != null ? { reason: ref.reason } : {}),
        staffId: ref.staffId,
      },
    });

    await tx.product.update({ where: { id: productId }, data: { quantityReserved: newReserved } });

    const postAvailable = InventoryMapper.availableQuantity({ quantityOnHand: product.quantityOnHand, quantityReserved: newReserved });
    this.checkAndBufferLowStock(tx, productId, preAvailable, postAvailable, product.reorderThreshold);
    this.buffer(tx, {
      name: 'inventory.stockChanged',
      payload: { productId, onHand: product.quantityOnHand, reserved: newReserved },
    });
  }

  async release(tx: Prisma.TransactionClient, productId: string, qty: number, ref: MovementRef): Promise<void> {
    const product = await this.lockProduct(tx, productId);

    // Idempotent by source-document id (spec connection rule): clamp rather than go negative, and
    // skip entirely (no row, no event) when there is nothing left to release — a repeated release
    // for an already-released holder is a true no-op, not a zero-effect ledger entry.
    const actualQty = Math.min(qty, product.quantityReserved);
    if (actualQty <= 0) return;

    const newReserved = product.quantityReserved - actualQty;

    await tx.stockMovement.create({
      data: {
        productId,
        direction: 'PENDING',
        type: MovementType.PENDING_RELEASE,
        quantity: -actualQty,
        balanceAfter: product.quantityOnHand,
        referenceType: ref.referenceType,
        referenceId: ref.referenceId,
        ...(ref.reason != null ? { reason: ref.reason } : {}),
        staffId: ref.staffId,
      },
    });

    await tx.product.update({ where: { id: productId }, data: { quantityReserved: newReserved } });

    // release only ever increases available (reserved decreasing) — mathematically never a
    // downward low-stock cross, but the check stays uniform with every other mutating method.
    const preAvailable = InventoryMapper.availableQuantity(product);
    const postAvailable = InventoryMapper.availableQuantity({ quantityOnHand: product.quantityOnHand, quantityReserved: newReserved });
    this.checkAndBufferLowStock(tx, productId, preAvailable, postAvailable, product.reorderThreshold);
    this.buffer(tx, {
      name: 'inventory.stockChanged',
      payload: { productId, onHand: product.quantityOnHand, reserved: newReserved },
    });
  }

  async addLayer(
    tx: Prisma.TransactionClient,
    productId: string,
    qty: number,
    unitCost: number,
    type: MovementType,
    ref: MovementRef,
  ): Promise<AddLayerResult> {
    return this.addLayerCore(tx, productId, qty, unitCost, type, ref);
  }

  async consumeFifo(
    tx: Prisma.TransactionClient,
    productId: string,
    qty: number,
    revenue: number | null,
    type: MovementType,
    ref: MovementRef,
  ): Promise<ConsumeFifoResult> {
    const product = await this.lockProduct(tx, productId);
    const preAvailable = InventoryMapper.availableQuantity(product);
    if (qty > preAvailable) {
      throw new ConflictError('INSUFFICIENT_STOCK', { productId, requested: qty, available: preAvailable });
    }

    // Read-only drain plan first — nothing is written until every layer is accounted for, so an
    // over-consume (caught above) or a broken invariant (caught below) leaves zero rows.
    const layers = await tx.stockMovement.findMany({
      where: { productId, direction: 'IN', remainingQuantity: { gt: 0 } },
      orderBy: { createdAt: 'asc' },
    });

    let remaining = qty;
    let costOfGoods = 0;
    const drains: { layerId: string; drainQty: number; unitCost: number }[] = [];
    for (const layer of layers) {
      if (remaining <= 0) break;
      const layerRemaining = layer.remainingQuantity ?? 0;
      if (layerRemaining <= 0) continue;
      const drainQty = Math.min(remaining, layerRemaining);
      const layerUnitCost = layer.unitCost!.toNumber(); // IN layers always carry unitCost
      drains.push({ layerId: layer.id, drainQty, unitCost: layerUnitCost });
      costOfGoods += drainQty * layerUnitCost;
      remaining -= drainQty;
    }
    if (remaining > 0) {
      throw new Error(
        `consumeFifo(): FIFO layers for product ${productId} could not supply ${qty} units (${remaining} short) — the remainingQuantity invariant is broken`,
      );
    }

    const newOnHand = product.quantityOnHand - qty;
    const profit = revenue != null ? revenue - costOfGoods : null;

    const movement = await tx.stockMovement.create({
      data: {
        productId,
        direction: 'OUT',
        type,
        quantity: -qty,
        costOfGoods,
        ...(profit != null ? { profit } : {}),
        balanceAfter: newOnHand,
        referenceType: ref.referenceType,
        referenceId: ref.referenceId,
        ...(ref.reason != null ? { reason: ref.reason } : {}),
        staffId: ref.staffId,
      },
    });

    const consumptions: ConsumptionLine[] = [];
    for (const drain of drains) {
      await tx.stockMovementConsumption.create({
        data: {
          outMovementId: movement.id,
          inMovementId: drain.layerId,
          quantityConsumed: drain.drainQty,
          unitCost: drain.unitCost,
        },
      });
      await tx.stockMovement.update({
        where: { id: drain.layerId },
        data: { remainingQuantity: { decrement: drain.drainQty } },
      });
      consumptions.push({ inMovementId: drain.layerId, qty: drain.drainQty, unitCost: drain.unitCost });
    }

    await tx.product.update({ where: { id: productId }, data: { quantityOnHand: newOnHand } });

    const postAvailable = InventoryMapper.availableQuantity({ quantityOnHand: newOnHand, quantityReserved: product.quantityReserved });
    this.checkAndBufferLowStock(tx, productId, preAvailable, postAvailable, product.reorderThreshold);
    this.buffer(tx, {
      name: 'inventory.stockChanged',
      payload: { productId, onHand: newOnHand, reserved: product.quantityReserved },
    });

    return { movementId: movement.id, costOfGoods, profit, consumptions };
  }

  async returnIn(
    tx: Prisma.TransactionClient,
    originalConsumptions: ConsumptionLine[],
    qty: number,
    ref: MovementRef,
  ): Promise<ReturnInResult> {
    const [firstConsumption] = originalConsumptions;
    if (!firstConsumption) throw new Error('returnIn(): originalConsumptions must not be empty');
    const total = originalConsumptions.reduce((sum, c) => sum + c.qty, 0);
    if (total !== qty) {
      throw new Error(`returnIn(): qty (${qty}) does not match the sum of originalConsumptions (${total})`);
    }

    const firstLayer = await tx.stockMovement.findUnique({ where: { id: firstConsumption.inMovementId } });
    if (!firstLayer) throw new NotFoundError('StockMovement');
    const productId = firstLayer.productId;

    // Group by original unit cost — one prior sale can span multiple FIFO layers at different
    // costs; recreate one layer per distinct cost so future consumeFifo calls keep drawing at the
    // true original costs, not a blended average (spec Test Scenarios: "returnIn at 150, not avg").
    const groups = new Map<number, number>();
    for (const consumption of originalConsumptions) {
      groups.set(consumption.unitCost, (groups.get(consumption.unitCost) ?? 0) + consumption.qty);
    }

    let lastMovementId = '';
    for (const [unitCost, groupQty] of groups) {
      const { movementId } = await this.addLayerCore(tx, productId, groupQty, unitCost, MovementType.RETURN_IN, ref);
      lastMovementId = movementId;
    }

    return { movementId: lastMovementId };
  }

  flushEvents(tx: Prisma.TransactionClient): void {
    const events = this.eventBuffers.get(tx);
    if (!events) return;
    this.eventBuffers.delete(tx);
    for (const event of events) {
      if (event.name === 'inventory.stockChanged') eventBus.emit('inventory.stockChanged', event.payload);
      else eventBus.emit('inventory.lowStock', event.payload);
    }
  }

  // Shared by public addLayer and returnIn's per-cost-group loop — both are IN-direction writes
  // that recompute averageCost the same way (spec BL#3 applies to every IN movement, RETURN_IN
  // included).
  private async addLayerCore(
    tx: Prisma.TransactionClient,
    productId: string,
    qty: number,
    unitCost: number,
    type: MovementType,
    ref: MovementRef,
  ): Promise<AddLayerResult> {
    const product = await this.lockProduct(tx, productId);
    const preAvailable = InventoryMapper.availableQuantity(product);
    const newOnHand = product.quantityOnHand + qty;
    const oldAvg = product.averageCost.toNumber();
    const newAvg = newOnHand === 0 ? 0 : (product.quantityOnHand * oldAvg + qty * unitCost) / newOnHand;

    const movement = await tx.stockMovement.create({
      data: {
        productId,
        direction: 'IN',
        type,
        quantity: qty,
        unitCost,
        remainingQuantity: qty,
        balanceAfter: newOnHand,
        referenceType: ref.referenceType,
        referenceId: ref.referenceId,
        ...(ref.reason != null ? { reason: ref.reason } : {}),
        staffId: ref.staffId,
      },
    });

    await tx.product.update({ where: { id: productId }, data: { quantityOnHand: newOnHand, averageCost: newAvg } });

    // addLayer/returnIn only ever increase onHand (available goes up) — never a downward
    // low-stock cross, but the check stays uniform with consumeFifo/reserve for one code path.
    const postAvailable = InventoryMapper.availableQuantity({ quantityOnHand: newOnHand, quantityReserved: product.quantityReserved });
    this.checkAndBufferLowStock(tx, productId, preAvailable, postAvailable, product.reorderThreshold);
    this.buffer(tx, {
      name: 'inventory.stockChanged',
      payload: { productId, onHand: newOnHand, reserved: product.quantityReserved },
    });

    return { movementId: movement.id };
  }

  // Locks the Product row for the duration of the caller's transaction (SequenceService's own
  // `SELECT ... FOR UPDATE` precedent — platform.service.ts). Every mutating method above starts
  // here, so this single row lock is the serialization point for a product's entire inventory
  // state: onHand, reserved, averageCost, and — since nothing else ever writes StockMovement rows
  // — its FIFO layers too. Concurrent calls for the *same* product queue behind this lock;
  // different products never contend.
  private async lockProduct(tx: Prisma.TransactionClient, productId: string): Promise<Product> {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
    if (!rows[0]) throw new NotFoundError('Product');
    return tx.product.findUniqueOrThrow({ where: { id: productId } });
  }

  private buffer(tx: Prisma.TransactionClient, event: BufferedEvent): void {
    const events = this.eventBuffers.get(tx) ?? [];
    events.push(event);
    this.eventBuffers.set(tx, events);
  }

  private checkAndBufferLowStock(
    tx: Prisma.TransactionClient,
    productId: string,
    preAvailable: number,
    postAvailable: number,
    threshold: number,
  ): void {
    const wasLow = InventoryMapper.isLow(preAvailable, threshold);
    const isLow = InventoryMapper.isLow(postAvailable, threshold);
    if (!wasLow && isLow) {
      this.buffer(tx, { name: 'inventory.lowStock', payload: { productId, available: postAvailable, threshold } });
    }
  }

  // Reservations only ever come from ORDER or REPAIR documents (spec: "reserve(...) //
  // PENDING_ORDER / PENDING_REPAIR") — derived from the caller-supplied referenceType rather than
  // a redundant explicit parameter.
  private static reservationType(referenceType: string): MovementType {
    if (referenceType === 'REPAIR') return MovementType.PENDING_REPAIR;
    if (referenceType === 'ORDER') return MovementType.PENDING_ORDER;
    throw new Error(`reserve(): unsupported referenceType "${referenceType}" — expected ORDER or REPAIR`);
  }
}

// HTTP-facing read/admin service — Sprint 3 implements these against the engine above. Typed
// stubs here only so the file compiles its `implements` (catalog Sprint 3 precedent). Constructor
// stays PrismaClient-only for now; Sprint 3 adds ISequenceService/ICatalogPricingPort when those
// methods are actually implemented (same precedent — catalog's stub started minimal too).
export class InventoryReadService implements IInventoryReadService {
  constructor(private prisma: PrismaClient) {}

  async getStock(_query: StockQuery): Promise<StockRowDto[] | ExportResult> {
    throw new Error('InventoryReadService.getStock() not implemented yet (see Sprint 3)');
  }

  async listMovements(_query: MovementsQuery): Promise<PaginatedResult<MovementDto>> {
    throw new Error('InventoryReadService.listMovements() not implemented yet (see Sprint 3)');
  }

  async listReservations(_query: ReservationsQuery): Promise<PaginatedResult<ReservationDto>> {
    throw new Error('InventoryReadService.listReservations() not implemented yet (see Sprint 3)');
  }

  async createAdjustment(_cmd: CreateAdjustmentCommand, _staffId: string): Promise<AdjustmentResultDto> {
    throw new Error('InventoryReadService.createAdjustment() not implemented yet (see Sprint 3)');
  }
}
