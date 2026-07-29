import type { Prisma, Product, StockAdjustment, StockMovement, Staff } from '@prisma/client';
import {
  AdjustmentResultResponseSchema,
  MovementResponseSchema,
  ReservationResponseSchema,
  StockRowResponseSchema,
  type AdjustmentResultDto,
  type MovementDirection,
  type MovementDto,
  type MovementReferenceType,
  type MovementType,
  type ReservationDto,
  type ReservationHolderType,
  type StockRowDto,
} from '@dragon-telecom/contract';

type Money = Prisma.Decimal | number;

export type AdjustmentResultLine = { productId: string; delta: number; movementId: string };

// Already-aggregated shape for one open holder (productId, referenceType, referenceId) — the
// service (Sprint 3) groups live PENDING movements into this before mapping; the mapper does no
// aggregation itself.
export type ReservationGroup = {
  productId: string;
  quantity: number;
  holderType: ReservationHolderType;
  holderReference: string;
  ageHours: number;
};

export class InventoryMapper {
  static toStockRowDto(product: Product): StockRowDto {
    const available = InventoryMapper.availableQuantity(product);
    const avgStockPrice = InventoryMapper.toMoney(product.avgStockPrice);
    const dto: StockRowDto = {
      productId: product.id,
      name: product.name,
      ...(product.barcode != null ? { barcode: product.barcode } : {}),
      quantityOnHand: product.quantityOnHand,
      quantityReserved: product.quantityReserved,
      availableQuantity: available,
      avgStockPrice,
      stockValue: product.quantityOnHand * avgStockPrice,
      reorderThreshold: product.reorderThreshold,
      isLow: InventoryMapper.isLow(available, product.reorderThreshold),
    };
    return StockRowResponseSchema.parse(dto);
  }

  static toMovementDto(
    movement: StockMovement,
    product: Pick<Product, 'name'>,
    staff: Pick<Staff, 'firstName' | 'lastName'>,
    referenceLabel: string,
  ): MovementDto {
    const dto: MovementDto = {
      id: movement.id,
      productId: movement.productId,
      productName: product.name,
      direction: movement.direction as MovementDirection,
      type: movement.type as MovementType,
      quantity: movement.quantity,
      ...(movement.unitCost != null ? { unitCost: InventoryMapper.toMoney(movement.unitCost) } : {}),
      ...(movement.remainingQuantity != null ? { remainingQuantity: movement.remainingQuantity } : {}),
      ...(movement.costOfGoods != null ? { costOfGoods: InventoryMapper.toMoney(movement.costOfGoods) } : {}),
      ...(movement.profit != null ? { profit: InventoryMapper.toMoney(movement.profit) } : {}),
      balanceAfter: movement.balanceAfter,
      // StockMovement.referenceType is still a plain string column in the schema (S1 only closed
      // the contract's enum, not the Prisma column) — every writer already only ever stores one
      // of the closed MovementReferenceType members, so this cast is safe (same convention as
      // direction/type above).
      referenceType: movement.referenceType as MovementReferenceType,
      referenceId: movement.referenceId,
      referenceLabel,
      ...(movement.reason != null ? { reason: movement.reason } : {}),
      staffName: `${staff.firstName} ${staff.lastName}`,
      createdAt: movement.createdAt.toISOString(),
    };
    return MovementResponseSchema.parse(dto);
  }

  static toReservationDto(group: ReservationGroup, product: Pick<Product, 'name'>): ReservationDto {
    const dto: ReservationDto = {
      productId: group.productId,
      productName: product.name,
      quantity: group.quantity,
      holderType: group.holderType,
      holderReference: group.holderReference,
      ageHours: group.ageHours,
    };
    return ReservationResponseSchema.parse(dto);
  }

  static toAdjustmentResultDto(
    adjustment: Pick<StockAdjustment, 'reference'>,
    lines: AdjustmentResultLine[],
  ): AdjustmentResultDto {
    const dto: AdjustmentResultDto = { reference: adjustment.reference, lines };
    return AdjustmentResultResponseSchema.parse(dto);
  }

  // StockMovement stores only referenceType/referenceId — no denormalised label column (plan
  // §1.4/§8 #2). The service resolves the per-referenceType join (ADJUSTMENT ->
  // StockAdjustment.reference, PRODUCT -> Product.name, SUPPLIER_INVOICE ->
  // SupplierInvoice.reference, SALE/ORDER/REPAIR/RETURN -> their own reference — RC-4) and passes
  // the result here. This fallback now only fires when the source document was hard-deleted —
  // every referenceType's owning module exists and is resolved by the service.
  static resolveReferenceLabel(referenceType: string, referenceId: string, resolvedName?: string): string {
    return resolvedName ?? `${referenceType} ${referenceId.slice(0, 8)}`;
  }

  // Shared with the engine's low-stock edge-trigger check (Sprint 2) so the onHand-minus-reserved
  // computation exists in exactly one place.
  static availableQuantity(product: Pick<Product, 'quantityOnHand' | 'quantityReserved'>): number {
    return product.quantityOnHand - product.quantityReserved;
  }

  // Shared with the engine's low-stock edge-trigger check (Sprint 2) — same reason as above.
  static isLow(available: number, reorderThreshold: number): boolean {
    return available <= reorderThreshold;
  }

  static ageHours(since: Date, now: Date = new Date()): number {
    return (now.getTime() - since.getTime()) / 3_600_000;
  }

  private static toMoney(value: Money): number {
    return typeof value === 'number' ? value : value.toNumber();
  }
}
