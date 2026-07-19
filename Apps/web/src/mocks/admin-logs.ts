/**
 * Admin Logs Mock Data
 * Comprehensive mock data for admin logs functionality
 */

import { 
  AdminLogWithDetails, 
  AdminLogsFilters, 
  AdminLogsPaginatedResponse, 
  AdminLogsStats,
  PlatformUser,
  LogEntry
} from '@/types/draft-types/logs.types';
import { ActionTypeCode, ActionTypeLabels, UserRoleCode } from '@/types/draft-types/enums.types';

// ============================================================================
// MOCK PLATFORM USERS
// ============================================================================

export const mockPlatformUsers: PlatformUser[] = [
  {
    idUser: 1,
    userName: "admin",
    userPassword: "hashed_password_admin_123",
    userRole: UserRoleCode.admin,
  },
  {
    idUser: 2,
    userName: "john.doe",
    userPassword: "hashed_password_john_456",
    userRole: UserRoleCode.admin,
  },
  {
    idUser: 3,
    userName: "sarah.smith",
    userPassword: "hashed_password_sarah_789",
    userRole: UserRoleCode.admin,
  },
  {
    idUser: 4,
    userName: "mike.johnson",
    userPassword: "hashed_password_mike_101",
    userRole: UserRoleCode.admin,
  },
  {
    idUser: 5,
    userName: "lisa.wilson",
    userPassword: "hashed_password_lisa_202",
    userRole: UserRoleCode.admin,
  },
];

// ============================================================================
// MOCK LOG ENTRIES
// ============================================================================

const mockLogEntries: LogEntry[] = [
  // Recent logs (today)
  {
    idLog: 1,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: iPhone 15 Pro Max (ID: 4) with stock quantity 25",
    logCreatedDate: new Date().toISOString(),
  },
  {
    idLog: 2,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'pending' to 'active' for client ID: 15 (Ahmed Bennaceur)",
    logCreatedDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
  },
  {
    idLog: 3,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: Samsung Galaxy S24 Ultra from supplier 'TechDistributors' with quantity 50",
    logCreatedDate: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
  },
  {
    idLog: 4,
    idUser: 1,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'pending' to 'confirmed' for order ID: 1234",
    logCreatedDate: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
  },
  {
    idLog: 5,
    idUser: 4,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'ElectroSupply' with total amount $2,500.00",
    logCreatedDate: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
  },

  // Yesterday's logs
  {
    idLog: 6,
    idUser: 2,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: Google Pixel 8 Pro (ID: 7) with stock quantity 15",
    logCreatedDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  },
  {
    idLog: 7,
    idUser: 3,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'active' to 'disabled' for client ID: 8 (Test User)",
    logCreatedDate: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), // 1 day 2 hours ago
  },
  {
    idLog: 8,
    idUser: 1,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: OnePlus 12 from supplier 'MobileWorld' with quantity 30",
    logCreatedDate: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(), // 1 day 4 hours ago
  },
  {
    idLog: 9,
    idUser: 5,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'confirmed' to 'delivery' for order ID: 1233",
    logCreatedDate: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(), // 1 day 6 hours ago
  },
  {
    idLog: 10,
    idUser: 4,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'GadgetHub' with total amount $1,800.00",
    logCreatedDate: new Date(Date.now() - 32 * 60 * 60 * 1000).toISOString(), // 1 day 8 hours ago
  },

  // This week's logs
  {
    idLog: 11,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: Nintendo Switch OLED (ID: 27) with stock quantity 20",
    logCreatedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
  },
  {
    idLog: 12,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'pending' to 'active' for client ID: 22 (New Client)",
    logCreatedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
  },
  {
    idLog: 13,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: PlayStation 5 from supplier 'GameDistributors' with quantity 10",
    logCreatedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
  },
  {
    idLog: 14,
    idUser: 5,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'delivery' to 'completed' for order ID: 1232",
    logCreatedDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days ago
  },
  {
    idLog: 15,
    idUser: 4,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'TechSuppliers' with total amount $3,200.00",
    logCreatedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
  },

  // This month's logs (older)
  {
    idLog: 16,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: Xbox Series X (ID: 31) with stock quantity 8",
    logCreatedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
  },
  {
    idLog: 17,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'active' to 'refused' for client ID: 5 (Inactive User)",
    logCreatedDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
  },
  {
    idLog: 18,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: MacBook Pro M3 from supplier 'AppleDistributors' with quantity 5",
    logCreatedDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days ago
  },
  {
    idLog: 19,
    idUser: 5,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'pending' to 'canceled' for order ID: 1231",
    logCreatedDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), // 25 days ago
  },
  {
    idLog: 20,
    idUser: 4,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'PremiumElectronics' with total amount $4,500.00",
    logCreatedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
  },

  // Additional logs for pagination testing (21-100)
  {
    idLog: 21,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: MacBook Pro M3 (ID: 28) with stock quantity 12",
    logCreatedDate: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 22,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'active' to 'pending' for client ID: 33 (Corporate Client)",
    logCreatedDate: new Date(Date.now() - 34 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 23,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: iPad Air 5th Gen from supplier 'AppleDistributor' with quantity 25",
    logCreatedDate: new Date(Date.now() - 36 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 24,
    idUser: 4,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'delivery' to 'completed' for order ID: 1235",
    logCreatedDate: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 25,
    idUser: 5,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'ElectroMart' with total amount $4,100.00",
    logCreatedDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 26,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: Sony WH-1000XM5 Headphones (ID: 29) with stock quantity 18",
    logCreatedDate: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 27,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'disabled' to 'active' for client ID: 44 (VIP Client)",
    logCreatedDate: new Date(Date.now() - 44 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 28,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: Dell XPS 13 from supplier 'ComputerWorld' with quantity 8",
    logCreatedDate: new Date(Date.now() - 46 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 29,
    idUser: 4,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'pending' to 'processing' for order ID: 1236",
    logCreatedDate: new Date(Date.now() - 48 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 30,
    idUser: 5,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'MobileTech' with total amount $2,800.00",
    logCreatedDate: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 31,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: AirPods Pro 2nd Gen (ID: 30) with stock quantity 35",
    logCreatedDate: new Date(Date.now() - 52 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 32,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'active' to 'suspended' for client ID: 55 (Problem Client)",
    logCreatedDate: new Date(Date.now() - 54 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 33,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: Microsoft Surface Pro 9 from supplier 'TechRetail' with quantity 15",
    logCreatedDate: new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 34,
    idUser: 4,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'processing' to 'shipped' for order ID: 1237",
    logCreatedDate: new Date(Date.now() - 58 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 35,
    idUser: 5,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'GadgetStore' with total amount $1,950.00",
    logCreatedDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 36,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: Samsung Galaxy Buds Pro (ID: 31) with stock quantity 22",
    logCreatedDate: new Date(Date.now() - 62 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 37,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'pending' to 'active' for client ID: 66 (New Business)",
    logCreatedDate: new Date(Date.now() - 64 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 38,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: Lenovo ThinkPad X1 from supplier 'BusinessTech' with quantity 10",
    logCreatedDate: new Date(Date.now() - 66 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 39,
    idUser: 4,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'shipped' to 'delivered' for order ID: 1238",
    logCreatedDate: new Date(Date.now() - 68 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 40,
    idUser: 5,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'ElectroHub' with total amount $3,750.00",
    logCreatedDate: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 41,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: Apple Watch Series 9 (ID: 32) with stock quantity 28",
    logCreatedDate: new Date(Date.now() - 72 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 42,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'suspended' to 'active' for client ID: 77 (Resolved Issue)",
    logCreatedDate: new Date(Date.now() - 74 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 43,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: HP Spectre x360 from supplier 'LaptopWorld' with quantity 12",
    logCreatedDate: new Date(Date.now() - 76 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 44,
    idUser: 4,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'delivered' to 'completed' for order ID: 1239",
    logCreatedDate: new Date(Date.now() - 78 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 45,
    idUser: 5,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'TechMart' with total amount $2,200.00",
    logCreatedDate: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 46,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: Google Pixel Watch 2 (ID: 33) with stock quantity 16",
    logCreatedDate: new Date(Date.now() - 82 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 47,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'active' to 'premium' for client ID: 88 (Upgraded)",
    logCreatedDate: new Date(Date.now() - 84 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 48,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: Asus ROG Zephyrus from supplier 'GamingTech' with quantity 6",
    logCreatedDate: new Date(Date.now() - 86 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 49,
    idUser: 4,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'pending' to 'confirmed' for order ID: 1240",
    logCreatedDate: new Date(Date.now() - 88 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 50,
    idUser: 5,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'ElectroSupply' with total amount $4,500.00",
    logCreatedDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 51,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: Bose QuietComfort 45 (ID: 34) with stock quantity 20",
    logCreatedDate: new Date(Date.now() - 92 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 52,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'premium' to 'vip' for client ID: 99 (Top Customer)",
    logCreatedDate: new Date(Date.now() - 94 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 53,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: Razer Blade 15 from supplier 'GamingWorld' with quantity 8",
    logCreatedDate: new Date(Date.now() - 96 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 54,
    idUser: 4,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'confirmed' to 'processing' for order ID: 1241",
    logCreatedDate: new Date(Date.now() - 98 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 55,
    idUser: 5,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'TechDistributors' with total amount $3,100.00",
    logCreatedDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 56,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: Jabra Elite 85t (ID: 35) with stock quantity 14",
    logCreatedDate: new Date(Date.now() - 102 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 57,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'vip' to 'active' for client ID: 100 (Status Reset)",
    logCreatedDate: new Date(Date.now() - 104 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 58,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: MSI Creator 15 from supplier 'CreativeTech' with quantity 5",
    logCreatedDate: new Date(Date.now() - 106 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 59,
    idUser: 4,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'processing' to 'shipped' for order ID: 1242",
    logCreatedDate: new Date(Date.now() - 108 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 60,
    idUser: 5,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'MobileWorld' with total amount $2,600.00",
    logCreatedDate: new Date(Date.now() - 110 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 61,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: Sennheiser HD 660S (ID: 36) with stock quantity 9",
    logCreatedDate: new Date(Date.now() - 112 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 62,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'active' to 'disabled' for client ID: 111 (Inactive)",
    logCreatedDate: new Date(Date.now() - 114 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 63,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: Acer Predator Helios from supplier 'GamingHub' with quantity 7",
    logCreatedDate: new Date(Date.now() - 116 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 64,
    idUser: 4,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'shipped' to 'delivered' for order ID: 1243",
    logCreatedDate: new Date(Date.now() - 118 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 65,
    idUser: 5,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'GadgetHub' with total amount $1,800.00",
    logCreatedDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 66,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: Audio-Technica ATH-M50x (ID: 37) with stock quantity 11",
    logCreatedDate: new Date(Date.now() - 122 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 67,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'disabled' to 'pending' for client ID: 122 (Reactivation)",
    logCreatedDate: new Date(Date.now() - 124 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 68,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: Alienware m15 R7 from supplier 'DellGaming' with quantity 4",
    logCreatedDate: new Date(Date.now() - 126 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 69,
    idUser: 4,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'delivered' to 'completed' for order ID: 1244",
    logCreatedDate: new Date(Date.now() - 128 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 70,
    idUser: 5,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'ElectroMart' with total amount $3,400.00",
    logCreatedDate: new Date(Date.now() - 130 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 71,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: Beyerdynamic DT 770 Pro (ID: 38) with stock quantity 13",
    logCreatedDate: new Date(Date.now() - 132 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 72,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'pending' to 'active' for client ID: 133 (Approved)",
    logCreatedDate: new Date(Date.now() - 134 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 73,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: Framework Laptop 13 from supplier 'ModularTech' with quantity 3",
    logCreatedDate: new Date(Date.now() - 136 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 74,
    idUser: 4,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'pending' to 'confirmed' for order ID: 1245",
    logCreatedDate: new Date(Date.now() - 138 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 75,
    idUser: 5,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'TechRetail' with total amount $2,900.00",
    logCreatedDate: new Date(Date.now() - 140 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 76,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: Shure SM7B (ID: 39) with stock quantity 6",
    logCreatedDate: new Date(Date.now() - 142 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 77,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'active' to 'premium' for client ID: 144 (Upgrade)",
    logCreatedDate: new Date(Date.now() - 144 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 78,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: System76 Lemur Pro from supplier 'LinuxTech' with quantity 2",
    logCreatedDate: new Date(Date.now() - 146 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 79,
    idUser: 4,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'confirmed' to 'processing' for order ID: 1246",
    logCreatedDate: new Date(Date.now() - 148 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 80,
    idUser: 5,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'ComputerWorld' with total amount $4,200.00",
    logCreatedDate: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 81,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: Rode PodMic (ID: 40) with stock quantity 8",
    logCreatedDate: new Date(Date.now() - 152 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 82,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'premium' to 'vip' for client ID: 155 (Top Tier)",
    logCreatedDate: new Date(Date.now() - 154 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 83,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: Purism Librem 14 from supplier 'PrivacyTech' with quantity 1",
    logCreatedDate: new Date(Date.now() - 156 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 84,
    idUser: 4,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'processing' to 'shipped' for order ID: 1247",
    logCreatedDate: new Date(Date.now() - 158 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 85,
    idUser: 5,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'BusinessTech' with total amount $3,600.00",
    logCreatedDate: new Date(Date.now() - 160 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 86,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: Blue Yeti X (ID: 41) with stock quantity 15",
    logCreatedDate: new Date(Date.now() - 162 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 87,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'vip' to 'active' for client ID: 166 (Status Change)",
    logCreatedDate: new Date(Date.now() - 164 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 88,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: Pine64 PineBook Pro from supplier 'OpenSourceTech' with quantity 1",
    logCreatedDate: new Date(Date.now() - 166 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 89,
    idUser: 4,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'shipped' to 'delivered' for order ID: 1248",
    logCreatedDate: new Date(Date.now() - 168 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 90,
    idUser: 5,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'LaptopWorld' with total amount $2,700.00",
    logCreatedDate: new Date(Date.now() - 170 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 91,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: HyperX QuadCast (ID: 42) with stock quantity 12",
    logCreatedDate: new Date(Date.now() - 172 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 92,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'active' to 'suspended' for client ID: 177 (Issue)",
    logCreatedDate: new Date(Date.now() - 174 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 93,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: ThinkPad X1 Carbon Gen 10 from supplier 'LenovoDirect' with quantity 9",
    logCreatedDate: new Date(Date.now() - 176 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 94,
    idUser: 4,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'delivered' to 'completed' for order ID: 1249",
    logCreatedDate: new Date(Date.now() - 178 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 95,
    idUser: 5,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'GamingTech' with total amount $3,800.00",
    logCreatedDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 96,
    idUser: 1,
    actionType: ActionTypeCode["add-product"],
    actionDetails: "Added new product: Elgato Wave 3 (ID: 43) with stock quantity 7",
    logCreatedDate: new Date(Date.now() - 182 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 97,
    idUser: 2,
    actionType: ActionTypeCode["modify-client-statue"],
    actionDetails: "Changed client status from 'suspended' to 'active' for client ID: 188 (Resolved)",
    logCreatedDate: new Date(Date.now() - 184 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 98,
    idUser: 3,
    actionType: ActionTypeCode["add-supplier-product"],
    actionDetails: "Added supplier product: MacBook Air M2 from supplier 'AppleStore' with quantity 11",
    logCreatedDate: new Date(Date.now() - 186 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 99,
    idUser: 4,
    actionType: ActionTypeCode["modify-order-statue"],
    actionDetails: "Updated order status from 'pending' to 'confirmed' for order ID: 1250",
    logCreatedDate: new Date(Date.now() - 188 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    idLog: 100,
    idUser: 5,
    actionType: ActionTypeCode["add-invoice"],
    actionDetails: "Created new invoice for supplier 'GamingWorld' with total amount $4,800.00",
    logCreatedDate: new Date(Date.now() - 190 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format date for display in admin logs
 */
function formatLogDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Get user by ID
 */
function getUserById(userId: number): PlatformUser | undefined {
  return mockPlatformUsers.find(user => user.idUser === userId);
}

/**
 * Get action type label
 */
function getActionTypeLabel(actionType: number): string {
  return ActionTypeLabels[actionType as ActionTypeCode] || 'Unknown Action';
}

// ============================================================================
// ENHANCED MOCK DATA
// ============================================================================

/**
 * Generate comprehensive admin logs with all details
 */
export const mockAdminLogs: AdminLogWithDetails[] = mockLogEntries.map(log => {
  const user = getUserById(log.idUser);
  if (!user) {
    throw new Error(`User not found for ID: ${log.idUser}`);
  }

  return {
    ...log,
    user,
    actionTypeLabel: getActionTypeLabel(log.actionType),
    formattedDate: formatLogDate(log.logCreatedDate),
  };
});

// ============================================================================
// PAGINATION FUNCTION
// ============================================================================

/**
 * Get paginated admin logs with filtering
 */
export function getAdminLogsPaginated(filters: AdminLogsFilters): AdminLogsPaginatedResponse {
  let filteredLogs = [...mockAdminLogs];

  // Apply search query filter
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filteredLogs = filteredLogs.filter(log => 
      log.actionDetails.toLowerCase().includes(query) ||
      log.user.userName.toLowerCase().includes(query) ||
      log.actionTypeLabel.toLowerCase().includes(query)
    );
  }

  // Apply user filter
  if (filters.userId) {
    filteredLogs = filteredLogs.filter(log => log.idUser === filters.userId);
  }

  // Apply action type filter
  if (filters.actionType !== undefined) {
    filteredLogs = filteredLogs.filter(log => log.actionType === filters.actionType);
  }

  // Apply date range filter
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom);
    filteredLogs = filteredLogs.filter(log => new Date(log.logCreatedDate) >= fromDate);
  }

  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    filteredLogs = filteredLogs.filter(log => new Date(log.logCreatedDate) <= toDate);
  }

  // Sort by newest first (default)
  filteredLogs.sort((a, b) => new Date(b.logCreatedDate).getTime() - new Date(a.logCreatedDate).getTime());

  // Calculate pagination
  const total = filteredLogs.length;
  const totalPages = Math.ceil(total / filters.limit);
  const currentPage = Math.min(filters.page, totalPages);
  const startIndex = (currentPage - 1) * filters.limit;
  const endIndex = startIndex + filters.limit;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  return {
    logs: paginatedLogs,
    total,
    totalPages,
    currentPage,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  };
}

// ============================================================================
// STATISTICS FUNCTION
// ============================================================================

/**
 * Calculate admin logs statistics
 */
export function getAdminLogsStats(): AdminLogsStats {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const logsToday = mockAdminLogs.filter(log => 
    new Date(log.logCreatedDate) >= today
  ).length;

  const logsThisWeek = mockAdminLogs.filter(log => 
    new Date(log.logCreatedDate) >= weekAgo
  ).length;

  const logsThisMonth = mockAdminLogs.filter(log => 
    new Date(log.logCreatedDate) >= monthAgo
  ).length;

  return {
    totalLogs: mockAdminLogs.length,
    logsToday,
    logsThisWeek,
    logsThisMonth,
  };
}

// ============================================================================
// EXPORT MOCK STATISTICS
// ============================================================================

export const mockAdminLogsStats: AdminLogsStats = getAdminLogsStats();
