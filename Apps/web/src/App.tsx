import { lazy, Suspense, useEffect, type ComponentType, type LazyExoticComponent } from "react";
import { createBrowserRouter, Link, RouterProvider } from "react-router-dom";
import { UserType, PageKey } from "@dragon-telecom/contract";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { StaffLayout } from "@/components/layout/StaffLayout";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { PageGuard } from "@/components/layout/PageGuard";
import { PublicOnlyRoute } from "@/components/layout/ProtectedRoute";
import { PageLoader } from "@/components/shared/PageLoader";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { RouteErrorBoundary } from "@/components/shared/RouteErrorBoundary";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { usePublicSettings } from "@/hooks/usePlatform";
import { setRedirect } from "@/lib/axios";

const Index = lazy(() => import("@/pages/Index"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const Register = lazy(() => import("@/pages/Register"));
const Products = lazy(() => import("@/pages/Products"));
const ProductDetails = lazy(() => import("@/pages/ProductDetails"));
const OrdersPage = lazy(() => import("@/pages/Orders"));
const MyAccount = lazy(() => import("@/pages/MyAccount"));
const Cart = lazy(() => import("@/pages/cart/Cart"));
const OrderConfirmation = lazy(() => import("@/pages/order-confirmation/OrderConfirmation"));
const MyInvoices = lazy(() => import("@/pages/my-invoices/MyInvoices"));
const InvoiceDetail = lazy(() => import("@/pages/my-invoices/InvoiceDetail"));
const StaffDashboard = lazy(() => import("@/pages/staff/dashboard/StaffDashboard"));
const StaffProducts = lazy(() => import("@/pages/staff/products/StaffProducts"));
// set-03: the five staff/admin twins — each staff page takes a `scope` prop (default "staff");
// the admin variant is a thin wrapper mounting the same tree with scope="admin" (plan.md's
// twin pattern — one component tree, not a fork).
const StaffPos = lazy(() => import("@/pages/staff/pos/StaffPos"));
const StaffPosClients = lazy(() => import("@/pages/staff/pos-clients/StaffPosClients"));
const StaffOrders = lazy(() => import("@/pages/staff/orders/StaffOrders"));
const StaffSales = lazy(() => import("@/pages/staff/sales/StaffSales"));
const StaffInvoices = lazy(() => import("@/pages/staff/invoices/StaffInvoices"));
const StaffRepairs = lazy(() => import("@/pages/staff/repairs/StaffRepairs"));

const AdminDashboard = lazy(() => import("@/pages/admin/dashboard/AdminDashboard"));
const AdminClients = lazy(() => import("@/pages/admin/clients/AdminClients"));
const AdminOrders = lazy(() => import("@/pages/admin/orders/AdminOrders"));
const AdminProducts = lazy(() => import("@/pages/admin/products/AdminProducts"));
const AdminProductsAdd = lazy(() => import("@/pages/admin/products/AdminProductsAdd"));
const AdminProductInformation = lazy(
  () => import("@/pages/admin/products/AdminProductInformation"),
);
const AdminSuppliers = lazy(() => import("@/pages/admin/suppliers/AdminSuppliers"));
const AdminSupplierInformation = lazy(
  () => import("@/pages/admin/suppliers/AdminSupplierInformation"),
);
const AdminStatistics = lazy(() => import("@/pages/admin/statistics/AdminStatistics"));
const AdminCashRegister = lazy(() => import("@/pages/admin/cash-register/AdminCashRegister"));
const AdminLogs = lazy(() => import("@/pages/admin/logs/AdminLogs"));
const AdminSettings = lazy(() => import("@/pages/admin/settings/AdminSettings"));
const AdminPos = lazy(() => import("@/pages/admin/pos/AdminPos"));
const AdminSales = lazy(() => import("@/pages/admin/sales/AdminSales"));
const AdminInvoices = lazy(() => import("@/pages/admin/invoices/AdminInvoices"));
const AdminRepairs = lazy(() => import("@/pages/admin/repairs/AdminRepairs"));
// set-04: the remaining admin back-office pages (plan.md's ten-page list) — Sprint 2 mounts
// the routes; the pages themselves are placeholders until Sprints 4-8 build them out.
const AdminInventory = lazy(() => import("@/pages/admin/inventory/AdminInventory"));
const AdminSupplierInvoices = lazy(
  () => import("@/pages/admin/supplier-invoices/AdminSupplierInvoices"),
);
const AdminSupplierInvoiceEditor = lazy(
  () => import("@/pages/admin/supplier-invoices/AdminSupplierInvoiceEditor"),
);
const AdminPosClients = lazy(() => import("@/pages/admin/pos-clients/AdminPosClients"));
const AdminClientDetail = lazy(() => import("@/pages/admin/clients/AdminClientDetail"));
const AdminUsers = lazy(() => import("@/pages/admin/users/AdminUsers"));
const AdminStaffSearches = lazy(() => import("@/pages/admin/staff-searches/AdminStaffSearches"));

const withSuspense = (Component: LazyExoticComponent<ComponentType<Record<string, never>>>) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

// Not a matched child route, so it can't rely on <Outlet/> resolving to a page. Deliberately
// shell-less for every user (S2, G5) — it used to pick AdminLayout for any authenticated
// session, which meant a signed-in CLIENT hitting a bad URL saw the admin sidebar. A 404 is one
// screen and needs no navigation chrome regardless of who's looking at it.
// Exported (PUB-11) so pub-pages Sprint 8's unit test can render it directly.
export function CatchAllRoute() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
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
      // set-02 D9/D12: public and state-guarded internally (Sprint 5), not route-guarded — a
      // guest who just placed a delivery order needs to see this too (PUB-05: "guests keep the
      // reference as their only handle").
      {
        path: "/order-confirmation",
        element: withSuspense(OrderConfirmation),
        errorElement: <RouteErrorBoundary />,
      },
      {
        // CLIENT-only (PUB-04/08/09/10). set-02 D12 moved /orders here from the any-
        // authenticated ProtectedRoute block that used to wrap it — staff/admin must not reach
        // the client order/cart/invoice surface — and added /cart, /invoices.
        element: <RoleGuard allow={[UserType.CLIENT]} />,
        children: [
          {
            path: "/my-account",
            element: withSuspense(MyAccount),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: "/orders",
            element: withSuspense(OrdersPage),
            errorElement: <RouteErrorBoundary />,
          },
          { path: "/cart", element: withSuspense(Cart), errorElement: <RouteErrorBoundary /> },
          {
            path: "/invoices",
            element: withSuspense(MyInvoices),
            errorElement: <RouteErrorBoundary />,
          },
          {
            // set-02 Sprint 5: plan.md left "dialog or /invoices/:number" open for this sprint
            // to decide — a route was chosen over a dialog (InvoiceView's lines table doesn't
            // fit a modal well, and its own local-404 branch reads more naturally as a page).
            path: "/invoices/:number",
            element: withSuspense(InvoiceDetail),
            errorElement: <RouteErrorBoundary />,
          },
        ],
      },
    ],
  },
  {
    // S15 — nested inside PublicLayout so /login and /register get the storefront header/footer
    // (theme + language toggles live there now; the pages no longer render their own pair).
    element: <PublicOnlyRoute />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          {
            path: "/login",
            element: withSuspense(LoginPage),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: "/register",
            element: withSuspense(Register),
            errorElement: <RouteErrorBoundary />,
          },
        ],
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
          {
            path: "/admin",
            element: withSuspense(AdminDashboard),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: "/admin/clients",
            element: withSuspense(AdminClients),
            errorElement: <RouteErrorBoundary />,
          },
          {
            // declared after the static /admin/clients route above so the two never collide
            // (Sprint 2 §Risks — react-router v6 also ranks static segments first regardless
            // of declaration order, this is belt-and-suspenders for readability).
            path: "/admin/clients/:id",
            element: withSuspense(AdminClientDetail),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: "/admin/inventory",
            element: withSuspense(AdminInventory),
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
            path: "/admin/supplier-invoices",
            element: withSuspense(AdminSupplierInvoices),
            errorElement: <RouteErrorBoundary />,
          },
          {
            // `:id === "new"` is the create-flow sentinel (no separate `/new` route — Sprint 2
            // §Risks); `?supplierId=` preselects the supplier when linked from ADM-07.
            path: "/admin/supplier-invoices/:id",
            element: withSuspense(AdminSupplierInvoiceEditor),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: "/admin/pos-clients",
            element: withSuspense(AdminPosClients),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: "/admin/users",
            element: withSuspense(AdminUsers),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: "/admin/activity/staff-searches",
            element: withSuspense(AdminStaffSearches),
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
          {
            path: "/admin/pos",
            element: withSuspense(AdminPos),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: "/admin/sales",
            element: withSuspense(AdminSales),
            errorElement: <RouteErrorBoundary />,
          },
          {
            // S33 (P9) — the Caisse is admin-only; the surrounding /admin group also admits STAFF.
            element: <RoleGuard allow={[UserType.ADMIN]} fallbackPath="/admin" />,
            children: [
              {
                path: "/admin/cash-register",
                element: withSuspense(AdminCashRegister),
                errorElement: <RouteErrorBoundary />,
              },
            ],
          },
          {
            path: "/admin/invoices",
            element: withSuspense(AdminInvoices),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: "/admin/repairs",
            element: withSuspense(AdminRepairs),
            errorElement: <RouteErrorBoundary />,
          },
        ],
      },
      {
        // set-02 D1/D11: StaffDashboard replaces the old StaffLanding redirect — /staff is now
        // a fixed page (mirrors /admin), not a first-permitted-page landing. /staff/products is
        // additionally gated per-PageKey (PageGuard), layered inside the coarse role split
        // above (identity-sprint1-decisions: admin's effectivePages() always includes every
        // PageKey, so PageGuard never blocks an admin here).
        element: <StaffLayout />,
        children: [
          {
            path: "/staff",
            element: withSuspense(StaffDashboard),
            errorElement: <RouteErrorBoundary />,
          },
          {
            element: <PageGuard requires={PageKey.STAFF_PRODUCTS} />,
            children: [
              {
                path: "/staff/products",
                element: withSuspense(StaffProducts),
                errorElement: <RouteErrorBoundary />,
              },
            ],
          },
          {
            element: <PageGuard requires={PageKey.STAFF_POS} />,
            children: [
              {
                path: "/staff/pos",
                element: withSuspense(StaffPos),
                errorElement: <RouteErrorBoundary />,
              },
            ],
          },
          {
            // S18/D-5 — the staff POS-clients page (full parity with /admin/pos-clients).
            element: <PageGuard requires={PageKey.STAFF_POS_CLIENTS} />,
            children: [
              {
                path: "/staff/pos-clients",
                element: withSuspense(StaffPosClients),
                errorElement: <RouteErrorBoundary />,
              },
            ],
          },
          {
            element: <PageGuard requires={PageKey.STAFF_ORDERS} />,
            children: [
              {
                path: "/staff/orders",
                element: withSuspense(StaffOrders),
                errorElement: <RouteErrorBoundary />,
              },
            ],
          },
          {
            element: <PageGuard requires={PageKey.STAFF_SALES} />,
            children: [
              {
                path: "/staff/sales",
                element: withSuspense(StaffSales),
                errorElement: <RouteErrorBoundary />,
              },
            ],
          },
          {
            element: <PageGuard requires={PageKey.STAFF_INVOICES} />,
            children: [
              {
                path: "/staff/invoices",
                element: withSuspense(StaffInvoices),
                errorElement: <RouteErrorBoundary />,
              },
            ],
          },
          {
            element: <PageGuard requires={PageKey.STAFF_REPAIRS} />,
            children: [
              {
                path: "/staff/repairs",
                element: withSuspense(StaffRepairs),
                errorElement: <RouteErrorBoundary />,
              },
            ],
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
  const { data: publicSettings } = usePublicSettings();

  useEffect(() => {
    document.title = t("common.brand.pageTitle");
  }, [t]);

  // Store logo doubles as the browser-tab favicon once uploaded (Settings → Store → Logos);
  // until then the tag is left absent and the browser falls back to its own default.
  useEffect(() => {
    const logoUrl = publicSettings?.store.logoUrl;
    if (!logoUrl) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = logoUrl;
  }, [publicSettings?.store.logoUrl]);

  return <RouterProvider router={router} />;
}
