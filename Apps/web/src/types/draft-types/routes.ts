// routes.ts
// Centralized routes definition with enums for client and admin

export enum ClientRoutes {
  HOME = "/",
  PRODUCTS = "/products",
  LOGIN = "/login",
  REGISTER = "/register",
  ACCOUNT = "/my-account",
  ORDERS = "/orders",
}

export enum AdminRoutes {
  DASHBOARD = "/admin/",
  PRODUCTS = "/admin/products",
  ADD_PRODUCT = "/admin/products/add-product",
  CLIENTS = "/admin/clients",
  SUPPLIERS = "/admin/suppliers",
  ORDERS = "/admin/orders",
  STATISTICS = "/admin/statistics",
  SETTINGS = "/admin/settings",
  LOGS = "/admin/logs",
}

// 🔗 Dynamic routes as helper functions
export const DynamicRoutes = {
  CLIENT: {
    PRODUCT_INFO: (productName: string) => `/products/${productName}`, // kebab-case
  },
  ADMIN: {
    PRODUCT_INFO: (productName: string) => `/admin/products/${productName}`,
    ADD_SUPPLY: (productId: number | string) => `/admin/products/${productId}/add-supply`,
    SUPPLIER_INFO: (idSupplier: number | string) => `/admin/suppliers/${idSupplier}`,
  },
};
