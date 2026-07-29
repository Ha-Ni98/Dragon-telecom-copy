import type { Prisma, PrismaClient } from '@prisma/client';
import { RepairStatus as PrismaRepairStatus } from '@prisma/client';
import {
  DocType,
  InvoiceSource,
  MovementType,
  RepairResponseSchema,
  RepairStatus,
  UserType,
  isRepairStatusTerminal,
  isRepairTransitionAllowed,
  paginated,
  type AddRepairPartCommand,
  type CreateRepairCommand,
  type JWTPayload,
  type PaginatedResult,
  type RecordRepairPaymentCommand,
  type RepairDto,
  type RepairListQuery,
  type RepairStatusCommand,
  type TechnicianRepairStatsDto,
  type UpdateRepairCommand,
} from '@dragon-telecom/contract';
import { BadRequestError, ConflictError, NotFoundError } from '@common/errors';
import { eventBus } from '@common/events/event-bus';
import { SystemStaffResolver } from '@common/utils/system-staff.utils';
import type { IInventoryService } from '../inventory/inventory.interface';
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
      ...(query.from != null || query.to != null
        ? {
            intakeAt: {
              ...(query.from != null ? { gte: new Date(query.from) } : {}),
              ...(query.to != null ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
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

  async updateRepair(id: string, cmd: UpdateRepairCommand, actor: JWTPayload): Promise<RepairDto> {
    const existing = await this.prisma.repair.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Repair');
    this.assertEditable(existing.status);

    const labourPrice = cmd.labourPrice ?? existing.labourPrice.toNumber();

    await this.prisma.repair.update({
      where: { id },
      data: {
        ...(cmd.diagnosis != null ? { diagnosis: cmd.diagnosis } : {}),
        ...(cmd.labourPrice != null ? { labourPrice: cmd.labourPrice } : {}),
        ...(cmd.technicianId != null ? { technicianId: cmd.technicianId } : {}),
        ...(cmd.labourPrice != null ? { totalAmount: labourPrice + existing.partsTotal.toNumber() } : {}),
      },
    });

    return this.getRepairDto(id, { includeMargins: actor.type === UserType.ADMIN });
  }

  // reserve(PENDING_REPAIR) — shortfall throws ConflictError naming the productId (the
  // injected engine's own error, plan §II.3), rolling back the whole transaction.
  async addPart(id: string, cmd: AddRepairPartCommand, actor: JWTPayload): Promise<RepairDto> {
    const existing = await this.prisma.repair.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Repair');
    this.assertEditable(existing.status);

    const product = await this.prisma.product.findUnique({ where: { id: cmd.productId }, select: { name: true } });
    if (!product) throw new BadRequestError(`Unknown productId: ${cmd.productId}`);

    const staffId = await this.movementStaffId(actor);
    let capturedTx: Prisma.TransactionClient | undefined;

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      await this.inventory.reserve(tx, cmd.productId, cmd.quantity, { referenceType: 'REPAIR', referenceId: id, staffId });
      await tx.repairPart.create({
        data: { repairId: id, ...RepairsMapper.toPartCreateInput(cmd, { productName: product.name }) },
      });

      const partsTotal = await this.recomputePartsTotal(tx, id);
      await tx.repair.update({ where: { id }, data: { partsTotal, totalAmount: existing.labourPrice.toNumber() + partsTotal } });
    });

    this.inventory.flushEvents(capturedTx!);
    return this.getRepairDto(id, { includeMargins: actor.type === UserType.ADMIN });
  }

  async removePart(id: string, partId: string, actor: JWTPayload): Promise<RepairDto> {
    const existing = await this.prisma.repair.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Repair');
    this.assertEditable(existing.status);
    const part = await this.prisma.repairPart.findUnique({ where: { id: partId } });
    if (!part || part.repairId !== id) throw new NotFoundError('RepairPart');

    const staffId = await this.movementStaffId(actor);
    let capturedTx: Prisma.TransactionClient | undefined;

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      await this.inventory.release(tx, part.productId, part.quantity, { referenceType: 'REPAIR', referenceId: id, staffId });
      await tx.repairPart.delete({ where: { id: partId } });

      const partsTotal = await this.recomputePartsTotal(tx, id);
      await tx.repair.update({ where: { id }, data: { partsTotal, totalAmount: existing.labourPrice.toNumber() + partsTotal } });
    });

    this.inventory.flushEvents(capturedTx!);
    return this.getRepairDto(id, { includeMargins: actor.type === UserType.ADMIN });
  }

  // The transition machine (contract's REPAIR_STATUS_TRANSITIONS, S13): forward-only one step
  // at a time, INTAKE→PROCESSING→COMPLETED→PICKED_UP, or CANCELLED from any non-terminal state.
  // Idempotent re-COMPLETE is the only short-circuit (no duplicate history/emit). PICKED_UP is
  // delegated to pickUpRepair (D5/D8/D9 — the money moment); CANCELLED to cancelRepair (D6/D8).
  async changeStatus(id: string, cmd: RepairStatusCommand, actor: JWTPayload): Promise<RepairDto> {
    const existing = await this.prisma.repair.findUnique({ where: { id }, include: REPAIR_INCLUDE });
    if (!existing) throw new NotFoundError('Repair');
    const isAdmin = actor.type === UserType.ADMIN;

    if (cmd.toStatus === RepairStatus.COMPLETED && existing.status === PrismaRepairStatus.COMPLETED) {
      return RepairsMapper.toRepairDto(existing, { includeMargins: isAdmin });
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
  private async pickUpRepair(
    existing: Prisma.RepairGetPayload<{ include: typeof REPAIR_INCLUDE }>,
    cmd: RepairStatusCommand,
    actor: JWTPayload,
  ): Promise<RepairDto> {
    const staffId = await this.movementStaffId(actor);
    const isAdmin = actor.type === UserType.ADMIN;

    const paidBefore = existing.paidAmount.toNumber();
    const paymentAmount = cmd.paymentAmount ?? 0;
    const totalAmount = existing.totalAmount.toNumber();
    const labourPrice = existing.labourPrice.toNumber();

    // A walk-in has no PosClient to hold a debt against — the repair must leave fully paid.
    // Checked before the transaction opens (fail fast, no wasted FIFO work), the same discipline
    // orders' own R2 guard uses (orders.service.ts:369-374).
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
      const ref = { referenceType: 'REPAIR', referenceId: existing.id, staffId };

      // D8 — release + consume every part now (this is the first and only consumption moment).
      const partFigures = new Map<string, { costOfGoods: number; profit: number }>();
      for (const part of existing.parts) {
        const revenue = part.unitPrice.toNumber() * part.quantity;
        await this.inventory.release(tx, part.productId, part.quantity, ref);
        const result = await this.inventory.consumeFifo(tx, part.productId, part.quantity, revenue, MovementType.REPAIR_CONSUMPTION, ref);
        totalCost += result.costOfGoods;
        partFigures.set(part.id, { costOfGoods: result.costOfGoods, profit: result.profit ?? 0 });
        await tx.repairPart.update({ where: { id: part.id }, data: { costOfGoods: result.costOfGoods, profit: result.profit } });
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
          ...existing.parts.map((part) => {
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

      stampedParts = existing.parts.map((part) => {
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

  // D6/D8 (S13) — nothing was ever consumed before PICKED_UP (D8), so every reserved part is
  // simply released; the old consumedPartReturns/restock path (for parts consumed at the former
  // COMPLETED) no longer applies to anything. Money already collected is returned as a
  // NEGATIVE-amount ledger row, never by editing totalPaid directly (D6). A walk-in repair has
  // no PosClient and therefore no ledger row: only its own paidAmount moves.
  private async cancelRepair(
    existing: Prisma.RepairGetPayload<{ include: typeof REPAIR_INCLUDE }>,
    cmd: RepairStatusCommand,
    actor: JWTPayload,
  ): Promise<RepairDto> {
    const staffId = await this.movementStaffId(actor);
    const isAdmin = actor.type === UserType.ADMIN;
    const alreadyPaid = existing.paidAmount.toNumber();
    const refundApplied = Math.min(cmd.refundAmount ?? alreadyPaid, alreadyPaid);

    let capturedTx: Prisma.TransactionClient | undefined;

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      const ref = { referenceType: 'REPAIR', referenceId: existing.id, staffId };

      for (const part of existing.parts) {
        await this.inventory.release(tx, part.productId, part.quantity, ref);
      }

      if (refundApplied > 0 && existing.posClientId != null) {
        await this.billing.captureClientPaymentInTx(tx, {
          posClientId: existing.posClientId,
          repairId: existing.id,
          amount: -refundApplied,
          staffId,
        });
      }

      await tx.repairStatusHistory.create({
        data: {
          repairId: existing.id,
          fromStatus: existing.status,
          toStatus: PrismaRepairStatus.CANCELLED,
          ...(cmd.note != null ? { note: cmd.note } : {}),
          staffId,
        },
      });

      await tx.repair.update({
        where: { id: existing.id },
        data: { status: PrismaRepairStatus.CANCELLED, paidAmount: alreadyPaid - refundApplied },
      });
    });

    this.inventory.flushEvents(capturedTx!);

    eventBus.emit('repair.statusChanged', { repairId: existing.id, fromStatus: existing.status as RepairStatus, toStatus: RepairStatus.CANCELLED });
    eventBus.emit('repair.cancelled', {
      repairId: existing.id,
      ...(cmd.note != null ? { reason: cmd.note } : {}),
      ...(refundApplied > 0 ? { refundAmount: refundApplied } : {}),
    });

    return this.getRepairDto(existing.id, { includeMargins: isAdmin });
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
  // recognised (D8). Technicians with no repairs still appear, with zeros.
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
        revenue: revenueById.get(technician.id) ?? 0,
      });
    });
  }

  private async getRepairDto(id: string, ctx: { includeMargins: boolean }): Promise<RepairDto> {
    const repair = await this.prisma.repair.findUniqueOrThrow({ where: { id }, include: REPAIR_INCLUDE });
    return RepairsMapper.toRepairDto(repair, ctx);
  }

  private async recomputePartsTotal(tx: Prisma.TransactionClient, repairId: string): Promise<number> {
    const parts = await tx.repairPart.findMany({ where: { repairId }, select: { lineTotal: true } });
    return parts.reduce((sum, part) => sum + part.lineTotal.toNumber(), 0);
  }

  // D8 — once picked up or cancelled a repair is frozen: no product edits, no labour edits. A
  // picked-up repair's invoice is immutable; reversing it needs a return document, not an edit.
  private assertEditable(status: PrismaRepairStatus): void {
    if (isRepairStatusTerminal(status as RepairStatus)) {
      throw new ConflictError('REPAIR_READ_ONLY');
    }
  }

  // A STAFF actor's own staffId; an ADMIN (no Staff row) falls back to the shared system
  // placeholder (@common/utils/system-staff.utils) — same gap orders' Sprint 2 discovered,
  // extracted there into a shared resolver rather than duplicated here.
  private async movementStaffId(actor: JWTPayload): Promise<string> {
    return actor.staffId ?? this.systemStaff.resolve();
  }
}
