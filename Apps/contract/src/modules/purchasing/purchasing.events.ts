// supplierInvoice.cancelled and supplier.creditChanged have no explicit payload in the
// spec; the latter mirrors clients' posClient.creditChanged shape.
export type PurchasingEvents = {
  'supplierInvoice.confirmed': {
    invoiceId: string;
    supplierId: string;
    totalAmount: number;
    previousCredit: number;
    newCredit: number;
  };
  'supplierInvoice.cancelled': { invoiceId: string; supplierId: string; reason?: string };
  'payment.supplierRecorded': {
    paymentId: string;
    supplierId: string;
    supplierInvoiceReference?: string;
    amount: number;
    previousCredit: number;
    newCredit: number;
  };
  'supplier.creditChanged': {
    supplierId: string;
    previousCredit: number;
    newCredit: number;
    cause: string;
  };
};
