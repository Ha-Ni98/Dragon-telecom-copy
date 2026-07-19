import type { Prisma, Staff, Supplier, SupplierInvoice, SupplierInvoiceLine, SupplierPayment } from '@prisma/client';
import {
  ConfirmResultResponseSchema,
  SupplierDetailResponseSchema,
  SupplierInvoiceResponseSchema,
  SupplierPaymentResponseSchema,
  SupplierResponseSchema,
  SupplierStatsResponseSchema,
  type ConfirmResultDto,
  type SupplierDetailDto,
  type SupplierDto,
  type SupplierInvoiceDto,
  type SupplierInvoiceStatus,
  type SupplierPaymentDto,
  type SupplierStatsDto,
} from '@dragon-telecom/contract';

type Money = Prisma.Decimal | number;

// invoiceCount/lastDeliveryAt aren't Supplier columns the mapper can read off the row —
// invoiceCount is a `_count` aggregate, lastDeliveryAt is derived from the most recent
// CONFIRMED SupplierInvoice.updatedAt (no such column exists on Supplier itself — see
// purchasing.service.ts's getLastDeliveryAt for why this avoids a schema migration).
export type SupplierExtras = { invoiceCount: number; lastDeliveryAt?: Date };

export type SupplierInvoiceLineRow = SupplierInvoiceLine & { projectedNewAverageCost?: number };
export type SupplierInvoiceRow = SupplierInvoice & {
  supplier: Pick<Supplier, 'name'>;
  staff: Pick<Staff, 'firstName' | 'lastName'>;
  lines: SupplierInvoiceLineRow[];
};

export type RepriceCandidateRow = {
  productId: string;
  name: string;
  averageCost: number;
  current: {
    guestPrice?: number;
    defaultSalePrice?: number;
    categoryPrices: { categoryId: string; categoryName: string; price: number }[];
  };
};

export type SupplierPaymentRow = SupplierPayment & {
  supplier: Pick<Supplier, 'name'>;
  supplierInvoice: Pick<SupplierInvoice, 'reference'> | null;
  staff: Pick<Staff, 'firstName' | 'lastName'>;
};

export type ProductHistoryRow = { productId: string; productName: string; totalQuantity: number; lastPurchaseAt: Date };

export type SupplierStatsCounts = { totalSuppliers: number; totalCredit: number; totalInvoiced: number };

export class PurchasingMapper {
  static toSupplierDto(supplier: Supplier, extras: SupplierExtras): SupplierDto {
    const dto: SupplierDto = {
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      ...(supplier.contactName != null ? { contactName: supplier.contactName } : {}),
      ...(supplier.phone != null ? { phone: supplier.phone } : {}),
      ...(supplier.email != null ? { email: supplier.email } : {}),
      ...(supplier.location != null ? { location: supplier.location } : {}),
      credit: PurchasingMapper.toMoney(supplier.credit),
      totalPaid: PurchasingMapper.toMoney(supplier.totalPaid),
      totalInvoiced: PurchasingMapper.toMoney(supplier.totalInvoiced),
      invoiceCount: extras.invoiceCount,
      ...(extras.lastDeliveryAt != null ? { lastDeliveryAt: extras.lastDeliveryAt.toISOString() } : {}),
      isEnabled: supplier.isEnabled,
    };
    return SupplierResponseSchema.parse(dto);
  }

  static toSupplierInvoiceDto(invoice: SupplierInvoiceRow): SupplierInvoiceDto {
    const dto: SupplierInvoiceDto = {
      id: invoice.id,
      reference: invoice.reference,
      ...(invoice.supplierReference != null ? { supplierReference: invoice.supplierReference } : {}),
      supplierId: invoice.supplierId,
      supplierName: invoice.supplier.name,
      // Prisma's generated $Enums.SupplierInvoiceStatus and the contract's SupplierInvoiceStatus
      // are distinct nominal types with identical string values (schema.prisma's own invariant).
      status: invoice.status as SupplierInvoiceStatus,
      invoiceDate: PurchasingMapper.toDateOnly(invoice.invoiceDate),
      ...(invoice.dueDate != null ? { dueDate: PurchasingMapper.toDateOnly(invoice.dueDate) } : {}),
      shippingCost: PurchasingMapper.toMoney(invoice.shippingCost),
      ...(invoice.amountOnly != null ? { amountOnly: PurchasingMapper.toMoney(invoice.amountOnly) } : {}),
      totalAmount: PurchasingMapper.toMoney(invoice.totalAmount),
      paidAmount: PurchasingMapper.toMoney(invoice.paidAmount),
      ...(invoice.previousCredit != null ? { previousCredit: PurchasingMapper.toMoney(invoice.previousCredit) } : {}),
      ...(invoice.newCredit != null ? { newCredit: PurchasingMapper.toMoney(invoice.newCredit) } : {}),
      ...(invoice.note != null ? { note: invoice.note } : {}),
      staffName: `${invoice.staff.firstName} ${invoice.staff.lastName}`,
      lines: invoice.lines.map((line) => ({
        id: line.id,
        productId: line.productId,
        productNameSnapshot: line.productNameSnapshot,
        quantity: line.quantity,
        unitCost: PurchasingMapper.toMoney(line.unitCost),
        landedUnitCost: PurchasingMapper.toMoney(line.landedUnitCost),
        lineTotal: PurchasingMapper.toMoney(line.lineTotal),
        ...(line.serialNumbers != null ? { serialNumbers: line.serialNumbers } : {}),
        ...(line.projectedNewAverageCost != null ? { projectedNewAverageCost: line.projectedNewAverageCost } : {}),
      })),
    };
    return SupplierInvoiceResponseSchema.parse(dto);
  }

  // repriceCandidates are supplied pre-resolved (catalog's reprice read port, injected — plan
  // §II.5) — never rebuilt here, same precedent as clients' toCartItemDto.
  static toConfirmResultDto(reference: string, repriceCandidates: RepriceCandidateRow[]): ConfirmResultDto {
    const dto: ConfirmResultDto = { reference, repriceCandidates };
    return ConfirmResultResponseSchema.parse(dto);
  }

  static toSupplierPaymentDto(payment: SupplierPaymentRow): SupplierPaymentDto {
    const dto: SupplierPaymentDto = {
      reference: payment.reference,
      supplierName: payment.supplier.name,
      ...(payment.supplierInvoice?.reference != null ? { supplierInvoiceReference: payment.supplierInvoice.reference } : {}),
      amount: PurchasingMapper.toMoney(payment.amount),
      previousCredit: PurchasingMapper.toMoney(payment.previousCredit),
      newCredit: PurchasingMapper.toMoney(payment.newCredit),
      paidAt: payment.paidAt.toISOString(),
      staffName: `${payment.staff.firstName} ${payment.staff.lastName}`,
    };
    return SupplierPaymentResponseSchema.parse(dto);
  }

  // Composes already-mapped DTOs (supplier/invoices/payments) — the service maps each section
  // with this same mapper's own methods first; this only assembles + converts productHistory's
  // dates + schema-guards the aggregate.
  static toSupplierDetailDto(
    supplier: SupplierDto,
    invoices: SupplierInvoiceDto[],
    payments: SupplierPaymentDto[],
    productHistory: ProductHistoryRow[],
  ): SupplierDetailDto {
    const dto: SupplierDetailDto = {
      supplier,
      invoices,
      payments,
      productHistory: productHistory.map((row) => ({
        productId: row.productId,
        productName: row.productName,
        totalQuantity: row.totalQuantity,
        lastPurchaseAt: row.lastPurchaseAt.toISOString(),
      })),
    };
    return SupplierDetailResponseSchema.parse(dto);
  }

  static toSupplierStatsDto(counts: SupplierStatsCounts): SupplierStatsDto {
    return SupplierStatsResponseSchema.parse(counts);
  }

  private static toMoney(value: Money): number {
    return typeof value === 'number' ? value : value.toNumber();
  }

  // invoiceDate/dueDate are `@db.Date` columns — the contract expects a date-only string
  // (z.iso.date(), "YYYY-MM-DD"), not a full datetime.
  private static toDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
