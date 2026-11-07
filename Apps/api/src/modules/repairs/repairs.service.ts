import type { Prisma, PrismaClient, RepairPart } from '@prisma/client';
import { MovementType as PrismaMovementType, RepairStatus as PrismaRepairStatus } from '@prisma/client';
import {
  DocType,
  InvoiceSource,
  MovementType,
  REPAIR_ERROR,
  RepairResponseSchema,
  RepairStatus,
  UserType,
  isRepairReadOnly,
  isRepairTransitionAllowed,
  paginated,
  storeDayRangeUtc,
  type AddRepairPartCommand,
  type AddRepairPartsCommand,
  type CreateRepairCommand,
  type JWTPayload,
  type PaginatedResult,
  type RecordRepairPaymentCommand,
  type RepairDto,
  type RepairListQuery,
  type RepairStatusCommand,
  type ReturnRepairCommand,
  type TechnicianRepairStatsDto,
  type UpdateRepairCommand,
} from '@dragon-telecom/contract';
import { BadRequestError, ConflictError, NotFoundError } from '@common/errors';
import { eventBus } from '@common/events/event-bus';
import { SystemStaffResolver } from '@common/utils/system-staff.utils';
import type { ConsumptionLine, IInventoryService } from '../inventory/inventory.interface';
import type { ISequenceService } from '../platform/platform.interface';
import type { IBillingIssuePort, IRepairCreditPort, IRepairsService } from './repairs.interface';
import { RepairsMapper } from './repairs.mapper';

const REPAIR_INCLUDE = {
  brand: { select: { id: true, name: true } },
  deviceModel: { select: { id: true, name: true } },
  technician: { select: { id: true, name: true } },
  parts: true,
  history: {
    include: { staff: { select: { firstName: true, lastName: true } } },
    orderBy: { changedAt: 'asc' as const },
  },
  payments: { orderBy: { paidAt: 'asc' as const } },
  invoice: { select: { number: true } },
} satisfies Prisma.RepairInclude;
type RepairWithIncludes = Prisma.RepairGetPayload<{ include: typeof REPAIR_INCLUDE }>;

// One captured S30 reversal row — everything the caller needs to emit `payment.clientRecorded`
// after its own commit.
type CapturedReversal = { paymentId: string; previousCredit: number; newCredit: number; amount: number };

// The labour line's label on the issued invoice (D9). A persisted snapshot, not UI text — same
// class as billing's own 'Walk-in Customer' default, so it is a server-side constant and not a
// t() key.
const REPAIR_LABOUR_LINE_LABEL = 'Labour';

export class RepairsService implements IRepairsService {
  private readonly systemStaff: SystemStaffResolver;

  constructor(
    private prisma: PrismaClient,
    private inventory: IInventoryService,
    private sequence: ISequenceService,
    private clientCredit: IRepairCreditPort,
    private billing: IBillingIssuePort,
  ) {
    this.systemStaff = new SystemStaffResolver(prisma);
  }

  // staff(STAFF_REPAIRS): created-by-me, derived from the intake history marker (§C-1);
  // admin: all. S13/R2 — paginated at 10/page (page selector in the board's own filter row,
  // not a table footer), plus an intake-date range.
  async listRepairs(query: RepairListQuery, actor: JWTPayload): Promise<PaginatedResult<RepairDto>> {
    const isAdmin = actor.type === UserType.ADMIN;
    const where: Prisma.RepairWhereInput = {
      ...(query.status != null ? { status: query.status } : {}),
      ...(query.technicianId != null ? { technicianId: query.technicianId } : {}),
      // S34 — intake date range: Africa/Algiers days, `to` inclusive.
      ...(query.from != null || query.to != null ? { intakeAt: storeDayRangeUtc(query.from, query.to) } : {}),
      ...(!isAdmin
        ? {
            history: {
              some: { fromStatus: PrismaRepairStatus.INTAKE, toStatus: PrismaRepairStatus.INTAKE, staffId: actor.staffId! },
            },
          }
        : {}),
    };

    const [total, repairs] = await this.prisma.$transaction([
      this.prisma.repair.count({ where }),
      this.prisma.repair.findMany({
        where,
        include: REPAIR_INCLUDE,
        orderBy: { intakeAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return paginated(RepairResponseSchema).parse({
      items: repairs.map((repair) => RepairsMapper.toRepairDto(repair, { includeMargins: isAdmin })),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }

  // set-03 B1 — single-ticket read, unrestricted by creator (same access shape as
  // updateRepair/addPart/etc. below — §C-1's created-by-me rule only filters listRepairs).
  async getRepair(id: string, actor: JWTPayload): Promise<RepairDto> {
    const isAdmin = actor.type === UserType.ADMIN;
    const existing = await this.prisma.repair.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Repair');
    return this.getRepairDto(id, { includeMargins: isAdmin });
  }

  // Intake: SequenceService(REPAIR); the intake RepairStatusHistory row (§C-1) both anchors
  // "created-by-me" scoping and (S13) is how the PICKED_UP event resolves its acting staff —
  // no listener reads it any more (the deleted repair-origin sale is gone, D9), but the same
  // history-lookup shape is reused inside pickUpRepair below. Attaching a POS client prefills
  // name/phone (BL#1) — resolved here (a pure read), never in the mapper.
  async createRepair(cmd: CreateRepairCommand, actor: JWTPayload): Promise<RepairDto> {
    let customerName = cmd.customerName;
    let customerPhone = cmd.customerPhone;
    if (cmd.posClientId != null) {
      const posClient = await this.prisma.posClient.findUnique({ where: { id: cmd.posClientId }, select: { name: true, phone: true } });
      if (posClient) {
        customerName = posClient.name;
        if (posClient.phone != null) customerPhone = posClient.phone;
      }
    }

    const staffId = await this.movementStaffId(actor);

    const repairId = await this.prisma.$transaction(async (tx) => {
      const reference = await this.sequence.nextNumber(tx, DocType.REPAIR);
      const data = RepairsMapper.toPersistenceIntake(cmd, { reference, customerName, customerPhone });
      const repair = await tx.repair.create({ data });
      await tx.repairStatusHistory.create({
        data: {
          repairId: repair.id,
          fromStatus: PrismaRepairStatus.INTAKE,
          toStatus: PrismaRepairStatus.INTAKE,
          note: 'intake',
          staffId,
        },
      });
      return repair.id;
    });

    return this.getRepairDto(repairId, { includeMargins: false });
  }

  // S30 (F6) — the totals are recomputed from the LOCKED row (lockRepair), so a concurrent addPart
  // can no longer overwrite totalAmount with a stale partsTotal, nor this method with a stale
  // labourPrice.
  async updateRepair(id: string, cmd: UpdateRepairCommand, actor: JWTPayload): Promise<RepairDto> {
    const existing = await this.prisma.repair.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Repair');

    await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockRepair(tx, id);
      this.assertEditable(locked.status);
      const labourPrice = cmd.labourPrice ?? locked.labourPrice.toNumber();

      await tx.repair.update({
        where: { id },
        data: {
          ...(cmd.diagnosis != null ? { diagnosis: cmd.diagnosis } : {}),
          ...(cmd.labourPrice != null ? { labourPrice: cmd.labourPrice } : {}),
          ...(cmd.technicianId != null ? { technicianId: cmd.technicianId } : {}),
          ...(cmd.labourPrice != null ? { totalAmount: labourPrice + locked.partsTotal.toNumber() } : {}),
        },
      });
    });

    return this.getRepairDto(id, { includeMargins: actor.type === UserType.ADMIN });
  }

  // Single-part form of addParts; kept for API compatibility — the web client uses the batch
  // (addParts) since S31. Same behaviour, errors and response as before.
  async addPart(id: string, cmd: AddRepairPartCommand, actor: JWTPayload): Promise<RepairDto> {
    return this.addParts(id, { parts: [cmd] }, actor);
  }

  // reserve(PENDING_REPAIR) — shortfall throws ConflictError naming the productId (the
  // injected engine's own error, plan §II.3), rolling back the whole transaction. S30 (F6) — the
  // editable check runs on the locked row INSIDE the transaction: a part can no longer be
  // reserved onto a repair another tab has just picked up or cancelled (that reservation would
  // never have been released). S31 (P1) — the drawer's staged parts list arrives here as one
  // batch; all or nothing, so a failed batch leaves no partial reservation behind.
  async addParts(id: string, cmd: AddRepairPartsCommand, actor: JWTPayload): Promise<RepairDto> {
    const existing = await this.prisma.repair.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Repair');
    this.assertEditable(existing.status);

    const productIds = [...new Set(cmd.parts.map((part) => part.productId))];
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } });
    const nameById = new Map(products.map((product) => [product.id, product.name]));
    const missingId = productIds.find((productId) => !nameById.has(productId));
    if (missingId != null) throw new BadRequestError(`Unknown productId: ${missingId}`);

    const staffId = await this.movementStaffId(actor);
    let capturedTx: Prisma.TransactionClient | undefined;

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      const locked = await this.lockRepair(tx, id);
      this.assertEditable(locked.status);

      // Command order — the first shortfall throws and rolls every earlier reservation back.
      for (const part of cmd.parts) {
        await this.inventory.reserve(tx, part.productId, part.quantity, { referenceType: 'REPAIR', referenceId: id, staffId });
        await tx.repairPart.create({
          data: { repairId: id, ...RepairsMapper.toPartCreateInput(part, { productName: nameById.get(part.productId)! }) },
        });
      }

      const partsTotal = await this.recomputePartsTotal(tx, id);
      await tx.repair.update({ where: { id }, data: { partsTotal, totalAmount: locked.labourPrice.toNumber() + partsTotal } });
    });

    this.inventory.flushEvents(capturedTx!);
    return this.getRepairDto(id, { includeMargins: actor.type === UserType.ADMIN });
  }

  // release — in the same transaction that deletes the part (it always was; S30's investigation
  // found no leak here). S30 (F6) — the part is resolved from the locked repair, so a
  // double-clicked delete gets a clean 404 instead of a second release attempt.
  async removePart(id: string, partId: string, actor: JWTPayload): Promise<RepairDto> {
    const existing = await this.prisma.repair.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Repair');
    this.assertEditable(existing.status);

    const staffId = await this.movementStaffId(actor);
    let capturedTx: Prisma.TransactionClient | undefined;

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      const locked = await this.lockRepair(tx, id);
      this.assertEditable(locked.status);
      const part = locked.parts.find((p) => p.id === partId);
      if (!part) throw new NotFoundError('RepairPart');

      await this.inventory.release(tx, part.productId, part.quantity, { referenceType: 'REPAIR', referenceId: id, staffId });
      await tx.repairPart.delete({ where: { id: partId } });

      const partsTotal = await this.recomputePartsTotal(tx, id);
      await tx.repair.update({ where: { id }, data: { partsTotal, totalAmount: locked.labourPrice.toNumber() + partsTotal } });
    });

    this.inventory.flushEvents(capturedTx!);
    return this.getRepairDto(id, { includeMargins: actor.type === UserType.ADMIN });
  }

  // The transition machine (contract's REPAIR_STATUS_TRANSITIONS, S13): forward-only one step
  // at a time, INTAKE→PROCESSING→COMPLETED→PICKED_UP, or CANCELLED from INTAKE/PROCESSING/
  // COMPLETED (never from PICKED_UP). Idempotent re-COMPLETE is the only short-circuit (no
  // duplicate history/emit). PICKED_UP is delegated to pickUpRepair (D5/D8/D9 — the money
  // moment); CANCELLED to cancelRepair (D6/D8). S30 — RETURNED is never accepted here: it needs
  // per-part restock choices and goes through returnRepair. Every branch re-checks the status on
  // the locked row inside its transaction (REPAIR_ERROR.STATUS_CHANGED when another tab moved it).
  async changeStatus(id: string, cmd: RepairStatusCommand, actor: JWTPayload): Promise<RepairDto> {
    const existing = await this.prisma.repair.findUnique({ where: { id }, include: REPAIR_INCLUDE });
    if (!existing) throw new NotFoundError('Repair');
    const isAdmin = actor.type === UserType.ADMIN;

    if (cmd.toStatus === RepairStatus.COMPLETED && existing.status === PrismaRepairStatus.COMPLETED) {
      return RepairsMapper.toRepairDto(existing, { includeMargins: isAdmin });
    }

    if (cmd.toStatus === RepairStatus.RETURNED) {
      throw new BadRequestError(REPAIR_ERROR.RETURN_VIA_RETURN_ACTION);
    }

    if (!isRepairTransitionAllowed(existing.status as RepairStatus, cmd.toStatus)) {
      throw new BadRequestError('Illegal repair status transition');
    }
    if (cmd.toStatus === RepairStatus.PROCESSING && existing.technicianId == null) {
      throw new BadRequestError('technicianId is required before moving to PROCESSING');
    }

    if (cmd.toStatus === RepairStatus.PICKED_UP) {
      return this.pickUpRepair(existing, cmd, actor);
    }
    if (cmd.toStatus === RepairStatus.CANCELLED) {
      return this.cancelRepair(existing, cmd, actor);
    }

    // INTAKE→PROCESSING, PROCESSING→COMPLETED: no money, no stock movement — just the status
    // and history row (D8: nothing is consumed before PICKED_UP).
    const staffId = await this.movementStaffId(actor);
    const fromStatus = existing.status as RepairStatus;

    await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockRepair(tx, id);
      if (locked.status !== existing.status) throw new ConflictError(REPAIR_ERROR.STATUS_CHANGED);

      await tx.repairStatusHistory.create({
        data: {
          repairId: id,
          fromStatus: fromStatus as PrismaRepairStatus,
          toStatus: cmd.toStatus as PrismaRepairStatus,
          ...(cmd.note != null ? { note: cmd.note } : {}),
          staffId,
        },
      });
      await tx.repair.update({
        where: { id },
        data: {
          status: cmd.toStatus,
          ...(cmd.toStatus === RepairStatus.COMPLETED ? { completedAt: new Date() } : {}),
        },
      });
    });

    eventBus.emit('repair.statusChanged', { repairId: id, fromStatus, toStatus: cmd.toStatus });

    return this.getRepairDto(id, { includeMargins: isAdmin });
  }

  // D8/D9/D5 (S13) — the single money moment. Parts are released and consumed (FIFO, per part),
  // the invoice is issued (source REPAIR, no sale record — D9), any on-account payments are
  // re-linked to it (R3), this transition's own payment is captured, and the repair is stamped —
  // all inside one transaction, mirroring orders' own completeOrder (orders.service.ts).
  // S30 — every figure and every part is read from the repair LOCKED inside the transaction
  // (lockRepair), never from the pre-transaction `existing` snapshot, so a part added in another
  // tab is consumed rather than left reserved forever; each part also records the OUT movement
  // that consumed it (consumptionMovementId), which a later return reads to restock at cost.
  private async pickUpRepair(
    existing: RepairWithIncludes,
    cmd: RepairStatusCommand,
    actor: JWTPayload,
  ): Promise<RepairDto> {
    const staffId = await this.movementStaffId(actor);
    const isAdmin = actor.type === UserType.ADMIN;

    let paidBefore = existing.paidAmount.toNumber();
    const paymentAmount = cmd.paymentAmount ?? 0;
    let totalAmount = existing.totalAmount.toNumber();
    let labourPrice = existing.labourPrice.toNumber();

    // A walk-in has no PosClient to hold a debt against — the repair must leave fully paid.
    // Checked before the transaction opens (fail fast, no wasted FIFO work), the same discipline
    // orders' own R2 guard uses (orders.service.ts:369-374) — and again on the locked row inside.
    if (existing.posClientId == null && paidBefore + paymentAmount !== totalAmount) {
      throw new BadRequestError('CREDIT_REQUIRES_CLIENT');
    }

    let capturedTx: Prisma.TransactionClient | undefined;
    let totalCost = 0;
    let previousCredit = 0;
    let invoiceNumber = '';
    let capturedPayment: { paymentId: string; previousCredit: number; newCredit: number } | undefined;
    let stampedParts: { productId: string; productName: string; quantity: number; unitPrice: number; costOfGoods: number; profit: number; lineTotal: number }[] = [];

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      const locked = await this.lockRepair(tx, existing.id);
      if (locked.status !== existing.status) throw new ConflictError(REPAIR_ERROR.STATUS_CHANGED);
      paidBefore = locked.paidAmount.toNumber();
      totalAmount = locked.totalAmount.toNumber();
      labourPrice = locked.labourPrice.toNumber();
      if (locked.posClientId == null && paidBefore + paymentAmount !== totalAmount) {
        throw new BadRequestError('CREDIT_REQUIRES_CLIENT');
      }
      const ref = { referenceType: 'REPAIR', referenceId: existing.id, staffId };

      // D8 — release + consume every part now (this is the first and only consumption moment).
      const partFigures = new Map<string, { costOfGoods: number; profit: number }>();
      for (const part of locked.parts) {
        const revenue = part.unitPrice.toNumber() * part.quantity;
        await this.inventory.release(tx, part.productId, part.quantity, ref);
        const result = await this.inventory.consumeFifo(tx, part.productId, part.quantity, revenue, MovementType.REPAIR_CONSUMPTION, ref);
        totalCost += result.costOfGoods;
        partFigures.set(part.id, { costOfGoods: result.costOfGoods, profit: result.profit ?? 0 });
        await tx.repairPart.update({
          where: { id: part.id },
          data: { costOfGoods: result.costOfGoods, profit: result.profit, consumptionMovementId: result.movementId },
        });
      }

      // R4 — labour counts as pure profit: profit = totalAmount − totalCost, not the summed
      // part profits (which would silently drop the labour margin).
      const totalProfit = totalAmount - totalCost;

      // D5 — the document charges the full total onto the account; the money taken is applied
      // separately by the ledger call below. Composed: credit += total, same arithmetic S5/S10
      // established.
      if (existing.posClientId != null) {
        ({ previousCredit } = await this.clientCredit.applyDocumentCharge(tx, existing.posClientId, {
          totalSoldDelta: totalAmount,
          creditDelta: totalAmount,
        }));
      }

      // D9 — the invoice is issued here, at PICKED_UP, never earlier. A walk-in's snapshot name
      // falls back to the repair's own customerName rather than billing's "Walk-in Customer"
      // default, so the invoice shows who actually brought the device in.
      const issued = await this.billing.issueInvoiceInTx(tx, {
        ...(existing.posClientId != null ? { posClientId: existing.posClientId } : { clientNameSnapshot: existing.customerName }),
        sourceType: InvoiceSource.REPAIR,
        sourceId: existing.id,
        totalAmount,
        paidAmount: existing.posClientId != null ? 0 : paidBefore + paymentAmount,
        previousCredit,
        newCredit: previousCredit + (totalAmount - (paidBefore + paymentAmount)),
        totalCost,
        totalProfit,
        staffId,
        lines: [
          ...locked.parts.map((part) => {
            const figures = partFigures.get(part.id)!;
            return {
              label: part.productNameSnapshot,
              quantity: part.quantity,
              unitPrice: part.unitPrice.toNumber(),
              costSnapshot: figures.costOfGoods,
              profit: figures.profit,
              lineTotal: part.lineTotal.toNumber(),
              ...(part.serialNumbers != null ? { serialNumbers: part.serialNumbers } : {}),
            };
          }),
          ...(labourPrice > 0
            ? [
                {
                  label: REPAIR_LABOUR_LINE_LABEL,
                  quantity: 1,
                  unitPrice: labourPrice,
                  costSnapshot: 0,
                  profit: labourPrice,
                  lineTotal: labourPrice,
                },
              ]
            : []),
        ],
      });
      invoiceNumber = issued.number;

      // R3 — re-link this repair's on-account rows to the invoice just issued, before capturing
      // this transition's own payment, so the capture's ledger recompute sees every row.
      await this.billing.linkRepairPaymentsToInvoiceInTx(tx, { repairId: existing.id, invoiceId: issued.invoiceId });

      // D5 — captured only when a known client actually paid something at this step; a
      // walk-in's money is recorded on the invoice/repair directly, never as a ledger row.
      if (existing.posClientId != null && paymentAmount > 0) {
        capturedPayment = await this.billing.captureClientPaymentInTx(tx, {
          posClientId: existing.posClientId,
          invoiceId: issued.invoiceId,
          repairId: existing.id,
          amount: paymentAmount,
          staffId,
        });
      }

      // Repair.invoiceId is @unique — the same updateMany-guard idempotency latch the deleted
      // repair-origin sale used on Repair.saleId.
      const latch = await tx.repair.updateMany({
        where: { id: existing.id, invoiceId: null },
        data: {
          status: PrismaRepairStatus.PICKED_UP,
          pickedUpAt: new Date(),
          invoiceId: issued.invoiceId,
          paidAmount: paidBefore + paymentAmount,
          totalCost,
          totalProfit,
        },
      });
      if (latch.count === 0) throw new ConflictError('Repair has already been picked up');

      await tx.repairStatusHistory.create({
        data: {
          repairId: existing.id,
          fromStatus: existing.status,
          toStatus: PrismaRepairStatus.PICKED_UP,
          ...(cmd.note != null ? { note: cmd.note } : {}),
          staffId,
        },
      });

      stampedParts = locked.parts.map((part) => {
        const figures = partFigures.get(part.id)!;
        return {
          productId: part.productId,
          productName: part.productNameSnapshot,
          quantity: part.quantity,
          unitPrice: part.unitPrice.toNumber(),
          costOfGoods: figures.costOfGoods,
          profit: figures.profit,
          lineTotal: part.lineTotal.toNumber(),
        };
      });
    });

    this.inventory.flushEvents(capturedTx!);

    eventBus.emit('invoice.issued', { invoiceNumber, sourceType: InvoiceSource.REPAIR, sourceReference: existing.reference });
    eventBus.emit('repair.statusChanged', { repairId: existing.id, fromStatus: existing.status as RepairStatus, toStatus: RepairStatus.PICKED_UP });
    // Built from the figures computed INSIDE this transaction, not the pre-load `existing`
    // snapshot — consumption now happens here, not at a prior COMPLETED call, so `existing`'s
    // own totalCost/totalProfit/part costOfGoods are stale (null) at this point.
    eventBus.emit('repair.pickedUp', {
      repairId: existing.id,
      ...(existing.posClientId != null ? { posClientId: existing.posClientId } : {}),
      invoiceNumber,
      totalAmount,
      paidAmount: paidBefore + paymentAmount,
      totalCost,
      totalProfit: totalAmount - totalCost,
      snapshotParts: stampedParts,
      labourPrice,
    });
    if (capturedPayment != null && existing.posClientId != null) {
      eventBus.emit('payment.clientRecorded', {
        paymentId: capturedPayment.paymentId,
        posClientId: existing.posClientId,
        invoiceNumber,
        amount: paymentAmount,
        previousCredit: capturedPayment.previousCredit,
        newCredit: capturedPayment.newCredit,
      });
    }

    return this.getRepairDto(existing.id, { includeMargins: isAdmin });
  }

  // D6/D8 (S13), reworked by S30. Nothing was ever consumed before PICKED_UP (D8), so every
  // reserved part is simply RELEASED — written as REPAIR_CANCELLED rows so the ledger says why
  // (quantityReserved down, on-hand untouched: the parts never left the shelf; never addLayer/
  // returnIn here). Money already collected is reversed payment by payment (S30/Q1): one
  // NEGATIVE ledger row per original payment, linked through reversalOfId, newest first, the
  // last one only partly when the prompt lowered the amount. A walk-in repair has no PosClient
  // and therefore no ledger: only its own paidAmount/refundedAmount move. Labour is store
  // revenue, not a technician payout, so nothing is owed back — a cancelled repair simply never
  // reaches revenue (statistics reads PICKED_UP only). No invoice exists yet, so none is touched.
  private async cancelRepair(existing: RepairWithIncludes, cmd: RepairStatusCommand, actor: JWTPayload): Promise<RepairDto> {
    const staffId = await this.movementStaffId(actor);
    const isAdmin = actor.type === UserType.ADMIN;

    let capturedTx: Prisma.TransactionClient | undefined;
    let refundApplied = 0;
    let reversals: CapturedReversal[] = [];

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      const locked = await this.lockRepair(tx, existing.id);
      if (!isRepairTransitionAllowed(locked.status as RepairStatus, RepairStatus.CANCELLED)) {
        throw new ConflictError(REPAIR_ERROR.STATUS_CHANGED);
      }
      const alreadyPaid = locked.paidAmount.toNumber();
      refundApplied = Math.min(cmd.refundAmount ?? alreadyPaid, alreadyPaid);
      const ref = { referenceType: 'REPAIR', referenceId: existing.id, staffId };

      for (const part of locked.parts) {
        await this.inventory.release(tx, part.productId, part.quantity, ref, MovementType.REPAIR_CANCELLED);
      }

      if (refundApplied > 0 && locked.posClientId != null) {
        reversals = await this.reversePaymentsInTx(tx, locked, refundApplied, staffId);
      }

      await tx.repairStatusHistory.create({
        data: {
          repairId: existing.id,
          fromStatus: locked.status,
          toStatus: PrismaRepairStatus.CANCELLED,
          ...(cmd.note != null ? { note: cmd.note } : {}),
          staffId,
        },
      });

      await tx.repair.update({
        where: { id: existing.id },
        data: {
          status: PrismaRepairStatus.CANCELLED,
          cancelledAt: new Date(),
          paidAmount: alreadyPaid - refundApplied,
          refundedAmount: { increment: refundApplied },
        },
      });
    });

    this.inventory.flushEvents(capturedTx!);

    eventBus.emit('repair.statusChanged', { repairId: existing.id, fromStatus: existing.status as RepairStatus, toStatus: RepairStatus.CANCELLED });
    eventBus.emit('repair.cancelled', {
      repairId: existing.id,
      ...(cmd.note != null ? { reason: cmd.note } : {}),
      ...(refundApplied > 0 ? { refundAmount: refundApplied } : {}),
    });
    this.emitReversals(existing.posClientId, reversals);

    return this.getRepairDto(existing.id, { includeMargins: isAdmin });
  }

  // S30 — PICKED_UP → RETURNED (terminal, read-only). Mirrors orders' returnOrder with three
  // deliberate differences: restock is per part (cmd.restockPartIds), the refund is always every
  // payment in full (Q4, no amount field), and the invoice is CANCELLED (status only — numbers are
  // never reused, gaps never closed). Restocked parts re-enter at their consumed cost
  // (REPAIR_RETURN, referenceType REPAIR — P5); non-restocked parts write no movement. For a POS
  // client the document charge is reversed through the credit port and every payment through
  // the ledger, so credit/totalPaid/totalSold land exactly where they were before the repair —
  // all in this one transaction on locked rows (hard rule 6). totalCost/totalProfit are left as
  // the pickup snapshot: statistics drops a RETURNED repair by status (Q2).
  async returnRepair(id: string, cmd: ReturnRepairCommand, actor: JWTPayload): Promise<RepairDto> {
    const existing = await this.prisma.repair.findUnique({ where: { id }, select: { status: true, posClientId: true } });
    if (!existing) throw new NotFoundError('Repair');
    if (existing.status !== PrismaRepairStatus.PICKED_UP) throw new ConflictError(REPAIR_ERROR.RETURN_REQUIRES_PICKED_UP);

    const staffId = await this.movementStaffId(actor);
    const isAdmin = actor.type === UserType.ADMIN;

    let capturedTx: Prisma.TransactionClient | undefined;
    let invoiceNumber = '';
    let refundTotal = 0;
    let reversals: CapturedReversal[] = [];
    const restockSet = new Set(cmd.restockPartIds);

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      const locked = await this.lockRepair(tx, id);
      if (
        locked.status !== PrismaRepairStatus.PICKED_UP ||
        !isRepairTransitionAllowed(RepairStatus.PICKED_UP, RepairStatus.RETURNED)
      ) {
        throw new ConflictError(REPAIR_ERROR.RETURN_REQUIRES_PICKED_UP);
      }

      const partIds = new Set(locked.parts.map((part) => part.id));
      for (const partId of restockSet) {
        if (!partIds.has(partId)) throw new BadRequestError(REPAIR_ERROR.UNKNOWN_PART, { partId });
      }

      const ref = { referenceType: 'REPAIR', referenceId: locked.id, staffId, ...(cmd.note != null ? { reason: cmd.note } : {}) };
      for (const part of locked.parts) {
        const restock = restockSet.has(part.id);
        if (restock) {
          const consumptions = await this.partConsumptions(tx, locked.id, part);
          await this.inventory.returnIn(tx, consumptions, part.quantity, ref, MovementType.REPAIR_RETURN);
        }
        await tx.repairPart.update({ where: { id: part.id }, data: { restockedOnReturn: restock } });
      }

      const paid = locked.paidAmount.toNumber();
      const totalAmount = locked.totalAmount.toNumber();
      if (locked.posClientId != null) {
        // Reversals first (they carry the invoiceId, so the invoice's paidAmount walks back down
        // from the ledger), then the document charge itself, then the invoice is cancelled.
        reversals = await this.reversePaymentsInTx(tx, locked, paid, staffId);
        refundTotal = reversals.reduce((sum, reversal) => sum - reversal.amount, 0);
        await this.clientCredit.applyDocumentCharge(tx, locked.posClientId, {
          totalSoldDelta: -totalAmount,
          creditDelta: -totalAmount,
        });
      } else {
        // P7 — a walk-in has no ledger; the cash is handed back and recorded on the repair only.
        refundTotal = paid;
      }

      ({ number: invoiceNumber } = await this.billing.cancelInvoiceInTx(tx, { invoiceId: locked.invoiceId! }));

      await tx.repair.update({
        where: { id },
        data: {
          status: PrismaRepairStatus.RETURNED,
          returnedAt: new Date(),
          paidAmount: paid - refundTotal,
          refundedAmount: { increment: refundTotal },
        },
      });

      await tx.repairStatusHistory.create({
        data: {
          repairId: id,
          fromStatus: PrismaRepairStatus.PICKED_UP,
          toStatus: PrismaRepairStatus.RETURNED,
          ...(cmd.note != null ? { note: cmd.note } : {}),
          staffId,
        },
      });
    });

    this.inventory.flushEvents(capturedTx!);

    eventBus.emit('repair.statusChanged', { repairId: id, fromStatus: RepairStatus.PICKED_UP, toStatus: RepairStatus.RETURNED });
    eventBus.emit('repair.returned', {
      repairId: id,
      invoiceNumber,
      refundAmount: refundTotal,
      restockedPartCount: restockSet.size,
      ...(cmd.note != null ? { reason: cmd.note } : {}),
    });
    eventBus.emit('invoice.cancelled', { invoiceNumber, ...(cmd.note != null ? { reason: cmd.note } : {}) });
    this.emitReversals(existing.posClientId, reversals, invoiceNumber);

    return this.getRepairDto(id, { includeMargins: isAdmin });
  }

  // D5 — a payment taken at any pre-pickup step. For a known POS client this is an on-account
  // ClientPayment row (null invoiceId — no invoice exists yet — with repairId set so it can be
  // re-linked at pickup, R3); credit falls by the amount, so a prepaying client's credit goes
  // negative and is brought back to zero by the applyDocumentCharge at PICKED_UP. For a walk-in
  // there is no PosClient and therefore no ledger row: only the repair's own paidAmount moves.
  async recordPayment(id: string, cmd: RecordRepairPaymentCommand, actor: JWTPayload): Promise<RepairDto> {
    const existing = await this.prisma.repair.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Repair');
    this.assertEditable(existing.status);

    const staffId = await this.movementStaffId(actor);
    let capturedPayment: { paymentId: string; previousCredit: number; newCredit: number } | undefined;

    await this.prisma.$transaction(async (tx) => {
      // S30 (F6) — re-checked on the locked row: no payment lands on a repair another tab has
      // just picked up or cancelled.
      const locked = await this.lockRepair(tx, id);
      this.assertEditable(locked.status);
      if (existing.posClientId != null) {
        capturedPayment = await this.billing.captureClientPaymentInTx(tx, {
          posClientId: existing.posClientId,
          repairId: id,
          amount: cmd.amount,
          staffId,
        });
      }
      await tx.repair.update({ where: { id }, data: { paidAmount: { increment: cmd.amount } } });
    });

    if (capturedPayment != null && existing.posClientId != null) {
      eventBus.emit('payment.clientRecorded', {
        paymentId: capturedPayment.paymentId,
        posClientId: existing.posClientId,
        amount: cmd.amount,
        previousCredit: capturedPayment.previousCredit,
        newCredit: capturedPayment.newCredit,
      });
    }

    return this.getRepairDto(id, { includeMargins: actor.type === UserType.ADMIN });
  }

  // R1 — one row per technician. Counts come from a groupBy(technicianId, status); revenue is
  // Σ totalAmount over PICKED_UP repairs only, the single status at which repair revenue is
  // recognised (D8) — so CANCELLED and (S30) RETURNED repairs drop out of it by construction.
  // Technicians with no repairs still appear, with zeros.
  async listTechnicianStats(): Promise<TechnicianRepairStatsDto[]> {
    const [technicians, statusGroups, revenueGroups] = await Promise.all([
      this.prisma.technician.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.repair.groupBy({ by: ['technicianId', 'status'], where: { technicianId: { not: null } }, _count: { _all: true } }),
      this.prisma.repair.groupBy({
        by: ['technicianId'],
        where: { technicianId: { not: null }, status: PrismaRepairStatus.PICKED_UP },
        _sum: { totalAmount: true },
      }),
    ]);

    const revenueById = new Map(revenueGroups.map((g) => [g.technicianId as string, g._sum.totalAmount?.toNumber() ?? 0]));
    const countsById = new Map<string, Record<string, number>>();
    for (const group of statusGroups) {
      const technicianId = group.technicianId as string;
      const counts = countsById.get(technicianId) ?? {};
      counts[group.status] = group._count._all;
      countsById.set(technicianId, counts);
    }

    return technicians.map((technician) => {
      const counts = countsById.get(technician.id) ?? {};
      return RepairsMapper.toTechnicianStatsDto({
        technicianId: technician.id,
        technicianName: technician.name,
        isEnabled: technician.isEnabled,
        intakeCount: counts[PrismaRepairStatus.INTAKE] ?? 0,
        processingCount: counts[PrismaRepairStatus.PROCESSING] ?? 0,
        completedCount: counts[PrismaRepairStatus.COMPLETED] ?? 0,
        pickedUpCount: counts[PrismaRepairStatus.PICKED_UP] ?? 0,
        cancelledCount: counts[PrismaRepairStatus.CANCELLED] ?? 0,
        returnedCount: counts[PrismaRepairStatus.RETURNED] ?? 0,
        revenue: revenueById.get(technician.id) ?? 0,
      });
    });
  }

  // S30 (F6) — the repair row is the serialization point for its own parts, payments and status:
  // the same SELECT … FOR UPDATE idiom as inventory's lockProduct / clients' lockPosClient. Every
  // mutation re-reads the repair through this INSIDE its transaction and decides from that read,
  // never from a pre-transaction one — otherwise a part added in one tab while another tab picks
  // the repair up is reserved and never released.
  private async lockRepair(tx: Prisma.TransactionClient, id: string): Promise<RepairWithIncludes> {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Repair" WHERE id = ${id} FOR UPDATE`;
    if (!rows[0]) throw new NotFoundError('Repair');
    return tx.repair.findUniqueOrThrow({ where: { id }, include: REPAIR_INCLUDE });
  }

  // S30/Q1 — reverses up to `amount` of this repair's ledger money, newest payment first, one
  // NEGATIVE row per original payment linked through reversalOfId. Portions already reversed are
  // skipped. A reversal row carries the original's invoiceId (so a return's reversals land on the
  // invoice and walk its paidAmount back down) and always the repairId (so the ticket lists it).
  // Only for a known POS client — a walk-in has no ledger (P7).
  private async reversePaymentsInTx(
    tx: Prisma.TransactionClient,
    repair: RepairWithIncludes,
    amount: number,
    staffId: string,
  ): Promise<CapturedReversal[]> {
    const reversedById = new Map<string, number>();
    for (const payment of repair.payments) {
      if (payment.reversalOfId != null) {
        reversedById.set(payment.reversalOfId, (reversedById.get(payment.reversalOfId) ?? 0) - payment.amount.toNumber());
      }
    }
    const originals = repair.payments
      .filter((payment) => payment.reversalOfId == null && payment.amount.toNumber() > 0)
      .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime() || b.reference.localeCompare(a.reference));

    const captured: CapturedReversal[] = [];
    let remaining = amount;
    for (const original of originals) {
      if (remaining <= 0) break;
      const open = original.amount.toNumber() - (reversedById.get(original.id) ?? 0);
      if (open <= 0) continue;
      const take = Math.min(remaining, open);
      const result = await this.billing.captureClientPaymentInTx(tx, {
        posClientId: repair.posClientId!,
        ...(original.invoiceId != null ? { invoiceId: original.invoiceId } : {}),
        repairId: repair.id,
        reversalOfId: original.id,
        amount: -take,
        staffId,
      });
      captured.push({ paymentId: result.paymentId, previousCredit: result.previousCredit, newCredit: result.newCredit, amount: -take });
      remaining -= take;
    }
    return captured;
  }

  // One `payment.clientRecorded` per reversal row, emitted after the caller's commit.
  private emitReversals(posClientId: string | null, reversals: CapturedReversal[], invoiceNumber?: string): void {
    if (posClientId == null) return;
    for (const reversal of reversals) {
      eventBus.emit('payment.clientRecorded', {
        paymentId: reversal.paymentId,
        posClientId,
        ...(invoiceNumber != null ? { invoiceNumber } : {}),
        amount: reversal.amount,
        previousCredit: reversal.previousCredit,
        newCredit: reversal.newCredit,
      });
    }
  }

  // S30 (P6) — the FIFO layers this part drained at PICKED_UP, so REPAIR_RETURN re-enters at the
  // consumed cost, never the current average (mirrors orders' buildOriginalConsumptions). A part
  // picked up since S30 links its OUT row directly; one picked up before has no link and is
  // matched by product, which is unambiguous unless the same product was fitted twice.
  private async partConsumptions(tx: Prisma.TransactionClient, repairId: string, part: RepairPart): Promise<ConsumptionLine[]> {
    let outMovementId = part.consumptionMovementId;
    if (outMovementId == null) {
      const candidates = await tx.stockMovement.findMany({
        where: { referenceType: 'REPAIR', referenceId: repairId, productId: part.productId, type: PrismaMovementType.REPAIR_CONSUMPTION },
        select: { id: true },
      });
      if (candidates.length !== 1) throw new ConflictError(REPAIR_ERROR.CONSUMPTION_NOT_FOUND, { partId: part.id });
      outMovementId = candidates[0]!.id;
    }
    const rows = await tx.stockMovementConsumption.findMany({ where: { outMovementId }, orderBy: { id: 'asc' } });
    return rows.map((row) => ({ inMovementId: row.inMovementId, qty: row.quantityConsumed, unitCost: row.unitCost.toNumber() }));
  }

  private async getRepairDto(id: string, ctx: { includeMargins: boolean }): Promise<RepairDto> {
    const repair = await this.prisma.repair.findUniqueOrThrow({ where: { id }, include: REPAIR_INCLUDE });
    return RepairsMapper.toRepairDto(repair, ctx);
  }

  private async recomputePartsTotal(tx: Prisma.TransactionClient, repairId: string): Promise<number> {
    const parts = await tx.repairPart.findMany({ where: { repairId }, select: { lineTotal: true } });
    return parts.reduce((sum, part) => sum + part.lineTotal.toNumber(), 0);
  }

  // D8 — once picked up, cancelled or (S30) returned a repair is frozen: no product edits, no
  // labour edits, no payments. A picked-up repair's invoice is immutable; reversing it is the
  // return document (returnRepair), not an edit.
  private assertEditable(status: PrismaRepairStatus): void {
    if (isRepairReadOnly(status as RepairStatus)) {
      throw new ConflictError(REPAIR_ERROR.READ_ONLY);
    }
  }

  // A STAFF actor's own staffId; an ADMIN (no Staff row) falls back to the shared system
  // placeholder (@common/utils/system-staff.utils) — same gap orders' Sprint 2 discovered,
  // extracted there into a shared resolver rather than duplicated here.
  private async movementStaffId(actor: JWTPayload): Promise<string> {
    return actor.staffId ?? this.systemStaff.resolve();
  }
}
