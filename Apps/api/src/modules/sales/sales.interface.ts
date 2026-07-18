import type {
  ConfirmSaleCommand,
  CreateReturnCommand,
  JWTPayload,
  PaginatedResult,
  ReceiptDto,
  RepairsEvents,
  SaleDraftCommand,
  SaleDto,
  SaleListQuery,
  UpdateSaleDraftCommand,
} from '@dragon-telecom/contract';

export interface ISalesService {
  createDraft(cmd: SaleDraftCommand, staffId: string): Promise<SaleDto>;
  updateDraft(id: string, cmd: UpdateSaleDraftCommand, actor: JWTPayload): Promise<SaleDto>;
  // The transaction (spec BL#2) — returns the printed receipt, built from the committed
  // snapshot; `getSale` is the richer read-back afterward.
  confirm(id: string, cmd: ConfirmSaleCommand, actor: JWTPayload): Promise<ReceiptDto>;
  listStaffSales(query: SaleListQuery, staffId: string): Promise<PaginatedResult<SaleDto>>;
  listAdminSales(query: SaleListQuery): Promise<PaginatedResult<SaleDto>>;
  getSale(reference: string, actor: JWTPayload): Promise<SaleDto>;
  createReturn(cmd: CreateReturnCommand, staffId: string): Promise<SaleDto>;

  // Internal — invoked only by this module's own listener (post-commit), never by HTTP routes.
  recordRepairSale(payload: RepairsEvents['repair.pickedUp']): Promise<void>;
}

// Injected port (dependency inversion, plan §C-2/§I.2) — real implementation lives in catalog
// (`CatalogProductService.resolvePosPrices`, Sprint 1), assembled directly in
// `sales.routes.ts` (one-directional dependency, no adapter — the same shape purchasing's own
// `ICatalogRepricePort` established). Signature mirrors catalog's real method exactly (name
// included) so structural typing needs no shim. `resolvedPrice` is optional: `defaultSalePrice`
// is genuinely nullable, so an unresolved price is a real state, not an error catalog raises —
// `confirm` (Sprint 3) must treat a missing `resolvedPrice` as its own domain error.
export interface ICatalogPosPricingPort {
  resolvePosPrices(
    productIds: string[],
    categoryId: string | null,
  ): Promise<{ productId: string; productName: string; resolvedPrice?: number }[]>;
}
