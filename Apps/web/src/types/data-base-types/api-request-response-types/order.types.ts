/**
 * Order API Request/Response Types
 * Types for order-related API operations
 */

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
