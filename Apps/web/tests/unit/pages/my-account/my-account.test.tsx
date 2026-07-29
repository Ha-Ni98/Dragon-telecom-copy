import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import { mockClientMe } from "../../../fixtures/data/clients.mock";
import { mockWilayas } from "../../../fixtures/data/platform.mock";
import * as useClientPortalHook from "@/hooks/useClientPortal";
import * as usePlatformHook from "@/hooks/usePlatform";
import MyAccount from "@/pages/MyAccount";

vi.mock("@/hooks/useClientPortal");
vi.mock("@/hooks/usePlatform");

const updateMutate = vi.fn();
const changePasswordMutate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePlatformHook.useWilayas).mockReturnValue({ data: mockWilayas } as never);
  vi.mocked(useClientPortalHook.useUpdateClientMe).mockReturnValue({
    mutate: updateMutate,
    isPending: false,
  } as never);
  vi.mocked(useClientPortalHook.useChangeClientPassword).mockReturnValue({
    mutate: changePasswordMutate,
    isPending: false,
  } as never);
});

function mockClientMeQuery(overrides: Partial<typeof mockClientMe> = {}) {
  vi.mocked(useClientPortalHook.useClientMe).mockReturnValue({
    data: { ...mockClientMe, ...overrides },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as never);
}

describe("MyAccount (PUB-08)", () => {
  it("shows a skeleton while the profile is loading", () => {
    vi.mocked(useClientPortalHook.useClientMe).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as never);
    const { container } = renderWithRoutes({ "/my-account": <MyAccount /> }, "/my-account");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders phone as read-only and never submits it in the update command", async () => {
    mockClientMeQuery();
    const user = userEvent.setup();
    renderWithRoutes({ "/my-account": <MyAccount /> }, "/my-account");

    const phoneInput = screen.getByLabelText("register.phone");
    expect(phoneInput).toBeDisabled();
    expect(phoneInput).toHaveAttribute("readonly");

    await user.click(screen.getByRole("button", { name: "account.edit" }));
    await user.clear(screen.getByLabelText("register.email"));
    await user.type(screen.getByLabelText("register.email"), "amine@example.com");
    await user.click(screen.getByRole("button", { name: "account.save" }));

    expect(updateMutate).toHaveBeenCalled();
    const command = updateMutate.mock.calls[0][0];
    expect(command).not.toHaveProperty("phone");
    expect(command.email).toBe("amine@example.com");
  });

  it("shows only the Active badge on the account status card — no category", () => {
    mockClientMeQuery();
    renderWithRoutes({ "/my-account": <MyAccount /> }, "/my-account");

    const statusCard = screen
      .getByText("account.accountStatus")
      .closest(".rounded-xl") as HTMLElement;
    expect(within(statusCard).getByText("account.statusActive")).toBeInTheDocument();
    expect(within(statusCard).queryByText(/categor/i)).not.toBeInTheDocument();
  });

  it("restores the original field values when Cancel is clicked", async () => {
    mockClientMeQuery({ email: "original@example.com" });
    const user = userEvent.setup();
    renderWithRoutes({ "/my-account": <MyAccount /> }, "/my-account");

    await user.click(screen.getByRole("button", { name: "account.edit" }));
    const emailInput = screen.getByLabelText("register.email") as HTMLInputElement;
    await user.clear(emailInput);
    await user.type(emailInput, "changed@example.com");
    expect(emailInput.value).toBe("changed@example.com");

    await user.click(screen.getByRole("button", { name: "register.cancel" }));
    expect(screen.getByLabelText("register.email")).toHaveValue("original@example.com");
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("shows the credit/paid/sold values on the billing tab", async () => {
    mockClientMeQuery({ credit: 1500, totalPaid: 20000, totalSold: 21500 });
    const user = userEvent.setup();
    renderWithRoutes({ "/my-account": <MyAccount /> }, "/my-account");

    await user.click(screen.getByRole("tab", { name: "account.billing" }));

    expect(screen.getByText("1,500 DA")).toBeInTheDocument();
    expect(screen.getByText("20,000 DA")).toBeInTheDocument();
    expect(screen.getByText("21,500 DA")).toBeInTheDocument();
  });
});

describe("MyAccount — change password form (PUB-08)", () => {
  beforeEach(() => {
    mockClientMeQuery();
  });

  it("shows the mismatch error and never submits when the passwords disagree", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/my-account": <MyAccount /> }, "/my-account");

    await user.click(screen.getByRole("button", { name: "account.changePassword" }));
    await user.type(screen.getByLabelText("account.currentPassword"), "oldpass1");
    await user.type(screen.getByLabelText("account.newPassword"), "newpass1");
    await user.type(screen.getByLabelText("account.confirmPassword"), "newpass2");
    await user.click(screen.getByRole("button", { name: "account.save" }));

    expect(await screen.findByText("register.passwordMismatch")).toBeInTheDocument();
    expect(changePasswordMutate).not.toHaveBeenCalled();
  });

  it("strips confirmPassword before submitting", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/my-account": <MyAccount /> }, "/my-account");

    await user.click(screen.getByRole("button", { name: "account.changePassword" }));
    await user.type(screen.getByLabelText("account.currentPassword"), "oldpass1");
    await user.type(screen.getByLabelText("account.newPassword"), "newpass1");
    await user.type(screen.getByLabelText("account.confirmPassword"), "newpass1");
    await user.click(screen.getByRole("button", { name: "account.save" }));

    expect(changePasswordMutate).toHaveBeenCalledWith(
      { currentPassword: "oldpass1", newPassword: "newpass1" },
      expect.anything(),
    );
  });
});
