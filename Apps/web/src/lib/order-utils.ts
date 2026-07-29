import { OrderStatusCode, OrderTypeCode } from '@/types/draft-types/enums.types';

/**
 * Generate a unique order code
 * Format: ORD-YYYYMMDD-XXXX (e.g., ORD-20250127-0001)
 */
export function generateOrderCode(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateString = `${year}${month}${day}`;
  
  // Generate a random 4-digit number
  const randomNumber = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  
  return `ORD-${dateString}-${randomNumber}`;
}

/**
 * Get order status label based on status code
 */
export function getOrderStatusLabel(statusCode: number, lang: 'en' | 'fr' = 'en'): string {
  const statusLabels: Record<'en' | 'fr', Record<number, string>> = {
    en: {
      [OrderStatusCode.whishlist]: 'Wishlist',
      [OrderStatusCode.pending]: 'Pending',
      [OrderStatusCode.canceled]: 'Cancelled',
      [OrderStatusCode.confirmed]: 'Confirmed',
      [OrderStatusCode.delivery]: 'In Delivery',
      [OrderStatusCode.completed]: 'Completed'
    },
    fr: {
      [OrderStatusCode.whishlist]: 'Liste de souhaits',
      [OrderStatusCode.pending]: 'En attente',
      [OrderStatusCode.canceled]: 'Annulé',
      [OrderStatusCode.confirmed]: 'Confirmé',
      [OrderStatusCode.delivery]: 'En livraison',
      [OrderStatusCode.completed]: 'Terminé'
    }
  };
  
  return statusLabels[lang][statusCode] || 'Unknown';
}

/**
 * Get order type label based on type code
 */
export function getOrderTypeLabel(typeCode: number, lang: 'en' | 'fr' = 'en'): string {
  const typeLabels: Record<'en' | 'fr', Record<number, string>> = {
    en: {
      [OrderTypeCode['pick-up']]: 'Pickup',
      [OrderTypeCode['delivry-home']]: 'Home Delivery',
      [OrderTypeCode['delivry-office']]: 'Office Delivery'
    },
    fr: {
      [OrderTypeCode['pick-up']]: 'Retrait',
      [OrderTypeCode['delivry-home']]: 'Livraison domicile',
      [OrderTypeCode['delivry-office']]: 'Livraison bureau'
    }
  };
  
  return typeLabels[lang][typeCode] || 'Unknown';
}

/**
 * Get order status color for UI display
 */
export function getOrderStatusColor(statusCode: number): string {
  const statusColors: Record<number, string> = {
    [OrderStatusCode.whishlist]: 'bg-gray-100 text-gray-800',
    [OrderStatusCode.pending]: 'bg-yellow-100 text-yellow-800',
    [OrderStatusCode.canceled]: 'bg-red-100 text-red-800',
    [OrderStatusCode.confirmed]: 'bg-blue-100 text-blue-800',
    [OrderStatusCode.delivery]: 'bg-purple-100 text-purple-800',
    [OrderStatusCode.completed]: 'bg-green-100 text-green-800'
  };
  
  return statusColors[statusCode] || 'bg-gray-100 text-gray-800';
}

/**
 * Check if order can be cancelled
 */
export function canOrderBeCancelled(statusCode: number): boolean {
  return statusCode === OrderStatusCode.pending;
}

/**
 * Format order date for display
 */
export function formatOrderDate(dateString: string, lang: 'en' | 'fr' = 'en'): string {
  const date = new Date(dateString);
  
  if (lang === 'fr') {
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Calculate days since order creation
 */
export function getDaysSinceOrderCreation(dateString: string): number {
  const orderDate = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - orderDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Check if order is overdue (for pickup orders)
 */
export function isOrderOverdue(order: { orderType: number; orderCreatedDate: string }): boolean {
  if (order.orderType !== OrderTypeCode['pick-up']) {
    return false;
  }
  
  const daysSinceCreation = getDaysSinceOrderCreation(order.orderCreatedDate);
  return daysSinceCreation > 4; // Overdue if more than 4 days
}

/**
 * Get order summary text
 */
export function getOrderSummary(order: { orderLines: { orderQuantity: number; product: { productName: string } }[]; orderGrandTotal: number }): string {
  const itemCount = order.orderLines.reduce((total, line) => total + line.orderQuantity, 0);
  const productCount = order.orderLines.length;
  
  if (productCount === 1) {
    return `${itemCount} item - ${order.orderLines[0].product.productName}`;
  }
  
  return `${itemCount} items from ${productCount} products`;
}
