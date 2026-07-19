import { lazy, Suspense, useEffect, type LazyExoticComponent, type JSX } from "react";
import { createBrowserRouter, Link, RouterProvider } from "react-router-dom";
import { UserType } from "@dragon-telecom/contract";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { PublicOnlyRoute } from "@/components/layout/ProtectedRoute";
import { PageLoader } from "@/components/shared/PageLoader";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { RouteErrorBoundary } from "@/components/shared/RouteErrorBoundary";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTranslation } from "@/hooks/useTranslation";
import { setRedirect } from "@/lib/axios";

const LandingPage = lazy(() => import("@/pages/LandingPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const AdminDashboardPage = lazy(() => import("@/pages/admin/DashboardPage"));

const withSuspense = (Component: LazyExoticComponent<() => JSX.Element>) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

// Not a matched child route, so it can't rely on <Outlet/> resolving to a page — it picks
// the layout that matches the current session and passes 404 content in as children.
function CatchAllRoute() {
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
      { index: true, element: withSuspense(LandingPage), errorElement: <RouteErrorBoundary /> },
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
    ],
  },
  {
    // EXTENSION POINT (auth, role-based): this subtree is admin-only. Add more RoleGuard
    // blocks — or a <ProtectedRoute /> block for any-authenticated pages — as your app grows.
    element: <RoleGuard allow={[UserType.ADMIN]} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          {
            path: "/admin",
            element: withSuspense(AdminDashboardPage),
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
