import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import * as AuthProviderModule from "@/components/providers/AuthProvider";
import LoginPage from "@/pages/LoginPage";

vi.mock("@/components/providers/AuthProvider");

const login = vi.fn();

function mockAuth(isLoggingIn = false) {
  vi.mocked(AuthProviderModule.useAuth).mockReturnValue({
    isAuthenticated: false,
    isReady: true,
    displayName: null,
    login,
    isLoggingIn,
    logout: vi.fn(),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth();
});

describe("LoginPage", () => {
  it("renders the username and password fields", () => {
    renderWithRoutes({ "/login": <LoginPage /> }, "/login");
    expect(screen.getByLabelText("auth.login.username")).toBeInTheDocument();
    expect(screen.getByLabelText("auth.login.password")).toBeInTheDocument();
  });

  it("submits the entered credentials to login()", async () => {
    const user = userEvent.setup();
    login.mockResolvedValue(undefined);
    renderWithRoutes({ "/login": <LoginPage /> }, "/login");

    await user.type(screen.getByLabelText("auth.login.username"), "admin");
    await user.type(screen.getByLabelText("auth.login.password"), "secret123");
    await user.click(screen.getByRole("button", { name: "auth.login.submit" }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({ username: "admin", password: "secret123" }),
    );
  });

  it("shows an error message when login rejects", async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new Error("bad"));
    renderWithRoutes({ "/login": <LoginPage /> }, "/login");

    await user.type(screen.getByLabelText("auth.login.username"), "admin");
    await user.type(screen.getByLabelText("auth.login.password"), "wrong");
    await user.click(screen.getByRole("button", { name: "auth.login.submit" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("shows a Zod required error on both fields for an empty submit, and never calls login()", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/login": <LoginPage /> }, "/login");

    await user.click(screen.getByRole("button", { name: "auth.login.submit" }));

    await waitFor(() => expect(screen.getAllByText("auth.login.emptyFields")).toHaveLength(2));
    expect(login).not.toHaveBeenCalled();
  });

  it("disables the submit button and shows the submitting label while logging in", () => {
    mockAuth(true);
    renderWithRoutes({ "/login": <LoginPage /> }, "/login");

    const submitButton = screen.getByRole("button", { name: /auth\.login\.submitting/ });
    expect(submitButton).toBeDisabled();
  });

  it("links to /register to create an account", () => {
    renderWithRoutes({ "/login": <LoginPage /> }, "/login");
    expect(screen.getByRole("link", { name: "auth.createAccount" })).toHaveAttribute(
      "href",
      "/register",
    );
  });
});
