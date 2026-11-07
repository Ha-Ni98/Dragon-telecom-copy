import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { Prisma, SupplierInvoiceStatus as PrismaSupplierInvoiceStatus } from '@prisma/client';
import {
  DocType,
  MovementType,
  SupplierInvoiceStatus,
  SupplierPaymentResponseSchema,
  SupplierResponseSchema,
  SupplierInvoiceResponseSchema,
  paginated,
  storeDayRangeUtc,
  type CancelSupplierInvoiceCommand,
  type ConfirmResultDto,
  type CreateSupplierCommand,
  type CreateSupplierInvoiceCommand,
  type CreateSupplierPaymentCommand,
  type PaginatedResult,
  type SupplierDetailDto,
  type SupplierDto,
  type SupplierInvoiceDto,
  type SupplierInvoiceListQuery,
  type SupplierListQuery,
  type SupplierPaymentDto,
  type SupplierPaymentListQuery,
  type SupplierStatsDto,
  type UpdateSupplierCommand,
  type UpdateSupplierInvoiceCommand,
} from '@dragon-telecom/contract';
import { BadRequestError, ConflictError, NotFoundError } from '@common/errors';
import { eventBus } from '@common/events/event-bus';
import type { IInventoryService } from '../inventory/inventory.interface';
import type { ISequenceService } from '../platform/platform.interface';
import type { ICatalogRepricePort } from './purchasing.interface';
import type { IPurchasingService } from './purchasing.interface';
import {
  PurchasingMapper,
  type ProductHistoryRow,
  type RepriceCandidateRow,
  type SupplierInvoiceLineRow,
  type SupplierInvoiceRow,
} from './purchasing.mapper';

const isKnownRequestError = (err: unknown, code: string): err is Prisma.PrismaClientKnownRequestError =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

const INVOICE_INCLUDE = {
  supplier: { select: { name: true, credit: true } },
  staff: { select: { firstName: true, lastName: true } },
  lines: true,
} satisfies Prisma.SupplierInvoiceInclude;

const PAYMENT_INCLUDE = {
  supplier: { select: { name: true } },
  supplierInvoice: { select: { reference: true } },
  staff: { select: { firstName: true, lastName: true } },
} satisfies Prisma.SupplierPaymentInclude;

type LineInput = { productId: string; quantity: number; unitCost: number; serialNumbers?: string | undefined };

export class PurchasingService implements IPurchasingService {
  constructor(
    private prisma: PrismaClient,
    private sequence: ISequenceService,
    private inventory: IInventoryService,
    private catalogReprice: ICatalogRepricePort,
  ) {}

  // --- Suppliers ---

  async listSuppliers(query: SupplierListQuery): Promise<PaginatedResult<SupplierDto>> {
    const where: Prisma.SupplierWhereInput = {
      ...(query.isEnabled !== undefined ? { isEnabled: query.isEnabled } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, suppliers] = await this.prisma.$transaction([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items = await Promise.all(
      suppliers.map(async (supplier) => {
        const [invoiceCount, lastDeliveryAt] = await Promise.all([
          this.prisma.supplierInvoice.count({ where: { supplierId: supplier.id } }),
          this.getLastDeliveryAt(supplier.id),
        ]);
        return PurchasingMapper.toSupplierDto(supplier, { invoiceCount, ...(lastDeliveryAt != null ? { lastDeliveryAt } : {}) });
      }),
    );

    return paginated(SupplierResponseSchema).parse({
      items,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }

  async supplierStats(): Promise<SupplierStatsDto> {
    const [totalSuppliers, aggregate] = await this.prisma.$transaction([
      this.prisma.supplier.count(),
      this.prisma.supplier.aggregate({ _sum: { credit: true, totalInvoiced: true } }),
    ]);
    return PurchasingMapper.toSupplierStatsDto({
      totalSuppliers,
      totalCredit: aggregate._sum.credit?.toNumber() ?? 0,
      totalInvoiced: aggregate._sum.totalInvoiced?.toNumber() ?? 0,
    });
  }

  async getSupplier(id: string): Promise<SupplierDetailDto> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundError('Supplier');

    const [invoiceCount, lastDeliveryAt, invoiceRows, paymentRows, productHistory] = await Promise.all([
      this.prisma.supplierInvoice.count({ where: { supplierId: id } }),
      this.getLastDeliveryAt(id),
      this.prisma.supplierInvoice.findMany({ where: { supplierId: id }, include: INVOICE_INCLUDE, orderBy: { createdAt: 'desc' } }),
      this.prisma.supplierPayment.findMany({ where: { supplierId: id }, include: PAYMENT_INCLUDE, orderBy: { paidAt: 'desc' } }),
      this.getProductHistory(id),
    ]);

    const supplierDto = PurchasingMapper.toSupplierDto(supplier, { invoiceCount, ...(lastDeliveryAt != null ? { lastDeliveryAt } : {}) });
    const invoiceDtos = await Promise.all(invoiceRows.map((row) => this.toInvoiceDtoWithProjection(row)));
    const paymentDtos = paymentRows.map((row) => PurchasingMapper.toSupplierPaymentDto(row));

    return PurchasingMapper.toSupplierDetailDto(supplierDto, invoiceDtos, paymentDtos, productHistory);
  }

  async createSupplier(cmd: CreateSupplierCommand): Promise<SupplierDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      const code = await this.sequence.nextNumber(tx, DocType.SUPPLIER);
      return tx.supplier.create({
        data: {
          code,
          name: cmd.name,
          ...(cmd.contactName != null ? { contactName: cmd.contactName } : {}),
          ...(cmd.phone != null ? { phone: cmd.phone } : {}),
          ...(cmd.email != null ? { email: cmd.email } : {}),
          ...(cmd.location != null ? { location: cmd.location } : {}),
          ...(cmd.initialCredit != null ? { credit: cmd.initialCredit } : {}),
        },
      });
    });

    // Opening-credit narration — the only place createSupplier changes credit with no other
    // event covering it (unlike confirm/cancel/payment, each already narrated by observability
    // via its own specific event — plan §D-6 precedent). Skipped for a 0→0 create (no-op event).
    if (cmd.initialCredit) {
      eventBus.emit('supplier.creditChanged', {
        supplierId: created.id,
        previousCredit: 0,
        newCredit: cmd.initialCredit,
        cause: 'Initial credit',
      });
    }

    return PurchasingMapper.toSupplierDto(created, { invoiceCount: 0 });
  }

  async updateSupplier(id: string, cmd: UpdateSupplierCommand): Promise<SupplierDto> {
    let updated;
    try {
      updated = await this.prisma.supplier.update({
        where: { id },
        data: {
          ...(cmd.name !== undefined ? { name: cmd.name } : {}),
          ...(cmd.contactName !== undefined ? { contactName: cmd.contactName } : {}),
          ...(cmd.phone !== undefined ? { phone: cmd.phone } : {}),
          ...(cmd.email !== undefined ? { email: cmd.email } : {}),
          ...(cmd.location !== undefined ? { location: cmd.location } : {}),
          ...(cmd.isEnabled !== undefined ? { isEnabled: cmd.isEnabled } : {}),
        },
      });
    } catch (err) {
      if (isKnownRequestError(err, 'P2025')) throw new NotFoundError('Supplier');
      throw err;
    }

    const [invoiceCount, lastDeliveryAt] = await Promise.all([
      this.prisma.supplierInvoice.count({ where: { supplierId: id } }),
      this.getLastDeliveryAt(id),
    ]);
    return PurchasingMapper.toSupplierDto(updated, { invoiceCount, ...(lastDeliveryAt != null ? { lastDeliveryAt } : {}) });
  }

  // --- Supplier invoices ---

  async listInvoices(query: SupplierInvoiceListQuery): Promise<PaginatedResult<SupplierInvoiceDto>> {
    const where: Prisma.SupplierInvoiceWhereInput = {
      ...(query.supplierId != null ? { supplierId: query.supplierId } : {}),
      // set-03 A4 — ADM-04 Supply history: invoices whose lines touched this product.
      ...(query.productId != null ? { lines: { some: { productId: query.productId } } } : {}),
      ...(query.status != null ? { status: query.status as PrismaSupplierInvoiceStatus } : {}),
      // invoiceDate is @db.Date — a plain calendar date, so lte <to> already includes the to day (S34 audit).
      ...(query.from != null || query.to != null
        ? {
            invoiceDate: {
              ...(query.from != null ? { gte: new Date(query.from) } : {}),
              ...(query.to != null ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.supplierInvoice.count({ where }),
      this.prisma.supplierInvoice.findMany({
        where,
        include: INVOICE_INCLUDE,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items = await Promise.all(rows.map((row) => this.toInvoiceDtoWithProjection(row)));

    return paginated(SupplierInvoiceResponseSchema).parse({
      items,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }

  async getInvoice(id: string): Promise<SupplierInvoiceDto> {
    const invoice = await this.prisma.supplierInvoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!invoice) throw new NotFoundError('SupplierInvoice');
    return this.toInvoiceDtoWithProjection(invoice);
  }

  async createInvoice(cmd: CreateSupplierInvoiceCommand, staffId: string): Promise<SupplierInvoiceDto> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: cmd.supplierId },
      select: { id: true, isEnabled: true },
    });
    if (!supplier) throw new BadRequestError('Unknown supplierId');
    // A disabled supplier is out of business with the store: no new purchase document may be
    // opened against it (S7 I13). Existing invoices stay fully readable and payable.
    if (!supplier.isEnabled) throw new BadRequestError('Supplier is disabled');

    const { linesData, totalAmount } = await this.buildInvoiceLines(cmd.lines, cmd.shippingCost ?? 0, cmd.amountOnly);
    // Defence in depth behind the contract refine — a belt-and-braces check since this figure is
    // also relied on by confirmInvoice's stock/credit arithmetic (S7 I2/F10).
    if (totalAmount <= 0) throw new BadRequestError('An invoice must carry goods or an amount above 0');

    const created = await this.prisma.supplierInvoice.create({
      data: {
        reference: this.draftReference(),
        ...(cmd.supplierReference != null ? { supplierReference: cmd.supplierReference } : {}),
        supplierId: cmd.supplierId,
        status: PrismaSupplierInvoiceStatus.DRAFT,
        invoiceDate: new Date(cmd.invoiceDate),
        ...(cmd.dueDate != null ? { dueDate: new Date(cmd.dueDate) } : {}),
        shippingCost: cmd.shippingCost ?? 0,
        ...(cmd.amountOnly != null ? { amountOnly: cmd.amountOnly } : {}),
        totalAmount,
        ...(cmd.note != null ? { note: cmd.note } : {}),
        staffId,
        ...(linesData.length ? { lines: { create: linesData } } : {}),
      },
      include: INVOICE_INCLUDE,
    });

    return this.toInvoiceDtoWithProjection(created);
  }

  async updateInvoice(id: string, cmd: UpdateSupplierInvoiceCommand): Promise<SupplierInvoiceDto> {
    const existing = await this.prisma.supplierInvoice.findUnique({ where: { id }, include: { lines: true } });
    if (!existing) throw new NotFoundError('SupplierInvoice');
    if (existing.status !== PrismaSupplierInvoiceStatus.DRAFT) {
      throw new ConflictError('Invoice is no longer editable (not DRAFT)');
    }

    // Which branch (amountOnly vs lines) is now in effect: an explicit patch field wins; absent
    // either, keep whichever branch the existing row is already on.
    const usesLines = cmd.lines !== undefined ? true : cmd.amountOnly !== undefined ? false : existing.amountOnly == null;
    const shippingCost = cmd.shippingCost ?? existing.shippingCost.toNumber();

    let totalAmount: number;
    let lineWrites: Prisma.SupplierInvoiceUpdateInput['lines'];

    if (usesLines) {
      const sourceLines: LineInput[] =
        cmd.lines ??
        existing.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitCost: line.unitCost.toNumber(),
          ...(line.serialNumbers != null ? { serialNumbers: line.serialNumbers } : {}),
        }));
      const built = await this.buildInvoiceLines(sourceLines, shippingCost, undefined);
      totalAmount = built.totalAmount;
      lineWrites = { deleteMany: {}, create: built.linesData };
    } else {
      totalAmount = cmd.amountOnly ?? existing.amountOnly!.toNumber();
      lineWrites = existing.lines.length ? { deleteMany: {} } : undefined;
    }

    // Defence in depth behind the contract refine — updateInvoice composes the patch with the
    // stored row, so an empty result is reachable through a shape the schema alone can't see
    // (S7 I2/F10).
    if (totalAmount <= 0) throw new BadRequestError('An invoice must carry goods or an amount above 0');

    await this.prisma.supplierInvoice.update({
      where: { id },
      data: {
        ...(cmd.supplierReference !== undefined ? { supplierReference: cmd.supplierReference } : {}),
        ...(cmd.invoiceDate !== undefined ? { invoiceDate: new Date(cmd.invoiceDate) } : {}),
        ...(cmd.dueDate !== undefined ? { dueDate: new Date(cmd.dueDate) } : {}),
        shippingCost,
        amountOnly: usesLines ? null : totalAmount,
        totalAmount,
        ...(cmd.note !== undefined ? { note: cmd.note } : {}),
        ...(lineWrites ? { lines: lineWrites } : {}),
      },
    });

    return this.getInvoice(id);
  }

  async confirmInvoice(id: string, staffId: string): Promise<ConfirmResultDto> {
    const existing = await this.prisma.supplierInvoice.findUnique({ where: { id }, include: { lines: true } });
    if (!existing) throw new NotFoundError('SupplierInvoice');
    if (existing.status === PrismaSupplierInvoiceStatus.CANCELLED) {
      throw new ConflictError('Invoice is cancelled');
    }

    const productIds = existing.lines.map((line) => line.productId);

    // Double-confirm — no-op (spec: "double-confirm no-op"): adds no layers, emits nothing
    // again, just recomputes repriceCandidates fresh off the *current* avgStockPrice. This pre-
    // lock check handles the common case cheaply; the in-tx re-check below (after the Supplier
    // lock) closes the race where a concurrent confirm on the same supplier commits while this
    // call is still waiting for the lock — same locked-read pattern as the credit write
    // (credit-serialization fix, plan §C1), just guarding invoice-status idempotency instead of
    // a money cache.
    if (existing.status === PrismaSupplierInvoiceStatus.CONFIRMED) {
      const repriceCandidates = productIds.length
        ? await this.prisma.$transaction((tx) => this.catalogReprice.getRepriceCandidates(tx, productIds))
        : [];
      return PurchasingMapper.toConfirmResultDto(existing.reference, repriceCandidates);
    }

    let capturedTx: Prisma.TransactionClient | undefined;
    let previousCredit = 0;
    let newCredit = 0;
    let reference = existing.reference;
    let repriceCandidates: RepriceCandidateRow[] = [];
    let didConfirm = false;

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      const supplier = await this.lockSupplier(tx, existing.supplierId);

      const current = await tx.supplierInvoice.findUniqueOrThrow({ where: { id }, select: { status: true, reference: true } });
      if (current.status === PrismaSupplierInvoiceStatus.CONFIRMED) {
        reference = current.reference;
        repriceCandidates = productIds.length ? await this.catalogReprice.getRepriceCandidates(tx, productIds) : [];
        return;
      }

      previousCredit = supplier.credit.toNumber();
      newCredit = previousCredit + existing.totalAmount.toNumber();

      // Written here, inside the same locked transaction, not by a post-commit listener
      // (credit-serialization fix, plan §C1) — a fast sequential second confirm/cancel/payment
      // on this supplier now reads a value this write has already committed, never a stale one.
      await tx.supplier.update({
        where: { id: existing.supplierId },
        data: { credit: newCredit, totalInvoiced: { increment: existing.totalAmount.toNumber() } },
      });

      for (const line of existing.lines) {
        await this.inventory.addLayer(tx, line.productId, line.quantity, line.landedUnitCost.toNumber(), MovementType.SUPPLIER_INVOICE, {
          referenceType: 'SUPPLIER_INVOICE',
          referenceId: existing.id,
          staffId,
        });
      }

      reference = await this.sequence.nextNumber(tx, DocType.SUPPLIER_INVOICE);

      // S33 — confirmedAt anchors the invoice in the Caisse (the double-confirm paths above
      // return before reaching here, so the first confirm's stamp is never overwritten).
      await tx.supplierInvoice.update({
        where: { id },
        data: { reference, status: PrismaSupplierInvoiceStatus.CONFIRMED, previousCredit, newCredit, confirmedAt: new Date() },
      });

      repriceCandidates = productIds.length ? await this.catalogReprice.getRepriceCandidates(tx, productIds) : [];
      didConfirm = true;
    });

    if (!didConfirm) {
      return PurchasingMapper.toConfirmResultDto(reference, repriceCandidates);
    }

    this.inventory.flushEvents(capturedTx!);

    eventBus.emit('supplierInvoice.confirmed', {
      invoiceId: id,
      supplierId: existing.supplierId,
      totalAmount: existing.totalAmount.toNumber(),
      previousCredit,
      newCredit,
    });

    return PurchasingMapper.toConfirmResultDto(reference, repriceCandidates);
  }

  async cancelInvoice(id: string, cmd: CancelSupplierInvoiceCommand, _staffId: string): Promise<SupplierInvoiceDto> {
    const existing = await this.prisma.supplierInvoice.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('SupplierInvoice');
    if (existing.status === PrismaSupplierInvoiceStatus.CANCELLED) {
      return this.getInvoice(id); // idempotent
    }

    // Only a previously-CONFIRMED invoice touched credit/stock — a DRAFT cancel has nothing to
    // reverse, so it must never emit (the receiving side would otherwise wrongly decrement
    // credit that was never added). Stock reversal is deliberately NOT automatic here (spec
    // BL#4) — the admin issues a manual ADJUSTMENT_OUT through the inventory module.
    const wasConfirmed = existing.status === PrismaSupplierInvoiceStatus.CONFIRMED;
    const totalAmount = existing.totalAmount.toNumber();

    // Credit reversal written in-tx, same locked-transaction pattern as confirmInvoice/
    // createPayment (credit-serialization fix, plan §C1) — no post-commit listener race.
    await this.prisma.$transaction(async (tx) => {
      if (wasConfirmed) {
        await this.lockSupplier(tx, existing.supplierId);
        await tx.supplier.update({
          where: { id: existing.supplierId },
          data: { credit: { decrement: totalAmount }, totalInvoiced: { decrement: totalAmount } },
        });
      }
      await tx.supplierInvoice.update({ where: { id }, data: { status: PrismaSupplierInvoiceStatus.CANCELLED } });
    });

    if (wasConfirmed) {
      eventBus.emit('supplierInvoice.cancelled', {
        invoiceId: id,
        supplierId: existing.supplierId,
        ...(cmd.reason != null ? { reason: cmd.reason } : {}),
      });
    }

    return this.getInvoice(id);
  }

  // --- Payments ---

  async listPayments(query: SupplierPaymentListQuery): Promise<PaginatedResult<SupplierPaymentDto>> {
    const where: Prisma.SupplierPaymentWhereInput = {
      ...(query.supplierId != null ? { supplierId: query.supplierId } : {}),
      // S8 J8 — the payments tab's date-range filter. S34 — Africa/Algiers days, `to` inclusive.
      ...(query.from != null || query.to != null ? { paidAt: storeDayRangeUtc(query.from, query.to) } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.supplierPayment.count({ where }),
      this.prisma.supplierPayment.findMany({
        where,
        include: PAYMENT_INCLUDE,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { paidAt: 'desc' },
      }),
    ]);

    return paginated(SupplierPaymentResponseSchema).parse({
      items: rows.map((row) => PurchasingMapper.toSupplierPaymentDto(row)),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }

  async createPayment(cmd: CreateSupplierPaymentCommand, staffId: string): Promise<SupplierPaymentDto> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: cmd.supplierId }, select: { id: true } });
    if (!supplier) throw new BadRequestError('Unknown supplierId');

    let invoiceId: string | undefined;
    if (cmd.supplierInvoiceReference != null) {
      const invoice = await this.prisma.supplierInvoice.findUnique({
        where: { reference: cmd.supplierInvoiceReference },
        select: { id: true, supplierId: true },
      });
      if (!invoice) throw new BadRequestError('Unknown supplierInvoiceReference');
      if (invoice.supplierId !== cmd.supplierId) throw new BadRequestError('Invoice does not belong to the given supplier');
      invoiceId = invoice.id;
    }

    let previousCredit = 0;
    let newCredit = 0;
    // Same effective date drives both the SupplierPayment row's own paidAt and the invoice's
    // rollup paidDate (S1, R2) — computed once so the two can never disagree.
    const effectivePaidAt = cmd.paidAt != null ? new Date(cmd.paidAt) : new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const lockedSupplier = await this.lockSupplier(tx, cmd.supplierId);
      previousCredit = lockedSupplier.credit.toNumber();
      newCredit = previousCredit - cmd.amount; // overpayment permitted — negative = supplier owes

      // Written here, inside the same locked transaction (credit-serialization fix, plan §C1) —
      // both the supplier cache and the targeted invoice's paidAmount/paidDate are purchasing's
      // own data, so both move with the snapshot computation rather than a post-commit listener.
      await tx.supplier.update({
        where: { id: cmd.supplierId },
        data: { credit: newCredit, totalPaid: { increment: cmd.amount } },
      });
      if (invoiceId != null) {
        await tx.supplierInvoice.update({
          where: { id: invoiceId },
          data: { paidAmount: { increment: cmd.amount }, paidDate: effectivePaidAt },
        });
      }

      const reference = await this.sequence.nextNumber(tx, DocType.SUPPLIER_PAYMENT);

      return tx.supplierPayment.create({
        data: {
          reference,
          supplierId: cmd.supplierId,
          ...(invoiceId != null ? { supplierInvoiceId: invoiceId } : {}),
          amount: cmd.amount,
          previousCredit,
          newCredit,
          paidAt: effectivePaidAt,
          staffId,
        },
        include: PAYMENT_INCLUDE,
      });
    });

    eventBus.emit('payment.supplierRecorded', {
      paymentId: created.id,
      supplierId: cmd.supplierId,
      ...(cmd.supplierInvoiceReference != null ? { supplierInvoiceReference: cmd.supplierInvoiceReference } : {}),
      amount: cmd.amount,
      previousCredit,
      newCredit,
    });

    return PurchasingMapper.toSupplierPaymentDto(created);
  }

  // --- Private helpers ---

  // Locks the Supplier row for the duration of the caller's transaction (same
  // `SELECT ... FOR UPDATE` precedent as inventory's lockProduct / platform's SequenceService)
  // — the serialization point for confirm/cancel/payment's credit read-modify-write.
  private async lockSupplier(tx: Prisma.TransactionClient, supplierId: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Supplier" WHERE id = ${supplierId} FOR UPDATE`;
    if (!rows[0]) throw new NotFoundError('Supplier');
    return tx.supplier.findUniqueOrThrow({ where: { id: supplierId } });
  }

  // DRAFT rows need *some* value for the NOT NULL/unique `reference` column before a real
  // sequence number is allocated at confirm time (spec: "SequenceService('SUPPLIER_INVOICE') →
  // CONFIRMED" — allocation is explicitly a confirm-time step, not a create-time one). A
  // temporary, unique placeholder is overwritten by the real reference once confirmed.
  private draftReference(): string {
    return `DRAFT-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  }

  // Landed cost: unitCost + shippingCost × (lineTotal / Σ lineTotals) / quantity (spec BL#2).
  // `lines: undefined` (the amountOnly branch) yields no lines and totalAmount = amountOnly.
  private async buildInvoiceLines(
    lines: LineInput[] | undefined,
    shippingCost: number,
    amountOnly: number | undefined,
  ): Promise<{ linesData: Prisma.SupplierInvoiceLineUncheckedCreateWithoutSupplierInvoiceInput[]; totalAmount: number }> {
    if (!lines) {
      return { linesData: [], totalAmount: amountOnly ?? 0 };
    }

    const lineTotals = lines.map((line) => line.unitCost * line.quantity);
    const sumLineTotals = lineTotals.reduce((sum, value) => sum + value, 0);

    const costBasis = await this.catalogReprice.getCostBasis(lines.map((line) => line.productId));
    const nameByProductId = new Map(costBasis.map((row) => [row.productId, row.name]));

    const linesData = lines.map((line, index) => {
      const name = nameByProductId.get(line.productId);
      if (name == null) throw new BadRequestError(`Unknown productId: ${line.productId}`);

      const lineTotal = lineTotals[index]!;
      // Guards the degenerate all-zero-cost case (Σ lineTotals === 0) — nothing to apportion by.
      const shippingShare = sumLineTotals === 0 ? 0 : shippingCost * (lineTotal / sumLineTotals);
      const landedUnitCost = line.unitCost + shippingShare / line.quantity;

      return {
        productId: line.productId,
        productNameSnapshot: name,
        quantity: line.quantity,
        unitCost: line.unitCost,
        landedUnitCost,
        lineTotal,
        ...(line.serialNumbers != null ? { serialNumbers: line.serialNumbers } : {}),
      };
    });

    return { linesData, totalAmount: sumLineTotals + shippingCost };
  }

  // lastDeliveryAt isn't a Supplier column (Sprint 5's schema-gap resolution) — derived as the
  // most recent CONFIRMED invoice's updatedAt. updatedAt approximates the confirm time but also
  // moves when a payment updates paidAmount/paidDate (S33/F1). confirmedAt (S33) is exact, but is
  // null for invoices confirmed before S33, so these readers keep updatedAt for now.
  private async getLastDeliveryAt(supplierId: string): Promise<Date | undefined> {
    const aggregate = await this.prisma.supplierInvoice.aggregate({
      where: { supplierId, status: PrismaSupplierInvoiceStatus.CONFIRMED },
      _max: { updatedAt: true },
    });
    return aggregate._max.updatedAt ?? undefined;
  }

  private async getProductHistory(supplierId: string): Promise<ProductHistoryRow[]> {
    const lines = await this.prisma.supplierInvoiceLine.findMany({
      where: { supplierInvoice: { supplierId, status: PrismaSupplierInvoiceStatus.CONFIRMED } },
      include: { supplierInvoice: { select: { updatedAt: true } } },
    });

    const byProduct = new Map<string, { productName: string; totalQuantity: number; lastPurchaseAt: Date }>();
    for (const line of lines) {
      // updatedAt ≈ confirm time, but a later payment moves it too (S33/F1 — see getLastDeliveryAt).
      const purchaseAt = line.supplierInvoice.updatedAt;
      const existing = byProduct.get(line.productId);
      if (existing) {
        existing.totalQuantity += line.quantity;
        if (purchaseAt > existing.lastPurchaseAt) existing.lastPurchaseAt = purchaseAt;
      } else {
        byProduct.set(line.productId, { productName: line.productNameSnapshot, totalQuantity: line.quantity, lastPurchaseAt: purchaseAt });
      }
    }

    return Array.from(byProduct.entries()).map(([productId, value]) => ({ productId, ...value }));
  }

  // DRAFT reads carry projectedNewAvgStockPrice per line (spec BL#2); CONFIRMED/CANCELLED don't
  // project (the average is already real, not projected). Projects avgStockPrice specifically —
  // not avgPrice, which is unaffected by the quantity-weighted formula below (D10).
  private async toInvoiceDtoWithProjection(
    invoice: SupplierInvoiceRow | (Omit<SupplierInvoiceRow, 'lines'> & { lines: Omit<SupplierInvoiceLineRow, 'projectedNewAvgStockPrice'>[] }),
  ): Promise<SupplierInvoiceDto> {
    if (invoice.status !== SupplierInvoiceStatus.DRAFT || invoice.lines.length === 0) {
      return PurchasingMapper.toSupplierInvoiceDto(invoice as SupplierInvoiceRow);
    }

    const costBasis = await this.catalogReprice.getCostBasis(invoice.lines.map((line) => line.productId));
    const basisByProduct = new Map(costBasis.map((row) => [row.productId, row]));

    const linesWithProjection: SupplierInvoiceLineRow[] = invoice.lines.map((line) => {
      const basis = basisByProduct.get(line.productId);
      if (!basis) return line;
      const projectedNewAvgStockPrice =
        (basis.quantityOnHand * basis.avgStockPrice + line.quantity * line.landedUnitCost.toNumber()) /
        (basis.quantityOnHand + line.quantity);
      return { ...line, projectedNewAvgStockPrice };
    });

    return PurchasingMapper.toSupplierInvoiceDto({ ...invoice, lines: linesWithProjection } as SupplierInvoiceRow);
  }
}
