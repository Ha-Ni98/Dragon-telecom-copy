import { AdminProductWithFullDetails, AdminProductImage } from '@/types/draft-types/admin-product-information.types';
import { ProductSupplierWithDetails } from '@/types/draft-types/admin-product-information.types';
import { mockAdminProducts } from './admin-products';
import { mockBrands, mockFamilies, mockModels } from './products';
import { mockSuppliers } from './suppliers';

/**
 * Mock product images with metadata
 */
const mockProductImages: AdminProductImage[] = [
  {
    id: 'img_1_1',
    url: '/images/products/galaxy-s21-1.jpg',
    alt: 'Galaxy S21 Front View',
    isPrimary: true,
    order: 1,
    uploadedAt: '2024-01-15T10:00:00Z',
    fileSize: 1024000,
    mimeType: 'image/jpeg',
  },
  {
    id: 'img_1_2',
    url: '/images/products/galaxy-s21-2.jpg',
    alt: 'Galaxy S21 Back View',
    isPrimary: false,
    order: 2,
    uploadedAt: '2024-01-15T10:05:00Z',
    fileSize: 980000,
    mimeType: 'image/jpeg',
  },
  {
    id: 'img_2_1',
    url: '/images/products/galaxy-s24-ultra-1.jpg',
    alt: 'Galaxy S24 Ultra Front View',
    isPrimary: true,
    order: 1,
    uploadedAt: '2024-01-20T10:00:00Z',
    fileSize: 1200000,
    mimeType: 'image/jpeg',
  },
  {
    id: 'img_2_2',
    url: '/images/products/galaxy-s24-ultra-2.jpg',
    alt: 'Galaxy S24 Ultra Back View',
    isPrimary: false,
    order: 2,
    uploadedAt: '2024-01-20T10:05:00Z',
    fileSize: 1100000,
    mimeType: 'image/jpeg',
  },
  {
    id: 'img_2_3',
    url: '/images/products/galaxy-s24-ultra-3.jpg',
    alt: 'Galaxy S24 Ultra Side View',
    isPrimary: false,
    order: 3,
    uploadedAt: '2024-01-20T10:10:00Z',
    fileSize: 950000,
    mimeType: 'image/jpeg',
  },
  {
    id: 'img_3_1',
    url: '/images/products/iphone-15-pro-max-1.jpg',
    alt: 'iPhone 15 Pro Max Front View',
    isPrimary: true,
    order: 1,
    uploadedAt: '2024-01-22T10:00:00Z',
    fileSize: 1300000,
    mimeType: 'image/jpeg',
  },
  {
    id: 'img_3_2',
    url: '/images/products/iphone-15-pro-max-2.jpg',
    alt: 'iPhone 15 Pro Max Back View',
    isPrimary: false,
    order: 2,
    uploadedAt: '2024-01-22T10:05:00Z',
    fileSize: 1250000,
    mimeType: 'image/jpeg',
  },
];

/**
 * Mock product suppliers with enhanced details
 */
const mockProductSuppliers: ProductSupplierWithDetails[] = [
  // Galaxy S21 suppliers
  {
    idProductSupplier: 1,
    idProduct: 1,
    idSupplier: 1,
    unitPrice: 45000,
    noUserPrice: 50000,
    quantity: 25,
    issueDate: '2024-01-15T10:00:00Z',
    supplier: mockSuppliers[0],
    categoryPrices: [
      { idProductSupplier: 1, idCategory: 1, price: 45000 },
      { idProductSupplier: 1, idCategory: 2, price: 47000 },
      { idProductSupplier: 1, idCategory: 3, price: 49000 },
    ],
  },
  {
    idProductSupplier: 2,
    idProduct: 1,
    idSupplier: 2,
    unitPrice: 44000,
    noUserPrice: 49000,
    quantity: 15,
    issueDate: '2024-01-10T10:00:00Z',
    supplier: mockSuppliers[1],
    categoryPrices: [
      { idProductSupplier: 2, idCategory: 1, price: 44000 },
      { idProductSupplier: 2, idCategory: 2, price: 46000 },
      { idProductSupplier: 2, idCategory: 3, price: 48000 },
    ],
  },
  // Galaxy S24 Ultra suppliers
  {
    idProductSupplier: 3,
    idProduct: 2,
    idSupplier: 1,
    unitPrice: 85000,
    noUserPrice: 95000,
    quantity: 8,
    issueDate: '2024-01-20T10:00:00Z',
    supplier: mockSuppliers[0],
    categoryPrices: [
      { idProductSupplier: 3, idCategory: 1, price: 85000 },
      { idProductSupplier: 3, idCategory: 2, price: 88000 },
      { idProductSupplier: 3, idCategory: 3, price: 92000 },
    ],
  },
  {
    idProductSupplier: 4,
    idProduct: 2,
    idSupplier: 3,
    unitPrice: 83000,
    noUserPrice: 93000,
    quantity: 12,
    issueDate: '2024-01-18T10:00:00Z',
    supplier: mockSuppliers[2],
    categoryPrices: [
      { idProductSupplier: 4, idCategory: 1, price: 83000 },
      { idProductSupplier: 4, idCategory: 2, price: 86000 },
      { idProductSupplier: 4, idCategory: 3, price: 90000 },
    ],
  },
  // iPhone 15 Pro Max suppliers
  {
    idProductSupplier: 5,
    idProduct: 4,
    idSupplier: 2,
    unitPrice: 120000,
    noUserPrice: 135000,
    quantity: 15,
    issueDate: '2024-01-22T10:00:00Z',
    supplier: mockSuppliers[1],
    categoryPrices: [
      { idProductSupplier: 5, idCategory: 1, price: 120000 },
      { idProductSupplier: 5, idCategory: 2, price: 125000 },
      { idProductSupplier: 5, idCategory: 3, price: 130000 },
    ],
  },
  {
    idProductSupplier: 6,
    idProduct: 4,
    idSupplier: 4,
    unitPrice: 118000,
    noUserPrice: 133000,
    quantity: 10,
    issueDate: '2024-01-20T10:00:00Z',
    supplier: mockSuppliers[3],
    categoryPrices: [
      { idProductSupplier: 6, idCategory: 1, price: 118000 },
      { idProductSupplier: 6, idCategory: 2, price: 123000 },
      { idProductSupplier: 6, idCategory: 3, price: 128000 },
    ],
  },
];

/**
 * Mock client categories for pricing
 */
const mockClientCategories = [
  { idCategory: 1, categoryName: 'Premium', categoryStatus: 1 },
  { idCategory: 2, categoryName: 'Standard', categoryStatus: 1 },
  { idCategory: 3, categoryName: 'Basic', categoryStatus: 1 },
];

/**
 * Generate comprehensive admin product information with all relationships
 */
export const mockAdminProductInformation: AdminProductWithFullDetails[] = mockAdminProducts.map(product => {
  const model = mockModels.find(m => m.idModel === product.idModel);
  console.log('model', model);
  const brand = mockBrands.find(b => b.idBrand === model?.idBrand);
  console.log('brand', brand);
  const family = mockFamilies.find(f => f.idFamily === model?.idFamily);
  console.log('family', family);
  const supplier = mockProductSuppliers.find(s => s.idProduct === product.idProduct) || null;
  const images = mockProductImages.filter(img => {
    // Map product IDs to image IDs (simplified mapping)
    const imageMapping: Record<number, string[]> = {
      1: ['img_1_1', 'img_1_2'],
      2: ['img_2_1', 'img_2_2', 'img_2_3'],
      4: ['img_3_1', 'img_3_2'],
    };
    return imageMapping[product.idProduct]?.includes(img.id) || false;
  });
  const suppliers = mockProductSuppliers.filter(s => s.idProduct === product.idProduct);
  const categoryPrices = suppliers.flatMap(s => s.categoryPrices);
  
  if (!model || !brand || !family ) {
    throw new Error(`Missing data for product ${product.idProduct}`);
  }

  return {
    ...product,
    brand,
    model,
    family,
    supplier,
    images,
    suppliers,
    categoryPrices,
  };
});

/**
 * Helper function to simulate API delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper function to get product by ID
 */
export function getProductById(productId: number): AdminProductWithFullDetails | undefined {
  return mockAdminProductInformation.find(p => p.idProduct === productId);
}

/**
 * Helper function to get product suppliers by product ID
 */
export function getProductSuppliers(productId: number): ProductSupplierWithDetails[] {
  return mockProductSuppliers.filter(s => s.idProduct === productId);
}

/**
 * Helper function to get product images by product ID
 */
export function getProductImages(productId: number): AdminProductImage[] {
  const imageMapping: Record<number, string[]> = {
    1: ['img_1_1', 'img_1_2'],
    2: ['img_2_1', 'img_2_2', 'img_2_3'],
    4: ['img_3_1', 'img_3_2'],
  };
  
  const imageIds = imageMapping[productId] || [];
  return mockProductImages.filter(img => imageIds.includes(img.id));
}
