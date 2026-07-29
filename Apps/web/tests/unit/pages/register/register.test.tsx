import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import { mockWilaya, mockWilayaOran, mockWilayas } from "../../../fixtures/data/platform.mock";
import {
  mockPhoneAvailable,
  mockPhoneRegistered,
  mockPhonePending,
} from "../../../fixtures/data/clients.mock";
import * as usePlatformHook from "@/hooks/usePlatform";
import * as useClientPortalHook from "@/hooks/useClientPortal";
import Register from "@/pages/Register";

vi.mock("@/hooks/usePlatform");
vi.mock("@/hooks/useClientPortal");

const validatePhoneMutateAsync = vi.fn();
const registerMutateAsync = vi.fn();

// Register.tsx's wilaya SelectItem renders "<code> - <name>" (e.g. "16 - Alger"), not just the
// bare name — distinct from ProductOrderModal/MyAccount, which show only `frName`.
const wilayaOptionName = (w: typeof mockWilaya) => `${w.wilayaCode} - ${w.frName}`;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePlatformHook.useWilayas).mockReturnValue({
    data: mockWilayas,
    isLoading: false,
  } as never);
  vi.mocked(useClientPortalHook.useValidatePhone).mockReturnValue({
    mutateAsync: validatePhoneMutateAsync,
    isPending: false,
  } as never);
  vi.mocked(useClientPortalHook.useRegisterClient).mockReturnValue({
    mutateAsync: registerMutateAsync,
    isPending: false,
  } as never);
  validatePhoneMutateAsync.mockResolvedValue(mockPhoneAvailable);
  registerMutateAsync.mockResolvedValue(undefined);
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("register.firstName"), "Amine");
  await user.type(screen.getByLabelText("register.lastName"), "Belkacem");
  await user.type(screen.getByLabelText("register.phone"), "0550000001");
  await user.click(screen.getByLabelText("register.wilaya"));
  await user.click(await screen.findByRole("option", { name: wilayaOptionName(mockWilaya) }));
  await user.click(screen.getByLabelText("register.commune"));
  await user.click(await screen.findByRole("option", { name: mockWilaya.communes[0].frName }));
}

describe("Register (PUB-07)", () => {
  it("shows a required error on every mandatory field for an empty submit", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/register": <Register /> }, "/register");

    await user.click(screen.getByRole("button", { name: "register.submit" }));

    expect(await screen.findByText("register.firstNameRequired")).toBeInTheDocument();
    expect(screen.getByText("register.lastNameRequired")).toBeInTheDocument();
    expect(screen.getByText("register.phoneRequired")).toBeInTheDocument();
    expect(screen.getByText("register.wilayaRequired")).toBeInTheDocument();
    expect(screen.getByText("register.communeRequired")).toBeInTheDocument();
    expect(registerMutateAsync).not.toHaveBeenCalled();
  });

  it("resets an already-chosen commune when the wilaya changes", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/register": <Register /> }, "/register");

    await user.click(screen.getByLabelText("register.wilaya"));
    await user.click(await screen.findByRole("option", { name: wilayaOptionName(mockWilaya) }));
    await user.click(screen.getByLabelText("register.commune"));
    await user.click(await screen.findByRole("option", { name: mockWilaya.communes[0].frName }));
    // The trigger's own displayed value, not a page-wide text search — Radix also renders a
    // visually-hidden native <option> with the same text for form submission, which would
    // otherwise collide with a plain getByText.
    expect(screen.getByLabelText("register.commune")).toHaveTextContent(
      mockWilaya.communes[0].frName,
    );

    await user.click(screen.getByLabelText("register.wilaya"));
    await user.click(await screen.findByRole("option", { name: wilayaOptionName(mockWilayaOran) }));

    expect(screen.getByLabelText("register.commune")).toHaveTextContent("register.selectCommune");
  });

  it("shows the phone-registered message on blur, and it blocks submission", async () => {
    validatePhoneMutateAsync.mockResolvedValue(mockPhoneRegistered);
    const user = userEvent.setup();
    renderWithRoutes({ "/register": <Register /> }, "/register");

    await user.type(screen.getByLabelText("register.phone"), "0550000001");
    await user.tab();

    expect(await screen.findByText("register.phoneRegistered")).toBeInTheDocument();
  });

  it("shows the phone-pending message on blur", async () => {
    validatePhoneMutateAsync.mockResolvedValue(mockPhonePending);
    const user = userEvent.setup();
    renderWithRoutes({ "/register": <Register /> }, "/register");

    await user.type(screen.getByLabelText("register.phone"), "0550000002");
    await user.tab();

    expect(await screen.findByText("register.phonePending")).toBeInTheDocument();
  });

  it("gates the actual registration behind the confirmation dialog", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/register": <Register /> }, "/register");

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "register.submit" }));

    expect(await screen.findByText("register.confirmDetails")).toBeInTheDocument();
    expect(registerMutateAsync).not.toHaveBeenCalled();
  });

  it("shows the success panel once the confirmation is accepted", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/register": <Register /> }, "/register");

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "register.submit" }));
    await screen.findByText("register.confirmDetails");
    await user.click(screen.getByRole("button", { name: "register.confirmAria" }));

    await waitFor(() => expect(registerMutateAsync).toHaveBeenCalled());
    expect(await screen.findByText("register.registrationSuccess")).toBeInTheDocument();
  });
});
