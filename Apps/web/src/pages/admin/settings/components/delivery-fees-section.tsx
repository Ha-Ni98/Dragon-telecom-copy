/**
 * Delivery Fees Section Component
 * Manages delivery fees with Excel import/export functionality
 */

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, Upload, Truck, MapPin, RefreshCw, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataTable } from '@/components/shared/DataTable';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { SimplePagination } from '@/components/shared/SimplePagination';
import { useTranslation } from '@/hooks/useTranslation';
import { DeliveryFee, ExcelImportResult } from '@/types/draft-types';
import { ExcelFileUploader } from '@/components/shared/excel-file-uploader';
import {
  useDeliveryFees,
  useImportDeliveryFees,
  useExportDeliveryFees,
} from '@/hooks/use-admin-settings';

/**
 * Props for DeliveryFeesSection component
 */
interface DeliveryFeesSectionProps {
  /** Custom className for styling */
  className?: string;
}

/**
 * Delivery Fees Section Component
 * Displays delivery fees with Excel import/export functionality
 */
export function DeliveryFeesSection({ className }: DeliveryFeesSectionProps) {
  const { t } = useTranslation();

  // State management
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<ExcelImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Data fetching hooks
  const { data: deliveryFees, isLoading, error, refetch } = useDeliveryFees();
  const importMutation = useImportDeliveryFees();
  const exportMutation = useExportDeliveryFees();

  /**
   * Handle Excel file processing
   */
  const handleFileProcessed = (result: ExcelImportResult) => {
    setImportResult(result);
    setIsProcessing(false);

    if (result.success) {
      // Refresh data after successful import
      refetch();
    }
  };

  /**
   * Handle import dialog close
   */
  const handleImportDialogClose = () => {
    setIsImportDialogOpen(false);
    setImportResult(null);
    setIsProcessing(false);
  };

  /**
   * Handle export delivery fees
   */
  const handleExport = () => {
    exportMutation.mutate();
  };

  /**
   * Format currency for display
   */
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  /**
   * Get delivery type badge variant
   */
  const getDeliveryTypeBadgeVariant = (type: 'office' | 'home') => {
    return type === 'office' ? 'default' as const : 'secondary' as const;
  };

  /**
   * Calculate pagination
   */
  const paginationData = useMemo(() => {
    if (!deliveryFees) return { paginatedData: [], totalPages: 0, totalItems: 0, startIndex: 0, endIndex: 0 };

    const totalItems = deliveryFees.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = deliveryFees.slice(startIndex, endIndex);

    return {
      paginatedData,
      totalPages,
      totalItems,
      startIndex: startIndex + 1,
      endIndex: Math.min(endIndex, totalItems)
    };
  }, [deliveryFees, currentPage, itemsPerPage]);

  /**
   * Calculate statistics
   */
  const stats = useMemo(() => {
    if (!deliveryFees) return { total: 0, wilayas: 0, communes: 0 };

    const wilayas = new Set(deliveryFees.map(fee => fee.wilaya));
    const communes = new Set(deliveryFees.map(fee => fee.commune));

    return {
      total: deliveryFees.length,
      wilayas: wilayas.size,
      communes: communes.size,
    };
  }, [deliveryFees]);

  /**
   * Reset to first page when data changes
   */
  React.useEffect(() => {
    setCurrentPage(1);
  }, [deliveryFees]);

  const columns: ColumnDef<DeliveryFee>[] = [
    {
      accessorKey: 'wilaya',
      header: t('admin.settings.delivery.wilaya'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 font-medium">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          {row.original.wilaya}
        </div>
      ),
    },
    {
      accessorKey: 'commune',
      header: t('admin.settings.delivery.commune'),
      cell: ({ row }) => <Badge variant="outline">{row.original.commune}</Badge>,
    },
    {
      accessorKey: 'deliveryOffice',
      header: t('admin.settings.delivery.deliveryOffice'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Badge variant={getDeliveryTypeBadgeVariant('office')}>{t('admin.settings.delivery.office')}</Badge>
          <span className="font-medium">{formatCurrency(row.original.deliveryOffice)}</span>
        </div>
      ),
    },
    {
      accessorKey: 'deliveryHome',
      header: t('admin.settings.delivery.deliveryHome'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Badge variant={getDeliveryTypeBadgeVariant('home')}>{t('admin.settings.delivery.home')}</Badge>
          <span className="font-medium">{formatCurrency(row.original.deliveryHome)}</span>
        </div>
      ),
    },
  ];

  const renderMobileRow = (fee: DeliveryFee) => (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          {fee.wilaya}
        </div>
        <Badge variant="outline">{fee.commune}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2">
          <Badge variant={getDeliveryTypeBadgeVariant('office')}>{t('admin.settings.delivery.office')}</Badge>
          <span className="font-medium">{formatCurrency(fee.deliveryOffice)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getDeliveryTypeBadgeVariant('home')}>{t('admin.settings.delivery.home')}</Badge>
          <span className="font-medium">{formatCurrency(fee.deliveryHome)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className={className}>
      {/* Section Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                {t('admin.settings.delivery.title')}
              </CardTitle>
              <CardDescription>
                {t('admin.settings.delivery.description')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {t('common.actions.refresh')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={exportMutation.isPending || !deliveryFees?.length}
              >
                {exportMutation.isPending ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-foreground" />
                    {t('admin.settings.delivery.exporting')}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    {t('admin.settings.delivery.exportExcel')}
                  </>
                )}
              </Button>
              <Button
                onClick={() => setIsImportDialogOpen(true)}
                disabled={isLoading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {t('admin.settings.delivery.importExcel')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Error State */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('admin.settings.delivery.loadError')}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={() => refetch()}
                >
                  {t('common.retry')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && <TableSkeleton rows={5} columns={4} />}

          {/* Data Display */}
          {!isLoading && !error && deliveryFees && (
            <div className="space-y-6">
              {/* Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t('admin.settings.delivery.totalEntries')}</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t('admin.settings.delivery.wilayas')}</p>
                    <p className="text-2xl font-bold">{stats.wilayas}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t('admin.settings.delivery.communes')}</p>
                    <p className="text-2xl font-bold">{stats.communes}</p>
                  </div>
                </div>
              </div>

              {/* Delivery Fees Table */}
              <DataTable
                columns={columns}
                data={paginationData.paginatedData}
                getRowKey={(fee) => `${fee.wilaya}-${fee.commune}`}
                renderMobileRow={renderMobileRow}
                emptyState={
                  <EmptyState
                    icon={<Truck className="h-6 w-6" />}
                    title={t('admin.settings.delivery.noFeesFound')}
                    body={t('admin.settings.delivery.description')}
                  />
                }
              />

              {/* Pagination Controls */}
              {paginationData.totalPages > 1 && (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    {t('admin.settings.delivery.showingEntries', {
                      start: paginationData.startIndex,
                      end: paginationData.endIndex,
                      total: paginationData.totalItems,
                    })}
                  </div>
                  <SimplePagination
                    page={currentPage}
                    totalPages={paginationData.totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {t('admin.settings.delivery.importTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('admin.settings.delivery.importDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* File Uploader */}
            <ExcelFileUploader
              onFileProcessed={handleFileProcessed}
              disabled={isProcessing}
              isProcessing={isProcessing}
            />

            {/* Import Result */}
            {importResult && (
              <Alert variant={importResult.success ? "default" : "destructive"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {importResult.message}
                  {importResult.errors && importResult.errors.length > 0 && (
                    <ul className="mt-2 list-disc list-inside">
                      {importResult.errors.map((error, index) => (
                        <li key={index} className="text-sm">{error}</li>
                      ))}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Dialog Actions */}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={handleImportDialogClose}
                disabled={isProcessing}
              >
                {importResult ? t('admin.settings.delivery.close') : t('common.actions.cancel')}
              </Button>
              {importResult && importResult.success && (
                <Button onClick={handleImportDialogClose}>
                  {t('admin.settings.delivery.continue')}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
