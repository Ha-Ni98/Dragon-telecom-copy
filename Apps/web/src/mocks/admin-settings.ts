/**
 * Admin Settings Mock Data
 * Comprehensive mock data for admin settings functionality
 */

import { 
  AdminAccountWithDetails, 
  ClientCategory, 
  Family, 
  Brand, 
  Model, 
  DeliveryFee,
  FamilyFormData,
  BrandFormData,
  ModelFormData,
  AdminAccountFormData,
  ClientCategoryFormData,
  DeliveryFeeFormData
} from '@/types/draft-types';
import { UserRoleCode } from '@/types/draft-types/enums.types';
import { CategoryStatusCode } from '@/types/draft-types/enums.types';

// ============================================================================
// MOCK ADMIN ACCOUNTS
// ============================================================================

export const mockAdminAccounts: AdminAccountWithDetails[] = [
  {
    idUser: 1,
    userName: "admin",
    userPassword: "hashed_password_admin_123",
    userRole: UserRoleCode.admin,
    createdDate: "2024-01-01T00:00:00Z",
    roleLabel: "Administrator",
    canBeDeleted: false // Current user cannot be deleted
  },
  {
    idUser: 2,
    userName: "john.doe",
    userPassword: "hashed_password_john_456",
    userRole: UserRoleCode.admin,
    createdDate: "2024-01-15T10:30:00Z",
    roleLabel: "Administrator",
    canBeDeleted: true
  },
  {
    idUser: 3,
    userName: "sarah.smith",
    userPassword: "hashed_password_sarah_789",
    userRole: UserRoleCode.admin,
    createdDate: "2024-02-01T14:20:00Z",
    roleLabel: "Administrator",
    canBeDeleted: true
  },
  {
    idUser: 4,
    userName: "mike.johnson",
    userPassword: "hashed_password_mike_101",
    userRole: UserRoleCode.admin,
    createdDate: "2024-02-15T09:15:00Z",
    roleLabel: "Administrator",
    canBeDeleted: true
  }
];

// ============================================================================
// MOCK CLIENT CATEGORIES
// ============================================================================

export const mockClientCategories: ClientCategory[] = [
  {
    idCategory: 1,
    categoryName: "Premium",
    categoryStatus: CategoryStatusCode.active
  },
  {
    idCategory: 2,
    categoryName: "Standard",
    categoryStatus: CategoryStatusCode.active
  },
  {
    idCategory: 3,
    categoryName: "Basic",
    categoryStatus: CategoryStatusCode.active
  },
  {
    idCategory: 4,
    categoryName: "Wholesale",
    categoryStatus: CategoryStatusCode.active
  },
  {
    idCategory: 5,
    categoryName: "VIP",
    categoryStatus: CategoryStatusCode.active
  },
  {
    idCategory: 6,
    categoryName: "Trial",
    categoryStatus: CategoryStatusCode.disabled
  },
  {
    idCategory: 7,
    categoryName: "Legacy",
    categoryStatus: CategoryStatusCode.disabled
  }
];

// ============================================================================
// MOCK PRODUCT FAMILIES
// ============================================================================

export const mockFamilies: Family[] = [
  {
    idFamily: 1,
    familyName: "Display"
  },
  {
    idFamily: 2,
    familyName: "Battery"
  },
  {
    idFamily: 3,
    familyName: "Accessories"
  },
  {
    idFamily: 4,
    familyName: "Cables"
  },
  {
    idFamily: 5,
    familyName: "Cases"
  },
  {
    idFamily: 6,
    familyName: "Chargers"
  },
  {
    idFamily: 7,
    familyName: "Screen Protectors"
  },
  {
    idFamily: 8,
    familyName: "Memory Cards"
  },
  {
    idFamily: 9,
    familyName: "Audio"
  },
  {
    idFamily: 10,
    familyName: "Camera"
  }
];

// ============================================================================
// MOCK PRODUCT BRANDS
// ============================================================================

export const mockBrands: Brand[] = [
  {
    idBrand: 1,
    brandName: "Samsung"
  },
  {
    idBrand: 2,
    brandName: "Apple"
  },
  {
    idBrand: 3,
    brandName: "LG"
  },
  {
    idBrand: 4,
    brandName: "Sony"
  },
  {
    idBrand: 5,
    brandName: "Huawei"
  },
  {
    idBrand: 6,
    brandName: "OnePlus"
  },
  {
    idBrand: 7,
    brandName: "Xiaomi"
  },
  {
    idBrand: 8,
    brandName: "Oppo"
  },
  {
    idBrand: 9,
    brandName: "Vivo"
  },
  {
    idBrand: 10,
    brandName: "Realme"
  },
  {
    idBrand: 11,
    brandName: "Generic"
  },
  {
    idBrand: 12,
    brandName: "Anker"
  }
];

// ============================================================================
// MOCK PRODUCT MODELS
// ============================================================================

export const mockModels: Model[] = [
  // Samsung Models (idBrand: 1)
  {
    idModel: 1,
    idBrand: 1,
    idFamily: 1,
    modelName: "Galaxy S24"
  },
  {
    idModel: 2,
    idBrand: 1,
    idFamily: 1,
    modelName: "Galaxy S23"
  },
  {
    idModel: 3,
    idBrand: 1,
    idFamily: 1,
    modelName: "Galaxy A54"
  },
  {
    idModel: 4,
    idBrand: 1,
    idFamily: 2,
    modelName: "Galaxy S24 Battery"
  },
  {
    idModel: 5,
    idBrand: 1,
    idFamily: 3,
    modelName: "Galaxy Buds Pro"
  },

  // Apple Models (idBrand: 2)
  {
    idModel: 6,
    idBrand: 2,
    idFamily: 1,
    modelName: "iPhone 15"
  },
  {
    idModel: 7,
    idBrand: 2,
    idFamily: 1,
    modelName: "iPhone 14"
  },
  {
    idModel: 8,
    idBrand: 2,
    idFamily: 1,
    modelName: "iPhone 13"
  },
  {
    idModel: 9,
    idBrand: 2,
    idFamily: 2,
    modelName: "iPhone 15 Battery"
  },
  {
    idModel: 10,
    idBrand: 2,
    idFamily: 3,
    modelName: "AirPods Pro"
  },

  // LG Models (idBrand: 3)
  {
    idModel: 11,
    idBrand: 3,
    idFamily: 1,
    modelName: "OLED C3"
  },
  {
    idModel: 12,
    idBrand: 3,
    idFamily: 1,
    modelName: "OLED G3"
  },
  {
    idModel: 13,
    idBrand: 3,
    idFamily: 2,
    modelName: "LG Battery Pack"
  },

  // Sony Models (idBrand: 4)
  {
    idModel: 14,
    idBrand: 4,
    idFamily: 1,
    modelName: "Xperia 1 V"
  },
  {
    idModel: 15,
    idBrand: 4,
    idFamily: 1,
    modelName: "Xperia 5 V"
  },
  {
    idModel: 16,
    idBrand: 4,
    idFamily: 9,
    modelName: "WH-1000XM5"
  },

  // Generic Accessories (idBrand: 11)
  {
    idModel: 17,
    idBrand: 11,
    idFamily: 4,
    modelName: "USB-C Cable"
  },
  {
    idModel: 18,
    idBrand: 11,
    idFamily: 4,
    modelName: "Lightning Cable"
  },
  {
    idModel: 19,
    idBrand: 11,
    idFamily: 5,
    modelName: "Clear Case"
  },
  {
    idModel: 20,
    idBrand: 11,
    idFamily: 5,
    modelName: "Silicone Case"
  },

  // Anker Models (idBrand: 12)
  {
    idModel: 21,
    idBrand: 12,
    idFamily: 6,
    modelName: "PowerCore 10000"
  },
  {
    idModel: 22,
    idBrand: 12,
    idFamily: 6,
    modelName: "PowerCore 20000"
  },
  {
    idModel: 23,
    idBrand: 12,
    idFamily: 4,
    modelName: "PowerLine III"
  }
];

// ============================================================================
// MOCK DELIVERY FEES
// ============================================================================

export const mockDeliveryFees: DeliveryFee[] = [
  // Algiers (01)
  { wilaya: "Algiers", commune: "Alger Centre", deliveryOffice: 300, deliveryHome: 500 },
  { wilaya: "Algiers", commune: "Bab Ezzouar", deliveryOffice: 350, deliveryHome: 550 },
  { wilaya: "Algiers", commune: "Hussein Dey", deliveryOffice: 400, deliveryHome: 600 },
  { wilaya: "Algiers", commune: "Kouba", deliveryOffice: 350, deliveryHome: 550 },
  { wilaya: "Algiers", commune: "Hydra", deliveryOffice: 300, deliveryHome: 500 },
  { wilaya: "Algiers", commune: "Birkhadem", deliveryOffice: 400, deliveryHome: 600 },
  { wilaya: "Algiers", commune: "Dar El Beida", deliveryOffice: 450, deliveryHome: 650 },
  { wilaya: "Algiers", commune: "Rest", deliveryOffice: 500, deliveryHome: 700 },

  // Oran (31)
  { wilaya: "Oran", commune: "Oran Centre", deliveryOffice: 400, deliveryHome: 600 },
  { wilaya: "Oran", commune: "Bir El Djir", deliveryOffice: 450, deliveryHome: 650 },
  { wilaya: "Oran", commune: "Es Senia", deliveryOffice: 500, deliveryHome: 700 },
  { wilaya: "Oran", commune: "Ain El Turk", deliveryOffice: 550, deliveryHome: 750 },
  { wilaya: "Oran", commune: "Rest", deliveryOffice: 600, deliveryHome: 800 },

  // Constantine (25)
  { wilaya: "Constantine", commune: "Constantine Centre", deliveryOffice: 450, deliveryHome: 650 },
  { wilaya: "Constantine", commune: "El Khroub", deliveryOffice: 500, deliveryHome: 700 },
  { wilaya: "Constantine", commune: "Ain Smara", deliveryOffice: 550, deliveryHome: 750 },
  { wilaya: "Constantine", commune: "Rest", deliveryOffice: 600, deliveryHome: 800 },

  // Blida (09)
  { wilaya: "Blida", commune: "Blida Centre", deliveryOffice: 350, deliveryHome: 550 },
  { wilaya: "Blida", commune: "Boufarik", deliveryOffice: 400, deliveryHome: 600 },
  { wilaya: "Blida", commune: "Oued El Alleug", deliveryOffice: 450, deliveryHome: 650 },
  { wilaya: "Blida", commune: "Rest", deliveryOffice: 500, deliveryHome: 700 },

  // Batna (05)
  { wilaya: "Batna", commune: "Batna Centre", deliveryOffice: 500, deliveryHome: 700 },
  { wilaya: "Batna", commune: "Barika", deliveryOffice: 600, deliveryHome: 800 },
  { wilaya: "Batna", commune: "Merouana", deliveryOffice: 550, deliveryHome: 750 },
  { wilaya: "Batna", commune: "Rest", deliveryOffice: 700, deliveryHome: 900 },

  // Setif (19)
  { wilaya: "Setif", commune: "Setif Centre", deliveryOffice: 450, deliveryHome: 650 },
  { wilaya: "Setif", commune: "El Eulma", deliveryOffice: 500, deliveryHome: 700 },
  { wilaya: "Setif", commune: "Ain Oulmene", deliveryOffice: 550, deliveryHome: 750 },
  { wilaya: "Setif", commune: "Rest", deliveryOffice: 600, deliveryHome: 800 },

  // Annaba (23)
  { wilaya: "Annaba", commune: "Annaba Centre", deliveryOffice: 500, deliveryHome: 700 },
  { wilaya: "Annaba", commune: "El Bouni", deliveryOffice: 550, deliveryHome: 750 },
  { wilaya: "Annaba", commune: "Rest", deliveryOffice: 600, deliveryHome: 800 },

  // Tlemcen (13)
  { wilaya: "Tlemcen", commune: "Tlemcen Centre", deliveryOffice: 550, deliveryHome: 750 },
  { wilaya: "Tlemcen", commune: "Rest", deliveryOffice: 650, deliveryHome: 850 },

  // Bejaia (06)
  { wilaya: "Bejaia", commune: "Bejaia Centre", deliveryOffice: 500, deliveryHome: 700 },
  { wilaya: "Bejaia", commune: "Rest", deliveryOffice: 600, deliveryHome: 800 }
];

// ============================================================================
// MOCK FORM DATA SAMPLES
// ============================================================================

export const mockFamilyFormData: FamilyFormData = {
  familyName: "New Family"
};

export const mockBrandFormData: BrandFormData = {
  brandName: "New Brand"
};

export const mockModelFormData: ModelFormData = {
  modelName: "New Model",
  idFamily: 1,
  idBrand: 1
};

export const mockAdminAccountFormData: AdminAccountFormData = {
  userName: "new.admin",
  password: "SecurePassword123!",
  confirmPassword: "SecurePassword123!",
  userRole: UserRoleCode.admin
};

export const mockClientCategoryFormData: ClientCategoryFormData = {
  categoryName: "New Category",
  categoryStatus: CategoryStatusCode.active
};

export const mockDeliveryFeeFormData: DeliveryFeeFormData = {
  wilaya: "Test Wilaya",
  commune: "Test Commune",
  deliveryOffice: 400,
  deliveryHome: 600
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get next available ID for a given array of objects with id property
 */
export function getNextId<T extends { [K in keyof T]: K extends `${string}id${string}` ? number : any }>(
  items: T[],
  idField: keyof T
): number {
  if (items.length === 0) return 1;
  const maxId = Math.max(...items.map(item => Number(item[idField])));
  return maxId + 1;
}

/**
 * Simulate API delay for development
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate mock admin account with details
 */
export function generateMockAdminAccount(
  userName: string,
  role: UserRoleCode = UserRoleCode.admin,
  canBeDeleted: boolean = true
): AdminAccountWithDetails {
  return {
    idUser: getNextId(mockAdminAccounts, 'idUser'),
    userName,
    userPassword: `hashed_password_${userName}_${Date.now()}`,
    userRole: role,
    createdDate: new Date().toISOString(),
    roleLabel: "Administrator",
    canBeDeleted
  };
}

/**
 * Generate mock client category
 */
export function generateMockClientCategory(
  categoryName: string,
  status: CategoryStatusCode = CategoryStatusCode.active
): ClientCategory {
  return {
    idCategory: getNextId(mockClientCategories, 'idCategory'),
    categoryName,
    categoryStatus: status
  };
}

/**
 * Generate mock family
 */
export function generateMockFamily(familyName: string): Family {
  return {
    idFamily: getNextId(mockFamilies, 'idFamily'),
    familyName
  };
}

/**
 * Generate mock brand
 */
export function generateMockBrand(brandName: string): Brand {
  return {
    idBrand: getNextId(mockBrands, 'idBrand'),
    brandName
  };
}

/**
 * Generate mock model
 */
export function generateMockModel(
  modelName: string,
  idFamily: number,
  idBrand: number
): Model {
  return {
    idModel: getNextId(mockModels, 'idModel'),
    idBrand,
    idFamily,
    modelName
  };
}

/**
 * Generate mock delivery fee
 */
export function generateMockDeliveryFee(
  wilaya: string,
  commune: string,
  deliveryOffice: number = 400,
  deliveryHome: number = 600
): DeliveryFee {
  return {
    wilaya,
    commune,
    deliveryOffice,
    deliveryHome
  };
}
