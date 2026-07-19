/**
 * Admin Suppliers Mock Data
 * Comprehensive mock data for supplier management functionality
 */

import { 
  AdminSuppliersStats, 
  AdminSuppliersPaginatedResponse, 
  SupplierWithDetails,
  AdminSuppliersFilters,
  PaginationInfo
} from '@/types/draft-types/admin-suppliers.types';
import { Supplier, SupplierInvoice } from '@/types/draft-types/supplier.types';

/**
 * Mock suppliers data with enhanced information
 */
export const mockSuppliers: Supplier[] = [
  {
    idSupplier: 1,
    supplierName: 'TechDistributors Algeria',
    supplierCredit: 150000,
    supplierPersonName: 'Ahmed Benali',
    supplierPhone: '+213 555 123 456',
    supplierEmail: 'ahmed@techdistributors.dz',
    supplierLocation: 'Algiers, Algeria',
    supplierCreatedDate: '2023-01-15T10:00:00Z',
  },
  {
    idSupplier: 2,
    supplierName: 'Mobile Solutions SARL',
    supplierCredit: 200000,
    supplierPersonName: 'Fatima Zohra',
    supplierPhone: '+213 555 234 567',
    supplierEmail: 'fatima@mobilesolutions.dz',
    supplierLocation: 'Oran, Algeria',
    supplierCreatedDate: '2023-02-20T10:00:00Z',
  },
  {
    idSupplier: 3,
    supplierName: 'ElectroTech Import',
    supplierCredit: 120000,
    supplierPersonName: 'Mohamed Khelil',
    supplierPhone: '+213 555 345 678',
    supplierEmail: 'mohamed@electrotech.dz',
    supplierLocation: 'Constantine, Algeria',
    supplierCreatedDate: '2023-03-10T10:00:00Z',
  },
  {
    idSupplier: 4,
    supplierName: 'Digital World Trading',
    supplierCredit: 180000,
    supplierPersonName: 'Aicha Boudjemaa',
    supplierPhone: '+213 555 456 789',
    supplierEmail: 'aicha@digitalworld.dz',
    supplierLocation: 'Annaba, Algeria',
    supplierCreatedDate: '2023-04-05T10:00:00Z',
  },
  {
    idSupplier: 5,
    supplierName: 'Smart Devices Co.',
    supplierCredit: 95000,
    supplierPersonName: 'Karim Mansouri',
    supplierPhone: '+213 555 567 890',
    supplierEmail: 'karim@smartdevices.dz',
    supplierLocation: 'Blida, Algeria',
    supplierCreatedDate: '2023-05-12T10:00:00Z',
  },
  {
    idSupplier: 6,
    supplierName: 'TechHub Distribution',
    supplierCredit: 220000,
    supplierPersonName: 'Sarah Benali',
    supplierPhone: '+213 555 678 901',
    supplierEmail: 'sarah@techhub.dz',
    supplierLocation: 'Tizi Ouzou, Algeria',
    supplierCreatedDate: '2023-06-18T10:00:00Z',
  },
  {
    idSupplier: 7,
    supplierName: 'Electronics Plus',
    supplierCredit: 75000,
    supplierPersonName: 'Omar Kaci',
    supplierPhone: '+213 555 789 012',
    supplierEmail: 'omar@electronicsplus.dz',
    supplierLocation: 'Sétif, Algeria',
    supplierCreatedDate: '2023-07-25T10:00:00Z',
  },
  {
    idSupplier: 8,
    supplierName: 'Digital Solutions Ltd',
    supplierCredit: 300000,
    supplierPersonName: 'Nadia Cherif',
    supplierPhone: '+213 555 890 123',
    supplierEmail: 'nadia@digitalsolutions.dz',
    supplierLocation: 'Béjaïa, Algeria',
    supplierCreatedDate: '2023-08-30T10:00:00Z',
  },
  {
    idSupplier: 9,
    supplierName: 'Mobile Accessories Pro',
    supplierCredit: 85000,
    supplierPersonName: 'Youssef Amrani',
    supplierPhone: '+213 555 901 234',
    supplierEmail: 'youssef@mobileaccessories.dz',
    supplierLocation: 'Batna, Algeria',
    supplierCreatedDate: '2023-09-15T10:00:00Z',
  },
  {
    idSupplier: 10,
    supplierName: 'Tech Components Inc',
    supplierCredit: 160000,
    supplierPersonName: 'Leila Boukhelifa',
    supplierPhone: '+213 555 012 345',
    supplierEmail: 'leila@techcomponents.dz',
    supplierLocation: 'Tlemcen, Algeria',
    supplierCreatedDate: '2023-10-08T10:00:00Z',
  },
  {
    idSupplier: 11,
    supplierName: 'Electronics Warehouse',
    supplierCredit: 110000,
    supplierPersonName: 'Hakim Boudiaf',
    supplierPhone: '+213 555 123 456',
    supplierEmail: 'hakim@electronicswarehouse.dz',
    supplierLocation: 'Mostaganem, Algeria',
    supplierCreatedDate: '2023-11-12T10:00:00Z',
  },
  {
    idSupplier: 12,
    supplierName: 'Smart Tech Distribution',
    supplierCredit: 240000,
    supplierPersonName: 'Samira Khelil',
    supplierPhone: '+213 555 234 567',
    supplierEmail: 'samira@smarttech.dz',
    supplierLocation: 'Jijel, Algeria',
    supplierCreatedDate: '2023-12-01T10:00:00Z',
  },
  {
    idSupplier: 13,
    supplierName: 'Digital Devices Co',
    supplierCredit: 135000,
    supplierPersonName: 'Rachid Benmessaoud',
    supplierPhone: '+213 555 345 678',
    supplierEmail: 'rachid@digitaldevices.dz',
    supplierLocation: 'Mascara, Algeria',
    supplierCreatedDate: '2024-01-10T10:00:00Z',
  },
  {
    idSupplier: 14,
    supplierName: 'Mobile World Trading',
    supplierCredit: 190000,
    supplierPersonName: 'Amina Bensalem',
    supplierPhone: '+213 555 456 789',
    supplierEmail: 'amina@mobileworld.dz',
    supplierLocation: 'Ghardaia, Algeria',
    supplierCreatedDate: '2024-02-14T10:00:00Z',
  },
  {
    idSupplier: 15,
    supplierName: 'Tech Innovations Ltd',
    supplierCredit: 275000,
    supplierPersonName: 'Mehdi Cherif',
    supplierPhone: '+213 555 567 890',
    supplierEmail: 'mehdi@techinnovations.dz',
    supplierLocation: 'Ouargla, Algeria',
    supplierCreatedDate: '2024-03-05T10:00:00Z',
  }
];

/**
 * Mock supplier invoices data
 */
export const mockSupplierInvoices: SupplierInvoice[] = [
  // Invoices for TechDistributors Algeria (ID: 1)
  {
    idInvoice: 1,
    idSupplier: 1,
    Due: 50000,
    totalDue: 200000,
    currentSold: 150000,
    paid: 100000,
    credit: 100000,
    invoiceCreatedDate: '2024-01-15T10:00:00Z',
  },
  {
    idInvoice: 2,
    idSupplier: 1,
    Due: 30000,
    totalDue: 230000,
    currentSold: 180000,
    paid: 150000,
    credit: 80000,
    invoiceCreatedDate: '2024-02-10T10:00:00Z',
  },
  // Invoices for Mobile Solutions SARL (ID: 2)
  {
    idInvoice: 3,
    idSupplier: 2,
    Due: 75000,
    totalDue: 275000,
    currentSold: 200000,
    paid: 125000,
    credit: 150000,
    invoiceCreatedDate: '2024-01-20T10:00:00Z',
  },
  {
    idInvoice: 4,
    idSupplier: 2,
    Due: 45000,
    totalDue: 320000,
    currentSold: 245000,
    paid: 170000,
    credit: 150000,
    invoiceCreatedDate: '2024-02-25T10:00:00Z',
  },
  // Invoices for ElectroTech Import (ID: 3)
  {
    idInvoice: 5,
    idSupplier: 3,
    Due: 40000,
    totalDue: 160000,
    currentSold: 120000,
    paid: 80000,
    credit: 80000,
    invoiceCreatedDate: '2024-01-25T10:00:00Z',
  },
  // Invoices for Digital World Trading (ID: 4)
  {
    idInvoice: 6,
    idSupplier: 4,
    Due: 60000,
    totalDue: 240000,
    currentSold: 180000,
    paid: 120000,
    credit: 120000,
    invoiceCreatedDate: '2024-02-05T10:00:00Z',
  },
  {
    idInvoice: 7,
    idSupplier: 4,
    Due: 35000,
    totalDue: 275000,
    currentSold: 215000,
    paid: 155000,
    credit: 120000,
    invoiceCreatedDate: '2024-03-12T10:00:00Z',
  },
  // Invoices for Smart Devices Co. (ID: 5)
  {
    idInvoice: 8,
    idSupplier: 5,
    Due: 25000,
    totalDue: 120000,
    currentSold: 95000,
    paid: 70000,
    credit: 50000,
    invoiceCreatedDate: '2024-01-30T10:00:00Z',
  },
  // Invoices for TechHub Distribution (ID: 6)
  {
    idInvoice: 9,
    idSupplier: 6,
    Due: 80000,
    totalDue: 300000,
    currentSold: 220000,
    paid: 140000,
    credit: 160000,
    invoiceCreatedDate: '2024-02-15T10:00:00Z',
  },
  // Invoices for Electronics Plus (ID: 7)
  {
    idInvoice: 10,
    idSupplier: 7,
    Due: 30000,
    totalDue: 105000,
    currentSold: 75000,
    paid: 45000,
    credit: 60000,
    invoiceCreatedDate: '2024-03-01T10:00:00Z',
  },
  // Invoices for Digital Solutions Ltd (ID: 8)
  {
    idInvoice: 11,
    idSupplier: 8,
    Due: 100000,
    totalDue: 400000,
    currentSold: 300000,
    paid: 200000,
    credit: 200000,
    invoiceCreatedDate: '2024-01-10T10:00:00Z',
  },
  {
    idInvoice: 12,
    idSupplier: 8,
    Due: 50000,
    totalDue: 450000,
    currentSold: 350000,
    paid: 250000,
    credit: 200000,
    invoiceCreatedDate: '2024-03-20T10:00:00Z',
  }
];

/**
 * Calculate supplier statistics
 */
export function getAdminSuppliersStats(): AdminSuppliersStats {
  const totalSuppliers = mockSuppliers.length;
  
  // Calculate total due from all invoices
  const totalDue = mockSupplierInvoices.reduce((sum, invoice) => sum + invoice.Due, 0);
  
  // Calculate total paid from all invoices
  const totalPaid = mockSupplierInvoices.reduce((sum, invoice) => sum + invoice.paid, 0);
  
  // Calculate total credit from all invoices
  const totalCredit = mockSupplierInvoices.reduce((sum, invoice) => sum + invoice.credit, 0);

  return {
    totalSuppliers,
    totalDue,
    totalPaid,
    totalCredit
  };
}

/**
 * Get paginated suppliers with details
 */
export function getAdminSuppliersPaginated(filters: AdminSuppliersFilters): AdminSuppliersPaginatedResponse {
  const { searchQuery = '', page = 1, limit = 10 } = filters;
  
  // Filter suppliers based on search query
  let filteredSuppliers = mockSuppliers;
  
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredSuppliers = mockSuppliers.filter(supplier => 
      supplier.supplierName.toLowerCase().includes(query) ||
      supplier.supplierPersonName?.toLowerCase().includes(query) ||
      supplier.supplierLocation?.toLowerCase().includes(query)
    );
  }
  
  // Calculate pagination
  const totalItems = filteredSuppliers.length;
  const totalPages = Math.ceil(totalItems / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  // Get suppliers for current page
  const paginatedSuppliers = filteredSuppliers.slice(startIndex, endIndex);
  
  // Convert to SupplierWithDetails
  const suppliersWithDetails: SupplierWithDetails[] = paginatedSuppliers.map(supplier => {
    const supplierInvoices = mockSupplierInvoices.filter(inv => inv.idSupplier === supplier.idSupplier);
    
    const totalDue = supplierInvoices.reduce((sum, inv) => sum + inv.Due, 0);
    const totalPaid = supplierInvoices.reduce((sum, inv) => sum + inv.paid, 0);
    const totalCredit = supplierInvoices.reduce((sum, inv) => sum + inv.credit, 0);
    
    // Mock products supplied count (in real app, this would come from database)
    const productsSuppliedCount = Math.floor(Math.random() * 50) + 1;
    
    return {
      ...supplier,
      productsSuppliedCount,
      invoicesCount: supplierInvoices.length,
      totalDue,
      totalPaid,
      totalCredit
    };
  });
  
  const pagination: PaginationInfo = {
    currentPage: page,
    totalPages,
    totalItems,
    itemsPerPage: limit,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
  
  return {
    suppliers: suppliersWithDetails,
    pagination
  };
}

/**
 * Get supplier by ID with details
 */
export function getSupplierWithDetails(id: number): SupplierWithDetails | null {
  const supplier = mockSuppliers.find(s => s.idSupplier === id);
  if (!supplier) return null;
  
  const supplierInvoices = mockSupplierInvoices.filter(inv => inv.idSupplier === id);
  
  const totalDue = supplierInvoices.reduce((sum, inv) => sum + inv.Due, 0);
  const totalPaid = supplierInvoices.reduce((sum, inv) => sum + inv.paid, 0);
  const totalCredit = supplierInvoices.reduce((sum, inv) => sum + inv.credit, 0);
  
  return {
    ...supplier,
    productsSuppliedCount: Math.floor(Math.random() * 50) + 1,
    invoicesCount: supplierInvoices.length,
    totalDue,
    totalPaid,
    totalCredit
  };
}

/**
 * Search suppliers by query
 */
export function searchSuppliers(query: string): SupplierWithDetails[] {
  const searchQuery = query.toLowerCase();
  
  const filteredSuppliers = mockSuppliers.filter(supplier => 
    supplier.supplierName.toLowerCase().includes(searchQuery) ||
    supplier.supplierPersonName?.toLowerCase().includes(searchQuery) ||
    supplier.supplierLocation?.toLowerCase().includes(searchQuery)
  );
  
  return filteredSuppliers.map(supplier => {
    const supplierInvoices = mockSupplierInvoices.filter(inv => inv.idSupplier === supplier.idSupplier);
    
    const totalDue = supplierInvoices.reduce((sum, inv) => sum + inv.Due, 0);
    const totalPaid = supplierInvoices.reduce((sum, inv) => sum + inv.paid, 0);
    const totalCredit = supplierInvoices.reduce((sum, inv) => sum + inv.credit, 0);
    
    return {
      ...supplier,
      productsSuppliedCount: Math.floor(Math.random() * 50) + 1,
      invoicesCount: supplierInvoices.length,
      totalDue,
      totalPaid,
      totalCredit
    };
  });
}

/**
 * Get suppliers by status (active/inactive based on credit amount)
 */
export function getSuppliersByStatus(status: 'active' | 'inactive'): SupplierWithDetails[] {
  const threshold = 100000; // Credit threshold for active/inactive status
  
  const filteredSuppliers = mockSuppliers.filter(supplier => {
    if (status === 'active') {
      return supplier.supplierCredit >= threshold;
    } else {
      return supplier.supplierCredit < threshold;
    }
  });
  
  return filteredSuppliers.map(supplier => {
    const supplierInvoices = mockSupplierInvoices.filter(inv => inv.idSupplier === supplier.idSupplier);
    
    const totalDue = supplierInvoices.reduce((sum, inv) => sum + inv.Due, 0);
    const totalPaid = supplierInvoices.reduce((sum, inv) => sum + inv.paid, 0);
    const totalCredit = supplierInvoices.reduce((sum, inv) => sum + inv.credit, 0);
    
    return {
      ...supplier,
      productsSuppliedCount: Math.floor(Math.random() * 50) + 1,
      invoicesCount: supplierInvoices.length,
      totalDue,
      totalPaid,
      totalCredit
    };
  });
}

/**
 * Get top suppliers by credit amount
 */
export function getTopSuppliersByCredit(limit: number = 5): SupplierWithDetails[] {
  const sortedSuppliers = [...mockSuppliers].sort((a, b) => b.supplierCredit - a.supplierCredit);
  
  return sortedSuppliers.slice(0, limit).map(supplier => {
    const supplierInvoices = mockSupplierInvoices.filter(inv => inv.idSupplier === supplier.idSupplier);
    
    const totalDue = supplierInvoices.reduce((sum, inv) => sum + inv.Due, 0);
    const totalPaid = supplierInvoices.reduce((sum, inv) => sum + inv.paid, 0);
    const totalCredit = supplierInvoices.reduce((sum, inv) => sum + inv.credit, 0);
    
    return {
      ...supplier,
      productsSuppliedCount: Math.floor(Math.random() * 50) + 1,
      invoicesCount: supplierInvoices.length,
      totalDue,
      totalPaid,
      totalCredit
    };
  });
}

/**
 * Helper function to simulate API delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get supplier invoices for supplier information page
 */
export function getSupplierInvoices(id: number): SupplierInvoice[] {
  return mockSupplierInvoices
    .filter(inv => inv.idSupplier === id)
    .sort((a, b) => new Date(b.invoiceCreatedDate).getTime() - new Date(a.invoiceCreatedDate).getTime());
}

/**
 * Get supplier product supply history for supplier information page
 */
export function getSupplierProductHistory(id: number): Array<{
  idProduct: number;
  productName: string;
  quantitySupplied: number;
  supplyDate: string;
}> {
  // Mock product supply history data
  const mockProductHistory = [
    {
      idProduct: 1,
      productName: 'Galaxy S21',
      quantitySupplied: 25,
      supplyDate: '2024-01-15T10:00:00Z',
    },
    {
      idProduct: 2,
      productName: 'Galaxy S24 Ultra',
      quantitySupplied: 8,
      supplyDate: '2024-01-20T10:00:00Z',
    },
    {
      idProduct: 3,
      productName: 'iPhone 15 Pro Max',
      quantitySupplied: 15,
      supplyDate: '2024-01-22T10:00:00Z',
    },
    {
      idProduct: 4,
      productName: 'MacBook Pro M3',
      quantitySupplied: 5,
      supplyDate: '2024-02-15T10:00:00Z',
    },
    {
      idProduct: 5,
      productName: 'iPad Air M2',
      quantitySupplied: 12,
      supplyDate: '2024-02-05T10:00:00Z',
    },
    {
      idProduct: 6,
      productName: 'AirPods Pro 2',
      quantitySupplied: 30,
      supplyDate: '2024-02-25T10:00:00Z',
    },
    {
      idProduct: 7,
      productName: 'Sony WH-1000XM5',
      quantitySupplied: 18,
      supplyDate: '2024-03-01T10:00:00Z',
    },
    {
      idProduct: 8,
      productName: 'LG OLED C3',
      quantitySupplied: 3,
      supplyDate: '2024-03-05T10:00:00Z',
    },
  ];

  // Filter by supplier ID (simplified - in real app this would be based on actual relationships)
  return mockProductHistory
    .filter((_, index) => index % 3 === (id % 3)) // Distribute products across suppliers
    .sort((a, b) => new Date(b.supplyDate).getTime() - new Date(a.supplyDate).getTime());
}
