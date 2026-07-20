import { lazy, Suspense, useEffect, type ComponentType, type LazyExoticComponent } from "react";
import { createBrowserRouter, Link, RouterProvider } from "react-router-dom";
import { UserType } from "@dragon-telecom/contract";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/layout/ProtectedRoute";
import { PageLoader } from "@/components/shared/PageLoader";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { RouteErrorBoundary } from "@/components/shared/RouteErrorBoundary";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTranslation } from "@/hooks/useTranslation";
import { setRedirect } from "@/lib/axios";

const Index = lazy(() => import("@/pages/Index"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const Register = lazy(() => import("@/pages/Register"));
const Products = lazy(() => import("@/pages/Products"));
const ProductDetails = lazy(() => import("@/pages/ProductDetails"));
const OrdersPage = lazy(() => import("@/pages/Orders"));
const MyAccount = lazy(() => import("@/pages/MyAccount"));
const StaffLanding = lazy(() => import("@/pages/StaffLanding"));

const AdminDashboard = lazy(() => import("@/pages/admin/dashboard/AdminDashboard"));
const AdminClients = lazy(() => import("@/pages/admin/clients/AdminClients"));
const AdminOrders = lazy(() => import("@/pages/admin/orders/AdminOrders"));
const AdminProducts = lazy(() => import("@/pages/admin/products/AdminProducts"));
const AdminProductsAdd = lazy(() => import("@/pages/admin/products/AdminProductsAdd"));
const AdminProductInformation = lazy(() => import("@/pages/admin/products/AdminProductInformation"));
const AdminSuppliers = lazy(() => import("@/pages/admin/suppliers/AdminSuppliers"));
const AdminSupplierInformation = lazy(() => import("@/pages/admin/suppliers/AdminSupplierInformation"));
const AdminStatistics = lazy(() => import("@/pages/admin/statistics/AdminStatistics"));
const AdminLogs = lazy(() => import("@/pages/admin/logs/AdminLogs"));
const AdminSettings = lazy(() => import("@/pages/admin/settings/AdminSettings"));

const withSuspense = (Component: LazyExoticComponent<ComponentType<Record<string, never>>>) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

// Not a matched child route, so it can't rely on <Outlet/> resolving to a page — it picks
// the layout that matches the current session and passes 404 content in as children.
// Exported (PUB-11) so pub-pages Sprint 8's unit test can render it directly.
export function CatchAllRoute() {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const content = (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <NotFoundState
        eyebrow="404"
        title={t("common.errors.notFoundTitle")}
        body={t("common.errors.notFoundBody")}
        action={
          <Button asChild>
            <Link to="/">{t("common.actions.goHome")}</Link>
          </Button>
        }
      />
    </div>
  );
  return isAuthenticated ? (
    <AdminLayout>{content}</AdminLayout>
  ) : (
    <PublicLayout>{content}</PublicLayout>
  );
}

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: withSuspense(Index), errorElement: <RouteErrorBoundary /> },
      { path: "/products", element: withSuspense(Products), errorElement: <RouteErrorBoundary /> },
      // PUB-03: "by id — never by name" (overrides the MVP's old by-name slug, source-of-truth
      // ruling — the requirement wins over pre-existing Apps/web routing).
      {
        path: "/products/:id",
        element: withSuspense(ProductDetails),
        errorElement: <RouteErrorBoundary />,
      },
      {
        // Any-authenticated pages — not role-restricted, just "must be signed in".
        element: <ProtectedRoute />,
        children: [
          { path: "/orders", element: withSuspense(OrdersPage), errorElement: <RouteErrorBoundary /> },
        ],
      },
      {
        // CLIENT-only (PUB-08) — distinct from the any-authenticated block above so staff/admin
        // can't reach the client account surface.
        element: <RoleGuard allow={[UserType.CLIENT]} />,
        children: [
          { path: "/my-account", element: withSuspense(MyAccount), errorElement: <RouteErrorBoundary /> },
        ],
      },
    ],
  },
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        path: "/login",
        element: withSuspense(LoginPage),
        errorElement: (
          <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="w-full max-w-md">
              <RouteErrorBoundary />
            </div>
          </div>
        ),
      },
      {
        path: "/register",
        element: withSuspense(Register),
        errorElement: (
          <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="w-full max-w-md">
              <RouteErrorBoundary />
            </div>
          </div>
        ),
      },
    ],
  },
  {
    // EXTENSION POINT (auth, role-based): admin back-office is shared by ADMIN (bypasses the
    // Page-permission matrix entirely) and STAFF (scoped per-page via the identity module's
    // Page registry — see identity-sprint1-decisions memory). Per-page-key restriction for
    // STAFF is a Sub-02 concern; this guard only enforces the coarse public/admin split.
    element: <RoleGuard allow={[UserType.ADMIN, UserType.STAFF]} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: "/admin", element: withSuspense(AdminDashboard), errorElement: <RouteErrorBoundary /> },
          // PUB-06 (D4): staff land here after login/PublicOnlyRoute and are forwarded to their
          // first permitted page (lib/staff-pages.ts) — a thin landing, not a destination page.
          { path: "/staff", element: withSuspense(StaffLanding), errorElement: <RouteErrorBoundary /> },
          {
            path: "/admin/clients",
            element: withSuspense(AdminClients),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: "/admin/orders",
            element: withSuspense(AdminOrders),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: "/admin/products",
            element: withSuspense(AdminProducts),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: "/admin/products/add",
            element: withSuspense(AdminProductsAdd),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: "/admin/products/:productId",
            element: withSuspense(AdminProductInformation),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: "/admin/suppliers",
            element: withSuspense(AdminSuppliers),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: "/admin/suppliers/:idSupplier",
            element: withSuspense(AdminSupplierInformation),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: "/admin/statistics",
            element: withSuspense(AdminStatistics),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: "/admin/logs",
            element: withSuspense(AdminLogs),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: "/admin/settings",
            element: withSuspense(AdminSettings),
            errorElement: <RouteErrorBoundary />,
          },
        ],
      },
    ],
  },
  { path: "*", element: <CatchAllRoute /> },
]);

// Bridges the axios 401 interceptor to React Router's navigation, registered once here
// rather than via a hook, since the interceptor lives outside any component tree.
setRedirect((path) => router.navigate(path));

export default function App() {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = t("common.brand.pageTitle");
  }, [t]);

  return <RouterProvider router={router} />;
}
