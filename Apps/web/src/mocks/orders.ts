import { Order, OrderLine, OrderWithDetails, OrderLineWithProduct, AdminOrderWithDetails, AdminOrdersStats } from "@/types/draft-types";
import { OrderStatusCode, OrderTypeCode } from "@/types/draft-types/enums.types";
import { 
  generateOrderCode, 
  getOrderStatusLabel, 
  getOrderTypeLabel, 
  formatOrderDate, 
  getDaysSinceOrderCreation, 
  canOrderBeCancelled 
} from "@/lib/order-utils";

/**
 * Mock order lines with complete product information
 */
export const mockOrderLinesWithProducts: OrderLineWithProduct[] = [
  {
    idLine: 1,
    idOrder: 1,
    idProductSupplier: 1,
    orderQuantity: 1,
    unitPrice: 1299,
    product: {
      idProduct: 1,
      productName: "Samsung Galaxy S24 Ultra",
      productCodeBar: "S24U-001",
      brand: { idBrand: 1, brandName: "Samsung" },
      model: { idModel: 1, modelName: "Galaxy S24 Ultra" },
      family: { idFamily: 1, familyName: "Smartphones" },
      image: "/api/placeholder/300/300"
    }
  },
  {
    idLine: 2,
    idOrder: 2,
    idProductSupplier: 2,
    orderQuantity: 1,
    unitPrice: 1199,
    product: {
      idProduct: 2,
      productName: "iPhone 15 Pro Max",
      productCodeBar: "IP15PM-001",
      brand: { idBrand: 2, brandName: "Apple" },
      model: { idModel: 2, modelName: "iPhone 15 Pro Max" },
      family: { idFamily: 1, familyName: "Smartphones" },
      image: "/api/placeholder/300/300"
    }
  },
  {
    idLine: 3,
    idOrder: 2,
    idProductSupplier: 3,
    orderQuantity: 2,
    unitPrice: 249,
    product: {
      idProduct: 3,
      productName: "AirPods Pro (2nd Gen)",
      productCodeBar: "APP2-001",
      brand: { idBrand: 2, brandName: "Apple" },
      model: { idModel: 3, modelName: "AirPods Pro" },
      family: { idFamily: 2, familyName: "Accessories" },
      image: "/api/placeholder/300/300"
    }
  },
  {
    idLine: 4,
    idOrder: 3,
    idProductSupplier: 4,
    orderQuantity: 1,
    unitPrice: 399,
    product: {
      idProduct: 4,
      productName: "Samsung Galaxy Watch 6 Classic",
      productCodeBar: "GW6C-001",
      brand: { idBrand: 1, brandName: "Samsung" },
      model: { idModel: 4, modelName: "Galaxy Watch 6 Classic" },
      family: { idFamily: 3, familyName: "Smartwatches" },
      image: "/api/placeholder/300/300"
    }
  },
  {
    idLine: 5,
    idOrder: 4,
    idProductSupplier: 5,
    orderQuantity: 1,
    unitPrice: 1199,
    product: {
      idProduct: 5,
      productName: "MacBook Air M2",
      productCodeBar: "MBA-M2-001",
      brand: { idBrand: 2, brandName: "Apple" },
      model: { idModel: 5, modelName: "MacBook Air M2" },
      family: { idFamily: 4, familyName: "Laptops" },
      image: "/api/placeholder/300/300"
    }
  }
];

/**
 * Mock orders with enhanced details
 */
export const mockOrdersWithDetails: OrderWithDetails[] = [
  {
    idOrder: 1,
    idClient: 1,
    orderType: OrderTypeCode['pick-up'],
    orderStatus: OrderStatusCode.pending,
    orderTotalPrice: 1299,
    orderDeliveryFee: 0,
    orderGrandTotal: 1299,
    totalDue: 1299,
    pricePaid: 0,
    credit: 0,
    orderCreatedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    orderCode: "ORD-20250125-0001",
    orderLines: [mockOrderLinesWithProducts[0]],
    statusLabel: getOrderStatusLabel(OrderStatusCode.pending, 'en'),
    typeLabel: getOrderTypeLabel(OrderTypeCode['pick-up'], 'en'),
    formattedDate: formatOrderDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), 'en'),
    daysSinceCreation: 2,
    canBeCancelled: canOrderBeCancelled(OrderStatusCode.pending),
    client: {
      idClient: 1,
      clientFirstName: "Ahmed",
      clientLastName: "Benali",
      clientPhoneNumber: "+213 555 123 456",
      clientEmail: "ahmed.benali@email.com"
    }
  },
  {
    idOrder: 2,
    idClient: 2,
    orderType: OrderTypeCode['delivry-home'],
    orderStatus: OrderStatusCode.confirmed,
    orderTotalPrice: 1697,
    orderDeliveryFee: 600,
    orderGrandTotal: 2297,
    totalDue: 2297,
    pricePaid: 0,
    credit: 0,
    orderDeliveryName: "Fatima Zohra",
    orderDeliveryPhone: "+213 555 789 012",
    orderDeliveryWilaya: "Algiers",
    orderDeliveryCommune: "Bab Ezzouar",
    orderCreatedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    orderCode: "ORD-20250122-0002",
    orderLines: [mockOrderLinesWithProducts[1], mockOrderLinesWithProducts[2]],
    statusLabel: getOrderStatusLabel(OrderStatusCode.confirmed, 'en'),
    typeLabel: getOrderTypeLabel(OrderTypeCode['delivry-home'], 'en'),
    formattedDate: formatOrderDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), 'en'),
    daysSinceCreation: 5,
    canBeCancelled: canOrderBeCancelled(OrderStatusCode.confirmed),
    client: {
      idClient: 2,
      clientFirstName: "Fatima",
      clientLastName: "Zohra",
      clientPhoneNumber: "+213 555 789 012",
      clientEmail: "fatima.zohra@email.com"
    }
  },
  {
    idOrder: 3,
    idClient: 3,
    orderType: OrderTypeCode['delivry-office'],
    orderStatus: OrderStatusCode.delivery,
    orderTotalPrice: 399,
    orderDeliveryFee: 800,
    orderGrandTotal: 1199,
    totalDue: 1199,
    pricePaid: 0,
    credit: 0,
    orderDeliveryName: "Mohamed Amine",
    orderDeliveryPhone: "+213 555 345 678",
    orderDeliveryWilaya: "Oran",
    orderDeliveryCommune: "Es Senia",
    orderCreatedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    orderCode: "ORD-20250120-0003",
    orderLines: [mockOrderLinesWithProducts[3]],
    statusLabel: getOrderStatusLabel(OrderStatusCode.delivery, 'en'),
    typeLabel: getOrderTypeLabel(OrderTypeCode['delivry-office'], 'en'),
    formattedDate: formatOrderDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), 'en'),
    daysSinceCreation: 7,
    canBeCancelled: canOrderBeCancelled(OrderStatusCode.delivery),
    client: {
      idClient: 3,
      clientFirstName: "Mohamed",
      clientLastName: "Amine",
      clientPhoneNumber: "+213 555 345 678",
      clientEmail: "mohamed.amine@email.com"
    }
  },
  {
    idOrder: 4,
    idClient: 4,
    orderType: OrderTypeCode['pick-up'],
    orderStatus: OrderStatusCode.completed,
    orderTotalPrice: 1199,
    orderDeliveryFee: 0,
    orderGrandTotal: 1199,
    totalDue: 0,
    pricePaid: 1199,
    credit: 0,
    orderCreatedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    orderCode: "ORD-20250117-0004",
    orderLines: [mockOrderLinesWithProducts[4]],
    statusLabel: getOrderStatusLabel(OrderStatusCode.completed, 'en'),
    typeLabel: getOrderTypeLabel(OrderTypeCode['pick-up'], 'en'),
    formattedDate: formatOrderDate(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), 'en'),
    daysSinceCreation: 10,
    canBeCancelled: canOrderBeCancelled(OrderStatusCode.completed),
    client: {
      idClient: 4,
      clientFirstName: "Yasmine",
      clientLastName: "Kadi",
      clientPhoneNumber: "+213 555 901 234",
      clientEmail: "yasmine.kadi@email.com"
    }
  },
  {
    idOrder: 5,
    idClient: 5,
    orderType: OrderTypeCode['delivry-home'],
    orderStatus: OrderStatusCode.canceled,
    orderTotalPrice: 899,
    orderDeliveryFee: 600,
    orderGrandTotal: 1499,
    totalDue: 0,
    pricePaid: 0,
    credit: 0,
    orderDeliveryName: "Karim",
    orderDeliveryPhone: "+213 555 567 890",
    orderDeliveryWilaya: "Constantine",
    orderDeliveryCommune: "Centre Ville",
    orderCreatedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    orderCode: "ORD-20250124-0005",
    orderLines: [],
    statusLabel: getOrderStatusLabel(OrderStatusCode.canceled, 'en'),
    typeLabel: getOrderTypeLabel(OrderTypeCode['delivry-home'], 'en'),
    formattedDate: formatOrderDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), 'en'),
    daysSinceCreation: 3,
    canBeCancelled: canOrderBeCancelled(OrderStatusCode.canceled),
    client: {
      idClient: 5,
      clientFirstName: "Karim",
      clientLastName: "Bouali",
      clientPhoneNumber: "+213 555 567 890",
      clientEmail: "karim.bouali@email.com"
    }
  }
];

/**
 * Legacy mock orders (for backward compatibility)
 */
export const mockOrders: Order[] = mockOrdersWithDetails.map(order => ({
  idOrder: order.idOrder,
  idClient: order.idClient,
  orderType: order.orderType,
  orderStatus: order.orderStatus,
  orderTotalPrice: order.orderTotalPrice,
  orderDeliveryFee: order.orderDeliveryFee,
  orderGrandTotal: order.orderGrandTotal,
  totalDue: order.totalDue,
  pricePaid: order.pricePaid,
  credit: order.credit,
  orderDeliveryName: order.orderDeliveryName,
  orderDeliveryPhone: order.orderDeliveryPhone,
  orderDeliveryWilaya: order.orderDeliveryWilaya,
  orderDeliveryCommune: order.orderDeliveryCommune,
  orderCreatedDate: order.orderCreatedDate
}));

/**
 * Legacy mock order lines (for backward compatibility)
 */
export const mockOrderLines: OrderLine[] = mockOrderLinesWithProducts.map(line => ({
  idLine: line.idLine,
  idOrder: line.idOrder,
  idProductSupplier: line.idProductSupplier,
  orderQuantity: line.orderQuantity,
  unitPrice: line.unitPrice
}));

/**
 * Utility functions for mock data
 */
export const getMockOrdersWithDetails = (): OrderWithDetails[] => {
  return mockOrdersWithDetails;
};

export const getMockOrderWithDetails = (orderId: number): OrderWithDetails | undefined => {
  return mockOrdersWithDetails.find(order => order.idOrder === orderId);
};

export const getMockOrdersByStatus = (status: OrderStatusCode): OrderWithDetails[] => {
  return mockOrdersWithDetails.filter(order => order.orderStatus === status);
};

export const getMockOrdersByClient = (clientId: number): OrderWithDetails[] => {
  return mockOrdersWithDetails.filter(order => order.idClient === clientId);
};

/**
 * Mock admin orders with enhanced client information
 */
export const mockAdminOrdersWithDetails: AdminOrderWithDetails[] = [
  {
    idOrder: 1,
    idClient: 1,
    orderType: OrderTypeCode['pick-up'],
    orderStatus: OrderStatusCode.pending,
    orderTotalPrice: 1299,
    orderDeliveryFee: 0,
    orderGrandTotal: 1299,
    totalDue: 1299,
    pricePaid: 0,
    credit: 0,
    orderCreatedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    orderCode: "ORD-20250125-0001",
    orderLines: [mockOrderLinesWithProducts[0]],
    statusLabel: getOrderStatusLabel(OrderStatusCode.pending, 'en'),
    typeLabel: getOrderTypeLabel(OrderTypeCode['pick-up'], 'en'),
    formattedDate: formatOrderDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), 'en'),
    daysSinceCreation: 2,
    canBeEdited: true,
    client: {
      idClient: 1,
      clientFirstName: "Ahmed",
      clientLastName: "Benali",
      clientPhoneNumber: "+213 555 123 456",
      clientTotalOrders: 5,
      clientCompletionRate: 80, // 4 out of 5 orders completed
      clientWilaya: "Algiers",
      clientCommune: "Bab Ezzouar"
    }
  },
  {
    idOrder: 2,
    idClient: 2,
    orderType: OrderTypeCode['delivry-home'],
    orderStatus: OrderStatusCode.confirmed,
    orderTotalPrice: 1697,
    orderDeliveryFee: 600,
    orderGrandTotal: 2297,
    totalDue: 2297,
    pricePaid: 0,
    credit: 0,
    orderDeliveryName: "Fatima Zohra",
    orderDeliveryPhone: "+213 555 789 012",
    orderDeliveryWilaya: "Algiers",
    orderDeliveryCommune: "Bab Ezzouar",
    orderCreatedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    orderCode: "ORD-20250122-0002",
    orderLines: [mockOrderLinesWithProducts[1], mockOrderLinesWithProducts[2]],
    statusLabel: getOrderStatusLabel(OrderStatusCode.confirmed, 'en'),
    typeLabel: getOrderTypeLabel(OrderTypeCode['delivry-home'], 'en'),
    formattedDate: formatOrderDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), 'en'),
    daysSinceCreation: 5,
    canBeEdited: true,
    client: {
      idClient: 2,
      clientFirstName: "Fatima",
      clientLastName: "Zohra",
      clientPhoneNumber: "+213 555 789 012",
      clientTotalOrders: 3,
      clientCompletionRate: 67, // 2 out of 3 orders completed
      clientWilaya: "Algiers",
      clientCommune: "Bab Ezzouar"
    },
    deliveryDetails: {
      fullName: "Fatima Zohra",
      phoneNumber: "+213 555 789 012",
      wilaya: "Algiers",
      commune: "Bab Ezzouar"
    }
  },
  {
    idOrder: 3,
    idClient: 3,
    orderType: OrderTypeCode['delivry-office'],
    orderStatus: OrderStatusCode.delivery,
    orderTotalPrice: 399,
    orderDeliveryFee: 800,
    orderGrandTotal: 1199,
    totalDue: 1199,
    pricePaid: 0,
    credit: 0,
    orderDeliveryName: "Mohamed Amine",
    orderDeliveryPhone: "+213 555 345 678",
    orderDeliveryWilaya: "Oran",
    orderDeliveryCommune: "Es Senia",
    orderCreatedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    orderCode: "ORD-20250120-0003",
    orderLines: [mockOrderLinesWithProducts[3]],
    statusLabel: getOrderStatusLabel(OrderStatusCode.delivery, 'en'),
    typeLabel: getOrderTypeLabel(OrderTypeCode['delivry-office'], 'en'),
    formattedDate: formatOrderDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), 'en'),
    daysSinceCreation: 7,
    canBeEdited: true,
    client: {
      idClient: 3,
      clientFirstName: "Mohamed",
      clientLastName: "Amine",
      clientPhoneNumber: "+213 555 345 678",
      clientTotalOrders: 8,
      clientCompletionRate: 88, // 7 out of 8 orders completed
      clientWilaya: "Oran",
      clientCommune: "Es Senia"
    },
    deliveryDetails: {
      fullName: "Mohamed Amine",
      phoneNumber: "+213 555 345 678",
      wilaya: "Oran",
      commune: "Es Senia"
    }
  },
  {
    idOrder: 4,
    idClient: 4,
    orderType: OrderTypeCode['pick-up'],
    orderStatus: OrderStatusCode.completed,
    orderTotalPrice: 1199,
    orderDeliveryFee: 0,
    orderGrandTotal: 1199,
    totalDue: 0,
    pricePaid: 1199,
    credit: 0,
    orderCreatedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    orderCode: "ORD-20250117-0004",
    orderLines: [mockOrderLinesWithProducts[4]],
    statusLabel: getOrderStatusLabel(OrderStatusCode.completed, 'en'),
    typeLabel: getOrderTypeLabel(OrderTypeCode['pick-up'], 'en'),
    formattedDate: formatOrderDate(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), 'en'),
    daysSinceCreation: 10,
    canBeEdited: false, // Completed orders cannot be edited
    client: {
      idClient: 4,
      clientFirstName: "Yasmine",
      clientLastName: "Kadi",
      clientPhoneNumber: "+213 555 901 234",
      clientTotalOrders: 12,
      clientCompletionRate: 92, // 11 out of 12 orders completed
      clientWilaya: "Constantine",
      clientCommune: "Centre Ville"
    }
  },
  {
    idOrder: 5,
    idClient: 5,
    orderType: OrderTypeCode['delivry-home'],
    orderStatus: OrderStatusCode.canceled,
    orderTotalPrice: 899,
    orderDeliveryFee: 600,
    orderGrandTotal: 1499,
    totalDue: 0,
    pricePaid: 0,
    credit: 0,
    orderDeliveryName: "Karim",
    orderDeliveryPhone: "+213 555 567 890",
    orderDeliveryWilaya: "Constantine",
    orderDeliveryCommune: "Centre Ville",
    orderCreatedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    orderCode: "ORD-20250124-0005",
    orderLines: [],
    statusLabel: getOrderStatusLabel(OrderStatusCode.canceled, 'en'),
    typeLabel: getOrderTypeLabel(OrderTypeCode['delivry-home'], 'en'),
    formattedDate: formatOrderDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), 'en'),
    daysSinceCreation: 3,
    canBeEdited: false, // Canceled orders cannot be edited
    client: {
      idClient: 5,
      clientFirstName: "Karim",
      clientLastName: "Bouali",
      clientPhoneNumber: "+213 555 567 890",
      clientTotalOrders: 2,
      clientCompletionRate: 50, // 1 out of 2 orders completed
      clientWilaya: "Constantine",
      clientCommune: "Centre Ville"
    }
  }
];

/**
 * Get admin orders with details (excludes wishlist orders)
 */
export const getMockAdminOrdersWithDetails = (): AdminOrderWithDetails[] => {
  return mockAdminOrdersWithDetails;
};

/**
 * Get admin order by ID
 */
export const getMockAdminOrderWithDetails = (orderId: number): AdminOrderWithDetails | undefined => {
  return mockAdminOrdersWithDetails.find(order => order.idOrder === orderId);
};

/**
 * Get admin orders by status
 */
export const getMockAdminOrdersByStatus = (status: OrderStatusCode): AdminOrderWithDetails[] => {
  return mockAdminOrdersWithDetails.filter(order => order.orderStatus === status);
};

/**
 * Get admin orders by client
 */
export const getMockAdminOrdersByClient = (clientId: number): AdminOrderWithDetails[] => {
  return mockAdminOrdersWithDetails.filter(order => order.idClient === clientId);
};

/**
 * Search admin orders by client name
 */
export const searchMockAdminOrdersByClientName = (searchTerm: string): AdminOrderWithDetails[] => {
  const term = searchTerm.toLowerCase();
  return mockAdminOrdersWithDetails.filter(order => 
    order.client.clientFirstName.toLowerCase().includes(term) ||
    order.client.clientLastName.toLowerCase().includes(term) ||
    `${order.client.clientFirstName} ${order.client.clientLastName}`.toLowerCase().includes(term)
  );
};

/**
 * Calculate admin orders statistics
 */
export const calculateAdminOrdersStats = (): AdminOrdersStats => {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const ordersThisMonth = mockAdminOrdersWithDetails.filter(order => {
    const orderDate = new Date(order.orderCreatedDate);
    return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
  });

  const pendingOrders = ordersThisMonth.filter(order => order.orderStatus === OrderStatusCode.pending).length;
  const confirmedOrders = ordersThisMonth.filter(order => order.orderStatus === OrderStatusCode.confirmed).length;
  const deliveryOrders = ordersThisMonth.filter(order => order.orderStatus === OrderStatusCode.delivery).length;

  return {
    totalOrdersThisMonth: ordersThisMonth.length,
    pendingOrders,
    confirmedOrders,
    deliveryOrders
  };
};

/**
 * Get paginated admin orders
 */
export const getMockAdminOrdersPaginated = (
  page: number = 1,
  limit: number = 14,
  searchTerm?: string,
  statusFilter?: OrderStatusCode
): { orders: AdminOrderWithDetails[]; total: number; totalPages: number } => {
  let filteredOrders = mockAdminOrdersWithDetails;

  // Apply search filter
  if (searchTerm && searchTerm.trim()) {
    filteredOrders = searchMockAdminOrdersByClientName(searchTerm);
  }

  // Apply status filter
  if (statusFilter !== undefined) {
    filteredOrders = filteredOrders.filter(order => order.orderStatus === statusFilter);
  }

  const total = filteredOrders.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  return {
    orders: filteredOrders.slice(startIndex, endIndex),
    total,
    totalPages
  };
};


