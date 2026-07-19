import { Brand } from "@/types/draft-types";
import { BrandWithCount, CategoryWithCount } from "@/types/draft-types/main-page.types";

/**
 * Mock brands following database schema structure
 */
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

/**
 * Mock brands with product counts for main page display
 */
export const mockBrandsWithCount: BrandWithCount[] = [
  { 
    idBrand: 1, 
    brandName: "Samsung", 
    productCount: 45,
    logo: "/src/assets/samsung.png"
  },
  { 
    idBrand: 2, 
    brandName: "Apple", 
    productCount: 32,
    logo: "/src/assets/apple.png"
  },
  { 
    idBrand: 3, 
    brandName: "Google", 
    productCount: 6,
    logo: "/api/placeholder/100/60"
  },
  { 
    idBrand: 4, 
    brandName: "OnePlus", 
    productCount: 8,
    logo: "/src/assets/one-plus.png"
  },
  { 
    idBrand: 5, 
    brandName: "Dell", 
    productCount: 12,
    logo: "/api/placeholder/100/60"
  },
  { 
    idBrand: 6, 
    brandName: "Sony", 
    productCount: 18,
    logo: "/api/placeholder/100/60"
  },
  { 
    idBrand: 7, 
    brandName: "LG", 
    productCount: 15,
    logo: "/src/assets/lg.png"
  },
  { 
    idBrand: 8, 
    brandName: "Nintendo", 
    productCount: 10,
    logo: "/api/placeholder/100/60"
  },
  { 
    idBrand: 9, 
    brandName: "Microsoft", 
    productCount: 8,
    logo: "/api/placeholder/100/60"
  }
];

/**
 * Mock categories with product counts for main page display
 */
export const mockCategoriesWithCount: CategoryWithCount[] = [
  { 
    idFamily: 1, 
    familyName: "Smartphones", 
    productCount: 10,
    icon: "📱"
  },
  { 
    idFamily: 2, 
    familyName: "Tablets", 
    productCount: 4,
    icon: "📱"
  },
  { 
    idFamily: 3, 
    familyName: "Laptops", 
    productCount: 4,
    icon: "💻"
  },
  { 
    idFamily: 4, 
    familyName: "Accessories", 
    productCount: 4,
    icon: "🎧"
  },
  { 
    idFamily: 5, 
    familyName: "TVs", 
    productCount: 4,
    icon: "📺"
  },
  { 
    idFamily: 6, 
    familyName: "Gaming", 
    productCount: 6,
    icon: "🎮"
  }
];
