import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import * as AuthProviderModule from "@/components/providers/AuthProvider";
import { CatchAllRoute } from "@/App";

// CatchAllRoute (PUB-11) only owns two things: which layout wraps the 404 content, and the
// content itself — the layouts' own internals (header/footer, session, cart…) belong to their
// own tests, not this page's, so they're stubbed to a bare, identifiable passthrough.
vi.mock("@/components/providers/AuthProvider");
vi.mock("@/components/layout/PublicLayout", () => ({
  PublicLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="public-layout">{children}</div>
  ),
}));
vi.mock("@/components/layout/AdminLayout", () => ({
  AdminLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="admin-layout">{children}</div>
  ),
}));

function mockAuth(isAuthenticated: boolean) {
  vi.mocked(AuthProviderModule.useAuth).mockReturnValue({
    isAuthenticated,
    isReady: true,
    displayName: null,
    login: vi.fn(),
    isLoggingIn: false,
    logout: vi.fn(),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CatchAllRoute (PUB-11 Not Found)", () => {
  it("renders the 404 title/body and a link back home for a guest", () => {
    mockAuth(false);
    renderWithRoutes({ "*": <CatchAllRoute /> }, "/this-route-does-not-exist");

    expect(screen.getByText("common.errors.notFoundTitle")).toBeInTheDocument();
    expect(screen.getByText("common.errors.notFoundBody")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.actions.goHome" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("wraps the 404 content in PublicLayout for a guest", () => {
    mockAuth(false);
    renderWithRoutes({ "*": <CatchAllRoute /> }, "/gone");
    expect(screen.getByTestId("public-layout")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-layout")).not.toBeInTheDocument();
  });

  it("wraps the 404 content in AdminLayout once authenticated", () => {
    mockAuth(true);
    renderWithRoutes({ "*": <CatchAllRoute /> }, "/gone");
    expect(screen.getByTestId("admin-layout")).toBeInTheDocument();
    expect(screen.queryByTestId("public-layout")).not.toBeInTheDocument();
  });
});
