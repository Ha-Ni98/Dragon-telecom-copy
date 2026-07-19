// Lookup constants and their TS union types

export const clientStatues = ['active', 'pending', 'disabled', 'refused'] as const;
export type ClientStatue = typeof clientStatues[number];

export const clientActionTypes = [
  'browsing-main-page',
  'browsing-products-page',
  'browsing-product-information-page',
  'make-order',
  'login',
] as const;
export type ClientActionType = typeof clientActionTypes[number];

export const categoryStatues = ['disabled', 'active'] as const;
export type CategoryStatue = typeof categoryStatues[number];

export const productStatues = ['disabled', 'active'] as const;
export type ProductStatues = typeof categoryStatues[number];

export const userStatues = ['disabled', 'active'] as const;
export type UserStatue = typeof categoryStatues[number];

export const ordertypes = ['pick-up', 'delivry-home', 'delivry-office'] as const;
export type OrderType = typeof ordertypes[number];

export const orderStatues = [
  'whishlist',
  'pending',
  'canceled',
  'confirmed',
  'canceled-after-confirmation',
  'delivery',
  'completed',
] as const;
export type OrderStatue = typeof orderStatues[number];

export const userRoles = ['admin'] as const;
export type UserRole = typeof userRoles[number];

export const userActionTypes = [
  'modify-client-statue',
  'modify-order-statue',
  'add-product',
  'add-quantity-product',
  'add-invoice',
] as const;
export type UserActionType = typeof userActionTypes[number];

// API Route Constants
export const API_ROUTES = {
  BASE: '/api',
  AUTH: '/api/auth',
  CLIENTS: '/api/clients',
  PRODUCTS: '/api/products',
  ORDERS: '/api/orders',
  SUPPLIERS: '/api/suppliers',
  USERS: '/api/users',
  GET_PHOTOS: '/api/uploads',
  UPLOAD_PHOTOS: '/api/upload',
} as const;
