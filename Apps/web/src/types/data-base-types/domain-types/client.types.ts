// Types for Client domain


// Interfaces
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
  clientStatus: number; // corresponds to index in clientStatues
  clientCreatedDate: string | Date;
  idCategory?: number | null; // nullable in DB
  clientCredit: number;
  clientSolde: number;
  clientPaid: number;
}

export interface ClientCategory {
  idCategory: number;
  categoryName: string;
  categoryStatus: number; // corresponds to index in categoryStatues
}

export interface ClientLog {
  idLog: number;
  idClient: number;
  clientActionType: number; // corresponds to index in clientActionTypes
  actionDetails: string;
  logCreatedDate: string | Date;
}
