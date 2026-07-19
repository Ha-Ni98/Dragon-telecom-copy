/**
 * Admin Accounts Section Component
 * Manages admin user accounts with full CRUD functionality
 */

import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Users, Shield, Calendar, Trash2, Edit, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataTable } from '@/components/shared/DataTable';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { useTranslation } from '@/hooks/useTranslation';
import { AdminAccountWithDetails, AdminAccountFormData } from '@/types/draft-types';
import { UserRoleCode } from '@/types/draft-types/enums.types';
import { AdminAccountDialog } from './admin-account-dialog';
import {
  useAdminAccounts,
  useCreateAdminAccount,
  useUpdateAdminAccount,
  useDeleteAdminAccount,
} from '@/hooks/use-admin-settings';

/**
 * Props for AdminAccountsSection component
 */
interface AdminAccountsSectionProps {
  /** Custom className for styling */
  className?: string;
}

/**
 * Admin Accounts Section Component
 * Displays admin accounts in a data table with CRUD operations
 */
export function AdminAccountsSection({ className }: AdminAccountsSectionProps) {
  const { t } = useTranslation();

  // State management
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminAccountWithDetails | null>(null);

  // Data fetching hooks
  const { data: adminAccounts, isLoading, error, refetch } = useAdminAccounts();
  const createAdminMutation = useCreateAdminAccount();
  const updateAdminMutation = useUpdateAdminAccount();
  const deleteAdminMutation = useDeleteAdminAccount();

  /**
   * Handle add admin account
   */
  const handleAddAdmin = (data: AdminAccountFormData) => {
    createAdminMutation.mutate(data, {
      onSuccess: () => {
        setIsAddDialogOpen(false);
      },
    });
  };

  /**
   * Handle edit admin account
   */
  const handleEditAdmin = (data: AdminAccountFormData) => {
    if (selectedAdmin) {
      updateAdminMutation.mutate(
        { id: selectedAdmin.idUser, data },
        {
          onSuccess: () => {
            setIsEditDialogOpen(false);
            setSelectedAdmin(null);
          },
        }
      );
    }
  };

  /**
   * Handle delete admin account
   */
  const handleDeleteAdmin = () => {
    if (selectedAdmin) {
      deleteAdminMutation.mutate(selectedAdmin.idUser, {
        onSuccess: () => {
          setIsDeleteDialogOpen(false);
          setSelectedAdmin(null);
        },
      });
    }
  };

  /**
   * Open edit dialog
   */
  const openEditDialog = (admin: AdminAccountWithDetails) => {
    setSelectedAdmin(admin);
    setIsEditDialogOpen(true);
  };

  /**
   * Open delete dialog
   */
  const openDeleteDialog = (admin: AdminAccountWithDetails) => {
    setSelectedAdmin(admin);
    setIsDeleteDialogOpen(true);
  };

  /**
   * Get role label
   */
  const getRoleLabel = (role: UserRoleCode) => {
    switch (role) {
      case UserRoleCode.admin:
        return t('admin.settings.accounts.administrator');
      default:
        return t('admin.settings.accounts.unknownRole');
    }
  };

  /**
   * Get role badge variant
   */
  const getRoleBadgeVariant = (role: UserRoleCode) => {
    switch (role) {
      case UserRoleCode.admin:
        return 'default' as const;
      default:
        return 'secondary' as const;
    }
  };

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
   * Check if any operation is in progress
   */
  const isAnyOperationInProgress =
    createAdminMutation.isPending ||
    updateAdminMutation.isPending ||
    deleteAdminMutation.isPending;

  const columns: ColumnDef<AdminAccountWithDetails>[] = [
    {
      accessorKey: 'userName',
      header: t('admin.settings.accounts.username'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 font-medium">
          <Shield className="h-4 w-4 text-muted-foreground" />
          {row.original.userName}
        </div>
      ),
    },
    {
      accessorKey: 'userRole',
      header: t('admin.settings.accounts.role'),
      cell: ({ row }) => (
        <Badge variant={getRoleBadgeVariant(row.original.userRole)}>
          {getRoleLabel(row.original.userRole)}
        </Badge>
      ),
    },
    {
      accessorKey: 'createdDate',
      header: t('common.labels.createdDate'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {formatDate(row.original.createdDate)}
        </div>
      ),
    },
    {
      accessorKey: 'canBeDeleted',
      header: t('common.labels.status'),
      cell: ({ row }) => (
        <Badge variant={row.original.canBeDeleted ? "secondary" : "destructive"}>
          {row.original.canBeDeleted ? t('common.status.active') : t('admin.settings.accounts.protected')}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: () => <div className="text-right">{t('common.actions.action')}</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEditDialog(row.original)}
            disabled={isAnyOperationInProgress}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openDeleteDialog(row.original)}
            disabled={!row.original.canBeDeleted || isAnyOperationInProgress}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const renderMobileRow = (admin: AdminAccountWithDetails) => (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          <Shield className="h-4 w-4 text-muted-foreground" />
          {admin.userName}
        </div>
        <Badge variant={getRoleBadgeVariant(admin.userRole)}>{getRoleLabel(admin.userRole)}</Badge>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {formatDate(admin.createdDate)}
        </div>
        <Badge variant={admin.canBeDeleted ? "secondary" : "destructive"}>
          {admin.canBeDeleted ? t('common.status.active') : t('admin.settings.accounts.protected')}
        </Badge>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => openEditDialog(admin)}
          disabled={isAnyOperationInProgress}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => openDeleteDialog(admin)}
          disabled={!admin.canBeDeleted || isAnyOperationInProgress}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
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
                <Users className="h-5 w-5" />
                {t('admin.settings.accounts')}
              </CardTitle>
              <CardDescription>
                {t('admin.settings.accounts.description')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading || isAnyOperationInProgress}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {t('common.actions.refresh')}
              </Button>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                disabled={isAnyOperationInProgress}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('admin.settings.accounts.add')}
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
                {t('admin.settings.accounts.loadError')}
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
          {isLoading && <TableSkeleton rows={3} columns={5} />}

          {/* Data Table */}
          {!isLoading && !error && adminAccounts && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{t('admin.settings.accounts.totalAdmins', { count: adminAccounts.length })}</span>
                <span>{t('admin.settings.accounts.activeCount', { count: adminAccounts.filter(admin => admin.canBeDeleted).length })}</span>
              </div>

              {/* Table */}
              <DataTable
                columns={columns}
                data={adminAccounts}
                getRowKey={(admin) => String(admin.idUser)}
                renderMobileRow={renderMobileRow}
                emptyState={
                  <EmptyState
                    icon={<Users className="h-6 w-6" />}
                    title={t('admin.settings.accounts.noAccountsFound')}
                    body={t('admin.settings.accounts.description')}
                  />
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Admin Dialog */}
      <AdminAccountDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSave={handleAddAdmin}
        isSaving={createAdminMutation.isPending}
      />

      {/* Edit Admin Dialog */}
      <AdminAccountDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setSelectedAdmin(null);
        }}
        onSave={handleEditAdmin}
        admin={selectedAdmin || undefined}
        isSaving={updateAdminMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('admin.settings.accounts.deleteTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('admin.settings.accounts.deleteConfirm', { name: selectedAdmin?.userName ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleteAdminMutation.isPending}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAdmin}
              disabled={deleteAdminMutation.isPending}
            >
              {deleteAdminMutation.isPending ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-foreground" />
                  {t('common.deleting')}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('common.delete')}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
