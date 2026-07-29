export interface Product {
  idProduct: number;
  productName: string;
  productDescription?: string;
  productCodeBar: string;
  productCreatedDate: string; // ISO date string
  idModel: number;
}

export interface Brand {
  idBrand: number;
  brandName: string;
}

export interface Family {
  idFamily: number;
  familyName: string;
}

export interface Model {
  idModel: number;
  idBrand: number;
  idFamily: number;
  modelName: string;
}

export interface ProductSupplier {
  idProductSupplier: number;
  idProduct: number;
  idSupplier?: number;
  unitPrice: number;
  noUserPrice?: number;
  quantity: number;
  issueDate: string; // ISO date
}

export interface ProductSupplierPrice {
  idProductSupplier: number;
  idCategory: number;
  price: number;
}

/**
 * Product image interface for multiple images per product
 */
export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
  order: number;
}

/**
 * Delivery form data interface
 */
export interface DeliveryFormData {
  fullName: string;
  //lastName: string;
  phone: string;
  wilaya: string;
  commune: string;
  address?: string | null;
  deliveryMode: 'home' | 'office';
}

/**
 * Order data interface for product orders
 */
export interface OrderData {
  productId: number;
  quantity: number;
  orderType: 'pickup' | 'delivery';
  totalPrice: number;
  deliveryInfo?: DeliveryFormData;
  deliveryFee?: number;
}

/**
 * Product with pricing information based on user category
 */
export interface ProductWithPricing extends Product {
  brand: Brand;
  model: Model;
  family: Family;
  images: ProductImage[];
  supplier: ProductSupplier;
  categoryPrices: ProductSupplierPrice[];
  currentPrice?: number; // Price for current user's category
  noUserPrice?: number;  // Price for non-registered users
  inStock: boolean;
  stockQuantity: number;
}

/**
 * Enhanced product interface for product details page
 */
export interface ProductDetails extends ProductWithPricing {
  features: string[];
  specifications?: Record<string, string>;
  isNew: boolean;
  rating?: number;
  reviewCount?: number;
  relatedProducts?: number[]; // Array of related product IDs
}

/**
 * Product search and filter interfaces
 */
export interface ProductFilters {
  brand?: number;
  family?: number;
  model?: number;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  isNew?: boolean;
}

export interface ProductSearchResult {
  products: ProductWithPricing[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  filters: ProductFilters;
}


