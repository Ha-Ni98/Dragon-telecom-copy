import type { Prisma, PrismaClient } from '@prisma/client';
import { MovementDirection as PrismaMovementDirection, RepairStatus as PrismaRepairStatus } from '@prisma/client';
import {
  DocType,
  MovementType,
  RepairStatus,
  UserType,
  type AddRepairPartCommand,
  type CreateRepairCommand,
  type JWTPayload,
  type RepairDto,
  type RepairListQuery,
  type RepairStatusCommand,
  type UpdateRepairCommand,
} from '@dragon-telecom/contract';
import { BadRequestError, ConflictError, NotFoundError } from '@common/errors';
import { eventBus } from '@common/events/event-bus';
import { SystemStaffResolver } from '@common/utils/system-staff.utils';
import type { ConsumptionLine, IInventoryService } from '../inventory/inventory.interface';
import type { ISequenceService } from '../platform/platform.interface';
import type { IRepairsService } from './repairs.interface';
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
} satisfies Prisma.RepairInclude;

// Forward-only up to PICKED_UP (spec BL#3) — CANCELLED is reachable from any non-terminal
// state and is validated separately (not part of this sequence).
const STATUS_SEQUENCE: RepairStatus[] = [
  RepairStatus.INTAKE,
  RepairStatus.PROCESSING,
  RepairStatus.COMPLETED,
  RepairStatus.PICKED_UP,
];

export class RepairsService implements IRepairsService {
  private readonly systemStaff: SystemStaffResolver;

  constructor(
    private prisma: PrismaClient,
    private inventory: IInventoryService,
    private sequence: ISequenceService,
  ) {
    this.systemStaff = new SystemStaffResolver(prisma);
  }

  // staff(STAFF_REPAIRS): created-by-me, derived from the intake history marker (§C-1);
  // admin: all. No pagination — RepairListQuerySchema carries none (board data).
  async listRepairs(query: RepairListQuery, actor: JWTPayload): Promise<RepairDto[]> {
    const isAdmin = actor.type === UserType.ADMIN;
    const where: Prisma.RepairWhereInput = {
      ...(query.status != null ? { status: query.status } : {}),
      ...(query.technicianId != null ? { technicianId: query.technicianId } : {}),
      ...(!isAdmin
        ? {
            history: {
              some: { fromStatus: PrismaRepairStatus.INTAKE, toStatus: PrismaRepairStatus.INTAKE, staffId: actor.staffId! },
            },
          }
        : {}),
    };

    const repairs = await this.prisma.repair.findMany({ where, include: REPAIR_INCLUDE, orderBy: { intakeAt: 'desc' } });
    return repairs.map((repair) => RepairsMapper.toRepairDto(repair, { includeMargins: isAdmin }));
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
  // "created-by-me" scoping and is what sales' own listener later reads for repair.pickedUp's
  // missing staffId. Attaching a POS client prefills name/phone (BL#1) — resolved here (a pure
  // read), never in the mapper.
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

  // The transition machine (plan §II.3): forward-only one step at a time through
  // STATUS_SEQUENCE, or CANCELLED from any non-terminal state. Idempotent re-COMPLETE is the
  // only short-circuit (no re-consumption, no duplicate history/emit).
  async changeStatus(id: string, cmd: RepairStatusCommand, actor: JWTPayload): Promise<RepairDto> {
    const existing = await this.prisma.repair.findUnique({ where: { id }, include: REPAIR_INCLUDE });
    if (!existing) throw new NotFoundError('Repair');
    const isAdmin = actor.type === UserType.ADMIN;

    if (cmd.toStatus === RepairStatus.COMPLETED && existing.status === PrismaRepairStatus.COMPLETED) {
      return RepairsMapper.toRepairDto(existing, { includeMargins: isAdmin });
    }

    if (cmd.toStatus === RepairStatus.CANCELLED) {
      if (existing.status === PrismaRepairStatus.CANCELLED || existing.status === PrismaRepairStatus.PICKED_UP) {
        throw new ConflictError('Repair cannot be cancelled from its current status');
      }
    } else {
      const fromIndex = STATUS_SEQUENCE.indexOf(existing.status as RepairStatus);
      const toIndex = STATUS_SEQUENCE.indexOf(cmd.toStatus);
      if (fromIndex === -1 || toIndex !== fromIndex + 1) {
        throw new BadRequestError('Repair status can only move forward one step at a time');
      }
      // technicianId is assigned earlier via updateRepair, not carried on this command.
      if (cmd.toStatus === RepairStatus.PROCESSING && existing.technicianId == null) {
        throw new BadRequestError('technicianId is required before moving to PROCESSING');
      }
    }

    const staffId = await this.movementStaffId(actor);
    const fromStatus = existing.status as RepairStatus;
    let capturedTx: Prisma.TransactionClient | undefined;
    let totalCost = 0;
    let totalProfit = 0;

    await this.prisma.$transaction(async (tx) => {
      capturedTx = tx;
      const ref = { referenceType: 'REPAIR', referenceId: id, staffId };

      if (cmd.toStatus === RepairStatus.COMPLETED) {
        for (const part of existing.parts) {
          const revenue = part.unitPrice.toNumber() * part.quantity;
          await this.inventory.release(tx, part.productId, part.quantity, ref);
          const result = await this.inventory.consumeFifo(tx, part.productId, part.quantity, revenue, MovementType.REPAIR_CONSUMPTION, ref);
          totalCost += result.costOfGoods;
          totalProfit += result.profit ?? 0;
          await tx.repairPart.update({ where: { id: part.id }, data: { costOfGoods: result.costOfGoods, profit: result.profit } });
        }
      }

      if (cmd.toStatus === RepairStatus.CANCELLED) {
        // Pending (not-yet-consumed) parts release automatically; already-consumed parts
        // return only through the caller's explicit consumedPartReturns.
        for (const part of existing.parts) {
          if (part.costOfGoods == null) {
            await this.inventory.release(tx, part.productId, part.quantity, ref);
          }
        }
        for (const returnReq of cmd.consumedPartReturns ?? []) {
          if (!returnReq.restock) continue;
          const part = existing.parts.find((p) => p.id === returnReq.partId);
          if (!part) throw new BadRequestError(`Unknown partId: ${returnReq.partId}`);
          const originalConsumptions = await this.buildOriginalConsumptions(tx, id, part.productId, part.quantity);
          await this.inventory.returnIn(tx, originalConsumptions, part.quantity, { referenceType: 'RETURN', referenceId: id, staffId });
        }
      }

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
          ...(cmd.toStatus === RepairStatus.COMPLETED ? { completedAt: new Date(), totalCost, totalProfit } : {}),
          ...(cmd.toStatus === RepairStatus.PICKED_UP
            ? { pickedUpAt: new Date(), ...(cmd.paidAmount != null ? { paidAmount: cmd.paidAmount } : {}) }
            : {}),
        },
      });
    });

    this.inventory.flushEvents(capturedTx!);

    eventBus.emit('repair.statusChanged', { repairId: id, fromStatus, toStatus: cmd.toStatus });

    if (cmd.toStatus === RepairStatus.CANCELLED) {
      eventBus.emit('repair.cancelled', { repairId: id, ...(cmd.note != null ? { reason: cmd.note } : {}) });
    }

    if (cmd.toStatus === RepairStatus.PICKED_UP) {
      // existing was loaded before this transaction, but COMPLETED (a prior, separate call)
      // already stamped every part's costOfGoods/profit and the repair's totalCost/totalProfit
      // — this transition never touches those, so the pre-load snapshot is still current.
      const paidAmount = cmd.paidAmount ?? existing.paidAmount.toNumber();
      eventBus.emit('repair.pickedUp', {
        repairId: id,
        ...(existing.posClientId != null ? { posClientId: existing.posClientId } : {}),
        totalAmount: existing.totalAmount.toNumber(),
        paidAmount,
        totalCost: existing.totalCost?.toNumber() ?? 0,
        totalProfit: existing.totalProfit?.toNumber() ?? 0,
        snapshotParts: existing.parts.map((part) => ({
          productId: part.productId,
          productName: part.productNameSnapshot,
          quantity: part.quantity,
          unitPrice: part.unitPrice.toNumber(),
          costOfGoods: part.costOfGoods?.toNumber() ?? 0,
          profit: part.profit?.toNumber() ?? 0,
          lineTotal: part.lineTotal.toNumber(),
        })),
        labourPrice: existing.labourPrice.toNumber(),
      });
    }

    return this.getRepairDto(id, { includeMargins: isAdmin });
  }

  private async getRepairDto(id: string, ctx: { includeMargins: boolean }): Promise<RepairDto> {
    const repair = await this.prisma.repair.findUniqueOrThrow({ where: { id }, include: REPAIR_INCLUDE });
    return RepairsMapper.toRepairDto(repair, ctx);
  }

  private async recomputePartsTotal(tx: Prisma.TransactionClient, repairId: string): Promise<number> {
    const parts = await tx.repairPart.findMany({ where: { repairId }, select: { lineTotal: true } });
    return parts.reduce((sum, part) => sum + part.lineTotal.toNumber(), 0);
  }

  // A STAFF actor's own staffId; an ADMIN (no Staff row) falls back to the shared system
  // placeholder (@common/utils/system-staff.utils) — same gap orders' Sprint 2 discovered,
  // extracted there into a shared resolver rather than duplicated here.
  private async movementStaffId(actor: JWTPayload): Promise<string> {
    return actor.staffId ?? this.systemStaff.resolve();
  }

  // Reconstructs the exact FIFO layers a part's consumption originally drained — mirrors
  // sales'/orders' own buildOriginalConsumptions (plan §D-7). Known limitation shared with
  // billing's resolveCurrentAverageCosts: if a repair has two separate RepairPart rows for the
  // *same* productId, this picks the first matching StockMovement (no per-part discriminator
  // exists on StockMovement itself) — acceptable, pre-existing class of gap, not introduced here.
  private async buildOriginalConsumptions(
    tx: Prisma.TransactionClient,
    repairId: string,
    productId: string,
    qty: number,
  ): Promise<ConsumptionLine[]> {
    const outMovement = await tx.stockMovement.findFirst({
      where: { referenceType: 'REPAIR', referenceId: repairId, productId, direction: PrismaMovementDirection.OUT },
    });
    if (!outMovement) throw new BadRequestError(`No stock movement found for product ${productId} on repair ${repairId}`);

    const consumptions = await tx.stockMovementConsumption.findMany({
      where: { outMovementId: outMovement.id },
      orderBy: { id: 'asc' },
    });

    const result: ConsumptionLine[] = [];
    let remaining = qty;
    for (const consumption of consumptions) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, consumption.quantityConsumed);
      result.push({ inMovementId: consumption.inMovementId, qty: take, unitCost: consumption.unitCost.toNumber() });
      remaining -= take;
    }
    if (remaining > 0) {
      throw new Error(`Could not reconstruct ${qty} units of consumption history for product ${productId} on repair ${repairId}`);
    }
    return result;
  }
}
