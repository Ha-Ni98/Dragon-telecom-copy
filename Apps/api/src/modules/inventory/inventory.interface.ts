import type { Prisma } from '@prisma/client';
import type {
  AdjustmentResultDto,
  CreateAdjustmentCommand,
  MovementDto,
  MovementsQuery,
  MovementType,
  PaginatedResult,
  ReservationDto,
  ReservationsQuery,
  StockQuery,
  StockRowDto,
  UpdatePricingCommand,
} from '@dragon-telecom/contract';

// Platform's ExportFeesResult isn't barrel-exported for cross-module reuse (modules exchange
// singletons/ports via routes.ts, not ad hoc type imports) — declared locally with the same shape.
export type ExportResult = { filename: string; mime: string; body: Buffer | string };

// HTTP-facing surface — every method returns a contract DTO (rules §4), never a Prisma entity.
export interface IInventoryReadService {
  // S28 — paginated like listMovements below; the export branch still returns a document instead
  // of a page (`'body' in result` is the controller's discriminant, and PaginatedResult has no
  // `body` key).
  getStock(query: StockQuery): Promise<PaginatedResult<StockRowDto> | ExportResult>;
  // S25 — export=csv|pdf returns the whole filtered ledger as a document instead of a page.
  // Same dual-return shape as getStock above.
  listMovements(query: MovementsQuery): Promise<PaginatedResult<MovementDto> | ExportResult>;
  listReservations(query: ReservationsQuery): Promise<PaginatedResult<ReservationDto>>;
  createAdjustment(cmd: CreateAdjustmentCommand, staffId: string): Promise<AdjustmentResultDto>;
}

// Internal — not a contract type. Every StockMovement row requires a staffId (acting user) plus
// its referenceType/referenceId provenance; the spec's injected signatures use a bare positional
// "ref" that carries none of this, so it's modelled here instead (plan §2.1, §8 #3).
export type MovementRef = {
  referenceType: string;
  referenceId: string;
  staffId: string;
  reason?: string;
};

export type ConsumptionLine = { inMovementId: string; qty: number; unitCost: number };

export type AddLayerResult = { movementId: string };
export type ConsumeFifoResult = {
  movementId: string;
  costOfGoods: number;
  profit: number | null;
  consumptions: ConsumptionLine[];
};
export type ReturnInResult = { movementId: string };

// S30 — the PENDING types a release may write: the generic PENDING_RELEASE, or REPAIR_CANCELLED
// for a release caused by cancelling a repair (ledger traceability only; the arithmetic is
// identical — quantityReserved down, on-hand untouched).
export type ReleaseMovementType = MovementType.PENDING_RELEASE | MovementType.REPAIR_CANCELLED;
// S30 — the IN types a returnIn may write: RETURN_IN (sales/orders) or REPAIR_RETURN (repairs).
export type ReturnInMovementType = MovementType.RETURN_IN | MovementType.REPAIR_RETURN;

// The injected engine — the spec's "Injected service [CONTRACT]" block. Every document module
// (catalog, purchasing, orders, sales, repairs) receives this. Returns the spec-mandated internal
// transactional shapes rather than DTOs (plan §8 #1): events can't carry FIFO results back into
// the caller's own transaction, and splitting the transaction could leave a sale without its
// movement. All methods run inside the *caller's* `tx` — the engine never opens its own.
export interface IInventoryService {
  reserve(tx: Prisma.TransactionClient, productId: string, qty: number, ref: MovementRef): Promise<void>;
  // S30 — `type` defaults to PENDING_RELEASE; the release is clamped to this holder's own
  // outstanding reservation (ref.referenceType + ref.referenceId), never another document's.
  release(tx: Prisma.TransactionClient, productId: string, qty: number, ref: MovementRef, type?: ReleaseMovementType): Promise<void>;
  addLayer(
    tx: Prisma.TransactionClient,
    productId: string,
    qty: number,
    unitCost: number,
    type: MovementType,
    ref: MovementRef,
  ): Promise<AddLayerResult>;
  consumeFifo(
    tx: Prisma.TransactionClient,
    productId: string,
    qty: number,
    revenue: number | null,
    type: MovementType,
    ref: MovementRef,
  ): Promise<ConsumeFifoResult>;
  returnIn(
    tx: Prisma.TransactionClient,
    originalConsumptions: ConsumptionLine[],
    qty: number,
    ref: MovementRef,
    type?: ReturnInMovementType, // S30 — defaults to RETURN_IN
  ): Promise<ReturnInResult>;

  // The post-commit flush seam (plan §7.3, §8 #6): the engine never owns the caller's
  // transaction, so it can't emit events itself once that transaction actually commits — Prisma
  // has no "after commit" hook reachable from inside the transaction callback. Every write above
  // buffers its stockChanged/lowStock payloads keyed by this same `tx` reference instead; the
  // caller must call flushEvents(tx) immediately after its own `$transaction(...)` call resolves.
  // A caller whose transaction throws never calls this, so the buffer is simply discarded
  // (garbage-collected with the `tx` object) — no phantom events on rollback.
  flushEvents(tx: Prisma.TransactionClient): void;
}

// Injected dependency inventory needs (implemented by catalog) — lets an adjustment line's
// optional reprice run inside inventory's own transaction (plan §2.1, §7.1-2, spec BL#4).
export interface ICatalogPricingPort {
  applyPricing(tx: Prisma.TransactionClient, productId: string, cmd: UpdatePricingCommand): Promise<void>;
}
