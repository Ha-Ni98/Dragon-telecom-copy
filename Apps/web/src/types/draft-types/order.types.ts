export interface Order {
  idOrder: number;
  idClient: number;
  orderType: number; // OrderTypeCode
  orderStatus: number; // OrderStatusCode
  orderTotalPrice: number;
  orderDeliveryFee: number;
  orderGrandTotal: number;
  totalDue: number;
  pricePaid: number;
  credit: number;
  orderDeliveryName?: string;
  orderDeliveryPhone?: string;
  orderDeliveryWilaya?: string;
  orderDeliveryCommune?: string;
  orderCreatedDate: string; // ISO
}

export interface OrderLine {
  idLine: number;
  idOrder: number;
  idProductSupplier: number;
  orderQuantity: number;
  unitPrice: number;
}

/**
 * Order line with complete product information
 */
export interface OrderLineWithProduct extends OrderLine {
  product: {
    idProduct: number;
    productName: string;
    productCodeBar: string;
    brand: {
      idBrand: number;
      brandName: string;
    };
    model: {
      idModel: number;
      modelName: string;
    };
    family: {
      idFamily: number;
      familyName: string;
    };
    image?: string;
  };
}

/**
 * Enhanced order interface with detailed information
 */
export interface OrderWithDetails extends Order {
  /** Generated order code for display */
  orderCode: string;
  /** Order lines with complete product information */
  orderLines: OrderLineWithProduct[];
  /** Human-readable status label */
  statusLabel: string;
  /** Human-readable type label */
  typeLabel: string;
  /** Formatted creation date */
  formattedDate: string;
  /** Days since order creation */
  daysSinceCreation: number;
  /** Whether order can be cancelled */
  canBeCancelled: boolean;
  /** Client information */
  client?: {
    idClient: number;
    clientFirstName: string;
    clientLastName?: string;
    clientPhoneNumber: string;
    clientEmail?: string;
  };
}
