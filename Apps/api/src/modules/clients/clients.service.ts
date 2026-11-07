import type { PrismaClient } from '@prisma/client';
import {
  Prisma,
  ClientStatus as PrismaClientStatus,
  InvoiceStatus as PrismaInvoiceStatus,
  OrderStatus as PrismaOrderStatus,
  SaleStatus as PrismaSaleStatus,
} from '@prisma/client';
import {
  AdminClientResponseSchema,
  DocType,
  ErrorCode,
  PhoneAvailability,
  PosClientResponseSchema,
  PurchaseDocumentKind,
  PurchasedProductDocumentResponseSchema,
  PurchasedProductResponseSchema,
  paginated,
  type AddCartItemCommand,
  type AdminClientDto,
  type AdminClientListQuery,
  type AdminClientOverviewDto,
  type AdminUpdateClientCommand,
  type ApproveClientCommand,
  type CartItemDto,
  type ChangeMyPasswordCommand,
  type ClientMeDto,
  type ClientsEvents,
  type ClientStatsDto,
  type CreatePosClientCommand,
  type PaginatedResult,
  type PosClientDto,
  type PosClientListQuery,
  type PosClientSearchQuery,
  type PurchasedProductDocumentDto,
  type PurchasedProductDto,
  type PurchasedProductsQuery,
  type RegisterClientCommand,
  type RejectClientCommand,
  type ResetClientPasswordCommand,
  type UpdateMeCommand,
  type UpdatePosClientCommand,
  type ValidatePhoneResultDto,
} from '@dragon-telecom/contract';
import { AppError, BadRequestError, ConflictError, NotFoundError } from '@common/errors';
import { eventBus } from '@common/events/event-bus';
import { comparePassword } from '@common/utils/password.utils';
import type { ISequenceService } from '../platform/platform.interface';
import type { ICatalogCartPort, IClientsService, IIdentityProvisioningPort, Viewer } from './clients.interface';
import { ClientsMapper, type AdminClientRollups, type AdminClientRow } from './clients.mapper';

const isKnownRequestError = (err: unknown, code: string): err is Prisma.PrismaClientKnownRequestError =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

// S36 — what counts as "bought" in a client's purchase history. Sales: confirmed, including those
// that later saw a return (statistics' SALE_RECOGNIZED_STATUSES) — drafts and cancelled sales are
// out. Orders: COMPLETED or RETURNED *and* deliveredAt set — deliveredAt is stamped only at
// COMPLETED, so an order RETURNED straight from IN_DELIVERY (nothing consumed or invoiced) is out.
const PURCHASE_SALE_STATUSES = [PrismaSaleStatus.COMPLETED, PrismaSaleStatus.PARTIALLY_RETURNED, PrismaSaleStatus.RETURNED];
const PURCHASE_ORDER_STATUSES = [PrismaOrderStatus.COMPLETED, PrismaOrderStatus.RETURNED];

type PurchaseIdentities = { posClientId: string | null; clientId: string | null };

type PurchasedProductRow = {
  productId: string;
  productName: string;
  quantityBought: number;
  totalAmount: Prisma.Decimal;
  quantityReturned: number;
  amountRefunded: Prisma.Decimal;
  lastBoughtAt: Date;
};

type PurchasedProductDocumentRow = {
  kind: string;
  documentId: string;
  reference: string;
  at: Date;
  quantity: number;
  unitPrice: Prisma.Decimal | null;
  amount: Prisma.Decimal;
  sourceKind: string | null;
  sourceReference: string | null;
};

const ADMIN_CLIENT_INCLUDE = {
  wilaya: { select: { frName: true } },
  commune: { select: { frName: true } },
  user: { select: { username: true } },
  posClient: { select: { id: true, category: { select: { name: true } } } },
} satisfies Prisma.ClientInclude;

const POS_CLIENT_INCLUDE = {
  category: { select: { name: true } },
  linkedClient: { select: { id: true } },
} satisfies Prisma.PosClientInclude;

export class ClientsService implements IClientsService {
  constructor(
    private prisma: PrismaClient,
    private identity: IIdentityProvisioningPort,
    private sequence: ISequenceService,
    private catalogCart: ICatalogCartPort,
  ) {}

  // --- Web identity ---

  async validatePhone(phone: string): Promise<ValidatePhoneResultDto> {
    const { isValid, status } = await this.checkPhoneAvailability(phone);
    return ClientsMapper.toValidatePhoneDto(isValid, status);
  }

  async register(cmd: RegisterClientCommand): Promise<{ id: string }> {
    const availability = await this.checkPhoneAvailability(cmd.phone);
    if (availability.status === PhoneAvailability.REGISTERED) {
      throw new ConflictError('This phone number is already registered');
    }
    if (availability.status === PhoneAvailability.PENDING) {
      throw new ConflictError('A registration for this phone number is already pending');
    }

    await this.assertWilayaAndCommune(cmd.wilayaId, cmd.communeId);

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await this.sequence.nextNumber(tx, DocType.CLIENT);
      return tx.client.create({
        data: {
          code,
          firstName: cmd.firstName,
          lastName: cmd.lastName,
          phone: cmd.phone,
          ...(cmd.email != null ? { email: cmd.email } : {}),
          ...(cmd.storeName != null ? { storeName: cmd.storeName } : {}),
          wilayaId: cmd.wilayaId,
          communeId: cmd.communeId,
          status: PrismaClientStatus.PENDING,
        },
      });
    });

    eventBus.emit('client.registered', { clientId: created.id });
    return { id: created.id };
  }

  async getMe(clientId: string): Promise<ClientMeDto> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { posClient: { select: { credit: true, totalPaid: true, totalSold: true } } },
    });
    if (!client) throw new NotFoundError('Client');
    return ClientsMapper.toClientMeDto(client);
  }

  async updateMe(clientId: string, cmd: UpdateMeCommand): Promise<ClientMeDto> {
    if (cmd.wilayaId != null || cmd.communeId != null) {
      const existing = await this.prisma.client.findUnique({
        where: { id: clientId },
        select: { wilayaId: true, communeId: true },
      });
      if (!existing) throw new NotFoundError('Client');
      await this.assertWilayaAndCommune(cmd.wilayaId ?? existing.wilayaId, cmd.communeId ?? existing.communeId);
    }

    try {
      await this.prisma.client.update({
        where: { id: clientId },
        data: {
          ...(cmd.email !== undefined ? { email: cmd.email } : {}),
          ...(cmd.storeName !== undefined ? { storeName: cmd.storeName } : {}),
          ...(cmd.wilayaId !== undefined ? { wilayaId: cmd.wilayaId } : {}),
          ...(cmd.communeId !== undefined ? { communeId: cmd.communeId } : {}),
          ...(cmd.address !== undefined ? { address: cmd.address } : {}),
        },
      });
    } catch (err) {
      if (isKnownRequestError(err, 'P2025')) throw new NotFoundError('Client');
      throw err;
    }

    return this.getMe(clientId);
  }

  async changeMyPassword(clientId: string, cmd: ChangeMyPasswordCommand): Promise<void> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { userId: true } });
    if (!client) throw new NotFoundError('Client');
    if (!client.userId) throw new ConflictError('Client has no account yet (not approved)');

    // Reads User.passwordHash directly + compares via the shared util (rules §1 infra) rather
    // than an identity port method — see clients.interface.ts's IIdentityProvisioningPort note.
    const user = await this.prisma.user.findUnique({ where: { id: client.userId }, select: { passwordHash: true } });
    if (!user) throw new NotFoundError('Client');

    const valid = await comparePassword(cmd.currentPassword, user.passwordHash);
    if (!valid) throw new AppError(401, ErrorCode.AUTH_INVALID_CREDENTIALS, 'Invalid credentials');

    await this.identity.resetPassword(client.userId, cmd.newPassword);
    eventBus.emit('client.passwordReset', { clientId });
  }

  // --- Cart ---

  async getCart(clientId: string, viewer: Viewer): Promise<CartItemDto[]> {
    const rows = await this.prisma.clientCart.findMany({ where: { clientId }, orderBy: { addedAt: 'desc' } });
    if (rows.length === 0) return [];

    const products = await this.catalogCart.getCartProducts(
      rows.map((row) => row.productId),
      viewer,
    );
    const productById = new Map(products.map((product) => [product.id, product]));

    return rows.flatMap((row) => {
      const product = productById.get(row.productId);
      return product ? [ClientsMapper.toCartItemDto(row, product)] : [];
    });
  }

  async addCartItem(clientId: string, cmd: AddCartItemCommand): Promise<void> {
    await this.prisma.clientCart.upsert({
      where: { clientId_productId: { clientId, productId: cmd.productId } },
      create: { clientId, productId: cmd.productId },
      update: {},
    });
  }

  async removeCartItem(clientId: string, productId: string): Promise<void> {
    await this.prisma.clientCart.deleteMany({ where: { clientId, productId } });
  }

  // --- Admin client pipeline ---

  async listClients(query: AdminClientListQuery): Promise<PaginatedResult<AdminClientDto>> {
    const where: Prisma.ClientWhereInput = {
      ...(query.status !== undefined ? { status: query.status as PrismaClientStatus } : {}),
      ...(query.isEnabled !== undefined ? { isEnabled: query.isEnabled } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, clients] = await this.prisma.$transaction([
      this.prisma.client.count({ where }),
      this.prisma.client.findMany({
        where,
        include: ADMIN_CLIENT_INCLUDE,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items = await Promise.all(
      clients.map((client) => this.toAdminClientDtoWithRollups(client as AdminClientRow)),
    );

    return paginated(AdminClientResponseSchema).parse({
      items,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }

  async clientStats(): Promise<ClientStatsDto> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [totalClients, pending, approved, rejected, newThisMonth] = await this.prisma.$transaction([
      this.prisma.client.count(),
      this.prisma.client.count({ where: { status: PrismaClientStatus.PENDING } }),
      this.prisma.client.count({ where: { status: PrismaClientStatus.APPROVED } }),
      this.prisma.client.count({ where: { status: PrismaClientStatus.REJECTED } }),
      this.prisma.client.count({ where: { createdAt: { gte: startOfMonth } } }),
    ]);
    return ClientsMapper.toClientStatsDto({ totalClients, pending, approved, rejected, newThisMonth });
  }

  async getClient(id: string): Promise<AdminClientDto> {
    const client = await this.prisma.client.findUnique({ where: { id }, include: ADMIN_CLIENT_INCLUDE });
    if (!client) throw new NotFoundError('Client');
    return this.toAdminClientDtoWithRollups(client as AdminClientRow);
  }

  // The Overview tab's five figures (S8 J4). Money is read straight off the linked PosClient —
  // never recomputed here (D5: the ledger is the source of truth for totalPaid, and clients' own
  // applyDocumentCharge/applyLedgerPayment are its only writers). totalProductQuantity is
  // Σ InvoiceLine.quantity over non-cancelled invoices (S8 R1), which counts POS sales, orders
  // and repairs alike and survives S9/S10/S13 unchanged.
  async getClientOverview(id: string): Promise<AdminClientOverviewDto> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        posClientId: true,
        posClient: { select: { credit: true, totalPaid: true, totalSold: true } },
      },
    });
    if (!client) throw new NotFoundError('Client');

    const [orderCount, lineAgg] = await Promise.all([
      this.prisma.order.count({ where: { clientId: id } }),
      client.posClientId != null
        ? this.prisma.invoiceLine.aggregate({
            where: { invoice: { posClientId: client.posClientId, status: { not: PrismaInvoiceStatus.CANCELLED } } },
            _sum: { quantity: true },
          })
        : Promise.resolve(null),
    ]);

    return ClientsMapper.toAdminClientOverviewDto({
      clientId: client.id,
      posClientId: client.posClientId,
      credit: client.posClient?.credit ?? 0,
      totalPaid: client.posClient?.totalPaid ?? 0,
      totalSold: client.posClient?.totalSold ?? 0,
      orderCount,
      totalProductQuantity: lineAgg?._sum.quantity ?? 0,
    });
  }

  async approveClient(id: string, cmd: ApproveClientCommand, staffId: string): Promise<AdminClientDto> {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Client');
    if (existing.status !== PrismaClientStatus.PENDING) throw new ConflictError('Client is not pending approval');

    await this.prisma.$transaction(async (tx) => {
      const { userId } = await this.identity.provisionClientUser({ username: cmd.username, password: cmd.password }, tx);
      await tx.client.update({
        where: { id },
        data: { status: PrismaClientStatus.APPROVED, approvedAt: new Date(), approvedByStaffId: staffId, userId },
      });
    });

    const posClientSeed: ClientsEvents['client.approved']['posClientSeed'] = {
      name: `${existing.firstName} ${existing.lastName}`,
      phone: existing.phone,
      categoryId: cmd.categoryId,
    };
    eventBus.emit('client.approved', { clientId: id, posClientSeed });

    return this.getClient(id);
  }

  async rejectClient(id: string, cmd: RejectClientCommand): Promise<AdminClientDto> {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Client');
    if (existing.status !== PrismaClientStatus.PENDING) throw new ConflictError('Client is not pending approval');

    await this.prisma.client.update({
      where: { id },
      data: { status: PrismaClientStatus.REJECTED, ...(cmd.reason != null ? { rejectionReason: cmd.reason } : {}) },
    });

    eventBus.emit('client.rejected', { clientId: id, ...(cmd.reason != null ? { reason: cmd.reason } : {}) });

    return this.getClient(id);
  }

  async resetClientPassword(id: string, cmd: ResetClientPasswordCommand): Promise<void> {
    const client = await this.prisma.client.findUnique({ where: { id }, select: { userId: true } });
    if (!client) throw new NotFoundError('Client');
    if (!client.userId) throw new ConflictError('Client has no account to reset (not yet approved)');

    await this.identity.resetPassword(client.userId, cmd.newPassword);
    eventBus.emit('client.passwordReset', { clientId: id });
  }

  async adminUpdateClient(id: string, cmd: AdminUpdateClientCommand): Promise<AdminClientDto> {
    try {
      await this.prisma.client.update({
        where: { id },
        data: {
          ...(cmd.email !== undefined ? { email: cmd.email } : {}),
          ...(cmd.storeName !== undefined ? { storeName: cmd.storeName } : {}),
          ...(cmd.address !== undefined ? { address: cmd.address } : {}),
          ...(cmd.isEnabled !== undefined ? { isEnabled: cmd.isEnabled } : {}),
        },
      });
    } catch (err) {
      if (isKnownRequestError(err, 'P2025')) throw new NotFoundError('Client');
      throw err;
    }

    return this.getClient(id);
  }

  // --- POS clients ---

  async searchPosClients(query: PosClientSearchQuery): Promise<PosClientDto[]> {
    const rows = await this.prisma.posClient.findMany({
      where: {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { phone: { contains: query.q, mode: 'insensitive' } },
        ],
      },
      include: POS_CLIENT_INCLUDE,
      take: 20,
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ClientsMapper.toPosClientDto(row));
  }

  async quickCreatePosClient(cmd: CreatePosClientCommand): Promise<PosClientDto> {
    return this.createPosClientRow(cmd);
  }

  async createPosClient(cmd: CreatePosClientCommand): Promise<PosClientDto> {
    return this.createPosClientRow(cmd);
  }

  async listPosClients(query: PosClientListQuery): Promise<PaginatedResult<PosClientDto>> {
    const where: Prisma.PosClientWhereInput = {
      ...(query.isEnabled !== undefined ? { isEnabled: query.isEnabled } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.posClient.count({ where }),
      this.prisma.posClient.findMany({
        where,
        include: POS_CLIENT_INCLUDE,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return paginated(PosClientResponseSchema).parse({
      items: rows.map((row) => ClientsMapper.toPosClientDto(row)),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }

  async updatePosClient(id: string, cmd: UpdatePosClientCommand): Promise<PosClientDto> {
    try {
      await this.prisma.posClient.update({
        where: { id },
        data: {
          ...(cmd.name !== undefined ? { name: cmd.name } : {}),
          ...(cmd.phone !== undefined ? { phone: cmd.phone } : {}),
          ...(cmd.categoryId !== undefined ? { categoryId: cmd.categoryId } : {}),
          ...(cmd.isEnabled !== undefined ? { isEnabled: cmd.isEnabled } : {}),
        },
      });
    } catch (err) {
      if (isKnownRequestError(err, 'P2025')) throw new NotFoundError('PosClient');
      throw err;
    }

    const updated = await this.prisma.posClient.findUniqueOrThrow({ where: { id }, include: POS_CLIENT_INCLUDE });
    return ClientsMapper.toPosClientDto(updated);
  }

  // --- Listener-invoked (internal — see clients.interface.ts) ---

  async materializePosClientForApprovedClient(
    clientId: string,
    posClientSeed: ClientsEvents['client.approved']['posClientSeed'],
  ): Promise<void> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { posClientId: true } });
    if (!client || client.posClientId != null) return; // idempotent — already materialized (or vanished)

    await this.prisma.$transaction(async (tx) => {
      const code = await this.sequence.nextNumber(tx, DocType.POS_CLIENT);
      const posClient = await tx.posClient.create({
        data: {
          code,
          name: posClientSeed.name,
          ...(posClientSeed.phone != null ? { phone: posClientSeed.phone } : {}),
          categoryId: posClientSeed.categoryId,
        },
      });
      await tx.client.update({ where: { id: clientId }, data: { posClientId: posClient.id } });
    });
  }

  // --- Injected credit port (credit-serialization fix, plan §C2; split into two orthogonal
  // primitives, plan S5) ---
  //
  // PosClient belongs to this module — sales/orders/billing must not write it directly; each
  // consumes these methods as an injected port (structural typing, the established
  // ICatalogCartPort precedent: the consumer declares its own narrowed interface locally,
  // `ClientsService` satisfies it by having the matching methods, no `implements` clause here).
  // Every method locks the row for the duration of the CALLER's own transaction and writes the
  // new cache values in that same transaction.
  //
  // The two primitives below are `applyDocumentCharge` (credit + totalSold — a document charging
  // the account) and `applyLedgerPayment` (credit + totalPaid — the ledger, D5's single writer of
  // totalPaid). Composed, they reproduce the pre-S5 single-call arithmetic exactly: see plan S5
  // §0.5 for the per-field proof.

  // A document (sale, and from S10/S13 an order or repair) charging the account. The full
  // document total goes onto `credit`; any money taken at the same moment is a *separate*
  // ledger call (applyLedgerPayment) in the same transaction — D5/R1. Composed, the two calls
  // reproduce the old single applySaleCharge arithmetic exactly (see plan S5 §0.5).
  // `totalSoldDelta` and `creditDelta` are caller-signed so returns can pass negatives.
  // This method never touches totalPaid — the ledger owns that field, and only the ledger.
  async applyDocumentCharge(
    tx: Prisma.TransactionClient,
    posClientId: string,
    payload: { totalSoldDelta: number; creditDelta: number },
  ): Promise<{ previousCredit: number; newCredit: number }> {
    const locked = await this.lockPosClient(tx, posClientId);
    const previousCredit = locked.credit.toNumber();
    const newCredit = previousCredit + payload.creditDelta;
    await tx.posClient.update({
      where: { id: posClientId },
      data: { credit: newCredit, totalSold: { increment: payload.totalSoldDelta } },
    });
    return { previousCredit, newCredit };
  }

  // The ledger primitive — the ONLY writer of PosClient.totalPaid anywhere in the codebase (D5).
  // Always paired with exactly one ClientPayment row created in the same transaction, of the same
  // amount, so `totalPaid = Σ ClientPayment.amount` holds by construction.
  // `amount` is signed: a positive amount is money received (credit down, totalPaid up); a
  // NEGATIVE amount is a refund (credit up, totalPaid down) and is how D6's negative-amount
  // refund rows are applied. Overpayment is permitted — a negative newCredit means the store owes
  // the client, mirroring purchasing's own overpayment-allowed convention.
  async applyLedgerPayment(
    tx: Prisma.TransactionClient,
    posClientId: string,
    payload: { amount: number },
  ): Promise<{ previousCredit: number; newCredit: number }> {
    const locked = await this.lockPosClient(tx, posClientId);
    const previousCredit = locked.credit.toNumber();
    const newCredit = previousCredit - payload.amount;
    await tx.posClient.update({
      where: { id: posClientId },
      data: { credit: newCredit, totalPaid: { increment: payload.amount } },
    });
    return { previousCredit, newCredit };
  }

  // --- Private helpers ---

  // Locks the PosClient row for the duration of the caller's transaction (same
  // `SELECT ... FOR UPDATE` precedent as purchasing's own lockSupplier / platform's
  // SequenceService) — the serialization point every credit-port method above shares. Disabled
  // rows are rejected the same as unknown ones (module-implementation-rules: a disabled
  // POS client is not a valid charge/payment/refund target).
  private async lockPosClient(tx: Prisma.TransactionClient, posClientId: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "PosClient" WHERE id = ${posClientId} FOR UPDATE`;
    if (!rows[0]) throw new NotFoundError('PosClient');
    const posClient = await tx.posClient.findUniqueOrThrow({ where: { id: posClientId } });
    if (!posClient.isEnabled) throw new NotFoundError('PosClient');
    return posClient;
  }

  private async checkPhoneAvailability(phone: string): Promise<{ isValid: boolean; status: PhoneAvailability }> {
    const existing = await this.prisma.client.findUnique({ where: { phone }, select: { status: true } });

    let status: PhoneAvailability;
    if (!existing || existing.status === PrismaClientStatus.REJECTED) {
      status = PhoneAvailability.AVAILABLE;
    } else if (existing.status === PrismaClientStatus.APPROVED) {
      status = PhoneAvailability.REGISTERED;
    } else {
      status = PhoneAvailability.PENDING;
    }

    return { isValid: status === PhoneAvailability.AVAILABLE, status };
  }

  private async assertWilayaAndCommune(wilayaId: string, communeId: string): Promise<void> {
    const [wilaya, commune] = await Promise.all([
      this.prisma.wilaya.findUnique({ where: { id: wilayaId }, select: { id: true } }),
      this.prisma.commune.findUnique({ where: { id: communeId }, select: { id: true, wilayaId: true } }),
    ]);
    if (!wilaya) throw new BadRequestError(`Unknown wilayaId: ${wilayaId}`);
    if (!commune) throw new BadRequestError(`Unknown communeId: ${communeId}`);
    if (commune.wilayaId !== wilayaId) throw new BadRequestError('Commune does not belong to the given wilaya');
  }

  private async createPosClientRow(cmd: CreatePosClientCommand): Promise<PosClientDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      const code = await this.sequence.nextNumber(tx, DocType.POS_CLIENT);
      return tx.posClient.create({
        data: {
          code,
          name: cmd.name,
          ...(cmd.phone != null ? { phone: cmd.phone } : {}),
          ...(cmd.categoryId != null ? { categoryId: cmd.categoryId } : {}),
          ...(cmd.initialCredit != null ? { credit: cmd.initialCredit } : {}),
        },
        include: POS_CLIENT_INCLUDE,
      });
    });

    if (cmd.initialCredit) {
      eventBus.emit('posClient.creditChanged', {
        posClientId: created.id,
        previousCredit: 0,
        newCredit: cmd.initialCredit,
        cause: 'Initial credit',
      });
    }

    return ClientsMapper.toPosClientDto(created);
  }

  // Order/Sale roll-ups (plan §I.3 #7) — Order links via `clientId` directly, Sale only via the
  // linked PosClient's `posClientId` (schema.prisma has no Sale.clientId). Deliberately
  // unfiltered by status (summing every row, not just "confirmed"-ish ones): filtering would
  // mean inventing SaleStatus/OrderStatus business rules that belong to the not-yet-built
  // sales/orders modules, not this one. Both tables are empty until those modules exist, so
  // this reads 0/undefined today and lights up automatically once they land.
  private async toAdminClientDtoWithRollups(client: AdminClientRow): Promise<AdminClientDto> {
    const rollups = await this.loadAdminClientRollups(client.id, client.posClient?.id ?? null);
    return ClientsMapper.toAdminClientDto(client, rollups);
  }

  private async loadAdminClientRollups(clientId: string, posClientId: string | null): Promise<AdminClientRollups> {
    const [orderAgg, saleAgg] = await Promise.all([
      this.prisma.order.aggregate({ where: { clientId }, _count: true, _sum: { totalAmount: true }, _max: { placedAt: true } }),
      posClientId
        ? this.prisma.sale.aggregate({ where: { posClientId }, _sum: { totalAmount: true } })
        : Promise.resolve(null),
    ]);

    const totalOrders = orderAgg._count;
    const totalSpent =
      (orderAgg._sum.totalAmount?.toNumber() ?? 0) + (saleAgg?._sum.totalAmount?.toNumber() ?? 0);

    return {
      totalOrders,
      totalSpent,
      ...(orderAgg._max.placedAt != null ? { lastOrderDate: orderAgg._max.placedAt } : {}),
    };
  }

  // --- Purchase history (S36) ---

  // S36 — both identities from either side (Client.posClientId is a unique FK). 404 when the
  // starting row doesn't exist; a missing other side just omits that branch.
  private async purchaseIdentitiesFromClient(clientId: string): Promise<PurchaseIdentities> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { id: true, posClientId: true } });
    if (!client) throw new NotFoundError('Client');
    return { posClientId: client.posClientId, clientId: client.id };
  }

  private async purchaseIdentitiesFromPosClient(posClientId: string): Promise<PurchaseIdentities> {
    const posClient = await this.prisma.posClient.findUnique({
      where: { id: posClientId },
      select: { id: true, linkedClient: { select: { id: true } } },
    });
    if (!posClient) throw new NotFoundError('PosClient');
    return { posClientId: posClient.id, clientId: posClient.linkedClient?.id ?? null };
  }

  async listClientPurchasedProducts(clientId: string, query: PurchasedProductsQuery): Promise<PaginatedResult<PurchasedProductDto>> {
    return this.purchasedProductsPage(await this.purchaseIdentitiesFromClient(clientId), query);
  }

  async listPosClientPurchasedProducts(posClientId: string, query: PurchasedProductsQuery): Promise<PaginatedResult<PurchasedProductDto>> {
    return this.purchasedProductsPage(await this.purchaseIdentitiesFromPosClient(posClientId), query);
  }

  async listClientPurchasedProductDocuments(
    clientId: string,
    productId: string,
    query: PurchasedProductsQuery,
  ): Promise<PaginatedResult<PurchasedProductDocumentDto>> {
    return this.purchasedProductDocumentsPage(await this.purchaseIdentitiesFromClient(clientId), productId, query);
  }

  async listPosClientPurchasedProductDocuments(
    posClientId: string,
    productId: string,
    query: PurchasedProductsQuery,
  ): Promise<PaginatedResult<PurchasedProductDocumentDto>> {
    return this.purchasedProductDocumentsPage(await this.purchaseIdentitiesFromPosClient(posClientId), productId, query);
  }

  // S36 — every product the client bought: one GROUP BY over a UNION ALL of sale lines (via the POS
  // identity) and order lines (via the web identity), paginated in SQL — no line is loaded into
  // memory (1 GB machine). Returns are pre-aggregated PER LINE before the join, so a line returned
  // in two goes is never double-counted. A missing identity omits its branch (Prisma.empty never
  // reaches SQL), so a walk-in POS client (sales only) and a web client with no POS identity (orders
  // only) both work. Amounts are the stored line totals; repair parts are never read.
  private async purchasedProductsPage(ids: PurchaseIdentities, query: PurchasedProductsQuery): Promise<PaginatedResult<PurchasedProductDto>> {
    const branches: Prisma.Sql[] = [];
    if (ids.posClientId != null) {
      branches.push(Prisma.sql`
        SELECT sl."productId" AS "productId", sl."quantity" AS qty, sl."lineTotal" AS amount,
               COALESCE(rs.qty, 0) AS rqty, COALESCE(rs.refund, 0) AS refund, s."soldAt" AS at
        FROM "SaleLine" sl
        JOIN "Sale" s ON s."id" = sl."saleId"
        LEFT JOIN (SELECT rl."saleLineId" AS lid, SUM(rl."quantity") AS qty, SUM(rl."refundAmount") AS refund
                   FROM "ReturnLine" rl WHERE rl."saleLineId" IS NOT NULL GROUP BY rl."saleLineId") rs ON rs.lid = sl."id"
        WHERE s."posClientId" = ${ids.posClientId} AND s."status"::text IN (${Prisma.join(PURCHASE_SALE_STATUSES)})`);
    }
    if (ids.clientId != null) {
      branches.push(Prisma.sql`
        SELECT ol."productId" AS "productId", ol."quantity" AS qty, ol."lineTotal" AS amount,
               COALESCE(ro.qty, 0) AS rqty, COALESCE(ro.refund, 0) AS refund, o."deliveredAt" AS at
        FROM "OrderLine" ol
        JOIN "Order" o ON o."id" = ol."orderId"
        LEFT JOIN (SELECT rl."orderLineId" AS lid, SUM(rl."quantity") AS qty, SUM(rl."refundAmount") AS refund
                   FROM "ReturnLine" rl WHERE rl."orderLineId" IS NOT NULL GROUP BY rl."orderLineId") ro ON ro.lid = ol."id"
        WHERE o."clientId" = ${ids.clientId} AND o."status"::text IN (${Prisma.join(PURCHASE_ORDER_STATUSES)})
          AND o."deliveredAt" IS NOT NULL`);
    }
    if (branches.length === 0) {
      return paginated(PurchasedProductResponseSchema).parse({
        items: [],
        meta: { page: query.page, limit: query.limit, total: 0, totalPages: 0 },
      });
    }

    const bought = Prisma.join(branches, ' UNION ALL ');
    const [rows, counted] = await Promise.all([
      this.prisma.$queryRaw<PurchasedProductRow[]>`
        WITH bought AS (${bought})
        SELECT b."productId", p."name" AS "productName",
               SUM(b.qty)::int AS "quantityBought", SUM(b.amount) AS "totalAmount",
               SUM(b.rqty)::int AS "quantityReturned", SUM(b.refund) AS "amountRefunded",
               MAX(b.at) AS "lastBoughtAt"
        FROM bought b JOIN "Product" p ON p."id" = b."productId"
        GROUP BY b."productId", p."name"
        ORDER BY MAX(b.at) DESC, p."name" ASC
        LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
      this.prisma.$queryRaw<{ total: number }[]>`WITH bought AS (${bought}) SELECT COUNT(DISTINCT "productId")::int AS total FROM bought`,
    ]);
    const total = counted[0]?.total ?? 0;

    return paginated(PurchasedProductResponseSchema).parse({
      items: rows.map((row) => ClientsMapper.toPurchasedProductDto(row)),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }

  // S36 — the documents behind one purchased product: each sale/order line that contained it, and
  // each return of it, as their own rows (never netted), newest first, paginated in SQL. Same
  // population rules and identity branches as purchasedProductsPage. A return row carries the
  // sale/order it came from (the web links it there — a return has no page of its own). Every
  // column is aliased in every branch, so the result keeps its names whichever branch comes first.
  private async purchasedProductDocumentsPage(
    ids: PurchaseIdentities,
    productId: string,
    query: PurchasedProductsQuery,
  ): Promise<PaginatedResult<PurchasedProductDocumentDto>> {
    const branches: Prisma.Sql[] = [];
    if (ids.posClientId != null) {
      branches.push(Prisma.sql`
        SELECT ${PurchaseDocumentKind.SALE}::text AS kind, s."id" AS "documentId", s."reference" AS "reference", s."soldAt" AS at,
               sl."quantity" AS "quantity", sl."unitPrice" AS "unitPrice", sl."lineTotal" AS amount,
               NULL::text AS "sourceKind", NULL::text AS "sourceReference"
        FROM "SaleLine" sl JOIN "Sale" s ON s."id" = sl."saleId"
        WHERE sl."productId" = ${productId} AND s."posClientId" = ${ids.posClientId}
          AND s."status"::text IN (${Prisma.join(PURCHASE_SALE_STATUSES)})`);
      branches.push(Prisma.sql`
        SELECT ${PurchaseDocumentKind.RETURN}::text AS kind, r."id" AS "documentId", r."reference" AS "reference", r."returnedAt" AS at,
               rl."quantity" AS "quantity", NULL::numeric AS "unitPrice", rl."refundAmount" AS amount,
               ${PurchaseDocumentKind.SALE}::text AS "sourceKind", s."reference" AS "sourceReference"
        FROM "ReturnLine" rl
        JOIN "Return" r ON r."id" = rl."returnId"
        JOIN "SaleLine" sl ON sl."id" = rl."saleLineId"
        JOIN "Sale" s ON s."id" = sl."saleId"
        WHERE sl."productId" = ${productId} AND s."posClientId" = ${ids.posClientId}
          AND s."status"::text IN (${Prisma.join(PURCHASE_SALE_STATUSES)})`);
    }
    if (ids.clientId != null) {
      branches.push(Prisma.sql`
        SELECT ${PurchaseDocumentKind.ORDER}::text AS kind, o."id" AS "documentId", o."reference" AS "reference", o."deliveredAt" AS at,
               ol."quantity" AS "quantity", ol."unitPrice" AS "unitPrice", ol."lineTotal" AS amount,
               NULL::text AS "sourceKind", NULL::text AS "sourceReference"
        FROM "OrderLine" ol JOIN "Order" o ON o."id" = ol."orderId"
        WHERE ol."productId" = ${productId} AND o."clientId" = ${ids.clientId}
          AND o."status"::text IN (${Prisma.join(PURCHASE_ORDER_STATUSES)}) AND o."deliveredAt" IS NOT NULL`);
      branches.push(Prisma.sql`
        SELECT ${PurchaseDocumentKind.RETURN}::text AS kind, r."id" AS "documentId", r."reference" AS "reference", r."returnedAt" AS at,
               rl."quantity" AS "quantity", NULL::numeric AS "unitPrice", rl."refundAmount" AS amount,
               ${PurchaseDocumentKind.ORDER}::text AS "sourceKind", o."reference" AS "sourceReference"
        FROM "ReturnLine" rl
        JOIN "Return" r ON r."id" = rl."returnId"
        JOIN "OrderLine" ol ON ol."id" = rl."orderLineId"
        JOIN "Order" o ON o."id" = ol."orderId"
        WHERE ol."productId" = ${productId} AND o."clientId" = ${ids.clientId}
          AND o."status"::text IN (${Prisma.join(PURCHASE_ORDER_STATUSES)}) AND o."deliveredAt" IS NOT NULL`);
    }
    if (branches.length === 0) {
      return paginated(PurchasedProductDocumentResponseSchema).parse({
        items: [],
        meta: { page: query.page, limit: query.limit, total: 0, totalPages: 0 },
      });
    }

    const docs = Prisma.join(branches, ' UNION ALL ');
    const [rows, counted] = await Promise.all([
      this.prisma.$queryRaw<PurchasedProductDocumentRow[]>`
        SELECT * FROM (${docs}) d
        ORDER BY d.at DESC, d."reference" DESC
        LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
      this.prisma.$queryRaw<{ total: number }[]>`SELECT COUNT(*)::int AS total FROM (${docs}) d`,
    ]);
    const total = counted[0]?.total ?? 0;

    return paginated(PurchasedProductDocumentResponseSchema).parse({
      items: rows.map((row) => ClientsMapper.toPurchasedProductDocumentDto(row)),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }
}
