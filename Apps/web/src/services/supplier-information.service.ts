// Purchasing domain (single-supplier detail page) — Sub-01 scaffolding. See catalog.service.ts's
// header comment for the numeric-id/view-model scope decision this follows.
import {
  SupplierWithDetails,
  SupplierFormData,
  ProductSupplyHistory
} from '@/types/draft-types/admin-suppliers.types';
import { SupplierInvoice } from '@/types/draft-types/supplier.types';

const NOT_WIRED = 'This action is not available yet.';

export const supplierInformationService = {
  async getSupplierWithDetails(_id: number): Promise<SupplierWithDetails | null> {
    return null;
  },

  async updateSupplier(_id: number, _data: SupplierFormData): Promise<SupplierWithDetails> {
    throw new Error(NOT_WIRED);
  },

  async getSupplierInvoices(_id: number): Promise<SupplierInvoice[]> {
    return [];
  },

  async deleteSupplierInvoice(_invoiceId: number): Promise<void> {},

  async getSupplierProductHistory(_id: number): Promise<ProductSupplyHistory[]> {
    return [];
  },
};
