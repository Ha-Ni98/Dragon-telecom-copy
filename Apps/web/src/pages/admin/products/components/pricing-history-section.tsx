import React from 'react';
import { History, Clock, User, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
   * Get category name by ID
   */
  const getCategoryName = (categoryId: number) => {
    return `Category ${categoryId}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" id="pricing-history-heading">
          <History className="h-5 w-5" aria-hidden="true" />
          Pricing History
        </CardTitle>
        <CardDescription>
          Complete history of pricing changes for this product
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4" role="region" aria-labelledby="pricing-history-heading">
          {showDetailed ? (
            /* Detailed table view */
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Changes</TableHead>
                    <TableHead>Impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricingHistory.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-sm">
                        {formatDate(entry.date)}
                      </TableCell>
                      <TableCell className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {entry.user}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(entry.action)}>
                          {entry.action.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell>
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
                                -{entry.changes.discountPercentage}% discount
                              </div>
                            )}
                          </div>
                        )}
                        {!entry.changes.categoryId && entry.changes.oldPrice && entry.changes.newPrice && (
                          <div className="text-sm">
                            No User Price: {entry.changes.oldPrice} → {entry.changes.newPrice} DZ
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getImpactIcon(entry.impact)}
                          <span className="capitalize text-sm">{entry.impact}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
                    {entry.action.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
              
              {pricingHistory.length > 5 && (
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground">
                    Showing 5 of {pricingHistory.length} entries
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
