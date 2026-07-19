/**
 * Recent Clients Table Component
 * Displays the last 5 registered clients in a read-only table
 */

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecentClient } from "@/types/draft-types/dashboard.types";
import { ClientStatusCode } from "@/types/draft-types/enums.types";
import { useTranslation } from "@/hooks/useTranslation";

interface RecentClientsTableProps {
  /** Recent clients data */
  clients?: RecentClient[];
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: string | null;
  /** Retry function for error handling */
  onRetry?: () => void;
  /** Refresh function */
  onRefresh?: () => void;
  /** Whether to show refresh button */
  showRefresh?: boolean;
  /** Maximum number of clients to display */
  limit?: number;
}

/**
 * Get client status badge variant and color
 */
function getClientStatusBadgeVariant(status: ClientStatusCode) {
  switch (status) {
    case ClientStatusCode.active:
      return "default" as const;
    case ClientStatusCode.pending:
      return "secondary" as const;
    case ClientStatusCode.disabled:
      return "outline" as const;
    case ClientStatusCode.refused:
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

/**
 * Get client status badge color class
 */
function getClientStatusBadgeColor(status: ClientStatusCode) {
  switch (status) {
    case ClientStatusCode.active:
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case ClientStatusCode.pending:
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case ClientStatusCode.disabled:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    case ClientStatusCode.refused:
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
}

/**
 * Format phone number for display
 */
function formatPhoneNumber(phone: string): string {
  // Remove any non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Format based on length
  if (digits.length === 12 && digits.startsWith('213')) {
    // Algerian format: +213 555 123 456
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  } else if (digits.length === 10 && digits.startsWith('0')) {
    // Local format: 0555 123 456
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  } else if (digits.length === 9) {
    // Local format without leading 0: 555 123 456
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  
  // Return original if format is not recognized
  return phone;
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString;
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    return dateString;
  }
}

/**
 * Loading skeleton for table rows
 */
function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-6 w-16" /></TableCell>
    </TableRow>
  );
}

/**
 * Error state component
 */
function ClientsErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>{error}</span>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="ml-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('common.retry')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Empty state component
 */
function ClientsEmptyState() {
  const { t } = useTranslation();
  
  return (
    <div className="text-center py-8">
      <div className="flex flex-col items-center space-y-4">
        <div className="p-4 rounded-full bg-muted">
          <User className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-muted-foreground">
          <p className="text-lg font-medium">No clients found</p>
          <p className="text-sm">No clients have been registered yet</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Recent Clients Table Component
 */
export function RecentClientsTable({
  clients,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = true,
  limit = 5,
}: RecentClientsTableProps) {
  const { t } = useTranslation();

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('admin.dashboard.recentClients')}</CardTitle>
              <CardDescription>{t('admin.dashboard.lastRegistered')}</CardDescription>
            </div>
            {showRefresh && onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>{t('common.refresh')}</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.dashboard.fullName')}</TableHead>
                  <TableHead>{t('admin.dashboard.phoneNumber')}</TableHead>
                  <TableHead>{t('admin.dashboard.wilaya')}</TableHead>
                  <TableHead>{t('admin.dashboard.commune')}</TableHead>
                  <TableHead>{t('admin.dashboard.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 3 }).map((_, index) => (
                  <TableRowSkeleton key={index} />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.dashboard.recentClients')}</CardTitle>
          <CardDescription>{t('admin.dashboard.lastRegistered')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientsErrorState error={error} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!clients || clients.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.dashboard.recentClients')}</CardTitle>
          <CardDescription>{t('admin.dashboard.lastRegistered')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientsEmptyState />
        </CardContent>
      </Card>
    );
  }

  // Limit clients to specified number
  const displayClients = clients.slice(0, limit);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('admin.dashboard.recentClients')}</CardTitle>
            <CardDescription>{t('admin.dashboard.lastRegistered')}</CardDescription>
          </div>
          {showRefresh && onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>{t('common.refresh')}</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">{t('admin.dashboard.fullName')}</TableHead>
                <TableHead className="min-w-[120px]">{t('admin.dashboard.phoneNumber')}</TableHead>
                <TableHead className="min-w-[100px]">{t('admin.dashboard.wilaya')}</TableHead>
                <TableHead className="min-w-[100px]">{t('admin.dashboard.commune')}</TableHead>
                <TableHead className="min-w-[100px]">{t('admin.dashboard.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayClients.map((client) => (
                <TableRow key={client.idClient} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <div className="p-1 rounded-full bg-muted">
                        <User className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <span className="font-medium text-sm">{client.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-mono">
                      {formatPhoneNumber(client.phoneNumber)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{client.wilaya}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{client.commune}</span>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={getClientStatusBadgeVariant(client.status)}
                      className={getClientStatusBadgeColor(client.status)}
                    >
                      {client.statusLabel}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
