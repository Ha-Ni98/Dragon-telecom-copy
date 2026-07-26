export interface Supplier {
  idSupplier: number;
  supplierName: string;
  supplierCredit: number;
  supplierPersonName?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierLocation?: string;
  supplierCreatedDate: string; // ISO
}

export interface SupplierInvoice {
  idInvoice: number;
  idSupplier: number;
  Due: number;
  totalDue: number;
  currentSold: number;
  paid: number;
  credit: number;
  invoiceCreatedDate: string; // ISO
}


