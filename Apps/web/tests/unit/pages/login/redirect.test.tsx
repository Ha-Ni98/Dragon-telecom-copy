import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { UserType } from "@dragon-telecom/contract";
import "../../../fixtures/wrappers/mockTranslation";
import { PublicOnlyRoute } from "@/components/layout/ProtectedRoute";
import * as AuthProviderModule from "@/components/providers/AuthProvider";
import * as useSessionHook from "@/hooks/useSession";

vi.mock("@/components/providers/AuthProvider");
vi.mock("@/hooks/useSession");

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
        <Route path="/staff" element={<div>Staff Dashboard</div>} />
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
  // set-02 D1: /staff is now the fixed StaffDashboard (this test only proves PublicOnlyRoute
  // navigates there for a STAFF session — it renders against a local stub route, not the real
  // page, so the destination's own identity doesn't matter here).
  it("redirects an already-authenticated STAFF member to /staff", () => {
    mockSession(UserType.STAFF);
    renderPublicOnlyRoute("/login");
    expect(screen.getByText("Staff Dashboard")).toBeInTheDocument();
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
