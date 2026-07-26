/**
 * Admin Product Actions Component
 * Action buttons for each product row (Edit, Add to Stock, Delete)
 */

import React, { useState, memo } from 'react';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTranslation } from '@/hooks/useTranslation';

interface AdminProductActionsProps {
  /** Product ID */
  productId: number;
  /** Product name for confirmation dialog */
  productName?: string;
  /** Callback when edit button is clicked */
  onEdit: (productId: number) => void;
  /** Callback when add to stock button is clicked */
  onAddStock: (productId: number) => void;
  /** Callback when delete button is clicked */
  onDelete: (productId: number) => void;
  /** Whether the actions are disabled */
  disabled?: boolean;
}

/**
 * Admin Product Actions Component
 * Provides Edit, Add to Stock, and Delete actions for each product
 */
export const AdminProductActions = memo(function AdminProductActions({
  productId,
  productName = 'this product',
  onEdit,
  onAddStock,
  onDelete,
  disabled = false,
}: AdminProductActionsProps) {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Handle edit action with keyboard support
   */
  const handleEdit = () => {
    onEdit(productId);
  };

  /**
   * Handle add to stock action with keyboard support
   */
  const handleAddStock = () => {
    onAddStock(productId);
  };

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  /**
   * Handle delete action with confirmation
   */
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(productId);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2" role="group" aria-label={`Actions for ${productName}`}>
      {/* Edit Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleEdit}
        onKeyDown={(e) => handleKeyDown(e, handleEdit)}
        disabled={disabled}
        className="h-8 w-8 p-0"
        aria-label={`Edit ${productName}`}
        title={`Edit ${productName}`}
        tabIndex={0}
      >
        <Edit className="h-4 w-4" />
      </Button>

      {/* Add to Stock Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleAddStock}
        onKeyDown={(e) => handleKeyDown(e, handleAddStock)}
        disabled={disabled}
        className="h-8 w-8 p-0"
        aria-label={`Add stock for ${productName}`}
        title={`Add stock for ${productName}`}
        tabIndex={0}
      >
        <Plus className="h-4 w-4" />
      </Button>

      {/* Delete Button with Confirmation Dialog */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            aria-label={`Delete ${productName}`}
            title={`Delete ${productName}`}
            tabIndex={0}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.products.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.products.deleteConfirm')}
              {productName && (
                <span className="block mt-2 font-medium">
                  Product: {productName}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              aria-label={`Confirm delete ${productName}`}
            >
              {isDeleting ? t('common.processing') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
