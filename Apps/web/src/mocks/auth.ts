// Mock authentication data for testing
export interface MockUser {
  id: number;
  email: string;
  password: string;
  name: string;
  role: "admin" | "user";
  isActive: boolean;
  idCategory: number;
  categoryName: string;
}

// Mock users for authentication testing
export const mockUsers: MockUser[] = [
  {
    id: 1,
    email: "ahmed.bennaceur@example.com",
    password: "password123",
    name: "Ahmed Bennaceur",
    role: "user",
    isActive: true,
    idCategory: 1,
    categoryName: "Premium"
  },
  {
    id: 2,
    email: "admin@dragon-telecom.com",
    password: "admin123",
    name: "Admin User",
    role: "admin",
    isActive: true,
    idCategory: 1,
    categoryName: "Premium"
  },
  {
    id: 3,
    email: "test.user@example.com",
    password: "test123",
    name: "Test User",
    role: "user",
    isActive: true,
    idCategory: 2,
    categoryName: "Standard"
  },
  {
    id: 4,
    email: "basic.user@example.com",
    password: "basic123",
    name: "Basic User",
    role: "user",
    isActive: true,
    idCategory: 3,
    categoryName: "Basic"
  },
  {
    id: 5,
    email: "inactive.user@example.com",
    password: "inactive123",
    name: "Inactive User",
    role: "user",
    isActive: false,
    idCategory: 3,
    categoryName: "Basic"
  }
];

// Mock authentication service
export class MockAuthService {
  static async authenticate(email: string, password: string): Promise<MockUser | null> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const user = mockUsers.find(
      u => u.email === email && u.password === password && u.isActive
    );
    
    return user || null;
  }
  
  static async getUserByEmail(email: string): Promise<MockUser | null> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return mockUsers.find(u => u.email === email) || null;
  }
  
  static async validateUser(userId: number): Promise<boolean> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const user = mockUsers.find(u => u.id === userId && u.isActive);
    return !!user;
  }
}
