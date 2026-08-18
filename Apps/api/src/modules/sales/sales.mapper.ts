import type { Prisma, PosClient, Return, ReturnLine, Sale, SaleLine, Staff } from '@prisma/client';
import {
  ReceiptResponseSchema,
  ReturnResponseSchema,
  SaleResponseSchema,
  SaleStatus,
  type ReceiptDto,
  type ReturnDto,
  type ReturnType,
  type SaleDraftCommand,
  type SaleDto,
} from '@dragon-telecom/contract';

type Money = Prisma.Decimal | number;

export type SaleRow = Sale & {
  posClient: Pick<PosClient, 'name'> | null;
  staff: Pick<Staff, 'firstName' | 'lastName'>;
  lines: SaleLine[];
};

// S12 — the shape RETURN_INCLUDE (sales.service.ts) produces. A ReturnLine carries no product
// identity of its own, so the linked SaleLine is joined for productId/name/unitPrice.
// S24 — Return/ReturnLine.saleId/saleLineId are nullable at the schema level (polymorphic over
// Sale and Order), but every caller of this mapper reads sale-scoped rows only (listReturns now
// filters `saleId: { not: null }`) — narrowed back to non-null here rather than threading an
// optional-`sale`/`saleLine` shape through every field below.
export type ReturnRow = Omit<Return, 'saleId'> & {
  saleId: string;
  sale: Pick<Sale, 'reference' | 'posClientId'> & { posClient: Pick<PosClient, 'name'> | null };
  staff: Pick<Staff, 'firstName' | 'lastName'>;
  lines: (Omit<ReturnLine, 'saleLineId'> & {
    saleLineId: string;
    saleLine: Pick<SaleLine, 'productId' | 'productNameSnapshot' | 'unitPrice'>;
  })[];
};

// productNames is supplied pre-resolved by the service (a DB read) — the mapper never queries —
// same "supplied pre-resolved, never rebuilt here" precedent as purchasing's toConfirmResultDto
// and clients' toCartItemDto. `reference` is a placeholder (Sale.reference is @unique with no
// default) — the service generates it the same way purchasing's DRAFT invoices do
// (`draftReference()`); the real `SAL-YYYY-NNNN` is allocated by SequenceService at confirm.
export type DraftMapContext = { staffId: string; reference: string; productNames: Map<string, string> };

export class SalesMapper {
  static toSaleDto(sale: SaleRow, ctx: { includeMargins: boolean; refundedAmount?: number }): SaleDto {
    const dto: SaleDto = {
      id: sale.id,
      reference: sale.reference,
      // Prisma's generated $Enums.SaleStatus and the contract's SaleStatus are distinct nominal
      // types with identical string values (schema.prisma's own invariant, same as
      // purchasing.mapper.ts's SupplierInvoiceStatus cast). No `origin` (S1): repairs no longer
      // produce a Sale row at all (D9), so every Sale is POS and the field was deleted.
      status: sale.status as SaleStatus,
      ...(sale.posClientId != null ? { posClientId: sale.posClientId } : {}),
      ...(sale.posClient?.name != null ? { posClientName: sale.posClient.name } : {}),
      subtotal: SalesMapper.toMoney(sale.subtotal),
      discountAmount: SalesMapper.toMoney(sale.discountAmount),
      totalAmount: SalesMapper.toMoney(sale.totalAmount),
      paidAmount: SalesMapper.toMoney(sale.paidAmount),
      ...(ctx.refundedAmount != null ? { refundedAmount: ctx.refundedAmount } : {}),
      ...(sale.previousCredit != null ? { previousCredit: SalesMapper.toMoney(sale.previousCredit) } : {}),
      ...(sale.newCredit != null ? { newCredit: SalesMapper.toMoney(sale.newCredit) } : {}),
      // Margin-gated (spec Data Mapping): staff mapping strips these, admin keeps them.
      ...(ctx.includeMargins
        ? { totalCost: SalesMapper.toMoney(sale.totalCost), totalProfit: SalesMapper.toMoney(sale.totalProfit) }
        : {}),
      ...(sale.soldAt != null ? { soldAt: sale.soldAt.toISOString() } : {}),
      createdAt: sale.createdAt.toISOString(),
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

  // No margin gate: a return exposes refund amounts and quantities, never cost or profit — and the
  // route is admin-only anyway (sales.routes.ts).
  static toReturnDto(row: ReturnRow): ReturnDto {
    const dto: ReturnDto = {
      id: row.id,
      reference: row.reference,
      saleId: row.saleId,
      saleReference: row.sale.reference,
      // Prisma's generated $Enums.ReturnType and the contract's ReturnType are distinct nominal
      // types with identical string values (same cast as toSaleDto's SaleStatus).
      type: row.type as ReturnType,
      ...(row.reason != null ? { reason: row.reason } : {}),
      refundAmount: SalesMapper.toMoney(row.refundAmount),
      totalQuantity: row.lines.reduce((sum, line) => sum + line.quantity, 0),
      returnedAt: row.returnedAt.toISOString(),
      ...(row.sale.posClientId != null ? { posClientId: row.sale.posClientId } : {}),
      ...(row.sale.posClient?.name != null ? { posClientName: row.sale.posClient.name } : {}),
      staffId: row.staffId,
      staffName: `${row.staff.firstName} ${row.staff.lastName}`,
      lines: row.lines.map((line) => ({
        id: line.id,
        saleLineId: line.saleLineId,
        productId: line.saleLine.productId,
        productName: line.saleLine.productNameSnapshot,
        quantity: line.quantity,
        unitPrice: SalesMapper.toMoney(line.saleLine.unitPrice),
        restock: line.restock,
        refundAmount: SalesMapper.toMoney(line.refundAmount),
      })),
    };
    return ReturnResponseSchema.parse(dto);
  }

  // DRAFT holds no stock, no money (spec BL#1) — resolvedPrice/costOfGoods/profit stay at their
  // schema defaults (0) until confirm resolves them via the catalog port + FIFO engine;
  // `lineTotal` is a preview only (operator's requested unitPrice × qty), fully recomputed at
  // confirm alongside the document's own totals.
  static toPersistenceDraft(cmd: SaleDraftCommand, ctx: DraftMapContext): Prisma.SaleUncheckedCreateInput {
    return {
      reference: ctx.reference,
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
