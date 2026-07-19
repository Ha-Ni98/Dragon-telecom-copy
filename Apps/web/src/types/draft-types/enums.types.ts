export enum ClientStatusCode {
  active = 0,
  pending = 1,
  disabled = 2,
  refused = 3,
}

export enum CategoryStatusCode {
  active = 0,
  disabled = 1,
}

export enum OrderTypeCode {
  "pick-up" = 0,
  "delivry-home" = 1,
  "delivry-office" = 2,
}

export enum OrderStatusCode {
  whishlist = 0,
  pending = 1,
  canceled = 2,
  confirmed = 3,
  delivery = 4,
  completed = 5,
}

export enum UserRoleCode {
  admin = 0,
}

export enum ActionTypeCode {
  "modify-client-statue" = 0,
  "modify-order-statue" = 1,
  "add-product" = 2,
  "add-supplier-product" = 3,
  "add-invoice" = 4,
}

/**
 * Human-readable labels for action types
 */
export const ActionTypeLabels = {
  [ActionTypeCode["modify-client-statue"]]: "Modify Client Status",
  [ActionTypeCode["modify-order-statue"]]: "Modify Order Status", 
  [ActionTypeCode["add-product"]]: "Add Product",
  [ActionTypeCode["add-supplier-product"]]: "Add Supplier Product",
  [ActionTypeCode["add-invoice"]]: "Add Invoice",
} as const;
