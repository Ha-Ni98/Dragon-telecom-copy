/**
 * Delivery Fees Section Component
 * Manages delivery fees with Excel import/export functionality
 */

import React, { useState, useMemo } from 'react';
import { Download, Upload, Truck, MapPin, RefreshCw, AlertTriangle, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
   * Group delivery fees by wilaya
   */
  const groupedDeliveryFees = useMemo(() => {
    if (!deliveryFees) return {};
    
    return deliveryFees.reduce((acc, fee) => {
      if (!acc[fee.wilaya]) {
        acc[fee.wilaya] = [];
      }
      acc[fee.wilaya].push(fee);
      return acc;
    }, {} as Record<string, DeliveryFee[]>);
  }, [deliveryFees]);

  /**
   * Calculate pagination
   */
  const paginationData = useMemo(() => {
    if (!deliveryFees) return { paginatedData: [], totalPages: 0, totalItems: 0 };
    
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
   * Handle page change
   */
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  /**
   * Reset to first page when data changes
   */
  React.useEffect(() => {
    setCurrentPage(1);
  }, [deliveryFees]);

  return (
    <div className={className}>
      {/* Section Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Delivery Fees
              </CardTitle>
              <CardDescription>
                Manage delivery fees for different locations
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
                Refresh
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
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export Excel
                  </>
                )}
              </Button>
              <Button
                onClick={() => setIsImportDialogOpen(true)}
                disabled={isLoading}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Excel
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
                Failed to load delivery fees. Please try again.
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={() => refetch()}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-20" />
              </div>
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          )}

          {/* Data Display */}
          {!isLoading && !error && deliveryFees && (
            <div className="space-y-6">
              {/* Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Total Entries</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Wilayas</p>
                    <p className="text-2xl font-bold">{stats.wilayas}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Communes</p>
                    <p className="text-2xl font-bold">{stats.communes}</p>
                  </div>
                </div>
              </div>

              {/* Delivery Fees Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Wilaya</TableHead>
                      <TableHead>Commune</TableHead>
                      <TableHead>Delivery Office</TableHead>
                      <TableHead>Delivery Home</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginationData.paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No delivery fees found. Import an Excel file to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginationData.paginatedData.map((fee, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              {fee.wilaya}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {fee.commune}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant={getDeliveryTypeBadgeVariant('office')}>
                                Office
                              </Badge>
                              <span className="font-medium">
                                {formatCurrency(fee.deliveryOffice)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant={getDeliveryTypeBadgeVariant('home')}>
                                Home
                              </Badge>
                              <span className="font-medium">
                                {formatCurrency(fee.deliveryHome)}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {paginationData.totalPages > 1 && (
                <div className="flex items-center justify-between px-2">
                  <div className="flex-1 text-sm text-muted-foreground">
                    Showing {paginationData.startIndex} to {paginationData.endIndex} of {paginationData.totalItems} entries
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, paginationData.totalPages) }, (_, i) => {
                        let pageNumber;
                        if (paginationData.totalPages <= 5) {
                          pageNumber = i + 1;
                        } else if (currentPage <= 3) {
                          pageNumber = i + 1;
                        } else if (currentPage >= paginationData.totalPages - 2) {
                          pageNumber = paginationData.totalPages - 4 + i;
                        } else {
                          pageNumber = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNumber}
                            variant={currentPage === pageNumber ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNumber)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNumber}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === paginationData.totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
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
              Import Delivery Fees from Excel
            </DialogTitle>
            <DialogDescription>
              Upload an Excel file to import delivery fees. The file should contain columns for Wilaya, Commune, Delivery Office, and Delivery Home.
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
                {importResult ? 'Close' : 'Cancel'}
              </Button>
              {importResult && importResult.success && (
                <Button onClick={handleImportDialogClose}>
                  Continue
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
