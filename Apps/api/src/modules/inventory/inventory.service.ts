import type { Prisma, PrismaClient, Product } from '@prisma/client';
import { DocType, MovementType, ReservationHolderType } from '@dragon-telecom/contract';
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
import { InventoryMapper, type AdjustmentResultLine, type ReservationGroup } from './inventory.mapper';
import type {
  AddLayerResult,
  ConsumeFifoResult,
  ConsumptionLine,
  ExportResult,
  ICatalogPricingPort,
  IInventoryReadService,
  IInventoryService,
  MovementRef,
  ReturnInResult,
} from './inventory.interface';
// Platform is already-built infrastructure (SequenceService's own interface, not a contract
// type) — the first cross-module consumer of it; every future document module (orders, sales,
// purchasing, repairs, billing) will import the same interface the same way.
import type { ISequenceService } from '../platform/platform.interface';

type BufferedEvent =
  | { name: 'inventory.stockChanged'; payload: { productId: string; onHand: number; reserved: number } }
  | { name: 'inventory.lowStock'; payload: { productId: string; available: number; threshold: number } };

// Which IN movements count as a "purchase receipt" for Product.avgPrice (D10, plan S1 R1).
// RETURN_IN re-enters stock at the original consumed cost (not a purchase) and ADJUSTMENT_IN's
// unit cost defaults to avgStockPrice (which would make avgPrice circular) — both excluded.
const PURCHASE_RECEIPT_TYPES: MovementType[] = [MovementType.SUPPLIER_INVOICE, MovementType.INITIAL_STOCK];

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
  // that recompute avgStockPrice the same way (spec BL#3 applies to every IN movement, RETURN_IN
  // included). avgPrice (D10) only moves for purchase-receipt types (PURCHASE_RECEIPT_TYPES) —
  // RETURN_IN and ADJUSTMENT_IN never touch it.
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
    const oldAvgStockPrice = product.avgStockPrice.toNumber();
    const newAvgStockPrice = newOnHand === 0 ? 0 : (product.quantityOnHand * oldAvgStockPrice + qty * unitCost) / newOnHand;

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

    // Recomputed by aggregate (over every purchase-receipt IN row for this product, including the
    // one just created) rather than an incremental running mean — this can never drift from its
    // own definition, and the product lock held since lockProduct() above means no concurrent IN
    // row can appear mid-computation.
    let newAvgPrice = product.avgPrice.toNumber();
    if (PURCHASE_RECEIPT_TYPES.includes(type)) {
      const receiptAvg = await tx.stockMovement.aggregate({
        _avg: { unitCost: true },
        where: { productId, direction: 'IN', type: { in: PURCHASE_RECEIPT_TYPES } },
      });
      newAvgPrice = receiptAvg._avg.unitCost?.toNumber() ?? 0;
    }

    await tx.product.update({
      where: { id: productId },
      data: { quantityOnHand: newOnHand, avgStockPrice: newAvgStockPrice, avgPrice: newAvgPrice },
    });

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
  // state: onHand, reserved, avgStockPrice, avgPrice, and — since nothing else ever writes
  // StockMovement rows — its FIFO layers too. Concurrent calls for the *same* product queue
  // behind this lock; different products never contend.
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

const STOCK_ROW_CSV_HEADERS = [
  'productId',
  'name',
  'barcode',
  'quantityOnHand',
  'quantityReserved',
  'availableQuantity',
  'avgStockPrice',
  'stockValue',
  'reorderThreshold',
  'isLow',
];

// HTTP-facing read/admin service. Constructor takes the FIFO engine plus the two injected ports
// `createAdjustment` needs — the engine dependency wasn't listed in the plan's constructor
// signature, but is required by the very next line of the same task (delta>0/<0 delegate to
// engine.addLayer/consumeFifo) — filled in as an implementation necessity, not a redesign.
export class InventoryReadService implements IInventoryReadService {
  constructor(
    private prisma: PrismaClient,
    private sequence: ISequenceService,
    private catalogPricing: ICatalogPricingPort,
    private engine: IInventoryService,
  ) {}

  async getStock(query: StockQuery): Promise<StockRowDto[] | ExportResult> {
    // Name is a case-insensitive substring match; barcode is a prefix match so it can use the
    // `Product.barcode @unique` btree index (S1 finding F1 — a `contains` predicate could not).
    // A scanner emits a whole barcode, so `startsWith` also covers the exact-scan case.
    const where: Prisma.ProductWhereInput = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { barcode: { startsWith: query.search } },
          ],
        }
      : {};
    const products = await this.prisma.product.findMany({ where, orderBy: { name: 'asc' } });
    const rows = products.map((product) => InventoryMapper.toStockRowDto(product));
    const filtered = query.lowStockOnly ? rows.filter((row) => row.isLow) : rows;

    if (query.export === 'csv') {
      const lines = [
        STOCK_ROW_CSV_HEADERS.join(','),
        ...filtered.map((row) =>
          [
            row.productId,
            row.name,
            row.barcode ?? '',
            row.quantityOnHand,
            row.quantityReserved,
            row.availableQuantity,
            row.avgStockPrice,
            row.stockValue,
            row.reorderThreshold,
            row.isLow,
          ].join(','),
        ),
      ];
      return { filename: 'stock.csv', mime: 'text/csv', body: lines.join('\n') };
    }

    return filtered;
  }

  async listMovements(query: MovementsQuery): Promise<PaginatedResult<MovementDto>> {
    const toExclusive = query.to ? new Date(new Date(query.to).getTime() + 86_400_000) : undefined;
    const where: Prisma.StockMovementWhereInput = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.staffId ? { staffId: query.staffId } : {}),
      ...(query.from || toExclusive
        ? { createdAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(toExclusive ? { lt: toExclusive } : {}) } }
        : {}),
      // Product search — same name/barcode predicate as getStock, applied through the movement's
      // product relation (StockMovement itself carries no product name or barcode).
      ...(query.search
        ? {
            product: {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' as const } },
                { barcode: { startsWith: query.search } },
              ],
            },
          }
        : {}),
    };

    const [total, movements] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        include: { product: { select: { name: true } }, staff: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    // RC-4: resolve every movement's source document to its human reference.
    const labelsByKey = await this.resolveReferenceLabels(movements);

    const items = movements.map((movement) => {
      const resolvedName =
        movement.referenceType === 'PRODUCT'
          ? movement.product.name
          : labelsByKey.get(`${movement.referenceType}:${movement.referenceId}`);
      const referenceLabel = InventoryMapper.resolveReferenceLabel(movement.referenceType, movement.referenceId, resolvedName);
      return InventoryMapper.toMovementDto(movement, movement.product, movement.staff, referenceLabel);
    });

    return { items, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  // Resolves each movement/reservation's source document to its human reference (ORD-…, SAL-…,
  // REP-…, RET-…, FAC-…, AJU-…) — RC-4. One batched query per referenceType, keyed by
  // `${referenceType}:${referenceId}` so the RETURN fallback below can never collide with a
  // same-id hit from another type.
  //
  // RETURN is the awkward one: sales passes the Return.id, orders passes the Order.id and repairs
  // passes the Repair.id for the very same referenceType (plan S1 finding F2), so it is resolved
  // by trying all three tables and taking whichever id exists. S10 and S13 should normalise their
  // writers; until then this fallback chain is the only correct read.
  private async resolveReferenceLabels(
    rows: { referenceType: string; referenceId: string }[],
  ): Promise<Map<string, string>> {
    const idsOf = (type: string) => rows.filter((r) => r.referenceType === type).map((r) => r.referenceId);
    const adjustmentIds = idsOf('ADJUSTMENT');
    const supplierInvoiceIds = idsOf('SUPPLIER_INVOICE');
    const saleIds = idsOf('SALE');
    const orderIds = idsOf('ORDER');
    const repairIds = idsOf('REPAIR');
    const returnCandidateIds = idsOf('RETURN');

    const [adjustments, supplierInvoices, sales, orders, repairs, returns, returnOrders, returnRepairs] = await Promise.all([
      adjustmentIds.length
        ? this.prisma.stockAdjustment.findMany({ where: { id: { in: adjustmentIds } }, select: { id: true, reference: true } })
        : [],
      supplierInvoiceIds.length
        ? this.prisma.supplierInvoice.findMany({ where: { id: { in: supplierInvoiceIds } }, select: { id: true, reference: true } })
        : [],
      saleIds.length ? this.prisma.sale.findMany({ where: { id: { in: saleIds } }, select: { id: true, reference: true } }) : [],
      orderIds.length ? this.prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, reference: true } }) : [],
      repairIds.length ? this.prisma.repair.findMany({ where: { id: { in: repairIds } }, select: { id: true, reference: true } }) : [],
      returnCandidateIds.length
        ? this.prisma.return.findMany({ where: { id: { in: returnCandidateIds } }, select: { id: true, reference: true } })
        : [],
      returnCandidateIds.length
        ? this.prisma.order.findMany({ where: { id: { in: returnCandidateIds } }, select: { id: true, reference: true } })
        : [],
      returnCandidateIds.length
        ? this.prisma.repair.findMany({ where: { id: { in: returnCandidateIds } }, select: { id: true, reference: true } })
        : [],
    ]);

    const map = new Map<string, string>();
    for (const a of adjustments) map.set(`ADJUSTMENT:${a.id}`, a.reference);
    for (const s of supplierInvoices) map.set(`SUPPLIER_INVOICE:${s.id}`, s.reference);
    for (const s of sales) map.set(`SALE:${s.id}`, s.reference);
    for (const o of orders) map.set(`ORDER:${o.id}`, o.reference);
    for (const r of repairs) map.set(`REPAIR:${r.id}`, r.reference);
    // First hit wins across the three RETURN sources — Return, then Order, then Repair.
    for (const r of returns) if (!map.has(`RETURN:${r.id}`)) map.set(`RETURN:${r.id}`, r.reference);
    for (const o of returnOrders) if (!map.has(`RETURN:${o.id}`)) map.set(`RETURN:${o.id}`, o.reference);
    for (const r of returnRepairs) if (!map.has(`RETURN:${r.id}`)) map.set(`RETURN:${r.id}`, r.reference);
    return map;
  }

  async listReservations(query: ReservationsQuery): Promise<PaginatedResult<ReservationDto>> {
    const groups = await this.prisma.stockMovement.groupBy({
      by: ['productId', 'referenceType', 'referenceId'],
      where: { direction: 'PENDING' },
      _sum: { quantity: true },
      _min: { createdAt: true },
    });

    // Open holders only (net signed PENDING sum > 0 — a fully released holder nets to 0);
    // oldest-first, the most actionable ordering for an admin reviewing stale reservations.
    // Paginated in-memory rather than at the DB level (Prisma groupBy + having + accurate total
    // count is awkward to combine) — acceptable since this is a bounded "currently open" set,
    // not unbounded history; flagged in the report if the owner wants true DB-level paging later.
    const openGroups = groups
      .filter((group) => (group._sum.quantity ?? 0) > 0)
      .sort((a, b) => (a._min.createdAt?.getTime() ?? 0) - (b._min.createdAt?.getTime() ?? 0));

    const total = openGroups.length;
    const start = (query.page - 1) * query.limit;
    const pageGroups = openGroups.slice(start, start + query.limit);

    const productIds = [...new Set(pageGroups.map((group) => group.productId))];
    const products = productIds.length
      ? await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
      : [];
    const productNameById = new Map(products.map((product) => [product.id, product.name]));

    // RC-4: resolve every open holder's reference the same way listMovements does — previously
    // this passed no resolvedName at all, so every row rendered "ORDER a1b2c3d4".
    const labelsByKey = await this.resolveReferenceLabels(pageGroups);

    const now = new Date();
    const items = pageGroups.map((group) => {
      // Reservations only ever come from ORDER/REPAIR documents (mirrors the engine's own
      // reservationType derivation, inverted) — no third holder type exists.
      const holderType = group.referenceType === 'REPAIR' ? ReservationHolderType.REPAIR : ReservationHolderType.ORDER;
      const resolvedName = labelsByKey.get(`${group.referenceType}:${group.referenceId}`);
      const reservationGroup: ReservationGroup = {
        productId: group.productId,
        quantity: group._sum.quantity ?? 0,
        holderType,
        holderReference: InventoryMapper.resolveReferenceLabel(group.referenceType, group.referenceId, resolvedName),
        ageHours: InventoryMapper.ageHours(group._min.createdAt ?? now, now),
      };
      return InventoryMapper.toReservationDto(reservationGroup, { name: productNameById.get(group.productId) ?? 'Unknown product' });
    });

    return { items, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async createAdjustment(cmd: CreateAdjustmentCommand, staffId: string): Promise<AdjustmentResultDto> {
    const resultLines: AdjustmentResultLine[] = [];
    let reference = '';
    let capturedTx!: Prisma.TransactionClient;

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      reference = await this.sequence.nextNumber(tx, DocType.ADJUSTMENT);

      const adjustment = await tx.stockAdjustment.create({
        data: {
          reference,
          reason: cmd.reason,
          ...(cmd.note != null ? { note: cmd.note } : {}),
          staffId,
        },
      });

      for (const line of cmd.lines) {
        // Plain (unlocked) read — deciding IN vs OUT vs no-op needs *some* current quantity
        // before the engine can even be called, and the engine's own SELECT...FOR UPDATE is the
        // actual correctness guarantee for the ledger math. A rare concurrent write between this
        // read and the engine's locked read could make this line's recorded `previousQuantity`
        // slightly stale, but can never corrupt the ledger: the engine re-reads under lock, and a
        // genuine conflict (e.g. stock consumed elsewhere mid-adjustment) surfaces as this whole
        // transaction rolling back with 409 INSUFFICIENT_STOCK, not a silent wrong delta.
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        if (!product) throw new NotFoundError('Product');

        const previousQuantity = product.quantityOnHand;
        const delta = line.countedQuantity - previousQuantity;
        const ref: MovementRef = {
          referenceType: 'ADJUSTMENT',
          referenceId: adjustment.id,
          staffId,
          ...(cmd.note != null ? { reason: cmd.note } : {}),
        };

        let movementId: string | undefined;
        let lineUnitCost: number | undefined;

        if (delta > 0) {
          lineUnitCost = line.unitCost ?? product.avgStockPrice.toNumber();
          const result = await this.engine.addLayer(tx, line.productId, delta, lineUnitCost, MovementType.ADJUSTMENT_IN, ref);
          movementId = result.movementId;
        } else if (delta < 0) {
          const result = await this.engine.consumeFifo(tx, line.productId, -delta, null, MovementType.ADJUSTMENT_OUT, ref);
          movementId = result.movementId;
        }

        if (line.prices) {
          await this.catalogPricing.applyPricing(tx, line.productId, line.prices);
        }

        await tx.stockAdjustmentLine.create({
          data: {
            adjustmentId: adjustment.id,
            productId: line.productId,
            countedQuantity: line.countedQuantity,
            previousQuantity,
            delta,
            ...(lineUnitCost != null ? { unitCost: lineUnitCost } : {}),
          },
        });

        // delta=0 reprice-only lines carry no movement — AdjustmentResultDto.lines[].movementId
        // is a required uuid, so a line with nothing to report simply doesn't appear (plan §3.4
        // "no movement"; the reprice itself still ran above, just isn't reflected in this shape).
        if (movementId != null) {
          resultLines.push({ productId: line.productId, delta, movementId });
        }
      }
    });

    this.engine.flushEvents(capturedTx);
    eventBus.emit('inventory.adjusted', { reference, description: `Stock adjustment ${reference} (${cmd.reason})` });

    return InventoryMapper.toAdjustmentResultDto({ reference }, resultLines);
  }
}
