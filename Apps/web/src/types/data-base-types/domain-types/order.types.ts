// Types for Order domain

import { OrderType, OrderStatue } from '../constants';

export interface Order {
  idOrder: number;
  idClient: number;
  orderType?: number | null;  // index in ordertypes
  orderStatus: number; // index in orderStatues
  orderDeliveryName?: string | null;
  orderDeliveryPhone?: string | null;
  orderDeliveryWilaya?: string | null;
  orderDeliveryCommune?: string | null;
  orderDeliveryLocation?: string | null;
  orderCreatedDate: string | Date;
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

export interface OrderLine {
  idLine: number;
  idOrder: number;
  idProduct: number;
  orderQuantity: number;
  unitPrice: number;
}
