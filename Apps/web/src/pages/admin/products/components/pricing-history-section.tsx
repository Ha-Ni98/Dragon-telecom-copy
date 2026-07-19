import type { ColumnDef } from '@tanstack/react-table';
import { History, Clock, User, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/DataTable';
import { useTranslation } from '@/hooks/useTranslation';

interface PricingHistoryEntry {
  id: number;
  date: string;
  user: string;
  action: 'price_update' | 'bulk_discount' | 'category_add' | 'category_remove';
  description: string;
  changes: {
    categoryId?: number;
    oldPrice?: number;
    newPrice?: number;
    discountPercentage?: number;
  };
  impact: 'increase' | 'decrease' | 'neutral';
}

interface PricingHistorySectionProps {
  /** Product ID for history lookup */
  productId: number;
  /** Whether to show detailed history */
  showDetailed?: boolean;
}

/**
 * Pricing history section component
 * Displays comprehensive pricing change history
 */
export function PricingHistorySection({
  productId,
  showDetailed = false,
}: PricingHistorySectionProps) {
  const { t } = useTranslation();

  // Mock pricing history data - in a real app, this would come from an API
  const pricingHistory: PricingHistoryEntry[] = [
    {
      id: 1,
      date: '2024-01-15T10:30:00Z',
      user: 'Admin User',
      action: 'price_update',
      description: 'Updated Category 1 price',
      changes: {
        categoryId: 1,
        oldPrice: 100,
        newPrice: 120,
      },
      impact: 'increase',
    },
    {
      id: 2,
      date: '2024-01-10T14:15:00Z',
      user: 'Admin User',
      action: 'bulk_discount',
      description: 'Applied 10% bulk discount to all categories',
      changes: {
        discountPercentage: 10,
      },
      impact: 'decrease',
    },
    {
      id: 3,
      date: '2024-01-05T09:45:00Z',
      user: 'Admin User',
      action: 'price_update',
      description: 'Updated no-user price',
      changes: {
        oldPrice: 150,
        newPrice: 160,
      },
      impact: 'increase',
    },
    {
      id: 4,
      date: '2024-01-01T16:20:00Z',
      user: 'Admin User',
      action: 'category_add',
      description: 'Added new category pricing',
      changes: {
        categoryId: 3,
        newPrice: 90,
      },
      impact: 'neutral',
    },
  ];

  /**
   * Format date for display
   */
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * Get action badge variant
   */
  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'price_update':
        return 'default';
      case 'bulk_discount':
        return 'secondary';
      case 'category_add':
        return 'outline';
      case 'category_remove':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  /**
   * Get action label
   */
  const getActionLabel = (action: PricingHistoryEntry['action']) => {
    switch (action) {
      case 'price_update':
        return t('admin.products.pricingHistory.actions.priceUpdate');
      case 'bulk_discount':
        return t('admin.products.pricingHistory.actions.bulkDiscount');
      case 'category_add':
        return t('admin.products.pricingHistory.actions.categoryAdd');
      case 'category_remove':
        return t('admin.products.pricingHistory.actions.categoryRemove');
      default:
        return action;
    }
  };

  /**
   * Get impact icon
   */
  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'increase':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'decrease':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />;
    }
  };

  /**
   * Get impact label
   */
  const getImpactLabel = (impact: PricingHistoryEntry['impact']) => {
    switch (impact) {
      case 'increase':
        return t('admin.products.pricingHistory.impact.increase');
      case 'decrease':
        return t('admin.products.pricingHistory.impact.decrease');
      default:
        return t('admin.products.pricingHistory.impact.neutral');
    }
  };

  /**
   * Get category name by ID
   */
  const getCategoryName = (categoryId: number) => t('admin.products.pricingHistory.categoryLabel', { id: categoryId });

  const columns: ColumnDef<PricingHistoryEntry>[] = [
    {
      accessorKey: 'date',
      header: t('admin.products.pricingHistory.dateTime'),
      cell: ({ row }) => <span className="font-mono text-sm">{formatDate(row.original.date)}</span>,
    },
    {
      accessorKey: 'user',
      header: t('admin.products.pricingHistory.user'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          {row.original.user}
        </div>
      ),
    },
    {
      accessorKey: 'action',
      header: t('admin.products.pricingHistory.action'),
      cell: ({ row }) => (
        <Badge variant={getActionBadgeVariant(row.original.action)}>
          {getActionLabel(row.original.action)}
        </Badge>
      ),
    },
    {
      accessorKey: 'description',
      header: t('admin.products.pricingHistory.description'),
      cell: ({ row }) => row.original.description,
    },
    {
      id: 'changes',
      header: t('admin.products.pricingHistory.changes'),
      cell: ({ row }) => {
        const entry = row.original;
        return (
          <>
            {entry.changes.categoryId && (
              <div className="text-sm">
                <span className="font-medium">{getCategoryName(entry.changes.categoryId)}</span>
                {entry.changes.oldPrice && entry.changes.newPrice && (
                  <div className="text-muted-foreground">
                    {entry.changes.oldPrice} → {entry.changes.newPrice} DZ
                  </div>
                )}
                {entry.changes.discountPercentage && (
                  <div className="text-muted-foreground">
                    {t('admin.products.pricingHistory.discountApplied', { percent: entry.changes.discountPercentage })}
                  </div>
                )}
              </div>
            )}
            {!entry.changes.categoryId && entry.changes.oldPrice && entry.changes.newPrice && (
              <div className="text-sm">
                {t('admin.products.pricingHistory.noUserPrice', { oldPrice: entry.changes.oldPrice, newPrice: entry.changes.newPrice })}
              </div>
            )}
          </>
        );
      },
    },
    {
      accessorKey: 'impact',
      header: t('admin.products.pricingHistory.impact'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {getImpactIcon(row.original.impact)}
          <span className="text-sm">{getImpactLabel(row.original.impact)}</span>
        </div>
      ),
    },
  ];

  const renderMobileRow = (entry: PricingHistoryEntry) => (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span className="text-sm font-medium">{entry.user}</span>
        </div>
        <Badge variant={getActionBadgeVariant(entry.action)}>{getActionLabel(entry.action)}</Badge>
      </div>
      <p className="text-sm">{entry.description}</p>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="font-mono">{formatDate(entry.date)}</span>
        <div className="flex items-center gap-2">
          {getImpactIcon(entry.impact)}
          <span>{getImpactLabel(entry.impact)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" id="pricing-history-heading">
          <History className="h-5 w-5" aria-hidden="true" />
          {t('admin.products.pricingHistory.title')}
        </CardTitle>
        <CardDescription>
          {t('admin.products.pricingHistory.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4" role="region" aria-labelledby="pricing-history-heading">
          {showDetailed ? (
            /* Detailed table view */
            <DataTable
              columns={columns}
              data={pricingHistory}
              getRowKey={(entry) => String(entry.id)}
              renderMobileRow={renderMobileRow}
            />
          ) : (
            /* Compact list view */
            <div className="space-y-3">
              {pricingHistory.slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {getImpactIcon(entry.impact)}
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(entry.date)} • {entry.user}
                      </p>
                    </div>
                  </div>
                  <Badge variant={getActionBadgeVariant(entry.action)}>
                    {getActionLabel(entry.action)}
                  </Badge>
                </div>
              ))}

              {pricingHistory.length > 5 && (
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground">
                    {t('admin.products.pricingHistory.showingCount', { shown: 5, total: pricingHistory.length })}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
