/**
 * Admin Clients Service
 * Handles CRUD operations for client management
 */

import { 
  AdminClientsFilters, 
  AdminClientsPaginatedResponse, 
  AdminClientWithDetails,
  ClientModificationData 
} from "@/types/draft-types/client.types";
import { getAdminClientsPaginated, mockAdminClients } from "@/mocks/clients";

/**
 * Admin Clients Service
 * Provides methods for client management operations
 */
export class AdminClientsService {
  private static cache = new Map<string, any>();
  private static cacheTimeout = 2 * 60 * 1000; // 2 minutes

  /**
   * Get clients with pagination and filtering
   * Returns paginated list of clients based on filters
   */
  static async getClients(filters: AdminClientsFilters): Promise<AdminClientsPaginatedResponse> {
    const cacheKey = `admin-clients-${JSON.stringify(filters)}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/admin/clients', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(filters)
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const data = await response.json();

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock data for development
      const result = getAdminClientsPaginated(filters);

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching clients:', error);
      throw new Error('Failed to fetch clients');
    }
  }

  /**
   * Get client by ID
   * Returns detailed client information
   */
  static async getClientById(clientId: number): Promise<AdminClientWithDetails | null> {
    const cacheKey = `admin-client-${clientId}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/admin/clients/${clientId}`);
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const data = await response.json();

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 200));

      // Mock data for development - find client by ID
      const { mockAdminClients } = await import("@/mocks/clients");
      const client = mockAdminClients.find(c => c.idClient === clientId) || null;

      if (client) {
        this.setCache(cacheKey, client);
      }
      return client;
    } catch (error) {
      console.error('Error fetching client:', error);
      throw new Error('Failed to fetch client');
    }
  }

  /**
   * Modify client information
   * Updates client data with new information
   */
  static async modifyClient(clientId: number, updates: ClientModificationData): Promise<void> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/admin/clients/${clientId}`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(updates)
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));

      // Mock data for development
      console.log(`Modifying client ${clientId} with updates:`, updates);
      
      // Update mock data (for development purposes)
      const clientIndex = mockAdminClients.findIndex(client => client.idClient === clientId);
      if (clientIndex > -1) {
        const client = mockAdminClients[clientIndex];
        mockAdminClients[clientIndex] = {
          ...client,
          clientStatus: updates.status,
          clientCredit: updates.credit,
          clientUserName: updates.username || client.clientUserName,
          idCategory: updates.categoryId || client.idCategory,
          ...(updates.password && { clientPassword: updates.password }),
        };
        console.log('Client updated:', mockAdminClients[clientIndex]);
      } else {
        throw new Error('Client not found');
      }
      
      // In a real implementation, this would update the database
      // For now, we just simulate success
      
    } catch (error) {
      console.error('Error modifying client:', error);
      throw new Error('Failed to modify client');
    }
  }

  /**
   * Delete client
   * Removes client from the system
   */
  static async deleteClient(clientId: number): Promise<void> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/admin/clients/${clientId}`, {
      //   method: 'DELETE'
      // });
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 600));

      // Mock data for development
      console.log(`Deleting client ${clientId}`);
      
      // In a real implementation, this would remove the client from the database
      // For now, we just simulate success
      
    } catch (error) {
      console.error('Error deleting client:', error);
      throw new Error('Failed to delete client');
    }
  }

  /**
   * Search clients
   * Performs search across client data
   */
  static async searchClients(query: string): Promise<AdminClientWithDetails[]> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/admin/clients/search?q=${encodeURIComponent(query)}`);
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const data = await response.json();

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));

      // Mock data for development
      const { mockAdminClients } = await import("@/mocks/clients");
      const searchQuery = query.toLowerCase();
      
      const results = mockAdminClients.filter(client => 
        client.fullName.toLowerCase().includes(searchQuery) ||
        client.clientPhoneNumber.includes(searchQuery) ||
        (client.clientEmail && client.clientEmail.toLowerCase().includes(searchQuery))
      );

      return results;
    } catch (error) {
      console.error('Error searching clients:', error);
      throw new Error('Failed to search clients');
    }
  }

  /**
   * Get data from cache
   */
  private static getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set data in cache
   */
  private static setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   * Useful for forcing fresh data
   */
  static clearCache(): void {
    this.cache.clear();
  }
}
