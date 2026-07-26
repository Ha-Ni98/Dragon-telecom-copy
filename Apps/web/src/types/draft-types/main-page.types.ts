import { Brand, Family, Model, Product } from "./product.types";

/**
 * Brand with product count for main page display
 */
export interface BrandWithCount {
  idBrand: number;
  brandName: string;
  logo?: string;
  productCount: number;
}

/**
 * Enhanced product interface with all details needed for main page
 */
export interface ProductWithDetails {
  idProduct: number;
  productName: string;
  productDescription?: string;
  productCodeBar: string;
  brand: Brand;
  model: Model;
  family: Family;
  image?: string;
  price?: number;
  inStock: boolean;
  isNew: boolean;
  rating?: number;
  reviews?: number;
  features?: string[];
}

/**
 * Product suggestion for search functionality
 */
export interface ProductSuggestion {
  idProduct: number;
  productName: string;
  brand: string;
  image?: string;
  price?: number;
}

/**
 * Cart item interface
 */
export interface CartItem {
  product: ProductWithDetails;
  quantity: number;
  unitPrice: number;
}

/**
 * Search result interface
 */
export interface SearchResult {
  idProduct: number;
  productName: string;
  brand: string;
  category: string;
  price?: number;
  image?: string;
}

/**
 * Category with product count for main page display
 */
export interface CategoryWithCount {
  idFamily: number;
  familyName: string;
  icon?: string;
  productCount: number;
}

/**
 * Hero section product showcase
 */
export interface HeroProduct {
  idProduct: number;
  productName: string;
  brand: string;
  image?: string;
  price?: number;
  description?: string;
}

/**
 * Wishlist item interface
 */
export interface WishlistItem {
  product: ProductWithDetails;
  addedDate: string; // ISO date
}
