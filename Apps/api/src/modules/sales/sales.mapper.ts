import type { Prisma, PosClient, Sale, SaleLine, Staff } from '@prisma/client';
import {
  ReceiptResponseSchema,
  SaleResponseSchema,
  SaleOrigin,
  SaleStatus,
  type ReceiptDto,
  type SaleDraftCommand,
  type SaleDto,
} from '@dragon-telecom/contract';

type Money = Prisma.Decimal | number;

export type SaleRow = Sale & {
  posClient: Pick<PosClient, 'name'> | null;
  staff: Pick<Staff, 'firstName' | 'lastName'>;
  lines: SaleLine[];
};

// productNames is supplied pre-resolved by the service (a DB read) — the mapper never queries —
// same "supplied pre-resolved, never rebuilt here" precedent as purchasing's toConfirmResultDto
// and clients' toCartItemDto. `reference` is a placeholder (Sale.reference is @unique with no
// default) — the service generates it the same way purchasing's DRAFT invoices do
// (`draftReference()`); the real `SAL-YYYY-NNNN` is allocated by SequenceService at confirm.
export type DraftMapContext = { staffId: string; reference: string; productNames: Map<string, string> };

export class SalesMapper {
  static toSaleDto(sale: SaleRow, ctx: { includeMargins: boolean }): SaleDto {
    const dto: SaleDto = {
      id: sale.id,
      reference: sale.reference,
      // Prisma's generated $Enums.SaleOrigin/SaleStatus and the contract's enums are distinct
      // nominal types with identical string values (schema.prisma's own invariant, same as
      // purchasing.mapper.ts's SupplierInvoiceStatus cast).
      origin: sale.origin as SaleOrigin,
      status: sale.status as SaleStatus,
      ...(sale.posClientId != null ? { posClientId: sale.posClientId } : {}),
      ...(sale.posClient?.name != null ? { posClientName: sale.posClient.name } : {}),
      subtotal: SalesMapper.toMoney(sale.subtotal),
      discountAmount: SalesMapper.toMoney(sale.discountAmount),
      totalAmount: SalesMapper.toMoney(sale.totalAmount),
      paidAmount: SalesMapper.toMoney(sale.paidAmount),
      ...(sale.previousCredit != null ? { previousCredit: SalesMapper.toMoney(sale.previousCredit) } : {}),
      ...(sale.newCredit != null ? { newCredit: SalesMapper.toMoney(sale.newCredit) } : {}),
      // Margin-gated (spec Data Mapping): staff mapping strips these, admin keeps them.
      ...(ctx.includeMargins
        ? { totalCost: SalesMapper.toMoney(sale.totalCost), totalProfit: SalesMapper.toMoney(sale.totalProfit) }
        : {}),
      ...(sale.soldAt != null ? { soldAt: sale.soldAt.toISOString() } : {}),
      staffId: sale.staffId,
      staffName: `${sale.staff.firstName} ${sale.staff.lastName}`,
      ...(sale.note != null ? { note: sale.note } : {}),
      lines: sale.lines.map((line) => {
        const serialNumbers = SalesMapper.parseSerials(line.serialNumbers);
        return {
          id: line.id,
          productId: line.productId,
          productName: line.productNameSnapshot,
          quantity: line.quantity,
          resolvedPrice: SalesMapper.toMoney(line.resolvedPrice),
          unitPrice: SalesMapper.toMoney(line.unitPrice),
          ...(ctx.includeMargins
            ? { costOfGoods: SalesMapper.toMoney(line.costOfGoods), profit: SalesMapper.toMoney(line.profit) }
            : {}),
          lineTotal: SalesMapper.toMoney(line.lineTotal),
          ...(serialNumbers != null ? { serialNumbers } : {}),
        };
      }),
    };
    return SaleResponseSchema.parse(dto);
  }

  // Customer-facing: no cost/profit fields exist on this schema at all — never any margin
  // leakage regardless of who prints the receipt (spec: "a printed receipt is customer-facing").
  static toReceiptDto(sale: SaleRow): ReceiptDto {
    const total = SalesMapper.toMoney(sale.totalAmount);
    const previousCredit = sale.previousCredit != null ? SalesMapper.toMoney(sale.previousCredit) : 0;
    const newCredit = sale.newCredit != null ? SalesMapper.toMoney(sale.newCredit) : 0;

    const dto: ReceiptDto = {
      reference: sale.reference,
      lines: sale.lines.map((line) => {
        const serialNumbers = SalesMapper.parseSerials(line.serialNumbers);
        return {
          productName: line.productNameSnapshot,
          quantity: line.quantity,
          unitPrice: SalesMapper.toMoney(line.unitPrice),
          lineTotal: SalesMapper.toMoney(line.lineTotal),
          ...(serialNumbers != null ? { serialNumbers } : {}),
        };
      }),
      total,
      previousCredit,
      // Not a stored column — derived from the immutable snapshot (BL#2): what the client would
      // owe in total if they paid nothing today (this sale's total + whatever they already owed).
      grandTotal: total + previousCredit,
      totalPaid: SalesMapper.toMoney(sale.paidAmount),
      newCredit,
    };
    return ReceiptResponseSchema.parse(dto);
  }

  // DRAFT holds no stock, no money (spec BL#1) — resolvedPrice/costOfGoods/profit stay at their
  // schema defaults (0) until confirm resolves them via the catalog port + FIFO engine;
  // `lineTotal` is a preview only (operator's requested unitPrice × qty), fully recomputed at
  // confirm alongside the document's own totals.
  static toPersistenceDraft(cmd: SaleDraftCommand, ctx: DraftMapContext): Prisma.SaleUncheckedCreateInput {
    return {
      reference: ctx.reference,
      origin: SaleOrigin.POS,
      status: SaleStatus.DRAFT,
      ...(cmd.posClientId != null ? { posClientId: cmd.posClientId } : {}),
      ...(cmd.discountAmount != null ? { discountAmount: cmd.discountAmount } : {}),
      ...(cmd.note != null ? { note: cmd.note } : {}),
      staffId: ctx.staffId,
      lines: {
        create: cmd.lines.map((line) => SalesMapper.toLineCreateInput(line, ctx.productNames)),
      },
    };
  }

  // Shared by toPersistenceDraft (create) and the service's updateDraft (full line replacement,
  // Sprint 3) — the one place a line-input command shape becomes a SaleLine create-input, so the
  // resolvedPrice=0/lineTotal-preview/serial-serialization rules live in exactly one spot.
  static toLineCreateInput(
    line: { productId: string; quantity: number; unitPrice: number; serialNumbers?: string[] | undefined },
    productNames: Map<string, string>,
  ): Prisma.SaleLineUncheckedCreateWithoutSaleInput {
    const serialNumbers = SalesMapper.serializeSerials(line.serialNumbers);
    return {
      productId: line.productId,
      productNameSnapshot: productNames.get(line.productId) ?? '',
      quantity: line.quantity,
      resolvedPrice: 0,
      unitPrice: line.unitPrice,
      lineTotal: line.unitPrice * line.quantity,
      ...(serialNumbers != null ? { serialNumbers } : {}),
    };
  }

  private static toMoney(value: Money): number {
    return typeof value === 'number' ? value : value.toNumber();
  }

  // SaleLine.serialNumbers is a free-text Prisma column (schema: "free text"); the contract wants
  // an array (unlike purchasing's SupplierInvoiceLine.serialNumbers, which stays a plain string
  // end-to-end on both sides) — sales is the first module needing this conversion. Comma-join/
  // split is the chosen convention: serials are alphanumeric IMEI/serial strings, never
  // containing a comma.
  private static serializeSerials(serials?: string[]): string | undefined {
    return serials != null && serials.length > 0 ? serials.join(',') : undefined;
  }

  private static parseSerials(value: string | null): string[] | undefined {
    return value != null && value.length > 0 ? value.split(',') : undefined;
  }
}
