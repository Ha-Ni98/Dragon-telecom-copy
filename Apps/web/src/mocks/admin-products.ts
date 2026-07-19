import { AdminProductWithDetails, AdminProductsStats, getStockStatus, formatProductDate } from '@/types/draft-types/admin.types';
import { mockBrands, mockFamilies, mockModels } from './products';

/**
 * Mock ProductSupplier data for admin products
 */
const mockProductSuppliers = [
  { idProductSupplier: 1, idProduct: 1, idSupplier: 1, unitPrice: 45000, noUserPrice: 50000, quantity: 25, issueDate: '2024-01-15T10:00:00Z' },
  { idProductSupplier: 2, idProduct: 2, idSupplier: 1, unitPrice: 85000, noUserPrice: 95000, quantity: 8, issueDate: '2024-01-20T10:00:00Z' },
  { idProductSupplier: 3, idProduct: 3, idSupplier: 1, unitPrice: 35000, noUserPrice: 40000, quantity: 3, issueDate: '2024-01-18T10:00:00Z' },
  { idProductSupplier: 4, idProduct: 4, idSupplier: 2, unitPrice: 120000, noUserPrice: 135000, quantity: 15, issueDate: '2024-01-22T10:00:00Z' },
  { idProductSupplier: 5, idProduct: 5, idSupplier: 2, unitPrice: 95000, noUserPrice: 105000, quantity: 0, issueDate: '2024-01-25T10:00:00Z' },
  { idProductSupplier: 6, idProduct: 6, idSupplier: 2, unitPrice: 75000, noUserPrice: 85000, quantity: 12, issueDate: '2024-01-12T10:00:00Z' },
  { idProductSupplier: 7, idProduct: 7, idSupplier: 3, unitPrice: 80000, noUserPrice: 90000, quantity: 5, issueDate: '2024-01-28T10:00:00Z' },
  { idProductSupplier: 8, idProduct: 8, idSupplier: 3, unitPrice: 65000, noUserPrice: 75000, quantity: 18, issueDate: '2024-01-30T10:00:00Z' },
  { idProductSupplier: 9, idProduct: 9, idSupplier: 4, unitPrice: 70000, noUserPrice: 80000, quantity: 7, issueDate: '2024-02-01T10:00:00Z' },
  { idProductSupplier: 10, idProduct: 10, idSupplier: 4, unitPrice: 60000, noUserPrice: 70000, quantity: 22, issueDate: '2024-02-03T10:00:00Z' },
  { idProductSupplier: 11, idProduct: 11, idSupplier: 2, unitPrice: 55000, noUserPrice: 65000, quantity: 14, issueDate: '2024-02-05T10:00:00Z' },
  { idProductSupplier: 12, idProduct: 12, idSupplier: 2, unitPrice: 75000, noUserPrice: 85000, quantity: 6, issueDate: '2024-02-07T10:00:00Z' },
  { idProductSupplier: 13, idProduct: 13, idSupplier: 1, unitPrice: 45000, noUserPrice: 55000, quantity: 9, issueDate: '2024-02-10T10:00:00Z' },
  { idProductSupplier: 14, idProduct: 14, idSupplier: 1, unitPrice: 35000, noUserPrice: 45000, quantity: 16, issueDate: '2024-02-12T10:00:00Z' },
  { idProductSupplier: 15, idProduct: 15, idSupplier: 2, unitPrice: 150000, noUserPrice: 170000, quantity: 4, issueDate: '2024-02-15T10:00:00Z' },
  { idProductSupplier: 16, idProduct: 16, idSupplier: 2, unitPrice: 120000, noUserPrice: 140000, quantity: 11, issueDate: '2024-02-18T10:00:00Z' },
  { idProductSupplier: 17, idProduct: 17, idSupplier: 5, unitPrice: 80000, noUserPrice: 95000, quantity: 8, issueDate: '2024-02-20T10:00:00Z' },
  { idProductSupplier: 18, idProduct: 18, idSupplier: 5, unitPrice: 60000, noUserPrice: 75000, quantity: 13, issueDate: '2024-02-22T10:00:00Z' },
  { idProductSupplier: 19, idProduct: 19, idSupplier: 2, unitPrice: 25000, noUserPrice: 30000, quantity: 2, issueDate: '2024-02-25T10:00:00Z' },
  { idProductSupplier: 20, idProduct: 20, idSupplier: 2, unitPrice: 20000, noUserPrice: 25000, quantity: 19, issueDate: '2024-02-28T10:00:00Z' },
  { idProductSupplier: 21, idProduct: 21, idSupplier: 6, unitPrice: 35000, noUserPrice: 40000, quantity: 6, issueDate: '2024-03-01T10:00:00Z' },
  { idProductSupplier: 22, idProduct: 22, idSupplier: 6, unitPrice: 30000, noUserPrice: 35000, quantity: 12, issueDate: '2024-03-03T10:00:00Z' },
  { idProductSupplier: 23, idProduct: 23, idSupplier: 7, unitPrice: 180000, noUserPrice: 200000, quantity: 3, issueDate: '2024-03-05T10:00:00Z' },
  { idProductSupplier: 24, idProduct: 24, idSupplier: 7, unitPrice: 120000, noUserPrice: 140000, quantity: 7, issueDate: '2024-03-08T10:00:00Z' },
  { idProductSupplier: 25, idProduct: 25, idSupplier: 1, unitPrice: 160000, noUserPrice: 180000, quantity: 5, issueDate: '2024-03-10T10:00:00Z' },
  { idProductSupplier: 26, idProduct: 26, idSupplier: 1, unitPrice: 200000, noUserPrice: 220000, quantity: 1, issueDate: '2024-03-12T10:00:00Z' },
  { idProductSupplier: 27, idProduct: 27, idSupplier: 8, unitPrice: 40000, noUserPrice: 45000, quantity: 8, issueDate: '2024-03-15T10:00:00Z' },
  { idProductSupplier: 28, idProduct: 28, idSupplier: 8, unitPrice: 30000, noUserPrice: 35000, quantity: 15, issueDate: '2024-03-18T10:00:00Z' },
  { idProductSupplier: 29, idProduct: 29, idSupplier: 6, unitPrice: 50000, noUserPrice: 60000, quantity: 4, issueDate: '2024-03-20T10:00:00Z' },
  { idProductSupplier: 30, idProduct: 30, idSupplier: 6, unitPrice: 45000, noUserPrice: 55000, quantity: 9, issueDate: '2024-03-22T10:00:00Z' },
  { idProductSupplier: 31, idProduct: 31, idSupplier: 9, unitPrice: 48000, noUserPrice: 58000, quantity: 6, issueDate: '2024-03-25T10:00:00Z' },
  { idProductSupplier: 32, idProduct: 32, idSupplier: 9, unitPrice: 35000, noUserPrice: 45000, quantity: 11, issueDate: '2024-03-28T10:00:00Z' },
];

/**
 * Mock products with creation dates spread over time
 */
const mockProducts = [
  { idProduct: 1, productName: "Galaxy S21", productDescription: "Flagship smartphone with advanced features and premium design", productCodeBar: "S21-001", productCreatedDate: "2024-01-15T10:00:00Z", idModel: 1 },
  { idProduct: 2, productName: "Galaxy S24 Ultra", productDescription: "Latest flagship with S Pen and advanced AI features", productCodeBar: "S24U-001", productCreatedDate: "2024-01-20T10:00:00Z", idModel: 2 },
  { idProduct: 3, productName: "Galaxy A54", productDescription: "Mid-range smartphone with excellent value", productCodeBar: "A54-001", productCreatedDate: "2024-01-18T10:00:00Z", idModel: 3 },
  { idProduct: 4, productName: "iPhone 15 Pro Max", productDescription: "Premium iPhone with titanium design and advanced camera system", productCodeBar: "IP15PM-001", productCreatedDate: "2024-01-22T10:00:00Z", idModel: 4 },
  { idProduct: 5, productName: "iPhone 15", productDescription: "Latest iPhone with USB-C and improved camera", productCodeBar: "IP15-001", productCreatedDate: "2024-01-25T10:00:00Z", idModel: 5 },
  { idProduct: 6, productName: "iPhone 14", productDescription: "Reliable iPhone with proven performance", productCodeBar: "IP14-001", productCreatedDate: "2024-01-12T10:00:00Z", idModel: 6 },
  { idProduct: 7, productName: "Pixel 8 Pro", productDescription: "Google's flagship with AI-powered features", productCodeBar: "P8P-001", productCreatedDate: "2024-01-28T10:00:00Z", idModel: 7 },
  { idProduct: 8, productName: "Pixel 8", productDescription: "Pure Android experience with Google AI", productCodeBar: "P8-001", productCreatedDate: "2024-01-30T10:00:00Z", idModel: 8 },
  { idProduct: 9, productName: "OnePlus 12", productDescription: "Flagship killer with top-tier performance", productCodeBar: "OP12-001", productCreatedDate: "2024-02-01T10:00:00Z", idModel: 9 },
  { idProduct: 10, productName: "OnePlus 11", productDescription: "Premium smartphone with Hasselblad camera", productCodeBar: "OP11-001", productCreatedDate: "2024-02-03T10:00:00Z", idModel: 10 },
  { idProduct: 11, productName: "iPad Air M2", productDescription: "Powerful tablet with M2 chip and all-day battery", productCodeBar: "IPA-M2-001", productCreatedDate: "2024-02-05T10:00:00Z", idModel: 11 },
  { idProduct: 12, productName: "iPad Pro M2", productDescription: "Professional tablet with advanced display technology", productCodeBar: "IPP-M2-001", productCreatedDate: "2024-02-07T10:00:00Z", idModel: 12 },
  { idProduct: 13, productName: "Galaxy Tab S9", productDescription: "Premium Android tablet with S Pen included", productCodeBar: "GTS9-001", productCreatedDate: "2024-02-10T10:00:00Z", idModel: 13 },
  { idProduct: 14, productName: "Galaxy Tab A8", productDescription: "Affordable tablet with great performance", productCodeBar: "GTA8-001", productCreatedDate: "2024-02-12T10:00:00Z", idModel: 14 },
  { idProduct: 15, productName: "MacBook Pro M3", productDescription: "Professional laptop with M3 chip and stunning display", productCodeBar: "MBP-M3-001", productCreatedDate: "2024-02-15T10:00:00Z", idModel: 15 },
  { idProduct: 16, productName: "MacBook Air M2", productDescription: "Ultra-thin laptop with all-day battery life", productCodeBar: "MBA-M2-001", productCreatedDate: "2024-02-18T10:00:00Z", idModel: 16 },
  { idProduct: 17, productName: "XPS 13", productDescription: "Premium Windows laptop with edge-to-edge display", productCodeBar: "XPS13-001", productCreatedDate: "2024-02-20T10:00:00Z", idModel: 17 },
  { idProduct: 18, productName: "Inspiron 15", productDescription: "Reliable laptop for everyday computing", productCodeBar: "INS15-001", productCreatedDate: "2024-02-22T10:00:00Z", idModel: 18 },
  { idProduct: 19, productName: "AirPods Pro 2", productDescription: "Premium wireless earbuds with active noise cancellation", productCodeBar: "APP2-001", productCreatedDate: "2024-02-25T10:00:00Z", idModel: 19 },
  { idProduct: 20, productName: "AirPods 3", productDescription: "Wireless earbuds with spatial audio", productCodeBar: "AP3-001", productCreatedDate: "2024-02-28T10:00:00Z", idModel: 20 },
  { idProduct: 21, productName: "WH-1000XM5", productDescription: "Industry-leading noise canceling headphones", productCodeBar: "WH1000XM5-001", productCreatedDate: "2024-03-01T10:00:00Z", idModel: 21 },
  { idProduct: 22, productName: "WF-1000XM4", productDescription: "Premium wireless earbuds with noise cancellation", productCodeBar: "WF1000XM4-001", productCreatedDate: "2024-03-03T10:00:00Z", idModel: 22 },
  { idProduct: 23, productName: "OLED C3", productDescription: "Premium OLED TV with perfect blacks and vibrant colors", productCodeBar: "OLED-C3-001", productCreatedDate: "2024-03-05T10:00:00Z", idModel: 23 },
  { idProduct: 24, productName: "QNED90", productDescription: "Quantum dot technology with mini-LED backlighting", productCodeBar: "QNED90-001", productCreatedDate: "2024-03-08T10:00:00Z", idModel: 24 },
  { idProduct: 25, productName: "QLED Q80D", productDescription: "Quantum dot display with 4K resolution", productCodeBar: "QLED-Q80D-001", productCreatedDate: "2024-03-10T10:00:00Z", idModel: 25 },
  { idProduct: 26, productName: "Neo QLED QN90D", productDescription: "Neo Quantum processor with 8K upscaling", productCodeBar: "NQLED-QN90D-001", productCreatedDate: "2024-03-12T10:00:00Z", idModel: 26 },
  { idProduct: 27, productName: "Switch OLED", productDescription: "Nintendo Switch with vibrant OLED display", productCodeBar: "NS-OLED-001", productCreatedDate: "2024-03-15T10:00:00Z", idModel: 27 },
  { idProduct: 28, productName: "Switch Lite", productDescription: "Compact handheld gaming console", productCodeBar: "NS-LITE-001", productCreatedDate: "2024-03-18T10:00:00Z", idModel: 28 },
  { idProduct: 29, productName: "PlayStation 5", productDescription: "Next-generation gaming console with ultra-fast SSD", productCodeBar: "PS5-001", productCreatedDate: "2024-03-20T10:00:00Z", idModel: 29 },
  { idProduct: 30, productName: "PlayStation 5 Digital", productDescription: "Digital-only version of the PS5 console", productCodeBar: "PS5-DIG-001", productCreatedDate: "2024-03-22T10:00:00Z", idModel: 30 },
  { idProduct: 31, productName: "Xbox Series X", productDescription: "Most powerful Xbox console with 4K gaming", productCodeBar: "XSX-001", productCreatedDate: "2024-03-25T10:00:00Z", idModel: 31 },
  { idProduct: 32, productName: "Xbox Series S", productDescription: "Compact Xbox console with next-gen performance", productCodeBar: "XSS-001", productCreatedDate: "2024-03-28T10:00:00Z", idModel: 32 },
];

/**
 * Generate comprehensive admin products with all relationships
 */
export const mockAdminProducts: AdminProductWithDetails[] = mockProducts.map(product => {
  const model = mockModels.find(m => m.idModel === product.idModel);
  const brand = mockBrands.find(b => b.idBrand === model?.idBrand);
  const family = mockFamilies.find(f => f.idFamily === model?.idFamily);
  const supplier = mockProductSuppliers.find(s => s.idProduct === product.idProduct);
  
  if (!model || !brand || !family || !supplier) {
    throw new Error(`Missing data for product ${product.idProduct}`);
  }

  const stockStatus = getStockStatus(supplier.quantity);
  const createdDate = formatProductDate(product.productCreatedDate);

  return {
    ...product,
    brand,
    model,
    family,
    supplier,
    stockQuantity: supplier.quantity,
    status: stockStatus,
    createdDate,
  };
});

/**
 * Calculate product statistics from mock data
 */
export const mockAdminProductsStats: AdminProductsStats = {
  totalProducts: mockAdminProducts.length,
  inStock: mockAdminProducts.filter(p => p.status === 'in_stock').length,
  lowStock: mockAdminProducts.filter(p => p.status === 'low_stock').length,
  outOfStock: mockAdminProducts.filter(p => p.status === 'out_of_stock').length,
};

/**
 * Helper function to simulate API delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
