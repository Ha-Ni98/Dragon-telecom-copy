import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import {
  mockAdminClientPending,
  mockAdminClientApproved,
} from "../../../fixtures/data/clients.mock";
import {
  mockClientActivities,
  mockClientActivity,
} from "../../../fixtures/data/observability.mock";
import { mockClientCategory } from "../../../fixtures/data/catalog.mock";
import * as useClientDirectoryHook from "@/hooks/useClientDirectory";
import * as useObservabilityHook from "@/hooks/useObservability";
import * as useClientCategoriesHook from "@/hooks/useClientCategories";
import AdminClientDetail from "@/pages/admin/clients/AdminClientDetail";

vi.mock("@/hooks/useClientDirectory");
vi.mock("@/hooks/useObservability");
vi.mock("@/hooks/useClientCategories");

const refetchEntry = vi.fn();
const approveMutate = vi.fn();
const rejectMutate = vi.fn();
const resetPasswordMutate = vi.fn();

function mockEntry(
  data: typeof mockAdminClientPending | undefined,
  overrides: Partial<{ isLoading: boolean; isError: boolean }> = {},
) {
  vi.mocked(useClientDirectoryHook.useClientDirectoryEntry).mockReturnValue({
    data,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: refetchEntry,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEntry(mockAdminClientPending);
  vi.mocked(useClientDirectoryHook.useApproveClient).mockReturnValue({
    mutate: approveMutate,
    isPending: false,
  } as never);
  vi.mocked(useClientDirectoryHook.useRejectClient).mockReturnValue({
    mutate: rejectMutate,
    isPending: false,
  } as never);
  vi.mocked(useClientDirectoryHook.useResetClientPassword).mockReturnValue({
    mutate: resetPasswordMutate,
    isPending: false,
  } as never);
  vi.mocked(useObservabilityHook.useClientActivity).mockReturnValue({
    data: mockClientActivities,
    isLoading: false,
  } as never);
  vi.mocked(useClientCategoriesHook.useCatalogClientCategories).mockReturnValue({
    data: [mockClientCategory],
    isLoading: false,
  } as never);
});

function renderDetail(client = mockAdminClientPending) {
  return renderWithRoutes(
    { "/admin/clients/:id": <AdminClientDetail /> },
    `/admin/clients/${client.id}`,
  );
}

describe("AdminClientDetail (ADM-12b) wiring", () => {
  it("shows a skeleton while loading", () => {
    mockEntry(undefined, { isLoading: true });
    const { container } = renderDetail();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows NotFoundState when the entry query errors", () => {
    mockEntry(undefined, { isError: true });
    renderDetail();
    expect(screen.getByText("admin.clients.detail.notFound")).toBeInTheDocument();
  });

  it("renders the client's real name and the browsing activity from the live hooks", async () => {
    const user = userEvent.setup();
    renderDetail();
    expect(screen.getAllByText(mockAdminClientPending.fullName).length).toBeGreaterThanOrEqual(1);
    await user.click(screen.getByText("admin.clients.detail.tabs.browsing"));
    expect(screen.getAllByText(mockClientActivity.product!.name).length).toBeGreaterThanOrEqual(1);

    const productLinks = screen.getAllByRole("link", { name: mockClientActivity.product!.name });
    expect(productLinks[0]).toHaveAttribute(
      "href",
      `/admin/products/${mockClientActivity.product!.id}`,
    );
  });

  it("approves a PENDING client via the live mutation", async () => {
    approveMutate.mockImplementation((_vars, opts) => opts?.onSuccess?.());
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByText("admin.clients.approval.approve"));
    await user.type(screen.getByLabelText("admin.clients.approval.username"), "amine.b");
    await user.type(screen.getByLabelText("admin.clients.approval.password"), "supersecret");

    const categoryInput = screen.getByRole("combobox");
    await user.type(categoryInput, mockClientCategory.id);

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("admin.clients.approval.approve"));

    await waitFor(() => expect(approveMutate).toHaveBeenCalled());
  });

  it("shows the username-taken banner when approval 409s", async () => {
    approveMutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(
        Object.assign(new Error("Conflict"), { isAxiosError: true, response: { status: 409 } }),
      );
    });
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByText("admin.clients.approval.approve"));
    await user.type(screen.getByLabelText("admin.clients.approval.username"), "amine.b");
    await user.type(screen.getByLabelText("admin.clients.approval.password"), "supersecret");
    const categoryInput = screen.getByRole("combobox");
    await user.type(categoryInput, mockClientCategory.id);
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("admin.clients.approval.approve"));

    await waitFor(() =>
      expect(screen.getByText("admin.clients.approval.usernameTaken")).toBeInTheDocument(),
    );
  });

  it("resets the password for an APPROVED client via the live mutation", async () => {
    mockEntry(mockAdminClientApproved);
    resetPasswordMutate.mockImplementation((_vars, opts) => opts?.onSuccess?.());
    const user = userEvent.setup();
    renderDetail(mockAdminClientApproved);

    await user.click(screen.getByText("admin.clients.resetPassword.title"));
    await user.type(screen.getByLabelText("admin.clients.resetPassword.newPassword"), "newpass1");
    await user.type(
      screen.getByLabelText("admin.clients.resetPassword.confirmPassword"),
      "newpass1",
    );
    await user.click(screen.getByText("common.save"));

    await waitFor(() =>
      expect(resetPasswordMutate).toHaveBeenCalledWith(
        { id: mockAdminClientApproved.id, command: { newPassword: "newpass1" } },
        expect.anything(),
      ),
    );
  });
});
