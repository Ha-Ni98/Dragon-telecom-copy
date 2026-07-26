import type { PrismaClient } from '@prisma/client';
import { Prisma, InvoiceSource as PrismaInvoiceSource, InvoiceStatus as PrismaInvoiceStatus } from '@prisma/client';
import {
  DocType,
  InvoiceResponseSchema,
  InvoiceSource,
  ClientPaymentResponseSchema,
  paginated,
  type CancelInvoiceCommand,
  type ClientPaymentDto,
  type ClientPaymentListQuery,
  type CreateClientPaymentCommand,
  type InvoiceDto,
  type InvoiceListQuery,
  type OrdersEvents,
  type PaginatedResult,
} from '@dragon-telecom/contract';
import { BadRequestError, ForbiddenError, NotFoundError } from '@common/errors';
import { logger } from '@common/config/logger';
import { eventBus } from '@common/events/event-bus';
import { renderInvoicePdf } from '@common/utils/pdf.utils';
import type { ISequenceService } from '../platform/platform.interface';
import type { IBillingService, IClientCreditPort, InvoiceIssueRequest, IStoreSettingsPort, PdfResult } from './billing.interface';
import { BillingMapper, type InvoiceIssueInput, type InvoiceMapContext, type InvoiceRow } from './billing.mapper';

const isKnownRequestError = (err: unknown, code: string): err is Prisma.PrismaClientKnownRequestError =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

const INVOICE_INCLUDE = {
  staff: { select: { firstName: true, lastName: true } },
  lines: true,
} satisfies Prisma.InvoiceInclude;

const PAYMENT_INCLUDE = {
  posClient: { select: { name: true } },
  invoice: { select: { number: true } },
  staff: { select: { firstName: true, lastName: true } },
} satisfies Prisma.ClientPaymentInclude;

export class BillingService implements IBillingService {
  constructor(
    private prisma: PrismaClient,
    private sequence: ISequenceService,
    private settings: IStoreSettingsPort,
    private clientCredit: IClientCreditPort,
  ) {}

  // --- Client (via linked posClientId; 404 on foreign) ---

  async getMyInvoices(query: InvoiceListQuery, clientId: string): Promise<PaginatedResult<InvoiceDto>> {
    const posClientId = await this.resolvePosClientIdForClient(clientId);
    // No linked PosClient yet (never approved) — genuinely no invoices possible, not an error.
    if (posClientId == null) {
      return paginated(InvoiceResponseSchema).parse({
        items: [],
        meta: { page: query.page, limit: query.limit, total: 0, totalPages: 0 },
      });
    }
    return this.listInvoicesFor(query, 'client', { posClientId });
  }

  async getMyInvoice(number: string, clientId: string): Promise<InvoiceDto> {
    const posClientId = await this.resolvePosClientIdForClient(clientId);
    const invoice = await this.findInvoiceOrThrow(number);
    if (posClientId == null || invoice.posClientId !== posClientId) throw new NotFoundError('Invoice');
    const [dto] = await this.toInvoiceDtos([invoice], 'client');
    return dto!;
  }

  async getMyInvoicePdf(number: string, clientId: string): Promise<PdfResult> {
    const posClientId = await this.resolvePosClientIdForClient(clientId);
    const invoice = await this.findInvoiceOrThrow(number);
    if (posClientId == null || invoice.posClientId !== posClientId) throw new NotFoundError('Invoice');
    return this.toPdfResult(invoice, 'client');
  }

  // --- Staff (issued-by-me only) ---

  async listStaffInvoices(query: InvoiceListQuery, staffId: string): Promise<PaginatedResult<InvoiceDto>> {
    return this.listInvoicesFor(query, 'staff', { staffId });
  }

  async getStaffInvoice(number: string, staffId: string): Promise<InvoiceDto> {
    const invoice = await this.findInvoiceOrThrow(number);
    if (invoice.staffId !== staffId) throw new ForbiddenError();
    const [dto] = await this.toInvoiceDtos([invoice], 'staff');
    return dto!;
  }

  async getStaffInvoicePdf(number: string, staffId: string): Promise<PdfResult> {
    const invoice = await this.findInvoiceOrThrow(number);
    if (invoice.staffId !== staffId) throw new ForbiddenError();
    return this.toPdfResult(invoice, 'staff');
  }

  // --- Admin (all filters, no scoping) ---

  async listAdminInvoices(query: InvoiceListQuery): Promise<PaginatedResult<InvoiceDto>> {
    return this.listInvoicesFor(query, 'admin', {});
  }

  async getAdminInvoice(number: string): Promise<InvoiceDto> {
    const invoice = await this.findInvoiceOrThrow(number);
    const [dto] = await this.toInvoiceDtos([invoice], 'admin');
    return dto!;
  }

  async getAdminInvoicePdf(number: string): Promise<PdfResult> {
    const invoice = await this.findInvoiceOrThrow(number);
    return this.toPdfResult(invoice, 'admin');
  }

  // Status-only; numbers never reused, gaps never closed (the sequence counter is untouched).
  async cancelInvoice(number: string, cmd: CancelInvoiceCommand, _staffId: string): Promise<InvoiceDto> {
    const invoice = await this.findInvoiceOrThrow(number);
    if (invoice.status !== PrismaInvoiceStatus.CANCELLED) {
      await this.prisma.invoice.update({ where: { number }, data: { status: PrismaInvoiceStatus.CANCELLED } });
      eventBus.emit('invoice.cancelled', { invoiceNumber: number, ...(cmd.reason != null ? { reason: cmd.reason } : {}) });
    }
    return this.getAdminInvoice(number);
  }

  // --- Client-payments ledger ---

  // The single ledger-capture primitive (D5/D6) — creates one ClientPayment row, applies it to the
  // PosClient's totalPaid/credit through the injected clients port, and recomputes the targeted
  // invoice's paidAmount/status from the ledger. Callers: this module's own createClientPayment
  // (the admin/staff endpoint), sales' confirm and createReturn (S5), orders' completion (S10) and
  // repairs' pickup (S13).
  // `invoiceId` is optional on purpose: money can be captured before an invoice exists — a repair
  // collects payments across several steps while its invoice only appears at PICKED_UP (D5) — and
  // such rows are "on account" (ClientPayment.invoiceId null), still counted in totalPaid.
  // `amount` is signed; a negative amount is a refund row (D6).
  // Returns everything the caller needs to emit `payment.clientRecorded` after IT commits.
  async captureClientPaymentInTx(
    tx: Prisma.TransactionClient,
    input: { posClientId: string; invoiceId?: string; amount: number; paidAt?: Date; staffId: string },
  ): Promise<{ paymentId: string; reference: string; previousCredit: number; newCredit: number }> {
    // Written here, inside the caller's own transaction, via the injected credit port
    // (credit-serialization fix, plan §C5) — no post-commit listener applies it. Overpayment
    // permitted — negative newCredit means the store owes the client, mirroring purchasing's
    // own overpayment-allowed convention.
    const { previousCredit, newCredit } = await this.clientCredit.applyLedgerPayment(tx, input.posClientId, {
      amount: input.amount,
    });

    const reference = await this.sequence.nextNumber(tx, DocType.CLIENT_PAYMENT);
    const payment = await tx.clientPayment.create({
      data: {
        reference,
        posClientId: input.posClientId,
        ...(input.invoiceId != null ? { invoiceId: input.invoiceId } : {}),
        amount: input.amount,
        previousCredit,
        newCredit,
        ...(input.paidAt != null ? { paidAt: input.paidAt } : {}),
        staffId: input.staffId,
      },
    });

    // Invoice.paidAmount/status recompute — also written in-tx now (billing's own data,
    // credit-serialization fix plan §C5), a real ledger recompute (Σ ClientPayment.amount for
    // this invoice, including the row just created above), so it's idempotent under replay by
    // construction, same as before — just no longer racing a post-commit listener. A
    // CANCELLED invoice is never revived (checked first, same guard order as the former
    // listener, so a cancelled invoice's ledger is never even aggregated). This ladder also
    // walks DOWNWARD for a negative (refund) amount — a fully-refunded invoice correctly falls
    // PAID → PARTIALLY_PAID → ISSUED as its ledger sum drops (D6's intended consequence).
    if (input.invoiceId != null) {
      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: input.invoiceId },
        select: { totalAmount: true, status: true },
      });
      if (invoice.status !== PrismaInvoiceStatus.CANCELLED) {
        const aggregate = await tx.clientPayment.aggregate({ where: { invoiceId: input.invoiceId }, _sum: { amount: true } });
        const paidAmount = aggregate._sum.amount?.toNumber() ?? 0;
        const totalAmount = invoice.totalAmount.toNumber();
        const status =
          paidAmount <= 0
            ? PrismaInvoiceStatus.ISSUED
            : paidAmount >= totalAmount
              ? PrismaInvoiceStatus.PAID
              : PrismaInvoiceStatus.PARTIALLY_PAID;
        await tx.invoice.update({ where: { id: input.invoiceId }, data: { paidAmount, status } });
      }
    }

    return { paymentId: payment.id, reference, previousCredit, newCredit };
  }

  async createClientPayment(cmd: CreateClientPaymentCommand, staffId: string): Promise<ClientPaymentDto> {
    let invoiceId: string | undefined;
    if (cmd.invoiceNumber != null) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { number: cmd.invoiceNumber },
        select: { id: true, posClientId: true },
      });
      if (!invoice) throw new BadRequestError('Unknown invoiceNumber');
      if (invoice.posClientId !== cmd.posClientId) throw new BadRequestError('Invoice does not belong to the given posClient');
      invoiceId = invoice.id;
    }

    let previousCredit = 0;
    let newCredit = 0;
    let paymentId = '';

    const created = await this.prisma.$transaction(async (tx) => {
      const captured = await this.captureClientPaymentInTx(tx, {
        posClientId: cmd.posClientId,
        ...(invoiceId != null ? { invoiceId } : {}),
        amount: cmd.amount,
        ...(cmd.paidAt != null ? { paidAt: new Date(cmd.paidAt) } : {}),
        staffId,
      });
      previousCredit = captured.previousCredit;
      newCredit = captured.newCredit;
      paymentId = captured.paymentId;

      return tx.clientPayment.findUniqueOrThrow({ where: { id: captured.paymentId }, include: PAYMENT_INCLUDE });
    });

    eventBus.emit('payment.clientRecorded', {
      paymentId,
      posClientId: cmd.posClientId,
      ...(cmd.invoiceNumber != null ? { invoiceNumber: cmd.invoiceNumber } : {}),
      amount: cmd.amount,
      previousCredit,
      newCredit,
    });

    return BillingMapper.toClientPaymentDto(created);
  }

  async listClientPayments(query: ClientPaymentListQuery): Promise<PaginatedResult<ClientPaymentDto>> {
    const where: Prisma.ClientPaymentWhereInput = { ...(query.posClientId != null ? { posClientId: query.posClientId } : {}) };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.clientPayment.count({ where }),
      this.prisma.clientPayment.findMany({
        where,
        include: PAYMENT_INCLUDE,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { paidAt: 'desc' },
      }),
    ]);

    return paginated(ClientPaymentResponseSchema).parse({
      items: rows.map((row) => BillingMapper.toClientPaymentDto(row)),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }

  // --- In-transaction issuance (injected port, S5/R2) ---

  // The caller's own transaction issues the invoice, so a ClientPayment row created in that same
  // transaction can carry a real invoiceId. Returns the ids the caller needs to emit
  // `invoice.issued` AFTER its transaction commits; this method must never emit itself (a listener
  // reacting to an event whose transaction has not committed would read rows that do not exist
  // yet). Callers: sales' confirm and createReturn (S5); from S10/S13, order completion and repair
  // pickup.
  // No P2002 swallow here, unlike the post-commit issueInvoice path below: every caller of this
  // method is guarded against double-issuance by its own document status check, so a
  // unique-violation on @@unique(sourceType, sourceId) is a genuine bug and must roll the
  // caller's transaction back.
  async issueInvoiceInTx(
    tx: Prisma.TransactionClient,
    input: InvoiceIssueRequest,
  ): Promise<{ invoiceId: string; number: string }> {
    const snapshot = input.posClientId != null ? await this.resolvePosClientSnapshot(input.posClientId) : {};
    const number = await this.sequence.nextNumber(tx, DocType.INVOICE);
    const invoice = await tx.invoice.create({
      data: BillingMapper.toInvoicePersistence({
        ...input,
        number,
        clientNameSnapshot: snapshot.name ?? 'Walk-in Customer',
        ...(snapshot.address != null ? { clientAddressSnapshot: snapshot.address } : {}),
      }),
    });
    return { invoiceId: invoice.id, number };
  }

  // --- Listener-invoked (never HTTP) ---

  // The event payload itself carries no per-line cost/profit — Order.costOfGoods/profit (the
  // real FIFO figures, stamped at confirm) are the source of truth, read straight off the row
  // the listener already fetches (audit fix A3). A confirmed order should always have both set
  // (orders BL#3); null-guarded defensively since this runs inside a listener — never throw,
  // just default to 0 and log loudly so a genuine data gap surfaces without breaking issuance.
  async issueFromOrder(payload: OrdersEvents['order.confirmed']): Promise<void> {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: payload.orderId } });

    if (order.costOfGoods == null || order.profit == null) {
      logger.warn(
        { orderId: order.id },
        'issueFromOrder: confirmed order missing costOfGoods/profit — defaulting invoice cost/profit to 0',
      );
    }
    const totalCost = order.costOfGoods?.toNumber() ?? 0;
    const totalProfit = order.profit?.toNumber() ?? 0;

    let clientNameSnapshot = 'Walk-in Customer';
    let clientAddressSnapshot: string | undefined;
    if (payload.posClientId != null) {
      const snapshot = await this.resolvePosClientSnapshot(payload.posClientId);
      if (snapshot.name != null) clientNameSnapshot = snapshot.name;
      if (snapshot.address != null) clientAddressSnapshot = snapshot.address;
    }
    if (payload.clientId != null) {
      const client = await this.prisma.client.findUnique({
        where: { id: payload.clientId },
        select: { firstName: true, lastName: true, address: true },
      });
      if (client) {
        clientNameSnapshot = `${client.firstName} ${client.lastName}`;
        if (client.address != null) clientAddressSnapshot = client.address;
      }
    }

    const input: Omit<InvoiceIssueInput, 'number'> = {
      ...(payload.posClientId != null ? { posClientId: payload.posClientId } : {}),
      sourceType: InvoiceSource.ORDER,
      sourceId: order.id,
      clientNameSnapshot,
      ...(clientAddressSnapshot != null ? { clientAddressSnapshot } : {}),
      totalAmount: payload.totals.totalAmount,
      paidAmount: payload.totals.paidAmount,
      totalCost,
      totalProfit,
      staffId: payload.confirmedByStaffId,
      lines: [
        {
          label: payload.snapshotLine.productName,
          quantity: payload.snapshotLine.quantity,
          unitPrice: payload.snapshotLine.unitPrice,
          costSnapshot: totalCost,
          profit: totalProfit,
          lineTotal: payload.snapshotLine.lineTotal,
        },
      ],
    };

    await this.issueInvoice(input, order.reference);
  }

  // --- Internal helpers ---

  private async issueInvoice(input: Omit<InvoiceIssueInput, 'number'>, sourceReference: string): Promise<void> {
    let allocatedNumber = '';
    try {
      await this.prisma.$transaction(async (tx) => {
        const number = await this.sequence.nextNumber(tx, DocType.INVOICE);
        await tx.invoice.create({ data: BillingMapper.toInvoicePersistence({ ...input, number }) });
        allocatedNumber = number;
      });
    } catch (err) {
      // Invoice @@unique(sourceType, sourceId) — a duplicate insert on replay is swallowed as a
      // no-op (one invoice survives); the sequence bump inside the same tx rolls back with it.
      if (isKnownRequestError(err, 'P2002')) return;
      throw err;
    }

    eventBus.emit('invoice.issued', { invoiceNumber: allocatedNumber, sourceType: input.sourceType, sourceReference });
  }

  private async findInvoiceOrThrow(number: string): Promise<InvoiceRow> {
    const invoice = await this.prisma.invoice.findUnique({ where: { number }, include: INVOICE_INCLUDE });
    if (!invoice) throw new NotFoundError('Invoice');
    return invoice;
  }

  private async listInvoicesFor(
    query: InvoiceListQuery,
    audience: InvoiceMapContext['audience'],
    scopeWhere: Prisma.InvoiceWhereInput,
  ): Promise<PaginatedResult<InvoiceDto>> {
    const where: Prisma.InvoiceWhereInput = {
      ...(query.posClientId != null ? { posClientId: query.posClientId } : {}),
      ...(query.status != null ? { status: query.status } : {}),
      ...(query.source != null ? { sourceType: query.source } : {}),
      ...(query.from != null || query.to != null
        ? {
            issuedAt: {
              ...(query.from != null ? { gte: new Date(query.from) } : {}),
              ...(query.to != null ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      // Spread last — a scoped route's own identity (posClientId=me / staffId=me) must never be
      // overridable by a query-string value.
      ...scopeWhere,
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: INVOICE_INCLUDE,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { issuedAt: 'desc' },
      }),
    ]);

    const items = await this.toInvoiceDtos(rows, audience);
    return paginated(InvoiceResponseSchema).parse({
      items,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }

  private async toInvoiceDtos(invoices: InvoiceRow[], audience: InvoiceMapContext['audience']): Promise<InvoiceDto[]> {
    const sourceReferenceById = await this.resolveSourceReferences(invoices);
    const currentAvgStockPriceByLineId = audience === 'admin' ? await this.resolveCurrentAvgStockPrices(invoices) : undefined;

    return invoices.map((invoice) =>
      BillingMapper.toInvoiceDto(invoice, {
        audience,
        sourceReference: sourceReferenceById.get(invoice.sourceId) ?? '',
        ...(currentAvgStockPriceByLineId ? { currentAvgStockPriceByLineId } : {}),
      }),
    );
  }

  private async toPdfResult(invoice: InvoiceRow, audience: InvoiceMapContext['audience']): Promise<PdfResult> {
    const [dto] = await this.toInvoiceDtos([invoice], audience);
    const settings = await this.settings.getSettings();

    const body = await renderInvoicePdf({
      number: dto!.number,
      status: dto!.status,
      issuedAt: dto!.issuedAt,
      clientNameSnapshot: dto!.clientNameSnapshot,
      ...(dto!.clientAddressSnapshot != null ? { clientAddressSnapshot: dto!.clientAddressSnapshot } : {}),
      totalAmount: dto!.totalAmount,
      paidAmount: dto!.paidAmount,
      lines: dto!.lines.map((line) => ({
        label: line.label,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      })),
      store: {
        name: settings.store.name,
        ...(settings.store.address != null ? { address: settings.store.address } : {}),
        ...(settings.store.phone != null ? { phone: settings.store.phone } : {}),
      },
    });

    return { filename: `${dto!.number}.pdf`, mime: 'application/pdf', body };
  }

  // `Invoice` has no `sourceReference` column (only the opaque `sourceId`) — resolved live here
  // by batch-joining sourceId against Sale.reference/Order.reference/Repair.reference, grouped by
  // sourceType. Safe to re-derive on every read: Sale.reference/Order.reference/Repair.reference
  // are all immutable by the time an invoice can exist for them (plan §II-related report,
  // Sprint 5). No REPAIR invoice exists yet — S13 creates the first — but this resolver must be
  // complete the moment one does.
  private async resolveSourceReferences(invoices: Pick<InvoiceRow, 'sourceType' | 'sourceId'>[]): Promise<Map<string, string>> {
    const saleIds = invoices.filter((invoice) => invoice.sourceType === PrismaInvoiceSource.SALE).map((invoice) => invoice.sourceId);
    const orderIds = invoices.filter((invoice) => invoice.sourceType === PrismaInvoiceSource.ORDER).map((invoice) => invoice.sourceId);
    const repairIds = invoices.filter((invoice) => invoice.sourceType === PrismaInvoiceSource.REPAIR).map((invoice) => invoice.sourceId);

    const [sales, orders, repairs] = await Promise.all([
      saleIds.length ? this.prisma.sale.findMany({ where: { id: { in: saleIds } }, select: { id: true, reference: true } }) : [],
      orderIds.length ? this.prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, reference: true } }) : [],
      repairIds.length ? this.prisma.repair.findMany({ where: { id: { in: repairIds } }, select: { id: true, reference: true } }) : [],
    ]);

    const map = new Map<string, string>();
    for (const sale of sales) map.set(sale.id, sale.reference);
    for (const order of orders) map.set(order.id, order.reference);
    for (const repair of repairs) map.set(repair.id, repair.reference);
    return map;
  }

  // `InvoiceLine` has no `productId` (only a free-text `label`) — no FK path to Product at all
  // for SALE-origin invoices, so those are correlated back to the source Sale's own lines by
  // best-effort (label, quantity, unitPrice) matching — not airtight for a sale with two
  // identical lines entered separately rather than one line at a higher quantity (documented
  // limitation, Sprint 5 report). ORDER-origin invoices have no such ambiguity: Order.productId
  // is a direct FK and every ORDER invoice has exactly one line (audit fix A3). REPAIR-origin
  // invoices are not correlated at all yet — whether a repair invoice line even carries a
  // productId is S13's decision, made when it builds pickup-time issuance.
  private async resolveCurrentAvgStockPrices(invoices: InvoiceRow[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    const saleSourced = invoices.filter((invoice) => invoice.sourceType === PrismaInvoiceSource.SALE);
    const orderSourced = invoices.filter((invoice) => invoice.sourceType === PrismaInvoiceSource.ORDER);

    const productIdByInvoiceLineId = new Map<string, string>();

    if (saleSourced.length > 0) {
      const saleLines = await this.prisma.saleLine.findMany({ where: { saleId: { in: saleSourced.map((i) => i.sourceId) } } });
      const linesBySaleId = new Map<string, typeof saleLines>();
      for (const line of saleLines) {
        const list = linesBySaleId.get(line.saleId) ?? [];
        list.push(line);
        linesBySaleId.set(line.saleId, list);
      }

      for (const invoice of saleSourced) {
        const candidates = linesBySaleId.get(invoice.sourceId) ?? [];
        for (const invoiceLine of invoice.lines) {
          const match = candidates.find(
            (line) =>
              line.productNameSnapshot === invoiceLine.label &&
              line.quantity === invoiceLine.quantity &&
              line.unitPrice.toNumber() === invoiceLine.unitPrice.toNumber(),
          );
          if (match) productIdByInvoiceLineId.set(invoiceLine.id, match.productId);
        }
      }
    }

    if (orderSourced.length > 0) {
      const orders = await this.prisma.order.findMany({
        where: { id: { in: orderSourced.map((i) => i.sourceId) } },
        select: { id: true, productId: true },
      });
      const productIdByOrderId = new Map(orders.map((order) => [order.id, order.productId]));

      for (const invoice of orderSourced) {
        const productId = productIdByOrderId.get(invoice.sourceId);
        const invoiceLine = invoice.lines[0]; // ORDER invoices always have exactly one line
        if (productId != null && invoiceLine) productIdByInvoiceLineId.set(invoiceLine.id, productId);
      }
    }

    if (productIdByInvoiceLineId.size === 0) return result;

    const productIds = [...new Set(productIdByInvoiceLineId.values())];
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, avgStockPrice: true } });
    const avgStockPriceByProductId = new Map(products.map((product) => [product.id, product.avgStockPrice.toNumber()]));

    for (const [invoiceLineId, productId] of productIdByInvoiceLineId) {
      const avgStockPrice = avgStockPriceByProductId.get(productId);
      if (avgStockPrice != null) result.set(invoiceLineId, avgStockPrice);
    }
    return result;
  }

  // JWTPayload carries `clientId`, never a `posClientId` — `Client.posClientId` is a separate FK,
  // null until the client is approved (materialized by clients' own listener). Mirrors clients'
  // own getMe, which proxies credit/totalPaid/totalSold through this same linked row.
  private async resolvePosClientIdForClient(clientId: string): Promise<string | null> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { posClientId: true } });
    return client?.posClientId ?? null;
  }

  private async resolvePosClientSnapshot(posClientId: string): Promise<{ name?: string; address?: string }> {
    const [posClient, linkedClient] = await Promise.all([
      this.prisma.posClient.findUnique({ where: { id: posClientId } }),
      this.prisma.client.findFirst({ where: { posClientId }, select: { address: true } }),
    ]);
    return {
      ...(posClient != null ? { name: posClient.name } : {}),
      ...(linkedClient?.address != null ? { address: linkedClient.address } : {}),
    };
  }
}
