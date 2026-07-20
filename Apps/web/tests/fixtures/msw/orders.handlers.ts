import { http } from "msw";
import { ORDER_ROUTES, ErrorCode } from "@dragon-telecom/contract";
import { apiUrl } from "./api-url";
import { ok, fail } from "./envelope";
import {
  mockOrderPickup,
  mockOrderDelivery,
  mockOrdersList,
  mockOrdersPaginated,
  mockOrderStats,
} from "../data/orders.mock";

export const ordersUrls = {
  place: apiUrl(ORDER_ROUTES.PLACE),
  myList: apiUrl(ORDER_ROUTES.MY_LIST),
  myCancel: apiUrl(ORDER_ROUTES.MY_CANCEL),
  staffList: apiUrl(ORDER_ROUTES.STAFF_LIST),
  adminList: apiUrl(ORDER_ROUTES.ADMIN_LIST),
  staffStats: apiUrl(ORDER_ROUTES.STAFF_STATS),
  adminStats: apiUrl(ORDER_ROUTES.ADMIN_STATS),
  staffConfirm: apiUrl(ORDER_ROUTES.STAFF_CONFIRM),
  adminConfirm: apiUrl(ORDER_ROUTES.ADMIN_CONFIRM),
  staffStatus: apiUrl(ORDER_ROUTES.STAFF_STATUS),
  adminStatus: apiUrl(ORDER_ROUTES.ADMIN_STATUS),
  cancel: apiUrl(ORDER_ROUTES.CANCEL),
  return: apiUrl(ORDER_ROUTES.RETURN),
};

// Happy-path defaults — always registered. Individual tests override with `server.use()`
// for 4xx/5xx variants (test-rules §3). No `:id`-vs-literal route-ordering risk here (unlike
// catalog/clients' *_STATS routes) — every ORDER_ROUTES STATS entry is GET while its
// same-prefix siblings are POST/PATCH, confirmed against the backend's own router comment.
export const ordersHandlers = [
  http.post(ordersUrls.place, () => ok(mockOrderPickup, 201)),
  http.get(ordersUrls.myList, () => ok(mockOrdersList)),
  http.post(ordersUrls.myCancel, () => ok(mockOrderPickup)),
  http.get(ordersUrls.staffList, () => ok(mockOrdersPaginated)),
  http.get(ordersUrls.adminList, () => ok(mockOrdersPaginated)),
  http.get(ordersUrls.staffStats, () => ok(mockOrderStats)),
  http.get(ordersUrls.adminStats, () => ok(mockOrderStats)),
  http.post(ordersUrls.staffConfirm, () => ok(mockOrderDelivery)),
  http.post(ordersUrls.adminConfirm, () => ok(mockOrderDelivery)),
  http.patch(ordersUrls.staffStatus, () => ok(mockOrderDelivery)),
  http.patch(ordersUrls.adminStatus, () => ok(mockOrderDelivery)),
  http.post(ordersUrls.cancel, () => ok(mockOrderPickup)),
  http.post(ordersUrls.return, () => ok(mockOrderDelivery)),
];

export const ordersErrorHandlers = {
  // The PlaceOrderSchema .refine() XOR (delivery required unless PICKUP, forbidden when
  // PICKUP) surfaces identically at the HTTP boundary — one representative 400.
  placeOrderValidationError: () =>
    http.post(ordersUrls.place, () =>
      fail(ErrorCode.VALIDATION_ERROR, "delivery is required unless orderType is PICKUP", 400),
    ),
  myCancelNotFound: () =>
    http.post(ordersUrls.myCancel, () =>
      fail(ErrorCode.RESOURCE_NOT_FOUND, "Order not found", 404),
    ),
  confirmOrderConflict: () =>
    http.post(ordersUrls.adminConfirm, () =>
      fail(ErrorCode.RESOURCE_CONFLICT, "Order already confirmed", 409),
    ),
  adminListServerError: () =>
    http.get(ordersUrls.adminList, () => fail(ErrorCode.INTERNAL_SERVER_ERROR, "boom", 500)),
};
