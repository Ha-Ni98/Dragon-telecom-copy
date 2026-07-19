/**
 * Product Utility Functions
 * Helper functions for product name conversion and manipulation
 */

/**
 * Convert product name to kebab-case for URL usage
 * Example: "iPhone 15 Pro Max" -> "iphone-15-pro-max"
 */
export function productNameToKebabCase(productName: string): string {
  return productName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Convert kebab-case back to product name
 * Example: "iphone-15-pro-max" -> "iPhone 15 Pro Max"
 */
export function kebabCaseToProductName(kebabCase: string): string {
  return kebabCase
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate product slug for SEO-friendly URLs
 * Example: "iPhone 15 Pro Max" -> "iphone-15-pro-max"
 */
export function generateProductSlug(productName: string): string {
  return productNameToKebabCase(productName);
}

/**
 * Extract product ID from product name or slug
 * This is a helper function for cases where we need to extract ID from URL
 */
export function extractProductIdFromSlug(slug: string): number | null {
  // This would typically be used with a database lookup
  // For now, we'll return null as we're using name-based routing
  return null;
}

/**
 * Validate product name format
 * Checks if the product name follows the expected format
 */
export function validateProductName(productName: string): boolean {
  if (!productName || typeof productName !== 'string') {
    return false;
  }
  
  const trimmed = productName.trim();
  if (trimmed.length === 0 || trimmed.length > 100) {
    return false;
  }
  
  // Check for valid characters (letters, numbers, spaces, hyphens, parentheses)
  const validPattern = /^[a-zA-Z0-9\s\-\(\)]+$/;
  return validPattern.test(trimmed);
}

/**
 * Sanitize product name for display
 * Removes or replaces problematic characters
 */
export function sanitizeProductName(productName: string): string {
  return productName
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\w\s\-\(\)]/g, '') // Remove special characters except word chars, spaces, hyphens, parentheses
    .substring(0, 100); // Limit length
}

/**
 * Generate product URL path
 * Creates the full URL path for a product
 */
export function generateProductUrl(productName: string): string {
  const slug = generateProductSlug(productName);
  return `/products/${slug}`;
}

/**
 * Parse product URL path
 * Extracts product name from URL path
 */
export function parseProductUrl(urlPath: string): string | null {
  const match = urlPath.match(/^\/products\/(.+)$/);
  if (!match) {
    return null;
  }
  
  const slug = match[1];
  return kebabCaseToProductName(slug);
}

/**
 * Check if two product names are equivalent (case-insensitive, normalized)
 */
export function areProductNamesEquivalent(name1: string, name2: string): boolean {
  const normalized1 = productNameToKebabCase(name1);
  const normalized2 = productNameToKebabCase(name2);
  return normalized1 === normalized2;
}

/**
 * Generate product breadcrumb path
 * Creates breadcrumb navigation for product pages
 */
export function generateProductBreadcrumbs(productName: string, familyName: string, brandName: string): Array<{label: string, url: string}> {
  return [
    { label: 'Home', url: '/' },
    { label: 'Products', url: '/products' },
    { label: familyName, url: `/products?family=${familyName.toLowerCase()}` },
    { label: brandName, url: `/products?brand=${brandName.toLowerCase()}` },
    { label: productName, url: generateProductUrl(productName) }
  ];
}

/**
 * Generate product meta title for SEO
 */
export function generateProductMetaTitle(productName: string, brandName: string): string {
  return `${productName} - ${brandName} | Dragon Telecom`;
}

/**
 * Generate product meta description for SEO
 */
export function generateProductMetaDescription(productName: string, brandName: string, familyName: string, price?: number): string {
  const baseDescription = `Buy ${productName} by ${brandName} - ${familyName}.`;
  const priceText = price ? ` Starting from ${price} DA.` : '';
  const callToAction = ' Professional service, fast delivery, warranty included.';
  
  return baseDescription + priceText + callToAction;
}

/**
 * Generate product keywords for SEO
 */
export function generateProductKeywords(productName: string, brandName: string, familyName: string, modelName: string): string[] {
  const keywords = [
    productName,
    brandName,
    familyName,
    modelName,
    `${brandName} ${productName}`,
    `${familyName} ${brandName}`,
    `${productName} ${brandName}`,
    'Dragon Telecom',
    'Algeria',
    'telecom',
    'electronics'
  ];
  
  // Remove duplicates and filter out empty strings
  return [...new Set(keywords)].filter(keyword => keyword.trim().length > 0);
}
