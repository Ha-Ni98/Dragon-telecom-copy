import { mockProducts } from "@/mocks/products";
import { mockProductsWithPricing, mockProductDetails, getProductByName, getProductPricing } from "@/mocks/enhanced-products";
import type { Product, ProductWithPricing, ProductDetails } from "@/types/draft-types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch all products (legacy function for backward compatibility)
 */
export async function fetchProducts(): Promise<Product[]> {
  await sleep(150);
  return mockProducts;
}

/**
 * Fetch featured products (legacy function for backward compatibility)
 */
export async function fetchFeaturedProducts(limit: number = 4): Promise<Product[]> {
  await sleep(100);
  return mockProducts.slice(0, limit);
}

/**
 * Fetch product by name (kebab-case)
 * This is the main function for the product information page
 */
export async function fetchProductByName(name: string): Promise<ProductDetails | null> {
  await sleep(200); // Simulate API delay
  
  try {
    const product = getProductByName(name);
    if (!product) {
      throw new Error(`Product not found: ${name}`);
    }
    return product;
  } catch (error) {
    console.error('Error fetching product by name:', error);
    return null;
  }
}

/**
 * Fetch product with complete details by ID
 */
export async function fetchProductWithDetails(id: number): Promise<ProductDetails | null> {
  await sleep(150);
  
  try {
    const product = mockProductDetails.find(p => p.idProduct === id);
    if (!product) {
      throw new Error(`Product not found: ${id}`);
    }
    return product;
  } catch (error) {
    console.error('Error fetching product with details:', error);
    return null;
  }
}

/**
 * Fetch product pricing for specific category
 */
export async function fetchProductPricing(productId: number, categoryId: number): Promise<number | null> {
  await sleep(100);
  
  try {
    const price = getProductPricing(productId, categoryId);
    return price;
  } catch (error) {
    console.error('Error fetching product pricing:', error);
    return null;
  }
}

/**
 * Fetch all products with pricing information
 */
export async function fetchProductsWithPricing(): Promise<ProductWithPricing[]> {
  await sleep(200);
  
  try {
    return mockProductsWithPricing;
  } catch (error) {
    console.error('Error fetching products with pricing:', error);
    return [];
  }
}

/**
 * Search products by name, brand, or family
 */
export async function searchProducts(query: string): Promise<ProductDetails[]> {
  await sleep(300);
  
  try {
    const lowercaseQuery = query.toLowerCase();
    return mockProductDetails.filter(product => 
      product.productName.toLowerCase().includes(lowercaseQuery) ||
      product.brand.brandName.toLowerCase().includes(lowercaseQuery) ||
      product.family.familyName.toLowerCase().includes(lowercaseQuery) ||
      product.model.modelName.toLowerCase().includes(lowercaseQuery)
    );
  } catch (error) {
    console.error('Error searching products:', error);
    return [];
  }
}

/**
 * Get related products based on family
 */
export async function fetchRelatedProducts(productId: number, limit: number = 4): Promise<ProductDetails[]> {
  await sleep(150);
  
  try {
    const product = mockProductDetails.find(p => p.idProduct === productId);
    if (!product) {
      return [];
    }
    
    return mockProductDetails
      .filter(p => p.family.idFamily === product.family.idFamily && p.idProduct !== productId)
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching related products:', error);
    return [];
  }
}


