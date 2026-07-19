import { Client, ClientCategory, UserAccountData, AdminClientWithDetails, AdminClientsStats, AdminClientsPaginatedResponse, AdminClientsFilters } from "@/types/draft-types";
import { ClientStatusCode } from "@/types/draft-types";

export const mockClientCategories: ClientCategory[] = [
  { idCategory: 1, categoryName: "Retail", categoryStatus: 0 },
  { idCategory: 2, categoryName: "Wholesale", categoryStatus: 0 },
];

export const mockClients: Client[] = [
  {
    idClient: 1,
    clientUserName: "ahmed_benali",
    clientPassword: "hashed_password_1",
    clientFirstName: "Ahmed",
    clientLastName: "Benali",
    clientPhoneNumber: "+213 555 123 456",
    clientEmail: "ahmed.benali@email.com",
    clientWilaya: "Algiers",
    clientCommune: "Bab El Oued",
    clientStatus: ClientStatusCode.active,
    clientCreatedDate: "2024-01-15T10:30:00.000Z",
    clientLocation: "123 Rue de la République, Bab El Oued",
    idCategory: 1,
    clientCredit: 15000,
    clientSolde: 2500,
    clientPaid: 5000,
  },
  {
    idClient: 2,
    clientUserName: "fatima_zohra",
    clientPassword: "hashed_password_2",
    clientFirstName: "Fatima",
    clientLastName: "Zohra",
    clientPhoneNumber: "+213 555 234 567",
    clientEmail: "fatima.zohra@email.com",
    clientWilaya: "Oran",
    clientCommune: "Sidi El Houari",
    clientStatus: ClientStatusCode.active,
    clientCreatedDate: "2024-01-12T14:20:00.000Z",
    clientLocation: "456 Avenue de l'Indépendance, Sidi El Houari",
    idCategory: 1,
    clientCredit: 0,
    clientSolde: 0,
    clientPaid: 0,
  },
  {
    idClient: 3,
    clientUserName: "mohamed_amine",
    clientPassword: "hashed_password_3",
    clientFirstName: "Mohamed",
    clientLastName: "Amine",
    clientPhoneNumber: "+213 555 345 678",
    clientEmail: "mohamed.amine@email.com",
    clientWilaya: "Constantine",
    clientCommune: "El Khroub",
    clientStatus: ClientStatusCode.pending,
    clientCreatedDate: "2024-01-10T09:15:00.000Z",
    clientLocation: "789 Rue des Martyrs, El Khroub",
    idCategory: 2,
    clientCredit: 0,
    clientSolde: 0,
    clientPaid: 0,
  },
  {
    idClient: 4,
    clientUserName: "aicha_boumediene",
    clientPassword: "hashed_password_4",
    clientFirstName: "Aicha",
    clientLastName: "Boumediene",
    clientPhoneNumber: "+213 555 456 789",
    clientEmail: "aicha.boumediene@email.com",
    clientWilaya: "Blida",
    clientCommune: "Blida",
    clientStatus: ClientStatusCode.active,
    clientCreatedDate: "2024-01-08T16:45:00.000Z",
    clientLocation: "321 Avenue des Frères Boumediene, Blida",
    idCategory: 1,
    clientCredit: 5000,
    clientSolde: 1000,
    clientPaid: 2000,
  },
  {
    idClient: 5,
    clientUserName: "youssef_chaoui",
    clientPassword: "hashed_password_5",
    clientFirstName: "Youssef",
    clientLastName: "Chaoui",
    clientPhoneNumber: "+213 555 567 890",
    clientEmail: "youssef.chaoui@email.com",
    clientWilaya: "Tizi Ouzou",
    clientCommune: "Tizi Ouzou",
    clientStatus: ClientStatusCode.disabled,
    clientCreatedDate: "2023-12-20T11:30:00.000Z",
    clientLocation: "654 Rue de la Liberté, Tizi Ouzou",
    idCategory: 2,
    clientCredit: 0,
    clientSolde: 0,
    clientPaid: 0,
  },
  {
    idClient: 6,
    clientUserName: "khadija_merabet",
    clientPassword: "hashed_password_6",
    clientFirstName: "Khadija",
    clientLastName: "Merabet",
    clientPhoneNumber: "+213 555 678 901",
    clientEmail: "khadija.merabet@email.com",
    clientWilaya: "Annaba",
    clientCommune: "Annaba",
    clientStatus: ClientStatusCode.active,
    clientCreatedDate: "2024-01-05T13:20:00.000Z",
    clientLocation: "987 Boulevard de la Révolution, Annaba",
    idCategory: 1,
    clientCredit: 0,
    clientSolde: 0,
    clientPaid: 0,
  },
  {
    idClient: 7,
    clientUserName: "omar_benkaci",
    clientPassword: "hashed_password_7",
    clientFirstName: "Omar",
    clientLastName: "Benkaci",
    clientPhoneNumber: "+213 555 789 012",
    clientEmail: "omar.benkaci@email.com",
    clientWilaya: "Sétif",
    clientCommune: "Sétif",
    clientStatus: ClientStatusCode.refused,
    clientCreatedDate: "2023-12-15T08:45:00.000Z",
    clientLocation: "147 Rue de l'Université, Sétif",
    idCategory: 2,
    clientCredit: 0,
    clientSolde: 0,
    clientPaid: 0,
  },
  {
    idClient: 8,
    clientUserName: "nadia_ferhat",
    clientPassword: "hashed_password_8",
    clientFirstName: "Nadia",
    clientLastName: "Ferhat",
    clientPhoneNumber: "+213 555 890 123",
    clientEmail: "nadia.ferhat@email.com",
    clientWilaya: "Béjaïa",
    clientCommune: "Béjaïa",
    clientStatus: ClientStatusCode.active,
    clientCreatedDate: "2024-01-03T15:10:00.000Z",
    clientLocation: "258 Avenue du 1er Novembre, Béjaïa",
    idCategory: 1,
    clientCredit: 0,
    clientSolde: 0,
    clientPaid: 0,
  },
  {
    idClient: 9,
    clientUserName: "rachid_hamid",
    clientPassword: "hashed_password_9",
    clientFirstName: "Rachid",
    clientLastName: "Hamid",
    clientPhoneNumber: "+213 555 901 234",
    clientEmail: "rachid.hamid@email.com",
    clientWilaya: "Batna",
    clientCommune: "Batna",
    clientStatus: ClientStatusCode.pending,
    clientCreatedDate: "2024-01-01T12:00:00.000Z",
    clientLocation: "369 Rue de l'Indépendance, Batna",
    idCategory: 2,
    clientCredit: 0,
    clientSolde: 0,
    clientPaid: 0,
  },
  {
    idClient: 10,
    clientUserName: "sara_meziane",
    clientPassword: "hashed_password_10",
    clientFirstName: "Sara",
    clientLastName: "Meziane",
    clientPhoneNumber: "+213 555 012 345",
    clientEmail: "sara.meziane@email.com",
    clientWilaya: "Mostaganem",
    clientCommune: "Mostaganem",
    clientStatus: ClientStatusCode.active,
    clientCreatedDate: "2023-12-28T17:30:00.000Z",
    clientLocation: "741 Boulevard de la République, Mostaganem",
    idCategory: 1,
    clientCredit: 0,
    clientSolde: 0,
    clientPaid: 0,
  },
  {
    idClient: 11,
    clientUserName: "tarek_ouali",
    clientPassword: "hashed_password_11",
    clientFirstName: "Tarek",
    clientLastName: "Ouali",
    clientPhoneNumber: "+213 555 123 456",
    clientEmail: "tarek.ouali@email.com",
    clientWilaya: "Djelfa",
    clientCommune: "Djelfa",
    clientStatus: ClientStatusCode.disabled,
    clientCreatedDate: "2023-12-10T10:15:00.000Z",
    clientLocation: "852 Rue de la Paix, Djelfa",
    idCategory: 2,
    clientCredit: 0,
    clientSolde: 0,
    clientPaid: 0,
  },
  {
    idClient: 12,
    clientUserName: "zineb_rahmani",
    clientPassword: "hashed_password_12",
    clientFirstName: "Zineb",
    clientLastName: "Rahmani",
    clientPhoneNumber: "+213 555 234 567",
    clientEmail: "zineb.rahmani@email.com",
    clientWilaya: "Tlemcen",
    clientCommune: "Tlemcen",
    clientStatus: ClientStatusCode.active,
    clientCreatedDate: "2023-12-05T14:45:00.000Z",
    clientLocation: "963 Avenue de l'Indépendance, Tlemcen",
    idCategory: 1,
    clientCredit: 0,
    clientSolde: 0,
    clientPaid: 0,
  },
];

// Mock data for My Account page user data
export const mockUserAccountData: UserAccountData = {
  idClient: 1,
  clientFirstName: "Ahmed",
  clientLastName: "Bennaceur", 
  clientEmail: "ahmed.bennaceur@example.com",
  clientPhoneNumber: "+213 555 123 456",
  clientLocation: "123 Rue Mohamed Ali, Bab Ezzouar",
  clientStatus: ClientStatusCode.active,
  idCategory: 1,
  clientCreatedDate: "2023-06-15T00:00:00.000Z",
  clientCredit: 15000, // red
  clientSolde: 2500, // blue (balance)
  clientPaid: 5000 // green
};

// Mock data for phone number validation
export const mockExistingPhones = [
  "+213 555 555 555",
  "+213 666 666 666",
  "+213 777 777 777",
  "+213 888 888 888",
  "0555555555",
  "0666666666",
  "0777777777"
];

// Enhanced mock data for admin clients with additional details
export const mockAdminClients: AdminClientWithDetails[] = [
  {
    ...mockClients[0], // Ahmed Benali
    totalOrders: 12,
    totalSpent: 580000,
    lastOrderDate: "2024-01-15T10:30:00.000Z",
    fullName: "Ahmed Benali",
    displayStatus: "Active"
  },
  {
    ...mockClients[1], // Fatima Zohra
    totalOrders: 8,
    totalSpent: 320000,
    lastOrderDate: "2024-01-12T14:20:00.000Z",
    fullName: "Fatima Zohra",
    displayStatus: "Active"
  },
  {
    ...mockClients[2], // Mohamed Amine
    totalOrders: 3,
    totalSpent: 150000,
    lastOrderDate: "2024-01-10T09:15:00.000Z",
    fullName: "Mohamed Amine",
    displayStatus: "Pending"
  },
  {
    ...mockClients[3], // Aicha Boumediene
    totalOrders: 15,
    totalSpent: 750000,
    lastOrderDate: "2024-01-08T16:45:00.000Z",
    fullName: "Aicha Boumediene",
    displayStatus: "Active"
  },
  {
    ...mockClients[4], // Youssef Chaoui
    totalOrders: 0,
    totalSpent: 0,
    lastOrderDate: undefined,
    fullName: "Youssef Chaoui",
    displayStatus: "Disabled"
  },
  {
    ...mockClients[5], // Khadija Merabet
    totalOrders: 5,
    totalSpent: 250000,
    lastOrderDate: "2024-01-05T13:20:00.000Z",
    fullName: "Khadija Merabet",
    displayStatus: "Active"
  },
  {
    ...mockClients[6], // Omar Benkaci
    totalOrders: 0,
    totalSpent: 0,
    lastOrderDate: undefined,
    fullName: "Omar Benkaci",
    displayStatus: "Refused"
  },
  {
    ...mockClients[7], // Nadia Ferhat
    totalOrders: 7,
    totalSpent: 350000,
    lastOrderDate: "2024-01-03T15:10:00.000Z",
    fullName: "Nadia Ferhat",
    displayStatus: "Active"
  },
  {
    ...mockClients[8], // Rachid Hamid
    totalOrders: 2,
    totalSpent: 100000,
    lastOrderDate: "2024-01-01T12:00:00.000Z",
    fullName: "Rachid Hamid",
    displayStatus: "Pending"
  },
  {
    ...mockClients[9], // Sara Meziane
    totalOrders: 9,
    totalSpent: 450000,
    lastOrderDate: "2023-12-28T17:30:00.000Z",
    fullName: "Sara Meziane",
    displayStatus: "Active"
  },
  {
    ...mockClients[10], // Tarek Ouali
    totalOrders: 0,
    totalSpent: 0,
    lastOrderDate: undefined,
    fullName: "Tarek Ouali",
    displayStatus: "Disabled"
  },
  {
    ...mockClients[11], // Zineb Rahmani
    totalOrders: 4,
    totalSpent: 200000,
    lastOrderDate: "2023-12-05T14:45:00.000Z",
    fullName: "Zineb Rahmani",
    displayStatus: "Active"
  }
];

// Mock statistics data for admin clients
export const mockAdminClientsStats: AdminClientsStats = {
  totalClients: 12,
  activeClients: 7,
  newThisMonth: 4,
  averageOrdersPerClient: 5.2
};

// Helper function to get clients with pagination
export function getAdminClientsPaginated(filters: AdminClientsFilters): AdminClientsPaginatedResponse {
  let filteredClients = [...mockAdminClients];
  
  // Apply search filter
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filteredClients = filteredClients.filter(client => 
      client.fullName.toLowerCase().includes(query) ||
      client.clientPhoneNumber.includes(query) ||
      (client.clientEmail && client.clientEmail.toLowerCase().includes(query))
    );
  }
  
  // Apply status filter
  if (filters.status && filters.status !== 'all') {
    filteredClients = filteredClients.filter(client => 
      client.displayStatus.toLowerCase() === filters.status.toLowerCase()
    );
  }
  
  // Calculate pagination
  const totalItems = filteredClients.length;
  const totalPages = Math.ceil(totalItems / filters.limit);
  const startIndex = (filters.page - 1) * filters.limit;
  const endIndex = startIndex + filters.limit;
  const paginatedClients = filteredClients.slice(startIndex, endIndex);
  
  return {
    clients: paginatedClients,
    pagination: {
      currentPage: filters.page,
      totalPages,
      totalItems,
      itemsPerPage: filters.limit,
      hasNextPage: filters.page < totalPages,
      hasPreviousPage: filters.page > 1
    }
  };
}


