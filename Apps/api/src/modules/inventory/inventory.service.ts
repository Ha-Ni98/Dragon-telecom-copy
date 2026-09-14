import type { Prisma, PrismaClient, Product } from '@prisma/client';
import { DocType, EXPORT_ERROR, EXPORT_MAX_ROWS, MovementType, ReservationHolderType } from '@dragon-telecom/contract';
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
import { BadRequestError, ConflictError, NotFoundError } from '@common/errors';
import { eventBus } from '@common/events/event-bus';
import { csvDate, csvMoney, toCsv, CSV_MIME } from '@common/utils/csv.utils';
import { renderTablePdf } from '@common/utils/pdf.utils';
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

    // S23 — a FIFO OUT changes the average cost of what is LEFT: the layers this movement drained
    // are not priced at the average, so removing them shifts it. Computed as the identity
    // Σ(remaining layer qty × layer cost) ÷ Σ(remaining qty) rather than the incremental
    // (oldAvg × onHandBefore − costOfGoods) ÷ onHandAfter: the stored column is Decimal(12,2), and
    // feeding a rounded average back in amplifies its residual by onHandBefore/onHandAfter at
    // every OUT. `layers` (loaded above, before any write) is every live layer, and `costOfGoods`
    // is exactly what this movement takes out of them — so the subtraction below IS the identity,
    // at zero extra queries. `unitCost` is non-null on every IN row by construction (addLayerCore
    // always writes it); the same assumption the drain loop above already makes.
    const layerValueBefore = layers.reduce(
      (sum, layer) => sum + (layer.remainingQuantity ?? 0) * layer.unitCost!.toNumber(),
      0,
    );
    const layerValueAfter = layerValueBefore - costOfGoods;

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

    await tx.product.update({
      where: { id: productId },
      data: {
        quantityOnHand: newOnHand,
        // Zero on hand → keep the last average (S23 rule), never reset and never divide by zero:
        // it keeps margin displays and the adjustment default meaningful for a temporarily
        // out-of-stock product, and the next IN overwrites it anyway. Omitting the key leaves the
        // column untouched.
        ...(newOnHand > 0 ? { avgStockPrice: layerValueAfter / newOnHand } : {}),
      },
    });

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
  // that recompute avgStockPrice the same way, for every IN type including RETURN_IN (which
  // re-enters at the ORIGINAL consumed cost, not the current average). Since S23 the OUT side
  // recomputes too, from the layer identity in consumeFifo — the column is maintained on IN *and*
  // OUT, and left alone by the three PENDING types. avgPrice (D10) only moves for purchase-receipt
  // types (PURCHASE_RECEIPT_TYPES) — RETURN_IN and ADJUSTMENT_IN never touch it.
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
    // Weighted by quantityOnHand — physical layers, never onHand − reserved. The zero guard can
    // only fire on a broken invariant (every caller passes qty > 0 and onHand is never negative);
    // it keeps the last average rather than resetting, matching consumeFifo's zero rule (S23).
    const newAvgStockPrice =
      newOnHand === 0 ? oldAvgStockPrice : (product.quantityOnHand * oldAvgStockPrice + qty * unitCost) / newOnHand;

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

const MOVEMENT_ROW_CSV_HEADERS = [
  'createdAt',
  'reference',
  'referenceType',
  'type',
  'direction',
  'productId',
  'productName',
  'quantity',
  'unitCost',
  'costOfGoods',
  'profit',
  'balanceAfter',
  'staffName',
  'reason',
];

// Shared `include` for every listMovements read (paginated and export) so the two branches stay
// on the identical relation shape — and so toMovementDtos below has one payload type to accept.
const MOVEMENT_INCLUDE = {
  product: { select: { name: true } },
  staff: { select: { firstName: true, lastName: true } },
} satisfies Prisma.StockMovementInclude;
type MovementWithRelations = Prisma.StockMovementGetPayload<{ include: typeof MOVEMENT_INCLUDE }>;

// S25 — every export in this module is a single in-memory document, so an unbounded result set
// would hold the request open while it serialised. Callers ask for EXPORT_MAX_ROWS + 1 rows and
// hand the count here; the sentinel reaches the user as a translated message via
// query-client.ts's SENTINEL_TRANSLATION_KEYS, telling them to narrow the filters.
const assertExportSize = (total: number): void => {
  if (total > EXPORT_MAX_ROWS) {
    throw new BadRequestError(EXPORT_ERROR.ROW_LIMIT_EXCEEDED, { limit: EXPORT_MAX_ROWS, total });
  }
};

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

  // S28 — the Stock tab is paginated server-side (20/page by schema default), so the whole
  // catalogue is no longer mapped on every page view. `lowStockOnly` cannot be a Prisma
  // predicate: isLow is `quantityOnHand - quantityReserved <= reorderThreshold`, a three-column
  // arithmetic comparison that neither `where` nor `fieldRef` can express. It is resolved as a
  // one-column id pre-query instead (buildStockWhere below), which keeps ONE `where` — and
  // therefore one search predicate, one ordering and one row count — shared by the paginated and
  // the export branch.
  async getStock(query: StockQuery): Promise<PaginatedResult<StockRowDto> | ExportResult> {
    const where = await this.buildStockWhere(query);

    if (query.export) {
      // `page`/`limit` carry schema defaults and are ignored here on purpose (contract comment on
      // StockQuerySchema.export). The +1 is what makes the EXPORT_MAX_ROWS ceiling detectable —
      // same idiom as listMovements; before S28 this branch read the table unbounded.
      const products = await this.prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        take: EXPORT_MAX_ROWS + 1,
      });
      assertExportSize(products.length);
      const rows = products.map((product) => InventoryMapper.toStockRowDto(product));
      if (query.export === 'pdf') return this.stockPdf(rows, query);
      return this.stockCsv(rows);
    }

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      items: products.map((product) => InventoryMapper.toStockRowDto(product)),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  // Name is a case-insensitive substring match; barcode is a prefix match so it can use the
  // `Product.barcode @unique` btree index (S1 finding F1 — a `contains` predicate could not).
  // A scanner emits a whole barcode, so `startsWith` also covers the exact-scan case.
  //
  // S28 — the low-stock arm is the only raw SQL in this module's read path. It selects ids only
  // (one column, and only the rows already below threshold), then feeds them back into the same
  // Prisma `where`, so paging, counting, ordering and the export all stay on one code path.
  // The predicate below MUST stay identical to InventoryMapper.isLow — if that rule ever changes,
  // change both.
  private async buildStockWhere(query: StockQuery): Promise<Prisma.ProductWhereInput> {
    const search: Prisma.ProductWhereInput = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { barcode: { startsWith: query.search } },
          ],
        }
      : {};

    if (!query.lowStockOnly) return search;

    const lowStockIds = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Product" WHERE "quantityOnHand" - "quantityReserved" <= "reorderThreshold"
    `;
    // An empty id list yields `{ id: { in: [] } }`, which Prisma resolves to zero rows — the
    // correct answer when nothing is below threshold, not "no filter".
    return { ...search, id: { in: lowStockIds.map((row) => row.id) } };
  }

  private stockCsv(rows: StockRowDto[]): ExportResult {
    return {
      filename: 'stock.csv',
      mime: CSV_MIME,
      body: toCsv(
        STOCK_ROW_CSV_HEADERS,
        rows.map((row) => [
          row.productId,
          row.name,
          row.barcode ?? '',
          row.quantityOnHand,
          row.quantityReserved,
          row.availableQuantity,
          csvMoney(row.avgStockPrice),
          csvMoney(row.stockValue),
          row.reorderThreshold,
          row.isLow,
        ]),
      ),
    };
  }

  private async stockPdf(rows: StockRowDto[], query: StockQuery): Promise<ExportResult> {
    const filters: { label: string; value: string }[] = [];
    if (query.search) filters.push({ label: 'Search', value: query.search });
    if (query.lowStockOnly) filters.push({ label: 'Low stock only', value: 'Yes' });

    const body = await renderTablePdf({
      title: 'Stock levels',
      filters,
      generatedAt: new Date(),
      orientation: 'landscape',
      columns: [
        { header: 'Product', width: 6 },
        { header: 'Barcode', width: 3 },
        { header: 'On hand', width: 2, align: 'right' },
        { header: 'Reserved', width: 2, align: 'right' },
        { header: 'Available', width: 2, align: 'right' },
        // The quantity-weighted figure S23 corrected — never avgPrice, which is
        // supplier-invoice context only.
        { header: 'Avg stock price', width: 3, align: 'right' },
        { header: 'Stock value', width: 3, align: 'right' },
        { header: 'Threshold', width: 2, align: 'right' },
        { header: 'Low', width: 1.5 },
      ],
      rows: rows.map((row) => [
        row.name,
        row.barcode ?? '',
        String(row.quantityOnHand),
        String(row.quantityReserved),
        String(row.availableQuantity),
        row.avgStockPrice.toFixed(2),
        row.stockValue.toFixed(2),
        String(row.reorderThreshold),
        row.isLow ? 'Yes' : 'No',
      ]),
    });
    return { filename: 'stock.pdf', mime: 'application/pdf', body };
  }

  async listMovements(query: MovementsQuery): Promise<PaginatedResult<MovementDto> | ExportResult> {
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

    if (query.export) {
      // `page`/`limit` carry schema defaults and are ignored here on purpose (contract comment on
      // MovementsQuerySchema.export): an export of only the page on screen is the defect S25
      // fixes.
      const movements = await this.prisma.stockMovement.findMany({
        where,
        include: MOVEMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: EXPORT_MAX_ROWS + 1, // one extra row is what makes the ceiling detectable
      });
      assertExportSize(movements.length);
      const items = await this.toMovementDtos(movements);
      return query.export === 'pdf' ? this.movementsPdf(items, query) : this.movementsCsv(items);
    }

    const [total, movements] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        include: MOVEMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    const items = await this.toMovementDtos(movements);

    return { items, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  // Shared by the paginated branch and the export branch above so both produce identical
  // MovementDtos — resolveReferenceLabels' RETURN fallback chain (documented on that method) is
  // exactly the kind of logic that drifts when copied instead of shared.
  private async toMovementDtos(movements: MovementWithRelations[]): Promise<MovementDto[]> {
    // RC-4: resolve every movement's source document to its human reference.
    const labelsByKey = await this.resolveReferenceLabels(movements);

    return movements.map((movement) => {
      const resolvedName =
        movement.referenceType === 'PRODUCT'
          ? movement.product.name
          : labelsByKey.get(`${movement.referenceType}:${movement.referenceId}`);
      const referenceLabel = InventoryMapper.resolveReferenceLabel(movement.referenceType, movement.referenceId, resolvedName);
      return InventoryMapper.toMovementDto(movement, movement.product, movement.staff, referenceLabel);
    });
  }

  private movementsCsv(items: MovementDto[]): ExportResult {
    return {
      filename: 'movements.csv',
      mime: CSV_MIME,
      body: toCsv(
        MOVEMENT_ROW_CSV_HEADERS,
        items.map((item) => [
          csvDate(item.createdAt),
          item.referenceLabel,
          item.referenceType,
          item.type,
          item.direction,
          item.productId,
          item.productName,
          item.quantity,
          item.unitCost != null ? csvMoney(item.unitCost) : '',
          item.costOfGoods != null ? csvMoney(item.costOfGoods) : '',
          item.profit != null ? csvMoney(item.profit) : '',
          item.balanceAfter,
          item.staffName,
          item.reason ?? '',
        ]),
      ),
    };
  }

  private async movementsPdf(items: MovementDto[], query: MovementsQuery): Promise<ExportResult> {
    // Resolving productId/staffId to names is worth the two extra reads — printing a raw UUID in
    // the title block is useless. Both are skipped when the filter is unset.
    const filters: { label: string; value: string }[] = [];
    if (query.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: query.productId }, select: { name: true } });
      if (product) filters.push({ label: 'Product', value: product.name });
    }
    if (query.staffId) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: query.staffId },
        select: { firstName: true, lastName: true },
      });
      if (staff) filters.push({ label: 'Staff', value: `${staff.firstName} ${staff.lastName}` });
    }
    if (query.type) filters.push({ label: 'Type', value: query.type });
    if (query.from) filters.push({ label: 'From', value: query.from });
    if (query.to) filters.push({ label: 'To', value: query.to });
    if (query.search) filters.push({ label: 'Search', value: query.search });

    const body = await renderTablePdf({
      title: 'Stock movement ledger',
      filters,
      generatedAt: new Date(),
      orientation: 'landscape',
      columns: [
        { header: 'Date', width: 3 },
        { header: 'Reference', width: 3.5 },
        { header: 'Type', width: 3.5 },
        { header: 'Dir', width: 1.2 },
        { header: 'Product', width: 6 },
        { header: 'Qty', width: 1.3, align: 'right' },
        { header: 'Unit cost', width: 2.2, align: 'right' },
        { header: 'Cost of goods', width: 2.4, align: 'right' },
        { header: 'Profit', width: 2.2, align: 'right' },
        { header: 'Balance', width: 1.8, align: 'right' },
        { header: 'Staff', width: 3 },
        // `reason` is deliberately dropped here: it is free text of unbounded length and would
        // dominate the row now that cells wrap and rows grow to fit (S28). The CSV
        // (movementsCsv above) carries it in full.
      ],
      // csvDate is a general UTC date formatter despite the name — reused here for the PDF's Date
      // column too, so both exports agree on the same timestamp format.
      rows: items.map((item) => [
        csvDate(item.createdAt),
        item.referenceLabel,
        item.type,
        item.direction,
        item.productName,
        String(item.quantity),
        item.unitCost != null ? item.unitCost.toFixed(2) : '',
        item.costOfGoods != null ? item.costOfGoods.toFixed(2) : '',
        item.profit != null ? item.profit.toFixed(2) : '',
        String(item.balanceAfter),
        item.staffName,
      ]),
    });
    return { filename: 'movements.pdf', mime: 'application/pdf', body };
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
