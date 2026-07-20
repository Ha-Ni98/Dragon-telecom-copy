import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { UserType } from "@dragon-telecom/contract";
import { server } from "../../fixtures/msw/server";
import { identityAdminUrls } from "../../fixtures/msw/identity-admin.handlers";
import { ok } from "../../fixtures/msw/envelope";
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
import { createQueryWrapper } from "../../fixtures/wrappers/createQueryWrapper";
import {
  useUsers,
  useUser,
  useCreateUser,
  useUpdateUser,
  useRoles,
  useCreateRole,
  useUpdateRole,
  useSetRolePages,
  usePages,
  useTechnicians,
  useCreateTechnician,
  useUpdateTechnician,
} from "@/hooks/useIdentity";

describe("useUsers / useUser / useCreateUser / useUpdateUser", () => {
  it("resolves the paginated user list and disables useUser without an id", async () => {
    const { result: listResult } = renderHook(() => useUsers({ page: 1, limit: 10 }), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(listResult.current.data).toEqual(mockUsersPaginated);

    const { result: disabledResult } = renderHook(() => useUser(""), {
      wrapper: createQueryWrapper(),
    });
    expect(disabledResult.current.fetchStatus).toBe("idle");

    const { result: detailResult } = renderHook(() => useUser(mockAdminUser.id), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(detailResult.current.isSuccess).toBe(true));
    expect(detailResult.current.data).toEqual(mockAdminUser);
  });

  it("invalidates the user list and detail on create/update", async () => {
    const wrapper = createQueryWrapper();
    let usersCalls = 0;
    server.use(
      http.get(identityAdminUrls.users, () => {
        usersCalls += 1;
        return ok(mockUsersPaginated);
      }),
    );

    const { result: listResult } = renderHook(() => useUsers({ page: 1, limit: 10 }), { wrapper });
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(usersCalls).toBe(1);

    const { result: createResult } = renderHook(() => useCreateUser(), { wrapper });
    createResult.current.mutate({
      username: "new.staff",
      password: "password123",
      type: UserType.STAFF,
      profile: { firstName: "New", lastName: "Staff" },
      roleIds: [mockRole.id],
    });
    await waitFor(() => expect(createResult.current.isSuccess).toBe(true));
    await waitFor(() => expect(usersCalls).toBe(2));

    const { result: updateResult } = renderHook(() => useUpdateUser(), { wrapper });
    updateResult.current.mutate({ id: mockStaffUser.id, command: { isEnabled: false } });
    await waitFor(() => expect(updateResult.current.isSuccess).toBe(true));
    await waitFor(() => expect(usersCalls).toBe(3));
  });
});

describe("useRoles / useCreateRole / useUpdateRole / useSetRolePages", () => {
  it("resolves the role list and invalidates it on create/update/setRolePages", async () => {
    const wrapper = createQueryWrapper();
    let rolesCalls = 0;
    server.use(
      http.get(identityAdminUrls.roles, () => {
        rolesCalls += 1;
        return ok(mockRoles);
      }),
    );

    const { result: listResult } = renderHook(() => useRoles(), { wrapper });
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(rolesCalls).toBe(1);

    const { result: createResult } = renderHook(() => useCreateRole(), { wrapper });
    createResult.current.mutate({ code: "new-role", name: "New Role" });
    await waitFor(() => expect(createResult.current.isSuccess).toBe(true));
    await waitFor(() => expect(rolesCalls).toBe(2));

    const { result: updateResult } = renderHook(() => useUpdateRole(), { wrapper });
    updateResult.current.mutate({ id: mockRole.id, command: { name: "Renamed" } });
    await waitFor(() => expect(updateResult.current.isSuccess).toBe(true));
    await waitFor(() => expect(rolesCalls).toBe(3));

    const { result: setPagesResult } = renderHook(() => useSetRolePages(), { wrapper });
    setPagesResult.current.mutate({ id: mockRole.id, command: { pageKeys: [] } });
    await waitFor(() => expect(setPagesResult.current.isSuccess).toBe(true));
    await waitFor(() => expect(rolesCalls).toBe(4));
  });
});

describe("usePages", () => {
  it("resolves the page registry", async () => {
    const { result } = renderHook(() => usePages({}), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockPages);
  });
});

describe("useTechnicians / useCreateTechnician / useUpdateTechnician", () => {
  it("resolves the technician list and invalidates it on create/update", async () => {
    const wrapper = createQueryWrapper();
    let techniciansCalls = 0;
    server.use(
      http.get(identityAdminUrls.technicians, () => {
        techniciansCalls += 1;
        return ok(mockTechnicians);
      }),
    );

    const { result: listResult } = renderHook(() => useTechnicians(), { wrapper });
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(techniciansCalls).toBe(1);

    const { result: createResult } = renderHook(() => useCreateTechnician(), { wrapper });
    createResult.current.mutate({ name: "New Tech" });
    await waitFor(() => expect(createResult.current.isSuccess).toBe(true));
    await waitFor(() => expect(techniciansCalls).toBe(2));

    const { result: updateResult } = renderHook(() => useUpdateTechnician(), { wrapper });
    updateResult.current.mutate({ id: mockTechnician.id, command: { isEnabled: false } });
    await waitFor(() => expect(updateResult.current.isSuccess).toBe(true));
    await waitFor(() => expect(techniciansCalls).toBe(3));
  });
});
