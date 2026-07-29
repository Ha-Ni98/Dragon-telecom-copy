// Authentication types matching backend structure

export interface Client {
  idClient: number;
  clientUserName?: string | null;
  clientPassword?: string | null;
  clientFirstName: string;
  clientLastName: string;
  clientPhoneNumber: string;
  clientEmail?: string | null;
  clientWilaya: string;
  clientCommune: string;
  clientStatus: number;
  clientCreatedDate: string | Date;
  idCategory?: number | null;
  clientCredit: number;
  clientSolde: number;
  clientPaid: number;
}

export interface PlatformUser {
  idUser: number;
  userName: string;
  userPassword: string;
  userRole: number;
  userStatue: number;
}

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
