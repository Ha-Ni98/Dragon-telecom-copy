// Platform domain (wilayas/delivery-fees/settings) — Sub-02, contract-typed, HTTP-wired
// (integration plan.md §2.5). No Sub-01 stub existed under this file name; the pre-existing
// `checkout-delivery.service.ts` (getAvailableWilayas/getCommunesForWilaya/calculateDeliveryFee,
// consumed by DeliveryForm.tsx via use-delivery-fees.ts) and the delivery-fee/settings slice of
// `use-admin-settings.ts` (consumed by delivery-fees-section.tsx / admin-accounts-section.tsx)
// stay untouched — real page rewiring is Sub-03. Hook names below are deliberately prefixed
// (useAdminDeliveryFees, not useDeliveryFees) to avoid colliding with use-admin-settings.ts's
// own exports (discovered in Sprint 5 prep — see useCatalogTaxonomy.ts's header comment for the
// same class of collision found one sprint earlier).
import { api } from "@/lib/axios";
import { apiPath } from "@/lib/api-path";
import {
  PLATFORM_ROUTES,
  type ApiResponse,
  type WilayaDto,
  type FeeQuery,
  type FeeDto,
  type AdminFeesDto,
  type UpsertFeesCommand,
  type FeesExportQuery,
  type SettingsDto,
  type UpdateSettingsCommand,
  type PublicSettingsDto,
} from "@dragon-telecom/contract";

// Not exported from @dragon-telecom/contract — Apps/api's own IPlatformService.importFees
// return shape (platform.interface.ts). Declared locally per rules §2 ("a missing DTO is a
// Stage 01 contract gap to fix upstream, never a local patch") — this one isn't missing from
// the contract by oversight, it's deliberately backend-internal (mirrors CancelOrderCommand's
// same situation in orders.service.ts below).
export type ImportFeesResult = { imported: number };

export async function listWilayas(): Promise<WilayaDto[]> {
  const res = await api.get<ApiResponse<WilayaDto[]>>(apiPath(PLATFORM_ROUTES.WILAYAS));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function getFee(query: FeeQuery): Promise<FeeDto> {
  const res = await api.get<ApiResponse<FeeDto>>(apiPath(PLATFORM_ROUTES.FEE), { params: query });
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function getAdminFees(): Promise<AdminFeesDto> {
  const res = await api.get<ApiResponse<AdminFeesDto>>(apiPath(PLATFORM_ROUTES.ADMIN_FEES));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// PUT, not POST — confirmed against platform.routes.ts.
export async function upsertFees(command: UpsertFeesCommand): Promise<AdminFeesDto> {
  const res = await api.put<ApiResponse<AdminFeesDto>>(
    apiPath(PLATFORM_ROUTES.ADMIN_FEES),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function importFees(file: File): Promise<ImportFeesResult> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post<ApiResponse<ImportFeesResult>>(
    apiPath(PLATFORM_ROUTES.FEES_IMPORT),
    formData,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// Binary/text download — deliberately bypasses the ApiResponse envelope (backend comment:
// "plan §8.4"), so no unwrap here; the caller gets the raw Blob.
export async function exportFees(query: FeesExportQuery): Promise<Blob> {
  const res = await api.get<Blob>(apiPath(PLATFORM_ROUTES.FEES_EXPORT), {
    params: query,
    responseType: "blob",
  });
  return res.data;
}

export async function getSettings(): Promise<SettingsDto> {
  const res = await api.get<ApiResponse<SettingsDto>>(apiPath(PLATFORM_ROUTES.SETTINGS));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function updateSettings(command: UpdateSettingsCommand): Promise<SettingsDto> {
  const res = await api.patch<ApiResponse<SettingsDto>>(apiPath(PLATFORM_ROUTES.SETTINGS), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function getPublicSettings(): Promise<PublicSettingsDto> {
  const res = await api.get<ApiResponse<PublicSettingsDto>>(
    apiPath(PLATFORM_ROUTES.SETTINGS_PUBLIC),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
