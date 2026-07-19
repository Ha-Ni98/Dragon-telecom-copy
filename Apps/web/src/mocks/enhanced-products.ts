/**
 * Enhanced product mock data with multiple images and pricing per category
 * This extends the existing product mock data with additional features
 */

import { ProductImage, ProductWithPricing, ProductDetails, ProductSupplierPrice } from "@/types/draft-types/product.types";
import { Product, ProductSupplier, Brand, Family, Model } from "@/types/draft-types";
import { mockBrands, mockFamilies, mockModels, mockProducts, mockProductSuppliers } from "./products";

/**
 * Generate multiple product images for each product
 */
// function generateProductImages(productId: number, productName: string): ProductImage[] {
//   const baseImages = [
//     {
//       id: productId * 10 + 1,
//       url: `/api/placeholder/600/600?text=${encodeURIComponent(productName)}&bg=ffffff&color=333333`,
//       alt: `${productName} - Main View`,
//       isPrimary: true,
//       order: 1
//     },
//     {
//       id: productId * 10 + 2,
//       url: `/api/placeholder/600/600?text=${encodeURIComponent(productName)}&bg=f5f5f5&color=666666`,
//       alt: `${productName} - Side View`,
//       isPrimary: false,
//       order: 2
//     },
//     {
//       id: productId * 10 + 3,
//       url: `/api/placeholder/600/600?text=${encodeURIComponent(productName)}&bg=e8e8e8&color=999999`,
//       alt: `${productName} - Back View`,
//       isPrimary: false,
//       order: 3
//     }
//   ];

//   // Add more images for premium products
//   if (productName.includes('Pro') || productName.includes('Ultra') || productName.includes('Max')) {
//     baseImages.push(
//       {
//         id: productId * 10 + 4,
//         url: `/api/placeholder/600/600?text=${encodeURIComponent(productName)}&bg=d4d4d4&color=777777`,
//         alt: `${productName} - Detail View`,
//         isPrimary: false,
//         order: 4
//       },
//       {
//         id: productId * 10 + 5,
//         url: `/api/placeholder/600/600?text=${encodeURIComponent(productName)}&bg=c0c0c0&color=555555`,
//         alt: `${productName} - Accessories`,
//         isPrimary: false,
//         order: 5
//       }
//     );
//   }

//   return baseImages;
// }

/**
 * Generate pricing data for different client categories
 */
function generateCategoryPrices(productSupplierId: number, basePrice: number): ProductSupplierPrice[] {
  // Client categories: 1 = Premium, 2 = Standard, 3 = Basic
  return [
    {
      idProductSupplier: productSupplierId,
      idCategory: 1, // Premium category - 10% discount
      price: Math.round(basePrice * 0.9)
    },
    {
      idProductSupplier: productSupplierId,
      idCategory: 2, // Standard category - 5% discount
      price: Math.round(basePrice * 0.95)
    },
    {
      idProductSupplier: productSupplierId,
      idCategory: 3, // Basic category - no discount
      price: basePrice
    }
  ];
}

/**
 * Generate product features based on product type and name
 */
function generateProductFeatures(productName: string, familyName: string): string[] {
  const features: string[] = [];
  
  if (familyName === 'Smartphones') {
    if (productName.includes('Pro') || productName.includes('Ultra')) {
      features.push('256GB Storage', '5G Connectivity', 'Triple Camera System', 'Wireless Charging', 'Water Resistant');
    } else if (productName.includes('Galaxy S') || productName.includes('iPhone')) {
      features.push('128GB Storage', '5G Connectivity', 'Dual Camera', 'Fast Charging', 'Face ID');
    } else {
      features.push('64GB Storage', '4G Connectivity', 'Single Camera', 'USB-C', 'Fingerprint Sensor');
    }
  } else if (familyName === 'Tablets') {
    if (productName.includes('Pro')) {
      features.push('256GB Storage', 'M2 Chip', '12.9-inch Display', 'Apple Pencil Support', 'Magic Keyboard Compatible');
    } else if (productName.includes('Air')) {
      features.push('128GB Storage', 'M2 Chip', '11-inch Display', 'Touch ID', 'USB-C');
    } else {
      features.push('64GB Storage', 'Octa-core Processor', '10.4-inch Display', 'S Pen Included', 'Wi-Fi + Cellular');
    }
  } else if (familyName === 'Laptops') {
    if (productName.includes('Pro')) {
      features.push('512GB SSD', 'M3 Pro Chip', '14-inch Display', '32GB RAM', 'Backlit Keyboard');
    } else if (productName.includes('Air')) {
      features.push('256GB SSD', 'M2 Chip', '13-inch Display', '8GB RAM', 'All-day Battery');
    } else {
      features.push('512GB SSD', 'Intel i7 Processor', '13.4-inch Display', '16GB RAM', 'Windows 11');
    }
  } else if (familyName === 'Accessories') {
    if (productName.includes('Pro')) {
      features.push('Active Noise Cancellation', 'Spatial Audio', '30-hour Battery', 'USB-C Charging', 'Sweat Resistant');
    } else if (productName.includes('AirPods')) {
      features.push('Wireless Charging', 'Spatial Audio', '24-hour Battery', 'Lightning Charging', 'Siri Integration');
    } else {
      features.push('Wireless Connectivity', 'Noise Cancelling', '30-hour Battery', 'USB-C Charging', 'Comfortable Fit');
    }
  } else if (familyName === 'TVs') {
    if (productName.includes('OLED')) {
      features.push('55-inch Display', '4K OLED Technology', 'HDR10+ Support', 'Smart TV Platform', 'Gaming Mode');
    } else if (productName.includes('QLED')) {
      features.push('65-inch Display', '4K QLED Technology', 'Quantum Dot Color', 'Gaming Mode', 'Smart TV Platform');
    } else {
      features.push('55-inch Display', '4K Resolution', 'HDR Support', 'Smart TV Platform', 'Multiple HDMI Ports');
    }
  } else if (familyName === 'Gaming') {
    if (productName.includes('PlayStation')) {
      features.push('825GB SSD', 'Ray Tracing Support', '4K Gaming', 'DualSense Controller', '3D Audio');
    } else if (productName.includes('Xbox')) {
      features.push('1TB SSD', 'Quick Resume Feature', '4K Gaming', 'Xbox Controller', 'Game Pass Compatible');
    } else {
      features.push('64GB Storage', 'OLED Screen', 'Portable Design', 'Joy-Con Controllers', 'Nintendo Switch Online');
    }
  }
  
  return features;
}

/**
 * Generate product specifications
 */
function generateProductSpecifications(productName: string, familyName: string): Record<string, string> {
  const specs: Record<string, string> = {};
  
  if (familyName === 'Smartphones') {
    specs['Display'] = '6.1-inch Super Retina XDR';
    specs['Processor'] = 'A17 Pro Chip';
    specs['Camera'] = '48MP Main Camera';
    specs['Battery'] = 'Up to 23 hours video playback';
    specs['Storage'] = '128GB / 256GB / 512GB';
    specs['Connectivity'] = '5G, Wi-Fi 6E, Bluetooth 5.3';
  } else if (familyName === 'Tablets') {
    specs['Display'] = '11-inch Liquid Retina';
    specs['Processor'] = 'M2 Chip';
    specs['Camera'] = '12MP Wide Camera';
    specs['Battery'] = 'Up to 10 hours';
    specs['Storage'] = '64GB / 256GB';
    specs['Connectivity'] = 'Wi-Fi 6, Bluetooth 5.0';
  } else if (familyName === 'Laptops') {
    specs['Display'] = '13.6-inch Liquid Retina';
    specs['Processor'] = 'M2 Chip';
    specs['Memory'] = '8GB / 16GB / 24GB';
    specs['Storage'] = '256GB / 512GB / 1TB / 2TB SSD';
    specs['Battery'] = 'Up to 18 hours';
    specs['Connectivity'] = 'Wi-Fi 6E, Bluetooth 5.0';
  } else if (familyName === 'Accessories') {
    specs['Driver Size'] = '11mm Dynamic Driver';
    specs['Frequency Response'] = '20Hz - 20kHz';
    specs['Battery Life'] = 'Up to 30 hours';
    specs['Charging'] = 'USB-C, Wireless Charging';
    specs['Connectivity'] = 'Bluetooth 5.0';
  } else if (familyName === 'TVs') {
    specs['Display Size'] = '55-inch / 65-inch';
    specs['Resolution'] = '4K Ultra HD';
    specs['Panel Type'] = 'OLED / QLED';
    specs['HDR'] = 'HDR10, HDR10+, Dolby Vision';
    specs['Smart Platform'] = 'webOS / Tizen';
    specs['Connectivity'] = 'Wi-Fi, Ethernet, HDMI 2.1';
  } else if (familyName === 'Gaming') {
    specs['Storage'] = '825GB / 1TB SSD';
    specs['CPU'] = 'Custom AMD Zen 2';
    specs['GPU'] = 'Custom AMD RDNA 2';
    specs['Resolution'] = '4K Gaming';
    specs['Frame Rate'] = 'Up to 120fps';
    specs['Connectivity'] = 'Wi-Fi 6, Bluetooth 5.1';
  }
  
  return specs;
}

/**
 * Enhanced products with all details for the product information page
 */
export const mockProductsWithPricing: ProductWithPricing[] = mockProducts.map((product) => {
  const model = mockModels.find(m => m.idModel === product.idModel);
  const brand = mockBrands.find(b => b.idBrand === model?.idBrand);
  const family = mockFamilies.find(f => f.idFamily === model?.idFamily);
  const supplier = mockProductSuppliers.find(s => s.idProduct === product.idProduct);
  
  if (!model || !brand || !family || !supplier) {
    throw new Error(`Missing data for product ${product.idProduct}`);
  }
  
  //const images = generateProductImages(product.idProduct, product.productName);

  const imagesUrls = ["https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT8xnZD2aHfMMQV7tfwtkYLTx44BC6SZG0EFg&s", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRQdKvWJuRytdBtv38R0c-I3xuokxRpsTKl3w&s", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR9eF0OFshBEU86R9D4KV1DNCGcgh2JaVy3xg&s"]
  const images = imagesUrls.map((url, index) => ({
    id: `img_${product.idProduct}_${index + 1}`,
    url,
    alt: `${product.productName} - ${index + 1}`,
    isPrimary: index === 0,
    order: index + 1
  }));
  const categoryPrices = generateCategoryPrices(supplier.idProductSupplier, supplier.unitPrice);
  
  return {
    ...product,
    brand,
    model,
    family,
    images,
    supplier,
    categoryPrices,
    currentPrice: supplier.unitPrice, // Default to unit price
    noUserPrice: supplier.noUserPrice,
    inStock: supplier.quantity > 0,
    stockQuantity: supplier.quantity,
  };
});

/**
 * Enhanced product details for the product information page
 */
export const mockProductDetails: ProductDetails[] = mockProductsWithPricing.map((product) => {
  const features = generateProductFeatures(product.productName, product.family.familyName);
  const specifications = generateProductSpecifications(product.productName, product.family.familyName);
  
  // Determine if product is new (created within last 30 days)
  const isNew = new Date(product.productCreatedDate) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // Generate realistic ratings and reviews
  const rating = 4.0 + Math.random() * 1.0; // 4.0 to 5.0
  const reviewCount = Math.floor(Math.random() * 500) + 50; // 50 to 550 reviews
  
  // Generate related products (same family, different products)
  const relatedProducts = mockProductsWithPricing
    .filter(p => p.family.idFamily === product.family.idFamily && p.idProduct !== product.idProduct)
    .slice(0, 4)
    .map(p => p.idProduct);
  
  return {
    ...product,
    features,
    specifications,
    isNew,
    rating: Math.round(rating * 10) / 10,
    reviewCount,
    relatedProducts,
  };
});

/**
 * Get product by name (kebab-case)
 */
export function getProductByName(productName: string): ProductDetails | null {
  const kebabCaseName = productName.toLowerCase().replace(/\s+/g, '-');
  return mockProductDetails.find(product => 
    product.productName.toLowerCase().replace(/\s+/g, '-') === kebabCaseName
  ) || null;
}

/**
 * Get product pricing for specific category
 */
export function getProductPricing(productId: number, categoryId: number): number | null {
  const product = mockProductsWithPricing.find(p => p.idProduct === productId);
  if (!product) return null;
  
  const categoryPrice = product.categoryPrices.find(cp => cp.idCategory === categoryId);
  return categoryPrice ? categoryPrice.price : product.supplier.unitPrice;
}

/**
 * Get product images
 */
export function getProductImages(productId: number): ProductImage[] {
  const product = mockProductsWithPricing.find(p => p.idProduct === productId);
  return product ? product.images : [];
}

/**
 * Check if product is in stock
 */
export function isProductInStock(productId: number): boolean {
  const product = mockProductsWithPricing.find(p => p.idProduct === productId);
  return product ? product.inStock : false;
}

/**
 * Get stock quantity
 */
export function getProductStockQuantity(productId: number): number {
  const product = mockProductsWithPricing.find(p => p.idProduct === productId);
  return product ? product.stockQuantity : 0;
}
