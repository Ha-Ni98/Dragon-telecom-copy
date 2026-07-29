import { http } from "msw";
import { CLIENT_ROUTES, POS_CLIENT_ROUTES, ErrorCode } from "@dragon-telecom/contract";
import { apiUrl } from "./api-url";
import { ok, fail, noContent } from "./envelope";
import {
  mockPhoneAvailable,
  mockClientMe,
  mockCart,
  mockAdminClientsPaginated,
  mockAdminClientPending,
  mockClientStats,
  mockPosClient,
  mockPosClientsPaginated,
} from "../data/clients.mock";

export const clientsUrls = {
  validatePhone: apiUrl(CLIENT_ROUTES.VALIDATE_PHONE),
  register: apiUrl(CLIENT_ROUTES.REGISTER),
  me: apiUrl(CLIENT_ROUTES.ME),
  mePassword: apiUrl(CLIENT_ROUTES.ME_PASSWORD),
  cart: apiUrl(CLIENT_ROUTES.CART),
  cartItem: apiUrl(CLIENT_ROUTES.CART_ITEM),
  adminList: apiUrl(CLIENT_ROUTES.ADMIN_LIST),
  adminStats: apiUrl(CLIENT_ROUTES.ADMIN_STATS),
  adminDetail: apiUrl(CLIENT_ROUTES.ADMIN_DETAIL),
  approve: apiUrl(CLIENT_ROUTES.APPROVE),
  reject: apiUrl(CLIENT_ROUTES.REJECT),
  resetPassword: apiUrl(CLIENT_ROUTES.RESET_PASSWORD),
  adminUpdate: apiUrl(CLIENT_ROUTES.ADMIN_UPDATE),
  posSearch: apiUrl(POS_CLIENT_ROUTES.SEARCH),
  posQuickCreate: apiUrl(POS_CLIENT_ROUTES.QUICK_CREATE),
  posAdmin: apiUrl(POS_CLIENT_ROUTES.ADMIN),
  posAdminById: apiUrl(POS_CLIENT_ROUTES.ADMIN_BY_ID),
};

// Happy-path defaults — always registered. Individual tests override with `server.use()`
// for 4xx/5xx variants (test-rules §3).
export const clientsHandlers = [
  http.post(clientsUrls.validatePhone, () => ok(mockPhoneAvailable)),
  http.post(clientsUrls.register, () => ok({ id: mockAdminClientPending.id }, 201)),
  http.get(clientsUrls.me, () => ok(mockClientMe)),
  http.patch(clientsUrls.me, () => ok(mockClientMe)),
  http.post(clientsUrls.mePassword, () => ok(null)),
  http.get(clientsUrls.cart, () => ok(mockCart)),
  http.post(clientsUrls.cart, () => ok(null, 201)),
  // The one true 204 in the backend (removeCartItem) — see envelope.ts's noContent() comment
  // for why the body can't survive the wire even though sendSuccess() attempts to attach one.
  http.delete(clientsUrls.cartItem, () => noContent()),
  // ADMIN_STATS ("/admin/clients/stats") is registered before ADMIN_DETAIL
  // ("/admin/clients/:id") — mirrors the backend's own route-ordering comment
  // (clients.routes.ts) and the same PRODUCT_STATS/ADMIN_PRODUCT_BY_ID lesson from Sprint 3.
  http.get(clientsUrls.adminStats, () => ok(mockClientStats)),
  http.get(clientsUrls.adminList, () => ok(mockAdminClientsPaginated)),
  http.get(clientsUrls.adminDetail, () => ok(mockAdminClientPending)),
  http.post(clientsUrls.approve, () => ok(mockAdminClientPending)),
  http.post(clientsUrls.reject, () => ok(mockAdminClientPending)),
  http.post(clientsUrls.resetPassword, () => ok(null)),
  http.patch(clientsUrls.adminUpdate, () => ok(mockAdminClientPending)),
  http.get(clientsUrls.posSearch, () => ok([mockPosClient])),
  http.post(clientsUrls.posQuickCreate, () => ok(mockPosClient, 201)),
  http.get(clientsUrls.posAdmin, () => ok(mockPosClientsPaginated)),
  http.post(clientsUrls.posAdmin, () => ok(mockPosClient, 201)),
  http.patch(clientsUrls.posAdminById, () => ok(mockPosClient)),
];

export const clientsErrorHandlers = {
  registerConflict: () =>
    http.post(clientsUrls.register, () =>
      fail(ErrorCode.RESOURCE_CONFLICT, "Phone already registered", 409),
    ),
  // UpdateMeSchema is `.strict()` — an extra key (e.g. `phone`, read-only per spec) 400s
  // rather than being silently dropped (integration plan.md §2.3 edge case).
  updateMeValidationError: () =>
    http.patch(clientsUrls.me, () =>
      fail(ErrorCode.VALIDATION_ERROR, "Unrecognized key: phone", 400),
    ),
  adminClientNotFound: () =>
    http.get(clientsUrls.adminDetail, () =>
      fail(ErrorCode.RESOURCE_NOT_FOUND, "Client not found", 404),
    ),
  approveConflict: () =>
    http.post(clientsUrls.approve, () =>
      fail(ErrorCode.RESOURCE_CONFLICT, "Client already approved", 409),
    ),
  posClientNotFound: () =>
    http.patch(clientsUrls.posAdminById, () =>
      fail(ErrorCode.RESOURCE_NOT_FOUND, "POS client not found", 404),
    ),
};
