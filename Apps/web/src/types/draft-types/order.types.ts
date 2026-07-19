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

/**
 * Admin-specific order interface with enhanced client information
 */
export interface AdminOrderWithDetails extends Order {
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
  /** Whether order can be edited */
  canBeEdited: boolean;
  /** Enhanced client information for admin view */
  client: {
    idClient: number;
    clientFirstName: string;
    clientLastName: string;
    clientPhoneNumber: string;
    clientTotalOrders: number;
    clientCompletionRate: number;
    clientWilaya: string;
    clientCommune: string;
  };
  /** Delivery details (if applicable) */
  deliveryDetails?: {
    fullName: string;
    phoneNumber: string;
    wilaya: string;
    commune: string;
  };
}

/**
 * Admin orders statistics interface
 */
export interface AdminOrdersStats {
  /** Total orders this month */
  totalOrdersThisMonth: number;
  /** Number of pending orders */
  pendingOrders: number;
  /** Number of confirmed orders */
  confirmedOrders: number;
  /** Number of orders in delivery */
  deliveryOrders: number;
}

/**
 * Admin order show dialog props
 */
export interface AdminOrderShowDialogProps {
  order: AdminOrderWithDetails;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Admin order edit dialog props
 */
export interface AdminOrderEditDialogProps {
  order: AdminOrderWithDetails;
  isOpen: boolean;
  onClose: () => void;
  onSave: (orderData: Partial<Order>) => Promise<void>;
  isSaving: boolean;
}


