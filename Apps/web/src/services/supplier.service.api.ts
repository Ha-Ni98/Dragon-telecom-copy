import { Supplier, SupplierInvoice, SupplierInvoiceItem } from '@/types';
import { 
  ApiResponse, 
  SingleResponse, 
  CreateSupplierRequest, 
  UpdateSupplierRequest, 
  CreateSupplierInvoiceRequest, 
  UpdateSupplierInvoiceRequest, 
  CreateSupplierInvoiceItemRequest, 
  UpdateSupplierInvoiceItemRequest
} from '@/types';

/**
 * Supplier API Service
 * Handles communication with backend supplier endpoints
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Type aliases for backward compatibility
export type SupplierApiResponse<T> = ApiResponse<T>;
export type SupplierSingleResponse<T> = SingleResponse<T>;

export const supplierApiService = {
  // ==================== Supplier Operations ====================

  /**
   * Get all suppliers from the backend
   */
  async getAllSuppliers(): Promise<Supplier[]> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch suppliers: ${response.statusText}`);
    }

    const result: ApiResponse<Supplier> = await response.json();
    return result.data || [];
  },

  /**
   * Get supplier by ID
   */
  async getSupplierById(id: number): Promise<Supplier | null> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch supplier: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || null;
  },

  /**
   * Create a new supplier
   */
  async createSupplier(data: CreateSupplierRequest): Promise<Supplier> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create supplier: ${response.statusText}`);
    }

    const result: SingleResponse<Supplier> = await response.json();
    return result.data;
  },

  /**
   * Update an existing supplier
   */
  async updateSupplier(id: number, data: UpdateSupplierRequest): Promise<Supplier> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update supplier: ${response.statusText}`);
    }

    const result: SingleResponse<Supplier> = await response.json();
    return result.data;
  },

  /**
   * Delete a supplier
   */
  async deleteSupplier(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete supplier: ${response.statusText}`);
    }
  },

  // ==================== Supplier Invoice Operations ====================

  /**
   * Get all supplier invoices
   */
  async getSupplierInvoices(): Promise<SupplierInvoice[]> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers/invoices`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch supplier invoices: ${response.statusText}`);
    }

    const result: ApiResponse<SupplierInvoice> = await response.json();
    return result.data || [];
  },

  /**
   * Get supplier invoice by ID
   */
  async getSupplierInvoiceById(id: number): Promise<SupplierInvoice | null> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers/invoices/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch supplier invoice: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || null;
  },

  /**
   * Create a new supplier invoice
   */
  async createSupplierInvoice(data: CreateSupplierInvoiceRequest): Promise<SupplierInvoice> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create supplier invoice: ${response.statusText}`);
    }

    const result: SingleResponse<SupplierInvoice> = await response.json();
    return result.data;
  },

  /**
   * Update an existing supplier invoice
   */
  async updateSupplierInvoice(id: number, data: UpdateSupplierInvoiceRequest): Promise<SupplierInvoice> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers/invoices/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update supplier invoice: ${response.statusText}`);
    }

    const result: SingleResponse<SupplierInvoice> = await response.json();
    return result.data;
  },

  /**
   * Delete a supplier invoice
   */
  async deleteSupplierInvoice(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers/invoices/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete supplier invoice: ${response.statusText}`);
    }
  },

  // ==================== Supplier Invoice Item Operations ====================

  /**
   * Get all supplier invoice items or specific to an invoice
   */
  async getSupplierInvoiceItems(invoiceId?: number): Promise<SupplierInvoiceItem[]> {
    const url = invoiceId 
      ? `${API_BASE_URL}/api/suppliers/invoices/${invoiceId}/items`
      : `${API_BASE_URL}/api/suppliers/invoice-items`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch supplier invoice items: ${response.statusText}`);
    }

    const result: ApiResponse<SupplierInvoiceItem> = await response.json();
    return result.data || [];
  },

  /**
   * Get supplier invoice item by ID
   */
  async getSupplierInvoiceItemById(id: number): Promise<SupplierInvoiceItem | null> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers/invoice-items/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch supplier invoice item: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || null;
  },

  /**
   * Create a new supplier invoice item
   */
  async createSupplierInvoiceItem(data: CreateSupplierInvoiceItemRequest): Promise<SupplierInvoiceItem> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers/invoice-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create supplier invoice item: ${response.statusText}`);
    }

    const result: SingleResponse<SupplierInvoiceItem> = await response.json();
    return result.data;
  },

  /**
   * Update an existing supplier invoice item
   */
  async updateSupplierInvoiceItem(id: number, data: UpdateSupplierInvoiceItemRequest): Promise<SupplierInvoiceItem> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers/invoice-items/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update supplier invoice item: ${response.statusText}`);
    }

    const result: SingleResponse<SupplierInvoiceItem> = await response.json();
    return result.data;
  },

  /**
   * Delete a supplier invoice item
   */
  async deleteSupplierInvoiceItem(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers/invoice-items/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete supplier invoice item: ${response.statusText}`);
    }
  },

  // ==================== Utility Operations ====================

  /**
   * Get supplier with their invoices (combined operation)
   */
  async getSupplierWithInvoices(id: number): Promise<(Supplier & { invoices: SupplierInvoice[] }) | null> {
    const supplier = await this.getSupplierById(id);
    if (!supplier) return null;

    const invoices = await this.getSupplierInvoices();
    const supplierInvoices = invoices.filter(invoice => invoice.idSupplier === id);
    
    return { ...supplier, invoices: supplierInvoices };
  },

  /**
   * Get supplier invoice with its items (single invoice with details)
   */
  async getSupplierInvoiceWithItems(id: number): Promise<(SupplierInvoice & { items: SupplierInvoiceItem[] }) | null> {
    const invoice = await this.getSupplierInvoiceById(id);
    if (!invoice) return null;

    const items = await this.getSupplierInvoiceItems(id);
    return { ...invoice, items };
  },

  /**
   * Get all suppliers with their invoices (batch operation)
   */
  async getSuppliersWithInvoices(): Promise<(Supplier & { invoices: SupplierInvoice[] })[]> {
    const suppliers = await this.getAllSuppliers();
    const invoices = await this.getSupplierInvoices();
    
    return suppliers.map(supplier => ({
      ...supplier,
      invoices: invoices.filter(invoice => invoice.idSupplier === supplier.idSupplier)
    }));
  },
};
