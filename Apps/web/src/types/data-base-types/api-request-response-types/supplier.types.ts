/**
 * Supplier API Request/Response Types
 * Types for supplier-related API operations
 */

// ==================== Supplier API Request Types ====================

export interface CreateSupplierRequest {
  supplierName: string;
  supplierPersonName?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierLocation?: string;
  supplierTotalCredit: number;
  supplierTotalPaid: number;
  supplierTotalSold: number;
}

export interface UpdateSupplierRequest {
  supplierName?: string;
  supplierPersonName?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierLocation?: string;
  supplierTotalCredit?: number;
  supplierTotalPaid?: number;
  supplierTotalSold?: number;
}

export interface CreateSupplierInvoiceRequest {
  idSupplier: number;
  previousCredit: number;
  totalPrice: number;
  totalPriceWithDiscount: number;
  grandTotal: number;
  totalPaid: number;
  totalCredit: number;
  description?: string;
}

export interface UpdateSupplierInvoiceRequest {
  idSupplier?: number;
  previousCredit?: number;
  totalPrice?: number;
  totalPriceWithDiscount?: number;
  grandTotal?: number;
  totalPaid?: number;
  totalCredit?: number;
  description?: string;
}

export interface CreateSupplierInvoiceItemRequest {
  idInvoice?: number;
  idProduct?: number;
  productName?: string;
  itemQuantity: number;
  unitPrice: number;
}

export interface UpdateSupplierInvoiceItemRequest {
  idInvoice?: number;
  idProduct?: number;
  productName?: string;
  itemQuantity?: number;
  unitPrice?: number;
}
