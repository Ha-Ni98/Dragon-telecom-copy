import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { UserType, PageKey } from "@dragon-telecom/contract";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import { PublicOnlyRoute } from "@/components/layout/ProtectedRoute";
import * as AuthProviderModule from "@/components/providers/AuthProvider";
import * as useSessionHook from "@/hooks/useSession";
import * as usePermissionsHook from "@/hooks/usePermissions";
import { STAFF_PAGE_ROUTES } from "@/lib/staff-pages";
import StaffLanding from "@/pages/StaffLanding";

vi.mock("@/components/providers/AuthProvider");
vi.mock("@/hooks/useSession");
vi.mock("@/hooks/usePermissions");

function mockAuth() {
  vi.mocked(AuthProviderModule.useAuth).mockReturnValue({
    isAuthenticated: true,
    isReady: true,
    displayName: null,
    login: vi.fn(),
    isLoggingIn: false,
    logout: vi.fn(),
  } as never);
}

function mockSession(type: UserType, extra: Record<string, unknown> = {}) {
  vi.mocked(useSessionHook.useSession).mockReturnValue({
    data: { userId: "1", type, staffId: "1", profile: null, ...extra },
  } as never);
}

function renderPublicOnlyRoute(initialRoute: string, state?: unknown) {
  const initialEntries = state ? [{ pathname: initialRoute, state }] : [initialRoute];
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<div>Public Home</div>} />
        <Route path="/admin" element={<div>Admin Home</div>} />
        <Route path="/staff" element={<div>Staff Landing</div>} />
        <Route path="/my-account" element={<div>My Account</div>} />
        <Route path="/orders" element={<div>Orders Page</div>} />
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<div>Login Form</div>} />
          <Route path="/register" element={<div>Register Form</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth();
});

describe("PublicOnlyRoute — role-based redirect targets (PUB-06/PUB-07)", () => {
  it("redirects an already-authenticated STAFF member to /staff", () => {
    mockSession(UserType.STAFF);
    renderPublicOnlyRoute("/login");
    expect(screen.getByText("Staff Landing")).toBeInTheDocument();
  });

  it("redirects an already-authenticated CLIENT off /register to /my-account, not /", () => {
    mockSession(UserType.CLIENT);
    renderPublicOnlyRoute("/register");
    expect(screen.getByText("My Account")).toBeInTheDocument();
  });

  it("sends an already-authenticated CLIENT back to their attempted page off /login", () => {
    mockSession(UserType.CLIENT);
    renderPublicOnlyRoute("/login", { from: "/orders" });
    expect(screen.getByText("Orders Page")).toBeInTheDocument();
  });
});

describe("StaffLanding (PUB-06 D4)", () => {
  it("shows the no-permitted-pages empty state when no destination has shipped yet", () => {
    vi.mocked(usePermissionsHook.usePermissions).mockReturnValue({
      data: [PageKey.STAFF_POS],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    renderWithRoutes({ "/staff": <StaffLanding /> }, "/staff");
    expect(screen.getByText("staff.landing.noPermittedPages")).toBeInTheDocument();
  });

  it("shows a local retry action on a permissions-fetch error", () => {
    const refetch = vi.fn();
    vi.mocked(usePermissionsHook.usePermissions).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as never);
    renderWithRoutes({ "/staff": <StaffLanding /> }, "/staff");
    expect(screen.getByText("staff.landing.errorLoading")).toBeInTheDocument();
  });

  describe("once a permitted page has a shipped route", () => {
    afterEach(() => {
      delete STAFF_PAGE_ROUTES[PageKey.STAFF_POS];
    });

    it("navigates straight to the first permitted+shipped page", () => {
      STAFF_PAGE_ROUTES[PageKey.STAFF_POS] = "/staff/pos";
      vi.mocked(usePermissionsHook.usePermissions).mockReturnValue({
        data: [PageKey.STAFF_POS],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as never);
      renderWithRoutes({ "/staff": <StaffLanding />, "/staff/pos": <div>POS Page</div> }, "/staff");
      expect(screen.getByText("POS Page")).toBeInTheDocument();
    });
  });
});
