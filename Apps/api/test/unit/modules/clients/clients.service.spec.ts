import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma, ClientStatus as PrismaClientStatus } from '@prisma/client';
import {
  DocType,
  ErrorCode,
  PhoneAvailability,
  type ProductWithPricingDto,
} from '@dragon-telecom/contract';
import type { AppError } from '../../../../src/common/errors';
import { ClientsService } from '../../../../src/modules/clients/clients.service';
import type { ICatalogCartPort, IIdentityProvisioningPort } from '../../../../src/modules/clients/clients.interface';

const {
  clientFindUniqueMock,
  clientFindManyMock,
  clientCountMock,
  clientCreateMock,
  clientUpdateMock,
  posClientFindUniqueMock,
  posClientFindUniqueOrThrowMock,
  posClientFindManyMock,
  posClientCountMock,
  posClientCreateMock,
  posClientUpdateMock,
  wilayaFindUniqueMock,
  communeFindUniqueMock,
  userFindUniqueMock,
  clientCartFindManyMock,
  clientCartUpsertMock,
  clientCartDeleteManyMock,
  orderAggregateMock,
  saleAggregateMock,
  queryRawMock,
  transactionMock,
  eventBusEmitMock,
  comparePasswordMock,
} = vi.hoisted(() => ({
  clientFindUniqueMock: vi.fn(),
  clientFindManyMock: vi.fn(),
  clientCountMock: vi.fn(),
  clientCreateMock: vi.fn(),
  clientUpdateMock: vi.fn(),
  posClientFindUniqueMock: vi.fn(),
  posClientFindUniqueOrThrowMock: vi.fn(),
  posClientFindManyMock: vi.fn(),
  posClientCountMock: vi.fn(),
  posClientCreateMock: vi.fn(),
  posClientUpdateMock: vi.fn(),
  wilayaFindUniqueMock: vi.fn(),
  communeFindUniqueMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  clientCartFindManyMock: vi.fn(),
  clientCartUpsertMock: vi.fn(),
  clientCartDeleteManyMock: vi.fn(),
  orderAggregateMock: vi.fn(),
  saleAggregateMock: vi.fn(),
  queryRawMock: vi.fn(),
  transactionMock: vi.fn(),
  eventBusEmitMock: vi.fn(),
  comparePasswordMock: vi.fn(),
}));

vi.mock('@common/events/event-bus', () => ({ eventBus: { emit: eventBusEmitMock } }));
vi.mock('@common/utils/password.utils', () => ({ comparePassword: comparePasswordMock, hashPassword: vi.fn() }));

const prismaMock = {
  client: {
    findUnique: clientFindUniqueMock,
    findMany: clientFindManyMock,
    count: clientCountMock,
    create: clientCreateMock,
    update: clientUpdateMock,
  },
  posClient: {
    findUnique: posClientFindUniqueMock,
    findUniqueOrThrow: posClientFindUniqueOrThrowMock,
    findMany: posClientFindManyMock,
    count: posClientCountMock,
    create: posClientCreateMock,
    update: posClientUpdateMock,
  },
  wilaya: { findUnique: wilayaFindUniqueMock },
  commune: { findUnique: communeFindUniqueMock },
  user: { findUnique: userFindUniqueMock },
  clientCart: {
    findMany: clientCartFindManyMock,
    upsert: clientCartUpsertMock,
    deleteMany: clientCartDeleteManyMock,
  },
  order: { aggregate: orderAggregateMock },
  sale: { aggregate: saleAggregateMock },
  $queryRaw: queryRawMock,
  $transaction: transactionMock,
};

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const WILAYA_ID = '22222222-2222-4222-8222-222222222222';
const COMMUNE_ID = '33333333-3333-4333-8333-333333333333';
const POS_CLIENT_ID = '44444444-4444-4444-8444-444444444444';
const CATEGORY_ID = '55555555-5555-4555-8555-555555555555';
const USER_ID = '66666666-6666-4666-8666-666666666666';
const PRODUCT_ID = '77777777-7777-4777-8777-777777777777';
const STAFF_ID = '88888888-8888-4888-8888-888888888888';

const prismaKnownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('mock prisma error', { code, clientVersion: '6.19.3' });

const buildClientRow = (overrides: Record<string, unknown> = {}) => ({
  id: CLIENT_ID,
  userId: null,
  code: 'CLI-ABC12345',
  firstName: 'John',
  lastName: 'Doe',
  storeName: null,
  phone: '0550000000',
  email: null,
  wilayaId: WILAYA_ID,
  communeId: COMMUNE_ID,
  address: null,
  status: PrismaClientStatus.PENDING,
  approvedAt: null,
  approvedByStaffId: null,
  rejectionReason: null,
  posClientId: null,
  isEnabled: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  wilaya: { frName: 'Alger' },
  commune: { frName: 'Bab El Oued' },
  user: null,
  posClient: null,
  ...overrides,
});

const buildPosClientRow = (overrides: Record<string, unknown> = {}) => ({
  id: POS_CLIENT_ID,
  code: 'POS-ABC12345',
  name: 'John Doe',
  phone: null,
  categoryId: null,
  credit: new Prisma.Decimal(0),
  totalPaid: new Prisma.Decimal(0),
  totalSold: new Prisma.Decimal(0),
  isEnabled: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  category: null,
  linkedClient: null,
  ...overrides,
});

const buildProductWithPricing = (overrides: Partial<ProductWithPricingDto> = {}): ProductWithPricingDto => ({
  id: PRODUCT_ID,
  name: 'Screen Protector',
  createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  brand: { id: '99999999-9999-4999-8999-999999999999', name: 'Samsung' },
  family: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Screens' },
  images: [],
  priceHidden: false,
  inStock: true,
  inCart: true,
  ...overrides,
});

describe('ClientsService', () => {
  const identityMock: IIdentityProvisioningPort = { provisionClientUser: vi.fn(), resetPassword: vi.fn() };
  const sequenceMock = { nextNumber: vi.fn() };
  const catalogCartMock: ICatalogCartPort = { getCartProducts: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
    orderAggregateMock.mockResolvedValue({ _count: 0, _sum: { totalAmount: null }, _max: { placedAt: null } });
    saleAggregateMock.mockResolvedValue({ _sum: { totalAmount: null } });
    queryRawMock.mockResolvedValue([{ id: POS_CLIENT_ID }]);
  });

  const service = () => new ClientsService(prismaMock as never, identityMock, sequenceMock as never, catalogCartMock);

  const expectRejection = async (promise: Promise<unknown>): Promise<AppError> => {
    try {
      await promise;
    } catch (err) {
      return err as AppError;
    }
    throw new Error('Expected promise to reject');
  };

  describe('validatePhone', () => {
    it('reports available when no client owns the phone', async () => {
      clientFindUniqueMock.mockResolvedValueOnce(null);
      const dto = await service().validatePhone('0550000000');
      expect(dto).toEqual({ isValid: true, status: PhoneAvailability.AVAILABLE });
    });

    it('reports registered for an APPROVED client', async () => {
      clientFindUniqueMock.mockResolvedValueOnce({ status: PrismaClientStatus.APPROVED });
      const dto = await service().validatePhone('0550000000');
      expect(dto).toEqual({ isValid: false, status: PhoneAvailability.REGISTERED });
    });

    it('reports pending for a PENDING client', async () => {
      clientFindUniqueMock.mockResolvedValueOnce({ status: PrismaClientStatus.PENDING });
      const dto = await service().validatePhone('0550000000');
      expect(dto).toEqual({ isValid: false, status: PhoneAvailability.PENDING });
    });

    it('reports available again for a REJECTED client (may retry)', async () => {
      clientFindUniqueMock.mockResolvedValueOnce({ status: PrismaClientStatus.REJECTED });
      const dto = await service().validatePhone('0550000000');
      expect(dto).toEqual({ isValid: true, status: PhoneAvailability.AVAILABLE });
    });
  });

  describe('register', () => {
    const cmd = {
      firstName: 'John',
      lastName: 'Doe',
      phone: '0550000000',
      wilayaId: WILAYA_ID,
      communeId: COMMUNE_ID,
    };

    it('creates a PENDING client with no user and emits client.registered', async () => {
      clientFindUniqueMock.mockResolvedValueOnce(null);
      wilayaFindUniqueMock.mockResolvedValueOnce({ id: WILAYA_ID });
      communeFindUniqueMock.mockResolvedValueOnce({ id: COMMUNE_ID, wilayaId: WILAYA_ID });
      sequenceMock.nextNumber.mockResolvedValueOnce('CLI-2026-0001');
      clientCreateMock.mockResolvedValueOnce({ id: CLIENT_ID });

      const result = await service().register(cmd);

      expect(clientCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: PrismaClientStatus.PENDING, code: 'CLI-2026-0001' }) }),
      );
      expect(sequenceMock.nextNumber).toHaveBeenCalledWith(prismaMock, DocType.CLIENT);
      expect(eventBusEmitMock).toHaveBeenCalledWith('client.registered', { clientId: CLIENT_ID });
      expect(result).toEqual({ id: CLIENT_ID });
    });

    it('409s with a status-specific message when the phone is already registered', async () => {
      clientFindUniqueMock.mockResolvedValueOnce({ status: PrismaClientStatus.APPROVED });

      const err = await expectRejection(service().register(cmd));

      expect(err.statusCode).toBe(409);
      expect(err.message).toMatch(/already registered/i);
      expect(clientCreateMock).not.toHaveBeenCalled();
    });

    it('409s with a status-specific message when a registration is already pending', async () => {
      clientFindUniqueMock.mockResolvedValueOnce({ status: PrismaClientStatus.PENDING });

      const err = await expectRejection(service().register(cmd));

      expect(err.statusCode).toBe(409);
      expect(err.message).toMatch(/already pending/i);
    });

    it('400s on an unknown wilayaId', async () => {
      clientFindUniqueMock.mockResolvedValueOnce(null);
      wilayaFindUniqueMock.mockResolvedValueOnce(null);
      communeFindUniqueMock.mockResolvedValueOnce({ id: COMMUNE_ID, wilayaId: WILAYA_ID });

      const err = await expectRejection(service().register(cmd));

      expect(err.statusCode).toBe(400);
      expect(clientCreateMock).not.toHaveBeenCalled();
    });

    it('400s when the commune does not belong to the given wilaya', async () => {
      clientFindUniqueMock.mockResolvedValueOnce(null);
      wilayaFindUniqueMock.mockResolvedValueOnce({ id: WILAYA_ID });
      communeFindUniqueMock.mockResolvedValueOnce({ id: COMMUNE_ID, wilayaId: 'some-other-wilaya' });

      const err = await expectRejection(service().register(cmd));

      expect(err.statusCode).toBe(400);
    });
  });

  describe('getMe / updateMe', () => {
    it('proxies money from the linked PosClient', async () => {
      clientFindUniqueMock.mockResolvedValueOnce(
        buildClientRow({ posClient: { credit: new Prisma.Decimal(500), totalPaid: new Prisma.Decimal(1000), totalSold: new Prisma.Decimal(1500) } }),
      );

      const dto = await service().getMe(CLIENT_ID);

      expect(dto.credit).toBe(500);
    });

    it('404s when the client does not exist', async () => {
      clientFindUniqueMock.mockResolvedValueOnce(null);
      const err = await expectRejection(service().getMe(CLIENT_ID));
      expect(err.statusCode).toBe(404);
    });

    it('never writes phone — UpdateMeCommand carries no phone field to begin with', async () => {
      clientFindUniqueMock.mockResolvedValueOnce(buildClientRow());

      await service().updateMe(CLIENT_ID, { storeName: 'New name' });

      expect(clientUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.not.objectContaining({ phone: expect.anything() }) }),
      );
    });

    it('maps a vanished client (P2025) to a NotFoundError', async () => {
      clientUpdateMock.mockRejectedValueOnce(prismaKnownError('P2025'));

      const err = await expectRejection(service().updateMe(CLIENT_ID, { storeName: 'New name' }));

      expect(err.statusCode).toBe(404);
    });

    it('re-validates wilaya/commune when either is changed', async () => {
      clientFindUniqueMock.mockResolvedValueOnce(buildClientRow());
      wilayaFindUniqueMock.mockResolvedValueOnce(null);

      const err = await expectRejection(service().updateMe(CLIENT_ID, { wilayaId: 'unknown-wilaya' }));

      expect(err.statusCode).toBe(400);
      expect(clientUpdateMock).not.toHaveBeenCalled();
    });
  });

  describe('changeMyPassword', () => {
    const cmd = { currentPassword: 'OldPass123!', newPassword: 'NewPass123!' };

    it('409s when the client has no linked user (not yet approved)', async () => {
      clientFindUniqueMock.mockResolvedValueOnce({ userId: null });

      const err = await expectRejection(service().changeMyPassword(CLIENT_ID, cmd));

      expect(err.statusCode).toBe(409);
    });

    it('401s on a wrong current password', async () => {
      clientFindUniqueMock.mockResolvedValueOnce({ userId: USER_ID });
      userFindUniqueMock.mockResolvedValueOnce({ passwordHash: 'hash' });
      comparePasswordMock.mockResolvedValueOnce(false);

      const err = await expectRejection(service().changeMyPassword(CLIENT_ID, cmd));

      expect(err.statusCode).toBe(401);
      expect(err.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
      expect(identityMock.resetPassword).not.toHaveBeenCalled();
    });

    it('resets the password through identity and emits client.passwordReset on success', async () => {
      clientFindUniqueMock.mockResolvedValueOnce({ userId: USER_ID });
      userFindUniqueMock.mockResolvedValueOnce({ passwordHash: 'hash' });
      comparePasswordMock.mockResolvedValueOnce(true);

      await service().changeMyPassword(CLIENT_ID, cmd);

      expect(identityMock.resetPassword).toHaveBeenCalledWith(USER_ID, 'NewPass123!');
      expect(eventBusEmitMock).toHaveBeenCalledWith('client.passwordReset', { clientId: CLIENT_ID });
    });
  });

  describe('cart', () => {
    it('getCart resolves cart rows via the injected catalog port and skips unresolved products', async () => {
      clientCartFindManyMock.mockResolvedValueOnce([
        { productId: PRODUCT_ID, addedAt: new Date('2026-01-01T00:00:00.000Z') },
        { productId: 'missing-product', addedAt: new Date('2026-01-02T00:00:00.000Z') },
      ]);
      (catalogCartMock.getCartProducts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([buildProductWithPricing()]);

      const items = await service().getCart(CLIENT_ID, undefined);

      expect(items).toHaveLength(1);
      expect(items[0]?.productId).toBe(PRODUCT_ID);
    });

    it('getCart short-circuits with [] when the cart is empty (no catalog call)', async () => {
      clientCartFindManyMock.mockResolvedValueOnce([]);
      const items = await service().getCart(CLIENT_ID, undefined);
      expect(items).toEqual([]);
      expect(catalogCartMock.getCartProducts).not.toHaveBeenCalled();
    });

    it('addCartItem upserts — idempotent on a repeat add', async () => {
      await service().addCartItem(CLIENT_ID, { productId: PRODUCT_ID });
      expect(clientCartUpsertMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clientId_productId: { clientId: CLIENT_ID, productId: PRODUCT_ID } } }),
      );
    });

    it('removeCartItem deletes via deleteMany — idempotent when already absent', async () => {
      clientCartDeleteManyMock.mockResolvedValueOnce({ count: 0 });
      await expect(service().removeCartItem(CLIENT_ID, PRODUCT_ID)).resolves.toBeUndefined();
    });
  });

  describe('approveClient', () => {
    const cmd = { username: 'johndoe', password: 'Password123!', categoryId: CATEGORY_ID };

    it('provisions the identity user inside one transaction and emits client.approved', async () => {
      clientFindUniqueMock.mockResolvedValueOnce(buildClientRow({ status: PrismaClientStatus.PENDING }));
      (identityMock.provisionClientUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: USER_ID });
      clientFindUniqueMock.mockResolvedValueOnce(buildClientRow({ status: PrismaClientStatus.APPROVED, userId: USER_ID }));

      const dto = await service().approveClient(CLIENT_ID, cmd, STAFF_ID);

      expect(identityMock.provisionClientUser).toHaveBeenCalledWith({ username: 'johndoe', password: 'Password123!' }, prismaMock);
      expect(clientUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PrismaClientStatus.APPROVED, approvedByStaffId: STAFF_ID, userId: USER_ID }),
        }),
      );
      expect(eventBusEmitMock).toHaveBeenCalledWith('client.approved', {
        clientId: CLIENT_ID,
        posClientSeed: { name: 'John Doe', phone: '0550000000', categoryId: CATEGORY_ID },
      });
      expect(dto.status).toBe('APPROVED');
    });

    it('409s when the client is not PENDING', async () => {
      clientFindUniqueMock.mockResolvedValueOnce(buildClientRow({ status: PrismaClientStatus.APPROVED }));

      const err = await expectRejection(service().approveClient(CLIENT_ID, cmd, STAFF_ID));

      expect(err.statusCode).toBe(409);
      expect(identityMock.provisionClientUser).not.toHaveBeenCalled();
    });

    it('404s when the client does not exist', async () => {
      clientFindUniqueMock.mockResolvedValueOnce(null);
      const err = await expectRejection(service().approveClient(CLIENT_ID, cmd, STAFF_ID));
      expect(err.statusCode).toBe(404);
    });
  });

  describe('rejectClient', () => {
    it('409s when the client is not PENDING', async () => {
      clientFindUniqueMock.mockResolvedValueOnce(buildClientRow({ status: PrismaClientStatus.REJECTED }));
      const err = await expectRejection(service().rejectClient(CLIENT_ID, {}));
      expect(err.statusCode).toBe(409);
    });

    it('rejects a PENDING client and emits client.rejected', async () => {
      clientFindUniqueMock.mockResolvedValueOnce(buildClientRow({ status: PrismaClientStatus.PENDING }));
      clientFindUniqueMock.mockResolvedValueOnce(buildClientRow({ status: PrismaClientStatus.REJECTED }));

      await service().rejectClient(CLIENT_ID, { reason: 'Duplicate account' });

      expect(clientUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: PrismaClientStatus.REJECTED, rejectionReason: 'Duplicate account' }) }),
      );
      expect(eventBusEmitMock).toHaveBeenCalledWith('client.rejected', { clientId: CLIENT_ID, reason: 'Duplicate account' });
    });
  });

  describe('resetClientPassword', () => {
    it('409s when the client has no linked user', async () => {
      clientFindUniqueMock.mockResolvedValueOnce({ userId: null });
      const err = await expectRejection(service().resetClientPassword(CLIENT_ID, { newPassword: 'NewPass123!' }));
      expect(err.statusCode).toBe(409);
    });

    it('resets via identity and emits client.passwordReset', async () => {
      clientFindUniqueMock.mockResolvedValueOnce({ userId: USER_ID });

      await service().resetClientPassword(CLIENT_ID, { newPassword: 'NewPass123!' });

      expect(identityMock.resetPassword).toHaveBeenCalledWith(USER_ID, 'NewPass123!');
      expect(eventBusEmitMock).toHaveBeenCalledWith('client.passwordReset', { clientId: CLIENT_ID });
    });
  });

  describe('PosClient create/quick-create', () => {
    it('allocates a code via the sequence and creates the row inside one transaction', async () => {
      sequenceMock.nextNumber.mockResolvedValueOnce('POS-2026-0001');
      posClientCreateMock.mockResolvedValueOnce(buildPosClientRow({ code: 'POS-2026-0001' }));

      const dto = await service().createPosClient({ name: 'Jane Shop' });

      expect(sequenceMock.nextNumber).toHaveBeenCalledWith(prismaMock, DocType.POS_CLIENT);
      expect(dto.code).toBe('POS-2026-0001');
      expect(eventBusEmitMock).not.toHaveBeenCalled();
    });

    it('emits posClient.creditChanged when an initialCredit is given', async () => {
      sequenceMock.nextNumber.mockResolvedValueOnce('POS-2026-0002');
      posClientCreateMock.mockResolvedValueOnce(buildPosClientRow({ credit: new Prisma.Decimal(2000) }));

      await service().quickCreatePosClient({ name: 'Jane Shop', initialCredit: 2000 });

      expect(eventBusEmitMock).toHaveBeenCalledWith('posClient.creditChanged', {
        posClientId: POS_CLIENT_ID,
        previousCredit: 0,
        newCredit: 2000,
        cause: 'Initial credit',
      });
    });
  });

  describe('listener-invoked cache handlers', () => {
    it('materializePosClientForApprovedClient is idempotent when posClientId is already set', async () => {
      clientFindUniqueMock.mockResolvedValueOnce({ posClientId: POS_CLIENT_ID });

      await service().materializePosClientForApprovedClient(CLIENT_ID, { name: 'John Doe', categoryId: CATEGORY_ID });

      expect(posClientCreateMock).not.toHaveBeenCalled();
    });

    it('materializePosClientForApprovedClient creates the PosClient and links it', async () => {
      clientFindUniqueMock.mockResolvedValueOnce({ posClientId: null });
      sequenceMock.nextNumber.mockResolvedValueOnce('POS-2026-0003');
      posClientCreateMock.mockResolvedValueOnce({ id: POS_CLIENT_ID });

      await service().materializePosClientForApprovedClient(CLIENT_ID, { name: 'John Doe', categoryId: CATEGORY_ID });

      expect(clientUpdateMock).toHaveBeenCalledWith({ where: { id: CLIENT_ID }, data: { posClientId: POS_CLIENT_ID } });
    });
  });

  describe('injected credit port (credit-serialization fix, plan §C2)', () => {
    it('applySaleCharge: credit += (totalAmount - paidAmount), totalPaid/totalSold increment', async () => {
      posClientFindUniqueOrThrowMock.mockResolvedValueOnce(buildPosClientRow({ credit: new Prisma.Decimal(0) }));

      const result = await service().applySaleCharge(prismaMock as never, POS_CLIENT_ID, { totalAmount: 1000, paidAmount: 800 });

      expect(result).toEqual({ previousCredit: 0, newCredit: 200 });
      expect(posClientUpdateMock).toHaveBeenCalledWith({
        where: { id: POS_CLIENT_ID },
        data: { credit: 200, totalPaid: { increment: 800 }, totalSold: { increment: 1000 } },
      });
    });

    it('applySaleCharge: underpayment raises credit (client now owes more)', async () => {
      posClientFindUniqueOrThrowMock.mockResolvedValueOnce(buildPosClientRow({ credit: new Prisma.Decimal(100) }));

      const result = await service().applySaleCharge(prismaMock as never, POS_CLIENT_ID, { totalAmount: 1000, paidAmount: 0 });

      expect(result).toEqual({ previousCredit: 100, newCredit: 1100 });
    });

    it('applyPayment: credit -= amount, permits overpayment (negative credit — store owes)', async () => {
      posClientFindUniqueOrThrowMock.mockResolvedValueOnce(buildPosClientRow({ credit: new Prisma.Decimal(100) }));

      const result = await service().applyPayment(prismaMock as never, POS_CLIENT_ID, { amount: 500 });

      expect(result).toEqual({ previousCredit: 100, newCredit: -400 });
      expect(posClientUpdateMock).toHaveBeenCalledWith({
        where: { id: POS_CLIENT_ID },
        data: { credit: -400, totalPaid: { increment: 500 } },
      });
    });

    it('applyOrderSold: only increments totalSold, no credit change, no return value', async () => {
      posClientFindUniqueOrThrowMock.mockResolvedValueOnce(buildPosClientRow());

      const result = await service().applyOrderSold(prismaMock as never, POS_CLIENT_ID, { totalAmount: 500 });

      expect(result).toBeUndefined();
      expect(posClientUpdateMock).toHaveBeenCalledWith({ where: { id: POS_CLIENT_ID }, data: { totalSold: { increment: 500 } } });
      expect(posClientUpdateMock.mock.calls[0]?.[0]?.data).not.toHaveProperty('credit');
    });

    it('applyReturnRefund: newCredit = previousCredit + creditEffect (a negative refund reduces what the client owes)', async () => {
      posClientFindUniqueOrThrowMock.mockResolvedValueOnce(buildPosClientRow({ credit: new Prisma.Decimal(1000) }));

      const result = await service().applyReturnRefund(prismaMock as never, POS_CLIENT_ID, { creditEffect: -300 });

      expect(result).toEqual({ previousCredit: 1000, newCredit: 700 });
      expect(posClientUpdateMock).toHaveBeenCalledWith({ where: { id: POS_CLIENT_ID }, data: { credit: 700 } });
    });

    it('rejects an unknown posClientId with NotFoundError', async () => {
      queryRawMock.mockResolvedValueOnce([]);

      const err = await expectRejection(service().applyPayment(prismaMock as never, POS_CLIENT_ID, { amount: 100 }));

      expect(err.statusCode).toBe(404);
    });

    it('rejects a disabled posClientId with the same NotFoundError as unknown', async () => {
      posClientFindUniqueOrThrowMock.mockResolvedValueOnce(buildPosClientRow({ isEnabled: false }));

      const err = await expectRejection(service().applyPayment(prismaMock as never, POS_CLIENT_ID, { amount: 100 }));

      expect(err.statusCode).toBe(404);
    });

    it('two sequential calls: the second call\'s previousCredit equals the first call\'s newCredit (the property the old design violated)', async () => {
      posClientFindUniqueOrThrowMock.mockResolvedValueOnce(buildPosClientRow({ credit: new Prisma.Decimal(1000) }));
      const first = await service().applyPayment(prismaMock as never, POS_CLIENT_ID, { amount: 300 });

      posClientFindUniqueOrThrowMock.mockResolvedValueOnce(buildPosClientRow({ credit: new Prisma.Decimal(first.newCredit) }));
      const second = await service().applyPayment(prismaMock as never, POS_CLIENT_ID, { amount: 200 });

      expect(second.previousCredit).toBe(first.newCredit);
      expect(second.newCredit).toBe(500); // 1000 - 300 - 200
    });
  });
});
