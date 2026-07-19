/**
 * Admin Suppliers Page Header Component
 * Provides page header with title, description, and Add Supplier button
 */

import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Truck } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Props for AdminSuppliersPageHeader component
 */
interface AdminSuppliersPageHeaderProps {
  /** Callback when Add Supplier button is clicked */
  onAddSupplier: () => void;
  /** Whether the Add Supplier button should be disabled */
  disabled?: boolean;
  /** Custom className for styling */
  className?: string;
}

/**
 * Main AdminSuppliersPageHeader component
 */
export const AdminSuppliersPageHeader = memo(function AdminSuppliersPageHeader({
  onAddSupplier,
  disabled = false,
  className = '',
}: AdminSuppliersPageHeaderProps) {
  const { t } = useTranslation();

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Truck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">
                {t('admin.suppliers.title')}
              </CardTitle>
              <CardDescription className="text-base">
                {t('admin.suppliers.description')}
              </CardDescription>
            </div>
          </div>
          <Button
            onClick={onAddSupplier}
            disabled={disabled}
            className="flex items-center gap-2"
            size="lg"
          >
            <Plus className="h-4 w-4" />
            {t('admin.suppliers.addSupplier')}
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
});

export default AdminSuppliersPageHeader;
