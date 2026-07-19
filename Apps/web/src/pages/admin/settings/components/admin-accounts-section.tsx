/**
 * Admin Accounts Section Component
 * Manages admin user accounts with full CRUD functionality
 */

import React, { useState, useMemo } from 'react';
import { Plus, Users, Shield, Calendar, Trash2, Edit, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
   * Close all dialogs
   */
  const closeDialogs = () => {
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
    setIsDeleteDialogOpen(false);
    setSelectedAdmin(null);
  };

  /**
   * Get role label
   */
  const getRoleLabel = (role: UserRoleCode) => {
    switch (role) {
      case UserRoleCode.admin:
        return 'Administrator';
      default:
        return 'Unknown';
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

  return (
    <div className={className}>
      {/* Section Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Admin Accounts
              </CardTitle>
              <CardDescription>
                Manage administrator accounts and permissions
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
                Refresh
              </Button>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                disabled={isAnyOperationInProgress}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Admin
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
                Failed to load admin accounts. Please try again.
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
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          )}

          {/* Data Table */}
          {!isLoading && !error && adminAccounts && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Total Admins: {adminAccounts.length}</span>
                <span>Active: {adminAccounts.filter(admin => admin.canBeDeleted).length}</span>
              </div>

              {/* Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adminAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No admin accounts found
                        </TableCell>
                      </TableRow>
                    ) : (
                      adminAccounts.map((admin) => (
                        <TableRow key={admin.idUser}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-muted-foreground" />
                              {admin.userName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getRoleBadgeVariant(admin.userRole)}>
                              {getRoleLabel(admin.userRole)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {formatDate(admin.createdDate)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={admin.canBeDeleted ? "secondary" : "destructive"}>
                              {admin.canBeDeleted ? "Active" : "Protected"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
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
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
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
              Delete Admin Account
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the admin account "{selectedAdmin?.userName}"? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleteAdminMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAdmin}
              disabled={deleteAdminMutation.isPending}
            >
              {deleteAdminMutation.isPending ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-foreground" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
