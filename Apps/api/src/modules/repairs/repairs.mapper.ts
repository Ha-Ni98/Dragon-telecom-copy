import type { ClientPayment, Brand, DeviceModel, Invoice, Prisma, Repair, RepairPart, RepairStatusHistory, Staff, Technician } from '@prisma/client';
import {
  RepairResponseSchema,
  RepairStatus,
  TechnicianRepairStatsResponseSchema,
  type AddRepairPartCommand,
  type CreateRepairCommand,
  type RepairDto,
  type ReportedIssue,
  type TechnicianRepairStatsDto,
} from '@dragon-telecom/contract';

type Money = Prisma.Decimal | number;

// brand/model/technician are inlined {id;name} refs (repairs has no catalog dependency in the
// plan — plan §II.1); history's staffName needs the joined Staff row. S13 adds payments (the
// ledger rows taken for this repair) and invoice (the number issued at PICKED_UP).
export type RepairRow = Repair & {
  brand: Pick<Brand, 'id' | 'name'> | null;
  deviceModel: Pick<DeviceModel, 'id' | 'name'> | null;
  technician: Pick<Technician, 'id' | 'name'> | null;
  parts: RepairPart[];
  history: (RepairStatusHistory & { staff: Pick<Staff, 'firstName' | 'lastName'> })[];
  payments: ClientPayment[];
  invoice: Pick<Invoice, 'number'> | null;
};

export type TechnicianStatsRow = {
  technicianId: string;
  technicianName: string;
  isEnabled: boolean;
  intakeCount: number;
  processingCount: number;
  completedCount: number;
  pickedUpCount: number;
  cancelledCount: number;
  returnedCount: number; // S30
  revenue: number;
};

export type RepairDtoContext = { includeMargins: boolean; now?: Date };

// customerName/customerPhone are supplied pre-resolved by the service (a PosClient read when
// cmd.posClientId is given, else the command's own values verbatim — spec BL#1 "attaching a
// POS client prefills name/phone") — the mapper never queries, same "supplied pre-resolved,
// never rebuilt here" precedent as sales'/purchasing's own draft contexts.
export type IntakeContext = { reference: string; customerName: string; customerPhone: string };

export class RepairsMapper {
  static toRepairDto(repair: RepairRow, ctx: RepairDtoContext): RepairDto {
    const now = ctx.now ?? new Date();
    // S30/Q1 — a reversal row names the payment it reverses; both always belong to this repair.
    const paymentReferenceById = new Map(repair.payments.map((payment) => [payment.id, payment.reference]));
    const dto: RepairDto = {
      id: repair.id,
      reference: repair.reference,
      // Prisma's generated $Enums.RepairStatus and the contract's enum are distinct nominal
      // types with identical string values (schema.prisma's own invariant, same cast used by
      // orders/sales/purchasing mappers).
      status: repair.status as RepairStatus,
      customerName: repair.customerName,
      customerPhone: repair.customerPhone,
      ...(repair.posClientId != null ? { posClientId: repair.posClientId } : {}),
      device: {
        ...(repair.brand != null ? { brand: { id: repair.brand.id, name: repair.brand.name } } : {}),
        ...(repair.deviceModel != null ? { model: { id: repair.deviceModel.id, name: repair.deviceModel.name } } : {}),
        ...(repair.deviceLabel != null ? { label: repair.deviceLabel } : {}),
        ...(repair.deviceImei != null ? { imei: repair.deviceImei } : {}),
      },
      reportedIssues: repair.reportedIssues as ReportedIssue[],
      ...(repair.reportedIssueOther != null ? { reportedIssueOther: repair.reportedIssueOther } : {}),
      ...(repair.diagnosis != null ? { diagnosis: repair.diagnosis } : {}),
      ...(repair.technician != null ? { technician: { id: repair.technician.id, name: repair.technician.name } } : {}),
      labourPrice: RepairsMapper.toMoney(repair.labourPrice),
      partsTotal: RepairsMapper.toMoney(repair.partsTotal),
      totalAmount: RepairsMapper.toMoney(repair.totalAmount),
      paidAmount: RepairsMapper.toMoney(repair.paidAmount),
      refundedAmount: RepairsMapper.toMoney(repair.refundedAmount),
      // Margin-gated (plan §II.1/§D-3): staff mapping strips these, admin keeps them. Both
      // columns are nullable (unset until COMPLETED) *and* the DTO fields are .optional() —
      // omission is correct in both the staff-gated case and the pre-completion case.
      ...(ctx.includeMargins && repair.totalCost != null ? { totalCost: RepairsMapper.toMoney(repair.totalCost) } : {}),
      ...(ctx.includeMargins && repair.totalProfit != null ? { totalProfit: RepairsMapper.toMoney(repair.totalProfit) } : {}),
      intakeAt: repair.intakeAt.toISOString(),
      ...(repair.completedAt != null ? { completedAt: repair.completedAt.toISOString() } : {}),
      ...(repair.pickedUpAt != null ? { pickedUpAt: repair.pickedUpAt.toISOString() } : {}),
      ...(repair.cancelledAt != null ? { cancelledAt: repair.cancelledAt.toISOString() } : {}),
      ...(repair.returnedAt != null ? { returnedAt: repair.returnedAt.toISOString() } : {}),
      ageHours: RepairsMapper.ageHours(repair.intakeAt, now),
      ...(repair.invoice != null ? { invoiceNumber: repair.invoice.number } : {}),
      payments: repair.payments.map((payment) => ({
        id: payment.id,
        reference: payment.reference,
        amount: RepairsMapper.toMoney(payment.amount),
        paidAt: payment.paidAt.toISOString(),
        ...(payment.invoiceId != null ? { invoiceId: payment.invoiceId } : {}),
        ...(payment.reversalOfId != null && paymentReferenceById.has(payment.reversalOfId)
          ? { reversesReference: paymentReferenceById.get(payment.reversalOfId)! }
          : {}),
      })),
      parts: repair.parts.map((part) => ({
        id: part.id,
        productId: part.productId,
        productName: part.productNameSnapshot,
        quantity: part.quantity,
        unitPrice: RepairsMapper.toMoney(part.unitPrice),
        ...(ctx.includeMargins && part.costOfGoods != null ? { costOfGoods: RepairsMapper.toMoney(part.costOfGoods) } : {}),
        ...(ctx.includeMargins && part.profit != null ? { profit: RepairsMapper.toMoney(part.profit) } : {}),
        lineTotal: RepairsMapper.toMoney(part.lineTotal),
        ...(part.serialNumbers != null ? { serialNumbers: part.serialNumbers } : {}),
        ...(part.restockedOnReturn != null ? { restockedOnReturn: part.restockedOnReturn } : {}),
      })),
      // The intake row (fromStatus===toStatus===INTAKE, written at createRepair — plan §C-1)
      // is kept in the surfaced history rather than filtered out: it reads naturally as
      // "ticket opened by X" in a timeline, and is the only record of who took the intake.
      history: repair.history.map((entry) => ({
        fromStatus: entry.fromStatus as RepairStatus,
        toStatus: entry.toStatus as RepairStatus,
        ...(entry.note != null ? { note: entry.note } : {}),
        staffName: `${entry.staff.firstName} ${entry.staff.lastName}`,
        changedAt: entry.changedAt.toISOString(),
      })),
    };
    return RepairResponseSchema.parse(dto);
  }

  // INTAKE, all totals at their schema defaults (0) until parts/labour are added (plan §II.1).
  static toPersistenceIntake(cmd: CreateRepairCommand, ctx: IntakeContext): Prisma.RepairUncheckedCreateInput {
    return {
      reference: ctx.reference,
      ...(cmd.posClientId != null ? { posClientId: cmd.posClientId } : {}),
      customerName: ctx.customerName,
      customerPhone: ctx.customerPhone,
      ...(cmd.brandId != null ? { brandId: cmd.brandId } : {}),
      ...(cmd.deviceModelId != null ? { deviceModelId: cmd.deviceModelId } : {}),
      ...(cmd.deviceLabel != null ? { deviceLabel: cmd.deviceLabel } : {}),
      ...(cmd.deviceImei != null ? { deviceImei: cmd.deviceImei } : {}),
      reportedIssues: cmd.reportedIssues,
      ...(cmd.reportedIssueOther != null ? { reportedIssueOther: cmd.reportedIssueOther } : {}),
      ...(cmd.technicianId != null ? { technicianId: cmd.technicianId } : {}),
      status: RepairStatus.INTAKE,
      labourPrice: 0,
      partsTotal: 0,
      totalAmount: 0,
      paidAmount: 0,
    };
  }

  // cost/profit stay null until COMPLETED consumes the part via FIFO (plan §II.1/§II.3).
  // AddRepairPartCommand.serialNumbers is already a plain string (unlike Order/SaleLine's
  // array — no comma-join/split conversion needed here, same precedent as purchasing's
  // SupplierInvoiceLine.serialNumbers).
  static toPartCreateInput(
    cmd: AddRepairPartCommand,
    ctx: { productName: string },
  ): Prisma.RepairPartUncheckedCreateWithoutRepairInput {
    return {
      productId: cmd.productId,
      productNameSnapshot: ctx.productName,
      quantity: cmd.quantity,
      unitPrice: cmd.unitPrice,
      lineTotal: cmd.unitPrice * cmd.quantity,
      ...(cmd.serialNumbers != null ? { serialNumbers: cmd.serialNumbers } : {}),
    };
  }

  static ageHours(since: Date, now: Date = new Date()): number {
    return (now.getTime() - since.getTime()) / 3_600_000;
  }

  // R1 — the admin Technicians tab. totalRepairs is derived (sum of the six status counts)
  // rather than a separate query, since every repair has exactly one of those six statuses.
  static toTechnicianStatsDto(row: TechnicianStatsRow): TechnicianRepairStatsDto {
    const dto: TechnicianRepairStatsDto = {
      technicianId: row.technicianId,
      technicianName: row.technicianName,
      isEnabled: row.isEnabled,
      totalRepairs:
        row.intakeCount + row.processingCount + row.completedCount + row.pickedUpCount + row.cancelledCount + row.returnedCount,
      intakeCount: row.intakeCount,
      processingCount: row.processingCount,
      completedCount: row.completedCount,
      pickedUpCount: row.pickedUpCount,
      cancelledCount: row.cancelledCount,
      returnedCount: row.returnedCount,
      revenue: row.revenue,
    };
    return TechnicianRepairStatsResponseSchema.parse(dto);
  }

  private static toMoney(value: Money): number {
    return typeof value === 'number' ? value : value.toNumber();
  }
}
