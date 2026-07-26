// Re-export enums for convenience
export { ClientStatusCode } from "./enums.types";

export interface ClientCategory {
  idCategory: number;
  categoryName: string;
  categoryStatus: number; // CategoryStatusCode
}
