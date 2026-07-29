import type { Prisma } from '@prisma/client';
import type {
  AddRepairPartCommand,
  CreateRepairCommand,
  JWTPayload,
  PaginatedResult,
  RecordRepairPaymentCommand,
  RepairDto,
  RepairListQuery,
  RepairStatusCommand,
  TechnicianRepairStatsDto,
  UpdateRepairCommand,
} from '@dragon-telecom/contract';
import type { InvoiceIssueRequest } from '../billing/billing.interface';

// Injected port (dependency inversion) — real implementation is clients' own composition-root
// singleton (`clientsService`, exported from clients.routes.ts), assembled in repairs.routes.ts.
// PosClient belongs to clients; repairs writes it only through this port, inside its own
// transaction, on a locked row (D5, credit-serialization fix). `applyLedgerPayment` is NOT
// declared here — repairs never calls it directly; every ledger write goes through billing's
// captureClientPaymentInTx, which owns the ClientPayment row that must accompany it.
export interface IRepairCreditPort {
  applyDocumentCharge(
    tx: Prisma.TransactionClient,
    posClientId: string,
    payload: { totalSoldDelta: number; creditDelta: number },
  ): Promise<{ previousCredit: number; newCredit: number }>;
}

// Injected port — real implementation is billing's own BillingService (billing.routes.ts's
// exported singleton). D9: a repair produces an invoice and no sale record.
export interface IBillingIssuePort {
  issueInvoiceInTx(tx: Prisma.TransactionClient, input: InvoiceIssueRequest): Promise<{ invoiceId: string; number: string }>;
  captureClientPaymentInTx(
    tx: Prisma.TransactionClient,
    input: { posClientId: string; invoiceId?: string; repairId?: string; amount: number; paidAt?: Date; staffId: string },
  ): Promise<{ paymentId: string; reference: string; previousCredit: number; newCredit: number }>;
  linkRepairPaymentsToInvoiceInTx(tx: Prisma.TransactionClient, input: { repairId: string; invoiceId: string }): Promise<void>;
}

// S13 — RepairListQuerySchema now carries page/limit + an intake-date range (R2: the board is
// paginated at 10/page, not unbounded "board data" any more).
export interface IRepairsService {
  // staff(STAFF_REPAIRS): created-by-me (§C-1); admin: all.
  listRepairs(query: RepairListQuery, actor: JWTPayload): Promise<PaginatedResult<RepairDto>>;
  // set-03 B1 — single-ticket read (ADM-13/STF-07 ticket detail). Unrestricted by creator,
  // same as every mutation below — the created-by-me rule is a LIST-only convenience filter
  // (§C-1), not a per-ticket ACL.
  getRepair(id: string, actor: JWTPayload): Promise<RepairDto>;
  // + intake history row (§C-1) for creator-scoping, and (S13) for resolving the staff who
  // performed the PICKED_UP transition — repair.pickedUp carries no staffId of its own.
  // Takes the full actor (not a bare staffId, deviating from the plan's literal signature):
  // CREATE is staff(STAFF_REPAIRS)|admin, and an ADMIN JWT never carries a staffId — the
  // service resolves actor.staffId ?? the shared system-staff fallback for the history row's
  // NOT NULL staffId column, same as every other mutation method here (Sprint 5 report).
  createRepair(cmd: CreateRepairCommand, actor: JWTPayload): Promise<RepairDto>;
  updateRepair(id: string, cmd: UpdateRepairCommand, actor: JWTPayload): Promise<RepairDto>;
  // reserve(PENDING_REPAIR).
  addPart(id: string, cmd: AddRepairPartCommand, actor: JWTPayload): Promise<RepairDto>;
  // release.
  removePart(id: string, partId: string, actor: JWTPayload): Promise<RepairDto>;
  // transitions + history + events (INTAKE→PROCESSING→COMPLETED→PICKED_UP, or →CANCELLED).
  // D8/D9 (S13) — PICKED_UP is now the single money moment: parts consumed, invoice issued,
  // revenue recognised, all inside one transaction.
  changeStatus(id: string, cmd: RepairStatusCommand, actor: JWTPayload): Promise<RepairDto>;
  // S13/D5 — a cumulative payment at any pre-pickup step.
  recordPayment(id: string, cmd: RecordRepairPaymentCommand, actor: JWTPayload): Promise<RepairDto>;
  // S13/R1 — the admin Technicians tab.
  listTechnicianStats(): Promise<TechnicianRepairStatsDto[]>;
}
