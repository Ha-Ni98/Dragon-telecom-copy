import { Product, ProductSupplier, Brand, Family, Model } from "@/types/draft-types";
import { ProductWithDetails } from "@/types/draft-types/main-page.types";

export const mockBrands: Brand[] = [
  { idBrand: 1, brandName: "Samsung" },
  { idBrand: 2, brandName: "Apple" },
  { idBrand: 3, brandName: "Google" },
  { idBrand: 4, brandName: "OnePlus" },
  { idBrand: 5, brandName: "Dell" },
  { idBrand: 6, brandName: "Sony" },
  { idBrand: 7, brandName: "LG" },
  { idBrand: 8, brandName: "Nintendo" },
  { idBrand: 9, brandName: "Microsoft" },
];

export const mockFamilies: Family[] = [
  { idFamily: 1, familyName: "Smartphones" },
  { idFamily: 2, familyName: "Tablets" },
  { idFamily: 3, familyName: "Laptops" },
  { idFamily: 4, familyName: "Accessories" },
  { idFamily: 5, familyName: "TVs" },
  { idFamily: 6, familyName: "Gaming" },
];

export const mockModels: Model[] = [
  // Samsung Smartphones
  { idModel: 1, idBrand: 1, idFamily: 1, modelName: "Galaxy S21" },
  { idModel: 2, idBrand: 1, idFamily: 1, modelName: "Galaxy S24 Ultra" },
  { idModel: 3, idBrand: 1, idFamily: 1, modelName: "Galaxy A54" },
  // Apple Smartphones
  { idModel: 4, idBrand: 2, idFamily: 1, modelName: "iPhone 15 Pro Max" },
  { idModel: 5, idBrand: 2, idFamily: 1, modelName: "iPhone 15" },
  { idModel: 6, idBrand: 2, idFamily: 1, modelName: "iPhone 14" },
  // Google Smartphones
  { idModel: 7, idBrand: 3, idFamily: 1, modelName: "Pixel 8 Pro" },
  { idModel: 8, idBrand: 3, idFamily: 1, modelName: "Pixel 8" },
  // OnePlus Smartphones
  { idModel: 9, idBrand: 4, idFamily: 1, modelName: "OnePlus 12" },
  { idModel: 10, idBrand: 4, idFamily: 1, modelName: "OnePlus 11" },
  // Apple Tablets
  { idModel: 11, idBrand: 2, idFamily: 2, modelName: "iPad Air M2" },
  { idModel: 12, idBrand: 2, idFamily: 2, modelName: "iPad Pro M2" },
  // Samsung Tablets
  { idModel: 13, idBrand: 1, idFamily: 2, modelName: "Galaxy Tab S9" },
  { idModel: 14, idBrand: 1, idFamily: 2, modelName: "Galaxy Tab A8" },
  // Apple Laptops
  { idModel: 15, idBrand: 2, idFamily: 3, modelName: "MacBook Pro M3" },
  { idModel: 16, idBrand: 2, idFamily: 3, modelName: "MacBook Air M2" },
  // Dell Laptops
  { idModel: 17, idBrand: 5, idFamily: 3, modelName: "XPS 13" },
  { idModel: 18, idBrand: 5, idFamily: 3, modelName: "Inspiron 15" },
  // Apple Accessories
  { idModel: 19, idBrand: 2, idFamily: 4, modelName: "AirPods Pro 2" },
  { idModel: 20, idBrand: 2, idFamily: 4, modelName: "AirPods 3" },
  // Sony Accessories
  { idModel: 21, idBrand: 6, idFamily: 4, modelName: "WH-1000XM5" },
  { idModel: 22, idBrand: 6, idFamily: 4, modelName: "WF-1000XM4" },
  // LG TVs
  { idModel: 23, idBrand: 7, idFamily: 5, modelName: "OLED C3" },
  { idModel: 24, idBrand: 7, idFamily: 5, modelName: "QNED90" },
  // Samsung TVs
  { idModel: 25, idBrand: 1, idFamily: 5, modelName: "QLED Q80D" },
  { idModel: 26, idBrand: 1, idFamily: 5, modelName: "Neo QLED QN90D" },
  // Nintendo Gaming
  { idModel: 27, idBrand: 8, idFamily: 6, modelName: "Switch OLED" },
  { idModel: 28, idBrand: 8, idFamily: 6, modelName: "Switch Lite" },
  // Sony Gaming
  { idModel: 29, idBrand: 6, idFamily: 6, modelName: "PlayStation 5" },
  { idModel: 30, idBrand: 6, idFamily: 6, modelName: "PlayStation 5 Digital" },
  // Microsoft Gaming
  { idModel: 31, idBrand: 9, idFamily: 6, modelName: "Xbox Series X" },
  { idModel: 32, idBrand: 9, idFamily: 6, modelName: "Xbox Series S" },
];

export const mockProducts: Product[] = [
  {
    idProduct: 1,
    productName: "Galaxy S21",
    productDescription: "Flagship smartphone with advanced features and premium design",
    productCodeBar: "S21-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 1,
  },
  {
    idProduct: 2,
    productName: "Galaxy S24 Ultra",
    productDescription: "Latest flagship with S Pen and advanced AI features",
    productCodeBar: "S24U-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 2,
  },
  {
    idProduct: 3,
    productName: "Galaxy A54",
    productDescription: "Mid-range smartphone with excellent value",
    productCodeBar: "A54-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 3,
  },
  {
    idProduct: 4,
    productName: "iPhone 15 Pro Max",
    productDescription: "Premium iPhone with titanium design and advanced camera system",
    productCodeBar: "IP15PM-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 4,
  },
  {
    idProduct: 5,
    productName: "iPhone 15",
    productDescription: "Latest iPhone with USB-C and improved camera",
    productCodeBar: "IP15-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 5,
  },
  {
    idProduct: 6,
    productName: "iPhone 14",
    productDescription: "Reliable iPhone with proven performance",
    productCodeBar: "IP14-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 6,
  },
  {
    idProduct: 7,
    productName: "Pixel 8 Pro",
    productDescription: "Google's flagship with AI-powered features",
    productCodeBar: "P8P-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 7,
  },
  {
    idProduct: 8,
    productName: "Pixel 8",
    productDescription: "Pure Android experience with Google AI",
    productCodeBar: "P8-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 8,
  },
  {
    idProduct: 9,
    productName: "OnePlus 12",
    productDescription: "Flagship killer with Hasselblad camera",
    productCodeBar: "OP12-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 9,
  },
  {
    idProduct: 10,
    productName: "OnePlus 11",
    productDescription: "High-performance smartphone with fast charging",
    productCodeBar: "OP11-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 10,
  },
  {
    idProduct: 11,
    productName: "iPad Air M2",
    productDescription: "Powerful tablet with M2 chip and Apple Pencil support",
    productCodeBar: "IPA-M2-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 11,
  },
  {
    idProduct: 12,
    productName: "iPad Pro M2",
    productDescription: "Professional tablet with M2 chip and ProMotion display",
    productCodeBar: "IPP-M2-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 12,
  },
  {
    idProduct: 13,
    productName: "Galaxy Tab S9",
    productDescription: "Premium Android tablet with S Pen included",
    productCodeBar: "GTS9-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 13,
  },
  {
    idProduct: 14,
    productName: "Galaxy Tab A8",
    productDescription: "Affordable tablet for everyday use",
    productCodeBar: "GTA8-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 14,
  },
  {
    idProduct: 15,
    productName: "MacBook Pro M3",
    productDescription: "Professional laptop with M3 Pro chip",
    productCodeBar: "MBP-M3-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 15,
  },
  {
    idProduct: 16,
    productName: "MacBook Air M2",
    productDescription: "Ultra-thin laptop with M2 chip",
    productCodeBar: "MBA-M2-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 16,
  },
  {
    idProduct: 17,
    productName: "Dell XPS 13",
    productDescription: "Premium Windows laptop with stunning display",
    productCodeBar: "XPS13-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 17,
  },
  {
    idProduct: 18,
    productName: "Dell Inspiron 15",
    productDescription: "Reliable laptop for work and entertainment",
    productCodeBar: "INS15-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 18,
  },
  {
    idProduct: 19,
    productName: "AirPods Pro 2",
    productDescription: "Premium wireless earbuds with active noise cancellation",
    productCodeBar: "APP2-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 19,
  },
  {
    idProduct: 20,
    productName: "AirPods 3",
    productDescription: "Wireless earbuds with spatial audio",
    productCodeBar: "AP3-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 20,
  },
  {
    idProduct: 21,
    productName: "Sony WH-1000XM5",
    productDescription: "Industry-leading noise-canceling headphones",
    productCodeBar: "WH1000XM5-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 21,
  },
  {
    idProduct: 22,
    productName: "Sony WF-1000XM4",
    productDescription: "Premium wireless earbuds with noise cancellation",
    productCodeBar: "WF1000XM4-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 22,
  },
  {
    idProduct: 23,
    productName: "LG OLED C3",
    productDescription: "Premium OLED TV with perfect blacks and infinite contrast",
    productCodeBar: "OLED-C3-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 23,
  },
  {
    idProduct: 24,
    productName: "LG QNED90",
    productDescription: "High-end QNED TV with mini-LED technology",
    productCodeBar: "QNED90-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 24,
  },
  {
    idProduct: 25,
    productName: "Samsung QLED Q80D",
    productDescription: "Premium QLED TV with quantum dot technology",
    productCodeBar: "QLED-Q80D-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 25,
  },
  {
    idProduct: 26,
    productName: "Samsung Neo QLED QN90D",
    productDescription: "Flagship Neo QLED TV with mini-LED backlighting",
    productCodeBar: "NQLED-QN90D-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 26,
  },
  {
    idProduct: 27,
    productName: "Nintendo Switch OLED",
    productDescription: "Handheld gaming console with OLED display",
    productCodeBar: "NS-OLED-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 27,
  },
  {
    idProduct: 28,
    productName: "Nintendo Switch Lite",
    productDescription: "Compact handheld gaming console",
    productCodeBar: "NS-LITE-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 28,
  },
  {
    idProduct: 29,
    productName: "PlayStation 5",
    productDescription: "Next-generation gaming console with 4K gaming",
    productCodeBar: "PS5-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 29,
  },
  {
    idProduct: 30,
    productName: "PlayStation 5 Digital",
    productDescription: "Digital-only PlayStation 5 console",
    productCodeBar: "PS5-DIG-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 30,
  },
  {
    idProduct: 31,
    productName: "Xbox Series X",
    productDescription: "Most powerful Xbox console with 4K gaming",
    productCodeBar: "XSX-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 31,
  },
  {
    idProduct: 32,
    productName: "Xbox Series S",
    productDescription: "Compact Xbox console for 1440p gaming",
    productCodeBar: "XSS-001",
    productCreatedDate: new Date().toISOString(),
    idModel: 32,
  },
];

export const mockProductSuppliers: ProductSupplier[] = [
  {
    idProductSupplier: 1,
    idProduct: 1,
    idSupplier: undefined,
    unitPrice: 699,
    noUserPrice: 799,
    quantity: 15,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 2,
    idProduct: 2,
    idSupplier: undefined,
    unitPrice: 1199,
    noUserPrice: 1299,
    quantity: 8,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 3,
    idProduct: 3,
    idSupplier: undefined,
    unitPrice: 399,
    noUserPrice: 449,
    quantity: 0,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 4,
    idProduct: 4,
    idSupplier: undefined,
    unitPrice: 1199,
    noUserPrice: 1299,
    quantity: 12,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 5,
    idProduct: 5,
    idSupplier: undefined,
    unitPrice: 799,
    noUserPrice: 899,
    quantity: 20,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 6,
    idProduct: 6,
    idSupplier: undefined,
    unitPrice: 699,
    noUserPrice: 799,
    quantity: 18,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 7,
    idProduct: 7,
    idSupplier: undefined,
    unitPrice: 999,
    noUserPrice: 1099,
    quantity: 10,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 8,
    idProduct: 8,
    idSupplier: undefined,
    unitPrice: 699,
    noUserPrice: 799,
    quantity: 15,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 9,
    idProduct: 9,
    idSupplier: undefined,
    unitPrice: 799,
    noUserPrice: 899,
    quantity: 12,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 10,
    idProduct: 10,
    idSupplier: undefined,
    unitPrice: 699,
    noUserPrice: 799,
    quantity: 14,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 11,
    idProduct: 11,
    idSupplier: undefined,
    unitPrice: 599,
    noUserPrice: 699,
    quantity: 16,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 12,
    idProduct: 12,
    idSupplier: undefined,
    unitPrice: 1099,
    noUserPrice: 1199,
    quantity: 8,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 13,
    idProduct: 13,
    idSupplier: undefined,
    unitPrice: 799,
    noUserPrice: 899,
    quantity: 10,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 14,
    idProduct: 14,
    idSupplier: undefined,
    unitPrice: 199,
    noUserPrice: 249,
    quantity: 30,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 15,
    idProduct: 15,
    idSupplier: undefined,
    unitPrice: 1999,
    noUserPrice: 2199,
    quantity: 5,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 16,
    idProduct: 16,
    idSupplier: undefined,
    unitPrice: 1199,
    noUserPrice: 1299,
    quantity: 12,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 17,
    idProduct: 17,
    idSupplier: undefined,
    unitPrice: 1299,
    noUserPrice: 1399,
    quantity: 8,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 18,
    idProduct: 18,
    idSupplier: undefined,
    unitPrice: 699,
    noUserPrice: 799,
    quantity: 20,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 19,
    idProduct: 19,
    idSupplier: undefined,
    unitPrice: 249,
    noUserPrice: 299,
    quantity: 50,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 20,
    idProduct: 20,
    idSupplier: undefined,
    unitPrice: 179,
    noUserPrice: 199,
    quantity: 40,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 21,
    idProduct: 21,
    idSupplier: undefined,
    unitPrice: 399,
    noUserPrice: 449,
    quantity: 25,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 22,
    idProduct: 22,
    idSupplier: undefined,
    unitPrice: 279,
    noUserPrice: 329,
    quantity: 30,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 23,
    idProduct: 23,
    idSupplier: undefined,
    unitPrice: 1499,
    noUserPrice: 1699,
    quantity: 6,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 24,
    idProduct: 24,
    idSupplier: undefined,
    unitPrice: 1299,
    noUserPrice: 1499,
    quantity: 8,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 25,
    idProduct: 25,
    idSupplier: undefined,
    unitPrice: 1199,
    noUserPrice: 1399,
    quantity: 10,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 26,
    idProduct: 26,
    idSupplier: undefined,
    unitPrice: 1999,
    noUserPrice: 2299,
    quantity: 4,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 27,
    idProduct: 27,
    idSupplier: undefined,
    unitPrice: 349,
    noUserPrice: 399,
    quantity: 35,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 28,
    idProduct: 28,
    idSupplier: undefined,
    unitPrice: 199,
    noUserPrice: 229,
    quantity: 40,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 29,
    idProduct: 29,
    idSupplier: undefined,
    unitPrice: 499,
    noUserPrice: 599,
    quantity: 15,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 30,
    idProduct: 30,
    idSupplier: undefined,
    unitPrice: 399,
    noUserPrice: 499,
    quantity: 20,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 31,
    idProduct: 31,
    idSupplier: undefined,
    unitPrice: 499,
    noUserPrice: 599,
    quantity: 12,
    issueDate: new Date().toISOString(),
  },
  {
    idProductSupplier: 32,
    idProduct: 32,
    idSupplier: undefined,
    unitPrice: 299,
    noUserPrice: 349,
    quantity: 25,
    issueDate: new Date().toISOString(),
  },
];

/**
 * Enhanced products with all details for the products page
 * This combines Product, Brand, Family, Model, and ProductSupplier data
 */
export const mockProductsWithDetails: ProductWithDetails[] = mockProducts.map((product) => {
  const model = mockModels.find(m => m.idModel === product.idModel);
  const brand = mockBrands.find(b => b.idBrand === model?.idBrand);
  const family = mockFamilies.find(f => f.idFamily === model?.idFamily);
  const supplier = mockProductSuppliers.find(s => s.idProduct === product.idProduct);
  
  // Determine if product is new (created within last 30 days)
  const isNew = new Date(product.productCreatedDate) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // Generate realistic ratings and reviews
  const rating = 4.0 + Math.random() * 1.0; // 4.0 to 5.0
  const reviews = Math.floor(Math.random() * 500) + 50; // 50 to 550 reviews
  
  // Generate features based on product type
  const features = generateFeatures(product.productName, family?.familyName || '');
  
  return {
    idProduct: product.idProduct,
    productName: product.productName,
    productDescription: product.productDescription,
    productCodeBar: product.productCodeBar,
    brand: brand!,
    model: model!,
    family: family!,
    image: product.idProduct === 1 ? "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJEsBsdCwQOWAnFeNxr6Tr0KE5AB4GDbtV5A&s" : `/api/placeholder/300/300?text=${encodeURIComponent(product.productName)}`,
    price: supplier?.unitPrice,
    inStock: product.idProduct === 3 ? false : (supplier?.quantity || 0) > 0,
    isNew,
    rating: Math.round(rating * 10) / 10,
    reviews,
    features,
  };
});

/**
 * Generate realistic features based on product name and family
 */
function generateFeatures(productName: string, familyName: string): string[] {
  const features: string[] = [];
  
  if (familyName === 'Smartphones') {
    if (productName.includes('Pro') || productName.includes('Ultra')) {
      features.push('256GB', '5G', 'Triple Camera', 'Wireless Charging');
    } else if (productName.includes('Galaxy S') || productName.includes('iPhone')) {
      features.push('128GB', '5G', 'Dual Camera', 'Fast Charging');
    } else {
      features.push('64GB', '4G', 'Single Camera', 'USB-C');
    }
  } else if (familyName === 'Tablets') {
    if (productName.includes('Pro')) {
      features.push('256GB', 'M2 Chip', '12.9-inch', 'Apple Pencil');
    } else if (productName.includes('Air')) {
      features.push('128GB', 'M2 Chip', '11-inch', 'Touch ID');
    } else {
      features.push('64GB', 'Octa-core', '10.4-inch', 'S Pen');
    }
  } else if (familyName === 'Laptops') {
    if (productName.includes('Pro')) {
      features.push('512GB SSD', 'M3 Pro', '14-inch', '32GB RAM');
    } else if (productName.includes('Air')) {
      features.push('256GB SSD', 'M2', '13-inch', '8GB RAM');
    } else {
      features.push('512GB SSD', 'Intel i7', '13.4-inch', '16GB RAM');
    }
  } else if (familyName === 'Accessories') {
    if (productName.includes('Pro')) {
      features.push('ANC', 'Spatial Audio', '30hr Battery', 'USB-C');
    } else if (productName.includes('AirPods')) {
      features.push('Wireless', 'Spatial Audio', '24hr Battery', 'Lightning');
    } else {
      features.push('Wireless', 'Noise Cancelling', '30hr Battery', 'USB-C');
    }
  } else if (familyName === 'TVs') {
    if (productName.includes('OLED')) {
      features.push('55-inch', '4K OLED', 'HDR10+', 'Smart TV');
    } else if (productName.includes('QLED')) {
      features.push('65-inch', '4K QLED', 'Quantum Dot', 'Gaming Mode');
    } else {
      features.push('55-inch', '4K', 'HDR', 'Smart TV');
    }
  } else if (familyName === 'Gaming') {
    if (productName.includes('PlayStation')) {
      features.push('825GB SSD', 'Ray Tracing', '4K Gaming', 'DualSense');
    } else if (productName.includes('Xbox')) {
      features.push('1TB SSD', 'Quick Resume', '4K Gaming', 'Xbox Controller');
    } else {
      features.push('64GB', 'OLED Screen', 'Portable', 'Joy-Con');
    }
  }
  
  return features;
}


