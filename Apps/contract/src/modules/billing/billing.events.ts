import type { InvoiceSource } from './billing.enums';

// invoice.issued/invoice.cancelled have no payload in the spec — modelled minimally.
// Listens sale.confirmed / order.confirmed are documented in billing.md but not
// redeclared here; their payloads belong to sales/orders.
export type BillingEvents = {
  'invoice.issued': { invoiceNumber: string; sourceType: InvoiceSource; sourceReference: string };
  'invoice.cancelled': { invoiceNumber: string; reason?: string };
  'payment.clientRecorded': {
    paymentId: string;
    posClientId: string;
    invoiceNumber?: string;
    amount: number;
    previousCredit: number;
    newCredit: number;
  };
};
