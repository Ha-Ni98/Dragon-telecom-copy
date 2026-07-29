import { http } from "msw";
import { REPAIR_ROUTES, ErrorCode } from "@dragon-telecom/contract";
import { apiUrl } from "./api-url";
import { ok, fail } from "./envelope";
import { mockRepair, mockRepairs } from "../data/repairs.mock";

// REPAIR_ROUTES are full literal paths, including `:id`/`:partId` placeholders — msw matches
// those as path patterns natively. No route-ordering hazard: STAFF_PARTS (`/staff/repairs/:id/
// parts`, POST), STAFF_STATUS (`/staff/repairs/:id/status`, POST), and STAFF_PART_BY_ID
// (`/staff/repairs/:id/parts/:partId`, DELETE) each have a distinct literal suffix/segment
// count, unlike the STATS-before-:id cases in earlier sprints.
export const repairsUrls = {
  staffList: apiUrl(REPAIR_ROUTES.STAFF_LIST),
  adminList: apiUrl(REPAIR_ROUTES.ADMIN_LIST),
  staffCreate: apiUrl(REPAIR_ROUTES.STAFF_CREATE),
  adminCreate: apiUrl(REPAIR_ROUTES.ADMIN_CREATE),
  staffUpdate: apiUrl(REPAIR_ROUTES.STAFF_UPDATE),
  adminUpdate: apiUrl(REPAIR_ROUTES.ADMIN_UPDATE),
  staffParts: apiUrl(REPAIR_ROUTES.STAFF_PARTS),
  adminParts: apiUrl(REPAIR_ROUTES.ADMIN_PARTS),
  staffPartById: apiUrl(REPAIR_ROUTES.STAFF_PART_BY_ID),
  adminPartById: apiUrl(REPAIR_ROUTES.ADMIN_PART_BY_ID),
  staffStatus: apiUrl(REPAIR_ROUTES.STAFF_STATUS),
  adminStatus: apiUrl(REPAIR_ROUTES.ADMIN_STATUS),
};

// Happy-path defaults — always registered. Individual tests override with `server.use()`
// for 4xx/5xx variants (test-rules §3).
export const repairsHandlers = [
  http.get(repairsUrls.staffList, () => ok(mockRepairs)),
  http.get(repairsUrls.adminList, () => ok(mockRepairs)),
  http.post(repairsUrls.staffCreate, () => ok(mockRepair, 201)),
  http.post(repairsUrls.adminCreate, () => ok(mockRepair, 201)),
  http.patch(repairsUrls.staffUpdate, () => ok(mockRepair)),
  http.patch(repairsUrls.adminUpdate, () => ok(mockRepair)),
  http.post(repairsUrls.staffParts, () => ok(mockRepair, 201)),
  http.post(repairsUrls.adminParts, () => ok(mockRepair, 201)),
  http.delete(repairsUrls.staffPartById, () => ok(mockRepair)),
  http.delete(repairsUrls.adminPartById, () => ok(mockRepair)),
  // STAFF_STATUS/ADMIN_STATUS are POST, not PATCH — confirmed against the real
  // repairs.routes.ts (plan.md's table said PATCH; the real router disagrees).
  http.post(repairsUrls.staffStatus, () => ok(mockRepair)),
  http.post(repairsUrls.adminStatus, () => ok(mockRepair)),
];

export const repairsErrorHandlers = {
  // CreateRepairSchema's `reportedIssues.min(1)`.
  createRepairEmptyIssues: () =>
    http.post(repairsUrls.staffCreate, () =>
      fail(ErrorCode.VALIDATION_ERROR, "reportedIssues must contain at least 1 item", 400),
    ),
  repairNotFound: () =>
    http.patch(repairsUrls.staffUpdate, () =>
      fail(ErrorCode.RESOURCE_NOT_FOUND, "Repair not found", 404),
    ),
};
