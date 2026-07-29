import type { Prisma } from '@prisma/client';
import type {
  AddCartItemCommand,
  AdminClientDto,
  AdminClientListQuery,
  AdminClientOverviewDto,
  AdminUpdateClientCommand,
  ApproveClientCommand,
  CartItemDto,
  ChangeMyPasswordCommand,
  ClientMeDto,
  ClientsEvents,
  ClientStatsDto,
  CreatePosClientCommand,
  JWTPayload,
  PaginatedResult,
  PosClientDto,
  PosClientListQuery,
  PosClientSearchQuery,
  ProductWithPricingDto,
  RegisterClientCommand,
  RejectClientCommand,
  ResetClientPasswordCommand,
  UpdateMeCommand,
  UpdatePosClientCommand,
  ValidatePhoneResultDto,
} from '@dragon-telecom/contract';

// `undefined` = guest — mirrors catalog's Viewer alias exactly (getCart's product-pricing
// resolution needs the same shape catalog's own price matrix branches on).
export type Viewer = JWTPayload | undefined;

export interface IClientsService {
  // Web identity (public + client)
  validatePhone(phone: string): Promise<ValidatePhoneResultDto>;
  register(cmd: RegisterClientCommand): Promise<{ id: string }>;
  getMe(clientId: string): Promise<ClientMeDto>;
  updateMe(clientId: string, cmd: UpdateMeCommand): Promise<ClientMeDto>;
  changeMyPassword(clientId: string, cmd: ChangeMyPasswordCommand): Promise<void>;

  // Cart (client) — favorites, no quantity
  getCart(clientId: string, viewer: Viewer): Promise<CartItemDto[]>;
  addCartItem(clientId: string, cmd: AddCartItemCommand): Promise<void>;
  removeCartItem(clientId: string, productId: string): Promise<void>;

  // Admin client pipeline
  listClients(query: AdminClientListQuery): Promise<PaginatedResult<AdminClientDto>>;
  clientStats(): Promise<ClientStatsDto>;
  getClient(id: string): Promise<AdminClientDto>;
  getClientOverview(id: string): Promise<AdminClientOverviewDto>;
  approveClient(id: string, cmd: ApproveClientCommand, staffId: string): Promise<AdminClientDto>;
  // No staffId param — `Client` has no rejectedBy column (schema.prisma stores only
  // `rejectionReason`, unlike `approvedByStaffId` for approve).
  rejectClient(id: string, cmd: RejectClientCommand): Promise<AdminClientDto>;
  resetClientPassword(id: string, cmd: ResetClientPasswordCommand): Promise<void>;
  adminUpdateClient(id: string, cmd: AdminUpdateClientCommand): Promise<AdminClientDto>;

  // POS clients
  searchPosClients(query: PosClientSearchQuery): Promise<PosClientDto[]>;
  quickCreatePosClient(cmd: CreatePosClientCommand): Promise<PosClientDto>;
  listPosClients(query: PosClientListQuery): Promise<PaginatedResult<PosClientDto>>;
  createPosClient(cmd: CreatePosClientCommand): Promise<PosClientDto>;
  updatePosClient(id: string, cmd: UpdatePosClientCommand): Promise<PosClientDto>;

  // Internal — invoked only by this module's own listener (post-commit), never by HTTP routes.
  // Payload types are the contract's own event shapes (not another module's *service*
  // interface) — importing them keeps these signatures in lockstep with whatever
  // sales/orders/billing actually emit, with zero duplicated shape declarations.
  materializePosClientForApprovedClient(
    clientId: string,
    posClientSeed: ClientsEvents['client.approved']['posClientSeed'],
  ): Promise<void>;
}

// Injected port (dependency inversion, plan §I.5) — real implementation lives in catalog
// (`CatalogProductService.getCartProducts`, Sprint 1), assembled in modules/index.ts. Narrowed
// to only what getCart needs, not catalog's whole HTTP-facing surface — mirrors inventory's
// `ICatalogPricingPort` precedent (consumer declares the shape it needs; the provider
// satisfies it structurally, no `implements` clause on the catalog side).
export interface ICatalogCartPort {
  getCartProducts(productIds: string[], viewer: Viewer): Promise<ProductWithPricingDto[]>;
}

// Injected port (dependency inversion, plan §C-1) — real implementation is identity's own
// composition-root singleton (`identityService`, exported from identity.routes.ts Sprint 1),
// assembled in modules/index.ts. Narrowed to the two methods approve/reset actually need, not
// identity's whole surface (listUsers/roles/technicians/... are none of clients' business).
//
// `changeMyPassword`'s "verify currentPassword" step does NOT go through this port: it reads
// the linked `User.passwordHash` directly via the shared `prisma` singleton (the same precedent
// identity's own `resolveLoginUser` uses to read `Client` rows across the module boundary) and
// compares it with the shared `@common/utils/password.utils` — both are genuinely common
// infrastructure (rules §1), not identity-owned internals. Only the state-changing write
// (new hash + refresh-token revocation) goes through `resetPassword` below.
export interface IIdentityProvisioningPort {
  provisionClientUser(
    input: { username: string; password: string },
    tx: Prisma.TransactionClient,
  ): Promise<{ userId: string }>;
  resetPassword(userId: string, newPassword: string, tx?: Prisma.TransactionClient): Promise<void>;
}
