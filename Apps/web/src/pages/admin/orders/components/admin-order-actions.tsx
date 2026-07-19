/**
 * Admin Order Actions Component
 * Action buttons for order table rows
 */

import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Edit } from 'lucide-react';
import { AdminOrderWithDetails } from '@/types/draft-types/order.types';
import { useTranslation } from '@/hooks/useTranslation';

interface AdminOrderActionsProps {
  /** Order data */
  order: AdminOrderWithDetails;
  /** Show order handler */
  onShow: (order: AdminOrderWithDetails) => void;
  /** Edit order handler */
  onEdit: (order: AdminOrderWithDetails) => void;
  /** Custom className for styling */
  className?: string;
}

/**
 * Main AdminOrderActions component
 */
export const AdminOrderActions = memo(function AdminOrderActions({
  order,
  onShow,
  onEdit,
  className = ''
}: AdminOrderActionsProps) {
  const { t } = useTranslation();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Show Button - Always available */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onShow(order)}
        className="flex items-center gap-1 hover:bg-blue-50 hover:text-blue-700"
        aria-label={`Show details for order ${order.orderCode}`}
        title={`Show details for order ${order.orderCode}`}
      >
        <Eye className="h-4 w-4" />
        <span className="hidden sm:inline">{t('admin.orders.table.show')}</span>
      </Button>
      
      {/* Edit Button - Only if order can be edited */}
      {order.canBeEdited && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(order)}
          className="flex items-center gap-1 hover:bg-green-50 hover:text-green-700"
          aria-label={`Edit order ${order.orderCode}`}
          title={`Edit order ${order.orderCode}`}
        >
          <Edit className="h-4 w-4" />
          <span className="hidden sm:inline">{t('admin.orders.table.edit')}</span>
        </Button>
      )}
    </div>
  );
});
