import { ProductSuggestion, SearchResult, HeroProduct, ProductWithDetails } from "@/types/draft-types/main-page.types";

/**
 * Mock search suggestions for header search functionality
 */
export const mockSearchSuggestions: ProductSuggestion[] = [
  {
    idProduct: 1,
    productName: "iPhone 15 Pro Max",
    brand: "Apple",
    image: "/api/placeholder/60/60",
    price: 1099
  },
  {
    idProduct: 2,
    productName: "Samsung Galaxy S24 Ultra",
    brand: "Samsung",
    image: "/api/placeholder/60/60",
    price: 1199
  },
  {
    idProduct: 3,
    productName: "AirPods Pro 2",
    brand: "Apple",
    image: "/api/placeholder/60/60",
    price: 249
  },
  {
    idProduct: 4,
    productName: "Sony WH-1000XM5",
    brand: "Sony",
    image: "/api/placeholder/60/60",
    price: 399
  }
];

/**
 * Mock search results for search dialog
 */
export const mockSearchResults: SearchResult[] = [
  {
    idProduct: 1,
    productName: "iPhone 15 Pro Max",
    brand: "Apple",
    category: "Smartphones",
    price: 1099,
    image: "/api/placeholder/100/100"
  },
  {
    idProduct: 2,
    productName: "Samsung Galaxy S24 Ultra",
    brand: "Samsung",
    category: "Smartphones",
    price: 1199,
    image: "/api/placeholder/100/100"
  },
  {
    idProduct: 3,
    productName: "AirPods Pro 2",
    brand: "Apple",
    category: "Accessories",
    price: 249,
    image: "/api/placeholder/100/100"
  },
  {
    idProduct: 4,
    productName: "Sony WH-1000XM5",
    brand: "Sony",
    category: "Accessories",
    price: 399,
    image: "/api/placeholder/100/100"
  },
  {
    idProduct: 5,
    productName: "MacBook Pro M3",
    brand: "Apple",
    category: "Laptops",
    price: 1999,
    image: "/api/placeholder/100/100"
  },
  {
    idProduct: 6,
    productName: "iPad Air M2",
    brand: "Apple",
    category: "Tablets",
    price: 599,
    image: "/api/placeholder/100/100"
  }
];

/**
 * Mock hero product for hero section showcase
 */
export const mockHeroProduct: HeroProduct = {
  idProduct: 1,
  productName: "iPhone 15 Pro Max",
  brand: "Apple",
  image: "/api/placeholder/300/300",
  price: 1099,
  description: "Experience next-generation technology with the latest iPhone"
};

/**
 * Mock popular search terms
 */
export const mockPopularSearches: string[] = [
  "iPhone 15",
  "Samsung Galaxy",
  "AirPods",
  "MacBook",
  "iPad",
  "Sony headphones",
  "LG TV",
  "Xiaomi phone"
];

/**
 * Mock products with details for search service
 */
export const mockProductsWithDetails: ProductWithDetails[] = [
  {
    idProduct: 1,
    productName: "iPhone 15 Pro Max",
    productDescription: "Latest iPhone with titanium design and advanced camera system",
    productCodeBar: "IP15PM-001",
    brand: { idBrand: 1, brandName: "Apple" },
    model: { idModel: 1, idBrand: 1, idFamily: 1, modelName: "iPhone 15 Pro Max" },
    family: { idFamily: 1, familyName: "Smartphones" },
    image: "/api/placeholder/300/300",
    price: 1099,
    inStock: true,
    isNew: true,
    rating: 4.9,
    reviews: 234,
    features: ["256GB", "Titanium", "48MP Camera", "A17 Pro Chip"]
  },
  {
    idProduct: 2,
    productName: "Samsung Galaxy S24 Ultra",
    productDescription: "Premium Android smartphone with S Pen and advanced AI features",
    productCodeBar: "SGS24U-001",
    brand: { idBrand: 2, brandName: "Samsung" },
    model: { idModel: 2, idBrand: 2, idFamily: 1, modelName: "Galaxy S24 Ultra" },
    family: { idFamily: 1, familyName: "Smartphones" },
    image: "/api/placeholder/300/300",
    price: 1199,
    inStock: true,
    isNew: true,
    rating: 4.8,
    reviews: 187,
    features: ["512GB", "S Pen", "200MP Camera", "Snapdragon 8 Gen 3"]
  },
  {
    idProduct: 3,
    productName: "AirPods Pro 2",
    productDescription: "Wireless earbuds with active noise cancellation",
    productCodeBar: "APP2-001",
    brand: { idBrand: 1, brandName: "Apple" },
    model: { idModel: 3, idBrand: 1, idFamily: 2, modelName: "AirPods Pro 2" },
    family: { idFamily: 2, familyName: "Accessories" },
    image: "/api/placeholder/300/300",
    price: 249,
    inStock: true,
    isNew: false,
    rating: 4.7,
    reviews: 156,
    features: ["Active Noise Cancellation", "Spatial Audio", "H2 Chip", "6-hour battery"]
  }
];
