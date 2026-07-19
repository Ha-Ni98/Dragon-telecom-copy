// Types for Supplier domain

export interface Supplier {
  idSupplier: number;
  supplierName: string;
  supplierPersonName?: string | null;
  supplierPhone?: string | null;
  supplierEmail?: string | null;
  supplierLocation?: string | null;
  supplierCreatedDate: string | Date;
  supplierTotalCredit: number;
  supplierTotalPaid: number;
  supplierTotalSold: number;
}

export interface SupplierInvoice {
  idInvoice: number;
  idSupplier: number;
  previousCredit: number;
  totalPrice: number;
  totalPriceWithDiscount: number;
  grandTotal: number;
  totalPaid: number;
  totalCredit: number;
  invoiceCreatedDate: string | Date;
  description?: string | null;
}

export interface SupplierInvoiceItem {
  idItem: number;
  idInvoice?: number | null; // nullable in DB
  idProduct?: number | null; // nullable in DB
  productName?: string | null; // used when idProduct is null
  itemQuantity: number;
  unitPrice: number;
  invoiceCreatedDate: string | Date;
}
