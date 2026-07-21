import "../../../fixtures/wrappers/mockTranslation";
import { Suspense, lazy } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { UserType } from "@dragon-telecom/contract";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageLoader } from "@/components/shared/PageLoader";
import * as AuthProviderModule from "@/components/providers/AuthProvider";
import * as useSessionHook from "@/hooks/useSession";

// Sprint 2 (set-04 §Foundation) — proves the seven new routes mount inside the real
// RoleGuard -> AdminLayout shell and resolve to their placeholder page without a blank
// screen or crash. Mirrors the App.tsx nesting for the /admin/* subtree (RoleGuard
// allow=[ADMIN, STAFF] -> AdminLayout -> lazy page), not the actual `router` object (App.tsx
// doesn't export it) — same "reconstruct the relevant slice" pattern as
// tests/unit/pages/login/redirect.test.tsx.
vi.mock("@/components/providers/AuthProvider");
vi.mock("@/hooks/useSession");

function mockAdminSession() {
  vi.mocked(AuthProviderModule.useAuth).mockReturnValue({
    isAuthenticated: true,
    isReady: true,
    displayName: "Admin",
    login: vi.fn(),
    isLoggingIn: false,
    logout: vi.fn(),
  } as never);
  vi.mocked(useSessionHook.useSession).mockReturnValue({
    data: { userId: "1", type: UserType.ADMIN, staffId: "1", profile: null },
  } as never);
}

const ROUTES: {
  path: string;
  initial: string;
  titleKey: string;
  importer: () => Promise<unknown>;
}[] = [
  {
    path: "/admin/inventory",
    initial: "/admin/inventory",
    titleKey: "admin.inventory.title",
    importer: () => import("@/pages/admin/inventory/AdminInventory"),
  },
  {
    path: "/admin/supplier-invoices",
    initial: "/admin/supplier-invoices",
    titleKey: "admin.supplierInvoices.title",
    importer: () => import("@/pages/admin/supplier-invoices/AdminSupplierInvoices"),
  },
  {
    path: "/admin/supplier-invoices/:id",
    initial: "/admin/supplier-invoices/new",
    titleKey: "admin.supplierInvoices.editor.title",
    importer: () => import("@/pages/admin/supplier-invoices/AdminSupplierInvoiceEditor"),
  },
  {
    path: "/admin/pos-clients",
    initial: "/admin/pos-clients",
    titleKey: "admin.posClients.title",
    importer: () => import("@/pages/admin/pos-clients/AdminPosClients"),
  },
  {
    path: "/admin/clients/:id",
    initial: "/admin/clients/11111111-1111-4111-8111-111111111111",
    titleKey: "admin.clients.detail.title",
    importer: () => import("@/pages/admin/clients/AdminClientDetail"),
  },
  {
    path: "/admin/users",
    initial: "/admin/users",
    titleKey: "admin.users.title",
    importer: () => import("@/pages/admin/users/AdminUsers"),
  },
  {
    path: "/admin/activity/staff-searches",
    initial: "/admin/activity/staff-searches",
    titleKey: "admin.staffSearches.title",
    importer: () => import("@/pages/admin/staff-searches/AdminStaffSearches"),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockAdminSession();
});

describe("set-04 new admin routes (Sprint 2 — route registration smoke)", () => {
  it.each(ROUTES)(
    "mounts $path inside RoleGuard -> AdminLayout and resolves the page without a blank/error screen",
    async ({ path, initial, titleKey, importer }) => {
      const LazyPage = lazy(importer as () => Promise<{ default: React.ComponentType }>);

      render(
        <MemoryRouter initialEntries={[initial]}>
          <Routes>
            <Route element={<RoleGuard allow={[UserType.ADMIN, UserType.STAFF]} />}>
              <Route element={<AdminLayout />}>
                <Route
                  path={path}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <LazyPage />
                    </Suspense>
                  }
                />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      // The page resolves past the lazy-import Suspense boundary...
      expect(await screen.findByText(titleKey)).toBeInTheDocument();
      // ...and the AdminLayout shell (sidebar nav) never unmounted around it.
      expect(screen.getByText("admin.nav.dashboard")).toBeInTheDocument();
    },
  );
});
