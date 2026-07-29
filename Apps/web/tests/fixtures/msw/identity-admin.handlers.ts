import { http } from "msw";
import { IDENTITY_ROUTES, ErrorCode } from "@dragon-telecom/contract";
import { apiUrl } from "./api-url";
import { ok, fail } from "./envelope";
import {
  mockUsersPaginated,
  mockStaffUser,
  mockAdminUser,
  mockRoles,
  mockRole,
  mockPages,
  mockTechnicians,
  mockTechnician,
} from "../data/identity.mock";

// IDENTITY_ROUTES are full literal paths, including `:id` placeholders — msw matches those as
// path patterns natively (same builder as services, test-rules §3). Distinct from auth.handlers.ts,
// which covers this same route constant's session slice (LOGIN/REFRESH/LOGOUT/ME_PERMISSIONS) —
// this file is the admin (USERS/ROLES/PAGES/TECHNICIANS) slice only, no overlap.
export const identityAdminUrls = {
  users: apiUrl(IDENTITY_ROUTES.USERS),
  userById: apiUrl(IDENTITY_ROUTES.USER_BY_ID),
  roles: apiUrl(IDENTITY_ROUTES.ROLES),
  roleById: apiUrl(IDENTITY_ROUTES.ROLE_BY_ID),
  rolePages: apiUrl(IDENTITY_ROUTES.ROLE_PAGES),
  pages: apiUrl(IDENTITY_ROUTES.PAGES),
  technicians: apiUrl(IDENTITY_ROUTES.TECHNICIANS),
  technicianById: apiUrl(IDENTITY_ROUTES.TECHNICIAN_BY_ID),
};

// Happy-path defaults — always registered. Individual tests override with `server.use()`
// for 4xx/5xx variants (test-rules §3).
export const identityAdminHandlers = [
  http.get(identityAdminUrls.users, () => ok(mockUsersPaginated)),
  http.post(identityAdminUrls.users, () => ok(mockStaffUser, 201)),
  http.get(identityAdminUrls.userById, () => ok(mockAdminUser)),
  http.patch(identityAdminUrls.userById, () => ok(mockStaffUser)),
  http.get(identityAdminUrls.roles, () => ok(mockRoles)),
  http.post(identityAdminUrls.roles, () => ok(mockRole, 201)),
  http.patch(identityAdminUrls.roleById, () => ok(mockRole)),
  http.put(identityAdminUrls.rolePages, () => ok(mockRole)),
  http.get(identityAdminUrls.pages, () => ok(mockPages)),
  http.get(identityAdminUrls.technicians, () => ok(mockTechnicians)),
  http.post(identityAdminUrls.technicians, () => ok(mockTechnician, 201)),
  http.patch(identityAdminUrls.technicianById, () => ok(mockTechnician)),
];

export const identityAdminErrorHandlers = {
  // CreateUserSchema's two `.refine()`s (spec Business Logic): roleIds required+non-empty for
  // STAFF, forbidden for ADMIN.
  createUserStaffMissingRoleIds: () =>
    http.post(identityAdminUrls.users, () =>
      fail(ErrorCode.VALIDATION_ERROR, "roleIds is required and non-empty for STAFF users", 400),
    ),
  createUserAdminWithRoleIds: () =>
    http.post(identityAdminUrls.users, () =>
      fail(ErrorCode.VALIDATION_ERROR, "roleIds is forbidden for ADMIN users", 400),
    ),
  userNotFound: () =>
    http.get(identityAdminUrls.userById, () =>
      fail(ErrorCode.RESOURCE_NOT_FOUND, "User not found", 404),
    ),
  createUserDuplicateUsername: () =>
    http.post(identityAdminUrls.users, () =>
      fail(ErrorCode.RESOURCE_CONFLICT, "Username already exists", 409),
    ),
};
