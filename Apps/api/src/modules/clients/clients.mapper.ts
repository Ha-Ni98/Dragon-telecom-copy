import type { Client, ClientCategory, Commune, PosClient, Prisma, User, Wilaya } from '@prisma/client';
import {
  AdminClientOverviewResponseSchema,
  AdminClientResponseSchema,
  CartItemResponseSchema,
  ClientMeResponseSchema,
  ClientStatsResponseSchema,
  PosClientResponseSchema,
  ValidatePhoneResultResponseSchema,
  type AdminClientDto,
  type AdminClientOverviewDto,
  type CartItemDto,
  type ClientMeDto,
  type ClientStatsDto,
  type ClientStatus,
  type PhoneAvailability,
  type PosClientDto,
  type ProductWithPricingDto,
  type ValidatePhoneResultDto,
} from '@dragon-telecom/contract';

type Money = Prisma.Decimal | number;

export type ClientMeRow = Client & {
  posClient: Pick<PosClient, 'credit' | 'totalPaid' | 'totalSold'> | null;
};

export type AdminClientRow = Client & {
  wilaya: Pick<Wilaya, 'frName'>;
  commune: Pick<Commune, 'frName'>;
  user: Pick<User, 'username'> | null;
  posClient: (Pick<PosClient, 'id'> & { category: Pick<ClientCategory, 'name'> | null }) | null;
};
// Order/Sale roll-ups aren't relations Prisma can include here — sales/orders are future
// modules (plan §I.3 #7) — so the caller aggregates them separately and passes the result in.
export type AdminClientRollups = { totalOrders: number; totalSpent: number; lastOrderDate?: Date };

export type PosClientRow = PosClient & {
  category: Pick<ClientCategory, 'name'> | null;
  linkedClient: Pick<Client, 'id'> | null;
};

export type ClientStatsCounts = {
  totalClients: number;
  pending: number;
  approved: number;
  rejected: number;
  newThisMonth: number;
};

// S8 J4/J2 — the client-detail Overview tab and the clients-list record-payment preview. Money
// figures are already-resolved numbers (or Decimal) read straight off PosClient by the service —
// this mapper never re-derives them (D5: the ledger is the source of truth for totalPaid).
export type AdminClientOverviewInput = {
  clientId: string;
  posClientId?: string | null;
  credit: Money;
  totalPaid: Money;
  totalSold: Money;
  orderCount: number;
  totalProductQuantity: number;
};

export class ClientsMapper {
  // The phone-shape/registration lookup that produces isValid/status is business logic (the
  // service's job — see IClientsService.validatePhone); this only shapes + schema-guards the
  // already-computed result.
  static toValidatePhoneDto(isValid: boolean, status: PhoneAvailability): ValidatePhoneResultDto {
    const dto: ValidatePhoneResultDto = { isValid, status };
    return ValidatePhoneResultResponseSchema.parse(dto);
  }

  // NO category, NO raw status (spec) — money proxied from the linked PosClient, 0 when none
  // (still PENDING — no PosClient materialized until approval).
  static toClientMeDto(client: ClientMeRow): ClientMeDto {
    const dto: ClientMeDto = {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      ...(client.email != null ? { email: client.email } : {}),
      ...(client.storeName != null ? { storeName: client.storeName } : {}),
      wilayaId: client.wilayaId,
      communeId: client.communeId,
      ...(client.address != null ? { address: client.address } : {}),
      createdAt: client.createdAt.toISOString(),
      credit: client.posClient ? ClientsMapper.toMoney(client.posClient.credit) : 0,
      totalPaid: client.posClient ? ClientsMapper.toMoney(client.posClient.totalPaid) : 0,
      totalSold: client.posClient ? ClientsMapper.toMoney(client.posClient.totalSold) : 0,
    };
    return ClientMeResponseSchema.parse(dto);
  }

  static toAdminClientDto(client: AdminClientRow, rollups: AdminClientRollups): AdminClientDto {
    const dto: AdminClientDto = {
      id: client.id,
      code: client.code,
      fullName: `${client.firstName} ${client.lastName}`,
      ...(client.storeName != null ? { storeName: client.storeName } : {}),
      ...(client.user?.username != null ? { username: client.user.username } : {}),
      phone: client.phone,
      ...(client.email != null ? { email: client.email } : {}),
      wilayaFr: client.wilaya.frName,
      communeFr: client.commune.frName,
      ...(client.posClient?.category?.name != null ? { categoryName: client.posClient.category.name } : {}),
      // Prisma's generated $Enums.ClientStatus and the contract's ClientStatus are distinct
      // nominal types with identical string values (schema.prisma's own invariant).
      status: client.status as ClientStatus,
      isEnabled: client.isEnabled,
      totalOrders: rollups.totalOrders,
      totalSpent: rollups.totalSpent,
      ...(rollups.lastOrderDate != null ? { lastOrderDate: rollups.lastOrderDate.toISOString() } : {}),
      ...(client.posClientId != null ? { posClientId: client.posClientId } : {}),
      createdAt: client.createdAt.toISOString(),
    };
    return AdminClientResponseSchema.parse(dto);
  }

  static toPosClientDto(posClient: PosClientRow): PosClientDto {
    const dto: PosClientDto = {
      id: posClient.id,
      code: posClient.code,
      name: posClient.name,
      ...(posClient.phone != null ? { phone: posClient.phone } : {}),
      ...(posClient.categoryId != null ? { categoryId: posClient.categoryId } : {}),
      ...(posClient.category?.name != null ? { categoryName: posClient.category.name } : {}),
      credit: ClientsMapper.toMoney(posClient.credit),
      totalPaid: ClientsMapper.toMoney(posClient.totalPaid),
      totalSold: ClientsMapper.toMoney(posClient.totalSold),
      ...(posClient.linkedClient != null ? { linkedClientId: posClient.linkedClient.id } : {}),
      isEnabled: posClient.isEnabled,
    };
    return PosClientResponseSchema.parse(dto);
  }

  // `product` is supplied pre-resolved (catalog's cart-pricing read port, injected — plan §I.5)
  // — never rebuilt here; the mapper only assembles the cart-row half.
  static toCartItemDto(cartItem: { productId: string; addedAt: Date }, product: ProductWithPricingDto): CartItemDto {
    const dto: CartItemDto = {
      productId: cartItem.productId,
      addedAt: cartItem.addedAt.toISOString(),
      product,
    };
    return CartItemResponseSchema.parse(dto);
  }

  static toClientStatsDto(counts: ClientStatsCounts): ClientStatsDto {
    return ClientStatsResponseSchema.parse(counts);
  }

  static toAdminClientOverviewDto(input: AdminClientOverviewInput): AdminClientOverviewDto {
    const dto: AdminClientOverviewDto = {
      clientId: input.clientId,
      ...(input.posClientId != null ? { posClientId: input.posClientId } : {}),
      totalSold: ClientsMapper.toMoney(input.totalSold),
      totalPaid: ClientsMapper.toMoney(input.totalPaid),
      credit: ClientsMapper.toMoney(input.credit),
      orderCount: input.orderCount,
      totalProductQuantity: input.totalProductQuantity,
    };
    return AdminClientOverviewResponseSchema.parse(dto);
  }

  private static toMoney(value: Money): number {
    return typeof value === 'number' ? value : value.toNumber();
  }
}
