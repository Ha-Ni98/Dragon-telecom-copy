import { describe, it, expect } from "vitest";
import { UserType } from "@dragon-telecom/contract";
import { server } from "../../fixtures/msw/server";
import { identityAdminErrorHandlers } from "../../fixtures/msw/identity-admin.handlers";
import {
  mockUsersPaginated,
  mockAdminUser,
  mockStaffUser,
  mockRoles,
  mockRole,
  mockPages,
  mockTechnicians,
  mockTechnician,
} from "../../fixtures/data/identity.mock";
import * as identityService from "@/services/identity.service";

describe("identity.service — users", () => {
  it("listUsers returns the unwrapped paginated result", async () => {
    expect(await identityService.listUsers({ page: 1, limit: 10 })).toEqual(mockUsersPaginated);
  });

  it("getUser returns the unwrapped DTO", async () => {
    expect(await identityService.getUser(mockAdminUser.id)).toEqual(mockAdminUser);
  });

  it("createUser (STAFF, with roleIds) returns the unwrapped DTO", async () => {
    const result = await identityService.createUser({
      username: "new.staff",
      password: "password123",
      type: UserType.STAFF,
      profile: { firstName: "New", lastName: "Staff" },
      roleIds: [mockRole.id],
    });
    expect(result).toEqual(mockStaffUser);
  });

  it("createUser throws when STAFF is missing roleIds (refine violation)", async () => {
    server.use(identityAdminErrorHandlers.createUserStaffMissingRoleIds());
    await expect(
      identityService.createUser({
        username: "new.staff",
        password: "password123",
        type: UserType.STAFF,
        profile: { firstName: "New", lastName: "Staff" },
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it("createUser throws when ADMIN carries roleIds (refine violation)", async () => {
    server.use(identityAdminErrorHandlers.createUserAdminWithRoleIds());
    await expect(
      identityService.createUser({
        username: "new.admin",
        password: "password123",
        type: UserType.ADMIN,
        profile: { firstName: "New", lastName: "Admin" },
        roleIds: [mockRole.id],
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it("createUser throws on a duplicate username (409)", async () => {
    server.use(identityAdminErrorHandlers.createUserDuplicateUsername());
    await expect(
      identityService.createUser({
        username: "sara.haddad",
        password: "password123",
        type: UserType.STAFF,
        profile: { firstName: "Sara", lastName: "Haddad" },
        roleIds: [mockRole.id],
      }),
    ).rejects.toMatchObject({ response: { status: 409 } });
  });

  it("getUser throws on a 404", async () => {
    server.use(identityAdminErrorHandlers.userNotFound());
    await expect(
      identityService.getUser("40000000-0000-4000-8000-000000000099"),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it("updateUser returns the unwrapped DTO", async () => {
    expect(await identityService.updateUser(mockStaffUser.id, { isEnabled: false })).toEqual(
      mockStaffUser,
    );
  });
});

describe("identity.service — roles & pages", () => {
  it("listRoles returns the unwrapped array", async () => {
    expect(await identityService.listRoles()).toEqual(mockRoles);
  });

  it("createRole / updateRole return the unwrapped DTO", async () => {
    expect(await identityService.createRole({ code: "new-role", name: "New Role" })).toEqual(
      mockRole,
    );
    expect(await identityService.updateRole(mockRole.id, { name: "Renamed" })).toEqual(mockRole);
  });

  it("setRolePages (PUT) returns the unwrapped DTO", async () => {
    expect(await identityService.setRolePages(mockRole.id, { pageKeys: [] })).toEqual(mockRole);
  });

  it("listPages returns the unwrapped array", async () => {
    expect(await identityService.listPages({})).toEqual(mockPages);
  });
});

describe("identity.service — technicians", () => {
  it("listTechnicians returns the unwrapped array", async () => {
    expect(await identityService.listTechnicians()).toEqual(mockTechnicians);
  });

  it("createTechnician / updateTechnician return the unwrapped DTO", async () => {
    expect(await identityService.createTechnician({ name: "New Tech" })).toEqual(mockTechnician);
    expect(await identityService.updateTechnician(mockTechnician.id, { isEnabled: false })).toEqual(
      mockTechnician,
    );
  });
});
