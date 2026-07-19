import { PlatformUser, UserLog } from '@/types';
import { 
  ApiResponse, 
  SingleResponse, 
  CreateUserRequest, 
  UpdateUserRequest, 
  CreateUserLogRequest
} from '@/types';

/**
 * User API Service
 * Handles communication with backend user endpoints
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Type aliases for backward compatibility
export type UserApiResponse<T> = ApiResponse<T>;
export type UserSingleResponse<T> = SingleResponse<T>;

export const userApiService = {
  // ==================== Platform User Operations ====================

  /**
   * Get all users from the backend
   */
  async getAllUsers(): Promise<PlatformUser[]> {
    const response = await fetch(`${API_BASE_URL}/api/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }

    const result: ApiResponse<PlatformUser> = await response.json();
    return result.data || [];
  },

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<PlatformUser | null> {
    const response = await fetch(`${API_BASE_URL}/api/users/username/${encodeURIComponent(username)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch user by username: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || null;
  },

  /**
   * Get user by ID
   */
  async getUserById(id: number): Promise<PlatformUser | null> {
    const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch user: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || null;
  },

  /**
   * Create a new user
   */
  async createUser(data: CreateUserRequest): Promise<PlatformUser> {
    const response = await fetch(`${API_BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create user: ${response.statusText}`);
    }

    const result: SingleResponse<PlatformUser> = await response.json();
    return result.data;
  },

  /**
   * Update an existing user
   */
  async updateUser(id: number, data: UpdateUserRequest): Promise<PlatformUser> {
    const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update user: ${response.statusText}`);
    }

    const result: SingleResponse<PlatformUser> = await response.json();
    return result.data;
  },

  /**
   * Delete a user
   */
  async deleteUser(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete user: ${response.statusText}`);
    }
  },

  // ==================== User Log Operations ====================

  /**
   * Get user logs (all logs or specific to a user)
   */
  async getUserLogs(userId?: number): Promise<UserLog[]> {
    const url = userId 
      ? `${API_BASE_URL}/api/users/${userId}/logs`
      : `${API_BASE_URL}/api/users/logs`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user logs: ${response.statusText}`);
    }

    const result: ApiResponse<UserLog> = await response.json();
    return result.data || [];
  },

  /**
   * Get user log by ID
   */
  async getUserLogById(id: number): Promise<UserLog | null> {
    const response = await fetch(`${API_BASE_URL}/api/users/logs/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch user log: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || null;
  },

  /**
   * Create a new user log
   */
  async createUserLog(data: CreateUserLogRequest): Promise<UserLog> {
    const response = await fetch(`${API_BASE_URL}/api/users/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create user log: ${response.statusText}`);
    }

    const result: SingleResponse<UserLog> = await response.json();
    return result.data;
  },

  // ==================== Utility Operations ====================

  /**
   * Get user with their logs (combined operation)
   */
  async getUserWithLogs(id: number): Promise<(PlatformUser & { logs: UserLog[] }) | null> {
    const user = await this.getUserById(id);
    if (!user) return null;

    const logs = await this.getUserLogs(id);
    return { ...user, logs };
  },

  /**
   * Get all users with their logs (batch operation)
   */
  async getUsersWithLogs(): Promise<(PlatformUser & { logs: UserLog[] })[]> {
    const users = await this.getAllUsers();
    const logs = await this.getUserLogs();
    
    return users.map(user => ({
      ...user,
      logs: logs.filter(log => log.idUser === user.idUser)
    }));
  },

  /**
   * Check if username exists
   */
  async checkUsernameExists(username: string): Promise<boolean> {
    try {
      const user = await this.getUserByUsername(username);
      return user !== null;
    } catch (error) {
      // If endpoint fails, assume username doesn't exist
      console.error('Username validation error:', error);
      return false;
    }
  },

  /**
   * Authenticate user (basic authentication)
   */
  async authenticateUser(username: string, password: string): Promise<PlatformUser | null> {
    try {
      const user = await this.getUserByUsername(username);
      if (!user) return null;

      // In a real app, you'd hash the password and compare with stored hash
      // For now, doing basic comparison (NOT SECURE - for demo only)
      if (user.userPassword === password) {
        // Remove password from response for security
        const { userPassword, ...userWithoutPassword } = user;
        return userWithoutPassword as PlatformUser;
      }

      return null;
    } catch (error) {
      console.error('Authentication error:', error);
      return null;
    }
  },
};
