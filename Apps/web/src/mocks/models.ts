import { Model } from "@/types/draft-types";

/**
 * Mock data for product models
 * Following the database schema structure with proper brand and family relationships
 */
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
