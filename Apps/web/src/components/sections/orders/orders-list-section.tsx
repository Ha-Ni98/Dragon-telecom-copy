import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Filter, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/hooks/useTranslation';
import { useOrders } from '@/hooks/use-orders';
import { OrderCard } from '@/components/shared/OrderCard';
import { OrderStatusCode } from '@/types/draft-types/enums.types';

interface OrdersListSectionProps {
  className?: string;
  onOrderCancelled?: (orderId: number) => void;
}

export const OrdersListSection: React.FC<OrdersListSectionProps> = ({
  className = '',
  onOrderCancelled
}) => {
  const { t } = useTranslation();
  const { 
    orders, 
    loading, 
    error, 
    selectedStatus, 
    filterOrdersByStatus,
    getOrdersStatistics 
  } = useOrders();
  const navigate = useNavigate();

  const statistics = getOrdersStatistics();

  // Handle status filter change
  const handleStatusFilterChange = (status: string) => {
    if (status === 'all') {
      filterOrdersByStatus('all' as OrderStatusCode | 'all');
    } else {
      filterOrdersByStatus(Number(status) as OrderStatusCode);
    }
  };

  // Handle order cancellation
  const handleOrderCancelled = (orderId: number) => {
    onOrderCancelled?.(orderId);
  };

  // Get status filter options
  const getStatusFilterOptions = () => {
    return [
      { value: 'all', label: t('orders.allOrders') },
      { value: OrderStatusCode.pending.toString(), label: t('orders.pending') },
      { value: OrderStatusCode.confirmed.toString(), label: t('orders.confirmed') },
      { value: OrderStatusCode.delivery.toString(), label: t('orders.delivery') },
      { value: OrderStatusCode.completed.toString(), label: t('orders.completed') },
      { value: OrderStatusCode.canceled.toString(), label: t('orders.cancelled') }
    ];
  };

  // Loading state
  if (loading) {
    return (
      <Card className={`orders-list-section ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('orders.title')}
          </CardTitle>
          <CardDescription>
            {t('orders.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-32 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={`orders-list-section ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('orders.title')}
          </CardTitle>
          <CardDescription>
            {t('orders.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
              <Package className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-red-600 mb-2">{t('orders.errorLoading')}</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              {t('common.actions.tryAgain')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (orders.length === 0) {
    return (
      <Card className={`orders-list-section ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('orders.title')}
          </CardTitle>
          <CardDescription>
            {t('orders.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-primary/5 to-accent/5 rounded-full flex items-center justify-center">
              <Package className="h-12 w-12 text-primary/60" />
            </div>
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
              {t('orders.noOrders')}
            </h3>
            <p className="text-muted-foreground mb-6">
              {t('orders.noOrdersDescription')}
            </p>
            <Button onClick={() => navigate('/products')}>
              <ShoppingBag className="h-4 w-4 mr-2" />
              {t('orders.startShopping')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`orders-list-section ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t('orders.title')}
            </CardTitle>
            <CardDescription>
              {t('orders.description')}
            </CardDescription>
          </div>
          
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedStatus === 'all' ? 'all' : selectedStatus.toString()}
              onValueChange={handleStatusFilterChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('orders.filterByStatus')} />
              </SelectTrigger>
              <SelectContent>
                {getStatusFilterOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-primary">{statistics.totalOrders}</div>
            <div className="text-sm text-muted-foreground">{t('orders.totalOrders')}</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{statistics.pendingOrders}</div>
            <div className="text-sm text-muted-foreground">{t('orders.pending')}</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{statistics.confirmedOrders}</div>
            <div className="text-sm text-muted-foreground">{t('orders.confirmed')}</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{statistics.completedOrders}</div>
            <div className="text-sm text-muted-foreground">{t('orders.completed')}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderCard
              key={order.idOrder}
              order={order}
              onOrderCancelled={handleOrderCancelled}
            />
          ))}
        </div>

        {/* Load More Button (for future pagination) */}
        {orders.length > 0 && (
          <div className="text-center mt-6">
            <Button variant="outline" disabled>
              Load More Orders
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
