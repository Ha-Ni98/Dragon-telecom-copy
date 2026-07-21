import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import {
  mockStaffUser,
  mockAdminUser,
  mockUsersPaginated,
  mockRole,
  mockRoles,
  mockPage,
  mockPages,
} from "../../../fixtures/data/identity.mock";
import * as useIdentityHook from "@/hooks/useIdentity";
import AdminUsers from "@/pages/admin/users/AdminUsers";

vi.mock("@/hooks/useIdentity");

const createUserMutate = vi.fn();
const updateUserMutate = vi.fn();
const createRoleMutate = vi.fn();
const updateRoleMutate = vi.fn();
const setRolePagesMutate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useIdentityHook.useUsers).mockReturnValue({
    data: mockUsersPaginated,
    isLoading: false,
    isError: false,
  } as never);
  vi.mocked(useIdentityHook.useRoles).mockReturnValue({
    data: mockRoles,
    isLoading: false,
    isError: false,
  } as never);
  vi.mocked(useIdentityHook.usePages).mockReturnValue({
    data: mockPages,
    isLoading: false,
    isError: false,
  } as never);
  vi.mocked(useIdentityHook.useCreateUser).mockReturnValue({
    mutate: createUserMutate,
    isPending: false,
  } as never);
  vi.mocked(useIdentityHook.useUpdateUser).mockReturnValue({
    mutate: updateUserMutate,
    isPending: false,
  } as never);
  vi.mocked(useIdentityHook.useCreateRole).mockReturnValue({
    mutate: createRoleMutate,
    isPending: false,
  } as never);
  vi.mocked(useIdentityHook.useUpdateRole).mockReturnValue({
    mutate: updateRoleMutate,
    isPending: false,
  } as never);
  vi.mocked(useIdentityHook.useSetRolePages).mockReturnValue({
    mutate: setRolePagesMutate,
    isPending: false,
  } as never);
});

describe("AdminUsers (ADM-16) wiring", () => {
  it("shows the users table skeleton while loading", () => {
    vi.mocked(useIdentityHook.useUsers).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as never);
    const { container } = renderWithRoutes({ "/admin/users": <AdminUsers /> }, "/admin/users");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders user rows from the live hook", () => {
    renderWithRoutes({ "/admin/users": <AdminUsers /> }, "/admin/users");
    expect(screen.getAllByText(mockStaffUser.username).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(mockAdminUser.username).length).toBeGreaterThanOrEqual(1);
  });

  it("edits a STAFF user's effective pages live and saves via the live mutation, surfacing the last-admin 409 banner on failure", async () => {
    updateUserMutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(
        Object.assign(new Error("Conflict"), { isAxiosError: true, response: { status: 409 } }),
      );
    });
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/users": <AdminUsers /> }, "/admin/users");

    const editButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-square-pen, svg.lucide-edit"));
    await user.click(editButtons[0]);

    // mockStaffUser already has mockRole checked → its effective page (mockPage) should render.
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(mockPage.label)).toBeInTheDocument();

    await user.click(within(dialog).getByText("common.save"));

    await waitFor(() =>
      expect(screen.getByText("admin.users.form.lastAdminGuard")).toBeInTheDocument(),
    );
  });

  it("creates a new STAFF user via the live mutation", async () => {
    createUserMutate.mockImplementation((_vars, opts) => opts?.onSuccess?.());
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/users": <AdminUsers /> }, "/admin/users");

    await user.click(screen.getByText("admin.users.addUser"));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("admin.users.form.username"), "sara.h");
    await user.type(within(dialog).getByLabelText("admin.users.form.password"), "supersecret");
    await user.type(within(dialog).getByLabelText("admin.users.form.firstName"), "Sara");
    await user.type(within(dialog).getByLabelText("admin.users.form.lastName"), "Haddad");
    await user.click(within(dialog).getByText(mockRole.name));

    await user.click(within(dialog).getByText("common.save"));

    await waitFor(() => expect(createUserMutate).toHaveBeenCalled());
  });

  it("creates a role with its permission matrix, wiring both live mutations", async () => {
    createRoleMutate.mockImplementation((_vars, opts) => opts?.onSuccess?.(mockRole));
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/users": <AdminUsers /> }, "/admin/users");

    await user.click(screen.getByText("admin.users.tabs.roles"));
    await user.click(screen.getByText("admin.users.addRole"));

    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("admin.users.roleForm.code"), "pos-operator-2");
    await user.type(within(dialog).getByLabelText("admin.users.roleForm.name"), "POS Operator 2");
    await user.click(within(dialog).getByText(mockPage.label));

    await user.click(within(dialog).getByText("common.save"));

    await waitFor(() => expect(createRoleMutate).toHaveBeenCalled());
    // The create-mode gap this sprint fixed: pageKeys collected in the matrix must reach
    // useSetRolePages once the new role's id comes back from useCreateRole's onSuccess.
    expect(setRolePagesMutate).toHaveBeenCalledWith({
      id: mockRole.id,
      command: { pageKeys: [mockPage.key] },
    });
  });

  it("updates a role's permission matrix via the live mutations", async () => {
    updateRoleMutate.mockImplementation((_vars, opts) => opts?.onSuccess?.());
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/users": <AdminUsers /> }, "/admin/users");

    await user.click(screen.getByText("admin.users.tabs.roles"));
    const editButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-square-pen, svg.lucide-edit"));
    await user.click(editButtons[0]);

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("common.save"));

    await waitFor(() =>
      expect(updateRoleMutate).toHaveBeenCalledWith(
        { id: mockRole.id, command: expect.objectContaining({ name: mockRole.name }) },
        expect.anything(),
      ),
    );
    expect(setRolePagesMutate).toHaveBeenCalledWith({
      id: mockRole.id,
      command: { pageKeys: mockRole.pageKeys },
    });
  });
});
