import type { PrismaClient } from '@prisma/client';
import { Prisma, ClientStatus as PrismaClientStatus } from '@prisma/client';
import {
  AdminClientResponseSchema,
  DocType,
  ErrorCode,
  PhoneAvailability,
  PosClientResponseSchema,
  paginated,
  type AddCartItemCommand,
  type AdminClientDto,
  type AdminClientListQuery,
  type AdminUpdateClientCommand,
  type ApproveClientCommand,
  type BillingEvents,
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
    const [totalClients, pending, approved, rejected] = await this.prisma.$transaction([
      this.prisma.client.count(),
      this.prisma.client.count({ where: { status: PrismaClientStatus.PENDING } }),
      this.prisma.client.count({ where: { status: PrismaClientStatus.APPROVED } }),
      this.prisma.client.count({ where: { status: PrismaClientStatus.REJECTED } }),
    ]);
    return ClientsMapper.toClientStatsDto({ totalClients, pending, approved, rejected });
  }

  async getClient(id: string): Promise<AdminClientDto> {
    const client = await this.prisma.client.findUnique({ where: { id }, include: ADMIN_CLIENT_INCLUDE });
    if (!client) throw new NotFoundError('Client');
    return this.toAdminClientDtoWithRollups(client as AdminClientRow);
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

  async applyClientPaymentRecorded(payload: BillingEvents['payment.clientRecorded']): Promise<void> {
    await this.prisma.posClient.update({
      where: { id: payload.posClientId },
      data: { credit: payload.newCredit, totalPaid: { increment: payload.amount } },
    });
  }

  // --- Injected credit port (credit-serialization fix, plan §C2) ---
  //
  // PosClient belongs to this module — sales/orders/billing must not write it directly; each
  // consumes these methods as an injected port (structural typing, the established
  // ICatalogCartPort precedent: the consumer declares its own narrowed interface locally,
  // `ClientsService` satisfies it by having the matching methods, no `implements` clause here).
  // Every method locks the row for the duration of the CALLER's own transaction and writes the
  // new cache values in that same transaction — the numbers replicate exactly what the former
  // post-commit listener handlers above computed (do not diverge the math when those handlers
  // are deleted in C3–C5), only the read-lock-write now all happen atomically together instead
  // of racing a fire-and-forget event.

  async applySaleCharge(
    tx: Prisma.TransactionClient,
    posClientId: string,
    payload: { totalAmount: number; paidAmount: number },
  ): Promise<{ previousCredit: number; newCredit: number }> {
    const locked = await this.lockPosClient(tx, posClientId);
    const previousCredit = locked.credit.toNumber();
    const newCredit = previousCredit + (payload.totalAmount - payload.paidAmount);
    await tx.posClient.update({
      where: { id: posClientId },
      data: { credit: newCredit, totalPaid: { increment: payload.paidAmount }, totalSold: { increment: payload.totalAmount } },
    });
    return { previousCredit, newCredit };
  }

  async applyPayment(
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

  // Orders never touch credit (spec: "totalSold += totalAmount" only, for the linked POS
  // client when any).
  async applyOrderSold(tx: Prisma.TransactionClient, posClientId: string, payload: { totalAmount: number }): Promise<void> {
    await this.lockPosClient(tx, posClientId);
    await tx.posClient.update({
      where: { id: posClientId },
      data: { totalSold: { increment: payload.totalAmount } },
    });
  }

  // `creditEffect` is the caller's already-signed delta (a negative refund reduces what the
  // client owes) — sales' createReturn computes it the same way it always did; the only change
  // is a locked read first so the returned previousCredit/newCredit snapshot is consistent
  // under concurrency.
  async applyReturnRefund(
    tx: Prisma.TransactionClient,
    posClientId: string,
    payload: { creditEffect: number },
  ): Promise<{ previousCredit: number; newCredit: number }> {
    const locked = await this.lockPosClient(tx, posClientId);
    const previousCredit = locked.credit.toNumber();
    const newCredit = previousCredit + payload.creditEffect;
    await tx.posClient.update({ where: { id: posClientId }, data: { credit: newCredit } });
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
}
