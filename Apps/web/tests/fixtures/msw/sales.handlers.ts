import { http } from "msw";
import { SALE_ROUTES, ErrorCode } from "@dragon-telecom/contract";
import { apiUrl } from "./api-url";
import { ok, fail } from "./envelope";
import { mockSale, mockSalesPaginated, mockReceipt } from "../data/sales.mock";

// SALE_ROUTES are full literal paths, including `:id`/`:reference` placeholders — msw matches
// those as path patterns natively (same builder as services, test-rules §3). No `:id`-pattern
// route-ordering hazard here: CREATE_DRAFT/STAFF_LIST share a literal path but differ by method
// (POST/GET), and every param'd route has a distinct segment count from its neighbors (unlike
// the STATS-before-:id cases in earlier sprints).
export const salesUrls = {
  createDraft: apiUrl(SALE_ROUTES.CREATE_DRAFT),
  updateDraft: apiUrl(SALE_ROUTES.UPDATE_DRAFT),
  confirm: apiUrl(SALE_ROUTES.CONFIRM),
  staffList: apiUrl(SALE_ROUTES.STAFF_LIST),
  adminList: apiUrl(SALE_ROUTES.ADMIN_LIST),
  staffDetail: apiUrl(SALE_ROUTES.STAFF_DETAIL),
  adminDetail: apiUrl(SALE_ROUTES.ADMIN_DETAIL),
  return: apiUrl(SALE_ROUTES.RETURN),
};

// Happy-path defaults — always registered. Individual tests override with `server.use()`
// for 4xx/5xx variants (test-rules §3).
export const salesHandlers = [
  http.post(salesUrls.createDraft, () => ok(mockSale, 201)),
  http.patch(salesUrls.updateDraft, () => ok(mockSale)),
  http.post(salesUrls.confirm, () => ok(mockReceipt)),
  http.get(salesUrls.staffList, () => ok(mockSalesPaginated)),
  http.get(salesUrls.adminList, () => ok(mockSalesPaginated)),
  http.get(salesUrls.staffDetail, () => ok(mockSale)),
  http.get(salesUrls.adminDetail, () => ok(mockSale)),
  http.post(salesUrls.return, () => ok(mockSale)),
];

export const salesErrorHandlers = {
  // SaleDraftSchema's `lines.min(1)`.
  createDraftEmptyLines: () =>
    http.post(salesUrls.createDraft, () =>
      fail(ErrorCode.VALIDATION_ERROR, "lines must contain at least 1 item", 400),
    ),
  // A state-guard 409 (confirm on an already-confirmed/non-DRAFT sale) — same class as
  // purchasing's DRAFT-only invoice guard.
  confirmConflict: () =>
    http.post(salesUrls.confirm, () =>
      fail(ErrorCode.RESOURCE_CONFLICT, "Only DRAFT sales can be confirmed", 409),
    ),
  saleNotFound: () =>
    http.get(salesUrls.staffDetail, () =>
      fail(ErrorCode.RESOURCE_NOT_FOUND, "Sale not found", 404),
    ),
};
