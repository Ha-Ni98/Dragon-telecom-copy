import type { ClientPayment, Invoice, InvoiceLine, PosClient, Prisma, Repair, Staff } from '@prisma/client';
import {
  ClientPaymentResponseSchema,
  InvoiceResponseSchema,
  InvoiceStatus,
  type ClientPaymentDto,
  type InvoiceDto,
  type InvoiceSource,
} from '@dragon-telecom/contract';

type Money = Prisma.Decimal | number;

export type InvoiceRow = Invoice & {
  staff: Pick<Staff, 'firstName' | 'lastName'>;
  posClient: Pick<PosClient, 'credit'> | null;
  lines: InvoiceLine[];
};

// `sourceReference` and each line's `currentAvgStockPrice` aren't stored columns at all —
// `Invoice` has no `sourceReference` (only the internal `sourceId` FK into Sale|Order|Repair),
// and `InvoiceLine` has no `productId` (only a free-text `label`) to join `Product.avgStockPrice`
// through. Both are supplied pre-resolved by the service (Sprint 6's join through `sourceId`
// and, for margins, a label/quantity/unitPrice correlation back to the source document's own
// lines) — same "never rebuilt here" precedent as sales' ctx.productNames.
export type InvoiceMapContext = {
  audience: 'client' | 'staff' | 'admin';
  sourceReference: string;
  currentAvgStockPriceByLineId?: Map<string, number>;
};

export type ClientPaymentRow = ClientPayment & {
  posClient: Pick<PosClient, 'name'>;
  invoice: Pick<Invoice, 'number'> | null;
  staff: Pick<Staff, 'firstName' | 'lastName'>;
  repair: Pick<Repair, 'reference'> | null; // S30
  reversalOf: Pick<ClientPayment, 'reference'> | null; // S30/Q1
};

export type InvoiceLineIssueInput = {
  label: string;
  quantity: number;
  unitPrice: number;
  costSnapshot: number;
  profit: number;
  lineTotal: number;
  serialNumbers?: string;
};

// Normalized across both sources (SALE|ORDER) — sale.confirmed/order.confirmed have very
// different event shapes (order has no previousCredit/newCredit at all, nests totals, etc.);
// the service (Sprint 6) reconciles whichever event fired into this one shape before calling
// the mapper, so toInvoicePersistence stays origin-agnostic.
export type InvoiceIssueInput = {
  number: string;
  posClientId?: string;
  sourceType: InvoiceSource;
  sourceId: string;
  clientNameSnapshot: string;
  clientAddressSnapshot?: string;
  totalAmount: number;
  paidAmount: number;
  previousCredit?: number;
  newCredit?: number;
  totalCost: number;
  totalProfit: number;
  staffId: string;
  lines: InvoiceLineIssueInput[];
};

export class BillingMapper {
  static toInvoiceDto(invoice: InvoiceRow, ctx: InvoiceMapContext): InvoiceDto {
    const includeMargins = ctx.audience === 'admin';
    // S8 J9/F7 — posClientCredit is gated like margins are gated for staff, but open to staff
    // too (unlike totalCost/totalProfit): both the incoming-invoice and outgoing-invoice
    // record-payment dialogs are staff-operated, and neither needs the cost/profit figures.
    const includeCounterpartyCredit = ctx.audience !== 'client';
    const dto: InvoiceDto = {
      number: invoice.number,
      ...(invoice.posClientId != null ? { posClientId: invoice.posClientId } : {}),
      clientNameSnapshot: invoice.clientNameSnapshot,
      ...(invoice.clientAddressSnapshot != null ? { clientAddressSnapshot: invoice.clientAddressSnapshot } : {}),
      // Prisma's generated $Enums.InvoiceSource/InvoiceStatus and the contract's enums are
      // distinct nominal types with identical string values (schema.prisma's own invariant).
      sourceType: invoice.sourceType as InvoiceSource,
      sourceReference: ctx.sourceReference,
      status: invoice.status as InvoiceStatus,
      totalAmount: BillingMapper.toMoney(invoice.totalAmount),
      paidAmount: BillingMapper.toMoney(invoice.paidAmount),
      ...(invoice.previousCredit != null ? { previousCredit: BillingMapper.toMoney(invoice.previousCredit) } : {}),
      ...(invoice.newCredit != null ? { newCredit: BillingMapper.toMoney(invoice.newCredit) } : {}),
      ...(includeCounterpartyCredit && invoice.posClient != null
        ? { posClientCredit: BillingMapper.toMoney(invoice.posClient.credit) }
        : {}),
      // Margin-gated (Data Mapping: client/staff strip totalCost/totalProfit, admin-only).
      ...(includeMargins
        ? { totalCost: BillingMapper.toMoney(invoice.totalCost), totalProfit: BillingMapper.toMoney(invoice.totalProfit) }
        : {}),
      issuedAt: invoice.issuedAt.toISOString(),
      ...(invoice.dueDate != null ? { dueDate: BillingMapper.toDateOnly(invoice.dueDate) } : {}),
      staffName: `${invoice.staff.firstName} ${invoice.staff.lastName}`,
      lines: invoice.lines.map((line) => {
        const currentAvgStockPrice = includeMargins ? ctx.currentAvgStockPriceByLineId?.get(line.id) : undefined;
        return {
          label: line.label,
          quantity: line.quantity,
          unitPrice: BillingMapper.toMoney(line.unitPrice),
          ...(includeMargins
            ? { costSnapshot: BillingMapper.toMoney(line.costSnapshot), profit: BillingMapper.toMoney(line.profit) }
            : {}),
          lineTotal: BillingMapper.toMoney(line.lineTotal),
          ...(line.serialNumbers != null ? { serialNumbers: line.serialNumbers } : {}),
          ...(currentAvgStockPrice != null ? { currentAvgStockPrice } : {}),
        };
      }),
    };
    return InvoiceResponseSchema.parse(dto);
  }

  static toClientPaymentDto(payment: ClientPaymentRow): ClientPaymentDto {
    const dto: ClientPaymentDto = {
      reference: payment.reference,
      posClientName: payment.posClient.name,
      ...(payment.invoice?.number != null ? { invoiceNumber: payment.invoice.number } : {}),
      ...(payment.repair != null ? { repairReference: payment.repair.reference } : {}),
      ...(payment.reversalOf != null ? { reversesReference: payment.reversalOf.reference } : {}),
      amount: BillingMapper.toMoney(payment.amount),
      previousCredit: BillingMapper.toMoney(payment.previousCredit),
      newCredit: BillingMapper.toMoney(payment.newCredit),
      paidAt: payment.paidAt.toISOString(),
      staffName: `${payment.staff.firstName} ${payment.staff.lastName}`,
    };
    return ClientPaymentResponseSchema.parse(dto);
  }

  // Copies the immutable snapshot at issuance (spec: "the document renders identically forever
  // — never re-derived"). `input` is already fully normalized/resolved by the service — this
  // method never reads Sale/Order/Product itself.
  static toInvoicePersistence(input: InvoiceIssueInput): Prisma.InvoiceUncheckedCreateInput {
    return {
      number: input.number,
      ...(input.posClientId != null ? { posClientId: input.posClientId } : {}),
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      status: InvoiceStatus.ISSUED,
      clientNameSnapshot: input.clientNameSnapshot,
      ...(input.clientAddressSnapshot != null ? { clientAddressSnapshot: input.clientAddressSnapshot } : {}),
      totalAmount: input.totalAmount,
      paidAmount: input.paidAmount,
      ...(input.previousCredit != null ? { previousCredit: input.previousCredit } : {}),
      ...(input.newCredit != null ? { newCredit: input.newCredit } : {}),
      totalCost: input.totalCost,
      totalProfit: input.totalProfit,
      staffId: input.staffId,
      lines: {
        create: input.lines.map((line) => ({
          label: line.label,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          costSnapshot: line.costSnapshot,
          profit: line.profit,
          lineTotal: line.lineTotal,
          ...(line.serialNumbers != null ? { serialNumbers: line.serialNumbers } : {}),
        })),
      },
    };
  }

  private static toMoney(value: Money): number {
    return typeof value === 'number' ? value : value.toNumber();
  }

  // dueDate is a `@db.Date` column — the contract expects a date-only string (z.iso.date(),
  // "YYYY-MM-DD"), not a full datetime. Same helper purchasing's mapper uses for invoiceDate.
  private static toDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
