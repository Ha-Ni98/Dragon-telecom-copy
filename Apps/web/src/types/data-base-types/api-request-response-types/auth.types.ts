/**
 * Auth API Request/Response Types
 * Types for authentication-related API operations
 */
import { Client } from "../domain-types/client.types";
import { PlatformUser } from "../domain-types/user.types";

// ==================== Auth API Request Types ====================

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  authType: 'client' | 'user';
  data: any;
  token?: string;
}


// Authentication types matching backend structure

export interface AuthResponseClient {
  authType: 'client';
  data: Client;
}

export interface AuthResponseUser {
  authType: 'user';
  data: PlatformUser;
}

export type AuthResponse = AuthResponseClient | AuthResponseUser;

export type AuthUser = Client | PlatformUser;

export interface AuthContextValue {
  user: AuthUser | null;
  authType: 'client' | 'user' | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string; authType?: 'client' | 'user' }>;
  logout: () => void;
}
