import { Client, ClientCategory, ClientLog } from '@/types';
import { 
  ApiResponse, 
  SingleResponse, 
  CreateClientRequest, 
  UpdateClientRequest, 
  CreateCategoryRequest, 
  UpdateCategoryRequest, 
  CreateLogRequest,
  CheckPhoneRequest,
  CheckPhoneResponse
} from '@/types';

/**
 * Client API Service
 * Handles communication with backend client endpoints
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Type aliases for backward compatibility
export type ClientApiResponse<T> = ApiResponse<T>;
export type ClientSingleResponse<T> = SingleResponse<T>;

export const clientApiService = {
  /**
   * Normalize phone number to +213 format
   * Converts numbers starting with 0 to +213 format
   */
  normalizePhoneNumber(phone: string): string {
    if (!phone || typeof phone !== 'string') {
      return phone;
    }

    const normalizedPhone = phone.replace(/\s+/g, '');
    
    // If phone starts with 0, replace with +213
    if (normalizedPhone.startsWith('0')) {
      return '+213' + normalizedPhone.substring(1);
    }
    
    // If phone already starts with +213, return as is
    if (normalizedPhone.startsWith('+213')) {
      return normalizedPhone;
    }
    
    // Otherwise return original (invalid format will be caught by validation)
    return phone;
  },

  /**
   * Create a new client
   * Maps frontend registration data to backend client schema
   */
  async createClient(formData: Partial<Client>): Promise<ClientSingleResponse<Client>> {
    const normalizedPhone = this.normalizePhoneNumber(formData?.clientPhoneNumber || '');
    
    const requestData: CreateClientRequest = {
      clientFirstName: formData?.clientFirstName || '',
      clientLastName: formData?.clientLastName || '',
      clientEmail: formData?.clientEmail || undefined,
      clientPhoneNumber: normalizedPhone,
      clientWilaya: formData?.clientWilaya || '',
      clientCommune: formData?.clientCommune || '',
      clientStatus: 1, // pending status
      idCategory: undefined, // Optional - can be set later
      clientCredit: 0,
      clientSolde: 0,
      clientPaid: 0,
    };

    const response = await fetch(`${API_BASE_URL}/api/clients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Client creation failed');
    }

    return response.json();
  },

  // ==================== Core Client Operations ====================

  /**
   * Get all clients from the backend
   */
  async getAllClients(): Promise<Client[]> {
    const response = await fetch(`${API_BASE_URL}/api/clients`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch clients: ${response.statusText}`);
    }

    const result: ClientApiResponse<Client> = await response.json();
    return result.data || [];
  },

  /**
   * Get client by ID
   */
  async getClientById(id: number): Promise<Client | null> {
    const response = await fetch(`${API_BASE_URL}/api/clients/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch client: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || null;
  },

  /**
   * Update an existing client
   */
  async updateClient(id: number, data: UpdateClientRequest): Promise<Client> {
    const response = await fetch(`${API_BASE_URL}/api/clients/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update client: ${response.statusText}`);
    }

    const result: ClientSingleResponse<Client> = await response.json();
    return result.data;
  },

  /**
   * Delete a client
   */
  async deleteClient(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/clients/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete client: ${response.statusText}`);
    }
  },

  /**
   * Check if phone number already exists
   * Used for phone validation during registration
   */
  async checkPhoneExists(phone: string): Promise<boolean> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phone);
      const requestData: CheckPhoneRequest = { phone: normalizedPhone };
      
      const response = await fetch(`${API_BASE_URL}/api/clients/check-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response) {
        // If endpoint doesn't exist, assume phone doesn't exist
        return false;
      }

      const data: CheckPhoneResponse = await response.json();
      return data.exists || false;

    } catch (error) {
      // If endpoint fails, assume phone doesn't exist to allow registration
      console.error('Phone validation error:', error);
      return false;
    }
  },

  /**
   * Validate phone number format (basic Algerian format validation)
   */
  validatePhoneNumber(phone: string): boolean {
    if (!phone || typeof phone !== 'string') {
      return false;
    }

    const normalizedPhone = phone.replace(/\s+/g, '');
    const algerianPhoneRegex = /^(\+213[0-9]{9}|0[0-9]{9})$/;
                               
    return algerianPhoneRegex.test(normalizedPhone);
  },

  // ==================== Client Category Operations ====================

  /**
   * Get all client categories
   */
  async getAllCategories(): Promise<ClientCategory[]> {
    const response = await fetch(`${API_BASE_URL}/api/clients/categories`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch client categories: ${response.statusText}`);
    }

    const result: ClientApiResponse<ClientCategory> = await response.json();
    return result.data || [];
  },

  /**
   * Get client category by ID
   */
  async getCategoryById(id: number): Promise<ClientCategory | null> {
    const response = await fetch(`${API_BASE_URL}/api/clients/categories/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch client category: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || null;
  },

  /**
   * Create a new client category
   */
  async createCategory(data: CreateCategoryRequest): Promise<ClientCategory> {
    const response = await fetch(`${API_BASE_URL}/api/clients/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create client category: ${response.statusText}`);
    }

    const result: ClientSingleResponse<ClientCategory> = await response.json();
    return result.data;
  },

  /**
   * Update an existing client category
   */
  async updateCategory(id: number, data: UpdateCategoryRequest): Promise<ClientCategory> {
    const response = await fetch(`${API_BASE_URL}/api/clients/categories/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update client category: ${response.statusText}`);
    }

    const result: ClientSingleResponse<ClientCategory> = await response.json();
    return result.data;
  },

  /**
   * Delete a client category
   */
  async deleteCategory(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/clients/categories/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete client category: ${response.statusText}`);
    }
  },

  // ==================== Client Log Operations ====================

  /**
   * Get client logs (all logs or specific to a client)
   */
  async getClientLogs(clientId?: number): Promise<ClientLog[]> {
    const url = clientId 
      ? `${API_BASE_URL}/api/clients/${clientId}/logs`
      : `${API_BASE_URL}/api/clients/logs`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch client logs: ${response.statusText}`);
    }

    const result: ClientApiResponse<ClientLog> = await response.json();
    return result.data || [];
  },

  /**
   * Get client log by ID
   */
  async getLogById(id: number): Promise<ClientLog | null> {
    const response = await fetch(`${API_BASE_URL}/api/clients/logs/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch client log: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || null;
  },

  /**
   * Create a new client log
   */
  async createLog(data: CreateLogRequest): Promise<ClientLog> {
    const response = await fetch(`${API_BASE_URL}/api/clients/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create client log: ${response.statusText}`);
    }

    const result: ClientSingleResponse<ClientLog> = await response.json();
    return result.data;
  },
};
