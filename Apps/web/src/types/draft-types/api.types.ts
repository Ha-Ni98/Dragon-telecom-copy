/**
 * API Types
 * Common request/response interfaces for all API services
 */

// ==================== Common API Response Types ====================

export interface ApiResponse<T> {
  success: boolean;
  data: T[];
  count: number;
}

export interface SingleResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

// ==================== Client API Request Types ====================

export interface CreateClientRequest {
  clientFirstName: string;
  clientLastName: string;
  clientEmail?: string;
  clientPhoneNumber: string;
  clientWilaya: string;
  clientCommune: string;
  clientStatus: number;
  idCategory?: number;
  clientCredit: number;
  clientSolde: number;
  clientPaid: number;
}

export interface UpdateClientRequest {
  clientFirstName?: string;
  clientLastName?: string;
  clientEmail?: string;
  clientPhoneNumber?: string;
  clientWilaya?: string;
  clientCommune?: string;
  clientStatus?: number;
  idCategory?: number;
  clientCredit?: number;
  clientSolde?: number;
  clientPaid?: number;
}

export interface CreateCategoryRequest {
  categoryName: string;
  categoryStatus: number;
}

export interface UpdateCategoryRequest {
  categoryName?: string;
  categoryStatus?: number;
}

export interface CreateLogRequest {
  idClient: number;
  clientActionType: number;
  actionDetails: string;
}

export interface CheckPhoneRequest {
  phone: string;
}

export interface CheckPhoneResponse {
  exists: boolean;
}

// ==================== Order API Request Types ====================

export interface CreateOrderRequest {
  idClient: number;
  orderType?: number;
  orderStatus: number;
  orderDeliveryName?: string;
  orderDeliveryPhone?: string;
  orderDeliveryWilaya?: string;
  orderDeliveryCommune?: string;
  orderDeliveryLocation?: string;
  orderTotalPrice: number;
  orderDeliveryFee: number;
  orderGrandTotal: number;
  orderGrandTotalWithDiscount: number;
  orderTotalProfit: number;
  previousCredit: number;
  totalDue: number;
  TotalPaid: number;
  Totalcredit: number;
}

export interface UpdateOrderRequest {
  idClient?: number;
  orderType?: number;
  orderStatus?: number;
  orderDeliveryName?: string;
  orderDeliveryPhone?: string;
  orderDeliveryWilaya?: string;
  orderDeliveryCommune?: string;
  orderDeliveryLocation?: string;
  orderTotalPrice?: number;
  orderDeliveryFee?: number;
  orderGrandTotal?: number;
  orderGrandTotalWithDiscount?: number;
  orderTotalProfit?: number;
  previousCredit?: number;
  totalDue?: number;
  TotalPaid?: number;
  Totalcredit?: number;
}

export interface CreateOrderLineRequest {
  idOrder: number;
  idProduct: number;
  orderQuantity: number;
  unitPrice: number;
}

export interface UpdateOrderLineRequest {
  idOrder?: number;
  idProduct?: number;
  orderQuantity?: number;
  unitPrice?: number;
}

// ==================== Supplier API Request Types ====================

export interface CreateSupplierRequest {
  supplierName: string;
  supplierPersonName?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierLocation?: string;
  supplierTotalCredit: number;
  supplierTotalPaid: number;
  supplierTotalSold: number;
}

export interface UpdateSupplierRequest {
  supplierName?: string;
  supplierPersonName?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierLocation?: string;
  supplierTotalCredit?: number;
  supplierTotalPaid?: number;
  supplierTotalSold?: number;
}

export interface CreateSupplierInvoiceRequest {
  idSupplier: number;
  previousCredit: number;
  totalPrice: number;
  totalPriceWithDiscount: number;
  grandTotal: number;
  totalPaid: number;
  totalCredit: number;
  description?: string;
}

export interface UpdateSupplierInvoiceRequest {
  idSupplier?: number;
  previousCredit?: number;
  totalPrice?: number;
  totalPriceWithDiscount?: number;
  grandTotal?: number;
  totalPaid?: number;
  totalCredit?: number;
  description?: string;
}

export interface CreateSupplierInvoiceItemRequest {
  idInvoice?: number;
  idProduct?: number;
  productName?: string;
  itemQuantity: number;
  unitPrice: number;
}

export interface UpdateSupplierInvoiceItemRequest {
  idInvoice?: number;
  idProduct?: number;
  productName?: string;
  itemQuantity?: number;
  unitPrice?: number;
}

// ==================== User API Request Types ====================

export interface CreateUserRequest {
  userName: string;
  userPassword: string;
  userRole: number;
  userStatue: number;
}

export interface UpdateUserRequest {
  userName?: string;
  userPassword?: string;
  userRole?: number;
  userStatue?: number;
}

export interface CreateUserLogRequest {
  idUser: number;
  useractionType: number;
  actionDetails: string;
}

// ==================== Product API Request Types ====================

export interface CreateProductRequest {
  productName: string;
  productDescription?: string;
  productCodeBar: string;
  idModel: number;
}

export interface UpdateProductRequest {
  productName?: string;
  productDescription?: string;
  productCodeBar?: string;
  idModel?: number;
}

export interface CreatePriceCategoryRequest {
  idProduct: number;
  idCategory: number;
  price: number;
}

export interface UpdatePriceCategoryRequest {
  price: number;
}

export interface CreateHistoryPriceRequest {
  idCategory: number;
  price: number;
}

export interface CreateModelRequest {
  idBrand: number;
  modelName: string;
}

export interface UpdateModelRequest {
  idBrand?: number;
  modelName?: string;
}

export interface CreateModelFamilyRequest {
  idModel: number;
  idFamily: number;
}

// ==================== Search API Request Types ====================

export interface SearchRequest {
  query: string;
  limit?: number;
}

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

// ==================== Utility Types ====================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  [key: string]: any;
}
